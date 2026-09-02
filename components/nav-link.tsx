"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  Boxes,
  ChartNoAxesCombined,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  Route,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  "/dashboard": LayoutDashboard,
  "/decisions": FileText,
  "/indicators": Gauge,
  "/kpi": ChartNoAxesCombined,
  "/models": Boxes,
  "/lessons": BookOpenCheck,
  "/boards": Landmark,
  "/roadmap": Route,
  "/audit": ScrollText,
  "/admin": Settings,
} as const;

export function NavLink({
  href,
  context,
  children,
}: {
  href: string;
  context?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  const Icon = ICONS[href as keyof typeof ICONS];
  const label = typeof children === "string" ? children : "Раздел";

  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 w-full items-center justify-center rounded transition-colors duration-150",
        active
          ? "bg-paper text-graphite"
          : "text-rule-strong hover:bg-graphite-soft hover:text-paper"
      )}
    >
      {active && <span className="absolute -left-2 h-6 w-0.5 bg-paper" aria-hidden="true" />}
      {Icon && <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />}
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 w-max max-w-72 -translate-y-1/2 rounded border border-rule bg-sheet px-3 py-2 text-left text-ink opacity-0 shadow-overlay transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="block text-base font-semibold">{label}</span>
        {context && <span className="mt-0.5 block text-meta text-ink-muted">{context}</span>}
      </span>
    </Link>
  );
}
