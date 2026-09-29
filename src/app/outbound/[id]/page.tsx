import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder, pickPlan, getStockPallets, getLayout } from "@/lib/queries";
import { setOrderStatus, pickLine, movePallet } from "@/lib/actions";
import { PageHeader, Card, StatusBadge, Button, Badge, Alert, CustomerDot, inputCls } from "@/components/ui";
import { WarehouseMap } from "@/components/WarehouseMap";
import { toMapLocations, toMapPallets, toMapZones } from "@/lib/mapData";
import { fmtDateTime, daysBetween } from "@/lib/format";
import { SITE, DOOR_CODES } from "@/db/layout";
import { CheckCircle2, MoveRight, Truck } from "lucide-react";

export default async function OrderPage(props: PageProps<"/outbound/[id]">) {
  const { id } = await props.params;
  const o = await getOrder(Number(id));
  if (!o) notFound();
  const plan = await pickPlan(o);
  const stock = await getStockPallets();
  const { zones, locations } = await getLayout();
  const pending = plan.steps.filter((st) => st.line.status === "PENDING");
  const allPicked = pending.length === 0;
  const hlIds = plan.steps.map((st) => st.location?.id).filter((x): x is number => !!x);
  const tempUse = new Map<number, number>(); // temp location id → pallets already sent there (stack level)
  return (
    <>
      <PageHeader back={{ href: "/outbound", label: "Outbound" }} title={<span className="flex items-center gap-3">{o.reference} <StatusBadge status={o.status} /></span>}
        subtitle={<CustomerDot color={o.customer.color} name={`${o.customer.name} · needed ${fmtDateTime(o.neededBy)} · ${o.carrier ?? "carrier TBD"}${o.dockDoor ? " · door " + o.dockDoor : ""}`} />}
        actions={
          <>
            {o.status === "REQUESTED" && <form action={setOrderStatus} className="flex gap-2"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="PLANNED" /><select name="dockDoor" className={inputCls} defaultValue=""><option value="">Door…</option>{DOOR_CODES.map((d) => <option key={d}>{d}</option>)}</select><Button variant="secondary" className="whitespace-nowrap">Plan it</Button></form>}
            {["REQUESTED", "PLANNED", "PICKING"].includes(o.status) && (
              <form action={setOrderStatus}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="SHIPPED" /><Button disabled={!allPicked} className="whitespace-nowrap"><Truck className="h-4 w-4" /> Shipped</Button></form>
            )}
            {["REQUESTED", "PLANNED"].includes(o.status) && <form action={setOrderStatus}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="CANCELLED" /><Button variant="ghost">Cancel</Button></form>}
          </>
        } />
      {o.notes && <Alert tone="blue" className="mb-4">{o.notes}</Alert>}
      {o.status !== "SHIPPED" && (
        <Alert tone={plan.totalMoves ? "amber" : "green"} className="mb-4">
          {plan.totalMoves === 0 ? "Everything is reachable: no pallet has to be moved." : `${plan.totalMoves} pallet${plan.totalMoves > 1 ? "s" : ""} to set aside. The list below is ordered so nothing is moved twice.`}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          {plan.steps.map((st, i) => {
            const p = st.line.pallet;
            const done = st.line.status !== "PENDING";
            return (
              <Card key={st.line.id} className={done ? "opacity-60" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-900 text-white"}`}>{done ? <CheckCircle2 className="h-5 w-5" /> : i + 1}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/pallets/${p.id}`} className="font-mono text-lg font-semibold hover:underline">{p.code}</Link>
                        <Badge tone={st.line.cartons == null ? "violet" : "amber"}>{st.line.cartons == null ? "whole pallet" : `${st.line.cartons} cartons`}</Badge>
                        {p.stackLevel > 1 && <Badge>top of stack</Badge>}
                      </div>
                      <div className="text-sm text-slate-600">{p.description} · {p.cartonsRemaining ?? p.cartons ?? "?"} ctn on it · {daysBetween(p.receivedAt)} d in</div>
                      <div className="mt-1 text-sm">at <Link href={`/map?loc=${st.location?.code}`} className="font-mono font-semibold hover:underline">{st.location?.code ?? "?"}</Link>{st.location?.lane != null && <span className="text-slate-500"> · lane {st.location.lane}, depth {st.location.depth}</span>}</div>
                    </div>
                  </div>
                  {!done && ["REQUESTED", "PLANNED", "PICKING"].includes(o.status) && (
                    <form action={pickLine}><input type="hidden" name="lineId" value={st.line.id} /><Button variant="secondary" disabled={st.blockers.length > 0}>Picked</Button></form>
                  )}
                </div>
                {!done && st.blockers.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
                    <div className="font-medium text-amber-900">Move {st.blockers.length} first (front to back):</div>
                    <ul className="mt-2 space-y-2">
                      {st.blockers.map((b, j) => {
                        const temp = st.tempSpots[j];
                        const level = temp ? (tempUse.get(temp.id) ?? 0) + 1 : 1;
                        if (temp) tempUse.set(temp.id, level);
                        return (
                          <li key={b.pallet.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span><span className="font-mono">{b.pallet.code}</span> <span className="text-slate-500">({b.why === "ON_TOP" ? "on top" : `in front at ${b.location.code}`})</span> <MoveRight className="inline h-4 w-4 text-slate-400" /> {temp ? <span className="font-mono font-semibold">{temp.code}{level > 1 ? " (on top)" : ""}</span> : <span className="text-slate-500">set aside in the aisle</span>}</span>
                            {temp && (
                              <form action={movePallet} className="flex items-center gap-1">
                                <input type="hidden" name="id" value={b.pallet.id} />
                                <input type="hidden" name="locationId" value={temp.id} />
                                <input type="hidden" name="stackLevel" value={level} />
                                <input type="hidden" name="reason" value={`Set aside to reach ${p.code} for ${o.reference}`} />
                                <input type="hidden" name="back" value={`/outbound/${o.id}`} />
                                <Button size="sm" variant="secondary">Moved</Button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-2 text-xs text-amber-800">Temporary spots: the nearest empty lane, filled from the back. After the pick, phase 2 will suggest where to put them back; for now they stay where you left them.</div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <div className="xl:col-span-2">
          <WarehouseMap width={SITE.widthFt} depth={SITE.depthFt} outline={SITE.outline} zones={toMapZones(zones)} locations={toMapLocations(locations)} pallets={toMapPallets(stock)} highlightLocationIds={hlIds} compact initialMode="customer" />
          <p className="mt-2 text-xs text-slate-500">Highlighted: the spots on this pick list.</p>
        </div>
      </div>
    </>
  );
}
