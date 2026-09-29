import Link from "next/link";
import { eq, desc, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCapacity } from "@/lib/queries";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Badge, Stat, CustomerDot, Alert } from "@/components/ui";
import { fmtDateTime, daysBetween } from "@/lib/format";

export const metadata = { title: "Customs" };

export default async function CustomsPage() {
  const { summary } = await getCapacity();
  const bonded = summary.zones.find((z) => z.zone.kind === "BONDED");
  const pallets = await db.query.pallets.findMany({ where: eq(s.pallets.bonded, true), with: { customer: true, location: true, shipment: true }, orderBy: desc(s.pallets.receivedAt) });
  const ids = pallets.map((p) => p.id);
  const log = ids.length ? await db.query.movements.findMany({ where: inArray(s.movements.palletId, ids), with: { pallet: true, to: true, from: true }, orderBy: desc(s.movements.at), limit: 40 }) : [];
  const inStock = pallets.filter((p) => p.status !== "SHIPPED" && p.status !== "EXPECTED");
  return (
    <>
      <PageHeader title="Customs — bonded goods" subtitle="Built in from the start so the CBSA application can point at a working record: what is in bond, under which numbers, who moved it and when." />
      <Alert tone="blue" className="mb-6">
        Licence type (sufferance vs. customs bonded warehouse), the cage location and CBSA&apos;s record requirements are still to be confirmed with the client and a broker. The fields below cover what both licence types ask for; nothing here is legal advice.
      </Alert>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="In bond now" value={inStock.length} hint="pallets" />
        <Stat label="Bonded cage" value={bonded ? `${bonded.occupied} / ${bonded.positions}` : "—"} hint="positions used" />
        <Stat label="Cargo control numbers" value={new Set(inStock.map((p) => p.cargoControlNumber).filter(Boolean)).size} hint="open" />
        <Stat label="Log entries" value={log.length} hint="movements on bonded pallets (last 40)" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card title="Bonded inventory" padded={false} className="xl:col-span-3">
          <Table>
            <thead><tr><Th>Pallet</Th><Th>Customer</Th><Th>CCN</Th><Th>Transaction #</Th><Th>Spot</Th><Th right>Days</Th><Th>Status</Th></tr></thead>
            <tbody>
              {inStock.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td mono><Link href={`/pallets/${p.id}`} className="hover:underline">{p.code}</Link></Td>
                  <Td><CustomerDot color={p.customer.color} name={p.customer.name} /></Td>
                  <Td mono>{p.cargoControlNumber ?? <span className="text-amber-700">missing</span>}</Td>
                  <Td mono>{p.transactionNumber ?? "—"}</Td>
                  <Td className="font-mono text-xs">{p.location?.code ?? "—"}{p.location && !p.location.code.startsWith("BD-") && <Badge tone="red" className="ml-2">outside cage</Badge>}</Td>
                  <Td right>{daysBetween(p.receivedAt)}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                </tr>
              ))}
              {inStock.length === 0 && <tr><Td colSpan={7} className="py-6 text-center text-slate-500">Nothing in bond.</Td></tr>}
            </tbody>
          </Table>
        </Card>
        <Card title="Audit log" padded={false} className="xl:col-span-2">
          <Table>
            <thead><tr><Th>When</Th><Th>Pallet</Th><Th>Event</Th><Th>By</Th></tr></thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(m.at)}</Td>
                  <Td mono>{m.pallet.code}</Td>
                  <Td className="text-xs">{m.type.toLowerCase()}{m.to ? ` → ${m.to.code}` : ""}</Td>
                  <Td className="text-xs text-slate-500">{m.byUser}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-4 py-2 text-xs text-slate-400">Every receive, move, pick and ship on a bonded pallet is kept with who did it and how it was confirmed. Retention period: to confirm (CBSA commonly asks for 6 years).</div>
        </Card>
      </div>
    </>
  );
}
