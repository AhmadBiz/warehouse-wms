import type { Customer } from "@/db/schema";
import type { ParsedEmail } from "@/lib/emailParser";
import { createShipmentFromEmail } from "@/lib/actions";
import { Button, Field, inputCls } from "@/components/ui";
import { DOOR_CODES } from "@/db/layout";

export function ShipmentForm({ customers, parsed, emailId }: { customers: Customer[]; parsed?: Partial<ParsedEmail> | null; emailId?: number }) {
  const p = parsed ?? {};
  const missing = new Set(p.missing ?? []);
  const mark = (k: string) => (missing.has(k) ? "ring-2 ring-amber-300" : "");
  return (
    <form action={createShipmentFromEmail} className="space-y-4">
      {emailId && <input type="hidden" name="emailId" value={emailId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer">
          <select name="customerId" defaultValue={p.customerId ?? ""} className={`${inputCls} ${mark("customer")}`} required>
            <option value="">Choose…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </Field>
        <Field label="Reference / PO"><input name="reference" defaultValue={p.reference ?? ""} className={`${inputCls} ${mark("reference")}`} placeholder="NRD-2026-0918" /></Field>
        <Field label="Container number"><input name="containerNumber" defaultValue={p.containerNumber ?? ""} className={inputCls} placeholder="MSCU4471293" /></Field>
        <Field label="Carrier"><input name="carrier" defaultValue={p.carrier ?? ""} className={inputCls} /></Field>
        <Field label="Arrival date"><input type="date" name="expectedAt" defaultValue={p.expectedAt ?? ""} className={`${inputCls} ${mark("arrival date")}`} /></Field>
        <Field label="Arrival time"><input type="time" name="expectedTime" defaultValue="09:00" className={inputCls} /></Field>
        <Field label="Dock door">
          <select name="dockDoor" className={inputCls} defaultValue="">
            <option value="">Assign later</option>
            {DOOR_CODES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Pallets announced" hint="One QR label is printed per pallet."><input type="number" name="expectedPallets" min={0} defaultValue={p.pallets ?? ""} className={`${inputCls} ${mark("pallet count")}`} /></Field>
        <Field label="Cartons"><input type="number" name="expectedCartons" min={0} defaultValue={p.cartons ?? ""} className={inputCls} /></Field>
        <Field label="Weight (lb)"><input type="number" name="expectedWeightLb" min={0} defaultValue={p.weightLb ?? ""} className={`${inputCls} ${mark("weight")}`} /></Field>
        <Field label="Expected stay (days)" hint="Customer estimates are rarely right; the system blends this with the customer's history."><input type="number" name="expectedStayDays" min={1} defaultValue={p.expectedStayDays ?? ""} className={inputCls} /></Field>
        <Field label="Contents"><input name="description" className={inputCls} placeholder="Ceramic tiles" /></Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isCrossDock" defaultChecked={!!p.isCrossDock} /> Cross-dock (leaves the same day)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="looseCartons" defaultChecked={!!p.looseCartons} /> Loose cartons, palletize on site</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="packingListReceived" defaultChecked={p.pallets != null} /> Packing list received</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="bonded" defaultChecked={!!p.bonded} /> In bond (customs)</label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cargo control number (CCN)"><input name="cargoControlNumber" defaultValue={p.cargoControlNumber ?? ""} className={inputCls} placeholder="Only for bonded goods" /></Field>
        <Field label="Transaction number"><input name="transactionNumber" defaultValue={p.transactionNumber ?? ""} className={inputCls} /></Field>
      </div>
      <Field label="Notes"><textarea name="notes" rows={2} className={inputCls} /></Field>
      <div className="flex justify-end"><Button>Create shipment and labels</Button></div>
    </form>
  );
}
