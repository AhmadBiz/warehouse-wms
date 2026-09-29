// The slotting engine: given a pallet, pick a spot and say why.
//
// Rules, in the order they matter for this client:
//  1. Bonded goods only go in the bonded cage.
//  2. Extra-long items only go in the oversize area.
//  3. Same-day pallets (80% of volume) stay on the floor near the doors. Never rack them.
//  4. Carton-pick customers (5 of 20, picked almost daily) get a pick face: lane front or rack level 1.
//  5. Pallets staying a week or more go to the racks, out of the way. Heavy ones low.
//  6. Everything else goes in a floor lane, grouped by customer, with the pallet
//     that leaves soonest at the front, so the crew stops digging.
// Every candidate gets a score and the reasons are kept in plain words for the screen.

import type { Location, Zone, Customer } from "@/db/schema";

export type SlottingPallet = {
  id?: number;
  customerId: number;
  heightIn: number;
  weightLb: number;
  lengthIn?: number | null;
  stackable: boolean;
  oversize?: boolean;
  bonded?: boolean;
  expectedStayDays: number; // best estimate, days
  isCrossDock?: boolean;
  dockDoor?: string | null;
};

export type Occupant = {
  id: number;
  code: string;
  customerId: number;
  locationId: number;
  stackLevel: number;
  heightIn: number | null;
  stackable: boolean;
  leavesInDays: number; // expected days until it leaves (can be negative = overdue)
};

export type Suggestion = {
  location: Location;
  zone: Zone;
  stackLevel: number;
  score: number;
  reasons: string[];
  warnings: string[];
};

export type SlottingResult = {
  best: Suggestion | null;
  alternatives: Suggestion[];
  strategy: string; // one line: which rule fired
  considered: number;
};

type Ctx = {
  locations: Location[];
  zones: Zone[];
  occupants: Occupant[]; // pallets currently in a location
  customer: Customer;
  doorX?: number; // x of the dock door in use, for "near door" scoring
};

export function suggestLocation(p: SlottingPallet, ctx: Ctx): SlottingResult {
  const zoneById = new Map(ctx.zones.map((z) => [z.id, z]));
  const occByLoc = new Map<number, Occupant[]>();
  for (const o of ctx.occupants) {
    const arr = occByLoc.get(o.locationId) ?? [];
    arr.push(o);
    occByLoc.set(o.locationId, arr);
  }
  // Lane index: zoneId:lane -> locations sorted by depth
  const lanes = new Map<string, Location[]>();
  for (const l of ctx.locations) {
    if (l.kind === "FLOOR" && l.lane != null) {
      const k = `${l.zoneId}:${l.lane}`;
      const arr = lanes.get(k) ?? [];
      arr.push(l);
      lanes.set(k, arr);
    }
  }
  for (const arr of lanes.values()) arr.sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));

  const isPickCustomer = ctx.customer.billingModel === "CARTON_ORDER";
  const isLong = !!p.oversize || (p.lengthIn ?? 0) > 60;
  const sameDay = p.expectedStayDays <= 1; // the pallet-level stay wins over the shipment flag (mixed containers)
  const longStay = p.expectedStayDays >= 7;
  const heavy = p.weightLb > 2000;

  // 1. Which zones, in order of preference
  let prefs: Array<{ kind: Zone["kind"]; label: string }>;
  let strategy: string;
  if (p.bonded) {
    prefs = [{ kind: "BONDED", label: "Bonded goods must stay in the bonded cage" }];
    strategy = "Bonded → bonded cage only";
  } else if (isLong) {
    prefs = [{ kind: "OVERSIZE", label: "Extra-long item → oversize area" }];
    strategy = "Oversize → oversize area only";
  } else if (sameDay) {
    prefs = [
      { kind: "CROSSDOCK", label: "Leaves within a day → cross-dock staging by the doors, not racked" },
      { kind: "FLOOR", label: "Staging full → front of a floor lane" },
    ];
    strategy = "Same-day pallet → cross-dock staging near the door";
  } else if (isPickCustomer) {
    prefs = [
      { kind: "FLOOR", label: `${ctx.customer.name} picks cartons almost daily → keep at the front of a lane` },
      { kind: "RACK", label: "No lane front free → rack level 1 as a pick face" },
    ];
    strategy = "Carton-pick customer → pick face (lane front or rack level 1)";
  } else if (longStay) {
    prefs = [
      { kind: "RACK", label: `Staying ~${p.expectedStayDays} days → rack, out of the way of daily traffic` },
      { kind: "FLOOR", label: "Racks full for this size → back of a floor lane" },
    ];
    strategy = "Long stay → racking";
  } else {
    prefs = [
      { kind: "FLOOR", label: `Staying ~${p.expectedStayDays} days → floor lane, grouped with the customer's other pallets` },
      { kind: "RACK", label: "Lanes full → rack" },
    ];
    strategy = "Short stay → floor lane grouped by customer";
  }

  const candidates: Suggestion[] = [];
  const doorX = ctx.doorX;

  for (let pi = 0; pi < prefs.length; pi++) {
    const pref = prefs[pi];
    const zoneIds = ctx.zones.filter((z) => z.kind === pref.kind).map((z) => z.id);
    if (!zoneIds.length) continue;
    const prefBonus = pi === 0 ? 100 : 50;

    // Floor lanes (cross-dock, floor, bonded all behave as lanes)
    for (const [key, laneLocs] of lanes) {
      const zoneId = Number(key.split(":")[0]);
      if (!zoneIds.includes(zoneId)) continue;
      const zone = zoneById.get(zoneId)!;
      // find first occupied position from the front
      let firstOcc: Location | null = null;
      for (const l of laneLocs) {
        if ((occByLoc.get(l.id)?.length ?? 0) > 0) { firstOcc = l; break; }
      }
      const laneOccupants = laneLocs.flatMap((l) => occByLoc.get(l.id) ?? []);
      const laneCustomers = new Set(laneOccupants.map((o) => o.customerId));
      const laneEmpty = laneOccupants.length === 0;
      const laneName = (spot: Location) => (zone.kind === "FLOOR" ? `Lane ${spot.lane}` : `Column ${((spot.lane ?? 0) % 100) + 1}`);
      const sameCustomerLane = laneCustomers.size === 1 && laneCustomers.has(p.customerId);
      const mixedLane = laneCustomers.size > 0 && !laneCustomers.has(p.customerId);
      const laneSoonest = laneOccupants.length ? Math.min(...laneOccupants.map((o) => o.leavesInDays)) : null;

      // Candidate A: deepest reachable empty position (drive in until the first occupied spot)
      const reachable = firstOcc ? laneLocs.filter((l) => (l.depth ?? 0) < (firstOcc!.depth ?? 0)) : laneLocs;
      const spot = reachable.length ? reachable[reachable.length - 1] : null;
      if (spot && p.heightIn <= spot.maxHeightIn && p.weightLb <= spot.maxWeightLb && spot.active) {
        const reasons = [pref.label];
        const warnings: string[] = [];
        let score = prefBonus;
        if (sameCustomerLane) { score += 40; reasons.push(`${laneName(spot)} already holds ${ctx.customer.name} → fewer moves later`); }
        else if (laneEmpty) { score += 15; reasons.push(`${laneName(spot)} is empty → keeps customers separate`); }
        else if (mixedLane) { score -= 35; warnings.push(`${laneName(spot)} holds another customer's pallets`); }
        if (laneSoonest != null) {
          if (p.expectedStayDays <= laneSoonest) { score += 20; reasons.push("Leaves before the pallets behind it → no digging"); }
          else { score -= 30; warnings.push("Pallets behind it leave sooner → they would have to be dug out"); }
        }
        if (isPickCustomer) {
          if ((spot.depth ?? 0) <= 2) { score += 30; reasons.push("Front of lane → cartons can be picked without moving anything"); }
          else if (laneEmpty) { score += 5; reasons.push(`Starts a lane for ${ctx.customer.name}: reserve stock behind the pick face`); }
          else if (mixedLane) { score -= 40; warnings.push("Deep in a shared lane → carton picks would need moves"); }
        }
        // distance
        if (sameDay || p.expectedStayDays <= 2) { score -= 0.35 * spot.distanceToDockFt; reasons.push(`${spot.distanceToDockFt} ft from the dock`); }
        else { score += 0.08 * spot.distanceToDockFt; }
        if (doorX != null && (sameDay)) {
          const dx = Math.abs(spot.x + spot.w / 2 - doorX);
          score -= 0.2 * dx;
          if (dx < 25) reasons.push(`In line with door ${p.dockDoor}`);
        }
        reasons.push(`${p.heightIn}" high, ${p.weightLb} lb → fits (max ${spot.maxHeightIn}", ${spot.maxWeightLb} lb)`);
        candidates.push({ location: spot, zone, stackLevel: 1, score, reasons, warnings });
      }

      // Candidate B: stack on top of the first reachable occupied pallet
      if (firstOcc && firstOcc.maxStack >= 2) {
        const stack = occByLoc.get(firstOcc.id) ?? [];
        const bottom = stack.find((o) => o.stackLevel === 1);
        if (bottom && stack.length < firstOcc.maxStack && bottom.stackable && p.weightLb <= 1500) {
          const combined = (bottom.heightIn ?? 60) + p.heightIn;
          if (combined <= firstOcc.maxHeightIn) {
            const reasons = [pref.label, `Stacks on ${bottom.code} → saves a floor position`];
            const warnings: string[] = [];
            let score = prefBonus + 5;
            if (bottom.customerId === p.customerId) { score += 30; reasons.push("Same customer below"); }
            else { score -= 30; warnings.push("Different customer below"); }
            if (bottom.leavesInDays < p.expectedStayDays) { score -= 25; warnings.push(`${bottom.code} leaves first → this pallet would have to come off`); }
            else { score += 15; reasons.push("Leaves before the pallet below it"); }
            if (isPickCustomer) { score -= 20; warnings.push("Stacked pallets are slower to pick cartons from"); }
            if (!p.stackable) { /* it can still go on top; the flag is about what goes on it */ }
            reasons.push(`Combined height ${combined}" ≤ ${firstOcc.maxHeightIn}"`);
            candidates.push({ location: firstOcc, zone, stackLevel: 2, score, reasons, warnings });
          }
        }
      }
    }

    // Rack positions
    if (pref.kind === "RACK") {
      const zone = ctx.zones.find((z) => z.kind === "RACK");
      if (zone) {
        // Find bays where this customer already is, to keep them together
        const customerBays = new Set<string>();
        for (const o of ctx.occupants) {
          if (o.customerId !== p.customerId) continue;
          const l = ctx.locations.find((x) => x.id === o.locationId);
          if (l?.kind === "RACK") customerBays.add(`${l.row}-${l.bay}`);
        }
        for (const l of ctx.locations) {
          if (l.kind !== "RACK" || l.zoneId !== zone.id || !l.active) continue;
          if ((occByLoc.get(l.id)?.length ?? 0) > 0) continue;
          if (p.heightIn > l.maxHeightIn || p.weightLb > l.maxWeightLb) continue;
          const reasons = [pref.label];
          const warnings: string[] = [];
          let score = prefBonus;
          const lvl = l.level ?? 1;
          if (heavy) { if (lvl === 1) { score += 25; reasons.push(`${p.weightLb} lb → ground level`); } else continue; }
          else if (isPickCustomer) { if (lvl === 1) { score += 30; reasons.push("Ground level → pick face"); } else { score -= 40; } }
          else { if (lvl === 1) { score -= 15; } else { score += 10 + (lvl === 3 ? 5 : 0); reasons.push(`Level ${lvl} → keeps ground level free for heavy and pick pallets`); } }
          if (customerBays.has(`${l.row}-${l.bay}`)) { score += 20; reasons.push(`Bay ${l.row}-${l.bay} already holds ${ctx.customer.name}`); }
          const neighbours = [...customerBays].some((b) => b.startsWith(l.row + "-"));
          if (neighbours) { score += 8; }
          score += 0.05 * l.distanceToDockFt; // long stays can go further
          reasons.push(`${p.heightIn}" high, ${p.weightLb} lb → fits (max ${l.maxHeightIn}", ${l.maxWeightLb} lb)`);
          candidates.push({ location: l, zone, stackLevel: 1, score, reasons, warnings });
        }
      }
    }

    // Oversize positions
    if (pref.kind === "OVERSIZE") {
      const zone = ctx.zones.find((z) => z.kind === "OVERSIZE");
      if (zone) {
        for (const l of ctx.locations) {
          if (l.zoneId !== zone.id || !l.active) continue;
          if ((occByLoc.get(l.id)?.length ?? 0) >= l.maxStack) continue;
          candidates.push({ location: l, zone, stackLevel: 1, score: prefBonus - 0.05 * l.distanceToDockFt, reasons: [pref.label], warnings: [] });
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  // de-duplicate by location+stack, keep best
  const seen = new Set<string>();
  const uniq = candidates.filter((c) => {
    const k = `${c.location.id}:${c.stackLevel}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { best: uniq[0] ?? null, alternatives: uniq.slice(1, 4), strategy, considered: uniq.length };
}

/** Expected stay for a pallet when the customer's own estimate is missing or unreliable. */
export function estimateStayDays(customer: Customer, shipmentEstimate?: number | null): number {
  // The client told us customer estimates are never accurate: blend them with history.
  if (shipmentEstimate == null) return Math.max(1, Math.round(customer.avgStayDays));
  return Math.max(1, Math.round(0.4 * shipmentEstimate + 0.6 * customer.avgStayDays));
}
