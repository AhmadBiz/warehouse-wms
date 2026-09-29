// Billing rules from the client's answers:
//  - Storage is counted from the day the shipment is received.
//  - Charged per pallet per week, or per pallet per month (any part of a period counts).
//  - Carton customers are billed per order, plus a per-carton pick fee.
//  - Handling in and out is per pallet.

import type { Customer, Pallet, OutboundOrder, OutboundLine } from "@/db/schema";

const DAY = 86_400_000;

export type BillingLine = { label: string; qty: number; unitCents: number; totalCents: number };
export type BillingEstimate = { lines: BillingLine[]; totalCents: number; periodLabel: string; storageDays: number };

export function periodsStarted(days: number, periodDays: number) {
  return Math.max(1, Math.ceil(days / periodDays));
}

export function estimateBilling(
  customer: Customer,
  pallets: Pallet[],
  orders: Array<OutboundOrder & { lines: OutboundLine[] }>,
  from: Date,
  to: Date
): BillingEstimate {
  const lines: BillingLine[] = [];
  let storageDays = 0;
  let palletPeriods = 0;
  let handledIn = 0;
  let handledOut = 0;

  for (const p of pallets) {
    if (!p.receivedAt) continue;
    const start = Math.max(p.receivedAt.getTime(), from.getTime());
    const end = Math.min(p.shippedAt ? p.shippedAt.getTime() : to.getTime(), to.getTime());
    if (end <= start && !(p.receivedAt >= from && p.receivedAt < to)) continue;
    const days = Math.max(1, Math.ceil((end - start) / DAY));
    storageDays += days;
    if (customer.billingModel === "PALLET_WEEK") palletPeriods += periodsStarted(days, 7);
    else palletPeriods += periodsStarted(days, 30);
    if (p.receivedAt >= from && p.receivedAt < to) handledIn++;
    if (p.shippedAt && p.shippedAt >= from && p.shippedAt < to) handledOut++;
  }

  const periodName = customer.billingModel === "PALLET_WEEK" ? "pallet-week" : "pallet-month";
  if (palletPeriods) lines.push({ label: `Storage (${periodName}s)`, qty: palletPeriods, unitCents: customer.storageRateCents, totalCents: palletPeriods * customer.storageRateCents });
  if (handledIn) lines.push({ label: "Handling in (pallets)", qty: handledIn, unitCents: customer.handlingInCents, totalCents: handledIn * customer.handlingInCents });
  if (handledOut) lines.push({ label: "Handling out (pallets)", qty: handledOut, unitCents: customer.handlingOutCents, totalCents: handledOut * customer.handlingOutCents });

  if (customer.billingModel === "CARTON_ORDER") {
    const shipped = orders.filter((o) => o.shippedAt && o.shippedAt >= from && o.shippedAt < to);
    const cartons = shipped.reduce((s, o) => s + o.lines.reduce((t, l) => t + (l.cartons ?? 0), 0), 0);
    if (shipped.length) lines.push({ label: "Orders", qty: shipped.length, unitCents: customer.orderFeeCents, totalCents: shipped.length * customer.orderFeeCents });
    if (cartons) lines.push({ label: "Cartons picked", qty: cartons, unitCents: customer.cartonPickCents, totalCents: cartons * customer.cartonPickCents });
  }

  const totalCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const periodLabel = `${from.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${to.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`;
  return { lines, totalCents, periodLabel, storageDays };
}

export function billingModelLabel(m: Customer["billingModel"]) {
  switch (m) {
    case "PALLET_WEEK": return "Per pallet / week";
    case "PALLET_MONTH": return "Per pallet / month";
    case "CARTON_ORDER": return "Per order + per carton";
  }
}
