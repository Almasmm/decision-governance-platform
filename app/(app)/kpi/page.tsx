// Замер эффекта и KPI: сопоставимые выборки BASELINE и PILOT по пяти группам,
// сравнение «до/после», индекс зрелости, калькуляторы формул (1)–(3).
import { requireUser } from "@/lib/auth";
import { getKpiComparison, getMaturityIndex, getBaselineMaturity } from "@/lib/analytics";
import { KPI_GROUPS, type KpiGroup } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { KpiCompareChart } from "@/components/charts/kpi-compare";
import { MaturityCard } from "@/components/maturity-card";
import { EffectCalculators } from "@/components/effect-calculators";

export const dynamic = "force-dynamic";

export default async function KpiPage() {
  await requireUser();
  const [comparison, maturity, baseline] = await Promise.all([
    getKpiComparison(),
    getMaturityIndex(),
    getBaselineMaturity(),
  ]);

  const baselinePeriod = comparison.find((c) => c.baseline?.period)?.baseline?.period ?? "не указан";
  const pilotPeriod = comparison.find((c) => c.pilot?.period)?.pilot?.period ?? "не указан";
  const baselineSample = comparison.find((c) => c.baseline)?.baseline?.sampleSize ?? 0;
  const pilotSample = comparison.find((c) => c.pilot)?.pilot?.sampleSize ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.kpi}</h1>
        <p className="text-xs text-slate-500">
          Две сопоставимые выборки решений. Размер выборки и период показываются рядом с каждым
          результатом: без них сравнение «до/после» не имеет смысла.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{ru.kpiPhases.BASELINE}</Badge>
            <span className="text-xs text-slate-500">до внедрения контура</span>
          </div>
          <dl className="mt-1.5 flex gap-6 text-xs">
            <div>
              <dt className="text-slate-500">{ru.common.sampleSize}</dt>
              <dd className="font-semibold text-brand">{baselineSample} решений</dd>
            </div>
            <div>
              <dt className="text-slate-500">{ru.common.period}</dt>
              <dd className="font-semibold text-brand">{baselinePeriod}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <Badge>{ru.kpiPhases.PILOT}</Badge>
            <span className="text-xs text-slate-500">контур цифрового паспорта</span>
          </div>
          <dl className="mt-1.5 flex gap-6 text-xs">
            <div>
              <dt className="text-slate-500">{ru.common.sampleSize}</dt>
              <dd className="font-semibold text-brand">{pilotSample} решений</dd>
            </div>
            <div>
              <dt className="text-slate-500">{ru.common.period}</dt>
              <dd className="font-semibold text-brand">{pilotPeriod}</dd>
            </div>
          </dl>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сравнение KPI: базовая выборка против пилота</CardTitle>
        </CardHeader>
        <CardContent>
          <KpiCompareChart
            data={comparison.map((c) => ({
              name: c.name,
              baseline: c.baseline?.value ?? null,
              pilot: c.pilot?.value ?? null,
              unit: c.unit,
            }))}
          />
        </CardContent>
      </Card>

      {KPI_GROUPS.map((group) => {
        const rows = comparison.filter((c) => c.group === group);
        if (rows.length === 0) return null;
        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle>Группа KPI: {ru.kpiGroups[group as KpiGroup]}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Показатель процесса</TH>
                    <TH>Базовая выборка</TH>
                    <TH>Пилот</TH>
                    <TH>Изменение</TH>
                    <TH>Направление</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((c) => (
                    <TR key={c.metricCode}>
                      <TD className="max-w-96 text-sm">{c.name}</TD>
                      <TD className="whitespace-nowrap text-xs">
                        {c.baseline ? (
                          <>
                            <span className="font-semibold tabular-nums">
                              {c.baseline.value} {c.unit}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              n={c.baseline.sampleSize}; {c.baseline.period}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">нет данных</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-xs">
                        {c.pilot ? (
                          <>
                            <span className="font-semibold tabular-nums">
                              {c.pilot.value} {c.unit}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              n={c.pilot.sampleSize}; {c.pilot.period}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">нет данных</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-xs tabular-nums">
                        {c.changePercent !== null ? (
                          <span className={cn(c.improved ? "text-emerald-700" : "text-brand-warn")}>
                            {c.changePercent > 0 ? "+" : ""}
                            {c.changePercent} %
                          </span>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD className="text-[11px] text-slate-500">
                        {c.direction === "UP" ? "больше — лучше" : "меньше — лучше"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <MaturityCard result={maturity.result} periodNote={maturity.periodNote} baseline={baseline} />

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Калькуляторы экономического эффекта
        </h2>
        <EffectCalculators />
      </div>

      <p className="text-[11px] text-slate-500">
        Денежные величины считаются исключительно из параметров, введённых пользователем. Если хотя
        бы один параметр не заполнен, система показывает, чего не хватает, и не выводит оценку.
      </p>
    </div>
  );
}
