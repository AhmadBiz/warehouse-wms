import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { parseEmail, type ParsedEmail } from "@/lib/emailParser";
import { reparseEmail, markEmail } from "@/lib/actions";
import { PageHeader, Card, StatusBadge, Button, Badge, Alert } from "@/components/ui";
import { ShipmentForm } from "@/components/ShipmentForm";
import { OrderForm } from "@/components/OrderForm";
import { fmtDateTime } from "@/lib/format";
import type { PalletFull } from "@/lib/queries";

export default async function EmailPage(props: PageProps<"/inbox/[id]">) {
  const { id } = await props.params;
  const email = await db.query.inboundEmails.findFirst({ where: eq(s.inboundEmails.id, Number(id)), with: { customer: true } });
  if (!email) notFound();
  const customers = await db.query.customers.findMany({ orderBy: s.customers.name });
  const parsed: ParsedEmail = email.parsedJson ? JSON.parse(email.parsedJson) : await parseEmail(email.fromAddress, email.subject, email.body, customers);
  const customer = customers.find((c) => c.id === (parsed.customerId ?? email.customerId)) ?? null;
  const stock: PalletFull[] = customer && parsed.kind === "OUTBOUND"
    ? await db.query.pallets.findMany({ where: and(eq(s.pallets.customerId, customer.id), inArray(s.pallets.status, ["STORED"])), with: { customer: true, location: true, shipment: true } })
    : [];
  const fields: Array<[string, string | number | boolean | null | undefined]> = parsed.kind === "OUTBOUND"
    ? [["Customer", parsed.customerName], ["Pallets named", parsed.palletCodes.join(", ") || null], ["Cartons", parsed.cartonsRequested], ["Pickup by", parsed.neededBy], ["Reference", parsed.reference]]
    : [["Customer", parsed.customerName], ["Reference", parsed.reference], ["Container", parsed.containerNumber], ["Carrier", parsed.carrier], ["Arrives", parsed.expectedAt], ["Pallets", parsed.pallets], ["Cartons", parsed.cartons], ["Weight (lb)", parsed.weightLb], ["Stay (days)", parsed.expectedStayDays], ["Cross-dock", parsed.isCrossDock ? "yes" : null], ["Loose cartons", parsed.looseCartons ? "yes" : null], ["In bond", parsed.bonded ? "yes" : null], ["CCN", parsed.cargoControlNumber]];

  return (
    <>
      <PageHeader
        back={{ href: "/inbox", label: "Inbox" }}
        title={email.subject}
        subtitle={<>{email.fromAddress} · {fmtDateTime(email.receivedAt)} · <StatusBadge status={email.status} /></>}
        actions={
          <>
            <form action={reparseEmail}><input type="hidden" name="id" value={email.id} /><Button variant="secondary">Read again</Button></form>
            {email.status !== "LINKED" && <form action={markEmail}><input type="hidden" name="id" value={email.id} /><input type="hidden" name="status" value="IGNORED" /><Button variant="ghost">Ignore</Button></form>}
          </>
        }
      />
      {email.status === "LINKED" && (
        <Alert tone="green" className="mb-4">
          Already handled: {email.shipmentId ? <Link href={`/inbound/${email.shipmentId}`} className="underline">open the shipment</Link> : email.orderId ? <Link href={`/outbound/${email.orderId}`} className="underline">open the release</Link> : "linked"}.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Email" className="lg:col-span-2">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{email.body}</pre>
          {email.hasAttachment && <div className="mt-3 text-xs text-slate-500">📎 packing list attached (PDF reading is a phase 2 item)</div>}
        </Card>
        <div className="space-y-6 lg:col-span-3">
          <Card title={<span className="flex items-center gap-2">What the system read <Badge tone={parsed.method === "claude" ? "violet" : "slate"}>{parsed.method === "claude" ? "Claude" : "patterns"}</Badge> <Badge tone={parsed.kind === "OUTBOUND" ? "amber" : "blue"}>{parsed.kind.toLowerCase()}</Badge></span>}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
              {fields.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className={`sm:col-span-2 ${v == null || v === "" ? "text-amber-700" : "font-medium text-slate-900"}`}>{v == null || v === "" ? "not found" : String(v)}</dd>
                </div>
              ))}
            </dl>
            {parsed.missing.length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                Missing: {parsed.missing.join(", ")}. {parsed.missing.includes("dimensions") ? "Dimensions and weight are always confirmed at the dock, so that one is normal." : ""} Fill in what you know below; the rest gets captured at the dock.
              </div>
            )}
          </Card>
          {email.status !== "LINKED" && email.status !== "IGNORED" && (
            parsed.kind === "OUTBOUND" ? (
              <Card title="Create the release">
                <OrderForm customers={customers} customer={customer} pallets={stock} preselected={parsed.palletCodes} cartonsRequested={parsed.cartonsRequested} neededBy={parsed.neededBy} reference={parsed.reference} emailId={email.id} />
              </Card>
            ) : (
              <Card title="Create the shipment">
                <ShipmentForm customers={customers} parsed={parsed} emailId={email.id} />
              </Card>
            )
          )}
        </div>
      </div>
    </>
  );
}
