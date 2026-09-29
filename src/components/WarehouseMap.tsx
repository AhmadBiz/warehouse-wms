"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/format";

export type MapZone = { id: number; code: string; name: string; kind: string; color: string; x: number; y: number; w: number; h: number };
export type MapLocation = { id: number; code: string; kind: string; zoneId: number; lane: number | null; depth: number | null; row: string | null; bay: number | null; level: number | null; maxStack: number; x: number; y: number; w: number; h: number };
export type MapPallet = {
  id: number; code: string; locationId: number; stackLevel: number; customerId: number; customerName: string; customerColor: string; status: string;
  daysIn: number; leavesIn: number; confirmed: boolean; description: string | null; cartons: number | null;
};

type Mode = "customer" | "leave" | "zone";

const SCALE = 5; // px per foot

function leaveColor(days: number) {
  if (days < 0) return "#dc2626"; // overdue
  if (days <= 1) return "#f59e0b"; // leaves today/tomorrow
  if (days <= 7) return "#3b82f6";
  return "#64748b";
}

export function WarehouseMap({ width, depth, outline, zones, locations, pallets, highlightLocationIds = [], highlightLabel, compact = false, initialMode = "customer" }: {
  width: number; depth: number; outline?: [number, number][]; zones: MapZone[]; locations: MapLocation[]; pallets: MapPallet[];
  highlightLocationIds?: number[]; highlightLabel?: string; compact?: boolean; initialMode?: Mode;
}) {
  const outlinePath = (outline && outline.length >= 3 ? outline : [[0, 0], [width, 0], [width, depth], [0, depth]])
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x * SCALE} ${y * SCALE}`)
    .join(" ") + " Z";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selected, setSelected] = useState<number | null>(highlightLocationIds[0] ?? null);
  const [query, setQuery] = useState("");

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const byLoc = useMemo(() => {
    const m = new Map<number, MapPallet[]>();
    for (const p of pallets) {
      const arr = m.get(p.locationId) ?? [];
      arr.push(p);
      m.set(p.locationId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.stackLevel - b.stackLevel);
    return m;
  }, [pallets]);

  // Rack bays: group the 3 levels of a bay into one cell
  const rackBays = useMemo(() => {
    const m = new Map<string, MapLocation[]>();
    for (const l of locations) {
      if (l.kind !== "RACK") continue;
      const k = `${l.row}-${l.bay}`;
      const arr = m.get(k) ?? [];
      arr.push(l);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    return [...m.values()];
  }, [locations]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    const set = new Set<number>();
    for (const p of pallets) if (p.code.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)) set.add(p.locationId);
    for (const l of locations) if (l.code.toLowerCase() === q) set.add(l.id);
    return set;
  }, [q, pallets, locations]);
  const highlight = new Set(highlightLocationIds);

  const fillFor = (loc: MapLocation, ps: MapPallet[]) => {
    if (!ps.length) return "#ffffff";
    const p = ps[ps.length - 1];
    if (mode === "customer") return p.customerColor;
    if (mode === "leave") return leaveColor(Math.min(...ps.map((x) => x.leavesIn)));
    return zoneById.get(loc.zoneId)?.color ?? "#94a3b8";
  };
  const dim = (loc: MapLocation) => (matches ? !matches.has(loc.id) : highlight.size ? !highlight.has(loc.id) && selected !== loc.id : false);

  const sel = selected != null ? locations.find((l) => l.id === selected) ?? null : null;
  const selPallets = sel ? byLoc.get(sel.id) ?? [] : [];
  const selZone = sel ? zoneById.get(sel.zoneId) : null;

  const customersInView = useMemo(() => {
    const m = new Map<number, { name: string; color: string; n: number }>();
    for (const p of pallets) {
      const e = m.get(p.customerId) ?? { name: p.customerName, color: p.customerColor, n: 0 };
      e.n++;
      m.set(p.customerId, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [pallets]);

  return (
    <div className={cn("grid gap-4", compact ? "" : "2xl:grid-cols-[1fr_300px]")}>
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        {!compact && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a pallet, customer or spot…" className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none" />
            <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5 text-xs">
              {(["customer", "leave", "zone"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-3 py-1 capitalize", mode === m ? "bg-white shadow-sm text-slate-900" : "text-slate-500")}>
                  {m === "leave" ? "Leaving when" : m === "customer" ? "By customer" : "By zone"}
                </button>
              ))}
            </div>
          </div>
        )}
        <svg viewBox={`-30 -36 ${width * SCALE + 44} ${depth * SCALE + 66}`} className="w-full h-auto select-none" style={{ maxHeight: compact ? 380 : 820 }}>
          {/* Building outline */}
          <path d={outlinePath} fill="#f8fafc" stroke="#94a3b8" strokeWidth={3} strokeLinejoin="round" />
          {/* Compass + dimensions */}
          <text x={width * SCALE / 2} y={-24} fontSize={10} fill="#94a3b8" textAnchor="middle">north wall · {(width / 3.28084).toFixed(1)} m</text>
          <text x={width * SCALE + 8} y={depth * SCALE / 2} fontSize={10} fill="#94a3b8" transform={`rotate(90 ${width * SCALE + 8} ${depth * SCALE / 2})`} textAnchor="middle">east wall · docks · {(depth / 3.28084).toFixed(1)} m</text>
          {/* Zones */}
          {zones.map((z) => {
            const solid = z.kind === "OFFICE" || z.kind === "DOCK" || z.kind === "SCALE";
            const fill = z.kind === "OFFICE" ? "#e2e8f0" : z.kind === "DOCK" ? "#cbd5e1" : z.kind === "SCALE" ? "#1e293b" : z.color;
            const cx = (z.x + z.w / 2) * SCALE, cy = (z.y + z.h / 2) * SCALE;
            return (
              <g key={z.id}>
                <rect x={z.x * SCALE} y={z.y * SCALE} width={z.w * SCALE} height={z.h * SCALE} fill={fill} fillOpacity={solid ? 1 : 0.07} stroke={z.color} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray={z.kind === "BONDED" ? "6 4" : undefined} rx={3} />
                {z.kind === "DOCK" ? null : z.kind === "SCALE" ? (
                  <text x={cx} y={cy + 3} fontSize={8} fontWeight={700} fill="#fff" textAnchor="middle">SCALE</text>
                ) : z.kind === "OFFICE" ? (
                  <text x={cx} y={cy + 4} fontSize={12} fontWeight={600} fill="#64748b" textAnchor="middle">Office</text>
                ) : z.y + z.h > depth - 2 ? (
                  <text x={z.x * SCALE + 4} y={(z.y + z.h) * SCALE + 14} fontSize={12} fontWeight={600} fill={z.color}>{z.name}</text>
                ) : (
                  <text x={z.x * SCALE + 4} y={z.y * SCALE - 15} fontSize={12} fontWeight={600} fill={z.color}>{z.name}</text>
                )}
              </g>
            );
          })}
          {/* Doors */}
          {locations.filter((l) => l.kind === "DOOR").map((l) => (
            <g key={l.id}>
              <rect x={l.x * SCALE} y={l.y * SCALE} width={l.w * SCALE} height={l.h * SCALE} fill="#0f172a" rx={2} />
              <text x={(l.x + l.w / 2) * SCALE} y={(l.y + l.h / 2) * SCALE + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">{l.code}</text>
            </g>
          ))}
          {/* Floor positions */}
          {locations.filter((l) => l.kind === "FLOOR").map((l) => {
            const ps = byLoc.get(l.id) ?? [];
            const fill = fillFor(l, ps);
            const isSel = selected === l.id;
            const hl = highlight.has(l.id);
            return (
              <g key={l.id} onClick={() => setSelected(l.id)} className="cursor-pointer" opacity={dim(l) ? 0.18 : 1}>
                <rect x={l.x * SCALE + 1} y={l.y * SCALE + 1} width={l.w * SCALE - 2} height={l.h * SCALE - 2} fill={fill} fillOpacity={ps.length ? 0.9 : 1} stroke={isSel || hl ? "#0f172a" : "#cbd5e1"} strokeWidth={isSel || hl ? 2.5 : 0.75} rx={2} />
                {ps.length >= 2 && <text x={(l.x + l.w) * SCALE - 4} y={l.y * SCALE + 11} fontSize={9} fontWeight={700} fill="#fff" textAnchor="end">×{ps.length}</text>}
                {ps.some((p) => !p.confirmed) && <circle cx={l.x * SCALE + 6} cy={l.y * SCALE + 6} r={3} fill="#dc2626" stroke="#fff" strokeWidth={1} />}
                <title>{`${l.code}${ps.length ? "\n" + ps.map((p) => `${p.code} · ${p.customerName} · ${p.daysIn}d in · leaves in ${p.leavesIn}d`).join("\n") : "\nempty"}`}</title>
              </g>
            );
          })}
          {/* Rack bays (3 levels stacked as strips) */}
          {rackBays.map((levels) => {
            const base = levels[0];
            const stripH = (base.h * SCALE - 2) / levels.length;
            const anySel = levels.some((l) => l.id === selected);
            const anyHl = levels.some((l) => highlight.has(l.id));
            const allDim = levels.every((l) => dim(l));
            return (
              <g key={base.id} className="cursor-pointer" opacity={allDim ? 0.18 : 1}>
                {levels.map((l, i) => {
                  const ps = byLoc.get(l.id) ?? [];
                  return (
                    <g key={l.id} onClick={() => setSelected(l.id)}>
                      <rect x={base.x * SCALE + 1} y={base.y * SCALE + 1 + (levels.length - 1 - i) * stripH} width={base.w * SCALE - 2} height={stripH - 0.5} fill={fillFor(l, ps)} stroke="#cbd5e1" strokeWidth={0.5} />
                      <title>{`${l.code}${ps.length ? "\n" + ps.map((p) => `${p.code} · ${p.customerName} · ${p.daysIn}d in · leaves in ${p.leavesIn}d`).join("\n") : "\nempty"}`}</title>
                    </g>
                  );
                })}
                <rect x={base.x * SCALE + 1} y={base.y * SCALE + 1} width={base.w * SCALE - 2} height={base.h * SCALE - 2} fill="none" stroke={anySel || anyHl ? "#0f172a" : "#94a3b8"} strokeWidth={anySel || anyHl ? 2.5 : 0.75} rx={1} />
              </g>
            );
          })}
          {/* Row labels: above bay 1 of each rack row */}
          {["A", "B", "C", "D", "E", "F", "G", "H"].map((row) => {
            const l = locations.find((x) => x.row === row && x.bay === 1 && x.level === 1);
            return l ? <text key={row} x={(l.x + l.w / 2) * SCALE} y={l.y * SCALE - 3} fontSize={10} fontWeight={700} fill="#64748b" textAnchor="middle">{row}</text> : null;
          })}
          {/* Lane numbers: at the front (east) end of each floor lane */}
          {locations.filter((l) => l.code.startsWith("L-") && l.depth === 1).map((l) => (
            <text key={"ln" + l.id} x={(l.x + l.w) * SCALE + 3} y={(l.y + l.h / 2) * SCALE + 3} fontSize={8} fill="#64748b" textAnchor="start">{l.lane}</text>
          ))}
          {(() => {
            const front = locations.filter((l) => l.code.startsWith("L-") && l.depth === 1);
            if (!front.length) return null;
            const x = (Math.max(...front.map((l) => l.x + l.w)) + 5.5) * SCALE;
            const y = (Math.min(...front.map((l) => l.y)) + Math.max(...front.map((l) => l.y + l.h))) / 2 * SCALE;
            return <text x={x} y={y} fontSize={9} fill="#94a3b8" textAnchor="middle" transform={`rotate(-90 ${x} ${y})`}>main aisle — lanes load from this side (depth 1 = front)</text>;
          })()}
          {highlightLabel && highlightLocationIds.length > 0 && (() => {
            const l = locations.find((x) => x.id === highlightLocationIds[0]);
            if (!l) return null;
            return (
              <g>
                <rect x={Math.min(Math.max((l.x + l.w / 2) * SCALE - 50, 0), width * SCALE - 100)} y={l.y * SCALE - 30} width={100} height={22} rx={6} fill="#0f172a" />
                <text x={Math.min(Math.max((l.x + l.w / 2) * SCALE, 50), width * SCALE - 50)} y={l.y * SCALE - 15} fontSize={12} fontWeight={700} fill="#fff" textAnchor="middle">{highlightLabel}</text>
                <path d={`M ${(l.x + l.w / 2) * SCALE - 6} ${l.y * SCALE - 8} l 6 7 l 6 -7 z`} fill="#0f172a" />
              </g>
            );
          })()}
        </svg>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {mode === "leave" ? (
            <>
              <Legend color="#dc2626" label="overdue" /><Legend color="#f59e0b" label="leaves ≤ 1 day" /><Legend color="#3b82f6" label="≤ 7 days" /><Legend color="#64748b" label="longer" />
            </>
          ) : mode === "customer" ? (
            customersInView.slice(0, 10).map((c) => <Legend key={c.name} color={c.color} label={`${c.name} (${c.n})`} />)
          ) : (
            zones.filter((z) => !["DOCK", "OFFICE"].includes(z.kind)).map((z) => <Legend key={z.id} color={z.color} label={z.name} />)
          )}
          <span className="ml-auto flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-600" /> spot not confirmed</span>
          <span>×2 = two pallets stacked</span>
        </div>
      </div>

      {!compact && (
        <aside className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 text-sm">
          {sel ? (
            <>
              <div className="flex items-baseline justify-between">
                <div className="font-mono text-lg font-semibold">{sel.code}</div>
                <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-700">clear</button>
              </div>
              <div className="text-xs text-slate-500">{selZone?.name}{sel.kind === "RACK" ? ` · row ${sel.row}, bay ${sel.bay}, level ${sel.level}` : sel.lane != null ? ` · lane ${sel.lane}, depth ${sel.depth}` : ""} · holds {sel.maxStack}</div>
              {selPallets.length === 0 ? (
                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-center text-slate-500">Empty</div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {selPallets.map((p) => (
                    <li key={p.id} className="rounded-lg ring-1 ring-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <Link href={`/pallets/${p.id}`} className="font-mono text-xs font-semibold hover:underline">{p.code}</Link>
                        {p.stackLevel > 1 && <span className="text-[10px] uppercase text-slate-500">on top</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.customerColor }} />{p.customerName}</div>
                      <div className="text-xs text-slate-500">{p.description ?? ""}{p.cartons ? ` · ${p.cartons} cartons` : ""}</div>
                      <div className="mt-1 text-xs text-slate-500">{p.daysIn} d in · {p.leavesIn < 0 ? <span className="text-red-700">{-p.leavesIn} d overdue</span> : `leaves in ${p.leavesIn} d`} · {p.confirmed ? "confirmed" : <span className="text-red-700">not confirmed</span>}</div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="font-semibold">Click any spot</div>
              <p className="mt-1 text-slate-500">See which pallets are there, how long they have been in, and when they leave. Search above to light up a customer or a pallet.</p>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">In storage</div>
              <ul className="mt-2 space-y-1">
                {customersInView.map((c) => (
                  <li key={c.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span>
                    <span className="tabular-nums text-slate-500">{c.n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
