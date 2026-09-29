import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PageHeader, Card, inputCls, Button, Alert } from "@/components/ui";
import { OrderForm } from "@/components/OrderForm";
import type { PalletFull } from "@/lib/queries";

export const metadata = { title: "New release" };

export default async function NewOrderPage(props: PageProps<"/outbound/new">) {
  const sp = await props.searchParams;
  const customers = await db.query.customers.findMany({ orderBy: s.customers.name });
  const customerId = sp.customer ? Number(sp.customer) : null;
  const customer = customers.find((c) => c.id === customerId) ?? null;
  const stock: PalletFull[] = customer ? await db.query.pallets.findMany({ where: and(eq(s.pallets.customerId, customer.id), inArray(s.pallets.status, ["STORED"])), with: { customer: true, location: true, shipment: true } }) : [];
  return (
    <>
      <PageHeader back={{ href: "/outbound", label: "Outbound" }} title="New release" subtitle="From a phone call or a customer portal request. Emails go through the inbox." />
      {sp.error === "nolines" && <Alert tone="red" className="mb-4">Tick at least one pallet.</Alert>}
      <Card className="mb-4">
        <form className="flex gap-2">
          <select name="customer" defaultValue={customerId ?? ""} className={`${inputCls} max-w-sm`}>
            <option value="">Choose a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button variant="secondary">Show their stock</Button>
        </form>
      </Card>
      <Card>
        <OrderForm customers={customers} customer={customer} pallets={stock} />
      </Card>
    </>
  );
}
