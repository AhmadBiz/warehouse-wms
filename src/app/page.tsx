import Link from "next/link";
import { getDashboard, leavesInDays } from "@/lib/queries";
import { PageHeader, Card, Stat, StatusBadge, Table, Th, Td, Button, Badge, CustomerDot, Empty } from "@/components/ui";
import { CapacityBars } from "@/components/CapacityBars";
import { fmtTime, fmtRelative, fmtDate, plural } from "@/lib/format";
import { AlertTriangle, ScanLine, Mail } from "lucide-react";

export default async function Dashboard(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const d = await getDashboard();
  const today = new Date();
  const palletsToday = d.arrivalsToday.reduce((n, sh) => n + (sh.expectedPallets ?? sh.pallets.length), 0);
  const linesDue = d.ordersOpen.reduce((n, o) => n + o.lines.filter((l) => l.status === "PENDING").length, 0);
  const alerts = [
    d.overdue.length && { tone: "amber" as const, text: `${plural(d.overdue.length, "pallet")} past the expected stay`, href: "/pallets?filter=overdue" },
    d.blockedLines && { tone: "amber" as const, text: `${plural(d.blockedLines, "pallet")} in open releases need digging out`, href: "/outbound" },
    d.unconfirmed.length && { tone: "red" as const, text: `${plural(d.unconfirmed.length, "spot")} never confirmed by scan or camera`, href: "/pallets?filter=unconfirmed" },
    d.noPackingList.length && { tone: "amber" as const, text: `${plural(d.noPackingList.length, "arrival")} without a packing list or pallet count`, href: "/inbound" },
    d.emailsNew.length && { tone: "blue" as const, text: `${plural(d.emailsNew.length, "email")} waiting in the inbox`, href: "/inbox" },
  ].filter(Boolean) as Array<{ tone: "amber" | "red" | "blue"; text: string; href: string }>;

  return (
    <>
      {sp.reset && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">Demo data reset to today.</div>}
      <PageHeader
        title={`Today at ${d.site.name}`}
        subtitle={today.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
        actions={
          <>
            <Button href="/inbox" variant="secondary"><Mail className="h-4 w-4" /> Inbox {d.emailsNew.length ? <Badge tone="blue">{d.emailsNew.length}</Badge> : null}</Button>
            <Button href="/dock"><ScanLine className="h-4 w-4" /> Receive a pallet</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Space left" value={`${d.summary.totalFree} positions`} hint={`≈ ${d.summary.containersFree} containers (${d.site.palletsPerContainer}/container)`} tone={d.summary.containersFree < 5 ? "warn" : "good"} />
        <Stat label="Warehouse full" value={`${d.summary.pctFull}%`} hint={`${d.summary.totalOccupied} stored + ${d.summary.totalReserved} announced`} tone={d.summary.pctFull > 85 ? "bad" : "default"} />
        <Stat label="Arrivals today" value={d.arrivalsToday.length} hint={`${palletsToday} pallets`} />
        <Stat label="Releases open" value={d.ordersOpen.length} hint={`${linesDue} lines to pick`} tone={d.blockedLines ? "warn" : "default"} />
        <Stat label="Received today" value={d.receivedToday} hint="pallets scanned in" />
        <Stat label="Shipped today" value={d.shippedToday.reduce((n, o) => n + o.lines.length, 0)} hint={`${plural(d.shippedToday.length, "order")}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Capacity by zone" actions={<Link href="/map" className="text-xs text-slate-500 hover:text-slate-900">Open map →</Link>}>
            <CapacityBars zones={d.summary.zones} />
          </Card>

          <Card title="Arrivals" padded={false} actions={<Link href="/inbound" className="text-xs text-slate-500 hover:text-slate-900">All inbound →</Link>}>
            {d.arrivalsToday.length === 0 && d.arrivalsSoon.length === 0 ? (
              <Empty>Nothing announced for today.</Empty>
            ) : (
              <Table>
                <thead><tr><Th>When</Th><Th>Customer</Th><Th>Reference</Th><Th>Door</Th><Th right>Pallets</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {d.arrivalsToday.map((sh) => (
                    <tr key={sh.id} className="hover:bg-slate-50">
                      <Td className="whitespace-nowrap">{fmtTime(sh.expectedAt)}</Td>
                      <Td><CustomerDot color={sh.customer.color} name={sh.customer.name} /></Td>
                      <Td><Link href={`/inbound/${sh.id}`} className="font-medium text-slate-900 hover:underline">{sh.reference}</Link>{sh.isCrossDock && <Badge tone="amber" className="ml-2">cross-dock</Badge>}</Td>
                      <Td>{sh.dockDoor ?? <span className="text-slate-400">—</span>}</Td>
                      <Td right>{sh.expectedPallets ?? <span className="text-amber-700">?</span>}<span className="text-slate-400"> / {sh.pallets.filter((p) => p.status !== "EXPECTED").length} in</span></Td>
                      <Td><StatusBadge status={sh.status} /></Td>
                    </tr>
                  ))}
                  {d.arrivalsSoon.map((sh) => (
                    <tr key={sh.id} className="hover:bg-slate-50 text-slate-500">
                      <Td className="whitespace-nowrap">Tomorrow {fmtTime(sh.expectedAt)}</Td>
                      <Td><CustomerDot color={sh.customer.color} name={sh.customer.name} /></Td>
                      <Td><Link href={`/inbound/${sh.id}`} className="hover:underline">{sh.reference}</Link>{sh.looseCartons && <Badge tone="amber" className="ml-2">loose cartons</Badge>}</Td>
                      <Td>{sh.dockDoor ?? "—"}</Td>
                      <Td right>{sh.expectedPallets ?? <span className="text-amber-700">no packing list</span>}</Td>
                      <Td><StatusBadge status={sh.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Releases to pick" padded={false} actions={<Link href="/outbound" className="text-xs text-slate-500 hover:text-slate-900">All outbound →</Link>}>
            {d.ordersOpen.length === 0 ? (
              <Empty>No open release requests.</Empty>
            ) : (
              <Table>
                <thead><tr><Th>Needed by</Th><Th>Customer</Th><Th>Reference</Th><Th right>Lines</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {d.ordersOpen.map((o) => {
                    const pending = o.lines.filter((l) => l.status === "PENDING").length;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <Td className="whitespace-nowrap">{o.neededBy ? `${fmtDate(o.neededBy)} ${fmtTime(o.neededBy)}` : "—"}</Td>
                        <Td><CustomerDot color={o.customer.color} name={o.customer.name} /></Td>
                        <Td><Link href={`/outbound/${o.id}`} className="font-medium text-slate-900 hover:underline">{o.reference}</Link></Td>
                        <Td right>{pending} <span className="text-slate-400">/ {o.lines.length}</span></Td>
                        <Td><StatusBadge status={o.status} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Needs attention">
            {alerts.length === 0 ? (
              <div className="text-sm text-emerald-700">All clear.</div>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.text}>
                    <Link href={a.href} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${a.tone === "red" ? "bg-red-50 text-red-900 ring-red-200" : a.tone === "blue" ? "bg-blue-50 text-blue-900 ring-blue-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                      <span>{a.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {d.overdue.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Longest overdue</div>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {d.overdue.slice(0, 5).map((p) => (
                    <li key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5">
                      <Link href={`/pallets/${p.id}`} className="font-mono text-xs hover:underline truncate">{p.code}</Link>
                      <span className="text-xs text-slate-500">{p.customer.name.split(" ")[0]} · {p.location?.code}</span>
                      <span className="text-xs text-amber-700 tabular-nums whitespace-nowrap">{-leavesInDays(p)} d over</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Activity" padded={false}>
            <ul className="divide-y divide-slate-100">
              {d.activity.map((e) => (
                <li key={e.id} className="px-5 py-2.5 text-sm">
                  <div className="text-slate-800">{e.message}</div>
                  <div className="text-xs text-slate-400">{fmtRelative(e.at)}{e.byUser ? ` · ${e.byUser}` : ""}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
