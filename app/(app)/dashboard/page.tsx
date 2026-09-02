import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  getBaselineMaturity,
  getDashboardStats,
  getKpiComparison,
  getMaturityIndex,
  type KpiComparison,
} from "@/lib/analytics";
import { buildGateContext } from "@/lib/gate-service";
import { decisionInclude } from "@/lib/snapshot";
import {
  buildDashboardActionQueue,
  buildDecisionFlow,
  countAlevelAttention,
  isActiveContext,
  type DashboardAction,
} from "@/lib/presentation/dashboard";
import type { DecisionStatus } from "@/lib/domain";
import { COMPANY_FACTS_2025, COMPANY_REPORT_SOURCE, COMPANY_REPORT_URL } from "@/lib/company";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { CriticalityBadge } from "@/components/ui/badge";
import { StageFunnel } from "@/components/charts/stage-funnel";
import { MaturityCard } from "@/components/maturity-card";

export const dynamic = "force-dynamic";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Создана новая запись",
  UPDATE_ROLE: "Изменены полномочия пользователя",
  UPDATE_BLOCKING: "Изменено правило контрольных ворот",
  DELETE: "Удалена запись",
  UPDATE_PAYLOAD: "Обновлена доказательная база",
  SUBMIT_FOR_REVIEW: "Паспорт направлен на экспертизу",
  RETURN: "Материалы возвращены на доработку",
  DECIDE: "Зафиксировано решение человека",
  CLOSE: "Завершена пост-оценка решения",
  STAGE_ADVANCE: "Открыт переход на следующую стадию",
  LINK: "Показатель связан с решением",
  CONFIRM_QUALITY: "Подтверждено качество данных",
  COMPLETE: "Поручение исполнено",
  REVIEW: "Расчёт прошёл независимую проверку",
  AI_RUN: "Сформирован аналитический материал модели",
  AI_VERDICT: "Зафиксирован человеческий вердикт по рекомендации",
  LOAD_FROM_SOURCE: "Показатель обновлён из системы-источника",
  MANUAL_INPUT: "Зафиксировано ручное значение показателя",
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Decision: "Паспорт решения",
  DecisionBlock: "Блок доказательной базы",
  Alternative: "Альтернатива",
  Assumption: "Ключевое допущение",
  Risk: "Риск-профиль",
  Assignment: "Поручение",
  DecisionIndicator: "Критический показатель",
  EffectCalculation: "Расчёт эффекта",
  CalcReview: "Независимая проверка",
  AiSuggestion: "Аналитическая рекомендация",
  Lesson: "Извлечённый урок",
  Indicator: "Показатель",
  User: "Пользователь",
  DecisionBody: "Орган принятия решения",
  GateCheck: "Правило контрольных ворот",
};

function pluralRu(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, maturity, baselineMaturity, comparisons, decisions, events] = await Promise.all([
    getDashboardStats(),
    getMaturityIndex(),
    getBaselineMaturity(),
    getKpiComparison(),
    prisma.decision.findMany({
      include: decisionInclude,
      orderBy: [{ criticality: "asc" }, { deadline: "asc" }],
    }),
    prisma.auditEvent.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const contexts = await Promise.all(decisions.map((decision) => buildGateContext(decision)));
  const activeContexts = contexts.filter(isActiveContext);
  const blockedCount = activeContexts.filter(
    (context) => context.evaluation && !context.evaluation.allowed
  ).length;
  const actions = buildDashboardActionQueue(user, contexts);
  const aLevelAttention = countAlevelAttention(contexts);
  const flow = buildDecisionFlow(contexts);
  const focus = [...activeContexts]
    .filter((context) => context.decision.criticality === "A")
    .sort((a, b) => {
      const aBlocked = a.evaluation?.allowed === false ? 1 : 0;
      const bBlocked = b.evaluation?.allowed === false ? 1 : 0;
      const aDecision = a.currentStage === "DECISION" ? 1 : 0;
      const bDecision = b.currentStage === "DECISION" ? 1 : 0;
      return bBlocked - aBlocked || bDecision - aDecision;
    })[0];
  const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));

  return (
    <div className="space-y-5">
      <ExecutiveSituation
        userName={user.name}
        role={ru.roles[user.role]}
        active={activeContexts.length}
        total={stats.total}
        actions={actions.length}
        blocked={blockedCount}
        aLevelAttention={aLevelAttention}
        focus={focus}
      />

      <ActionQueue actions={actions} />

      <section className="border-y border-rule bg-sheet" aria-labelledby="decision-flow-title">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
          <div>
            <p className="font-technical text-meta text-ink-muted">От проблемы к обратной связи</p>
            <h2 id="decision-flow-title" className="mt-1 font-ui text-section font-semibold text-ink">
              Жизненный цикл решений
            </h2>
            <p className="mt-1 max-w-3xl text-base text-ink-muted">
              Распределение активного портфеля и точки управленческого трения перед следующим переходом.
            </p>
          </div>
          <div className={cn("text-right", blockedCount > 0 ? "text-signal" : "text-ink-muted")}>
            <div className="flex items-center justify-end gap-1.5 text-base font-semibold">
              {blockedCount > 0 ? (
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              {blockedCount > 0 ? `${blockedCount} закрытых ворот` : "Закрытых ворот нет"}
            </div>
            <p className="text-meta">Рассчитано штатным движком контрольных ворот</p>
          </div>
        </header>
        <div className="px-4 py-5 sm:px-5">
          <StageFunnel data={flow} />
        </div>
      </section>

      <ProcessHealth comparisons={comparisons} stats={stats} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <MaturityCard
          result={maturity.result}
          periodNote={maturity.periodNote}
          baseline={baselineMaturity}
        />

        <section className="border-y border-rule bg-sheet" aria-labelledby="events-title">
          <header className="flex items-end justify-between gap-3 border-b border-rule px-4 py-3">
            <div>
              <h2 id="events-title" className="font-ui text-section font-semibold text-ink">
                Значимые события
              </h2>
              <p className="text-meta text-ink-muted">Человеческий язык; техническая запись — в аудите</p>
            </div>
            <Link href="/audit" className="shrink-0 text-meta font-medium text-graphite hover:underline">
              Весь аудит →
            </Link>
          </header>
          <ol className="divide-y divide-rule">
            {events.slice(0, 5).map((event) => {
              const decision = decisionById.get(event.entityId);
              const label = AUDIT_ACTION_LABELS[event.action] ?? "Обновлена запись контура";
              const entity = decision?.code ?? AUDIT_ENTITY_LABELS[event.entity] ?? "Объект контура";
              const href = decision ? `/decisions/${decision.id}?tab=audit` : "/audit";
              return (
                <li key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={href} className="font-medium text-ink hover:underline">
                        {label}
                      </Link>
                      <p className="mt-0.5 truncate text-meta text-ink-muted" title={decision?.title ?? entity}>
                        {entity}{decision ? ` · ${decision.title}` : ""}
                      </p>
                    </div>
                    <time className="shrink-0 font-technical text-meta text-ink-muted" dateTime={event.createdAt.toISOString()}>
                      {format(event.createdAt, "d MMM, HH:mm", { locale: ruLocale })}
                    </time>
                  </div>
                  <p className="mt-1 text-meta text-ink-muted">{event.actor.name}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <details className="border-y border-rule bg-sheet">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-base font-medium text-ink sm:px-5">
          <span>Публичный контекст компании · интегрированный годовой отчёт 2025</span>
          <span className="text-meta font-normal text-ink-muted">раскрыть</span>
        </summary>
        <div className="border-t border-rule px-4 py-4 sm:px-5">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            {COMPANY_FACTS_2025.map((fact) => (
              <div key={fact.label}>
                <dt className="text-meta text-ink-muted">{fact.label}</dt>
                <dd className="mt-0.5 text-base font-semibold text-ink">
                  {fact.value}
                  {fact.note && <span className="ml-1 text-meta font-normal text-ink-muted">{fact.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <a
            href={COMPANY_REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-meta font-medium text-graphite hover:underline"
          >
            {COMPANY_REPORT_SOURCE}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <p className="mt-1 text-meta text-ink-muted">
            {ru.annualReportNote}. Показатели внутри паспортов решений — синтетические демо-данные.
          </p>
        </div>
      </details>
    </div>
  );
}

function ExecutiveSituation({
  userName,
  role,
  active,
  total,
  actions,
  blocked,
  aLevelAttention,
  focus,
}: {
  userName: string;
  role: string;
  active: number;
  total: number;
  actions: number;
  blocked: number;
  aLevelAttention: number;
  focus: Awaited<ReturnType<typeof buildGateContext>> | undefined;
}) {
  const focusFailed = focus?.evaluation?.results.filter((result) => !result.passed).length ?? 0;

  return (
    <section className="overflow-hidden border border-graphite bg-graphite text-paper" aria-labelledby="dashboard-title">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.4fr)]">
        <div className="px-5 py-5 sm:px-6">
          <p className="font-technical text-meta text-rule-strong">Executive Decision Cockpit</p>
          <h1 id="dashboard-title" className="mt-2 font-ui text-page font-semibold text-paper">
            Контур управленческих решений
          </h1>
          <p className="mt-2 max-w-3xl text-lead text-rule-strong">
            Активный портфель: {active} из {total}. Ваших действий: {actions}; закрытых контрольных
            ворот: {blocked}; решений уровня A в зоне повышенного внимания: {aLevelAttention}.
          </p>

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <dt className="text-meta text-rule-strong">Активный портфель</dt>
              <dd className="mt-0.5 text-section font-semibold tabular-nums text-paper">{active}</dd>
            </div>
            <div>
              <dt className="text-meta text-rule-strong">Ваши действия</dt>
              <dd className={cn("mt-0.5 text-section font-semibold tabular-nums", actions > 0 ? "text-paper" : "text-rule-strong")}>
                {actions}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-rule-strong">Закрытые ворота</dt>
              <dd className={cn("mt-0.5 text-section font-semibold tabular-nums", blocked > 0 ? "text-paper" : "text-rule-strong")}>
                {blocked}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-rule-strong">Уровень A в фокусе</dt>
              <dd className="mt-0.5 text-section font-semibold tabular-nums text-paper">{aLevelAttention}</dd>
            </div>
          </dl>

          <p className="mt-5 text-meta text-rule-strong">
            {userName} · {role}
          </p>
        </div>

        <div className="border-t border-graphite-line bg-graphite-soft px-5 py-5 lg:border-l lg:border-t-0 sm:px-6">
          <p className="text-meta font-semibold text-rule-strong">Сейчас в фокусе</p>
          {focus ? (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="border border-paper px-1.5 py-0.5 font-technical text-meta font-semibold text-paper">
                  УРОВЕНЬ A
                </span>
                <span className="font-technical text-meta text-rule-strong">{focus.decision.code}</span>
              </div>
              <h2 className="mt-3 font-ui text-lead font-semibold text-paper">{focus.decision.title}</h2>
              <p className="mt-2 text-meta text-rule-strong">
                {ru.stages[focus.currentStage]} · {ru.statuses[focus.decision.status as DecisionStatus]}
              </p>
              <p className="mt-3 text-base text-paper">
                {focusFailed > 0
                  ? `${focusFailed} обязательных условий следующего перехода не подтверждены.`
                  : "Доказательная база готова к следующему управленческому действию."}
              </p>
              <Link
                href={`/decisions/${focus.decision.id}`}
                className="mt-4 inline-flex items-center gap-2 border border-paper px-3 py-2 text-base font-semibold text-paper hover:bg-paper hover:text-graphite"
              >
                Открыть паспорт
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-base text-rule-strong">Активных решений уровня A нет.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ActionQueue({ actions }: { actions: DashboardAction[] }) {
  const visible = actions.slice(0, 3);

  return (
    <section className="border-y border-rule bg-sheet" aria-labelledby="action-queue-title">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <div>
          <h2 id="action-queue-title" className="font-ui text-section font-semibold text-ink">
            Сейчас требуется от вас
          </h2>
          <p className="text-meta text-ink-muted">Очередь сформирована по роли, gates и назначенным поручениям</p>
        </div>
        <span className="font-technical text-meta text-ink-muted">
          {actions.length} {pluralRu(actions.length, "действие", "действия", "действий")}
          {actions.length > visible.length ? ` · показано: ${visible.length}` : ""}
        </span>
      </header>

      {visible.length > 0 ? (
        <ol className="divide-y divide-rule">
          {visible.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                "grid gap-x-4 gap-y-2 border-l-2 px-4 py-3 sm:px-5 lg:grid-cols-[132px_minmax(0,1fr)_180px_120px_32px] lg:items-center",
                item.urgency === "normal" ? "border-l-rule-strong" : "border-l-signal"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-technical text-meta text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                <CriticalityBadge level={item.criticality} />
                <span className="font-technical text-meta font-semibold text-ink">{item.decisionCode}</span>
              </div>
              <div className="min-w-0">
                <Link href={item.href} className="font-semibold text-ink hover:underline">
                  {item.action}
                </Link>
                <p className="mt-0.5 truncate text-meta text-ink-muted" title={item.reason}>
                  {item.reason}
                </p>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 text-meta text-ink-muted">
                <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate" title={item.responsible}>{item.responsible}</span>
              </div>
              <div className={cn("text-meta", item.urgency === "overdue" ? "font-semibold text-signal" : "text-ink-muted")}>
                {item.dueAt
                  ? item.urgency === "overdue"
                    ? `Просрочено · ${format(item.dueAt, "d MMM", { locale: ruLocale })}`
                    : `До ${format(item.dueAt, "d MMM", { locale: ruLocale })}`
                  : item.urgency === "high"
                    ? "Высокий приоритет"
                    : "В очереди"}
              </div>
              <Link
                href={item.href}
                aria-label={`Открыть ${item.decisionCode}: ${item.action}`}
                className="inline-flex h-8 w-8 items-center justify-center justify-self-end rounded-control text-graphite hover:bg-surface-raised"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex items-center gap-3 px-4 py-5 text-base text-ink sm:px-5">
          <CheckCircle2 className="h-5 w-5 text-graphite" aria-hidden="true" />
          Для вашей роли нет действий, ожидающих выполнения.
        </div>
      )}
    </section>
  );
}

function ProcessHealth({
  comparisons,
  stats,
}: {
  comparisons: KpiComparison[];
  stats: Awaited<ReturnType<typeof getDashboardStats>>;
}) {
  const metric = (code: string) => comparisons.find((item) => item.metricCode === code);
  const speed = metric("SPEED_MEDIAN_DAYS");
  const speedValue = speed?.pilot?.value ?? stats.medianPreparationDays;
  const speedBaseline = speed?.baseline?.value ?? null;
  const speedDelta = speedValue !== null && speedBaseline !== null ? speedValue - speedBaseline : null;
  const health = [
    {
      label: "Доказательность",
      metric: metric("JUST_ALT_SHARE"),
      fallback: stats.shareWithAlternatives,
      description: "решений содержат сопоставимые альтернативы и риск-сценарии",
    },
    {
      label: "Исполнимость",
      metric: metric("EXEC_KPI_LINKED_SHARE"),
      fallback: stats.shareAssignmentsWithKpi,
      description: "поручений связаны с измеримым KPI результата",
    },
    {
      label: "Обучение",
      metric: metric("LEARN_POSTEVAL_SHARE"),
      fallback: stats.shareWithPostEvaluation,
      description: "решений прошли пост-оценку с фиксацией урока",
    },
  ];

  return (
    <section className="border-y border-rule bg-sheet" aria-labelledby="process-health-title">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <div>
          <h2 id="process-health-title" className="font-ui text-section font-semibold text-ink">
            Здоровье процесса
          </h2>
          <p className="text-meta text-ink-muted">Скорость · доказательность · исполнимость · обучение</p>
        </div>
        <Link href="/kpi" className="text-meta font-medium text-graphite hover:underline">
          Методика и выборки →
        </Link>
      </header>

      <div className="grid lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <div className="px-4 py-5 sm:px-5 lg:border-r lg:border-rule">
          <p className="text-base font-semibold text-ink">Скорость подготовки решения</p>
          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
            <strong className="text-hero font-semibold tabular-nums text-ink">
              {speedValue !== null ? speedValue.toLocaleString("ru-RU") : "—"}
            </strong>
            <span className="pb-1 text-base text-ink-muted">дней, медиана</span>
          </div>
          <p className="mt-2 text-base font-medium text-graphite">
            {speedDelta !== null
              ? `${speedDelta < 0 ? "↓" : "↑"} ${Math.abs(speedDelta).toLocaleString("ru-RU")} дней к baseline`
              : "Для сравнения с baseline недостаточно данных"}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-rule pt-3 text-meta">
            <div>
              <dt className="text-ink-muted">Baseline</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {speedBaseline !== null ? `${speedBaseline.toLocaleString("ru-RU")} дней` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Пилот</dt>
              <dd className="mt-0.5 font-medium text-ink">
                n = {speed?.pilot?.sampleSize ?? stats.preparationSample}
              </dd>
            </div>
          </dl>
        </div>

        <div className="divide-y divide-rule">
          {health.map((item) => {
            const value = item.metric?.pilot?.value ?? item.fallback;
            const baseline = item.metric?.baseline?.value ?? null;
            const delta = baseline !== null ? value - baseline : null;
            const width = Math.max(0, Math.min(100, value));
            return (
              <div key={item.label} className="grid gap-3 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)_88px] sm:items-center sm:px-5">
                <div>
                  <h3 className="font-ui text-base font-semibold text-ink">{item.label}</h3>
                  <p className="mt-0.5 text-meta text-ink-muted">{item.description}</p>
                </div>
                <div>
                  <div className="h-1.5 bg-paper" aria-hidden="true">
                    <div className="h-full bg-graphite" style={{ width: `${width}%` }} />
                  </div>
                  <p className="mt-1.5 text-meta text-ink-muted">
                    {delta !== null
                      ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("ru-RU")} п.п. к baseline`
                      : "Baseline не задан"}
                  </p>
                </div>
                <strong className="text-right text-section font-semibold tabular-nums text-ink">{value}%</strong>
              </div>
            );
          })}
        </div>
      </div>

      <p className="border-t border-rule px-4 py-2 text-meta text-ink-muted sm:px-5">
        Пилотные KPI характеризуют процесс принятия решений и не являются официальными показателями компании.
      </p>
    </section>
  );
}
