import Link from "next/link";
import { db, schema as s } from "@/db";
import { PageHeader, Card, CustomerDot } from "@/components/ui";

export const metadata = { title: "Customer portal" };

export default async function PortalIndex() {
  const customers = await db.query.customers.findMany({ orderBy: s.customers.name });
  return (
    <>
      <PageHeader title="Customer portal" subtitle="What each customer sees when they log in: their own stock, nothing else. No more calls to ask where things are. (Demo: pick a customer; real logins come with phase 2.)" />
      <Card>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <li key={c.id}><Link href={`/portal/${c.portalToken}`} className="flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-slate-200 hover:bg-slate-50"><CustomerDot color={c.color} name={c.name} /><span className="text-xs text-slate-400">open →</span></Link></li>
          ))}
        </ul>
      </Card>
    </>
  );
}
