import Link from "next/link";
import { desc, inArray, and, isNull, like, or, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { leavesInDays } from "@/lib/queries";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Badge, CustomerDot, inputCls, Button } from "@/components/ui";
import { daysBetween, fmtDims, fmtNum, fmtDate } from "@/lib/format";

export const metadata = { title: "Pallets" };

export default async function PalletsPage(props: PageProps<"/pallets">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = typeof sp.filter === "string" ? sp.filter : "";
  const customerId = sp.customer ? Number(sp.customer) : null;
  const conds = [];
  if (filter === "shipped") conds.push(eq(s.pallets.status, "SHIPPED"));
  else if (filter === "expected") conds.push(eq(s.pallets.status, "EXPECTED"));
  else conds.push(inArray(s.pallets.status, ["RECEIVED", "STORED", "ALLOCATED", "PICKED"]));
  if (filter === "unconfirmed") conds.push(isNull(s.pallets.locationConfirmedBy));
  if (filter === "bonded") conds.push(eq(s.pallets.bonded, true));
  if (customerId) conds.push(eq(s.pallets.customerId, customerId));
  if (q) conds.push(or(like(s.pallets.code, `%${q.toUpperCase()}%`), like(s.pallets.description, `%${q}%`)));
  let rows = await db.query.pallets.findMany({ where: and(...conds), with: { customer: true, location: { with: { zone: true } }, shipment: true }, orderBy: desc(s.pallets.receivedAt), limit: 400 });
  if (filter === "overdue") rows = rows.filter((p) => leavesInDays(p) < -1).sort((a, b) => leavesInDays(a) - leavesInDays(b));
  const customers = await db.query.customers.findMany({ orderBy: s.customers.name });
  const filters = [["", "In stock"], ["overdue", "Past expected stay"], ["unconfirmed", "Spot not confirmed"], ["bonded", "In bond"], ["expected", "Expected"], ["shipped", "Shipped"]];
  return (
    <>
      <PageHeader title="Pallets" subtitle={`${rows.length} shown`} />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Code or contents" className={`${inputCls} w-56`} />
        <select name="customer" defaultValue={customerId ?? ""} className={`${inputCls} w-56`}>
          <option value="">All customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="filter" defaultValue={filter} className={`${inputCls} w-48`}>
          {filters.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Button variant="secondary">Filter</Button>
      </form>
      <Card padded={false}>
        <Table>
          <thead><tr><Th>Code</Th><Th>Customer</Th><Th>Contents</Th><Th>Spot</Th><Th right>In</Th><Th right>Leaves</Th><Th>Dims / weight</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const lv = leavesInDays(p);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td mono><Link href={`/pallets/${p.id}`} className="hover:underline">{p.code}</Link>{p.bonded && <Badge tone="teal" className="ml-2">bond</Badge>}</Td>
                  <Td><CustomerDot color={p.customer.color} name={p.customer.name} /></Td>
                  <Td className="max-w-[240px] truncate">{p.description}{p.sku ? <span className="font-mono text-xs text-slate-400"> · {p.sku}</span> : null}{p.cartonsRemaining != null ? <span className="text-slate-400"> · {p.cartonsRemaining} ctn</span> : null}</Td>
                  <Td>{p.location ? <Link href={`/map?loc=${p.location.code}`} className="font-mono text-xs hover:underline">{p.location.code}{p.stackLevel > 1 ? " ▲" : ""}</Link> : <span className="text-slate-400">—</span>}{p.locationId && !p.locationConfirmedBy && <Badge tone="red" className="ml-2">unconfirmed</Badge>}</Td>
                  <Td right>{p.receivedAt ? `${daysBetween(p.receivedAt)} d` : "—"}</Td>
                  <Td right className={lv < -1 ? "text-amber-700 font-medium" : ""}>{p.status === "SHIPPED" ? fmtDate(p.shippedAt) : p.receivedAt ? (lv < 0 ? `${-lv} d over` : `${lv} d`) : "—"}</Td>
                  <Td className="text-xs text-slate-500 tabular-nums">{fmtDims(p)} · {p.weightLb ? fmtNum(p.weightLb) + " lb" : "—"}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><Td className="text-center text-slate-500 py-8" colSpan={8}>No pallets match.</Td></tr>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
