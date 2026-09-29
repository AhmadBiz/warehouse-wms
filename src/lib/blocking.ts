// Which pallets have to move before a given pallet can be reached.
// Floor lanes are accessed from the front (depth 1). A pallet at depth d is blocked
// by anything in the same lane at a smaller depth, and by anything stacked on top of it.

export type PlacedPallet = {
  id: number;
  code: string;
  customerId: number;
  locationId: number | null;
  stackLevel: number;
  expectedStayDays: number | null;
  receivedAt: Date | null;
};

export type LocationLite = {
  id: number;
  code: string;
  zoneId: number;
  kind: string;
  lane: number | null;
  depth: number | null;
  maxStack: number;
};

export type Blocker = {
  pallet: PlacedPallet;
  location: LocationLite;
  why: "IN_FRONT" | "ON_TOP";
};

export function blockersFor(
  target: PlacedPallet,
  targetLoc: LocationLite,
  all: PlacedPallet[],
  locById: Map<number, LocationLite>
): Blocker[] {
  const out: Blocker[] = [];
  for (const p of all) {
    if (p.id === target.id || !p.locationId) continue;
    const loc = locById.get(p.locationId);
    if (!loc) continue;
    if (loc.id === targetLoc.id && p.stackLevel > target.stackLevel) {
      out.push({ pallet: p, location: loc, why: "ON_TOP" });
      continue;
    }
    if (
      targetLoc.kind === "FLOOR" &&
      targetLoc.lane != null &&
      loc.zoneId === targetLoc.zoneId &&
      loc.lane === targetLoc.lane &&
      loc.depth != null &&
      targetLoc.depth != null &&
      loc.depth < targetLoc.depth
    ) {
      out.push({ pallet: p, location: loc, why: "IN_FRONT" });
    }
  }
  // Order of removal: front-most first; within one spot, the top pallet first.
  out.sort((a, b) => (a.location.depth ?? 0) - (b.location.depth ?? 0) || b.pallet.stackLevel - a.pallet.stackLevel);
  return out;
}

/** Lane positions reachable from the aisle: every position in front of the first occupied one. */
export function reachableDepth(lane: LocationLite[], occupiedLocIds: Set<number>): number {
  // lane sorted by depth ascending (1 = front)
  const sorted = [...lane].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
  let firstOccupied = Infinity;
  for (const l of sorted) if (occupiedLocIds.has(l.id)) { firstOccupied = l.depth ?? 0; break; }
  const maxDepth = Math.max(...sorted.map((l) => l.depth ?? 0));
  return firstOccupied === Infinity ? maxDepth : firstOccupied - 1;
}
