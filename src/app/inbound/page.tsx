import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Button, Badge, CustomerDot, Empty } from "@/components/ui";
import { fmtDateTime, fmtDate } from "@/lib/format";
import { Mail, Plus } from "lucide-react";

export const metadata = { title: "Inbound" };

export default async function InboundPage() {
  const open = await db.query.shipments.findMany({ where: inArray(s.shipments.status, ["ANNOUNCED", "SCHEDULED", "ARRIVED", "RECEIVING"]), with: { customer: true, pallets: true }, orderBy: s.shipments.expectedAt });
  const done = await db.query.shipments.findMany({ where: inArray(s.shipments.status, ["RECEIVED", "CLOSED"]), with: { customer: true, pallets: true }, orderBy: desc(s.shipments.arrivedAt), limit: 25 });
  const row = (sh: (typeof open)[number], muted = false) => {
    const inCount = sh.pallets.filter((p) => p.status !== "EXPECTED").length;
    return (
      <tr key={sh.id} className={muted ? "text-slate-500 hover:bg-slate-50" : "hover:bg-slate-50"}>
        <Td className="whitespace-nowrap">{fmtDateTime(sh.expectedAt)}</Td>
        <Td><CustomerDot color={sh.customer.color} name={sh.customer.name} /></Td>
        <Td>
          <Link href={`/inbound/${sh.id}`} className="font-medium text-slate-900 hover:underline">{sh.reference}</Link>
          {sh.containerNumber && <span className="ml-2 font-mono text-xs text-slate-400">{sh.containerNumber}</span>}
          {sh.isCrossDock && <Badge tone="amber" className="ml-2">cross-dock</Badge>}
          {sh.bonded && <Badge tone="teal" className="ml-2">in bond</Badge>}
          {sh.looseCartons && <Badge tone="amber" className="ml-2">loose cartons</Badge>}
        </Td>
        <Td>{sh.dockDoor ?? "—"}</Td>
        <Td right>{sh.expectedPallets ?? <span className="text-amber-700">?</span>} <span className="text-slate-400">/ {inCount} in</span></Td>
        <Td>{sh.packingListReceived ? <span className="text-emerald-700 text-xs">yes</span> : <span className="text-amber-700 text-xs">missing</span>}</Td>
        <Td><StatusBadge status={sh.status} /></Td>
      </tr>
    );
  };
  return (
    <>
      <PageHeader
        title="Inbound shipments"
        subtitle="Announced by email, labeled before arrival, received at the dock."
        actions={
          <>
            <Button href="/inbox" variant="secondary"><Mail className="h-4 w-4" /> Read an email</Button>
            <Button href="/inbound/new"><Plus className="h-4 w-4" /> New shipment</Button>
          </>
        }
      />
      <Card title="Expected and in progress" padded={false}>
        {open.length === 0 ? <Empty>Nothing announced.</Empty> : (
          <Table>
            <thead><tr><Th>ETA</Th><Th>Customer</Th><Th>Reference</Th><Th>Door</Th><Th right>Pallets</Th><Th>Packing list</Th><Th>Status</Th></tr></thead>
            <tbody>{open.map((sh) => row(sh))}</tbody>
          </Table>
        )}
      </Card>
      <Card title="Received recently" padded={false} className="mt-6">
        <Table>
          <thead><tr><Th>Arrived</Th><Th>Customer</Th><Th>Reference</Th><Th>Door</Th><Th right>Pallets</Th><Th>Packing list</Th><Th>Status</Th></tr></thead>
          <tbody>{done.map((sh) => row(sh, true))}</tbody>
        </Table>
        <div className="px-4 py-2 text-xs text-slate-400">Showing the last 25 · arrived dates {fmtDate(done[done.length - 1]?.arrivedAt)} → {fmtDate(done[0]?.arrivedAt)}</div>
      </Card>
    </>
  );
}
