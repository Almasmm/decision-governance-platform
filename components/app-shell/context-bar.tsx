"use client";

import { usePathname } from "next/navigation";
import { GlobalCommand } from "@/components/app-shell/global-command";

const CONTEXTS: Array<{ match: (pathname: string) => boolean; label: string; domain: string }> = [
  { match: (p) => p === "/search", label: "Глобальный поиск", domain: "Decision intelligence" },
  { match: (p) => p === "/dashboard", label: "Управленческий контур", domain: "Портфель решений" },
  { match: (p) => p === "/decisions/new", label: "Новый паспорт", domain: "Контур решений" },
  { match: (p) => p.startsWith("/decisions/"), label: "Цифровой паспорт", domain: "Контур решений" },
  { match: (p) => p === "/decisions", label: "Реестр решений", domain: "Контур решений" },
  { match: (p) => p.startsWith("/indicators/"), label: "Происхождение показателя", domain: "Доказательная база" },
  { match: (p) => p === "/indicators", label: "Каталог показателей", domain: "Доказательная база" },
  { match: (p) => p === "/kpi", label: "Эффект и зрелость", domain: "Аналитика и интеллект" },
  { match: (p) => p === "/models", label: "Governance моделей", domain: "Аналитика и интеллект" },
  { match: (p) => p === "/lessons", label: "Обратная связь", domain: "Контроль и обучение" },
  { match: (p) => p === "/boards", label: "Органы управления", domain: "Контроль и обучение" },
  { match: (p) => p === "/roadmap", label: "Трансформация", domain: "Контроль и обучение" },
  { match: (p) => p === "/audit", label: "Хронология контроля", domain: "Контроль и обучение" },
  { match: (p) => p === "/admin", label: "Системные полномочия", domain: "Администрирование" },
];

export function ContextBar({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  const pathname = usePathname();
  const context = CONTEXTS.find((item) => item.match(pathname)) ?? {
    label: "Рабочее пространство",
    domain: "Decision intelligence",
  };

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-sheet">
      <div className="mx-auto flex min-h-16 w-full max-w-[1680px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="hidden min-w-48 lg:block">
          <p className="text-meta text-ink-muted">{context.domain}</p>
          <p className="truncate text-base font-semibold text-ink">{context.label}</p>
        </div>

        <GlobalCommand />

        <div className="ml-auto min-w-0 shrink-0 border-l border-rule pl-4 text-right">
          <p className="hidden max-w-48 truncate text-meta text-ink-muted sm:block">{userName}</p>
          <p className="max-w-44 truncate text-base font-semibold text-ink">
            <span className="hidden xl:inline">Полномочие · </span>{roleLabel}
          </p>
        </div>
      </div>
    </header>
  );
}
