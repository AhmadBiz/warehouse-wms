// Demo data: one 35,000 sq ft site, 20 customers, ~280 pallets in storage, today's arrivals
// and releases. Everything is relative to the moment the seed runs, so "today" is always today.
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { eq as sqlEq } from "drizzle-orm";
import * as s from "./schema";
import { buildLayout, SITE, DOOR_CODES } from "./layout";

type Db = ReturnType<typeof drizzle<typeof s>>;

// Deterministic random so the demo looks the same every time it is reset.
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260924);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

const DAY = 86_400_000;
const now = new Date();
const daysAgo = (d: number, hour = 9) => {
  const x = new Date(now.getTime() - d * DAY);
  x.setHours(hour, between(0, 59), 0, 0);
  return x;
};
const todayAt = (hour: number, min = 0) => {
  const x = new Date(now);
  x.setHours(hour, min, 0, 0);
  return x;
};

type CustomerSeed = {
  code: string; name: string; domain: string; model: s.BillingModel; color: string;
  avgStay: number; picksPerWeek: number; contact: string; goods: string[]; storageRate: number;
};

const CUSTOMERS: CustomerSeed[] = [
  { code: "NRD", name: "Nordika Imports", domain: "nordika.ca", model: "PALLET_WEEK", color: "#2563eb", avgStay: 2, picksPerWeek: 1, contact: "Sofia Lindqvist", goods: ["Ceramic tiles", "Porcelain sinks", "Bathroom fixtures"], storageRate: 900 },
  { code: "BOR", name: "Boréal Distribution", domain: "boreal-dist.ca", model: "PALLET_MONTH", color: "#0891b2", avgStay: 25, picksPerWeek: 0.5, contact: "Marc Pelletier", goods: ["Canned goods", "Dry pasta", "Bottled water"], storageRate: 1800 },
  { code: "MCF", name: "Maple Crest Foods", domain: "maplecrest.ca", model: "CARTON_ORDER", color: "#d97706", avgStay: 40, picksPerWeek: 5, contact: "Julie Gagnon", goods: ["Maple syrup 12×500 ml", "Maple butter cases", "Gift boxes"], storageRate: 1500 },
  { code: "LTX", name: "Lachine Textiles", domain: "lachinetextiles.com", model: "PALLET_MONTH", color: "#7c3aed", avgStay: 30, picksPerWeek: 0.5, contact: "Amir Haddad", goods: ["Cotton bolts", "Polyester rolls", "Upholstery fabric"], storageRate: 1600 },
  { code: "SLE", name: "Saint-Laurent Electronics", domain: "sle.ca", model: "CARTON_ORDER", color: "#059669", avgStay: 35, picksPerWeek: 4, contact: "Kevin Tran", goods: ["LED panels", "Power supplies", "Cable spools"], storageRate: 1500 },
  { code: "TRF", name: "Tremblay & Fils", domain: "tremblayfils.ca", model: "PALLET_WEEK", color: "#dc2626", avgStay: 8, picksPerWeek: 1, contact: "Luc Tremblay", goods: ["Roofing shingles", "Insulation", "Siding"], storageRate: 850 },
  { code: "RHG", name: "Riverside Home Goods", domain: "riversidehome.ca", model: "CARTON_ORDER", color: "#db2777", avgStay: 45, picksPerWeek: 3, contact: "Emma Roy", goods: ["Bedding sets", "Cushions", "Curtain rods"], storageRate: 1500 },
  { code: "AAP", name: "Atlas Auto Parts", domain: "atlasautoparts.ca", model: "PALLET_MONTH", color: "#4b5563", avgStay: 60, picksPerWeek: 0.3, contact: "Nikos Petrakis", goods: ["Brake rotors", "Filters", "Alternators"], storageRate: 1700 },
  { code: "KYA", name: "Kaya Cosmetics", domain: "kayacosmetics.com", model: "CARTON_ORDER", color: "#c026d3", avgStay: 30, picksPerWeek: 4, contact: "Priya Nair", goods: ["Skincare cases", "Fragrance sets", "Display units"], storageRate: 1500 },
  { code: "DPK", name: "Dorval Packaging", domain: "dorvalpack.ca", model: "PALLET_WEEK", color: "#ea580c", avgStay: 1, picksPerWeek: 0, contact: "Sylvie Bouchard", goods: ["Corrugated boxes", "Stretch film", "Kraft rolls"], storageRate: 800 },
  { code: "LFS", name: "Longueuil Fitness Supply", domain: "longueuilfitness.ca", model: "PALLET_MONTH", color: "#16a34a", avgStay: 20, picksPerWeek: 1, contact: "David Chen", goods: ["Dumbbell sets", "Yoga mats", "Rowing machines"], storageRate: 1700 },
  { code: "VCR", name: "Verdun Coffee Roasters", domain: "verduncoffee.ca", model: "CARTON_ORDER", color: "#92400e", avgStay: 25, picksPerWeek: 5, contact: "Isabelle Fortin", goods: ["Green coffee 60 kg bags", "Roasted 1 kg cases", "Grinders"], storageRate: 1500 },
  { code: "LVT", name: "Laval Toys", domain: "lavaltoys.ca", model: "PALLET_MONTH", color: "#f59e0b", avgStay: 50, picksPerWeek: 0.5, contact: "Sam Okafor", goods: ["Plush toys", "Board games", "Ride-on cars"], storageRate: 1600 },
  { code: "BMS", name: "Brossard Medical Supply", domain: "brossardmed.ca", model: "PALLET_WEEK", color: "#0284c7", avgStay: 5, picksPerWeek: 2, contact: "Nadia Bensaid", goods: ["Exam gloves", "Gauze cases", "IV stands"], storageRate: 950 },
  { code: "PCF", name: "Pointe-Claire Furniture", domain: "pcfurniture.ca", model: "PALLET_MONTH", color: "#65a30d", avgStay: 15, picksPerWeek: 1, contact: "Olivier Dubé", goods: ["Sofas (boxed)", "Dining tables", "Bookshelves"], storageRate: 1900 },
  { code: "MEA", name: "Mile End Apparel", domain: "mileendapparel.com", model: "PALLET_WEEK", color: "#9333ea", avgStay: 1, picksPerWeek: 0, contact: "Rachel Klein", goods: ["T-shirt cartons", "Denim", "Outerwear"], storageRate: 800 },
  { code: "AGP", name: "Anjou Garden Products", domain: "anjougarden.ca", model: "PALLET_MONTH", color: "#15803d", avgStay: 40, picksPerWeek: 0.5, contact: "Pierre Lavoie", goods: ["Potting soil", "Planters", "Garden hoses"], storageRate: 1500 },
  { code: "BFB", name: "Beaconsfield Books", domain: "beaconsfieldbooks.ca", model: "PALLET_MONTH", color: "#1d4ed8", avgStay: 90, picksPerWeek: 0.2, contact: "Hannah Weiss", goods: ["Hardcover cases", "Paperback cases", "Calendars"], storageRate: 1400 },
  { code: "LST", name: "Lasalle Tools", domain: "lasalletools.ca", model: "PALLET_WEEK", color: "#b45309", avgStay: 3, picksPerWeek: 2, contact: "Tony Russo", goods: ["Drill kits", "Saw blades", "Tool chests"], storageRate: 900 },
  { code: "HRT", name: "Hochelaga Rail Parts", domain: "hrtparts.ca", model: "PALLET_MONTH", color: "#0f766e", avgStay: 30, picksPerWeek: 0.3, contact: "Geneviève Côté", goods: ["Bearings (in bond)", "Brake assemblies (in bond)", "Couplers (in bond)"], storageRate: 2200 },
];

export function seed(outer: Db) {
  outer.transaction((db) => {
    // ---- Site & layout
    const site = db.insert(s.sites).values({
      code: SITE.code,
      name: SITE.name,
      address: SITE.address,
      sqft: SITE.areaSqFt,
      widthFt: SITE.widthFt,
      depthFt: SITE.depthFt,
      palletsPerContainer: 20,
      rafterHeightIn: 240,
      sprinklerClearanceIn: null,
    }).returning().get();

    const layout = buildLayout();
    const zoneIdByCode = new Map<string, number>();
    for (const z of layout.zones) {
      const row = db.insert(s.zones).values({ siteId: site.id, ...z }).returning().get();
      zoneIdByCode.set(z.code, row.id);
    }
    const locByCode = new Map<string, s.Location>();
    for (const l of layout.locations) {
      const { zoneCode, ...rest } = l;
      const row = db.insert(s.locations).values({ siteId: site.id, zoneId: zoneIdByCode.get(zoneCode)!, ...rest }).returning().get();
      locByCode.set(row.code, row);
    }

    // ---- Customers
    const cust = new Map<string, s.Customer>();
    for (const c of CUSTOMERS) {
      const row = db.insert(s.customers).values({
        code: c.code, name: c.name, contactName: c.contact, contactEmail: `ops@${c.domain}`, emailDomain: c.domain,
        billingModel: c.model, storageRateCents: c.storageRate, handlingInCents: 800, handlingOutCents: 800,
        cartonPickCents: 150, orderFeeCents: 1200, color: c.color, avgStayDays: c.avgStay, picksPerWeek: c.picksPerWeek,
        portalToken: c.code.toLowerCase() + "-demo",
      }).returning().get();
      cust.set(c.code, row);
    }
    const seedOf = (code: string) => CUSTOMERS.find((c) => c.code === code)!;

    // ---- Users
    db.insert(s.users).values([
      { name: "Ahmad", role: "ADMIN" },
      { name: "Marie (office)", role: "OFFICE" },
      { name: "Jean (forklift)", role: "FORKLIFT" },
      { name: "Karim (forklift)", role: "FORKLIFT" },
    ]).run();

    // ---- Helpers
    const seq = new Map<string, number>();
    const nextCode = (code: string) => {
      const n = (seq.get(code) ?? 0) + 1;
      seq.set(code, n);
      return `PLT-${code}-${String(n).padStart(5, "0")}`;
    };
    const occupancy = new Map<number, number>(); // locationId -> count
    // The client's current system numbers pallets with sequential 10-digit lot numbers (receipt R03455
    // ends at 0000548531). The demo continues that sequence so labels look familiar.
    let lotSeq = 548532;
    const nextLot = () => String(lotSeq++).padStart(10, "0");
    const skuOf = new Map<string, string>();
    const skuFor = (desc: string) => {
      let s = skuOf.get(desc);
      if (!s) { s = String(210000 + skuOf.size * 37 + between(0, 30)); skuOf.set(desc, s); }
      return s;
    };
    const poFor = (sh: s.Shipment) => `58${String(5000 + sh.id * 7).slice(-4)}`;

    const events: Array<typeof s.events.$inferInsert> = [];
    const log = (at: Date, kind: string, message: string, entityType?: string, entityId?: number, byUser?: string) =>
      events.push({ at, kind, message, entityType, entityId, byUser });

    function makeShipment(v: Partial<typeof s.shipments.$inferInsert> & { customerId: number; reference: string }) {
      const row = db.insert(s.shipments).values({ siteId: site.id, status: "RECEIVED", packingListReceived: true, ...v }).returning().get();
      return row;
    }

    type PalletOpts = {
      customer: s.Customer; shipment: s.Shipment; receivedAt: Date; stay: number; heightIn?: number; weightLb?: number;
      cartons?: number; description?: string; stackable?: boolean; oversize?: boolean; lengthIn?: number; bonded?: boolean;
      ccn?: string | null; txn?: string | null; confirmed?: boolean; sequence?: number;
    };

    function storedPallet(o: PalletOpts, locCode: string, stackLevel = 1): s.Pallet {
      const loc = locByCode.get(locCode);
      if (!loc) throw new Error("no location " + locCode);
      const sd = seedOf(o.customer.code);
      const cartons = o.cartons ?? between(18, 72);
      const confirmed = o.confirmed ?? true;
      const description = o.description ?? pick(sd.goods);
      const casePack = pick([12, 24, 24, 36]);
      const p = db.insert(s.pallets).values({
        code: nextCode(o.customer.code), lotNumber: nextLot(), siteId: site.id, customerId: o.customer.id, shipmentId: o.shipment.id, sequence: o.sequence,
        sku: skuFor(description), poNumber: poFor(o.shipment), casePack, units: cartons * casePack,
        handlingUnit: o.oversize ? "BUNDLE" : "PALLET",
        status: "STORED", description, cartons, cartonsRemaining: cartons,
        lengthIn: o.lengthIn ?? 48, widthIn: 40, heightIn: o.heightIn ?? between(48, 62), weightLb: o.weightLb ?? between(380, 1650),
        stackable: o.stackable ?? true, oversize: o.oversize ?? false, bonded: o.bonded ?? false,
        cargoControlNumber: o.ccn ?? null, transactionNumber: o.txn ?? null,
        expectedStayDays: o.stay, receivedAt: o.receivedAt, storedAt: new Date(o.receivedAt.getTime() + 25 * 60000),
        locationId: loc.id, stackLevel, locationConfirmedBy: confirmed ? (rnd() < 0.85 ? "SCAN" : "MANUAL") : null,
        locationConfirmedAt: confirmed ? new Date(o.receivedAt.getTime() + 26 * 60000) : null, createdAt: o.receivedAt,
      }).returning().get();
      occupancy.set(loc.id, (occupancy.get(loc.id) ?? 0) + 1);
      const door = locByCode.get(pick(DOOR_CODES))!;
      db.insert(s.movements).values([
        { palletId: p.id, type: "RECEIVE", toLocationId: door.id, source: "SCAN", byUser: pick(["Jean", "Karim"]), at: o.receivedAt, reason: "Scanned at dock" },
        { palletId: p.id, type: "PUTAWAY", fromLocationId: door.id, toLocationId: loc.id, source: confirmed ? "SCAN" : "SYSTEM", byUser: pick(["Jean", "Karim"]), at: new Date(o.receivedAt.getTime() + 25 * 60000), reason: "Assigned by system" },
      ]).run();
      return p;
    }

    // ---- Historical shipments + stored pallets, per customer
    const shipmentsByCust = new Map<string, s.Shipment[]>();
    function histShipment(code: string, ago: number, n: number, extra: Partial<typeof s.shipments.$inferInsert> = {}) {
      const c = cust.get(code)!;
      const sh = makeShipment({
        customerId: c.id, reference: `${code}-${String(between(1000, 9999))}`, containerNumber: rnd() < 0.6 ? `${pick(["MSCU", "TCLU", "CMAU", "HLXU", "OOLU"])}${between(1000000, 9999999)}` : null,
        carrier: pick(["Transport Bourassa", "TFI Express", "Robert Transport", "Groupe Morneau", "customer truck"]),
        status: "CLOSED", expectedAt: daysAgo(ago, 8), arrivedAt: daysAgo(ago, 9), completedAt: daysAgo(ago, 11), dockDoor: pick(DOOR_CODES),
        expectedPallets: n, expectedCartons: n * between(20, 60), expectedWeightLb: n * between(500, 1400), createdAt: daysAgo(ago + 2), ...extra,
      });
      shipmentsByCust.set(code, [...(shipmentsByCust.get(code) ?? []), sh]);
      log(sh.arrivedAt!, "SHIPMENT_RECEIVED", `${c.name} ${sh.reference} received, ${n} pallets`, "shipment", sh.id, "Marie");
      return sh;
    }

    // Floor lanes: fill from the back (depth 6) toward the front, stacking two where allowed.
    function fillLane(lane: number, custCode: string, count: number, o: Omit<PalletOpts, "customer" | "shipment"> & { shipment?: s.Shipment }, stack = true, maxDepth = 6) {
      const c = cust.get(custCode)!;
      const sh = o.shipment ?? histShipment(custCode, Math.max(1, Math.round(o.stay * 0.6)), count);
      const out: s.Pallet[] = [];
      let placed = 0;
      for (let d = maxDepth; d >= 1 && placed < count; d--) {
        const code = `L-${String(lane).padStart(2, "0")}-${d}`;
        out.push(storedPallet({ ...o, customer: c, shipment: sh, heightIn: o.heightIn ?? between(46, 58) }, code, 1));
        placed++;
        if (stack && placed < count && rnd() < 0.8) {
          out.push(storedPallet({ ...o, customer: c, shipment: sh, heightIn: o.heightIn ?? between(44, 56) }, code, 2));
          placed++;
        }
      }
      return out;
    }

    // Pick customers at lane fronts (lanes 1-7)
    fillLane(1, "MCF", 11, { receivedAt: daysAgo(28), stay: 45, cartons: 48 });
    fillLane(2, "MCF", 9, { receivedAt: daysAgo(12), stay: 45, cartons: 48 });
    fillLane(3, "SLE", 10, { receivedAt: daysAgo(20), stay: 35, cartons: 36 });
    fillLane(4, "SLE", 6, { receivedAt: daysAgo(6), stay: 35, cartons: 36 });
    fillLane(5, "RHG", 10, { receivedAt: daysAgo(31), stay: 45, cartons: 24 });
    fillLane(6, "KYA", 8, { receivedAt: daysAgo(15), stay: 30, cartons: 60 });
    fillLane(7, "VCR", 9, { receivedAt: daysAgo(9), stay: 25, cartons: 20 });
    // Medium stays (lanes 8-16)
    fillLane(8, "TRF", 10, { receivedAt: daysAgo(4), stay: 8, weightLb: between(1400, 1900) });
    fillLane(9, "TRF", 7, { receivedAt: daysAgo(1), stay: 8, weightLb: between(1400, 1900) });
    fillLane(10, "BMS", 8, { receivedAt: daysAgo(2), stay: 5 });
    fillLane(11, "LST", 6, { receivedAt: daysAgo(1), stay: 3 });
    fillLane(12, "LFS", 9, { receivedAt: daysAgo(10), stay: 20, weightLb: between(900, 1800) });
    const nrdOld = fillLane(13, "NRD", 8, { receivedAt: daysAgo(6), stay: 4 }); // overdue: expected 4 days, 6 in
    fillLane(14, "NRD", 5, { receivedAt: daysAgo(1), stay: 3 });
    fillLane(15, "PCF", 6, { receivedAt: daysAgo(7), stay: 15, stackable: false }, false);
    fillLane(16, "BOR", 10, { receivedAt: daysAgo(3), stay: 25 });
    // Lanes 17-24 stay empty for the demo putaways.

    // Racking: long stays. Rows A-F, bays 1-20, levels 1-3.
    function fillRack(custCode: string, rows: string[], bays: [number, number], count: number, o: Omit<PalletOpts, "customer" | "shipment">, opts: { heavy?: boolean } = {}) {
      const c = cust.get(custCode)!;
      const perShipment = Math.min(count, 12);
      let sh = histShipment(custCode, Math.max(2, Math.round(o.stay * 0.55)), perShipment);
      let inShipment = 0;
      let placed = 0;
      for (const row of rows) {
        for (let b = bays[0]; b <= bays[1] && placed < count; b++) {
          const levels = opts.heavy ? [1] : [2, 3, 1];
          for (const lvl of levels) {
            if (placed >= count) break;
            if (rnd() < 0.3) continue; // leave gaps
            const code = `${row}-${String(b).padStart(2, "0")}-${lvl}`;
            if ((occupancy.get(locByCode.get(code)!.id) ?? 0) > 0) continue;
            if (inShipment >= perShipment) { sh = histShipment(custCode, Math.max(2, between(2, o.stay)), perShipment); inShipment = 0; }
            const h = lvl === 1 ? between(52, 68) : between(44, 58);
            storedPallet({ ...o, customer: c, shipment: sh, heightIn: h, weightLb: opts.heavy ? between(1900, 2800) : between(400, 1500), receivedAt: daysAgo(between(2, Math.round(o.stay * 1.1))) }, code, 1);
            placed++; inShipment++;
          }
        }
      }
    }
    fillRack("BOR", ["A", "B"], [1, 10], 26, { receivedAt: daysAgo(10), stay: 25 });
    fillRack("LTX", ["A", "B"], [11, 20], 22, { receivedAt: daysAgo(15), stay: 30 });
    fillRack("AAP", ["C"], [1, 20], 24, { receivedAt: daysAgo(30), stay: 60 }, { heavy: true });
    fillRack("LVT", ["D"], [1, 12], 20, { receivedAt: daysAgo(20), stay: 50 });
    fillRack("AGP", ["D", "E"], [13, 20], 18, { receivedAt: daysAgo(18), stay: 40 });
    fillRack("BFB", ["E"], [1, 12], 22, { receivedAt: daysAgo(60), stay: 90 });
    fillRack("LFS", ["F"], [1, 8], 10, { receivedAt: daysAgo(8), stay: 20 });
    fillRack("PCF", ["F"], [9, 14], 8, { receivedAt: daysAgo(5), stay: 15 });
    fillRack("KYA", ["F"], [15, 20], 9, { receivedAt: daysAgo(12), stay: 30, cartons: 60 });

    // Bonded cage: HRT, in bond
    {
      const c = cust.get("HRT")!;
      const sh = histShipment("HRT", 9, 14, { bonded: true, cargoControlNumber: "8021-4471 9932 07", transactionNumber: "14071 2026 0915 4471" });
      let placed = 0;
      for (let n = 1; n <= 7 && placed < 14; n++) {
        const code = `BD-${String(n).padStart(2, "0")}`;
        storedPallet({ customer: c, shipment: sh, receivedAt: daysAgo(9), stay: 30, bonded: true, ccn: sh.cargoControlNumber, txn: sh.transactionNumber, weightLb: between(900, 1900), sequence: ++placed }, code, 1);
        storedPallet({ customer: c, shipment: sh, receivedAt: daysAgo(9), stay: 30, bonded: true, ccn: sh.cargoControlNumber, txn: sh.transactionNumber, weightLb: between(900, 1900), sequence: ++placed }, code, 2);
      }
    }

    // Oversize: two long crates for PCF
    {
      const c = cust.get("PCF")!;
      const sh = histShipment("PCF", 3, 2);
      storedPallet({ customer: c, shipment: sh, receivedAt: daysAgo(3), stay: 15, oversize: true, lengthIn: 144, heightIn: 40, weightLb: 900, stackable: false, description: "Dining table crates, 12 ft", sequence: 1 }, "OS-01");
      storedPallet({ customer: c, shipment: sh, receivedAt: daysAgo(3), stay: 15, oversize: true, lengthIn: 120, heightIn: 36, weightLb: 700, stackable: false, description: "Bookshelf crates, 10 ft", sequence: 2 }, "OS-02");
    }

    // ---- Today's inbound
    // 1) Dorval Packaging: cross-dock, receiving right now at D1. 12 of 20 pallets staged, 8 still on the truck.
    const dpk = cust.get("DPK")!;
    const dpkSh = makeShipment({
      customerId: dpk.id, reference: "DPK-77120", containerNumber: "TCLU5520987", carrier: "Transport Bourassa", status: "RECEIVING",
      expectedAt: todayAt(8, 30), arrivedAt: todayAt(8, 42), dockDoor: "D1", expectedPallets: 20, expectedCartons: 800, expectedWeightLb: 14200,
      isCrossDock: true, expectedStayDays: 1, createdAt: daysAgo(1, 14),
    });
    log(dpkSh.createdAt, "SHIPMENT_ANNOUNCED", `Dorval Packaging DPK-77120 announced by email: 20 pallets, cross-dock`, "shipment", dpkSh.id, "system");
    log(todayAt(8, 42), "TRUCK_ARRIVED", `TCLU5520987 at door D1 (Dorval Packaging)`, "shipment", dpkSh.id, "Marie");
    for (let i = 1; i <= 20; i++) {
      if (i <= 12) {
        const col = 48 + Math.ceil(i / 2); // XD-49..XD-54, stacked 2
        const code = `XD-${col}`;
        const p = storedPallet({ customer: dpk, shipment: dpkSh, receivedAt: todayAt(8, 45 + i), stay: 1, cartons: 40, heightIn: between(50, 56), weightLb: between(500, 800), sequence: i, description: "Corrugated boxes" }, code, i % 2 === 1 ? 1 : 2);
        if (i <= 3) log(todayAt(8, 45 + i), "PALLET_STORED", `${p.code} → ${code} (cross-dock staging)`, "pallet", p.id, "Jean");
      } else {
        db.insert(s.pallets).values({ code: nextCode("DPK"), siteId: site.id, customerId: dpk.id, shipmentId: dpkSh.id, sequence: i, status: "EXPECTED", description: "Corrugated boxes", cartons: 40, cartonsRemaining: 40, expectedStayDays: 1, createdAt: daysAgo(1, 14) }).run();
      }
    }

    // 2) Mile End Apparel: scheduled 14:00 at D3, labels printed, all 16 expected.
    const mea = cust.get("MEA")!;
    const meaSh = makeShipment({
      customerId: mea.id, reference: "MEA-PO-5531", containerNumber: "CMAU3318870", carrier: "TFI Express", status: "SCHEDULED",
      expectedAt: todayAt(14, 0), dockDoor: "D3", expectedPallets: 16, expectedCartons: 640, expectedWeightLb: 9800, isCrossDock: true, expectedStayDays: 1, createdAt: daysAgo(1, 10),
    });
    for (let i = 1; i <= 16; i++) db.insert(s.pallets).values({ code: nextCode("MEA"), siteId: site.id, customerId: mea.id, shipmentId: meaSh.id, sequence: i, status: "EXPECTED", description: "T-shirt cartons", cartons: 40, cartonsRemaining: 40, expectedStayDays: 1, createdAt: daysAgo(1, 10) }).run();
    log(daysAgo(1, 10), "SHIPMENT_ANNOUNCED", `Mile End Apparel MEA-PO-5531 announced: 16 pallets, ETA today 14:00`, "shipment", meaSh.id, "system");
    log(daysAgo(1, 10), "LABELS_PRINTED", `16 labels printed for MEA-PO-5531`, "shipment", meaSh.id, "Marie");

    // 3) Brossard Medical: tomorrow, 8 pallets
    const bms = cust.get("BMS")!;
    const bmsSh = makeShipment({
      customerId: bms.id, reference: "BMS-2291", carrier: "Robert Transport", status: "ANNOUNCED", expectedAt: new Date(todayAt(10, 0).getTime() + DAY), dockDoor: null,
      expectedPallets: 8, expectedCartons: 320, expectedWeightLb: 4100, expectedStayDays: 5, createdAt: todayAt(7, 55),
    });
    for (let i = 1; i <= 8; i++) db.insert(s.pallets).values({ code: nextCode("BMS"), siteId: site.id, customerId: bms.id, shipmentId: bmsSh.id, sequence: i, status: "EXPECTED", description: "Exam gloves", cartons: 40, cartonsRemaining: 40, expectedStayDays: 5, createdAt: todayAt(7, 55) }).run();
    log(todayAt(7, 55), "SHIPMENT_ANNOUNCED", `Brossard Medical BMS-2291 announced: 8 pallets, tomorrow`, "shipment", bmsSh.id, "system");

    // 4) Lachine Textiles: tomorrow, loose cartons, no packing list yet
    const ltx = cust.get("LTX")!;
    const ltxSh = makeShipment({
      customerId: ltx.id, reference: "LTX-IMP-0928", containerNumber: "HLXU6120334", carrier: "Groupe Morneau", status: "ANNOUNCED", expectedAt: new Date(todayAt(9, 0).getTime() + DAY),
      expectedPallets: null, expectedCartons: null, expectedWeightLb: null, looseCartons: true, packingListReceived: false, expectedStayDays: 30, createdAt: todayAt(9, 12),
      notes: "Floor-loaded container. Cartons to be palletized on site. Packing list promised.",
    });
    log(todayAt(9, 12), "NEEDS_REVIEW", `Lachine Textiles LTX-IMP-0928: no pallet count or weight in the email, loose cartons`, "shipment", ltxSh.id, "system");

    // 5) Yesterday: Nordika 6 pallets in cross-dock staging, leaving today
    const nrd = cust.get("NRD")!;
    const nrdY = makeShipment({
      customerId: nrd.id, reference: "NRD-2026-0917", containerNumber: "OOLU7781120", carrier: "customer truck", status: "RECEIVED",
      expectedAt: daysAgo(1, 13), arrivedAt: daysAgo(1, 13), completedAt: daysAgo(1, 14), dockDoor: "D2", expectedPallets: 6, expectedCartons: 144, expectedWeightLb: 5400, isCrossDock: true, expectedStayDays: 1, createdAt: daysAgo(2, 16),
    });
    const nrdStaged: s.Pallet[] = [];
    for (let i = 1; i <= 6; i++) nrdStaged.push(storedPallet({ customer: nrd, shipment: nrdY, receivedAt: daysAgo(1, 13), stay: 1, cartons: 24, heightIn: between(48, 54), weightLb: between(800, 1100), sequence: i, description: "Ceramic tiles" }, `XD-${54 + Math.ceil(i / 2)}`, i % 2 === 1 ? 1 : 2));

    // ---- The demo email: Nordika's container for today (NEW, not yet parsed)
    const nrdEmailBody = `Hi Marie,

Container MSCU4471293 is arriving tomorrow ${new Date(now.getTime() + DAY).toLocaleDateString("en-CA", { month: "long", day: "numeric" })} around 10:00 at your dock, ref NRD-2026-0918, carrier Transport Bourassa.

14 pallets, 336 cartons total, approx 11,800 lbs. 12 pallets of ceramic tiles are going out the same day to our Laval store (same-day transfer). The other 2 pallets (porcelain sinks) stay with you about 30 days.

Packing list attached.

Thanks,
Sofia Lindqvist
Nordika Imports`;
    const nrdEmail = db.insert(s.inboundEmails).values({
      fromAddress: "sofia@nordika.ca", subject: "Inbound container MSCU4471293 – ref NRD-2026-0918", body: nrdEmailBody, receivedAt: todayAt(9, 41), kind: "INBOUND", status: "NEW", customerId: nrd.id, hasAttachment: true,
    }).returning().get();
    log(todayAt(9, 41), "EMAIL_RECEIVED", `New email from Nordika Imports: Inbound container MSCU4471293`, "email", nrdEmail.id, "system");

    // Other emails
    db.insert(s.inboundEmails).values([
      { fromAddress: "sylvie@dorvalpack.ca", subject: "Cross-dock tomorrow – TCLU5520987 – 20 skids", body: `Hello,\n\nTruck TCLU5520987 arrives tomorrow 8:30, 20 skids of corrugated boxes, 800 cartons, 14,200 lbs. Cross-dock: our driver picks everything up the same afternoon.\n\nRef DPK-77120.\n\nSylvie`, receivedAt: daysAgo(1, 14), kind: "INBOUND", status: "LINKED", customerId: dpk.id, shipmentId: dpkSh.id, hasAttachment: true },
      { fromAddress: "rachel@mileendapparel.com", subject: "PO 5531 arriving tomorrow 2pm", body: `Hi team,\n\nPO MEA-PO-5531, container CMAU3318870 via TFI Express, ETA tomorrow 2:00 pm. 16 pallets / 640 cartons / 9,800 lbs. Same day out to our DC please.\n\nRachel`, receivedAt: daysAgo(1, 10), kind: "INBOUND", status: "LINKED", customerId: mea.id, shipmentId: meaSh.id, hasAttachment: true },
      { fromAddress: "amir@lachinetextiles.com", subject: "Container HLXU6120334 – arriving tomorrow (floor loaded)", body: `Hello,\n\nContainer HLXU6120334 arrives tomorrow morning via Groupe Morneau. It is floor loaded (loose cartons, not on pallets) – please palletize. We will send the packing list later today. Goods stay about a month.\n\nAmir`, receivedAt: todayAt(9, 12), kind: "INBOUND", status: "NEEDS_REVIEW", customerId: ltx.id, shipmentId: ltxSh.id, hasAttachment: false },
      { fromAddress: "dispatch@fastfreightforwarding.com", subject: "FWD: delivery notice – 9 pallets Thursday", body: `Delivery notice: 9 pallets, 6,300 lbs, arriving Thursday for your customer. Please confirm receiving hours.\n\nFast Freight Forwarding`, receivedAt: todayAt(11, 5), kind: "INBOUND", status: "NEEDS_REVIEW", customerId: null, hasAttachment: false },
    ]).run();

    // ---- Outbound orders
    function order(v: Partial<typeof s.outboundOrders.$inferInsert> & { customerId: number; reference: string }) {
      const row = db.insert(s.outboundOrders).values({ siteId: site.id, ...v }).returning().get();
      return row;
    }
    const palletsOf = (code: string) => db.select().from(s.pallets).where(eqCustomer(cust.get(code)!.id)).all();
    // small helper without importing eq at top-level type juggling
    function eqCustomer(id: number) { return sqlEq(s.pallets.customerId, id); }

    // O1: Maple Crest, REQUESTED today: cartons from two front pallets + one whole pallet deep in lane 1 (dig-out demo)
    const mcf = cust.get("MCF")!;
    const mcfPallets = palletsOf("MCF").filter((p) => p.status === "STORED");
    const lane1 = mcfPallets.filter((p) => locById(p.locationId!).lane === 1).sort((a, b) => (locById(a.locationId!).depth ?? 0) - (locById(b.locationId!).depth ?? 0) || a.stackLevel - b.stackLevel);
    const front = lane1.slice(0, 2);
    const deep = lane1.find((p) => p.stackLevel === 1 && locById(p.locationId!).depth === 3) ?? [...lane1].reverse().find((p) => p.stackLevel === 1 && (locById(p.locationId!).depth ?? 0) >= 3) ?? lane1[lane1.length - 1];
    const o1 = order({ customerId: mcf.id, reference: "MCF-REL-3310", status: "REQUESTED", requestedAt: todayAt(10, 20), neededBy: todayAt(16, 0), carrier: "Purolator LTL", notes: "Customer email: 2 orders for Costco Laval + 1 full pallet for the Anjou store" });
    db.insert(s.outboundLines).values([
      { orderId: o1.id, palletId: front[0].id, cartons: 12 },
      { orderId: o1.id, palletId: front[1].id, cartons: 8 },
      { orderId: o1.id, palletId: deep.id, cartons: null },
    ]).run();
    db.update(s.pallets).set({ status: "ALLOCATED" }).where(sqlEq(s.pallets.id, deep.id)).run();
    db.insert(s.inboundEmails).values({ fromAddress: "julie@maplecrest.ca", subject: "Release request – 2 orders + 1 pallet for today", body: `Hi Marie,\n\nPlease prepare for pickup today before 4pm (Purolator LTL):\n- 12 cartons maple syrup 12×500ml (order 88213, Costco Laval)\n- 8 cartons maple butter (order 88214, Costco Laval)\n- 1 full pallet gift boxes for our Anjou store\n\nThanks!\nJulie`, receivedAt: todayAt(10, 18), kind: "OUTBOUND", status: "LINKED", customerId: mcf.id, orderId: o1.id }).run();
    log(todayAt(10, 20), "ORDER_REQUESTED", `Maple Crest Foods MCF-REL-3310: 20 cartons + 1 pallet, pickup by 16:00`, "order", o1.id, "system");

    // O2: Nordika, REQUESTED: 3 of the older lane-13 pallets (one is deep → blocked)
    const nrdRel = [nrdOld[0], nrdOld[2], nrdOld[nrdOld.length - 1]];
    const o2 = order({ customerId: nrd.id, reference: "NRD-REL-0924", status: "REQUESTED", requestedAt: todayAt(11, 2), neededBy: new Date(todayAt(9, 0).getTime() + DAY), carrier: "customer truck" });
    db.insert(s.outboundLines).values(nrdRel.map((p) => ({ orderId: o2.id, palletId: p.id, cartons: null }))).run();
    for (const p of nrdRel) db.update(s.pallets).set({ status: "ALLOCATED" }).where(sqlEq(s.pallets.id, p.id)).run();
    log(todayAt(11, 2), "ORDER_REQUESTED", `Nordika Imports NRD-REL-0924: 3 pallets, pickup tomorrow morning`, "order", o2.id, "system");

    // O3: Saint-Laurent Electronics, PICKING: 40 cartons from 2 pallets, one line picked
    const sle = cust.get("SLE")!;
    const slePallets = palletsOf("SLE").filter((p) => p.status === "STORED").sort((a, b) => (locById(a.locationId!).depth ?? 0) - (locById(b.locationId!).depth ?? 0) || b.stackLevel - a.stackLevel).slice(0, 2);
    const o3 = order({ customerId: sle.id, reference: "SLE-4471", status: "PICKING", requestedAt: daysAgo(0, 8), neededBy: todayAt(15, 0), carrier: "Dicom" });
    db.insert(s.outboundLines).values([
      { orderId: o3.id, palletId: slePallets[0].id, cartons: 24, status: "PICKED", pickedAt: todayAt(9, 58) },
      { orderId: o3.id, palletId: slePallets[1].id, cartons: 16 },
    ]).run();
    db.update(s.pallets).set({ cartonsRemaining: (slePallets[0].cartonsRemaining ?? 36) - 24 }).where(sqlEq(s.pallets.id, slePallets[0].id)).run();
    db.insert(s.movements).values({ palletId: slePallets[0].id, type: "PICK", fromLocationId: slePallets[0].locationId, toLocationId: slePallets[0].locationId, source: "SCAN", byUser: "Karim", at: todayAt(9, 58), reason: "24 cartons picked for SLE-4471" }).run();
    log(todayAt(9, 58), "PICKED", `24 cartons picked from ${slePallets[0].code} for SLE-4471`, "order", o3.id, "Karim");

    // O4: Boréal, PLANNED for tomorrow: 4 rack pallets
    const bor = cust.get("BOR")!;
    const borPallets = palletsOf("BOR").filter((p) => p.status === "STORED" && locById(p.locationId!).kind === "RACK").slice(0, 4);
    const o4 = order({ customerId: bor.id, reference: "BOR-OUT-1188", status: "PLANNED", requestedAt: daysAgo(1, 15), neededBy: new Date(todayAt(11, 0).getTime() + DAY), carrier: "Robert Transport", dockDoor: "D2" });
    db.insert(s.outboundLines).values(borPallets.map((p) => ({ orderId: o4.id, palletId: p.id, cartons: null }))).run();
    for (const p of borPallets) db.update(s.pallets).set({ status: "ALLOCATED" }).where(sqlEq(s.pallets.id, p.id)).run();

    // O5: Kaya shipped yesterday; O6: Dorval (yesterday's cross-dock) shipped yesterday — history for billing
    function shippedOrder(code: string, ago: number, n: number, cartonsEach: number | null, shippedAt?: Date) {
      const c = cust.get(code)!;
      const sh = histShipment(code, ago + 1, n, { status: "CLOSED" });
      const shipped = shippedAt ?? daysAgo(ago, 15);
      const o = order({ customerId: c.id, reference: `${code}-OUT-${between(100, 999)}`, status: "SHIPPED", requestedAt: daysAgo(ago, 8), neededBy: daysAgo(ago, 16), shippedAt: shipped, carrier: pick(["Purolator LTL", "Dicom", "customer truck"]) });
      for (let i = 1; i <= n; i++) {
        const p = db.insert(s.pallets).values({
          code: nextCode(code), siteId: site.id, customerId: c.id, shipmentId: sh.id, sequence: i, status: "SHIPPED", description: pick(seedOf(code).goods),
          cartons: 40, cartonsRemaining: cartonsEach ? 40 - cartonsEach : 0, lengthIn: 48, widthIn: 40, heightIn: between(48, 60), weightLb: between(500, 1400),
          expectedStayDays: seedOf(code).avgStay, receivedAt: daysAgo(ago + 1, 9), storedAt: daysAgo(ago + 1, 10), shippedAt: shipped, createdAt: daysAgo(ago + 2),
        }).returning().get();
        db.insert(s.outboundLines).values({ orderId: o.id, palletId: p.id, cartons: cartonsEach, status: "SHIPPED", pickedAt: daysAgo(ago, 14) }).run();
        db.insert(s.movements).values([
          { palletId: p.id, type: "RECEIVE", source: "SCAN", byUser: "Jean", at: daysAgo(ago + 1, 9) },
          { palletId: p.id, type: "SHIP", source: "SCAN", byUser: "Karim", at: shipped, reason: `Shipped on ${o.reference}` },
        ]).run();
      }
      log(shipped, "ORDER_SHIPPED", `${c.name} ${o.reference} shipped: ${n} pallets`, "order", o.id, "Karim");
    }
    shippedOrder("KYA", 1, 3, 30);
    shippedOrder("DPK", 1, 18, null, new Date(now.getTime() - 2 * 3600000));
    shippedOrder("LST", 0, 4, null, new Date(now.getTime() - 40 * 60000));
    shippedOrder("MEA", 2, 14, null);
    shippedOrder("NRD", 3, 10, null);
    shippedOrder("VCR", 2, 2, 12);
    shippedOrder("MCF", 4, 4, 20);
    shippedOrder("BMS", 6, 8, null);
    shippedOrder("LST", 5, 6, null);

    // ---- A few pallets whose spot was never confirmed (camera/scan missed)
    const unconfirmed = db.select().from(s.pallets).where(sqlEq(s.pallets.status, "STORED")).limit(400).all().filter((p) => p.customerId === cust.get("TRF")!.id).slice(0, 3);
    for (const p of unconfirmed) db.update(s.pallets).set({ locationConfirmedBy: null, locationConfirmedAt: null }).where(sqlEq(s.pallets.id, p.id)).run();

    // ---- Events
    log(todayAt(7, 30), "SHIFT_START", "Day shift started: Jean, Karim on forklifts; Marie in the office", undefined, undefined, "system");
    log(todayAt(10, 5), "RELOCATE", `${nrdStaged[0].code} moved XD-55 → XD-58 to clear door D2 lane`, "pallet", nrdStaged[0].id, "Jean");
    events.sort((a, b) => (a.at as Date).getTime() - (b.at as Date).getTime());
    db.insert(s.events).values(events).run();

    function locById(id: number) {
      for (const l of locByCode.values()) if (l.id === id) return l;
      throw new Error("no loc " + id);
    }
  });
}
