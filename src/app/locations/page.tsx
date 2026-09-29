import { getCapacity } from "@/lib/queries";
import { PageHeader, Card, Table, Th, Td, Badge } from "@/components/ui";
import { CapacityBars } from "@/components/CapacityBars";
import { resetDemo } from "@/lib/actions";
import { Button } from "@/components/ui";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const { site, zones, locations, summary, stock } = await getCapacity();
  const occ = new Map<number, number>();
  for (const p of stock) if (p.locationId) occ.set(p.locationId, (occ.get(p.locationId) ?? 0) + 1);
  const rows = zones.filter((z) => !["DOCK", "OFFICE", "SCALE"].includes(z.kind)).map((z) => {
    const locs = locations.filter((l) => l.zoneId === z.id && l.kind !== "DOOR");
    const heights = [...new Set(locs.map((l) => l.maxHeightIn))].sort((a, b) => a - b);
    const weights = [...new Set(locs.map((l) => l.maxWeightLb))].sort((a, b) => a - b);
    return { z, locs, heights, weights };
  });
  return (
    <>
      <PageHeader title="Locations & site" subtitle={`${site.name} · ${site.widthFt} × ${site.depthFt} ft · rafters ${site.rafterHeightIn ? site.rafterHeightIn / 12 + " ft" : "?"} · sprinkler clearance ${site.sprinklerClearanceIn ? site.sprinklerClearanceIn + '"' : "to measure"} · ${site.palletsPerContainer} pallets per container`}
        actions={<form action={resetDemo}><Button variant="danger" size="sm">Reset demo data</Button></form>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Fill by zone"><CapacityBars zones={summary.zones} /></Card>
        <Card title="Zone rules" padded={false}>
          <Table>
            <thead><tr><Th>Zone</Th><Th right>Spots</Th><Th right>Positions</Th><Th>Max height</Th><Th>Max weight</Th><Th>Stack</Th><Th>Used for</Th></tr></thead>
            <tbody>
              {rows.map(({ z, locs, heights, weights }) => (
                <tr key={z.id}>
                  <Td><span className="inline-block h-2.5 w-2.5 rounded-sm mr-2" style={{ background: z.color }} />{z.name}</Td>
                  <Td right>{locs.length}</Td>
                  <Td right>{locs.reduce((n, l) => n + l.maxStack, 0)}</Td>
                  <Td className="text-xs">{heights.map((h) => `${h}"`).join(" / ")}</Td>
                  <Td className="text-xs">{weights.map((w) => `${w} lb`).join(" / ")}</Td>
                  <Td>{Math.max(...locs.map((l) => l.maxStack))}</Td>
                  <Td className="text-xs text-slate-500">{z.notes}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-4 py-3 text-xs text-slate-500">Rack levels: level 1 up to 72&quot; and 4,000 lb, levels 2–3 up to 60&quot; and 2,500 lb. These are placeholders until the client sends beam heights and the load-capacity signs. <Badge>to confirm</Badge></div>
        </Card>
      </div>
      <Card title="Every spot" padded={false} className="mt-6">
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <thead className="sticky top-0 bg-white"><tr><Th>Code</Th><Th>Zone</Th><Th>Address</Th><Th right>Max h</Th><Th right>Max lb</Th><Th right>Holds</Th><Th right>Now</Th><Th right>Dock dist</Th></tr></thead>
            <tbody>
              {locations.filter((l) => l.kind !== "DOOR").map((l) => {
                const z = zones.find((x) => x.id === l.zoneId)!;
                const n = occ.get(l.id) ?? 0;
                return (
                  <tr key={l.id} className={n ? "" : "text-slate-400"}>
                    <Td mono>{l.code}</Td>
                    <Td className="text-xs">{z.name}</Td>
                    <Td className="text-xs">{l.kind === "RACK" ? `row ${l.row} · bay ${l.bay} · level ${l.level}` : l.lane != null ? `lane ${l.lane} · depth ${l.depth}` : "floor"}</Td>
                    <Td right>{l.maxHeightIn}&quot;</Td>
                    <Td right>{l.maxWeightLb}</Td>
                    <Td right>{l.maxStack}</Td>
                    <Td right className={n ? "font-semibold text-slate-900" : ""}>{n}</Td>
                    <Td right>{l.distanceToDockFt} ft</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  );
}
