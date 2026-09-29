import Link from "next/link";
import { notFound } from "next/navigation";
import { getPallet, getStockPallets, leavesInDays, getLayout } from "@/lib/queries";
import { blockersFor } from "@/lib/blocking";
import { confirmLocation } from "@/lib/actions";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Badge, Button, CustomerDot, Alert } from "@/components/ui";
import { daysBetween, fmtDateTime, fmtDims, fmtNum } from "@/lib/format";

export default async function PalletPage(props: PageProps<"/pallets/[id]">) {
  const { id } = await props.params;
  const p = await getPallet(Number(id));
  if (!p) notFound();
  const { locations } = await getLayout();
  const stock = await getStockPallets();
  const locById = new Map(locations.map((l) => [l.id, l]));
  const blockers = p.location ? blockersFor(p, p.location, stock, locById) : [];
  const lv = leavesInDays(p);
  return (
    <>
      <PageHeader back={{ href: "/pallets", label: "Pallets" }} title={<span className="flex items-center gap-3 font-mono">{p.code} <StatusBadge status={p.status} /></span>}
        subtitle={<CustomerDot color={p.customer.color} name={`${p.customer.name} · ${p.description ?? ""}`} />}
        actions={p.locationId && !p.locationConfirmedBy ? (
          <form action={confirmLocation} className="flex gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="back" value={`/pallets/${p.id}`} />
            <Button name="source" value="SCAN" variant="secondary">Confirm by scan</Button>
            <Button name="source" value="CAMERA" variant="secondary">Confirm by camera</Button>
          </form>
        ) : undefined} />
      {p.locationId && !p.locationConfirmedBy && <Alert tone="red" className="mb-4">The system assigned {p.location?.code} but no scan or camera confirmed the pallet got there.</Alert>}
      {p.damageNotes && <Alert tone="amber" className="mb-4" title="Damage / shortage noted at receiving">{p.damageNotes}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Where it is">
          {p.location ? (
            <>
              <div className="font-mono text-3xl font-bold"><Link href={`/map?loc=${p.location.code}`} className="hover:underline">{p.location.code}</Link></div>
              <div className="text-sm text-slate-500">{p.location.zone.name}{p.stackLevel > 1 ? " · on top of another pallet" : ""}{p.location.lane != null ? ` · lane ${p.location.lane}, depth ${p.location.depth}` : ""}</div>
              <div className="mt-2 text-xs text-slate-500">Confirmed {p.locationConfirmedBy ? `by ${p.locationConfirmedBy.toLowerCase()} ${fmtDateTime(p.locationConfirmedAt)}` : <span className="text-red-700">never</span>}</div>
              <div className="mt-4 text-sm">
                {blockers.length === 0 ? <span className="text-emerald-700">Reachable now — nothing in the way.</span> : (
                  <>
                    <div className="font-medium text-amber-800">{blockers.length} pallet{blockers.length > 1 ? "s" : ""} to move first:</div>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {blockers.map((b) => <li key={b.pallet.id}><Link href={`/pallets/${b.pallet.id}`} className="font-mono hover:underline">{b.pallet.code}</Link> at {b.location.code} ({b.why === "ON_TOP" ? "on top" : "in front"})</li>)}
                    </ul>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="text-slate-500">{p.status === "EXPECTED" ? <>Not received yet. <Link href={`/dock/${p.id}`} className="underline">Receive it at the dock.</Link></> : p.status === "SHIPPED" ? `Shipped ${fmtDateTime(p.shippedAt)}` : "No spot yet"}</div>
          )}
        </Card>
        <Card title="Details">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-slate-500">Shipment</dt><dd>{p.shipment ? <Link href={`/inbound/${p.shipment.id}`} className="hover:underline">{p.shipment.reference}</Link> : "—"}</dd>
            <dt className="text-slate-500">Lot number</dt><dd className="font-mono">{p.lotNumber ?? "—"}</dd>
            <dt className="text-slate-500">SKU / PO</dt><dd className="font-mono text-xs">{p.sku ?? "—"} / {p.poNumber ?? "—"}</dd>
            <dt className="text-slate-500">Unit</dt><dd>{p.handlingUnit.toLowerCase()}{p.casePack ? ` · ${p.casePack} per carton` : ""}{p.units ? ` · ${p.units} units` : ""}</dd>
            <dt className="text-slate-500">Received</dt><dd>{fmtDateTime(p.receivedAt)}</dd>
            <dt className="text-slate-500">In storage</dt><dd>{p.receivedAt ? `${daysBetween(p.receivedAt)} days` : "—"}</dd>
            <dt className="text-slate-500">Expected stay</dt><dd>{p.expectedStayDays ?? "?"} d · {p.status === "SHIPPED" ? "shipped" : lv < 0 ? <span className="text-amber-700">{-lv} d overdue</span> : `leaves in ${lv} d`}</dd>
            <dt className="text-slate-500">Dims</dt><dd>{fmtDims(p)}{p.oversize && <Badge tone="pink" className="ml-2">oversize</Badge>}</dd>
            <dt className="text-slate-500">Weight</dt><dd>{p.weightLb ? fmtNum(p.weightLb) + " lb" : "—"}</dd>
            <dt className="text-slate-500">Cartons</dt><dd>{p.cartonsRemaining ?? "?"} of {p.cartons ?? "?"}</dd>
            <dt className="text-slate-500">Stackable</dt><dd>{p.stackable ? "yes" : "no"}</dd>
            {p.bonded && (<><dt className="text-slate-500">Customs</dt><dd><Badge tone="teal">in bond</Badge><div className="text-xs mt-1">CCN {p.cargoControlNumber ?? "—"}<br />Txn {p.transactionNumber ?? "—"}</div></dd></>)}
          </dl>
          {p.lines.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Releases</div>
              <ul className="mt-1 space-y-1">{p.lines.map((l) => <li key={l.id}><Link href={`/outbound/${l.order.id}`} className="hover:underline">{l.order.reference}</Link> · {l.cartons == null ? "whole pallet" : `${l.cartons} cartons`} · <StatusBadge status={l.status} /></li>)}</ul>
            </div>
          )}
        </Card>
        <Card title="History" padded={false}>
          <Table>
            <thead><tr><Th>When</Th><Th>What</Th><Th>By</Th></tr></thead>
            <tbody>
              {p.movements.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(m.at)}</Td>
                  <Td className="text-xs">{m.type.toLowerCase()}{m.to ? ` → ${m.to.code}` : ""}{m.from && m.type !== "PUTAWAY" && m.type !== "RECEIVE" ? ` (from ${m.from.code})` : ""}{m.reason ? <span className="text-slate-400"> · {m.reason}</span> : ""}</Td>
                  <Td className="text-xs text-slate-500">{m.byUser} · {m.source.toLowerCase()}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
