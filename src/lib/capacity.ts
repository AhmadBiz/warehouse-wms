import type { Location, Zone, Site } from "@/db/schema";

export type ZoneCapacity = {
  zone: Zone;
  positions: number; // pallet positions (stack counted)
  spots: number; // physical spots
  occupied: number;
  reserved: number; // announced but not yet received
  free: number;
  pctFull: number;
};

export type CapacitySummary = {
  zones: ZoneCapacity[];
  totalPositions: number;
  totalOccupied: number;
  totalReserved: number;
  totalFree: number;
  containersFree: number; // free / palletsPerContainer
  pctFull: number;
};

export function capacitySummary(
  site: Site,
  zones: Zone[],
  locations: Location[],
  occupancy: Map<number, number>, // locationId -> pallets present
  reservedByZoneKind: Partial<Record<Zone["kind"], number>> = {}
): CapacitySummary {
  const out: ZoneCapacity[] = [];
  for (const z of zones) {
    if (z.kind === "DOCK" || z.kind === "OFFICE" || z.kind === "SCALE" || z.kind === "HOLD") continue;
    const locs = locations.filter((l) => l.zoneId === z.id && l.active && l.kind !== "DOOR");
    const positions = locs.reduce((s, l) => s + l.maxStack, 0);
    const occupied = locs.reduce((s, l) => s + (occupancy.get(l.id) ?? 0), 0);
    const reserved = reservedByZoneKind[z.kind] ?? 0;
    const free = Math.max(0, positions - occupied - reserved);
    out.push({ zone: z, positions, spots: locs.length, occupied, reserved, free, pctFull: positions ? Math.round(((occupied + reserved) / positions) * 100) : 0 });
  }
  const totalPositions = out.reduce((s, z) => s + z.positions, 0);
  const totalOccupied = out.reduce((s, z) => s + z.occupied, 0);
  const totalReserved = out.reduce((s, z) => s + z.reserved, 0);
  const totalFree = out.reduce((s, z) => s + z.free, 0);
  return {
    zones: out,
    totalPositions,
    totalOccupied,
    totalReserved,
    totalFree,
    containersFree: Math.floor(totalFree / (site.palletsPerContainer || 20)),
    pctFull: totalPositions ? Math.round(((totalOccupied + totalReserved) / totalPositions) * 100) : 0,
  };
}
