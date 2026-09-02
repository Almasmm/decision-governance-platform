import Link from "next/link";
import { format, isBefore } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Filter, Plus, RotateCcw, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { buildGateContext } from "@/lib/gate-service";
import { decisionInclude } from "@/lib/snapshot";
import { ru } from "@/lib/i18n/ru";
import {
  CRITICALITIES,
  DECISION_TYPES,
  STAGES,
  STATUSES,
  type Criticality,
  type DecisionStatus,
  type DecisionType,
  type Stage,
} from "@/lib/domain";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface Filters {
  type?: string;
  criticality?: string;
  stage?: string;
  status?: string;
  body?: string;
  q?: string;
  overdue?: string;
}

const STAGE_OWNER: Record<Stage, string> = {
  PROBLEM: "Инициатор",
  DATA: "Владелец данных",
  ALTERNATIVES: "Инициатор / Аналитик",
  RISKS: "Риск-офицер",
  DECISION: "Орган принятия решения",
  EXECUTION: "Исполнитель",
  FEEDBACK: "Инициатор / Аналитик",
};

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = await requireUser();
  const f = await searchParams;

  const where: Prisma.DecisionWhereInput = {};
  if (f.type && DECISION_TYPES.includes(f.type as DecisionType)) where.type = f.type;
  if (f.criticality && CRITICALITIES.includes(f.criticality as Criticality)) where.criticality = f.criticality;
  if (f.stage && STAGES.includes(f.stage as Stage)) where.stage = f.stage;
  if (f.status && STATUSES.includes(f.status as DecisionStatus)) where.status = f.status;
  if (f.body) where.decisionBodyId = f.body;
  if (f.q) where.OR = [{ title: { contains: f.q } }, { code: { contains: f.q } }, { goal: { contains: f.q } }];
  if (f.overdue === "1") {
    where.AND = [{ deadline: { lt: new Date() } }, { status: { notIn: ["CLOSED", "REJECTED"] } }];
  }

  const [decisions, bodies] = await Promise.all([
    prisma.decision.findMany({ where, include: decisionInclude, orderBy: { registeredAt: "desc" } }),
    prisma.decisionBody.findMany({ orderBy: { name: "asc" } }),
  ]);
  const contexts = await Promise.all(decisions.map((decision) => buildGateContext(decision)));
  const blockedCount = contexts.filter((context) => context.evaluation && !context.evaluation.allowed).length;
  const levelACount = decisions.filter((decision) => decision.criticality === "A").length;
  const overdueCount = decisions.filter(
    (decision) =>
      decision.deadline &&
      isBefore(decision.deadline, new Date()) &&
      !["CLOSED", "REJECTED"].includes(decision.status)
  ).length;

  return (
    <div className="workspace space-y-6" data-tour="decisions-registry">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Portfolio control</p>
          <h1 className="mt-2 text-page font-semibold tracking-[-0.035em] text-text">Реестр решений</h1>
          <p className="mt-2 max-w-3xl text-lead text-muted">
            Операционный вид полного жизненного цикла: стадия, контрольные ворота и текущая ответственность.
          </p>
        </div>
        {can(user.role, "decision.create") && (
          <Link
            href="/decisions/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control bg-accent px-5 font-ui text-lead font-semibold text-surface transition-colors duration-150 hover:bg-obsidian"
            data-tour="decision-create"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Создать паспорт
          </Link>
        )}
      </header>

      <section
        className="grid overflow-hidden rounded-panel bg-obsidian text-surface shadow-panel sm:grid-cols-3"
        data-tour="decision-registry-signals"
      >
        <div className="px-5 py-4">
          <div className="text-hero font-semibold tracking-[-0.04em]">{decisions.length}</div>
          <div className="text-table text-line-strong">решений в текущей выборке</div>
        </div>
        <div className="border-t border-obsidian-line px-5 py-4 sm:border-l sm:border-t-0">
          <div className="text-hero font-semibold tracking-[-0.04em] text-action-step-3">{blockedCount}</div>
          <div className="text-table text-line-strong">заблокированы контрольными воротами</div>
        </div>
        <div className="border-t border-obsidian-line px-5 py-4 sm:border-l sm:border-t-0">
          <div className="flex items-baseline gap-4">
            <span className="text-hero font-semibold tracking-[-0.04em]">{levelACount}</span>
            {overdueCount > 0 && <span className="text-table text-action-step-3">{overdueCount} просрочено</span>}
          </div>
          <div className="text-table text-line-strong">решений уровня A</div>
        </div>
      </section>

      <section className="surface-band p-4" aria-label="Фильтры реестра" data-tour="decisions-filters">
        <form method="get" className="grid gap-3 lg:grid-cols-[minmax(260px,2fr)_repeat(3,minmax(140px,1fr))_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Код, название или управленческая цель"
              aria-label="Поиск по коду, названию или управленческой цели"
              className="h-9 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-base text-text placeholder:text-muted focus:border-accent"
            />
          </label>
          <select name="criticality" defaultValue={f.criticality ?? ""} aria-label="Уровень критичности" className="h-9 rounded-control border border-line bg-surface px-3 text-table">
            <option value="">Все уровни</option>
            {CRITICALITIES.map((level) => <option key={level} value={level}>{ru.criticality[level]}</option>)}
          </select>
          <select name="stage" defaultValue={f.stage ?? ""} aria-label="Стадия жизненного цикла" className="h-9 rounded-control border border-line bg-surface px-3 text-table">
            <option value="">Все стадии</option>
            {STAGES.map((stage) => <option key={stage} value={stage}>{ru.stages[stage]}</option>)}
          </select>
          <select name="status" defaultValue={f.status ?? ""} aria-label="Статус решения" className="h-9 rounded-control border border-line bg-surface px-3 text-table">
            <option value="">Все статусы</option>
            {STATUSES.map((status) => <option key={status} value={status}>{ru.statuses[status]}</option>)}
          </select>
          <Button type="submit">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Применить
          </Button>

          <details className="lg:col-span-full">
            <summary className="cursor-pointer text-table font-medium text-accent">Дополнительные фильтры</summary>
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <select name="type" defaultValue={f.type ?? ""} aria-label="Тип решения" className="h-9 rounded-control border border-line bg-surface px-3 text-table">
                <option value="">Все типы решений</option>
                {DECISION_TYPES.map((type) => <option key={type} value={type}>{ru.decisionTypes[type]}</option>)}
              </select>
              <select name="body" defaultValue={f.body ?? ""} aria-label="Орган принятия решения" className="h-9 min-w-56 rounded-control border border-line bg-surface px-3 text-table">
                <option value="">Все органы принятия</option>
                {bodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
              </select>
              <label className="flex h-9 items-center gap-2 rounded-control border border-line px-3 text-table text-muted">
                <input type="checkbox" name="overdue" value="1" defaultChecked={f.overdue === "1"} />
                Только просроченные
              </label>
              <Link
                href="/decisions"
                className="inline-flex min-h-8 items-center justify-center rounded-control px-3 text-table font-semibold text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-text"
              >
                Сбросить
              </Link>
            </div>
          </details>
        </form>
      </section>

      <section
        className="overflow-hidden rounded-panel bg-surface shadow-panel"
        aria-label="Решения"
        data-tour="decision-registry-table"
      >
        <Table tabIndex={0}>
          <caption className="sr-only">Реестр управленческих решений с текущей стадией, состоянием контрольных ворот и ответственностью</caption>
          <THead>
            <TR>
              <TH scope="col" data-tour="decision-registry-code">Код / предмет решения</TH>
              <TH scope="col" data-tour="decision-registry-criticality">Уровень</TH>
              <TH scope="col" data-tour="decision-registry-stage">Стадия</TH>
              <TH scope="col" data-tour="decisions-gate">Контрольные ворота</TH>
              <TH scope="col" data-tour="decisions-responsibility">Текущая ответственность</TH>
              <TH scope="col" data-tour="decision-registry-authority">Орган принятия</TH>
              <TH scope="col" data-tour="decision-registry-deadline">Срок</TH>
              <TH scope="col" data-tour="decision-registry-status">Статус</TH>
            </TR>
          </THead>
          <TBody>
            {decisions.length === 0 && (
              <TR>
                <TD colSpan={8} className="py-12 text-center text-base text-muted">По заданным фильтрам решений не найдено.</TD>
              </TR>
            )}
            {decisions.map((decision, index) => {
              const context = contexts[index]!;
              const failed = context.evaluation?.results.filter((result) => !result.passed) ?? [];
              const needsHumanVerdict =
                decision.stage === "DECISION" && decision.status !== "APPROVED" && context.evaluation?.allowed;
              const overdue =
                decision.deadline &&
                isBefore(decision.deadline, new Date()) &&
                !["CLOSED", "REJECTED"].includes(decision.status);
              const owner = needsHumanVerdict
                ? decision.decisionBody.name
                : failed[0]?.responsible ?? STAGE_OWNER[decision.stage as Stage];
              const stageIndex = STAGES.indexOf(decision.stage as Stage) + 1;

              return (
                <TR key={decision.id} className={failed.length > 0 || needsHumanVerdict ? "bg-action-soft" : undefined}>
                  <TD className="min-w-72 max-w-[420px]">
                    <Link href={`/decisions/${decision.id}`} className="font-technical text-meta font-semibold text-accent hover:underline">
                      {decision.code}
                    </Link>
                    <Link href={`/decisions/${decision.id}`} className="mt-1 block text-base font-semibold leading-5 text-text hover:text-accent">
                      {decision.title}
                    </Link>
                    {decision.returnCount > 0 && (
                      <span className="mt-1 inline-flex items-center gap-1 text-meta text-action">
                        <RotateCcw className="h-3 w-3" aria-hidden="true" /> {decision.returnCount} возврат(а)
                      </span>
                    )}
                  </TD>
                  <TD><CriticalityBadge level={decision.criticality} /></TD>
                  <TD className="min-w-32">
                    <div className="font-medium text-text">{ru.stages[decision.stage as Stage]}</div>
                    <div className="mt-1 flex items-center gap-2 text-meta text-muted">
                      <span>{String(stageIndex).padStart(2, "0")} / 07</span>
                      <span className="h-1 w-14 overflow-hidden rounded-full bg-surface-raised">
                        <span className="block h-full bg-accent" style={{ width: `${(stageIndex / STAGES.length) * 100}%` }} />
                      </span>
                    </div>
                  </TD>
                  <TD className="min-w-36">
                    {!context.targetStage ? (
                      <Badge variant="resolvedSoft">Цикл завершён</Badge>
                    ) : needsHumanVerdict ? (
                      <Badge variant="action">Вердикт человека</Badge>
                    ) : failed.length > 0 ? (
                      <div>
                        <Badge variant="action">Закрыт · {failed.length}</Badge>
                        <div className="mt-1 max-w-44 text-meta text-action">{failed[0]?.explanation}</div>
                      </div>
                    ) : (
                      <Badge variant="resolvedSoft">Готов к переходу</Badge>
                    )}
                  </TD>
                  <TD className="min-w-36 font-medium text-text">{owner}</TD>
                  <TD className="min-w-40 text-muted">{decision.decisionBody.name}</TD>
                  <TD className={overdue ? "whitespace-nowrap font-semibold text-action" : "whitespace-nowrap text-muted"}>
                    {decision.deadline ? format(decision.deadline, "d MMM yyyy", { locale: ruLocale }) : "—"}
                    {overdue && <span className="block text-meta">срок истёк</span>}
                  </TD>
                  <TD className="min-w-32 text-muted">{ru.statuses[decision.status as DecisionStatus]}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
