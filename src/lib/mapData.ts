import type { Location, Zone } from "@/db/schema";
import type { MapLocation, MapPallet, MapZone } from "@/components/WarehouseMap";
import type { PalletFull } from "./queries";
import { leavesInDays } from "./queries";
import { daysBetween } from "./format";

// Server → client: plain numbers and strings only.
export function toMapZones(zones: Zone[]): MapZone[] {
  return zones.map((z) => ({ id: z.id, code: z.code, name: z.name, kind: z.kind, color: z.color, x: z.x, y: z.y, w: z.w, h: z.h }));
}
export function toMapLocations(locations: Location[]): MapLocation[] {
  return locations.map((l) => ({ id: l.id, code: l.code, kind: l.kind, zoneId: l.zoneId, lane: l.lane, depth: l.depth, row: l.row, bay: l.bay, level: l.level, maxStack: l.maxStack, x: l.x, y: l.y, w: l.w, h: l.h }));
}
export function toMapPallets(pallets: PalletFull[]): MapPallet[] {
  return pallets
    .filter((p) => p.locationId)
    .map((p) => ({
      id: p.id, code: p.code, locationId: p.locationId!, stackLevel: p.stackLevel, customerId: p.customerId, customerName: p.customer.name, customerColor: p.customer.color,
      status: p.status, daysIn: daysBetween(p.receivedAt), leavesIn: leavesInDays(p), confirmed: !!p.locationConfirmedBy, description: p.description, cartons: p.cartonsRemaining ?? p.cartons,
    }));
}
