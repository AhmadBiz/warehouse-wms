import { sql, eq } from "drizzle-orm";
import { db, schema as s } from "../src/db/index";
import { suggestLocation } from "../src/lib/slotting";
import { blockersFor } from "../src/lib/blocking";
import { capacitySummary } from "../src/lib/capacity";

const byStatus = db.all<{ status: string; n: number }>(sql`select status, count(*) n from pallets group by status`);
console.log("pallets by status", byStatus);
const byZone = db.all<{ zone: string; n: number }>(sql`select z.code zone, count(*) n from pallets p join locations l on l.id = p.location_id join zones z on z.id = l.zone_id where p.status in ('STORED','ALLOCATED') group by z.code`);
console.log("stored by zone", byZone);

const site = db.select().from(s.sites).get()!;
const zones = db.select().from(s.zones).all();
const locations = db.select().from(s.locations).all();
const stored = db.select().from(s.pallets).where(sql`status in ('STORED','ALLOCATED','RECEIVED')`).all();
const occ = new Map<number, number>();
for (const p of stored) if (p.locationId) occ.set(p.locationId, (occ.get(p.locationId) ?? 0) + 1);
const cap = capacitySummary(site, zones, locations, occ, { CROSSDOCK: 24, FLOOR: 8 });
console.log("capacity", cap.zones.map((z) => `${z.zone.code}: ${z.occupied}/${z.positions} (+${z.reserved} reserved) ${z.pctFull}%`), "free", cap.totalFree, "containers", cap.containersFree);

const nrd = db.select().from(s.customers).where(eq(s.customers.code, "NRD")).get()!;
const occupants = stored.filter((p) => p.locationId).map((p) => ({
  id: p.id, code: p.code, customerId: p.customerId, locationId: p.locationId!, stackLevel: p.stackLevel, heightIn: p.heightIn, stackable: p.stackable,
  leavesInDays: (p.expectedStayDays ?? 3) - Math.floor((Date.now() - (p.receivedAt?.getTime() ?? Date.now())) / 86400000),
}));
const door = locations.find((l) => l.code === "D2")!;
for (const test of [
  { label: "same-day 58in 640lb", p: { customerId: nrd.id, heightIn: 58, weightLb: 640, stackable: true, expectedStayDays: 1, dockDoor: "D2" } },
  { label: "30-day 58in 640lb", p: { customerId: nrd.id, heightIn: 58, weightLb: 640, stackable: true, expectedStayDays: 30, dockDoor: "D2" } },
  { label: "4-day", p: { customerId: nrd.id, heightIn: 52, weightLb: 900, stackable: true, expectedStayDays: 4, dockDoor: "D2" } },
  { label: "heavy 30-day 2400lb", p: { customerId: nrd.id, heightIn: 60, weightLb: 2400, stackable: false, expectedStayDays: 30 } },
  { label: "long item", p: { customerId: nrd.id, heightIn: 40, weightLb: 900, lengthIn: 144, stackable: false, expectedStayDays: 10 } },
  { label: "bonded", p: { customerId: nrd.id, heightIn: 50, weightLb: 900, bonded: true, stackable: true, expectedStayDays: 30 } },
]) {
  const r = suggestLocation(test.p, { locations, zones, occupants, customer: nrd, doorX: door.x + door.w / 2 });
  console.log(`\n${test.label}: ${r.strategy}\n  best: ${r.best?.location.code} (stack ${r.best?.stackLevel}, score ${r.best?.score.toFixed(0)})\n  reasons: ${r.best?.reasons.join(" | ")}\n  warnings: ${r.best?.warnings.join(" | ")}\n  alts: ${r.alternatives.map((a) => a.location.code + ":" + a.score.toFixed(0)).join(", ")} (considered ${r.considered})`);
}
const mcfPick = db.select().from(s.customers).where(eq(s.customers.code, "MCF")).get()!;
const r2 = suggestLocation({ customerId: mcfPick.id, heightIn: 50, weightLb: 700, stackable: true, expectedStayDays: 40 }, { locations, zones, occupants, customer: mcfPick });
console.log(`\nMCF pick customer: ${r2.strategy} → ${r2.best?.location.code} stack ${r2.best?.stackLevel}; ${r2.best?.reasons.join(" | ")}; warn: ${r2.best?.warnings.join(" | ")}`);

// Blocking on the demo orders
const locById = new Map(locations.map((l) => [l.id, l]));
const lines = db.select().from(s.outboundLines).all();
const orders = db.select().from(s.outboundOrders).all();
for (const o of orders.filter((o) => o.status === "REQUESTED")) {
  console.log(`\nOrder ${o.reference}`);
  for (const ln of lines.filter((l) => l.orderId === o.id)) {
    const p = stored.find((x) => x.id === ln.palletId)!;
    const loc = locById.get(p.locationId!)!;
    const b = blockersFor(p, loc, stored, locById);
    console.log(`  ${p.code} @ ${loc.code} L${p.stackLevel} cartons=${ln.cartons ?? "whole"} blocked by: ${b.map((x) => `${x.pallet.code}@${x.location.code}(${x.why})`).join(", ") || "none"}`);
  }
}
const emails = db.select().from(s.inboundEmails).all();
console.log("\nemails", emails.map((e) => `${e.status}:${e.kind}:${e.subject.slice(0, 40)}`));
