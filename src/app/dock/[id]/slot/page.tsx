import Link from "next/link";
import { notFound } from "next/navigation";
import { computeSuggestion } from "@/lib/suggest";
import { getStockPallets } from "@/lib/queries";
import { putawayPallet } from "@/lib/actions";
import { PageHeader, Card, Button, Badge, inputCls } from "@/components/ui";
import { WarehouseMap } from "@/components/WarehouseMap";
import { toMapLocations, toMapPallets, toMapZones } from "@/lib/mapData";
import { SITE } from "@/db/layout";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default async function SlotPage(props: PageProps<"/dock/[id]/slot">) {
  const { id } = await props.params;
  const { pallet: p, result, locations, zones } = await computeSuggestion(Number(id));
  if (!p) notFound();
  const stock = await getStockPallets();
  const best = result.best;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: `/dock/${p.id}`, label: p.code }} title="Put it here" subtitle={`${p.code} · ${p.customer.name} · ${p.heightIn}" · ${p.weightLb} lb · stays ~${p.expectedStayDays} d`} />
      {best ? (
        <Card className="ring-2 ring-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{best.zone.name}{best.stackLevel > 1 ? " · on top of the pallet already there" : ""}</div>
              <div className="font-mono text-5xl font-black tracking-tight text-slate-900">{best.location.code}</div>
              <div className="mt-1 text-sm text-slate-600">{result.strategy}</div>
            </div>
            <form action={putawayPallet} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="locationId" value={best.location.id} />
              <input type="hidden" name="stackLevel" value={best.stackLevel} />
              <Button size="lg" name="source" value="SCAN"><CheckCircle2 className="h-5 w-5" /> Confirm — scanned at {best.location.code}</Button>
              <button name="source" value="SYSTEM" className="text-xs text-slate-500 underline">Put there without scanning (spot stays unconfirmed)</button>
            </form>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {best.reasons.map((r) => <li key={r} className="flex gap-2 text-slate-700"><span className="text-emerald-600">✓</span>{r}</li>)}
            {best.warnings.map((w) => <li key={w} className="flex gap-2 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</li>)}
          </ul>
        </Card>
      ) : (
        <Card><div className="text-red-700">No spot fits this pallet ({result.strategy}). Check the height and weight, or free a position.</div></Card>
      )}

      <div className="mt-4">
        <WarehouseMap width={SITE.widthFt} depth={SITE.depthFt} outline={SITE.outline} zones={toMapZones(zones)} locations={toMapLocations(locations)} pallets={toMapPallets(stock)} highlightLocationIds={best ? [best.location.id] : []} highlightLabel={best?.location.code} compact initialMode="zone" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title="Other good spots">
          {result.alternatives.length === 0 ? <div className="text-sm text-slate-500">None close.</div> : (
            <ul className="divide-y divide-slate-100">
              {result.alternatives.map((a) => (
                <li key={`${a.location.id}-${a.stackLevel}`} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-mono font-semibold">{a.location.code}{a.stackLevel > 1 && <Badge className="ml-2">on top</Badge>}</div>
                    <div className="text-xs text-slate-500">{a.reasons.slice(1, 3).join(" · ")}{a.warnings.length ? ` · ⚠ ${a.warnings[0]}` : ""}</div>
                  </div>
                  <form action={putawayPallet}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="locationId" value={a.location.id} />
                    <input type="hidden" name="stackLevel" value={a.stackLevel} />
                    <input type="hidden" name="source" value="SCAN" />
                    <Button size="sm" variant="secondary">Use</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Somewhere else">
          <form action={putawayPallet} className="flex gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="source" value="MANUAL" />
            <input type="hidden" name="reason" value="Chosen by the driver" />
            <select name="locationId" className={inputCls} defaultValue="">
              <option value="">Pick a spot…</option>
              {locations.filter((l) => l.kind !== "DOOR").map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
            <Button variant="secondary">Put there</Button>
          </form>
          <p className="mt-2 text-xs text-slate-500">The system learns nothing from overrides yet; phase 2 records why the driver chose differently. {result.considered} spots were considered. <Link href="/map" className="underline">Open the full map</Link>.</p>
        </Card>
      </div>
    </div>
  );
}
