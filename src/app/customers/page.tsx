import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PageHeader, Card, Table, Th, Td, Badge, CustomerDot } from "@/components/ui";
import { billingModelLabel } from "@/lib/billing";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await db.query.customers.findMany({ orderBy: s.customers.name });
  const stock = await db.query.pallets.findMany({ where: inArray(s.pallets.status, ["RECEIVED", "STORED", "ALLOCATED", "PICKED"]) });
  const byCust = new Map<number, { pallets: number; cartons: number }>();
  for (const p of stock) {
    const e = byCust.get(p.customerId) ?? { pallets: 0, cartons: 0 };
    e.pallets++; e.cartons += p.cartonsRemaining ?? 0;
    byCust.set(p.customerId, e);
  }
  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} customers · ${stock.length} pallets in stock`} />
      <Card padded={false}>
        <Table>
          <thead><tr><Th>Customer</Th><Th>Code</Th><Th>Billing</Th><Th right>Storage rate</Th><Th right>Pallets in</Th><Th right>Cartons</Th><Th right>Avg stay</Th><Th right>Picks / wk</Th><Th>Contact</Th></tr></thead>
          <tbody>
            {customers.map((c) => {
              const st = byCust.get(c.id) ?? { pallets: 0, cartons: 0 };
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td><Link href={`/customers/${c.id}`} className="font-medium hover:underline"><CustomerDot color={c.color} name={c.name} /></Link></Td>
                  <Td mono>{c.code}</Td>
                  <Td>{c.billingModel === "CARTON_ORDER" ? <Badge tone="amber">{billingModelLabel(c.billingModel)}</Badge> : <span className="text-slate-600">{billingModelLabel(c.billingModel)}</span>}</Td>
                  <Td right>{fmtMoney(c.storageRateCents)}</Td>
                  <Td right>{st.pallets}</Td>
                  <Td right>{st.cartons || "—"}</Td>
                  <Td right>{Math.round(c.avgStayDays)} d</Td>
                  <Td right>{c.picksPerWeek || "—"}</Td>
                  <Td className="text-xs text-slate-500">{c.contactName} · {c.contactEmail}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
