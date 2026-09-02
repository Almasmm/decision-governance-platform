// Ролевые дашборды комитетов: одна доказательная база — четыре представления.
import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDashboardStats, getMaturityIndex } from "@/lib/analytics";
import { ru } from "@/lib/i18n/ru";
import { formatMoney, cn } from "@/lib/utils";
import type { Criticality, DecisionType, SourceSystem, Stage } from "@/lib/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatTile } from "@/components/stat-tile";
import { Provenance } from "@/components/provenance";
import { MaturityCard } from "@/components/maturity-card";

export const dynamic = "force-dynamic";

const PANELS = [
  { key: "strategy", label: "Стратегическая панель", types: ["STRATEGY", "DIGITAL"] as DecisionType[], indicators: ["NPV-PORT", "DIGI-AUTOM", "RPA-COUNT", "CO2-EMIS"] },
  { key: "investment", label: "Инвестиционная панель", types: ["INVESTMENT", "PROCUREMENT"] as DecisionType[], indicators: ["CAPEX-EXEC", "INV-RETURN", "UR-PRICE", "PROC-LOCAL"] },
  { key: "production", label: "Производственная панель", types: ["PRODUCTION", "HR"] as DecisionType[], indicators: ["URN-PROD", "WELL-DEBIT", "ACID-STOCK", "HSE-LTIFR"] },
  { key: "risk", label: "Риск-панель", types: ["RISK"] as DecisionType[], indicators: ["HSE-LTIFR", "ACID-STOCK", "FX-KZT", "COST-C1"] },
] as const;

type PanelKey = (typeof PANELS)[number]["key"];

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const activeKey: PanelKey = PANELS.some((p) => p.key === sp.panel) ? (sp.panel as PanelKey) : "strategy";
  const panel = PANELS.find((p) => p.key === activeKey) ?? PANELS[0];

  const [decisions, indicators, stats, maturity, risks] = await Promise.all([
    prisma.decision.findMany({
      where: { type: { in: [...panel.types] } },
      include: { decisionBody: true, _count: { select: { alternatives: true, risks: true } } },
      orderBy: { registeredAt: "desc" },
    }),
    prisma.indicator.findMany({
      where: { code: { in: [...panel.indicators] } },
      include: { owner: true, values: { orderBy: { asOf: "desc" }, take: 1 } },
    }),
    getDashboardStats(),
    getMaturityIndex(),
    prisma.risk.findMany({
      include: { decision: true, owner: true },
      orderBy: { impact: "desc" },
      take: 10,
    }),
  ]);

  const expectedLossBefore = risks.reduce((s, r) => s + r.probability * r.impact, 0);
  const expectedLossAfter = risks.reduce(
    (s, r) => s + (r.residualProbability ?? r.probability) * (r.residualImpact ?? r.impact),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.boards}</h1>
        <p className="text-xs text-slate-500">
          Одна доказательная база — разные представления для комитетов Совета директоров. Числа
          берутся из тех же паспортов и того же каталога показателей.
        </p>
      </div>

      <nav className="flex flex-wrap gap-0.5 border-b border-slate-200">
        {PANELS.map((p) => (
          <Link
            key={p.key}
            href={`/boards?panel=${p.key}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              activeKey === p.key
                ? "border-brand-accent font-semibold text-brand"
                : "border-transparent text-slate-600 hover:text-brand"
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 md:grid-cols-4">
        {indicators.map((i) => {
          const latest = i.values[0];
          return (
            <div key={i.id} className="rounded border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">{i.name}</div>
              <div className="mt-1 text-lg font-bold text-brand">
                {latest ? (
                  <Provenance
                    value={`${latest.value.toLocaleString("ru-RU")} ${i.unit}`}
                    nature="fact"
                    source={ru.sourceSystems[i.sourceSystem as SourceSystem]}
                    asOf={format(latest.asOf, "d MMMM yyyy", { locale: ruLocale })}
                    owner={i.owner?.name}
                    formula={i.formula ?? undefined}
                    note={`Способ загрузки: ${latest.loadType === "AUTO" ? ru.loadTypes.AUTO : ru.loadTypes.MANUAL}`}
                  />
                ) : (
                  <span className="text-sm text-slate-400">нет значений</span>
                )}
              </div>
              <Link href={`/indicators/${i.id}`} className="mt-1 block text-[11px] text-brand-accent hover:underline">
                Происхождение данных →
              </Link>
            </div>
          );
        })}
      </div>

      {activeKey === "strategy" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MaturityCard result={maturity.result} periodNote={maturity.periodNote} compact />
          <Card>
            <CardHeader>
              <CardTitle>Качество процесса подготовки вопросов</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Решения с альтернативами" value={`${stats.shareWithAlternatives} %`} nature="fact" source="Паспорта решений" />
              <StatTile label="Решения с пост-оценкой" value={`${stats.shareWithPostEvaluation} %`} nature="fact" source="База уроков" />
              <StatTile label="Возвраты на доработку" value={String(stats.totalReturns)} warn={stats.totalReturns > 0} nature="fact" source="Аудит" />
              <StatTile
                label="Медианный срок подготовки"
                value={stats.medianPreparationDays !== null ? `${stats.medianPreparationDays} дн.` : "нет данных"}
                nature="fact"
                source="Паспорта решений"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeKey === "risk" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Топ рисков по всем паспортам решений</CardTitle>
            <div className="flex gap-4 text-xs">
              <span className="text-slate-600">
                Ожидаемый ущерб до мер:{" "}
                <span className="font-semibold text-brand">{formatMoney(expectedLossBefore)}</span>
              </span>
              <span className="text-slate-600">
                после мер:{" "}
                <span className="font-semibold text-brand">{formatMoney(expectedLossAfter)}</span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Риск</TH>
                  <TH>Решение</TH>
                  <TH>P₀ × L₀</TH>
                  <TH>Остаточный</TH>
                  <TH>Владелец</TH>
                </TR>
              </THead>
              <TBody>
                {risks.map((r) => (
                  <TR key={r.id}>
                    <TD className="max-w-72 text-sm">{r.name}</TD>
                    <TD>
                      <Link href={`/decisions/${r.decisionId}`} className="font-mono text-xs text-brand-accent hover:underline">
                        {r.decision.code}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap text-xs tabular-nums">
                      {formatMoney(r.probability * r.impact)}
                    </TD>
                    <TD className="whitespace-nowrap text-xs tabular-nums">
                      {r.residualProbability !== null && r.residualImpact !== null
                        ? formatMoney(r.residualProbability * r.residualImpact)
                        : "не оценён"}
                    </TD>
                    <TD className="text-xs">{r.owner?.name ?? "не назначен"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Вопросы в компетенции панели «{panel.label}»</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Код</TH>
                <TH>Вопрос</TH>
                <TH>Ур.</TH>
                <TH>Стадия</TH>
                <TH>Орган</TH>
                <TH>Доказательная база</TH>
              </TR>
            </THead>
            <TBody>
              {decisions.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-4 text-center text-sm text-slate-500">
                    Вопросов данной категории в контуре нет.
                  </TD>
                </TR>
              )}
              {decisions.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Link href={`/decisions/${d.id}`} className="font-mono text-xs text-brand-accent hover:underline">
                      {d.code}
                    </Link>
                  </TD>
                  <TD className="max-w-96 text-sm">{d.title}</TD>
                  <TD><CriticalityBadge level={d.criticality} /></TD>
                  <TD className="text-xs">{ru.stages[d.stage as Stage]}</TD>
                  <TD className="text-xs">{d.decisionBody.name}</TD>
                  <TD className="text-[11px] text-slate-500">
                    {d._count.alternatives > 0 ? (
                      <Badge variant="success">альтернатив: {d._count.alternatives}</Badge>
                    ) : (
                      <Badge variant="warn">без альтернатив</Badge>
                    )}{" "}
                    {d._count.risks > 0 ? (
                      <Badge variant="outline">рисков: {d._count.risks}</Badge>
                    ) : (
                      <Badge variant="warn">риск-профиль пуст</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-slate-500">
        Уровни критичности: {ru.criticality.A as string} · {ru.criticality.B} · {ru.criticality.C}.
        Демо-контур: значения внутри паспортов синтетические.
      </p>
    </div>
  );
}
