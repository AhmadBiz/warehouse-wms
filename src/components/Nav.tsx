"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Map, ArrowDownToLine, ScanLine, Package, ArrowUpFromLine, Users, ShieldCheck, Grid3X3, Globe, Inbox,
} from "lucide-react";
import { cn } from "@/lib/format";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Map },
  { href: "/inbound", label: "Inbound", icon: ArrowDownToLine },
  { href: "/inbox", label: "Email inbox", icon: Inbox },
  { href: "/dock", label: "Dock", icon: ScanLine },
  { href: "/pallets", label: "Pallets", icon: Package },
  { href: "/outbound", label: "Outbound", icon: ArrowUpFromLine },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/customs", label: "Customs", icon: ShieldCheck },
  { href: "/locations", label: "Locations", icon: Grid3X3 },
  { href: "/portal", label: "Customer portal", icon: Globe },
];

const mobile = ["/", "/map", "/dock", "/outbound", "/pallets"];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-slate-900 text-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="text-white font-semibold text-lg tracking-tight">Warehouse OS</div>
          <div className="text-xs text-slate-400 mt-0.5">Saint-Laurent · 5020 Courval</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors",
                active(it.href) ? "bg-slate-800 text-white font-medium" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              )}
            >
              <it.icon className="h-4 w-4 opacity-80" />
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-slate-500 border-t border-slate-800">Demo build · data resets with <code>npm run db:reset</code></div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 text-slate-300 border-t border-slate-800 flex justify-around">
        {items.filter((i) => mobile.includes(i.href)).map((it) => (
          <Link key={it.href} href={it.href} className={cn("flex flex-col items-center gap-0.5 px-3 py-2 text-[11px]", active(it.href) ? "text-white" : "")}>
            <it.icon className="h-5 w-5" />
            {it.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
