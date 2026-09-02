import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import type { Prisma } from "@prisma/client";
import { Activity, ArrowLeft, ArrowRight, Filter, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  parseAuditPayload,
  presentAuditEvent,
  prettyAuditJson,
} from "@/lib/presentation/audit";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const controlClass =
  "h-9 min-w-36 rounded-control border border-line-strong bg-surface px-3 text-table text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft";

type SearchParams = {
  entity?: string;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  const filters = await searchParams;
  const page = Math.max(1, Number(filters.page ?? "1") || 1);

  const where: Prisma.AuditEventWhereInput = {};
  if (filters.entity) where.entity = filters.entity;
  if (filters.action) where.action = filters.action;
  if (filters.actor) where.actorId = filters.actor;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [events, total, users, entities, actions] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditEvent.count({ where }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditEvent.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
    prisma.auditEvent.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const candidateDecisionIds = new Set<string>();
  for (const event of events) {
    if (event.entity === "Decision") candidateDecisionIds.add(event.entityId);
    const after = parseAuditPayload(event.after);
    const before = parseAuditPayload(event.before);
    const referenced = after?.decisionId ?? before?.decisionId;
    if (typeof referenced === "string") candidateDecisionIds.add(referenced);
    if (event.entity === "AiSuggestion") candidateDecisionIds.add(event.entityId);
  }

  const [decisions, suggestions] = await Promise.all([
    prisma.decision.findMany({
      where: { id: { in: [...candidateDecisionIds] } },
      select: { id: true, code: true, title: true },
    }),
    prisma.aiSuggestion.findMany({
      where: {
        id: {
          in: events.filter((event) => event.entity === "AiSuggestion").map((event) => event.entityId),
        },
      },
      select: { id: true, decision: { select: { id: true, code: true, title: true } } },
    }),
  ]);

  const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
  const suggestionDecisionById = new Map(
    suggestions.map((suggestion) => [suggestion.id, suggestion.decision])
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = [
    filters.entity,
    filters.action,
    filters.actor,
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  const hrefForPage = (target: number): string => {
    const params = new URLSearchParams();
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.action) params.set("action", filters.action);
    if (filters.actor) params.set("actor", filters.actor);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("page", String(target));
    return `/audit?${params.toString()}`;
  };

  const grouped = new Map<string, typeof events>();
  for (const event of events) {
    const dateKey = format(event.createdAt, "yyyy-MM-dd");
    const current = grouped.get(dateKey) ?? [];
    current.push(event);
    grouped.set(dateKey, current);
  }

  return (
    <div className="workspace space-y-7" data-tour="audit">
      <header className="grid gap-5 border-b border-line pb-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div>
          <p className="eyebrow">Контрольный контур</p>
          <h1 className="mt-2 text-page font-semibold tracking-[-0.03em] text-text">{ru.nav.audit}</h1>
          <p className="mt-2 max-w-3xl text-lead leading-7 text-muted">
            Хронология ответственности: кто изменил доказательную базу, подтвердил качество данных
            или санкционировал движение решения.
          </p>
        </div>
        <div className="border-l-2 border-accent pl-4">
          <div className="flex items-center gap-2 text-table font-semibold text-text">
            <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
            Системный журнал событий
          </div>
          <p className="mt-1 text-meta leading-5 text-muted">
            {total.toLocaleString("ru-RU")} событий по текущей выборке · технические данные доступны
            внутри каждой записи. Роль берётся из текущей учётной записи участника, а основание
            отображается только когда оно сохранено в payload события.
          </p>
        </div>
      </header>

      <section
        aria-label="Фильтры журнала"
        className="surface-band px-4 py-4 sm:px-5"
        data-tour="audit-filters"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-table font-semibold text-text">
            <Filter className="h-4 w-4 text-accent" aria-hidden="true" />
            Фильтры хронологии
          </div>
          {activeFilterCount > 0 && (
            <span className="text-meta text-muted">Активно: {activeFilterCount}</span>
          )}
        </div>
        <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1.2fr_auto_auto_auto] xl:items-end">
          <label className="text-meta font-medium text-muted">
            Сущность
            <select name="entity" defaultValue={filters.entity ?? ""} className={`mt-1 block w-full ${controlClass}`}>
              <option value="">Все сущности</option>
              {entities.map(({ entity }) => (
                <option key={entity} value={entity}>
                  {AUDIT_ENTITY_LABELS[entity] ?? entity}
                </option>
              ))}
            </select>
          </label>
          <label className="text-meta font-medium text-muted">
            Действие
            <select name="action" defaultValue={filters.action ?? ""} className={`mt-1 block w-full ${controlClass}`}>
              <option value="">Все действия</option>
              {actions.map(({ action }) => (
                <option key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action] ?? action}
                </option>
              ))}
            </select>
          </label>
          <label className="text-meta font-medium text-muted">
            Ответственный
            <select name="actor" defaultValue={filters.actor ?? ""} className={`mt-1 block w-full ${controlClass}`}>
              <option value="">Все пользователи</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </label>
          <label className="text-meta font-medium text-muted">
            С даты
            <input type="date" name="from" defaultValue={filters.from ?? ""} className={`mt-1 block ${controlClass}`} />
          </label>
          <label className="text-meta font-medium text-muted">
            По дату
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={`mt-1 block ${controlClass}`} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Применить</Button>
            <Link
              href="/audit"
              className="inline-flex h-8 items-center justify-center rounded-control px-3 text-table font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-text"
            >
              Сбросить
            </Link>
          </div>
        </form>
      </section>

      <section aria-labelledby="timeline-heading" data-tour="audit-timeline">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Audit timeline</p>
            <h2 id="timeline-heading" className="mt-1 text-section font-semibold text-text">
              Последовательность управленческих действий
            </h2>
          </div>
          <span className="hidden text-meta tabular-nums text-muted sm:inline">
            Страница {page} из {totalPages}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="border-y border-line py-14 text-center">
            <Activity className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
            <p className="mt-3 text-base font-medium text-text">Событий по выбранным условиям нет</p>
            <p className="mt-1 text-table text-muted">Измените фильтры или сбросьте период.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {[...grouped.entries()].map(([dateKey, dayEvents]) => (
              <section key={dateKey} aria-labelledby={`day-${dateKey}`}>
                <div className="mb-1 grid grid-cols-[56px_18px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[76px_22px_minmax(0,1fr)] sm:gap-x-4">
                  <div />
                  <div className="flex justify-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent-soft" />
                  </div>
                  <h3 id={`day-${dateKey}`} className="pb-3 text-base font-semibold capitalize text-text">
                    {format(dayEvents[0]!.createdAt, "d MMMM yyyy, EEEE", { locale: ruLocale })}
                  </h3>
                </div>

                {dayEvents.map((event, index) => {
                  const view = presentAuditEvent(event);
                  const directDecision = view.decisionId ? decisionById.get(view.decisionId) : undefined;
                  const suggestionDecision =
                    event.entity === "AiSuggestion"
                      ? suggestionDecisionById.get(event.entityId)
                      : undefined;
                  const decision = directDecision ?? suggestionDecision;
                  return (
                    <article
                      key={event.id}
                      className="group grid grid-cols-[56px_18px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[76px_22px_minmax(0,1fr)] sm:gap-x-4"
                      data-tour={event.id === events[0]?.id ? "audit-event" : undefined}
                    >
                      <time className="pt-5 text-right font-mono text-meta tabular-nums text-muted" dateTime={event.createdAt.toISOString()}>
                        {format(event.createdAt, "HH:mm")}
                      </time>
                      <div className="relative flex justify-center">
                        <span className="absolute inset-y-0 w-px bg-line" />
                        <span className="relative mt-6 h-2 w-2 rounded-full border-2 border-accent bg-canvas transition group-hover:scale-125" />
                      </div>
                      <div className={`min-w-0 py-4 ${index < dayEvents.length - 1 ? "border-b border-line" : ""}`}>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-base font-semibold text-text">{event.actor.name}</span>
                          <span className="text-meta text-muted">{view.actionLabel.toLocaleLowerCase("ru-RU")}</span>
                        </div>
                        <p className="mt-2 text-lead font-medium leading-6 text-text">{view.headline}</p>
                        {decision && (
                          <Link
                            href={`/decisions/${decision.id}`}
                            className="mt-2 inline-flex max-w-full items-center gap-2 text-table font-medium text-accent hover:underline"
                          >
                            <span className="font-mono text-meta">{decision.code}</span>
                            <span className="truncate">{decision.title}</span>
                          </Link>
                        )}
                        {view.primaryDetail && (
                          <p className="mt-2 max-w-4xl text-base leading-6 text-text">{view.primaryDetail}</p>
                        )}
                        {view.secondaryDetail && (
                          <p className="mt-1 max-w-4xl text-table leading-5 text-muted">{view.secondaryDetail}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-control bg-surface-raised px-2 py-1 text-meta font-medium text-muted">
                            {view.entityLabel}
                          </span>
                          <details
                            className="technical-detail group/details"
                            data-tour={event.id === events[0]?.id ? "audit-technical" : undefined}
                          >
                            <summary className="cursor-pointer list-none text-meta font-medium text-muted underline-offset-4 hover:text-text hover:underline">
                              Показать техническую запись
                            </summary>
                            <div className="mt-3 grid max-w-4xl gap-3 lg:grid-cols-2">
                              <div>
                                <p className="mb-1 text-meta font-semibold uppercase tracking-wider text-muted">Было</p>
                                <pre className="max-h-64 overflow-auto rounded-control bg-obsidian p-3 font-mono text-meta leading-5 text-white/80">
                                  {prettyAuditJson(event.before)}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-1 text-meta font-semibold uppercase tracking-wider text-muted">Стало</p>
                                <pre className="max-h-64 overflow-auto rounded-control bg-obsidian p-3 font-mono text-meta leading-5 text-white/80">
                                  {prettyAuditJson(event.after)}
                                </pre>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav aria-label="Пагинация журнала" className="flex items-center justify-between border-t border-line pt-4">
          {page > 1 ? (
            <Link
              href={hrefForPage(page - 1)}
              className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-table font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" /> Предыдущая
            </Link>
          ) : <span />}
          <span className="text-meta tabular-nums text-muted">{page} / {totalPages}</span>
          {page < totalPages ? (
            <Link
              href={hrefForPage(page + 1)}
              className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-table font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-text"
            >
              Следующая <ArrowRight className="h-4 w-4" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
