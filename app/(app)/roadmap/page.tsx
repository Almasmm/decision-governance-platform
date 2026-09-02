import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Flag,
  LockKeyhole,
  TriangleAlert,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getKpiComparison } from "@/lib/analytics";
import { ROADMAP, IMPLEMENTATION_RISKS, type RoadmapStage } from "@/lib/roadmap";
import { kpiMetric } from "@/lib/kpi";
import { cn } from "@/lib/utils";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PHASE_META = [
  { mark: "0", name: "Pilot" },
  { mark: "6", name: "Integration" },
  { mark: "18", name: "Intelligence" },
  { mark: "30+", name: "Scale" },
] as const;

type PhaseState = "complete" | "blocked" | "future";

interface GateResult {
  metricCode: string;
  label: string;
  target: string;
  targetValue: number | null;
  operator: "≥" | "≤" | null;
  actual: number | null;
  unit: string;
  passed: boolean | null;
  gap: number | null;
  progress: number;
}

interface PhaseView {
  stage: RoadmapStage;
  results: GateResult[];
  allPassed: boolean;
  state: PhaseState;
}

function parseTarget(target: string): { operator: "≥" | "≤"; value: number } | null {
  const match = /([≥≤])\s*([\d.,]+)/.exec(target);
  if (!match) return null;
  const value = Number((match[2] ?? "").replace(",", "."));
  if (Number.isNaN(value)) return null;
  return { operator: match[1] as "≥" | "≤", value };
}

function evaluateGate(
  metricCode: string,
  label: string,
  target: string,
  actual: number | null
): GateResult {
  const parsed = parseTarget(target);
  const unit = kpiMetric(metricCode)?.unit ?? "";
  if (!parsed || actual === null) {
    return {
      metricCode,
      label,
      target,
      targetValue: parsed?.value ?? null,
      operator: parsed?.operator ?? null,
      actual,
      unit,
      passed: null,
      gap: null,
      progress: 0,
    };
  }

  const passed = parsed.operator === "≥" ? actual >= parsed.value : actual <= parsed.value;
  const gap = parsed.operator === "≥" ? Math.max(0, parsed.value - actual) : Math.max(0, actual - parsed.value);
  const progress =
    parsed.operator === "≥"
      ? parsed.value === 0
        ? 100
        : Math.min(100, Math.max(0, (actual / parsed.value) * 100))
      : actual <= parsed.value
        ? 100
        : actual === 0
          ? 100
          : Math.min(100, Math.max(0, (parsed.value / actual) * 100));

  return {
    metricCode,
    label,
    target,
    targetValue: parsed.value,
    operator: parsed.operator,
    actual,
    unit,
    passed,
    gap,
    progress,
  };
}

function formatNumber(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function gapLabel(result: GateResult): string {
  if (result.actual === null || result.gap === null) return "Нет фактического замера";
  if (result.passed) return "Порог достигнут";
  const unit = result.unit === "%" ? "п.п." : result.unit;
  return result.operator === "≥"
    ? `${formatNumber(result.gap)} ${unit} до порога`.trim()
    : `${formatNumber(result.gap)} ${unit} выше порога`.trim();
}

const PROBABILITY_STYLE: Record<string, string> = {
  низкая: "border border-line-strong bg-surface text-muted",
  средняя: "border border-action bg-surface text-action",
  высокая: "bg-danger text-surface",
};

export default async function RoadmapPage() {
  await requireUser();
  const comparison = await getKpiComparison();
  const pilotValue = (code: string): number | null =>
    comparison.find((item) => item.metricCode === code)?.pilot?.value ?? null;

  const evaluated = ROADMAP.map((stage) => {
    const results = stage.gate.map((gate) =>
      evaluateGate(gate.metricCode, gate.label, gate.target, pilotValue(gate.metricCode))
    );
    return { stage, results, allPassed: results.every((result) => result.passed === true) };
  });
  const firstBlockedIndex = evaluated.findIndex((phase) => !phase.allPassed);
  const phases: PhaseView[] = evaluated.map((phase, index) => ({
    ...phase,
    state:
      firstBlockedIndex === -1 || index < firstBlockedIndex
        ? "complete"
        : index === firstBlockedIndex
          ? "blocked"
          : "future",
  }));
  const currentBarrier = firstBlockedIndex >= 0 ? phases[firstBlockedIndex] : null;
  const pilotContext = comparison.find((item) => item.pilot)?.pilot ?? null;

  return (
    <div className="space-y-6">
      <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
        <div>
          <p className="font-technical text-meta text-muted">0 · 6 · 18 · 30+ месяцев</p>
          <h1 className="mt-1 text-page font-semibold text-text">Трансформационная дорожная карта</h1>
          <p className="mt-2 max-w-4xl text-lead text-muted">
            Фаза меняется не по истечении календарного срока, а после подтверждения измеримого
            KPI-gate на данных пилотной выборки.
          </p>
        </div>
        <aside className="border-l-4 border-line-strong bg-surface px-4 py-3 text-meta text-muted">
          <p className="font-semibold text-text">Правило движения</p>
          <p className="mt-1">
            Календарь задаёт горизонт планирования. Факт, порог и разрыв определяют готовность к переходу.
          </p>
        </aside>
      </header>

      <TransformationRail phases={phases} />

      {currentBarrier ? (
        <section className="border border-action bg-action-soft" aria-labelledby="current-barrier-title">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.65fr)]">
            <div className="px-5 py-5 sm:px-6">
              <p className="font-technical text-meta font-semibold text-action">Текущая граница трансформации</p>
              <h2 id="current-barrier-title" className="mt-2 text-decision font-semibold text-text">
                Масштабирование преждевременно
              </h2>
              <p className="mt-2 max-w-3xl text-base text-text">
                Gate фазы «{currentBarrier.stage.title.replace(/^Этап \d+\.\s*/, "")}» не пройден.
                Следующий уровень не открывается, пока фактические KPI не достигнут порогов.
              </p>
            </div>
            <div className="border-t border-action px-5 py-5 lg:border-l lg:border-t-0 sm:px-6">
              <p className="text-meta font-semibold text-action">Разрыв до порога</p>
              <ul className="mt-2 space-y-2">
                {currentBarrier.results.filter((result) => result.passed !== true).map((result) => (
                  <li key={result.metricCode} className="flex items-start justify-between gap-4 text-meta">
                    <span className="text-text">{result.label}</span>
                    <strong className="shrink-0 font-technical text-action">{gapLabel(result)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-l-4 border-success bg-accent-soft px-5 py-4">
          <h2 className="text-section font-semibold text-text">Все текущие KPI-gates подтверждены</h2>
          <p className="mt-1 text-base text-muted">Переход к следующему уровню может быть вынесен на человеческое решение.</p>
        </section>
      )}

      <div className="space-y-6">
        {phases.map((phase, index) => (
          <PhaseGate key={phase.stage.id} phase={phase} index={index} />
        ))}
      </div>

      <section className="border-y border-line bg-surface" aria-labelledby="implementation-risks-title">
        <header className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="implementation-risks-title" className="text-section font-semibold text-text">
            Контроль рисков внедрения
          </h2>
          <p className="mt-0.5 text-meta text-muted">
            Вероятность, воздействие, мера и владелец показаны как управленческая ответственность.
          </p>
        </header>
        <Table>
          <THead>
            <TR>
              <TH className="min-w-64">Риск внедрения</TH>
              <TH>Вероятность</TH>
              <TH>Воздействие</TH>
              <TH className="min-w-80">Мера снижения</TH>
              <TH className="min-w-48">Владелец</TH>
            </TR>
          </THead>
          <TBody>
            {IMPLEMENTATION_RISKS.map((risk) => (
              <TR key={risk.name}>
                <TD className="max-w-sm font-medium text-text">{risk.name}</TD>
                <TD>
                  <span className={cn("inline-flex min-h-6 items-center px-2 text-meta font-semibold", PROBABILITY_STYLE[risk.probability])}>
                    {risk.probability}
                  </span>
                </TD>
                <TD className="text-table text-text">{risk.impact}</TD>
                <TD className="max-w-xl text-table text-muted">{risk.mitigation}</TD>
                <TD className="text-table font-medium text-text">{risk.owner}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>

      <p className="border-l-4 border-line-strong bg-surface px-4 py-3 text-meta text-muted">
        Факт в KPI-gates рассчитан по пилотной выборке{pilotContext ? `: n = ${pilotContext.sampleSize}, ${pilotContext.period ?? "период не указан"}` : ""}.
        Значения не являются официальными показателями компании. Решение о переходе принимает
        уполномоченный орган; gate лишь проверяет достижение условий.
      </p>
    </div>
  );
}

function TransformationRail({ phases }: { phases: PhaseView[] }) {
  return (
    <section className="bg-obsidian px-5 pb-5 pt-4 text-surface sm:px-6" aria-label="Фазы трансформации от пилота до масштабирования">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-0">
        {phases.map((phase, index) => {
          const meta = PHASE_META[index] ?? { mark: String(index + 1), name: phase.stage.title };
          return (
            <div
              key={phase.stage.id}
              className={cn(
                "relative border-l-2 pb-1 pl-5 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pr-5 md:pt-5",
                phase.state === "complete"
                  ? "border-success"
                  : phase.state === "blocked"
                    ? "border-action"
                    : "border-graphite-line"
              )}
            >
              <span
                className={cn(
                  "absolute -left-[7px] top-0 h-3 w-3 rounded-full border-2 border-obsidian md:-top-[7px] md:left-0",
                  phase.state === "complete"
                    ? "bg-success"
                    : phase.state === "blocked"
                      ? "bg-action"
                      : "bg-graphite-soft"
                )}
                aria-hidden="true"
              />
              <p className="font-technical text-meta text-line-strong">{meta.mark} мес.</p>
              <h2 className="mt-1 text-lead font-semibold text-surface">{meta.name}</h2>
              <p className="mt-1 text-meta text-line-strong">{phase.stage.period}</p>
              <p
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 text-meta font-semibold",
                  phase.state === "complete"
                    ? "text-accent-soft"
                    : phase.state === "blocked"
                      ? "text-action-soft"
                      : "text-line-strong"
                )}
              >
                {phase.state === "complete" ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : phase.state === "blocked" ? (
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CircleDashed className="h-4 w-4" aria-hidden="true" />
                )}
                {phase.state === "complete" ? "Gate подтверждён" : phase.state === "blocked" ? "Переход заблокирован" : "Будущая фаза"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PhaseGate({ phase, index }: { phase: PhaseView; index: number }) {
  const nextPhase = PHASE_META[index + 1]?.name;
  const phaseName = PHASE_META[index]?.name ?? phase.stage.title;
  const isCurrentBarrier = phase.state === "blocked";

  return (
    <section className="border-y border-line bg-surface" aria-labelledby={`phase-${phase.stage.id}`}>
      <header className="grid gap-4 border-b border-line px-4 py-4 sm:px-5 lg:grid-cols-[180px_minmax(0,1fr)_180px] lg:items-start">
        <div>
          <p className="font-technical text-meta text-muted">Фаза {String(index + 1).padStart(2, "0")}</p>
          <h2 id={`phase-${phase.stage.id}`} className="mt-1 text-section font-semibold text-text">{phaseName}</h2>
          <p className="mt-1 text-meta text-muted">{phase.stage.period}</p>
        </div>
        <p className="max-w-4xl text-base text-text">{phase.stage.objective}</p>
        <div className="lg:text-right">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 text-meta font-semibold",
              phase.state === "complete"
                ? "bg-accent-soft text-success"
                : phase.state === "blocked"
                  ? "bg-action-soft text-action"
                  : "bg-surface-raised text-muted"
            )}
          >
            {phase.state === "complete" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : phase.state === "blocked" ? (
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CircleDashed className="h-4 w-4" aria-hidden="true" />
            )}
            {phase.state === "complete" ? "Условия достигнуты" : phase.state === "blocked" ? "Текущий барьер" : "Следующий горизонт"}
          </span>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-base font-semibold text-text">
            <Flag className="h-4 w-4 text-muted" aria-hidden="true" />
            Gate {String(index + 1).padStart(2, "0")}
            {nextPhase ? <span className="font-normal text-muted">· {phaseName} → {nextPhase}</span> : <span className="font-normal text-muted">· устойчивость масштаба</span>}
          </p>
          <span className="font-technical text-meta text-muted">
            {phase.results.filter((result) => result.passed === true).length} / {phase.results.length} условий
          </span>
        </div>

        <div className="mt-3 divide-y divide-line border-y border-line">
          {phase.results.map((result, resultIndex) => (
            <div
              key={result.metricCode}
              className="grid gap-3 py-4 md:grid-cols-[minmax(220px,1fr)_150px_150px_minmax(190px,0.8fr)] md:items-center"
            >
              <div>
                <p className="font-medium text-text">
                  <span className="mr-2 font-technical text-meta text-muted">{String(resultIndex + 1).padStart(2, "0")}</span>
                  {result.label}
                </p>
              </div>

              <div className="border-l-4 border-accent bg-accent-soft px-3 py-2">
                <p className="text-meta font-semibold text-accent">Факт пилота</p>
                <p className="mt-1 font-technical text-lead font-semibold tabular-nums text-text">
                  {result.actual !== null ? `${formatNumber(result.actual)} ${result.unit}` : "Нет замера"}
                </p>
              </div>

              <div className="border border-dashed border-line-strong bg-canvas px-3 py-2">
                <p className="text-meta font-semibold text-muted">Целевой порог</p>
                <p className="mt-1 font-technical text-lead font-semibold tabular-nums text-text">{result.target}</p>
              </div>

              <div>
                <div className="h-1.5 bg-surface-raised" aria-hidden="true">
                  <div
                    className={cn(
                      "h-full",
                      result.passed === true
                        ? "bg-success"
                        : isCurrentBarrier
                          ? "bg-action"
                          : "bg-line-strong"
                    )}
                    style={{ width: `${result.progress}%` }}
                  />
                </div>
                <p
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-meta font-semibold",
                    result.passed === true
                      ? "text-success"
                      : isCurrentBarrier
                        ? "text-action"
                        : "text-muted"
                  )}
                >
                  {result.passed === true ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : isCurrentBarrier ? (
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CircleDashed className="h-4 w-4" aria-hidden="true" />
                  )}
                  {gapLabel(result)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "mt-4 flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3",
            phase.state === "complete"
              ? "border-success bg-accent-soft"
              : phase.state === "blocked"
                ? "border-action bg-action-soft"
                : "border-line-strong bg-canvas"
          )}
        >
          <p className={cn("text-base font-semibold", phase.state === "blocked" ? "text-action" : "text-text")}>
            {phase.state === "complete"
              ? nextPhase
                ? `Условия перехода к фазе «${nextPhase}» подтверждены.`
                : "Условия устойчивости масштаба подтверждены."
              : phase.state === "blocked"
                ? `Переход к фазе «${nextPhase ?? "следующий уровень"}» заблокирован. Масштабирование преждевременно.`
                : "Будущий gate: текущий факт показан только как ориентир, переход ещё не рассматривается."}
          </p>
          {nextPhase && phase.state === "complete" && (
            <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-success">
              Порог достигнут <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>

        <details className="mt-3 border-t border-line pt-3">
          <summary className="cursor-pointer text-table font-semibold text-muted">
            Ключевые работы фазы ({phase.stage.activities.length})
          </summary>
          <ul className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
            {phase.stage.activities.map((activity) => (
              <li key={activity} className="flex items-start gap-2 text-table text-text">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {activity}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
