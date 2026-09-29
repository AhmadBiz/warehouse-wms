import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { receivePallet } from "@/lib/actions";
import { estimateStayDays } from "@/lib/slotting";
import { PageHeader, Card, Button, Badge, inputLg, Field, Alert } from "@/components/ui";

export default async function ReceivePage(props: PageProps<"/dock/[id]">) {
  const { id } = await props.params;
  const p = await db.query.pallets.findFirst({ where: eq(s.pallets.id, Number(id)), with: { customer: true, shipment: true, location: true } });
  if (!p) notFound();
  const stay = p.shipment?.isCrossDock ? 1 : p.expectedStayDays ?? estimateStayDays(p.customer, p.shipment?.expectedStayDays);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/dock", label: "Dock" }} title={<span className="font-mono">{p.code}</span>}
        subtitle={<span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.customer.color }} />{p.customer.name} · {p.shipment?.reference} · pallet {p.sequence} of {p.shipment?.expectedPallets ?? "?"}{p.shipment?.dockDoor ? ` · door ${p.shipment.dockDoor}` : ""}</span>} />
      {p.status !== "EXPECTED" && <Alert tone="blue" className="mb-4">This pallet was already received{p.location ? ` and sits at ${p.location.code}` : ""}. Saving again updates its measurements.</Alert>}
      {p.shipment?.isCrossDock && <Alert tone="amber" className="mb-4">Same-day shipment: it will be staged by the door, not racked.</Alert>}
      {p.bonded && <Alert tone="green" className="mb-4">In bond · CCN {p.cargoControlNumber ?? "—"}. It can only go in the bonded cage.</Alert>}
      <Card>
        <form action={receivePallet} className="space-y-5">
          <input type="hidden" name="id" value={p.id} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Height (inches)"><input name="heightIn" type="number" inputMode="numeric" min={10} max={110} defaultValue={p.heightIn ?? 58} className={inputLg} required /></Field>
            <Field label="Weight (lb)"><input name="weightLb" type="number" inputMode="numeric" min={20} max={5000} defaultValue={p.weightLb ?? 640} className={inputLg} required /></Field>
            <Field label="Length (inches)" hint="48 = standard. Over 60 goes to the oversize area."><input name="lengthIn" type="number" inputMode="numeric" min={20} max={300} defaultValue={p.lengthIn ?? 48} className={inputLg} /></Field>
            <Field label="Cartons"><input name="cartons" type="number" inputMode="numeric" min={0} defaultValue={p.cartons ?? ""} className={inputLg} /></Field>
          </div>
          <Field label="Contents"><input name="description" defaultValue={p.description ?? ""} className={inputLg} placeholder="Ceramic tiles" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 rounded-lg ring-1 ring-slate-200 px-4 py-3 text-base"><input type="checkbox" name="stackable" defaultChecked={p.stackable} className="h-5 w-5" /> Another pallet can go on top</label>
            <Field label="Expected stay (days)" hint={p.shipment?.isCrossDock ? "Same-day shipment: 1 unless this pallet stays" : `Customer average: ${Math.round(p.customer.avgStayDays)} d`}>
              <input name="expectedStayDays" type="number" inputMode="numeric" min={1} defaultValue={stay} className={inputLg} />
            </Field>
          </div>
          <Field label="Damage or shortage (optional)"><input name="damageNotes" className={inputLg} placeholder="e.g. 2 cartons crushed, photo taken" /></Field>
          <Button size="lg" className="w-full">Find a spot →</Button>
        </form>
      </Card>
      <p className="mt-3 text-center text-xs text-slate-500">A dock scale and a height sensor can fill the two numbers automatically later. <Badge>phase 3</Badge></p>
    </div>
  );
}
