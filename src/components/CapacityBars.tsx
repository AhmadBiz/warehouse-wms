import type { ZoneCapacity } from "@/lib/capacity";

export function CapacityBars({ zones }: { zones: ZoneCapacity[] }) {
  return (
    <div className="space-y-3">
      {zones.map((z) => {
        const occ = z.positions ? (z.occupied / z.positions) * 100 : 0;
        const res = z.positions ? (z.reserved / z.positions) * 100 : 0;
        return (
          <div key={z.zone.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: z.zone.color }} />
                {z.zone.name}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {z.occupied} stored{z.reserved ? ` + ${z.reserved} announced` : ""} · <span className="font-medium text-slate-800">{z.free} free</span> of {z.positions}
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div style={{ width: `${occ}%`, background: z.zone.color }} />
              <div style={{ width: `${res}%`, background: z.zone.color, opacity: 0.35 }} />
            </div>
          </div>
        );
      })}
      <div className="text-xs text-slate-400">Solid = stored, faded = announced and not yet received. A position holds one pallet; floor spots count two when pallets can stack.</div>
    </div>
  );
}
