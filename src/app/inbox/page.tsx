import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { ingestEmail } from "@/lib/actions";
import { PageHeader, Card, Table, Th, Td, StatusBadge, Button, Badge, Field, inputCls, CustomerDot } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Email inbox" };

const SAMPLE = {
  from: "sofia@nordika.ca",
  subject: "Inbound container MSCU4471293 – ref NRD-2026-0918",
  body: `Hi Marie,

Container MSCU4471293 is arriving tomorrow around 10:00 at your dock, ref NRD-2026-0918, carrier Transport Bourassa.

14 pallets, 336 cartons total, approx 11,800 lbs. 12 pallets of ceramic tiles are going out the same day to our Laval store (same-day transfer). The other 2 pallets (porcelain sinks) stay with you about 30 days.

Packing list attached.

Thanks,
Sofia Lindqvist
Nordika Imports`,
};

export default async function InboxPage() {
  const emails = await db.query.inboundEmails.findMany({ with: { customer: true }, orderBy: desc(s.inboundEmails.receivedAt) });
  const ai = !!process.env.ANTHROPIC_API_KEY;
  return (
    <>
      <PageHeader title="Email inbox" subtitle={`Shipment and release emails, read automatically. ${ai ? "Extraction by Claude." : "Extraction by pattern matching (set ANTHROPIC_API_KEY to use Claude)."} In production this box fills itself from the warehouse mailbox.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Waiting" padded={false} className="lg:col-span-2">
          <Table>
            <thead><tr><Th>Received</Th><Th>From</Th><Th>Subject</Th><Th>Kind</Th><Th>Status</Th></tr></thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-500">{fmtDateTime(e.receivedAt)}</Td>
                  <Td>{e.customer ? <CustomerDot color={e.customer.color} name={e.customer.name} /> : <span className="text-amber-700">{e.fromAddress}</span>}</Td>
                  <Td><Link href={`/inbox/${e.id}`} className="font-medium text-slate-900 hover:underline">{e.subject}</Link>{e.hasAttachment && <Badge className="ml-2">attachment</Badge>}</Td>
                  <Td className="text-xs text-slate-500">{e.kind.toLowerCase()}</Td>
                  <Td><StatusBadge status={e.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title="Paste an email">
          <form action={ingestEmail} className="space-y-3">
            <Field label="From"><input name="from" defaultValue={SAMPLE.from} className={inputCls} /></Field>
            <Field label="Subject"><input name="subject" defaultValue={SAMPLE.subject} className={inputCls} /></Field>
            <Field label="Body"><textarea name="body" rows={12} defaultValue={SAMPLE.body} className={`${inputCls} font-mono text-xs`} /></Field>
            <Button className="w-full">Read this email</Button>
            <p className="text-xs text-slate-500">Pre-filled with a sample so you can show the parse in one click. Replace it with any real email.</p>
          </form>
        </Card>
      </div>
    </>
  );
}
