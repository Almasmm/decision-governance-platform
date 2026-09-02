"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        "block rounded px-3 py-1.5 text-sm transition-colors",
        active ? "bg-brand-card font-semibold text-brand" : "text-slate-600 hover:bg-slate-100"
      )}
    >
      {children}
    </Link>
  );
}
