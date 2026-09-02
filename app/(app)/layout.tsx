import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { LogoutButton } from "@/components/logout-button";
import { NavLink } from "@/components/nav-link";
import { ContextBar } from "@/components/app-shell/context-bar";
import type { Role } from "@/lib/domain";

const NAV: Array<{
  title: string;
  items: Array<{ href: string; key: keyof typeof ru.nav; roles?: Role[] }>;
}> = [
  {
    title: "Контур решений",
    items: [
      { href: "/dashboard", key: "dashboard" },
      { href: "/decisions", key: "decisions" },
    ],
  },
  {
    title: "Доказательная база",
    items: [{ href: "/indicators", key: "indicators" }],
  },
  {
    title: "Аналитика и интеллект",
    items: [
      { href: "/kpi", key: "kpi" },
      { href: "/models", key: "models" },
    ],
  },
  {
    title: "Контроль и обучение",
    items: [
      { href: "/lessons", key: "lessons" },
      { href: "/boards", key: "boards" },
      { href: "/roadmap", key: "roadmap" },
      { href: "/audit", key: "audit" },
    ],
  },
  {
    title: "Система",
    items: [{ href: "/admin", key: "admin", roles: ["ADMIN"] }],
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-paper">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-base focus:font-semibold focus:text-text focus:shadow-overlay"
      >
        Перейти к основному содержимому
      </a>
      <aside className="sticky top-0 z-40 flex h-screen w-[72px] shrink-0 flex-col border-r border-graphite-line bg-graphite xl:w-20">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-graphite-line">
          <div
            className="group relative flex h-11 w-11 items-center justify-center rounded border border-graphite-line font-technical text-base font-bold tracking-tight text-paper"
            aria-label={ru.appName}
            tabIndex={0}
          >
            DP
            <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 w-max -translate-y-1/2 rounded bg-ink px-2.5 py-1.5 text-meta font-normal text-sheet opacity-0 shadow-overlay transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
              {ru.appName}
            </span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col px-2 py-2" aria-label="Основная навигация">
          {NAV.map((group, index) => {
            const items = group.items.filter((item) => !item.roles || item.roles.includes(user.role));
            if (items.length === 0) return null;
            return (
              <section
                key={group.title}
                aria-label={group.title}
                className={index === 0 ? "pb-1.5" : "border-t border-graphite-line py-1.5"}
              >
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink key={item.href} href={item.href} context={group.title}>
                      {ru.nav[item.key]}
                    </NavLink>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-graphite-line px-2 py-2">
          <div
            className="group relative mx-auto flex h-11 w-11 items-center justify-center rounded border border-graphite-line bg-graphite-soft font-semibold text-paper"
            tabIndex={0}
            aria-label={`${user.name}, ${ru.roles[user.role]}`}
          >
            {initials(user.name)}
            <div className="pointer-events-none absolute bottom-0 left-[calc(100%+12px)] z-50 w-64 rounded border border-rule bg-sheet p-3 text-left text-ink opacity-0 shadow-overlay transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
              <p className="text-base font-semibold">{user.name}</p>
              <p className="mt-0.5 text-meta text-ink-muted">Полномочие: {ru.roles[user.role]}</p>
              <p className="mt-2 text-meta text-ink-muted">{ru.org}</p>
            </div>
          </div>
          <LogoutButton compact className="mx-auto mt-1" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <ContextBar userName={user.name} roleLabel={ru.roles[user.role]} />
        <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
