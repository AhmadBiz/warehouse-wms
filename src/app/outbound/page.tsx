import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Button, CustomerDot, Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { Plus } from "lucide-react";

export const metadata = { title: "Outbound" };

export default async function OutboundPage() {
  const open = await db.query.outboundOrders.findMany({ where: inArray(s.outboundOrders.status, ["REQUESTED", "PLANNED", "PICKING"]), with: { customer: true, lines: true }, orderBy: s.outboundOrders.neededBy });
  const done = await db.query.outboundOrders.findMany({ where: inArray(s.outboundOrders.status, ["SHIPPED", "CANCELLED"]), with: { customer: true, lines: true }, orderBy: desc(s.outboundOrders.shippedAt), limit: 20 });
  const row = (o: (typeof open)[number], muted = false) => {
    const whole = o.lines.filter((l) => l.cartons == null).length;
    const cartons = o.lines.reduce((n, l) => n + (l.cartons ?? 0), 0);
    return (
      <tr key={o.id} className={muted ? "text-slate-500 hover:bg-slate-50" : "hover:bg-slate-50"}>
        <Td className="whitespace-nowrap">{o.status === "SHIPPED" ? fmtDateTime(o.shippedAt) : fmtDateTime(o.neededBy)}</Td>
        <Td><CustomerDot color={o.customer.color} name={o.customer.name} /></Td>
        <Td><Link href={`/outbound/${o.id}`} className="font-medium text-slate-900 hover:underline">{o.reference}</Link></Td>
        <Td>{whole ? `${whole} pallet${whole > 1 ? "s" : ""}` : ""}{whole && cartons ? " + " : ""}{cartons ? `${cartons} cartons` : ""}</Td>
        <Td>{o.carrier ?? "—"}</Td>
        <Td right>{o.lines.filter((l) => l.status !== "PENDING").length} / {o.lines.length}</Td>
        <Td><StatusBadge status={o.status} /></Td>
      </tr>
    );
  };
  return (
    <>
      <PageHeader title="Outbound releases" subtitle="Customer requests, turned into pick lists that say what to move first." actions={<Button href="/outbound/new"><Plus className="h-4 w-4" /> New release</Button>} />
      <Card title="To pick" padded={false}>
        {open.length === 0 ? <Empty>No open releases.</Empty> : (
          <Table>
            <thead><tr><Th>Needed by</Th><Th>Customer</Th><Th>Reference</Th><Th>What</Th><Th>Carrier</Th><Th right>Done</Th><Th>Status</Th></tr></thead>
            <tbody>{open.map((o) => row(o))}</tbody>
          </Table>
        )}
      </Card>
      <Card title="Shipped recently" padded={false} className="mt-6">
        <Table>
          <thead><tr><Th>Shipped</Th><Th>Customer</Th><Th>Reference</Th><Th>What</Th><Th>Carrier</Th><Th right>Lines</Th><Th>Status</Th></tr></thead>
          <tbody>{done.map((o) => row(o, true))}</tbody>
        </Table>
      </Card>
    </>
  );
}
