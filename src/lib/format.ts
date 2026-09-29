export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const DAY_MS = 86_400_000;

export function daysBetween(a: Date | number | null | undefined, b: Date | number = Date.now()) {
  if (!a) return 0;
  const t = typeof a === "number" ? a : a.getTime();
  const u = typeof b === "number" ? b : b.getTime();
  return Math.max(0, Math.floor((u - t) / DAY_MS));
}

export function addDays(d: Date | number, days: number) {
  const t = typeof d === "number" ? d : d.getTime();
  return new Date(t + days * DAY_MS);
}

export function startOfDay(d: Date | number = Date.now()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a: Date | number | null | undefined, b: Date | number = Date.now()) {
  if (!a) return false;
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function fmtDate(d: Date | number | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", ...opts }).format(new Date(d));
}

export function fmtDateTime(d: Date | number | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(d));
}

export function fmtTime(d: Date | number | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" }).format(new Date(d));
}

export function fmtRelative(d: Date | number | null | undefined) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return mins > 0 ? `${mins} min ago` : `in ${-mins} min`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return hrs > 0 ? `${hrs} h ago` : `in ${-hrs} h`;
  const days = Math.round(hrs / 24);
  return days > 0 ? `${days} d ago` : `in ${-days} d`;
}

export function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: digits }).format(n);
}

export function fmtDims(p: { lengthIn?: number | null; widthIn?: number | null; heightIn?: number | null }) {
  if (!p.lengthIn && !p.heightIn) return "—";
  return `${p.lengthIn ?? "?"}×${p.widthIn ?? "?"}×${p.heightIn ?? "?"}"`;
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
