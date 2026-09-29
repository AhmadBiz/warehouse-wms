import { db, schema as s } from "@/db";
import { PageHeader, Card } from "@/components/ui";
import { ShipmentForm } from "@/components/ShipmentForm";

export const metadata = { title: "New shipment" };

export default async function NewShipmentPage() {
  const customers = await db.query.customers.findMany({ orderBy: s.customers.name });
  return (
    <>
      <PageHeader back={{ href: "/inbound", label: "Inbound" }} title="New shipment" subtitle="For a phone call or a truck that shows up with no email. Emails go through the inbox instead." />
      <Card>
        <ShipmentForm customers={customers} />
      </Card>
    </>
  );
}
