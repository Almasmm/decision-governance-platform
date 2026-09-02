import { ArrowRight, LockKeyhole, RotateCcw } from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import type { Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface DecisionFlowDatum {
  stage: Stage;
  count: number;
  /** Решения, остановленные gate перед следующей стадией. */
  blocked?: number;
  /** Сколько возвратов накопили решения на этой стадии. */
  returns?: number;
}

function pluralRu(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/**
 * Семь стадий как единый управленческий поток. Количество показано масштабом
 * внутреннего трека, а friction — явным lock/return marker, поэтому смысл не
 * зависит только от цвета. На tablet ось складывается в схему 4 + 3.
 */
export function StageFunnel({ data }: { data: DecisionFlowDatum[] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <figure aria-label="Распределение активных решений по семи стадиям жизненного цикла">
      <ol className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-4 xl:grid-cols-7 xl:gap-x-5">
        {data.map((item, index) => {
          const blocked = item.blocked ?? 0;
          const returns = item.returns ?? 0;
          const hasFriction = blocked > 0 || returns > 0;
          const next = data[index + 1];
          const width = item.count === 0 ? 0 : Math.max(14, Math.round((item.count / maxCount) * 100));

          return (
            <li
              key={item.stage}
              className={cn(
                "relative min-w-0 border-t-2 pt-3",
                blocked > 0 ? "border-signal" : "border-rule-strong"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-technical text-meta text-ink-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {index < data.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-4 -top-[9px] hidden h-4 w-4 bg-sheet xl:block",
                      blocked > 0 ? "text-signal" : "text-rule-strong"
                    )}
                  />
                )}
              </div>

              <h3 className="mt-2 min-h-10 font-ui text-base font-semibold text-ink">
                {ru.stages[item.stage]}
              </h3>
              <div className="mt-2 flex items-end gap-1.5">
                <strong className="text-section font-semibold tabular-nums text-ink">{item.count}</strong>
                <span className="pb-0.5 text-meta text-ink-muted">
                  {pluralRu(item.count, "решение", "решения", "решений")}
                </span>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden bg-paper" aria-hidden="true">
                <div
                  className={cn("h-full", blocked > 0 ? "bg-signal" : "bg-graphite")}
                  style={{ width: `${width}%` }}
                />
              </div>

              {next ? (
                <div className="mt-2 min-h-9 text-meta leading-4">
                  {blocked > 0 ? (
                    <span className="inline-flex items-start gap-1 text-signal">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {blocked} {pluralRu(blocked, "решение заблокировано", "решения заблокированы", "решений заблокировано")}
                    </span>
                  ) : returns > 0 ? (
                    <span className="inline-flex items-start gap-1 text-signal">
                      <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {returns} {pluralRu(returns, "возврат", "возврата", "возвратов")} на доработку
                    </span>
                  ) : (
                    <span className="text-ink-muted">Ворота к стадии «{ru.stages[next.stage]}» без блокировок</span>
                  )}
                </div>
              ) : (
                <p className="mt-2 min-h-9 text-meta leading-4 text-ink-muted">
                  План → факт → извлечённый урок
                </p>
              )}

              {hasFriction && blocked > 0 && returns > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-meta text-ink-muted">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Возвратов: {returns}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-rule pt-3 text-meta text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-graphite" aria-hidden="true" />
          количество решений на стадии
        </span>
        <span className="inline-flex items-center gap-1.5 text-signal">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          управленческое трение: закрытые контрольные ворота
        </span>
      </figcaption>
    </figure>
  );
}
