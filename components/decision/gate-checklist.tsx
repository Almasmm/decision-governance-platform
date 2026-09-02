// Чек-лист контрольных ворот: зелёные/красные пункты, что именно не хватает
// и кто по роли должен это заполнить.
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { ruleDescription, type GateRuleResult } from "@/lib/gates";
import { ru } from "@/lib/i18n/ru";
import type { Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function GateChecklist({
  results,
  fromStage,
  toStage,
  allowed,
  className,
}: {
  results: GateRuleResult[];
  fromStage: Stage;
  toStage: Stage;
  allowed: boolean;
  className?: string;
}) {
  const failed = results.filter((r) => !r.passed);
  return (
    <div className={cn("rounded border border-slate-200 bg-white", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-brand">
            <ShieldCheck className="h-4 w-4" />
            Контрольные ворота: {ru.stages[fromStage]} → {ru.stages[toStage]}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Ворота не принимают решение — они проверяют полноту доказательной базы.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-2 py-1 text-xs font-semibold",
            allowed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-brand-warn"
          )}
        >
          {allowed ? "Ворота открыты" : `Не выполнено: ${failed.length} из ${results.length}`}
        </span>
      </div>

      {results.length === 0 ? (
        <p className="px-4 py-3 text-xs text-slate-500">
          Для этого перехода на уровне критичности решения обязательных правил не задано — переход
          разрешён.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {results.map((r) => (
            <li key={r.code} className="flex gap-2.5 px-4 py-2.5">
              {r.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-warn" />
              )}
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium",
                    r.passed ? "text-slate-700" : "text-slate-900"
                  )}
                >
                  {ruleDescription(r.code)}
                </div>
                <p className={cn("mt-0.5 text-xs", r.passed ? "text-slate-500" : "text-brand-warn")}>
                  {r.explanation}
                </p>
                {!r.passed && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Ответственный за заполнение: <span className="font-medium">{r.responsible}</span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
