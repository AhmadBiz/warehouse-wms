import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getShipment } from "@/lib/queries";
import { labelsPrinted } from "@/lib/actions";
import { PageHeader, Button } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { fmtDate } from "@/lib/format";

export default async function LabelsPage(props: PageProps<"/inbound/[id]/labels">) {
  const { id } = await props.params;
  const sh = await getShipment(Number(id));
  if (!sh) notFound();
  const qrs = await Promise.all(sh.pallets.map((p) => QRCode.toDataURL(p.code, { margin: 0, width: 360, errorCorrectionLevel: "H" })));
  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ href: `/inbound/${sh.id}`, label: sh.reference }}
          title={`${sh.pallets.length} labels · ${sh.customer.name}`}
          subtitle="4 × 6 in, one per page. The QR holds the pallet code only, so any phone or scanner can read it. Large print for the camera at the dock."
          actions={
            <>
              <form action={labelsPrinted}><input type="hidden" name="id" value={sh.id} /><Button variant="secondary">Mark as printed</Button></form>
              <PrintButton label="Print labels" />
            </>
          }
        />
      </div>
      <div className="label-sheet grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sh.pallets.map((p, i) => (
          <div key={p.id} className="label rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200" style={{ aspectRatio: "4 / 6" }}>
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{sh.customer.name}</div>
                  <div className="text-xs text-slate-500">Ref {sh.reference}{sh.containerNumber ? ` · ${sh.containerNumber}` : ""}</div>
                </div>
                <div className="rounded-md bg-slate-900 px-2 py-1 text-xs font-bold text-white">{p.sequence ?? i + 1} / {sh.pallets.length}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrs[i]} alt={p.code} className="mx-auto my-4 w-[62%]" />
              <div className="text-center font-mono text-2xl font-bold tracking-wide">{p.code}</div>
              {p.lotNumber && <div className="text-center font-mono text-sm text-slate-600">lot {p.lotNumber}</div>}
              <div className="mt-auto space-y-0.5 text-center text-xs text-slate-600">
                <div className="text-3xl font-black text-slate-900">{sh.customer.code}</div>
                <div>{p.description ?? " "}</div>
                <div>ETA {fmtDate(sh.expectedAt)} · {sh.isCrossDock ? "SAME DAY OUT" : sh.bonded ? "IN BOND" : `stay ~${sh.expectedStayDays ?? "?"} d`}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
