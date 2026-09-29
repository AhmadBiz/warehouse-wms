import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCustomerWithStock, leavesInDays } from "@/lib/queries";
import { Card, Table, Th, Td, StatusBadge, Stat, Badge } from "@/components/ui";
import { daysBetween, fmtDate, fmtDateTime } from "@/lib/format";

export default async function PortalPage(props: PageProps<"/portal/[token]">) {
  const { token } = await props.params;
  const c = await db.query.customers.findFirst({ where: eq(s.customers.portalToken, token) });
  if (!c) notFound();
  const data = (await getCustomerWithStock(c.id))!;
  const inStock = data.pallets.filter((p) => ["RECEIVED", "STORED", "ALLOCATED", "PICKED"].includes(p.status));
  const cartons = inStock.reduce((n, p) => n + (p.cartonsRemaining ?? 0), 0);
  const inbound = data.shipments.filter((sh) => ["ANNOUNCED", "SCHEDULED", "ARRIVED", "RECEIVING"].includes(sh.status));
  const open = data.orders.filter((o) => ["REQUESTED", "PLANNED", "PICKING"].includes(o.status));
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 rounded-xl bg-slate-900 px-6 py-5 text-white">
        <div className="text-xs uppercase tracking-widest text-slate-400">Customer portal · Montréal East warehouse</div>
        <div className="mt-1 text-2xl font-semibold">{c.name}</div>
        <div className="text-sm text-slate-300">Live view of your goods. Updated every time a pallet is scanned.</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pallets in storage" value={inStock.length} />
        <Stat label="Cartons available" value={cartons} />
        <Stat label="Arriving" value={inbound.length} hint="shipments announced" />
        <Stat label="Releases in progress" value={open.length} />
      </div>
      <Card title="Your inventory" padded={false} className="mt-6">
        <Table>
          <thead><tr><Th>Pallet</Th><Th>Contents</Th><Th right>Cartons</Th><Th>Received</Th><Th right>Days stored</Th><Th>Status</Th></tr></thead>
          <tbody>
            {inStock.map((p) => (
              <tr key={p.id}>
                <Td mono>{p.code}</Td>
                <Td>{p.description}{p.bonded && <Badge tone="teal" className="ml-2">in bond</Badge>}</Td>
                <Td right>{p.cartonsRemaining ?? "—"}</Td>
                <Td>{fmtDate(p.receivedAt)}</Td>
                <Td right>{daysBetween(p.receivedAt)}</Td>
                <Td><StatusBadge status={p.status === "ALLOCATED" ? "PICKING" : p.status} /></Td>
              </tr>
            ))}
            {inStock.length === 0 && <tr><Td colSpan={6} className="py-6 text-center text-slate-500">Nothing in storage right now.</Td></tr>}
          </tbody>
        </Table>
      </Card>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Shipments" padded={false}>
          <Table>
            <thead><tr><Th>Reference</Th><Th>When</Th><Th right>Pallets</Th><Th>Status</Th></tr></thead>
            <tbody>{data.shipments.slice(0, 8).map((sh) => <tr key={sh.id}><Td>{sh.reference}</Td><Td className="text-xs text-slate-500">{fmtDateTime(sh.arrivedAt ?? sh.expectedAt)}</Td><Td right>{sh.expectedPallets ?? "?"}</Td><Td><StatusBadge status={sh.status} /></Td></tr>)}</tbody>
          </Table>
        </Card>
        <Card title="Releases" padded={false}>
          <Table>
            <thead><tr><Th>Reference</Th><Th>When</Th><Th right>Lines</Th><Th>Status</Th></tr></thead>
            <tbody>{data.orders.slice(0, 8).map((o) => <tr key={o.id}><Td>{o.reference}</Td><Td className="text-xs text-slate-500">{fmtDateTime(o.shippedAt ?? o.neededBy)}</Td><Td right>{o.lines.length}</Td><Td><StatusBadge status={o.status} /></Td></tr>)}</tbody>
          </Table>
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Storage days count from the day of receipt. Questions: ops@warehouse.example · Data shown is a demo.</p>
    </div>
  );
}
