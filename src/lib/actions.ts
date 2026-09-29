"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { seed } from "@/db/seed";
import { parseEmail } from "./emailParser";
import { estimateStayDays } from "./slotting";

const USER = "Marie"; // demo: no login yet

function logEvent(kind: string, message: string, entityType?: string, entityId?: number, byUser = USER) {
  db.insert(s.events).values({ kind, message, entityType, entityId, byUser }).run();
}

function num(v: FormDataEntryValue | null, fallback: number | null = null) {
  if (v == null || v === "") return fallback;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? fallback : n;
}
const str = (v: FormDataEntryValue | null) => (v == null ? null : String(v).trim() || null);
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true" || v === "1";

async function nextPalletCode(customerCode: string) {
  const row = db.get<{ n: number }>(sql`select count(*) as n from pallets p join customers c on c.id = p.customer_id where c.code = ${customerCode}`);
  return `PLT-${customerCode}-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
}

// ---------- Email ingestion ----------

export async function ingestEmail(formData: FormData) {
  const from = str(formData.get("from")) ?? "unknown@example.com";
  const subject = str(formData.get("subject")) ?? "(no subject)";
  const body = str(formData.get("body")) ?? "";
  const customers = await db.query.customers.findMany();
  const parsed = await parseEmail(from, subject, body, customers);
  const row = db
    .insert(s.inboundEmails)
    .values({ fromAddress: from, subject, body, kind: parsed.kind, status: parsed.missing.filter((m) => m !== "dimensions").length ? "NEEDS_REVIEW" : "PARSED", parsedJson: JSON.stringify(parsed), customerId: parsed.customerId })
    .returning()
    .get();
  logEvent("EMAIL_RECEIVED", `Email from ${parsed.customerName ?? from}: ${subject}`, "email", row.id, "system");
  redirect(`/inbox/${row.id}`);
}

export async function reparseEmail(formData: FormData) {
  const id = num(formData.get("id"))!;
  const email = await db.query.inboundEmails.findFirst({ where: eq(s.inboundEmails.id, id) });
  if (!email) redirect("/inbox");
  const customers = await db.query.customers.findMany();
  const parsed = await parseEmail(email.fromAddress, email.subject, email.body, customers);
  db.update(s.inboundEmails)
    .set({ kind: parsed.kind, parsedJson: JSON.stringify(parsed), customerId: parsed.customerId, status: email.status === "LINKED" ? "LINKED" : parsed.missing.filter((m) => m !== "dimensions").length ? "NEEDS_REVIEW" : "PARSED" })
    .where(eq(s.inboundEmails.id, id))
    .run();
  logEvent("EMAIL_PARSED", `Read email "${email.subject}" (${parsed.method}): ${parsed.kind.toLowerCase()}${parsed.customerName ? ", " + parsed.customerName : ""}${parsed.missing.length ? " — missing " + parsed.missing.join(", ") : ""}`, "email", id, "system");
  revalidatePath(`/inbox/${id}`);
  redirect(`/inbox/${id}`);
}

export async function createShipmentFromEmail(formData: FormData) {
  const emailId = num(formData.get("emailId"));
  const customerId = num(formData.get("customerId"));
  if (!customerId) redirect(emailId ? `/inbox/${emailId}?error=customer` : "/inbound/new");
  const customer = (await db.query.customers.findFirst({ where: eq(s.customers.id, customerId) }))!;
  const site = (await db.query.sites.findFirst())!;
  const expectedPallets = num(formData.get("expectedPallets"));
  const expectedAtStr = str(formData.get("expectedAt"));
  const expectedTime = str(formData.get("expectedTime")) ?? "09:00";
  const expectedAt = expectedAtStr ? new Date(`${expectedAtStr}T${expectedTime}:00`) : null;
  const isCrossDock = bool(formData.get("isCrossDock"));
  const stay = num(formData.get("expectedStayDays"));
  const bonded = bool(formData.get("bonded"));
  const shipment = db
    .insert(s.shipments)
    .values({
      siteId: site.id,
      customerId,
      reference: str(formData.get("reference")) ?? `${customer.code}-${Date.now().toString().slice(-5)}`,
      containerNumber: str(formData.get("containerNumber")),
      carrier: str(formData.get("carrier")),
      status: "ANNOUNCED",
      expectedAt,
      dockDoor: str(formData.get("dockDoor")),
      expectedPallets,
      expectedCartons: num(formData.get("expectedCartons")),
      expectedWeightLb: num(formData.get("expectedWeightLb")),
      looseCartons: bool(formData.get("looseCartons")),
      isCrossDock,
      expectedStayDays: isCrossDock ? 1 : stay ?? Math.round(customer.avgStayDays),
      bonded,
      cargoControlNumber: str(formData.get("cargoControlNumber")),
      transactionNumber: str(formData.get("transactionNumber")),
      packingListReceived: bool(formData.get("packingListReceived")),
      notes: str(formData.get("notes")),
      sourceEmailId: emailId,
    })
    .returning()
    .get();
  // One expected pallet per announced pallet, so labels can be printed before the truck arrives.
  const n = expectedPallets ?? 0;
  const perPallet = shipment.expectedCartons && n ? Math.round(shipment.expectedCartons / n) : null;
  const base = await nextPalletCode(customer.code);
  const baseNum = Number(base.slice(-5));
  const rows = [];
  for (let i = 1; i <= n; i++) {
    rows.push({
      code: `PLT-${customer.code}-${String(baseNum + i - 1).padStart(5, "0")}`,
      siteId: site.id, customerId, shipmentId: shipment.id, sequence: i, status: "EXPECTED" as const,
      description: str(formData.get("description")), cartons: perPallet, cartonsRemaining: perPallet,
      expectedStayDays: shipment.expectedStayDays, bonded, cargoControlNumber: shipment.cargoControlNumber, transactionNumber: shipment.transactionNumber,
    });
  }
  if (rows.length) db.insert(s.pallets).values(rows).run();
  if (emailId) db.update(s.inboundEmails).set({ status: "LINKED", shipmentId: shipment.id, customerId }).where(eq(s.inboundEmails.id, emailId)).run();
  logEvent("SHIPMENT_ANNOUNCED", `${customer.name} ${shipment.reference} announced: ${n || "?"} pallets${expectedAt ? ", ETA " + expectedAt.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}${isCrossDock ? ", cross-dock" : ""}`, "shipment", shipment.id);
  revalidatePath("/inbound");
  redirect(`/inbound/${shipment.id}`);
}

export async function markEmail(formData: FormData) {
  const id = num(formData.get("id"))!;
  const status = str(formData.get("status")) as "IGNORED" | "NEW";
  db.update(s.inboundEmails).set({ status }).where(eq(s.inboundEmails.id, id)).run();
  revalidatePath("/inbox");
  redirect("/inbox");
}

// ---------- Inbound ----------

export async function updateShipmentStatus(formData: FormData) {
  const id = num(formData.get("id"))!;
  const status = str(formData.get("status")) as s.ShipmentStatus;
  const door = str(formData.get("dockDoor"));
  const patch: Partial<typeof s.shipments.$inferInsert> = { status };
  if (door) patch.dockDoor = door;
  if (status === "ARRIVED") patch.arrivedAt = new Date();
  if (status === "RECEIVED" || status === "CLOSED") patch.completedAt = new Date();
  db.update(s.shipments).set(patch).where(eq(s.shipments.id, id)).run();
  const sh = (await db.query.shipments.findFirst({ where: eq(s.shipments.id, id), with: { customer: true } }))!;
  logEvent(status === "ARRIVED" ? "TRUCK_ARRIVED" : "SHIPMENT_STATUS", `${sh.customer.name} ${sh.reference}: ${status.toLowerCase()}${door ? " at door " + door : ""}`, "shipment", id);
  revalidatePath(`/inbound/${id}`);
  revalidatePath("/");
  redirect(`/inbound/${id}`);
}

export async function labelsPrinted(formData: FormData) {
  const id = num(formData.get("id"))!;
  const sh = (await db.query.shipments.findFirst({ where: eq(s.shipments.id, id), with: { customer: true, pallets: true } }))!;
  logEvent("LABELS_PRINTED", `${sh.pallets.length} labels printed for ${sh.customer.name} ${sh.reference}`, "shipment", id);
  revalidatePath(`/inbound/${id}`);
}

export async function addExpectedPallets(formData: FormData) {
  const id = num(formData.get("id"))!;
  const n = num(formData.get("count"), 1)!;
  const sh = (await db.query.shipments.findFirst({ where: eq(s.shipments.id, id), with: { customer: true, pallets: true } }))!;
  const base = await nextPalletCode(sh.customer.code);
  const baseNum = Number(base.slice(-5));
  const start = sh.pallets.length;
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({ code: `PLT-${sh.customer.code}-${String(baseNum + i).padStart(5, "0")}`, siteId: sh.siteId, customerId: sh.customerId, shipmentId: sh.id, sequence: start + i + 1, status: "EXPECTED" as const, expectedStayDays: sh.expectedStayDays, bonded: sh.bonded, cargoControlNumber: sh.cargoControlNumber, transactionNumber: sh.transactionNumber });
  }
  db.insert(s.pallets).values(rows).run();
  db.update(s.shipments).set({ expectedPallets: start + n }).where(eq(s.shipments.id, id)).run();
  logEvent("PALLETS_ADDED", `${n} pallet labels added to ${sh.customer.name} ${sh.reference} (palletized on site)`, "shipment", id);
  revalidatePath(`/inbound/${id}`);
  redirect(`/inbound/${id}`);
}

// ---------- Dock receiving ----------

export async function lookupPallet(formData: FormData) {
  const code = str(formData.get("code"))?.toUpperCase();
  if (!code) redirect("/dock");
  const p = await db.query.pallets.findFirst({ where: eq(s.pallets.code, code) });
  if (!p) redirect(`/dock?notfound=${encodeURIComponent(code)}`);
  redirect(`/dock/${p.id}`);
}

export async function receivePallet(formData: FormData) {
  const id = num(formData.get("id"))!;
  const p = (await db.query.pallets.findFirst({ where: eq(s.pallets.id, id), with: { customer: true, shipment: true } }))!;
  const heightIn = num(formData.get("heightIn"), 55)!;
  const weightLb = num(formData.get("weightLb"), 800)!;
  const lengthIn = num(formData.get("lengthIn"), 48)!;
  const stackable = bool(formData.get("stackable"));
  const stay = num(formData.get("expectedStayDays"));
  const damage = str(formData.get("damageNotes"));
  const cartons = num(formData.get("cartons"), p.cartons);
  const expectedStayDays = stay ?? (p.shipment?.isCrossDock ? 1 : estimateStayDays(p.customer, p.shipment?.expectedStayDays));
  db.update(s.pallets)
    .set({
      status: "RECEIVED", receivedAt: p.receivedAt ?? new Date(), heightIn, weightLb, lengthIn, widthIn: 40, stackable, cartons, cartonsRemaining: cartons,
      oversize: lengthIn > 60, expectedStayDays, damageNotes: damage, description: str(formData.get("description")) ?? p.description,
    })
    .where(eq(s.pallets.id, id))
    .run();
  const door = p.shipment?.dockDoor ? await db.query.locations.findFirst({ where: eq(s.locations.code, p.shipment.dockDoor) }) : null;
  db.insert(s.movements).values({ palletId: id, type: "RECEIVE", toLocationId: door?.id ?? null, source: "SCAN", byUser: "Jean", reason: damage ? `Received with damage: ${damage}` : "Scanned at dock" }).run();
  if (p.shipment && p.shipment.status !== "RECEIVING" && p.shipment.status !== "RECEIVED") {
    db.update(s.shipments).set({ status: "RECEIVING", arrivedAt: p.shipment.arrivedAt ?? new Date() }).where(eq(s.shipments.id, p.shipment.id)).run();
  }
  logEvent("PALLET_RECEIVED", `${p.code} received at door ${p.shipment?.dockDoor ?? "?"}: ${heightIn}", ${weightLb} lb${damage ? ", damage noted" : ""}`, "pallet", id, "Jean");
  redirect(`/dock/${id}/slot`);
}

export async function putawayPallet(formData: FormData) {
  const id = num(formData.get("id"))!;
  const locationId = num(formData.get("locationId"))!;
  const stackLevel = num(formData.get("stackLevel"), 1)!;
  const source = (str(formData.get("source")) ?? "SCAN") as s.ConfirmSource;
  const p = (await db.query.pallets.findFirst({ where: eq(s.pallets.id, id), with: { customer: true, shipment: true, location: true } }))!;
  const loc = (await db.query.locations.findFirst({ where: eq(s.locations.id, locationId) }))!;
  const now = new Date();
  db.update(s.pallets)
    .set({ status: "STORED", locationId, stackLevel, storedAt: now, locationConfirmedBy: source === "SYSTEM" ? null : source, locationConfirmedAt: source === "SYSTEM" ? null : now })
    .where(eq(s.pallets.id, id))
    .run();
  db.insert(s.movements).values({ palletId: id, type: p.location ? "RELOCATE" : "PUTAWAY", fromLocationId: p.locationId, toLocationId: locationId, source, byUser: "Jean", reason: str(formData.get("reason")) ?? "Assigned by system" }).run();
  logEvent("PALLET_STORED", `${p.code} → ${loc.code}${stackLevel > 1 ? " (on top)" : ""} · ${p.customer.name}`, "pallet", id, "Jean");
  // Close the shipment when every pallet is put away
  if (p.shipmentId) {
    const open = db.get<{ n: number }>(sql`select count(*) as n from pallets where shipment_id = ${p.shipmentId} and status in ('EXPECTED','RECEIVED')`);
    if (open && open.n === 0) {
      db.update(s.shipments).set({ status: "RECEIVED", completedAt: now }).where(eq(s.shipments.id, p.shipmentId)).run();
      logEvent("SHIPMENT_RECEIVED", `${p.customer.name} ${p.shipment?.reference} fully received`, "shipment", p.shipmentId);
    }
  }
  revalidatePath("/");
  revalidatePath("/map");
  redirect(`/dock?done=${encodeURIComponent(p.code)}&loc=${encodeURIComponent(loc.code)}`);
}

export async function confirmLocation(formData: FormData) {
  const id = num(formData.get("id"))!;
  const source = (str(formData.get("source")) ?? "SCAN") as s.ConfirmSource;
  db.update(s.pallets).set({ locationConfirmedBy: source, locationConfirmedAt: new Date() }).where(eq(s.pallets.id, id)).run();
  db.insert(s.movements).values({ palletId: id, type: "CONFIRM", source, byUser: source === "CAMERA" ? "camera" : "Jean", reason: "Location confirmed" }).run();
  const back = str(formData.get("back")) ?? `/pallets/${id}`;
  revalidatePath(back);
  redirect(back);
}

// ---------- Outbound ----------

export async function createOrder(formData: FormData) {
  const customerId = num(formData.get("customerId"))!;
  const site = (await db.query.sites.findFirst())!;
  const customer = (await db.query.customers.findFirst({ where: eq(s.customers.id, customerId) }))!;
  const neededByStr = str(formData.get("neededBy"));
  const palletIds = formData.getAll("palletId").map(Number).filter(Boolean);
  const emailId = num(formData.get("emailId"));
  if (!palletIds.length) redirect(`/outbound/new?customer=${customerId}&error=nolines`);
  const order = db
    .insert(s.outboundOrders)
    .values({ siteId: site.id, customerId, reference: str(formData.get("reference")) ?? `${customer.code}-REL-${Date.now().toString().slice(-4)}`, status: "REQUESTED", neededBy: neededByStr ? new Date(neededByStr + "T16:00:00") : null, carrier: str(formData.get("carrier")), notes: str(formData.get("notes")), sourceEmailId: emailId })
    .returning()
    .get();
  const lines = palletIds.map((pid) => {
    const c = num(formData.get(`cartons_${pid}`));
    return { orderId: order.id, palletId: pid, cartons: c && c > 0 ? c : null };
  });
  db.insert(s.outboundLines).values(lines).run();
  const whole = lines.filter((l) => l.cartons == null).map((l) => l.palletId);
  if (whole.length) db.update(s.pallets).set({ status: "ALLOCATED" }).where(inArray(s.pallets.id, whole)).run();
  if (emailId) db.update(s.inboundEmails).set({ status: "LINKED", orderId: order.id, customerId }).where(eq(s.inboundEmails.id, emailId)).run();
  const cartons = lines.reduce((n, l) => n + (l.cartons ?? 0), 0);
  logEvent("ORDER_REQUESTED", `${customer.name} ${order.reference}: ${whole.length ? whole.length + " pallets" : ""}${whole.length && cartons ? " + " : ""}${cartons ? cartons + " cartons" : ""}`, "order", order.id);
  revalidatePath("/outbound");
  redirect(`/outbound/${order.id}`);
}

export async function setOrderStatus(formData: FormData) {
  const id = num(formData.get("id"))!;
  const status = str(formData.get("status")) as s.OrderStatus;
  const o = (await db.query.outboundOrders.findFirst({ where: eq(s.outboundOrders.id, id), with: { customer: true, lines: { with: { pallet: true } } } }))!;
  const patch: Partial<typeof s.outboundOrders.$inferInsert> = { status };
  if (str(formData.get("dockDoor"))) patch.dockDoor = str(formData.get("dockDoor"));
  if (status === "SHIPPED") {
    patch.shippedAt = new Date();
    for (const ln of o.lines) {
      db.update(s.outboundLines).set({ status: "SHIPPED", pickedAt: ln.pickedAt ?? new Date() }).where(eq(s.outboundLines.id, ln.id)).run();
      if (ln.cartons == null) {
        db.update(s.pallets).set({ status: "SHIPPED", shippedAt: new Date(), locationId: null, stackLevel: 1 }).where(eq(s.pallets.id, ln.palletId)).run();
        db.insert(s.movements).values({ palletId: ln.palletId, type: "SHIP", fromLocationId: ln.pallet.locationId, source: "SCAN", byUser: "Karim", reason: `Shipped on ${o.reference}` }).run();
      } else if (ln.status === "PENDING") {
        db.update(s.pallets).set({ cartonsRemaining: Math.max(0, (ln.pallet.cartonsRemaining ?? 0) - ln.cartons), status: "STORED" }).where(eq(s.pallets.id, ln.palletId)).run();
      }
    }
  }
  if (status === "CANCELLED") {
    const whole = o.lines.filter((l) => l.cartons == null).map((l) => l.palletId);
    if (whole.length) db.update(s.pallets).set({ status: "STORED" }).where(inArray(s.pallets.id, whole)).run();
  }
  db.update(s.outboundOrders).set(patch).where(eq(s.outboundOrders.id, id)).run();
  logEvent(status === "SHIPPED" ? "ORDER_SHIPPED" : "ORDER_STATUS", `${o.customer.name} ${o.reference}: ${status.toLowerCase()}`, "order", id, status === "SHIPPED" ? "Karim" : USER);
  revalidatePath(`/outbound/${id}`);
  revalidatePath("/");
  redirect(`/outbound/${id}`);
}

export async function pickLine(formData: FormData) {
  const lineId = num(formData.get("lineId"))!;
  const ln = (await db.query.outboundLines.findFirst({ where: eq(s.outboundLines.id, lineId), with: { pallet: true, order: true } }))!;
  db.update(s.outboundLines).set({ status: "PICKED", pickedAt: new Date() }).where(eq(s.outboundLines.id, lineId)).run();
  if (ln.cartons == null) {
    db.update(s.pallets).set({ status: "PICKED" }).where(eq(s.pallets.id, ln.palletId)).run();
    db.insert(s.movements).values({ palletId: ln.palletId, type: "PICK", fromLocationId: ln.pallet.locationId, source: "SCAN", byUser: "Karim", reason: `Picked whole for ${ln.order.reference}` }).run();
  } else {
    db.update(s.pallets).set({ cartonsRemaining: Math.max(0, (ln.pallet.cartonsRemaining ?? 0) - ln.cartons) }).where(eq(s.pallets.id, ln.palletId)).run();
    db.insert(s.movements).values({ palletId: ln.palletId, type: "PICK", fromLocationId: ln.pallet.locationId, toLocationId: ln.pallet.locationId, source: "SCAN", byUser: "Karim", reason: `${ln.cartons} cartons picked for ${ln.order.reference}` }).run();
  }
  if (ln.order.status !== "PICKING") db.update(s.outboundOrders).set({ status: "PICKING" }).where(eq(s.outboundOrders.id, ln.orderId)).run();
  logEvent("PICKED", `${ln.cartons == null ? "Pallet" : ln.cartons + " cartons from"} ${ln.pallet.code} picked for ${ln.order.reference}`, "order", ln.orderId, "Karim");
  revalidatePath(`/outbound/${ln.orderId}`);
  redirect(`/outbound/${ln.orderId}`);
}

export async function movePallet(formData: FormData) {
  // Temporary move while digging out a blocked pallet (or any relocation).
  const id = num(formData.get("id"))!;
  const locationId = num(formData.get("locationId"))!;
  const stackLevel = num(formData.get("stackLevel"), 1)!;
  const back = str(formData.get("back")) ?? `/pallets/${id}`;
  const p = (await db.query.pallets.findFirst({ where: eq(s.pallets.id, id) }))!;
  const loc = (await db.query.locations.findFirst({ where: eq(s.locations.id, locationId) }))!;
  db.update(s.pallets).set({ locationId, stackLevel, locationConfirmedBy: "SCAN", locationConfirmedAt: new Date() }).where(eq(s.pallets.id, id)).run();
  db.insert(s.movements).values({ palletId: id, type: "RELOCATE", fromLocationId: p.locationId, toLocationId: locationId, source: "SCAN", byUser: "Karim", reason: str(formData.get("reason")) ?? "Moved" }).run();
  logEvent("RELOCATE", `${p.code} moved to ${loc.code}${stackLevel > 1 ? " (on top)" : ""}`, "pallet", id, "Karim");
  revalidatePath(back);
  redirect(back);
}

// ---------- Demo ----------

export async function resetDemo() {
  db.transaction((tx) => {
    for (const t of ["events", "movements", "outbound_lines", "outbound_orders", "inbound_emails", "pallets", "shipment_lines", "shipments", "users", "customers", "locations", "zones", "sites"]) {
      tx.run(sql.raw(`delete from ${t}`));
      tx.run(sql.raw(`delete from sqlite_sequence where name = '${t}'`));
    }
  });
  seed(db);
  revalidatePath("/");
  redirect("/?reset=1");
}
