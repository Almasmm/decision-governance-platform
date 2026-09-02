// Дорожная карта внедрения: 4 этапа с KPI-гейтом между этапами
// и матрица рисков внедрения.
import { CheckCircle2, XCircle, Flag } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getKpiComparison } from "@/lib/analytics";
import { ROADMAP, IMPLEMENTATION_RISKS } from "@/lib/roadmap";
import { kpiMetric } from "@/lib/kpi";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/** Разбирает целевое значение вида «≥ 90 %» / «≤ 25 дней» и сравнивает с фактом пилота. */
function gateStatus(target: string, actual: number | null): boolean | null {
  if (actual === null) return null;
  const m = /([≥≤])\s*([\d.,]+)/.exec(target);
  if (!m) return null;
  const bound = Number((m[2] ?? "").replace(",", "."));
  if (Number.isNaN(bound)) return null;
  return m[1] === "≥" ? actual >= bound : actual <= bound;
}

const PROB_TONE: Record<string, string> = {
  низкая: "bg-emerald-50 text-emerald-800 border-emerald-200",
  средняя: "bg-amber-50 text-brand-warn border-amber-200",
  высокая: "bg-red-50 text-red-800 border-red-200",
};

export default async function RoadmapPage() {
  await requireUser();
  const comparison = await getKpiComparison();
  const pilotValue = (code: string): number | null =>
    comparison.find((c) => c.metricCode === code)?.pilot?.value ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.roadmap}</h1>
        <p className="text-xs text-slate-500">
          Переход к следующему этапу — не по календарю, а по достижению KPI-гейта. Фактические
          значения берутся из пилотной выборки замеров.
        </p>
      </div>

      <div className="space-y-3">
        {ROADMAP.map((stage, idx) => {
          const results = stage.gate.map((g) => ({
            ...g,
            actual: pilotValue(g.metricCode),
            passed: gateStatus(g.target, pilotValue(g.metricCode)),
          }));
          const allPassed = results.every((r) => r.passed === true);
          return (
            <Card key={stage.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-brand text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    {stage.title}
                  </CardTitle>
                  <Badge variant="outline">{stage.period}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">{stage.objective}</p>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Ключевые работы этапа
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {stage.activities.map((a) => (
                        <li key={a} className="text-xs text-slate-700">
                          • {a}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
                      <Flag className="h-3.5 w-3.5" />
                      KPI-гейт перехода к следующему этапу
                    </div>
                    <ul className="mt-1 space-y-1">
                      {results.map((r) => {
                        const def = kpiMetric(r.metricCode);
                        return (
                          <li key={r.metricCode} className="flex items-start gap-1.5 text-xs">
                            {r.passed === true ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-warn" />
                            )}
                            <span className="min-w-0">
                              <span className="text-slate-800">{r.label}</span>{" "}
                              <span className="text-slate-500">— цель {r.target}</span>
                              <span className="block text-[11px] text-slate-500">
                                факт пилота:{" "}
                                {r.actual !== null ? (
                                  <span className={cn("tabular-nums font-medium", r.passed ? "text-emerald-700" : "text-brand-warn")}>
                                    {r.actual} {def?.unit ?? ""}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">нет замера</span>
                                )}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div
                      className={cn(
                        "mt-2 rounded px-2 py-1 text-[11px]",
                        allPassed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-brand-warn"
                      )}
                    >
                      {allPassed
                        ? "Гейт пройден по данным пилота — переход к следующему этапу обоснован."
                        : "Гейт не пройден: переход к следующему этапу преждевременен."}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Матрица рисков внедрения</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Риск внедрения</TH>
                <TH>Вероятность</TH>
                <TH>Воздействие</TH>
                <TH>Меры снижения</TH>
                <TH>Владелец</TH>
              </TR>
            </THead>
            <TBody>
              {IMPLEMENTATION_RISKS.map((r) => (
                <TR key={r.name}>
                  <TD className="max-w-72 text-sm font-medium text-slate-900">{r.name}</TD>
                  <TD>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[11px]", PROB_TONE[r.probability])}>
                      {r.probability}
                    </span>
                  </TD>
                  <TD className="text-xs">{r.impact}</TD>
                  <TD className="max-w-96 text-xs text-slate-600">{r.mitigation}</TD>
                  <TD className="text-xs">{r.owner}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-slate-500">
        Фактические значения KPI рассчитаны по данным пилотной выборки демо-контура и не являются
        официальными показателями компании.
      </p>
    </div>
  );
}
