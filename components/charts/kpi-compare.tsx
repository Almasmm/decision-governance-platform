import { ArrowRight, CheckCircle2, CircleMinus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiComparisonDatum {
  metricCode: string;
  category: string;
  name: string;
  unit: string;
  direction: "UP" | "DOWN";
  baseline: { value: number; sampleSize: number; period: string | null } | null;
  pilot: { value: number; sampleSize: number; period: string | null } | null;
  changePercent: number | null;
}

function formatValue(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

/**
 * Paired operational comparison. Каждая пара имеет собственную шкалу, поэтому
 * показатели с разными единицами не сравниваются одной общей bar-axis.
 */
export function KpiCompareChart({ data }: { data: KpiComparisonDatum[] }) {
  return (
    <div className="divide-y divide-line">
      {data.map((item) => {
        const hasPair = item.baseline !== null && item.pilot !== null;
        const delta = hasPair ? item.pilot!.value - item.baseline!.value : null;
        const improved =
          delta === null || delta === 0
            ? null
            : item.direction === "UP"
              ? delta > 0
              : delta < 0;
        const pairMax = Math.max(item.baseline?.value ?? 0, item.pilot?.value ?? 0, 1);
        const baselineWidth = ((item.baseline?.value ?? 0) / pairMax) * 100;
        const pilotWidth = ((item.pilot?.value ?? 0) / pairMax) * 100;

        return (
          <article
            key={item.metricCode}
            className="grid gap-4 px-4 py-5 sm:px-5 xl:grid-cols-[210px_minmax(0,1fr)_180px] xl:items-center"
          >
            <header>
              <p className="font-technical text-meta text-muted">{item.category}</p>
              <h3 className="mt-1 text-base font-semibold text-text">{item.name}</h3>
              <p className="mt-1 text-meta text-muted">
                {item.direction === "UP" ? "Большее значение лучше" : "Меньшее значение лучше"}
              </p>
            </header>

            <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-stretch gap-2">
              <PhaseMeasure
                phase="Baseline"
                qualifier="до внедрения"
                value={item.baseline?.value ?? null}
                unit={item.unit}
                sampleSize={item.baseline?.sampleSize ?? null}
                period={item.baseline?.period ?? null}
                width={baselineWidth}
                variant="baseline"
              />
              <div className="flex items-center justify-center text-muted" aria-hidden="true">
                <ArrowRight className="h-5 w-5" />
              </div>
              <PhaseMeasure
                phase="Пилот"
                qualifier="после внедрения"
                value={item.pilot?.value ?? null}
                unit={item.unit}
                sampleSize={item.pilot?.sampleSize ?? null}
                period={item.pilot?.period ?? null}
                width={pilotWidth}
                variant="pilot"
              />
            </div>

            <div
              className={cn(
                "border-l-2 pl-4",
                improved === true
                  ? "border-success"
                  : improved === false
                    ? "border-action"
                    : "border-line-strong"
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-1.5 text-base font-semibold",
                  improved === true
                    ? "text-success"
                    : improved === false
                      ? "text-action"
                      : "text-muted"
                )}
              >
                {improved === true ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : improved === false ? (
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CircleMinus className="h-4 w-4" aria-hidden="true" />
                )}
                {improved === true ? "Улучшение" : improved === false ? "Ухудшение" : "Нет сравнения"}
              </p>
              <p className="mt-2 font-technical text-section font-semibold tabular-nums text-text">
                {delta !== null
                  ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatValue(Math.abs(delta))} ${item.unit}`
                  : "—"}
              </p>
              <p className="mt-1 text-meta text-muted">
                {item.changePercent !== null
                  ? `${item.changePercent > 0 ? "+" : ""}${formatValue(item.changePercent)}% относительно baseline`
                  : "Недостаточно данных для расчёта изменения"}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PhaseMeasure({
  phase,
  qualifier,
  value,
  unit,
  sampleSize,
  period,
  width,
  variant,
}: {
  phase: string;
  qualifier: string;
  value: number | null;
  unit: string;
  sampleSize: number | null;
  period: string | null;
  width: number;
  variant: "baseline" | "pilot";
}) {
  return (
    <div
      className={cn(
        "min-w-0 px-3 py-3",
        variant === "baseline"
          ? "border border-dashed border-line-strong bg-canvas"
          : "border-l-4 border-accent bg-accent-soft"
      )}
    >
      <p className="text-meta font-semibold text-muted">
        {phase} <span className="font-normal">· {qualifier}</span>
      </p>
      <p className="mt-2 text-section font-semibold tabular-nums text-text">
        {value !== null ? `${formatValue(value)} ${unit}` : "Нет данных"}
      </p>
      <div className="mt-3 h-1.5 bg-surface-raised" aria-hidden="true">
        <div
          className={cn(
            "h-full",
            variant === "baseline" ? "border-t-2 border-dashed border-muted" : "bg-accent"
          )}
          style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
        />
      </div>
      <p className="mt-2 text-meta text-muted">n = {sampleSize ?? "—"}</p>
      <p className="mt-0.5 truncate text-meta text-muted" title={period ?? "Период не указан"}>
        {period ?? "Период не указан"}
      </p>
    </div>
  );
}
