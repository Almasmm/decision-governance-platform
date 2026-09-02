// Индекс зрелости процесса — всегда с контекстом расчёта и обязательной пометкой.
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ru } from "@/lib/i18n/ru";
import type { MaturityResult } from "@/lib/maturity";
import { cn } from "@/lib/utils";

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
      <Card>
        <CardHeader>
          <CardTitle>Индекс зрелости процесса</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-warn">
            {ru.common.notEnoughData}: нет измерений KPI пилотной выборки.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Индекс зрелости процесса принятия решений</CardTitle>
        <Badge variant="warn">{ru.demoBadge}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-3xl font-bold tabular-nums text-brand">{result.index.toFixed(2)}</div>
            <div className="text-xs text-slate-500">из 5.00</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-brand">
              Уровень {result.levelNumber} — {ru.maturityLevels[result.levelNumber]}
            </div>
            {baseline && (
              <div className="text-xs text-slate-600">
                Базовая выборка: {baseline.index.toFixed(2)} — уровень {baseline.levelNumber} (
                {ru.maturityLevels[baseline.levelNumber]})
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <div
              key={lvl}
              className={cn(
                "flex-1 rounded px-1.5 py-1 text-center text-[10px]",
                lvl <= result.levelNumber ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              {lvl} {ru.maturityLevels[lvl]}
            </div>
          ))}
        </div>

        <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
          <div className="flex gap-1">
            <dt className="text-slate-500">{ru.common.sampleSize}:</dt>
            <dd>{result.totalSampleSize} наблюдений</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-slate-500">{ru.common.period}:</dt>
            <dd>
              {periodNote ??
                (result.periodFrom && result.periodTo
                  ? `${format(result.periodFrom, "d MMM yyyy", { locale: ruLocale })} – ${format(result.periodTo, "d MMM yyyy", { locale: ruLocale })}`
                  : "не указан")}
            </dd>
          </div>
        </dl>

        {!compact && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-brand-accent">
              Учтённые KPI ({result.usedMetrics.length})
            </summary>
            <ul className="mt-1 space-y-0.5">
              {result.usedMetrics.map((m) => (
                <li key={m.code} className="flex justify-between gap-3 text-[11px] text-slate-600">
                  <span>{m.name}</span>
                  <span className="tabular-nums">норм. {m.normalized.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-brand-warn">
          {result.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
