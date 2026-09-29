import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { suggestLocation, estimateStayDays } from "./slotting";
import { getLayout, getStockPallets, toOccupants } from "./queries";

export async function computeSuggestion(palletId: number) {
  const p = (await db.query.pallets.findFirst({ where: eq(s.pallets.id, palletId), with: { customer: true, shipment: true } }))!;
  const { zones, locations } = await getLayout();
  const stock = await getStockPallets();
  const occupants = toOccupants(stock.filter((x) => x.id !== p.id));
  const door = p.shipment?.dockDoor ? locations.find((l) => l.code === p.shipment!.dockDoor) : null;
  const result = suggestLocation(
    {
      id: p.id, customerId: p.customerId, heightIn: p.heightIn ?? 55, weightLb: p.weightLb ?? 800, lengthIn: p.lengthIn, stackable: p.stackable, oversize: p.oversize, bonded: p.bonded,
      expectedStayDays: p.expectedStayDays ?? estimateStayDays(p.customer, p.shipment?.expectedStayDays), isCrossDock: p.shipment?.isCrossDock, dockDoor: p.shipment?.dockDoor,
    },
    { locations, zones, occupants, customer: p.customer, doorX: door ? door.x + door.w / 2 : undefined }
  );
  return { pallet: p, result, occupants, locations, zones };
}

