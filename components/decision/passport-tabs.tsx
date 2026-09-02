import Link from "next/link";
import { cn } from "@/lib/utils";

export const PASSPORT_TABS = [
  { key: "passport", label: "Паспорт" },
  { key: "alternatives", label: "Альтернативы" },
  { key: "risks", label: "Риски" },
  { key: "economics", label: "Экономика" },
  { key: "assignments", label: "Поручения" },
  { key: "ai", label: "ИИ-помощник" },
  { key: "audit", label: "Аудит" },
] as const;

export type PassportTabKey = (typeof PASSPORT_TABS)[number]["key"];

export function PassportTabs({ decisionId, active }: { decisionId: string; active: string }) {
  return (
    <nav className="flex flex-wrap gap-0.5 border-b border-slate-200" aria-label="Разделы паспорта">
      {PASSPORT_TABS.map((t) => (
        <Link
          key={t.key}
          href={`/decisions/${decisionId}?tab=${t.key}`}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            active === t.key
              ? "border-brand-accent font-semibold text-brand"
              : "border-transparent text-slate-600 hover:text-brand"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
