import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { NavLink } from "@/components/nav-link";
import type { Role } from "@/lib/domain";

const NAV: Array<{ href: string; key: keyof typeof ru.nav; roles?: Role[] }> = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/decisions", key: "decisions" },
  { href: "/indicators", key: "indicators" },
  { href: "/kpi", key: "kpi" },
  { href: "/models", key: "models" },
  { href: "/lessons", key: "lessons" },
  { href: "/boards", key: "boards" },
  { href: "/roadmap", key: "roadmap" },
  { href: "/audit", key: "audit" },
  { href: "/admin", key: "admin", roles: ["ADMIN"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-brand text-sm font-bold text-white">DP</div>
            <div>
              <div className="text-sm font-bold leading-4 text-brand">{ru.appName}</div>
              <div className="text-[10px] text-slate-500">{ru.org}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.href} href={n.href}>
              {ru.nav[n.key]}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <Badge variant="warn">{ru.demoBadge}</Badge>
          <p className="mt-1 text-[10px] leading-3 text-slate-400">
            Цифры внутри решений синтетические; публичные показатели — из годового отчёта 2025.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-brand px-5 py-2 text-white">
          <div className="text-sm font-medium">{ru.appSubtitle}</div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium leading-4">{user.name}</div>
              <div className="text-[11px] text-slate-300">{ru.roles[user.role]}</div>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-slate-50 p-5">{children}</main>
      </div>
    </div>
  );
}
