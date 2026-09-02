// Авторская шкала зрелости процесса — continuous 1–5 с обязательным контекстом.
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ru } from "@/lib/i18n/ru";
import type { MaturityResult } from "@/lib/maturity";
import { cn } from "@/lib/utils";

const LEVELS = [1, 2, 3, 4, 5] as const;

function continuumPosition(index: number): number {
  return Math.max(0, Math.min(100, ((index - 1) / 4) * 100));
}

export function MaturityCard({
  result,
  periodNote,
  baseline,
  compact = false,
}: {
  result: MaturityResult | null;
  periodNote: string | null;
  baseline?: MaturityResult | null;
  compact?: boolean;
}) {
  if (!result) {
    return (
      <section className="border-y border-rule bg-sheet px-4 py-4">
        <h2 className="font-ui text-section font-semibold text-ink">Зрелость процесса</h2>
        <p className="mt-2 text-base text-signal">
          {ru.common.notEnoughData}: нет измерений KPI пилотной выборки.
        </p>
      </section>
    );
  }

  const currentPosition = continuumPosition(result.index);
  const baselinePosition = baseline ? continuumPosition(baseline.index) : null;
  const period =
    periodNote ??
    (result.periodFrom && result.periodTo
      ? `${format(result.periodFrom, "d MMM yyyy", { locale: ruLocale })} – ${format(result.periodTo, "d MMM yyyy", { locale: ruLocale })}`
      : "не указан");

  return (
    <section className="border-y border-rule bg-sheet" aria-labelledby="maturity-title">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <h2 id="maturity-title" className="font-ui text-section font-semibold text-ink">
            Зрелость процесса принятия решений
          </h2>
          <p className="mt-0.5 text-meta text-ink-muted">Авторская шкала 1–5 · пилотная оценка</p>
        </div>
        <Badge variant="technical">{ru.demoBadge}</Badge>
      </header>

      <div className={cn("border-t border-rule px-4 py-4 sm:px-5", compact ? "pb-4" : "sm:py-5")}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <strong className="text-hero font-semibold tabular-nums text-ink">
              {result.index.toFixed(2)}
            </strong>
            <div className="pb-1">
              <p className="text-base font-semibold text-ink">
                Уровень {result.levelNumber} · {ru.maturityLevels[result.levelNumber]}
              </p>
              <p className="text-meta text-ink-muted">из 5.00</p>
            </div>
          </div>
          {baseline && (
            <p className="text-meta text-ink-muted">
              Базовая выборка: <strong className="font-semibold tabular-nums text-ink">{baseline.index.toFixed(2)}</strong>
            </p>
          )}
        </div>

        <div
          className="relative mt-10 px-1"
          role="img"
          aria-label={`Шкала зрелости от 1 до 5. Текущее значение ${result.index.toFixed(2)}, уровень ${result.levelNumber} — ${ru.maturityLevels[result.levelNumber]}.`}
        >
          <div className="relative h-1 bg-rule-strong">
            <span
              className="absolute inset-y-0 left-0 bg-graphite"
              style={{ width: `${currentPosition}%` }}
              aria-hidden="true"
            />
            {baselinePosition !== null && (
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-graphite bg-sheet"
                style={{ left: `${baselinePosition}%` }}
                title={`Базовая выборка: ${baseline?.index.toFixed(2)}`}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "absolute -top-7 whitespace-nowrap font-technical text-meta font-semibold text-ink",
                currentPosition < 12
                  ? "translate-x-0"
                  : currentPosition > 88
                    ? "-translate-x-full"
                    : "-translate-x-1/2"
              )}
              style={{ left: `${currentPosition}%` }}
              aria-hidden="true"
            >
              PILOT {result.index.toFixed(2)}
            </span>
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-graphite"
              style={{ left: `${currentPosition}%` }}
              aria-hidden="true"
            />
          </div>

          <ol className="mt-3 grid grid-cols-5 gap-1">
            {LEVELS.map((level) => (
              <li
                key={level}
                className={cn(
                  "relative min-w-0 text-center text-meta",
                  level === result.levelNumber ? "font-semibold text-ink" : "text-ink-muted"
                )}
              >
                <span className="mx-auto mb-1 block h-2 w-px bg-rule-strong" aria-hidden="true" />
                <span className="block font-technical">{level}</span>
                <span className="hidden leading-4 sm:block">{ru.maturityLevels[level]}</span>
              </li>
            ))}
          </ol>
        </div>

        <dl className="mt-5 grid gap-x-5 gap-y-2 border-t border-rule pt-3 text-meta sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">Пилотная выборка</dt>
            <dd className="mt-0.5 font-medium text-ink">n = {result.totalSampleSize}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Учтено показателей</dt>
            <dd className="mt-0.5 font-medium text-ink">{result.usedMetrics.length} KPI</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Период</dt>
            <dd className="mt-0.5 font-medium text-ink">{period}</dd>
          </div>
        </dl>

        {!compact && (
          <details className="mt-3 border-t border-rule pt-3">
            <summary className="cursor-pointer text-meta font-medium text-graphite">
              Методика и учтённые KPI ({result.usedMetrics.length})
            </summary>
            <ul className="mt-2 divide-y divide-rule">
              {result.usedMetrics.map((metric) => (
                <li key={metric.code} className="flex justify-between gap-4 py-1.5 text-meta text-ink-muted">
                  <span>{metric.name}</span>
                  <span className="shrink-0 font-technical tabular-nums text-ink">
                    норм. {metric.normalized.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-3 border-l-2 border-rule-strong pl-3 text-meta font-medium text-ink">
          {result.disclaimer}
        </p>
      </div>
    </section>
  );
}
