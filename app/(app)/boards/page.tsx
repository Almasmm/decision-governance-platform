import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Compass,
  Factory,
  ShieldAlert,
  TimerReset,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDashboardStats, getMaturityIndex } from "@/lib/analytics";
import { ru } from "@/lib/i18n/ru";
import { cn, formatMoney } from "@/lib/utils";
import type { DecisionType, SourceSystem, Stage } from "@/lib/domain";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Provenance } from "@/components/provenance";
import { MaturityCard } from "@/components/maturity-card";

export const dynamic = "force-dynamic";

const PANELS = [
  {
    key: "strategy",
    label: "Стратегическая",
    navNote: "Сценарии и допущения",
    icon: Compass,
    types: ["STRATEGY", "DIGITAL"] as DecisionType[],
    indicators: ["NPV-PORT", "DIGI-AUTOM", "RPA-COUNT", "CO2-EMIS"],
    mandate: "Проверить стратегическую состоятельность и внешние предпосылки",
    question: "Какие допущения способны изменить выбранный курс?",
  },
  {
    key: "investment",
    label: "Инвестиционная",
    navNote: "CAPEX и stage gates",
    icon: CircleDollarSign,
    types: ["INVESTMENT", "PROCUREMENT"] as DecisionType[],
    indicators: ["CAPEX-EXEC", "INV-RETURN", "UR-PRICE", "PROC-LOCAL"],
    mandate: "Сопоставить капитал, альтернативы, чувствительность и готовность пакета",
    question: "Достаточна ли доказательная база для необратимого вложения капитала?",
  },
  {
    key: "production",
    label: "Производственная",
    navNote: "Ограничения и HSE",
    icon: Factory,
    types: ["PRODUCTION", "HR"] as DecisionType[],
    indicators: ["URN-PROD", "WELL-DEBIT", "ACID-STOCK", "HSE-LTIFR"],
    mandate: "Синхронизировать объём, ресурсы, график и требования безопасности",
    question: "Какое ограничение сейчас мешает исполнить производственный план?",
  },
  {
    key: "risk",
    label: "Риск-панель",
    navNote: "Exposure и триггеры",
    icon: ShieldAlert,
    types: ["RISK", "INVESTMENT", "PRODUCTION", "STRATEGY"] as DecisionType[],
    indicators: ["HSE-LTIFR", "ACID-STOCK", "FX-KZT", "COST-C1"],
    mandate: "Проверить остаточный риск, владельцев, триггеры и просроченные меры",
    question: "Какой риск организация принимает после мер контроля?",
  },
] as const;

type PanelKey = (typeof PANELS)[number]["key"];

function evidenceCoverage(decision: {
  blocks: Array<{ completeness: number }>;
  indicatorLinks: Array<{ isCritical: boolean; confirmedAt: Date | null }>;
}): number {
  const blockScore = decision.blocks.length
    ? decision.blocks.reduce((sum, block) => sum + block.completeness, 0) / decision.blocks.length
    : 0;
  const critical = decision.indicatorLinks.filter((link) => link.isCritical);
  const dataScore = critical.length
    ? (critical.filter((link) => link.confirmedAt).length / critical.length) * 100
    : 100;
  return Math.round(blockScore * 0.75 + dataScore * 0.25);
}

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const activeKey: PanelKey = PANELS.some((item) => item.key === params.panel)
    ? (params.panel as PanelKey)
    : "strategy";
  const panel = PANELS.find((item) => item.key === activeKey) ?? PANELS[0];
  const now = new Date();

  const [decisions, indicators, stats, maturity, risks] = await Promise.all([
    prisma.decision.findMany({
      where: { type: { in: [...panel.types] } },
      include: {
        decisionBody: true,
        blocks: { select: { kind: true, completeness: true } },
        indicatorLinks: { select: { isCritical: true, confirmedAt: true } },
        assumptions: { include: { owner: true }, orderBy: { validUntil: "asc" } },
        assignments: { include: { assignee: true, linkedKpi: true }, orderBy: { dueDate: "asc" } },
        calculations: { orderBy: { calculatedAt: "desc" } },
        _count: { select: { alternatives: true, risks: true } },
      },
      orderBy: [{ criticality: "asc" }, { deadline: "asc" }, { registeredAt: "desc" }],
    }),
    prisma.indicator.findMany({
      where: { code: { in: [...panel.indicators] } },
      include: { owner: true, values: { orderBy: { asOf: "desc" }, take: 1 } },
      orderBy: { code: "asc" },
    }),
    getDashboardStats(),
    getMaturityIndex(),
    prisma.risk.findMany({
      where: { decision: { type: { in: [...panel.types] } } },
      include: { decision: true, owner: true },
      orderBy: [{ impact: "desc" }, { probability: "desc" }],
      take: 10,
    }),
  ]);

  const openAssignments = decisions.flatMap((decision) =>
    decision.assignments
      .filter((assignment) => assignment.status !== "DONE")
      .map((assignment) => ({ ...assignment, decision }))
  );
  const overdueAssignments = openAssignments.filter((assignment) => assignment.dueDate < now);
  const criticalDecisions = decisions.filter((decision) => decision.criticality === "A").length;
  const avgCoverage = decisions.length
    ? Math.round(decisions.reduce((sum, decision) => sum + evidenceCoverage(decision), 0) / decisions.length)
    : 0;
  const expectedLossBefore = risks.reduce(
    (sum, risk) => sum + risk.probability * risk.impact,
    0
  );
  const expectedLossAfter = risks.reduce(
    (sum, risk) =>
      sum +
      (risk.residualProbability ?? risk.probability) *
        (risk.residualImpact ?? risk.impact),
    0
  );
  const exposureReduction = expectedLossBefore
    ? Math.round(((expectedLossBefore - expectedLossAfter) / expectedLossBefore) * 100)
    : 0;
  const PanelIcon = panel.icon;

  return (
    <div className="workspace space-y-7">
      <header className="border-b border-line pb-5">
        <p className="eyebrow">Единая доказательная база · четыре управленческие оптики</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-page font-semibold tracking-[-0.03em] text-text">Ролевые контуры</h1>
            <p className="mt-2 max-w-3xl text-lead leading-7 text-muted">
              Комитеты видят одни и те же факты, но принимают ответственность за разные свойства
              решения — стратегию, капитал, исполнение или риск.
            </p>
          </div>
          <div className="text-right text-meta text-muted">
            <span className="block font-medium text-text">Текущая роль</span>
            {(ru.roles as Record<string, string>)[user.role] ?? user.role}
          </div>
        </div>
      </header>

      <nav
        aria-label="Выбор управленческой панели"
        className="grid border-y border-line sm:grid-cols-2 xl:grid-cols-4"
        data-tour="boards-perspective"
      >
        {PANELS.map((item) => {
          const Icon = item.icon;
          const selected = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={`/boards?panel=${item.key}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "group flex min-h-20 items-center gap-3 border-line px-4 py-3 transition-colors sm:[&:nth-child(odd)]:border-r xl:border-r xl:last:border-r-0",
                selected ? "bg-obsidian text-white" : "bg-surface hover:bg-surface-raised"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", selected ? "text-accent-soft" : "text-accent")} aria-hidden="true" />
              <span>
                <span className="block text-table font-semibold">{item.label}</span>
                <span className={cn("mt-0.5 block text-meta", selected ? "text-white/60" : "text-muted")}>
                  {item.navNote}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="bg-obsidian px-5 py-6 text-white sm:px-7 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10">
        <div>
          <div className="flex items-center gap-2 text-meta font-semibold uppercase tracking-[0.16em] text-accent-soft">
            <PanelIcon className="h-4 w-4" aria-hidden="true" />
            {panel.label} ответственность
          </div>
          <h2 className="mt-4 max-w-4xl text-decision font-semibold tracking-[-0.025em]">
            {panel.question}
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-6 text-white/65">{panel.mandate}</p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-5 border-t border-white/15 pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <Metric label="В фокусе" value={String(decisions.length)} />
          <Metric label="Уровень A" value={String(criticalDecisions)} action={criticalDecisions > 0} />
          <Metric label="Доказанность" value={`${avgCoverage}%`} />
        </div>
      </section>

      <section aria-labelledby="signals-heading" data-tour="boards-evidence">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Информационный контур</p>
            <h2 id="signals-heading" className="mt-1 text-section font-semibold text-text">Опорные сигналы панели</h2>
          </div>
          <Link href="/indicators" className="hidden items-center gap-1 text-table font-medium text-accent hover:underline sm:flex">
            Каталог показателей <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid border-y border-line md:grid-cols-2 xl:grid-cols-4">
          {indicators.map((indicator, index) => {
            const latest = indicator.values[0];
            return (
              <div
                key={indicator.id}
                className={cn("min-w-0 px-4 py-4", index > 0 && "border-t border-line md:border-l", index === 2 && "md:border-l-0 xl:border-l")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-meta text-muted">{indicator.code}</span>
                  {indicator.isCritical && <Badge variant="partial">Критический</Badge>}
                </div>
                <p className="mt-2 min-h-10 text-table font-medium leading-5 text-text">{indicator.name}</p>
                <div className="mt-3 text-section font-semibold tabular-nums text-text">
                  {latest ? (
                    <Provenance
                      value={`${latest.value.toLocaleString("ru-RU")} ${indicator.unit}`}
                      nature="fact"
                      source={(ru.sourceSystems as Record<string, string>)[indicator.sourceSystem] ?? indicator.sourceSystem}
                      asOf={format(latest.asOf, "d MMM yyyy", { locale: ruLocale })}
                      owner={indicator.owner?.name}
                      formula={indicator.formula ?? undefined}
                    />
                  ) : (
                    <span className="text-table font-normal text-muted">Нет актуального значения</span>
                  )}
                </div>
                <p className="mt-2 text-meta text-muted">
                  {indicator.owner?.name ?? "Владелец не назначен"} · {ru.sourceSystems[indicator.sourceSystem as SourceSystem]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {activeKey === "strategy" && (
        <StrategyWorkspace decisions={decisions} maturity={maturity} stats={stats} now={now} />
      )}
      {activeKey === "investment" && <InvestmentWorkspace decisions={decisions} />}
      {activeKey === "production" && (
        <ProductionWorkspace decisions={decisions} openAssignments={openAssignments} now={now} />
      )}
      {activeKey === "risk" && (
        <RiskWorkspace
          risks={risks}
          before={expectedLossBefore}
          after={expectedLossAfter}
          reduction={exposureReduction}
          overdueAssignments={overdueAssignments}
        />
      )}

      <p className="border-t border-line pt-4 text-meta leading-5 text-muted">
        Все панели читают единые паспорта решений и один каталог показателей. Демо-значения
        синтетические и не являются официальными показателями компании.
      </p>
    </div>
  );
}

function Metric({ label, value, action = false }: { label: string; value: string; action?: boolean }) {
  return (
    <div>
      <div className={cn("text-decision font-semibold tabular-nums", action && "text-signal-2")}>{value}</div>
      <div className="mt-1 text-meta text-white/55">{label}</div>
    </div>
  );
}

type BoardDecision = Awaited<ReturnType<typeof prisma.decision.findMany>>[number] & {
  decisionBody: { id: string; name: string; kind: string };
  blocks: Array<{ kind: string; completeness: number }>;
  indicatorLinks: Array<{ isCritical: boolean; confirmedAt: Date | null }>;
  assumptions: Array<{
    id: string; text: string; value: string | null; confidence: string; validUntil: Date;
    owner: { id: string; name: string; email: string; role: string; passwordHash: string; createdAt: Date } | null;
  }>;
  assignments: Array<{
    id: string; text: string; status: string; dueDate: Date;
    assignee: { id: string; name: string; email: string; role: string; passwordHash: string; createdAt: Date };
    linkedKpi: { id: string; code: string; name: string } | null;
  }>;
  calculations: Array<{
    id: string; kind: string; result: number; calculatedAt: Date;
    decisionId: string; inputs: string; calculatedById: string;
    isConservative: boolean; attributionNote: string | null;
  }>;
  _count: { alternatives: number; risks: number };
};

function StrategyWorkspace({
  decisions,
  maturity,
  stats,
  now,
}: {
  decisions: BoardDecision[];
  maturity: Awaited<ReturnType<typeof getMaturityIndex>>;
  stats: Awaited<ReturnType<typeof getDashboardStats>>;
  now: Date;
}) {
  const assumptions = decisions.flatMap((decision) =>
    decision.assumptions.map((assumption) => ({ ...assumption, decision }))
  );
  const criticalAssumptions = assumptions
    .filter((assumption) => assumption.confidence !== "HIGH" || assumption.validUntil < now)
    .slice(0, 6);
  return (
    <section className="grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
      <div>
        <p className="eyebrow">Стратегия и сценарии</p>
        <h2 className="mt-1 text-section font-semibold text-text">Решения, меняющие траекторию</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {decisions.map((decision) => (
            <DecisionRow key={decision.id} decision={decision} trailing={`${decision.assumptions.length} допущений`} />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 border-l-2 border-accent pl-4">
          <SmallMetric label="С альтернативами" value={`${stats.shareWithAlternatives}%`} />
          <SmallMetric label="Возвратов" value={String(stats.totalReturns)} />
          <SmallMetric label="Пост-оценка" value={`${stats.shareWithPostEvaluation}%`} />
        </div>
      </div>
      <div className="space-y-5">
        <div className="surface-band p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-action" aria-hidden="true" />
            <h3 className="text-base font-semibold text-text">Критические допущения</h3>
          </div>
          <div className="mt-4 space-y-4">
            {criticalAssumptions.length ? criticalAssumptions.map((assumption) => (
              <div key={assumption.id} className="border-l border-line-strong pl-3">
                <p className="text-table font-medium leading-5 text-text">{assumption.text}</p>
                <p className="mt-1 text-meta text-muted">
                  {assumption.decision.code} · уверенность {ru.confidence[assumption.confidence as keyof typeof ru.confidence].toLocaleLowerCase("ru-RU")} · до {format(assumption.validUntil, "dd.MM.yyyy")}
                </p>
              </div>
            )) : <p className="text-table text-muted">Нет допущений, требующих пересмотра.</p>}
          </div>
        </div>
        <MaturityCard result={maturity.result} periodNote={maturity.periodNote} compact />
      </div>
    </section>
  );
}

function InvestmentWorkspace({ decisions }: { decisions: BoardDecision[] }) {
  return (
    <section>
      <p className="eyebrow">Капитал и stage gates</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-section font-semibold text-text">Готовность инвестиционных пакетов</h2>
        <p className="text-meta text-muted">NPV, sensitivity и funding показываются только когда зафиксированы в evidence</p>
      </div>
      <div className="mt-4 overflow-x-auto border-y border-line">
        <table className="w-full min-w-[980px] border-collapse text-left text-table">
          <thead className="bg-surface-raised text-meta uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Решение</th>
              <th className="px-3 py-3 font-semibold">NPV</th>
              <th className="px-3 py-3 font-semibold">Экономика / funding</th>
              <th className="px-3 py-3 font-semibold">Альтернативы</th>
              <th className="px-3 py-3 font-semibold">Риски</th>
              <th className="px-4 py-3 text-right font-semibold">Вывод</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {decisions.map((decision) => {
              const coverage = evidenceCoverage(decision);
              const latestNpv = decision.calculations.find((calculation) => calculation.kind === "NPV");
              const economicsCoverage = decision.blocks.find((block) => block.kind === "ECONOMICS")?.completeness ?? 0;
              const ready = coverage >= 80 && economicsCoverage >= 80 && decision._count.alternatives >= 2 && decision._count.risks > 0;
              return (
                <tr key={decision.id} className="bg-surface align-top hover:bg-surface-raised">
                  <td className="px-4 py-4">
                    <Link href={`/decisions/${decision.id}`} className="font-medium text-text hover:text-accent hover:underline">{decision.title}</Link>
                    <span className="mt-1 block font-mono text-meta text-muted">{decision.code}</span>
                  </td>
                  <td className="px-3 py-4 font-semibold tabular-nums text-text">{latestNpv ? formatMoney(latestNpv.result) : <span className="font-normal text-action">Не рассчитан</span>}</td>
                  <td className="px-3 py-4">
                    <span className="block font-semibold tabular-nums text-text">{economicsCoverage}%</span>
                    <span className="text-meta text-muted">доказанность блока</span>
                  </td>
                  <td className="px-3 py-4 tabular-nums text-text">{decision._count.alternatives}</td>
                  <td className="px-3 py-4 tabular-nums text-text">{decision._count.risks}</td>
                  <td className="px-4 py-4 text-right">
                    <Badge variant={ready ? "resolvedSoft" : "partial"}>{ready ? "Evidence покрыто" : "Есть пробелы"}</Badge>
                    <span className="mt-1 block text-meta tabular-nums text-muted">всего {coverage}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductionWorkspace({
  decisions,
  openAssignments,
  now,
}: {
  decisions: BoardDecision[];
  openAssignments: Array<BoardDecision["assignments"][number] & { decision: BoardDecision }>;
  now: Date;
}) {
  return (
    <section className="grid gap-7 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
      <div>
        <p className="eyebrow">Исполнимость</p>
        <h2 className="mt-1 text-section font-semibold text-text">Производственный поток решений</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {decisions.map((decision) => (
            <DecisionRow
              key={decision.id}
              decision={decision}
              trailing={decision.deadline ? `срок ${format(decision.deadline, "dd.MM.yyyy")}` : "срок не задан"}
            />
          ))}
        </div>
      </div>
      <div className="surface-band p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Контрольный контур</p>
            <h3 className="mt-1 text-base font-semibold text-text">Открытые действия</h3>
          </div>
          <Badge variant={openAssignments.some((item) => item.dueDate < now) ? "action" : "resolvedSoft"}>
            {openAssignments.length}
          </Badge>
        </div>
        <div className="mt-4 space-y-4">
          {openAssignments.slice(0, 7).map((assignment) => {
            const overdue = assignment.dueDate < now;
            return (
              <div key={assignment.id} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2">
                <TimerReset className={cn("mt-0.5 h-4 w-4", overdue ? "text-action" : "text-accent")} aria-hidden="true" />
                <div>
                  <p className="text-table font-medium leading-5 text-text">{assignment.text}</p>
                  <p className={cn("mt-1 text-meta", overdue ? "font-medium text-action" : "text-muted")}>
                    {assignment.assignee.name} · {overdue ? "просрочено" : "до"} {format(assignment.dueDate, "dd.MM.yyyy")}
                  </p>
                </div>
              </div>
            );
          })}
          {!openAssignments.length && <p className="text-table text-muted">Открытых действий нет.</p>}
        </div>
      </div>
    </section>
  );
}

function RiskWorkspace({
  risks,
  before,
  after,
  reduction,
  overdueAssignments,
}: {
  risks: Array<{
    id: string; name: string; probability: number; impact: number;
    residualProbability: number | null; residualImpact: number | null;
    mitigation: string; triggers: string | null;
    owner: { name: string } | null; decision: { id: string; code: string; title: string };
  }>;
  before: number;
  after: number;
  reduction: number;
  overdueAssignments: Array<BoardDecision["assignments"][number] & { decision: BoardDecision }>;
}) {
  return (
    <section className="space-y-6">
      <div className="grid gap-6 bg-surface-raised p-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:p-7">
        <div>
          <p className="eyebrow">Initial → control → residual</p>
          <h2 className="mt-1 text-section font-semibold text-text">Профиль совокупной экспозиции</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <Exposure label="До мер" value={before} width={100} />
            <ArrowRight className="hidden h-5 w-5 text-muted sm:block" aria-hidden="true" />
            <Exposure label="Остаточный риск" value={after} width={Math.max(8, before ? (after / before) * 100 : 0)} residual />
          </div>
        </div>
        <div className="border-t border-line-strong pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="text-hero font-semibold tabular-nums text-accent">−{reduction}%</div>
          <p className="mt-1 text-table font-medium text-text">снижение ожидаемого ущерба</p>
          <p className="mt-4 text-meta text-muted">Просроченных риск-действий: <span className="font-semibold text-action">{overdueAssignments.length}</span></p>
        </div>
      </div>
      <div>
        <p className="eyebrow">Top exposures</p>
        <div className="mt-3 divide-y divide-line border-y border-line">
          {risks.map((risk) => {
            const initial = risk.probability * risk.impact;
            const residual = (risk.residualProbability ?? risk.probability) * (risk.residualImpact ?? risk.impact);
            return (
              <article key={risk.id} className="grid gap-3 px-1 py-4 lg:grid-cols-[minmax(240px,1fr)_170px_170px_minmax(220px,.8fr)] lg:items-center">
                <div>
                  <p className="text-base font-medium text-text">{risk.name}</p>
                  <Link href={`/decisions/${risk.decision.id}`} className="mt-1 inline-block font-mono text-meta text-accent hover:underline">{risk.decision.code}</Link>
                  <p className="mt-2 max-w-xl text-meta leading-5 text-muted">Мера контроля: {risk.mitigation}</p>
                </div>
                <SmallMetric label="Исходный" value={formatMoney(initial)} />
                <SmallMetric label="Остаточный" value={formatMoney(residual)} />
                <div className="text-meta leading-5 text-muted">
                  <span className="block font-medium text-text">{risk.owner?.name ?? "Владелец не назначен"}</span>
                  {risk.triggers ? `Триггер: ${risk.triggers}` : "Триггер пересмотра не задан"}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DecisionRow({ decision, trailing }: { decision: BoardDecision; trailing: string }) {
  const coverage = evidenceCoverage(decision);
  return (
    <article className="grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_130px_auto] sm:items-center">
      <CriticalityBadge level={decision.criticality} />
      <div className="min-w-0">
        <Link href={`/decisions/${decision.id}`} className="text-base font-medium text-text hover:text-accent hover:underline">{decision.title}</Link>
        <p className="mt-1 font-mono text-meta text-muted">{decision.code} · {ru.stages[decision.stage as Stage]}</p>
      </div>
      <div>
        <span className="block text-base font-semibold tabular-nums text-text">{coverage}%</span>
        <span className="text-meta text-muted">доказанность</span>
      </div>
      <span className="text-meta text-muted sm:text-right">{trailing}</span>
    </article>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-base font-semibold tabular-nums text-text">{value}</span>
      <span className="text-meta text-muted">{label}</span>
    </div>
  );
}

function Exposure({
  label,
  value,
  width,
  residual = false,
}: {
  label: string;
  value: number;
  width: number;
  residual?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-meta font-medium text-muted">{label}</span>
        <span className="text-base font-semibold tabular-nums text-text">{formatMoney(value)}</span>
      </div>
      <div className="mt-2 h-3 bg-surface">
        <div className={cn("h-full", residual ? "bg-accent" : "bg-action")} style={{ width: `${Math.min(100, width)}%` }} />
      </div>
    </div>
  );
}
