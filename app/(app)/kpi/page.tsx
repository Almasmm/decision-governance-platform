import { ArrowRight, CheckCircle2, CircleMinus, Info, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBaselineMaturity, getKpiComparison, getMaturityIndex } from "@/lib/analytics";
import { KPI_GROUPS, type KpiGroup } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCompareChart, type KpiComparisonDatum } from "@/components/charts/kpi-compare";
import { MaturityCard } from "@/components/maturity-card";
import { EffectCalculators } from "@/components/effect-calculators";

export const dynamic = "force-dynamic";

const FEATURED_METRICS = [
  { code: "SPEED_MEDIAN_DAYS", category: "01 · Длительность" },
  { code: "JUST_ALT_SHARE", category: "02 · Доказательность" },
  { code: "EXEC_KPI_LINKED_SHARE", category: "03 · Исполнение результата" },
] as const;

function formatValue(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

export default async function KpiPage() {
  await requireUser();
  const [comparison, maturity, baseline] = await Promise.all([
    getKpiComparison(),
    getMaturityIndex(),
    getBaselineMaturity(),
  ]);

  const baselinePeriod = comparison.find((item) => item.baseline?.period)?.baseline?.period ?? "не указан";
  const pilotPeriod = comparison.find((item) => item.pilot?.period)?.pilot?.period ?? "не указан";
  const baselineSample = comparison.find((item) => item.baseline)?.baseline?.sampleSize ?? 0;
  const pilotSample = comparison.find((item) => item.pilot)?.pilot?.sampleSize ?? 0;
  const featured: KpiComparisonDatum[] = FEATURED_METRICS.flatMap(({ code, category }) => {
    const item = comparison.find((candidate) => candidate.metricCode === code);
    return item
      ? [
          {
            metricCode: item.metricCode,
            category,
            name: item.name,
            unit: item.unit,
            direction: item.direction,
            baseline: item.baseline,
            pilot: item.pilot,
            changePercent: item.changePercent,
          },
        ]
      : [];
  });

  return (
    <div className="space-y-6">
      <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
        <div>
          <p className="font-technical text-meta text-muted">Baseline → Pilot</p>
          <h1 className="mt-1 text-page font-semibold text-text">Эффект цифрового контура</h1>
          <p className="mt-2 max-w-4xl text-lead text-muted">
            Сравнение скорости подготовки, доказательности и исполнимости решений на двух
            последовательных выборках с одной методикой измерения.
          </p>
        </div>
        <aside className="border-l-4 border-line-strong bg-surface px-4 py-3 text-meta text-muted">
          <p className="flex items-center gap-1.5 font-semibold text-text">
            <Info className="h-4 w-4" aria-hidden="true" />
            Граница интерпретации
          </p>
          <p className="mt-1">
            Сравнение описывает пилотную выборку и не доказывает причинность. Это не официальный
            показатель компании и не оценка всей организации.
          </p>
        </aside>
      </header>

      <section className="border-y border-line bg-surface" aria-labelledby="measurement-frame-title">
        <header className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="measurement-frame-title" className="text-section font-semibold text-text">
            Контур сопоставимости
          </h2>
          <p className="mt-0.5 text-meta text-muted">
            Определения KPI и единицы наблюдения одинаковы; периоды и фактический размер каждой
            выборки раскрыты отдельно и не выравниваются искусственно.
          </p>
        </header>
        <div className="grid md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] md:items-stretch">
          <SampleFrame
            phase="Baseline"
            subtitle="до внедрения цифрового паспорта"
            sample={baselineSample}
            period={baselinePeriod}
            variant="baseline"
          />
          <div className="flex items-center justify-center border-y border-line py-3 text-muted md:border-x md:border-y-0">
            <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" aria-hidden="true" />
          </div>
          <SampleFrame
            phase="Пилот"
            subtitle="решения в цифровом контуре"
            sample={pilotSample}
            period={pilotPeriod}
            variant="pilot"
          />
        </div>
      </section>

      <section className="border-y border-line bg-surface" aria-labelledby="paired-outcomes-title">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div>
            <h2 id="paired-outcomes-title" className="text-section font-semibold text-text">
              Операционное сравнение «до → после»
            </h2>
            <p className="mt-0.5 text-meta text-muted">
              Каждая пара имеет собственную шкалу и единицу измерения.
            </p>
          </div>
          <Badge variant="technical">пилотная оценка</Badge>
        </header>
        <KpiCompareChart data={featured} />
      </section>

      <section className="border-y border-line bg-surface" aria-labelledby="kpi-register-title">
        <header className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="kpi-register-title" className="text-section font-semibold text-text">
            Реестр доказательств эффекта
          </h2>
          <p className="mt-0.5 text-meta text-muted">
            Все девять KPI процесса: исходное значение, пилот, размер выборки, период и направление улучшения.
          </p>
        </header>
        <Table>
          <THead>
            <TR>
              <TH className="min-w-72">Показатель процесса</TH>
              <TH className="min-w-48">Baseline · до</TH>
              <TH className="min-w-48">Пилот · после</TH>
              <TH className="min-w-36">Изменение</TH>
              <TH className="min-w-40">Интерпретация</TH>
            </TR>
          </THead>
          {KPI_GROUPS.map((group) => {
            const rows = comparison.filter((item) => item.group === group);
            if (rows.length === 0) return null;
            return (
              <TBody key={group}>
                <tr className="border-b border-line bg-surface-raised">
                  <th colSpan={5} className="px-3 py-2 text-left text-table font-semibold text-text">
                    {ru.kpiGroups[group as KpiGroup]}
                  </th>
                </tr>
                {rows.map((item) => {
                  const delta =
                    item.baseline && item.pilot ? item.pilot.value - item.baseline.value : null;
                  return (
                    <TR key={item.metricCode}>
                      <TD className="max-w-lg">
                        <p className="font-medium text-text">{item.name}</p>
                        <p className="mt-0.5 text-meta text-muted">
                          {item.direction === "UP" ? "Большее значение лучше" : "Меньшее значение лучше"}
                        </p>
                      </TD>
                      <TD>
                        <MeasurementCell value={item.baseline?.value ?? null} unit={item.unit} sample={item.baseline?.sampleSize ?? null} period={item.baseline?.period ?? null} variant="baseline" />
                      </TD>
                      <TD>
                        <MeasurementCell value={item.pilot?.value ?? null} unit={item.unit} sample={item.pilot?.sampleSize ?? null} period={item.pilot?.period ?? null} variant="pilot" />
                      </TD>
                      <TD className="whitespace-nowrap">
                        <p className="font-technical text-table font-semibold tabular-nums text-text">
                          {delta !== null
                            ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatValue(Math.abs(delta))} ${item.unit}`
                            : "—"}
                        </p>
                        <p className="mt-0.5 text-meta text-muted">
                          {item.changePercent !== null
                            ? `${item.changePercent > 0 ? "+" : ""}${formatValue(item.changePercent)}% к baseline`
                            : "нет сравнения"}
                        </p>
                      </TD>
                      <TD>
                        <Outcome improved={item.improved} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            );
          })}
        </Table>
        <p className="border-t border-line px-4 py-2 text-meta text-muted sm:px-5">
          Изменение рассчитано относительно baseline. Статистическая значимость и причинная
          атрибуция данным экраном не утверждаются.
        </p>
      </section>

      <MaturityCard result={maturity.result} periodNote={maturity.periodNote} baseline={baseline} />

      <section aria-labelledby="effect-method-title">
        <header className="mb-3">
          <p className="font-technical text-meta text-muted">Методика экономического эффекта</p>
          <h2 id="effect-method-title" className="mt-1 text-section font-semibold text-text">
            Расчёты из введённых параметров
          </h2>
          <p className="mt-1 max-w-4xl text-base text-muted">
            Формулы не подставляют значения по умолчанию вместо отсутствующих данных. Результат
            появляется только после заполнения обязательных параметров.
          </p>
        </header>
        <EffectCalculators />
      </section>

      <p className="border-l-4 border-line-strong bg-surface px-4 py-3 text-meta text-muted">
        Денежные результаты являются расчётными сценариями по пользовательским входным параметрам.
        Они не являются подтверждённым денежным эффектом или официальной отчётностью компании.
      </p>
    </div>
  );
}

function SampleFrame({
  phase,
  subtitle,
  sample,
  period,
  variant,
}: {
  phase: string;
  subtitle: string;
  sample: number;
  period: string;
  variant: "baseline" | "pilot";
}) {
  return (
    <div className={cn("px-4 py-4 sm:px-5", variant === "pilot" && "bg-accent-soft")}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "px-2 py-1 text-table font-semibold",
            variant === "baseline"
              ? "border border-dashed border-line-strong text-muted"
              : "border-l-4 border-accent bg-surface text-accent"
          )}
        >
          {phase}
        </span>
        <span className="text-meta text-muted">{subtitle}</span>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-meta text-muted">Размер выборки</dt>
          <dd className="mt-0.5 text-lead font-semibold tabular-nums text-text">n = {sample}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">Период наблюдения</dt>
          <dd className="mt-0.5 text-base font-semibold text-text">{period}</dd>
        </div>
      </dl>
    </div>
  );
}

function MeasurementCell({
  value,
  unit,
  sample,
  period,
  variant,
}: {
  value: number | null;
  unit: string;
  sample: number | null;
  period: string | null;
  variant: "baseline" | "pilot";
}) {
  return value !== null ? (
    <div className={cn("border-l-2 pl-2", variant === "baseline" ? "border-dashed border-line-strong" : "border-accent")}>
      <p className="font-technical text-table font-semibold tabular-nums text-text">
        {formatValue(value)} {unit}
      </p>
      <p className="mt-0.5 text-meta text-muted">n = {sample ?? "—"}</p>
      <p className="text-meta text-muted">{period ?? "Период не указан"}</p>
    </div>
  ) : (
    <span className="text-meta text-muted">Нет данных</span>
  );
}

function Outcome({ improved }: { improved: boolean | null }) {
  if (improved === true) {
    return (
      <span className="inline-flex items-center gap-1.5 text-table font-semibold text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Улучшение
      </span>
    );
  }
  if (improved === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-table font-semibold text-action">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Ухудшение
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-table text-muted">
      <CircleMinus className="h-4 w-4" aria-hidden="true" /> Нет сравнения
    </span>
  );
}
