import Link from "next/link";
import { cn } from "@/lib/utils";

export const PASSPORT_TABS = [
  { key: "passport", label: "Доказательная база" },
  { key: "alternatives", label: "Альтернативы" },
  { key: "risks", label: "Риски" },
  { key: "economics", label: "Экономика" },
  { key: "assignments", label: "Исполнение" },
  { key: "ai", label: "Аналитика ИИ" },
  { key: "audit", label: "Аудит" },
] as const;

export type PassportTabKey = (typeof PASSPORT_TABS)[number]["key"];

export function PassportTabs({ decisionId, active }: { decisionId: string; active: string }) {
  return (
    <nav className="overflow-x-auto border-b border-line" aria-label="Разделы досье решения">
      <div className="flex min-w-max items-center gap-6 px-1">
        {PASSPORT_TABS.map((tab) => {
          const selected = active === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/decisions/${decisionId}?tab=${tab.key}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 items-center whitespace-nowrap border-b-2 px-0.5 text-table font-medium transition-colors",
                selected
                  ? "border-obsidian text-obsidian"
                  : "border-transparent text-muted hover:border-line hover:text-text"
              )}
            >
              {tab.label}
              {selected && <span className="sr-only">, текущий раздел</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
