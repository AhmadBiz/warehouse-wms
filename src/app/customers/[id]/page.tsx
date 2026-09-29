import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerWithStock, leavesInDays } from "@/lib/queries";
import { estimateBilling, billingModelLabel } from "@/lib/billing";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Badge, Button, CustomerDot } from "@/components/ui";
import { fmtMoney, fmtDate, daysBetween, startOfDay, fmtDateTime } from "@/lib/format";

export default async function CustomerPage(props: PageProps<"/customers/[id]">) {
  const { id } = await props.params;
  const data = await getCustomerWithStock(Number(id));
  if (!data) notFound();
  const { customer: c, pallets, shipments, orders } = data;
  const inStock = pallets.filter((p) => ["RECEIVED", "STORED", "ALLOCATED", "PICKED"].includes(p.status));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const bill = estimateBilling(c, pallets, orders, monthStart, startOfDay(nextMonth));
  return (
    <>
      <PageHeader back={{ href: "/customers", label: "Customers" }} title={<CustomerDot color={c.color} name={c.name} />} subtitle={`${c.code} · ${c.contactName} · ${c.contactEmail} · ${billingModelLabel(c.billingModel)}`}
        actions={<><Button href={`/portal/${c.portalToken}`} variant="secondary">Open their portal view</Button><Button href={`/outbound/new?customer=${c.id}`}>New release</Button></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`This month so far · ${bill.periodLabel}`}>
          <Table>
            <thead><tr><Th>Line</Th><Th right>Qty</Th><Th right>Rate</Th><Th right>Total</Th></tr></thead>
            <tbody>
              {bill.lines.map((l) => <tr key={l.label}><Td>{l.label}</Td><Td right>{l.qty}</Td><Td right>{fmtMoney(l.unitCents)}</Td><Td right>{fmtMoney(l.totalCents)}</Td></tr>)}
              <tr className="font-semibold"><Td>Total</Td><Td /><Td /><Td right>{fmtMoney(bill.totalCents)}</Td></tr>
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-slate-500">Storage counted from the day each pallet was received; any started {c.billingModel === "PALLET_WEEK" ? "week" : "month"} counts. {c.billingModel === "CARTON_ORDER" ? "Orders and cartons picked are billed on shipment." : ""} Export to the accounting system is a phase 2 item.</p>
        </Card>
        <Card title="In stock" padded={false} className="lg:col-span-2">
          <Table>
            <thead><tr><Th>Pallet</Th><Th>Contents</Th><Th>Spot</Th><Th right>Cartons</Th><Th right>In</Th><Th right>Leaves</Th><Th>Status</Th></tr></thead>
            <tbody>
              {inStock.map((p) => {
                const lv = leavesInDays(p);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td mono><Link href={`/pallets/${p.id}`} className="hover:underline">{p.code}</Link></Td>
                    <Td>{p.description}</Td>
                    <Td className="font-mono text-xs">{p.location?.code ?? "—"}</Td>
                    <Td right>{p.cartonsRemaining ?? "—"}</Td>
                    <Td right>{daysBetween(p.receivedAt)} d</Td>
                    <Td right className={lv < 0 ? "text-amber-700" : ""}>{lv < 0 ? `${-lv} d over` : `${lv} d`}</Td>
                    <Td><StatusBadge status={p.status} /></Td>
                  </tr>
                );
              })}
              {inStock.length === 0 && <tr><Td colSpan={7} className="py-6 text-center text-slate-500">Nothing in stock.</Td></tr>}
            </tbody>
          </Table>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Shipments in" padded={false}>
          <Table>
            <thead><tr><Th>ETA / arrived</Th><Th>Reference</Th><Th right>Pallets</Th><Th>Status</Th></tr></thead>
            <tbody>{shipments.map((sh) => <tr key={sh.id}><Td className="text-xs text-slate-500">{fmtDateTime(sh.arrivedAt ?? sh.expectedAt)}</Td><Td><Link href={`/inbound/${sh.id}`} className="hover:underline">{sh.reference}</Link>{sh.isCrossDock && <Badge tone="amber" className="ml-2">cross-dock</Badge>}</Td><Td right>{sh.expectedPallets ?? "?"}</Td><Td><StatusBadge status={sh.status} /></Td></tr>)}</tbody>
          </Table>
        </Card>
        <Card title="Releases out" padded={false}>
          <Table>
            <thead><tr><Th>Needed / shipped</Th><Th>Reference</Th><Th right>Lines</Th><Th>Status</Th></tr></thead>
            <tbody>{orders.map((o) => <tr key={o.id}><Td className="text-xs text-slate-500">{fmtDate(o.shippedAt ?? o.neededBy)}</Td><Td><Link href={`/outbound/${o.id}`} className="hover:underline">{o.reference}</Link></Td><Td right>{o.lines.length}</Td><Td><StatusBadge status={o.status} /></Td></tr>)}</tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
