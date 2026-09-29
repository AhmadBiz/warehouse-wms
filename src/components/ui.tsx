import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link href={back.href} className="text-xs text-slate-500 hover:text-slate-800">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions, padded = true }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={cn("rounded-xl bg-white shadow-sm ring-1 ring-slate-200", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const tones = { default: "text-slate-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-red-700" };
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

type BadgeTone = "slate" | "blue" | "green" | "amber" | "red" | "violet" | "pink" | "teal";
const badgeTones: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Badge({ children, tone = "slate", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", badgeTones[tone], className)}>{children}</span>;
}

const statusTone: Record<string, BadgeTone> = {
  ANNOUNCED: "slate", SCHEDULED: "blue", ARRIVED: "amber", RECEIVING: "amber", RECEIVED: "green", CLOSED: "slate",
  EXPECTED: "slate", STORED: "green", ALLOCATED: "violet", PICKED: "amber", SHIPPED: "slate",
  REQUESTED: "amber", PLANNED: "blue", PICKING: "violet", CANCELLED: "red",
  NEW: "blue", PARSED: "teal", NEEDS_REVIEW: "amber", LINKED: "green", IGNORED: "slate", PENDING: "slate",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "slate"}>{status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function Button({ children, href, variant = "primary", className, type = "submit", size = "md", ...rest }: {
  children: ReactNode; href?: string; variant?: "primary" | "secondary" | "danger" | "ghost"; className?: string; type?: "submit" | "button"; size?: "md" | "lg" | "sm";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-3 text-base touch-btn" };
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-900",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400",
    danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-600",
    ghost: "text-slate-700 hover:bg-slate-100",
  };
  const cls = cn(base, sizes[size], variants[variant], className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} className={cls} {...rest}>{children}</button>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <th className={cn("px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100 whitespace-nowrap", right && "text-right", className)}>{children}</th>;
}
export function Td({ children, className, right, mono, colSpan }: { children?: ReactNode; className?: string; right?: boolean; mono?: boolean; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("px-4 py-2.5 border-b border-slate-50 align-middle", right && "text-right tabular-nums", mono && "font-mono text-xs", className)}>{children}</td>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
export const inputLg = "block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export function CustomerDot({ color, name }: { color: string; name?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: color }} />
      {name}
    </span>
  );
}

export function Alert({ tone = "amber", children, title, className }: { tone?: "amber" | "red" | "blue" | "green"; children: ReactNode; title?: ReactNode; className?: string }) {
  const t = {
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    red: "bg-red-50 text-red-900 ring-red-200",
    blue: "bg-blue-50 text-blue-900 ring-blue-200",
    green: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  }[tone];
  return (
    <div className={cn("rounded-lg px-4 py-3 text-sm ring-1 ring-inset", t, className)}>
      {title && <div className="font-semibold">{title}</div>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}
