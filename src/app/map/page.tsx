import { getCapacity } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { WarehouseMap } from "@/components/WarehouseMap";
import { toMapLocations, toMapPallets, toMapZones } from "@/lib/mapData";
import { SITE } from "@/db/layout";

export const metadata = { title: "Map" };

export default async function MapPage(props: PageProps<"/map">) {
  const sp = await props.searchParams;
  const { site, zones, locations, stock, summary } = await getCapacity();
  const hl = sp.loc ? locations.filter((l) => l.code === String(sp.loc)).map((l) => l.id) : [];
  return (
    <>
      <PageHeader
        title="Warehouse map"
        subtitle={`${site.name} · ${SITE.areaM2.toLocaleString()} m² (${site.sqft?.toLocaleString()} sq ft) · ${summary.totalOccupied} pallets in ${summary.totalPositions} positions · ${summary.totalFree} free (≈ ${summary.containersFree} containers)`}
      />
      <WarehouseMap
        width={site.widthFt}
        depth={site.depthFt}
        outline={SITE.outline}
        zones={toMapZones(zones)}
        locations={toMapLocations(locations)}
        pallets={toMapPallets(stock)}
        highlightLocationIds={hl}
        highlightLabel={hl.length ? String(sp.loc) : undefined}
        initialMode={(sp.mode as "customer" | "leave" | "zone") ?? "customer"}
      />
    </>
  );
}
