import type { Customer } from "@/db/schema";
import type { PalletFull } from "@/lib/queries";
import { createOrder } from "@/lib/actions";
import { Button, Field, inputCls, Badge } from "@/components/ui";
import { daysBetween } from "@/lib/format";

export function OrderForm({ customers, customer, pallets, preselected = [], cartonsRequested, neededBy, reference, emailId }: {
  customers: Customer[]; customer: Customer | null; pallets: PalletFull[]; preselected?: string[]; cartonsRequested?: number | null; neededBy?: string | null; reference?: string | null; emailId?: number;
}) {
  const pre = new Set(preselected);
  return (
    <form action={createOrder} className="space-y-4">
      {emailId && <input type="hidden" name="emailId" value={emailId} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Customer">
          {customer ? (
            <>
              <input type="hidden" name="customerId" value={customer.id} />
              <div className={`${inputCls} bg-slate-50`}>{customer.name}</div>
            </>
          ) : (
            <select name="customerId" className={inputCls} required defaultValue="">
              <option value="">Choose…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Reference"><input name="reference" defaultValue={reference ?? ""} className={inputCls} placeholder="Customer's order number" /></Field>
        <Field label="Pickup by"><input type="date" name="neededBy" defaultValue={neededBy ?? ""} className={inputCls} /></Field>
        <Field label="Carrier"><input name="carrier" className={inputCls} placeholder="Purolator LTL, customer truck…" /></Field>
        <Field label="Notes" ><input name="notes" className={inputCls} /></Field>
      </div>
      {customer ? (
        <div className="rounded-lg ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            <span>{customer.name}&apos;s pallets in stock ({pallets.length}). Tick whole pallets, or type a carton count to pick part of one.</span>
            {cartonsRequested ? <Badge tone="amber">email asks for {cartonsRequested} cartons</Badge> : null}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {pallets.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2"><input type="checkbox" name="palletId" value={p.id} defaultChecked={pre.has(p.code)} /></td>
                    <td className="px-2 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-2 py-2">{p.description}</td>
                    <td className="px-2 py-2 text-slate-500">{p.location?.code} · {daysBetween(p.receivedAt)} d in</td>
                    <td className="px-2 py-2 text-slate-500">{p.cartonsRemaining ?? p.cartons ?? "?"} ctn</td>
                    <td className="px-2 py-2"><input type="number" name={`cartons_${p.id}`} min={0} max={p.cartonsRemaining ?? undefined} placeholder="whole" className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs" /></td>
                  </tr>
                ))}
                {pallets.length === 0 && <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={6}>Nothing in stock for this customer.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Pick a customer first to list their pallets.</p>
      )}
      <div className="flex justify-end"><Button disabled={!customer}>Create release and pick list</Button></div>
    </form>
  );
}
