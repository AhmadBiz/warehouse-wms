import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { lookupPallet } from "@/lib/actions";
import { PageHeader, Card, Button, Badge, inputLg, StatusBadge, Alert } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import { CheckCircle2, ScanLine } from "lucide-react";

export const metadata = { title: "Dock" };

export default async function DockPage(props: PageProps<"/dock">) {
  const sp = await props.searchParams;
  const shipments = await db.query.shipments.findMany({
    where: inArray(s.shipments.status, ["SCHEDULED", "ARRIVED", "RECEIVING", "ANNOUNCED"]),
    with: { customer: true, pallets: { orderBy: s.pallets.sequence } },
    orderBy: s.shipments.expectedAt,
  });
  const focus = sp.shipment ? Number(sp.shipment) : null;
  const ordered = focus ? [...shipments].sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : 0)) : shipments;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Dock — receive a pallet" subtitle="Scan the label, type two numbers, get a spot. Under 30 seconds." />
      {sp.done && (
        <Alert tone="green" className="mb-4">
          <div className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5" /> <span className="font-mono font-semibold">{String(sp.done)}</span> put away at <span className="font-mono font-semibold">{String(sp.loc)}</span></div>
          <div className="mt-1 text-xs"><Link href={`/map?loc=${sp.loc}`} className="underline">Show on map</Link></div>
        </Alert>
      )}
      {sp.notfound && <Alert tone="red" className="mb-4">No pallet with code <span className="font-mono">{String(sp.notfound)}</span>. Check the label, or add labels on the shipment page.</Alert>}

      <Card>
        <form action={lookupPallet} className="flex gap-2">
          <input name="code" autoFocus autoComplete="off" placeholder="Scan or type PLT-XXX-00000" className={`${inputLg} font-mono uppercase`} />
          <Button size="lg"><ScanLine className="h-5 w-5" /> Go</Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">A phone camera, a Bluetooth scanner or the keyboard all work here. The dock camera will fill this in automatically in phase 3.</p>
      </Card>

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Trucks at the dock and expected</h2>
      <div className="space-y-4">
        {ordered.map((sh) => {
          const expected = sh.pallets.filter((p) => p.status === "EXPECTED");
          const received = sh.pallets.length - expected.length;
          return (
            <Card key={sh.id} title={<span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: sh.customer.color }} />{sh.customer.name} · {sh.reference} <StatusBadge status={sh.status} /></span>}
              actions={<span className="text-xs text-slate-500">{sh.dockDoor ? `Door ${sh.dockDoor}` : "no door"} · {fmtTime(sh.expectedAt)} · {received}/{sh.pallets.length} in</span>}>
              {sh.isCrossDock && <Badge tone="amber" className="mb-2">same-day out</Badge>}
              {expected.length === 0 ? (
                <div className="text-sm text-slate-500">{sh.pallets.length === 0 ? <>No labels yet — <Link href={`/inbound/${sh.id}`} className="underline">add them on the shipment</Link>.</> : "All pallets received."}</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {expected.slice(0, 12).map((p) => (
                    <Link key={p.id} href={`/dock/${p.id}`} className="touch-btn flex items-center justify-center rounded-lg bg-slate-100 px-2 font-mono text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-200">
                      {p.code}
                    </Link>
                  ))}
                  {expected.length > 12 && <div className="flex items-center justify-center text-xs text-slate-500">+{expected.length - 12} more</div>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
