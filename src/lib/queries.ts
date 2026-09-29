import { and, desc, eq, inArray, sql, gte, lt, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Pallet, Location, Zone, Customer, OutboundLine, OutboundOrder, Shipment } from "@/db/schema";
import { capacitySummary } from "./capacity";
import { blockersFor, type Blocker } from "./blocking";
import { daysBetween, startOfDay, addDays } from "./format";

export const IN_STOCK = ["RECEIVED", "STORED", "ALLOCATED", "PICKED"] as const;

export type PalletFull = Pallet & { customer: Customer; location: Location | null; shipment: Shipment | null };

export async function getSite() {
  return (await db.query.sites.findFirst())!;
}

export async function getLayout() {
  const [zones, locations] = await Promise.all([db.query.zones.findMany(), db.query.locations.findMany()]);
  return { zones, locations };
}

export async function getStockPallets(): Promise<PalletFull[]> {
  return db.query.pallets.findMany({ where: inArray(s.pallets.status, [...IN_STOCK]), with: { customer: true, location: true, shipment: true } });
}

export function occupancyOf(pallets: Pallet[]) {
  const m = new Map<number, number>();
  for (const p of pallets) if (p.locationId) m.set(p.locationId, (m.get(p.locationId) ?? 0) + 1);
  return m;
}

/** Days until the pallet is expected to leave (negative = overdue). */
export function leavesInDays(p: Pallet) {
  return (p.expectedStayDays ?? 3) - daysBetween(p.receivedAt);
}

export function toOccupants(pallets: Pallet[]) {
  return pallets
    .filter((p) => p.locationId)
    .map((p) => ({ id: p.id, code: p.code, customerId: p.customerId, locationId: p.locationId!, stackLevel: p.stackLevel, heightIn: p.heightIn, stackable: p.stackable, leavesInDays: leavesInDays(p) }));
}

export async function getReservedByZone() {
  // Pallets announced but not yet received, attributed to the zone they will most likely go to.
  const expected = await db.query.pallets.findMany({ where: eq(s.pallets.status, "EXPECTED"), with: { shipment: true } });
  const out: Partial<Record<Zone["kind"], number>> = {};
  for (const p of expected) {
    const sh = p.shipment;
    const kind: Zone["kind"] = sh?.bonded ? "BONDED" : sh?.isCrossDock || (p.expectedStayDays ?? 3) <= 1 ? "CROSSDOCK" : (p.expectedStayDays ?? 3) >= 7 ? "RACK" : "FLOOR";
    out[kind] = (out[kind] ?? 0) + 1;
  }
  return out;
}

export async function getCapacity() {
  const [site, { zones, locations }, stock, reserved] = await Promise.all([getSite(), getLayout(), getStockPallets(), getReservedByZone()]);
  return { site, zones, locations, stock, summary: capacitySummary(site, zones, locations, occupancyOf(stock), reserved) };
}

export async function getDashboard() {
  const cap = await getCapacity();
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);
  const [arrivalsToday, arrivalsSoon, ordersOpen, activity, emailsNew] = await Promise.all([
    db.query.shipments.findMany({ where: and(inArray(s.shipments.status, ["ANNOUNCED", "SCHEDULED", "ARRIVED", "RECEIVING"]), gte(s.shipments.expectedAt, today), lt(s.shipments.expectedAt, tomorrow)), with: { customer: true, pallets: true }, orderBy: s.shipments.expectedAt }),
    db.query.shipments.findMany({ where: and(inArray(s.shipments.status, ["ANNOUNCED", "SCHEDULED"]), gte(s.shipments.expectedAt, tomorrow), lt(s.shipments.expectedAt, dayAfter)), with: { customer: true }, orderBy: s.shipments.expectedAt }),
    db.query.outboundOrders.findMany({ where: inArray(s.outboundOrders.status, ["REQUESTED", "PLANNED", "PICKING"]), with: { customer: true, lines: { with: { pallet: { with: { location: true } } } } }, orderBy: s.outboundOrders.neededBy }),
    db.query.events.findMany({ orderBy: desc(s.events.at), limit: 14 }),
    db.query.inboundEmails.findMany({ where: inArray(s.inboundEmails.status, ["NEW", "NEEDS_REVIEW"]), with: { customer: true }, orderBy: desc(s.inboundEmails.receivedAt) }),
  ]);

  const stock = cap.stock;
  const locById = new Map(cap.locations.map((l) => [l.id, l]));
  const overdue = stock.filter((p) => p.status === "STORED" && leavesInDays(p) < -1).sort((a, b) => leavesInDays(a) - leavesInDays(b));
  const unconfirmed = stock.filter((p) => p.locationId && !p.locationConfirmedBy);
  const noPackingList = arrivalsToday.concat(arrivalsSoon as typeof arrivalsToday).filter((sh) => !sh.packingListReceived || sh.expectedPallets == null);
  // Blocked pallets in open orders
  let blockedLines = 0;
  for (const o of ordersOpen) {
    for (const ln of o.lines) {
      if (ln.status !== "PENDING" || !ln.pallet.locationId) continue;
      const loc = locById.get(ln.pallet.locationId);
      if (loc && blockersFor(ln.pallet, loc, stock, locById).length) blockedLines++;
    }
  }
  const shippedToday = await db.query.outboundOrders.findMany({ where: and(eq(s.outboundOrders.status, "SHIPPED"), gte(s.outboundOrders.shippedAt, today)), with: { lines: true } });
  const receivedToday = stock.filter((p) => p.receivedAt && p.receivedAt >= today).length;

  return { ...cap, arrivalsToday, arrivalsSoon, ordersOpen, activity, emailsNew, overdue, unconfirmed, noPackingList, blockedLines, shippedToday, receivedToday };
}

export async function getPallet(id: number) {
  return db.query.pallets.findFirst({
    where: eq(s.pallets.id, id),
    with: { customer: true, location: { with: { zone: true } }, shipment: true, movements: { orderBy: desc(s.movements.at), with: { from: true, to: true } }, lines: { with: { order: true } } },
  });
}

export async function getPalletByCode(code: string) {
  return db.query.pallets.findFirst({ where: eq(s.pallets.code, code.trim().toUpperCase()), with: { customer: true, location: true, shipment: true } });
}

export async function getShipment(id: number) {
  return db.query.shipments.findFirst({ where: eq(s.shipments.id, id), with: { customer: true, pallets: { with: { location: true }, orderBy: s.pallets.sequence } } });
}

export type PickStep = {
  line: OutboundLine & { pallet: PalletFull };
  location: Location | null;
  blockers: Blocker[]; // still blocking after earlier steps are done
  tempSpots: Location[]; // where to set blockers aside
};

/** Orders the lines so the crew walks the lanes front to back and never moves a pallet twice. */
export async function pickPlan(order: OutboundOrder & { lines: Array<OutboundLine & { pallet: PalletFull }> }) {
  const { locations, zones } = await getLayout();
  const stock = await getStockPallets();
  const locById = new Map(locations.map((l) => [l.id, l]));
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const rank = (l: Location | null) => {
    if (!l) return 9e9;
    const z = zoneById.get(l.zoneId);
    const zr = { CROSSDOCK: 0, FLOOR: 1, BONDED: 2, OVERSIZE: 3, RACK: 4, HOLD: 5, DOCK: 6, SCALE: 6, OFFICE: 6 }[z?.kind ?? "OFFICE"];
    return zr * 1e6 + (l.lane ?? 0) * 1000 + (l.depth ?? 0) * 10 + (l.row ? l.row.charCodeAt(0) * 100 + (l.bay ?? 0) : 0);
  };
  const lines = [...order.lines].sort((a, b) => {
    const la = locById.get(a.pallet.locationId ?? -1) ?? null, lb = locById.get(b.pallet.locationId ?? -1) ?? null;
    return rank(la) - rank(lb) || b.pallet.stackLevel - a.pallet.stackLevel;
  });
  // Simulate: pallets picked whole leave the floor, and pallets set aside stop blocking later steps.
  const remaining = new Map(stock.map((p) => [p.id, p]));
  const steps: PickStep[] = [];
  const occupied = new Set(stock.filter((p) => p.locationId).map((p) => p.locationId!));
  const orderCustomer = order.customerId;
  // Temporary spots: one nearby lane, empty or already this customer's, filled from the back.
  const laneOf = (l: Location) => `${l.zoneId}:${l.lane}`;
  const lanesByKey = new Map<string, Location[]>();
  for (const l of locations) if (l.kind === "FLOOR" && l.lane != null && (l.lane ?? 0) < 100) { const arr = lanesByKey.get(laneOf(l)) ?? []; arr.push(l); lanesByKey.set(laneOf(l), arr); }
  const tempQueue: Location[] = [];
  const tempLanesUsed = new Set<string>();
  function moreTempSpots(near: Location) {
    const ranked = [...lanesByKey.entries()]
      .filter(([k]) => k !== laneOf(near) && !tempLanesUsed.has(k))
      .map(([k, locs]) => {
        const occ = locs.filter((l) => occupied.has(l.id));
        const custs = new Set(stock.filter((p) => p.locationId && occ.some((l) => l.id === p.locationId)).map((p) => p.customerId));
        const empty = occ.length === 0;
        const own = custs.size === 1 && custs.has(orderCustomer);
        const score = (empty ? 100 : own ? 50 : 0) - Math.abs((locs[0].lane ?? 0) - (near.lane ?? 0));
        return { k, locs, score, ok: empty || own };
      })
      .filter((x) => x.ok)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best) return;
    tempLanesUsed.add(best.k);
    const sorted = [...best.locs].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0)); // deepest first
    let firstOcc = Infinity;
    for (const l of sorted) if (occupied.has(l.id)) firstOcc = Math.min(firstOcc, l.depth ?? 0);
    for (const l of sorted) if ((l.depth ?? 0) < firstOcc) { tempQueue.push(l); if (l.maxStack > 1) tempQueue.push(l); }
  }
  for (const line of lines) {
    const loc = locById.get(line.pallet.locationId ?? -1) ?? null;
    let blockers: Blocker[] = [];
    if (loc && line.status === "PENDING") {
      blockers = blockersFor(line.pallet, loc, [...remaining.values()], locById).filter((b) => remaining.has(b.pallet.id));
      // Carton picks from the top pallet of a stack need nothing moved; from the bottom, only the top.
      if (line.cartons != null) blockers = blockers.filter((b) => b.why === "ON_TOP" || (loc.depth ?? 0) > 1);
    }
    const tempSpots: Location[] = [];
    if (blockers.length && loc) {
      while (tempQueue.length < blockers.length) { const before = tempQueue.length; moreTempSpots(loc); if (tempQueue.length === before) break; }
      for (let i = 0; i < blockers.length && tempQueue.length; i++) tempSpots.push(tempQueue.shift()!);
      for (const b of blockers) remaining.delete(b.pallet.id); // set aside → no longer in the way
    }
    steps.push({ line, location: loc, blockers, tempSpots });
    if (line.cartons == null) remaining.delete(line.pallet.id); // whole pallet leaves
  }
  const totalMoves = steps.reduce((n, st) => n + st.blockers.length, 0);
  return { steps, totalMoves };
}

export async function getOrder(id: number) {
  return db.query.outboundOrders.findFirst({
    where: eq(s.outboundOrders.id, id),
    with: { customer: true, lines: { with: { pallet: { with: { customer: true, location: true, shipment: true } } } } },
  });
}

export async function getCustomerWithStock(id: number) {
  const customer = await db.query.customers.findFirst({ where: eq(s.customers.id, id) });
  if (!customer) return null;
  const [pallets, shipments, orders] = await Promise.all([
    db.query.pallets.findMany({ where: eq(s.pallets.customerId, id), with: { location: { with: { zone: true } }, shipment: true }, orderBy: desc(s.pallets.receivedAt) }),
    db.query.shipments.findMany({ where: eq(s.shipments.customerId, id), orderBy: desc(s.shipments.expectedAt), limit: 20 }),
    db.query.outboundOrders.findMany({ where: eq(s.outboundOrders.customerId, id), with: { lines: true }, orderBy: desc(s.outboundOrders.requestedAt), limit: 20 }),
  ]);
  return { customer, pallets, shipments, orders };
}

export async function unconfirmedPallets() {
  return db.query.pallets.findMany({ where: and(inArray(s.pallets.status, ["STORED", "ALLOCATED"]), isNull(s.pallets.locationConfirmedBy)), with: { customer: true, location: true } });
}

export const nowSql = sql`(unixepoch() * 1000)`;
