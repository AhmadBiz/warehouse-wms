import Link from "next/link";
import { notFound } from "next/navigation";
import { getShipment } from "@/lib/queries";
import { updateShipmentStatus, addExpectedPallets } from "@/lib/actions";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Button, Badge, Alert, inputCls, CustomerDot } from "@/components/ui";
import { fmtDateTime, fmtDims, fmtNum, plural } from "@/lib/format";
import { DOOR_CODES } from "@/db/layout";
import { Printer, ScanLine } from "lucide-react";

export default async function ShipmentPage(props: PageProps<"/inbound/[id]">) {
  const { id } = await props.params;
  const sh = await getShipment(Number(id));
  if (!sh) notFound();
  const received = sh.pallets.filter((p) => p.status !== "EXPECTED");
  const stored = sh.pallets.filter((p) => p.locationId);
  const totalWeight = received.reduce((n, p) => n + (p.weightLb ?? 0), 0);
  const next = { ANNOUNCED: "SCHEDULED", SCHEDULED: "ARRIVED", ARRIVED: "RECEIVING", RECEIVING: "RECEIVED", RECEIVED: "CLOSED", CLOSED: null }[sh.status];
  const nextLabel = { SCHEDULED: "Mark scheduled (door assigned)", ARRIVED: "Truck is at the door", RECEIVING: "Start receiving", RECEIVED: "Mark fully received", CLOSED: "Close shipment" } as Record<string, string>;

  return (
    <>
      <PageHeader
        back={{ href: "/inbound", label: "Inbound" }}
        title={<span className="flex items-center gap-3">{sh.reference} <StatusBadge status={sh.status} /></span>}
        subtitle={<CustomerDot color={sh.customer.color} name={`${sh.customer.name} · ${sh.containerNumber ?? "no container number"} · ${sh.carrier ?? "carrier unknown"}`} />}
        actions={
          <>
            {sh.pallets.length > 0 && <Button href={`/inbound/${sh.id}/labels`} variant="secondary"><Printer className="h-4 w-4" /> Print {sh.pallets.length} labels</Button>}
            {["ANNOUNCED", "ARRIVED", "RECEIVING", "SCHEDULED"].includes(sh.status) && sh.pallets.length > 0 && <Button href={`/dock?shipment=${sh.id}`}><ScanLine className="h-4 w-4" /> Receive at dock</Button>}
          </>
        }
      />

      {!sh.packingListReceived && (
        <Alert tone="amber" title="No packing list yet">
          The email had no pallet count{sh.expectedWeightLb == null ? " or weight" : ""}. {sh.looseCartons ? "Goods arrive as loose cartons and will be palletized on site: add labels below as pallets are built." : "Add the expected pallets below once the customer sends it, or label pallets as they come off the truck."}
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Shipment" className="lg:col-span-1">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">ETA</dt><dd>{fmtDateTime(sh.expectedAt)}</dd>
            <dt className="text-slate-500">Arrived</dt><dd>{fmtDateTime(sh.arrivedAt)}</dd>
            <dt className="text-slate-500">Door</dt><dd>{sh.dockDoor ?? "—"}</dd>
            <dt className="text-slate-500">Expected</dt><dd>{sh.expectedPallets ?? "?"} pallets · {sh.expectedCartons ?? "?"} cartons · {sh.expectedWeightLb ? fmtNum(sh.expectedWeightLb) + " lb" : "? lb"}</dd>
            <dt className="text-slate-500">Received so far</dt><dd>{received.length} pallets · {fmtNum(totalWeight)} lb · {stored.length} put away</dd>
            <dt className="text-slate-500">Stay</dt><dd>{sh.isCrossDock ? <Badge tone="amber">same day (cross-dock)</Badge> : `~${sh.expectedStayDays ?? sh.customer.avgStayDays} days`}</dd>
            {sh.bonded && (<><dt className="text-slate-500">Customs</dt><dd><Badge tone="teal">in bond</Badge> CCN {sh.cargoControlNumber ?? "—"} · txn {sh.transactionNumber ?? "—"}</dd></>)}
            {sh.notes && (<><dt className="text-slate-500">Notes</dt><dd>{sh.notes}</dd></>)}
          </dl>
          {next && (
            <form action={updateShipmentStatus} className="mt-5 space-y-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={sh.id} />
              <input type="hidden" name="status" value={next} />
              {(next === "SCHEDULED" || next === "ARRIVED") && (
                <select name="dockDoor" defaultValue={sh.dockDoor ?? ""} className={inputCls}>
                  <option value="">Choose a door…</option>
                  {DOOR_CODES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <Button variant="secondary" className="w-full">{nextLabel[next]}</Button>
            </form>
          )}
        </Card>

        <Card title={`Pallets (${sh.pallets.length})`} padded={false} className="lg:col-span-2" actions={
          <form action={addExpectedPallets} className="flex items-center gap-1">
            <input type="hidden" name="id" value={sh.id} />
            <input name="count" type="number" min={1} defaultValue={1} className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs" />
            <Button size="sm" variant="secondary">+ add labels</Button>
          </form>
        }>
          {sh.pallets.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No pallets yet. Add labels above to print them before the truck arrives.</div>
          ) : (
            <Table>
              <thead><tr><Th>#</Th><Th>Label</Th><Th>Contents</Th><Th>Dims</Th><Th right>Weight</Th><Th>Spot</Th><Th>Status</Th></tr></thead>
              <tbody>
                {sh.pallets.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td className="text-slate-400">{p.sequence}</Td>
                    <Td mono><Link href={`/pallets/${p.id}`} className="hover:underline">{p.code}</Link></Td>
                    <Td>{p.description ?? <span className="text-slate-400">—</span>}{p.cartons ? <span className="text-slate-400"> · {p.cartons} ctn</span> : null}{p.damageNotes && <Badge tone="red" className="ml-2">damage</Badge>}</Td>
                    <Td className="tabular-nums">{fmtDims(p)}</Td>
                    <Td right>{p.weightLb ? `${fmtNum(p.weightLb)} lb` : "—"}</Td>
                    <Td>{p.location ? <Link href={`/map?loc=${p.location.code}`} className="font-mono text-xs hover:underline">{p.location.code}</Link> : p.status === "EXPECTED" ? <Link href={`/dock/${p.id}`} className="text-xs text-slate-500 hover:underline">receive →</Link> : "—"}</Td>
                    <Td><StatusBadge status={p.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="px-4 py-2 text-xs text-slate-400">{plural(sh.pallets.filter((p) => p.status === "EXPECTED").length, "pallet")} still expected.</div>
        </Card>
      </div>
    </>
  );
}
