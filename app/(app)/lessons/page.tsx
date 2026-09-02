import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import type { Prisma } from "@prisma/client";
import { ArrowRight, BookOpenCheck, RotateCcw, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { CAUSE_CATEGORIES, parseJson, type CauseCategory, type DecisionType } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cause?: string; type?: string }>;
}) {
  await requireUser();
  const filters = await searchParams;

  const where: Prisma.LessonWhereInput = {};
  if (filters.cause && CAUSE_CATEGORIES.includes(filters.cause as CauseCategory)) {
    where.causeCategory = filters.cause;
  }
  if (filters.type) where.decision = { type: filters.type };
  if (filters.q) {
    where.OR = [
      { whatPlanned: { contains: filters.q } },
      { whatHappened: { contains: filters.q } },
      { conclusion: { contains: filters.q } },
      { decision: { title: { contains: filters.q } } },
    ];
  }

  const [lessons, closedDecisions, allLessonsCount] = await Promise.all([
    prisma.lesson.findMany({
      where,
      include: { decision: { include: { decisionBody: true, blocks: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.decision.findMany({
      where: { status: "CLOSED" },
      include: { lessons: true, blocks: true },
    }),
    prisma.lesson.count(),
  ]);

  const byCause = CAUSE_CATEGORIES.map((cause) => ({
    cause,
    count: lessons.filter((lesson) => lesson.causeCategory === cause).length,
  }));
  const causeMax = Math.max(...byCause.map((item) => item.count), 1);
  const dominantCause = byCause.slice().sort((a, b) => b.count - a.count)[0];
  const closedWithLesson = closedDecisions.filter((decision) => decision.lessons.length > 0).length;
  const learningCoverage =
    closedDecisions.length > 0 ? Math.round((closedWithLesson / closedDecisions.length) * 100) : 0;

  function causeHref(cause: CauseCategory) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.type) params.set("type", filters.type);
    if (filters.cause !== cause) params.set("cause", cause);
    const query = params.toString();
    return query ? `/lessons?${query}` : "/lessons";
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-line pb-5">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <p className="eyebrow">Organizational learning</p>
            <h1 className="mt-1 text-page font-semibold tracking-[-0.025em] text-text">
              {ru.nav.lessons}
            </h1>
            <p className="mt-2 text-lead text-muted">
              Закрытое решение становится организационной памятью только после сопоставления плана
              и факта, определения причины и фиксации применимого вывода.
            </p>
          </div>

          <dl className="grid min-w-0 grid-cols-3 divide-x divide-line border-y border-line py-3 xl:min-w-[520px]">
            <div className="px-3 first:pl-0 sm:px-5">
              <dt className="text-meta text-muted">Закрыто</dt>
              <dd className="mt-1 font-technical text-section font-semibold text-text">
                {closedDecisions.length}
              </dd>
            </div>
            <div className="px-3 sm:px-5">
              <dt className="text-meta text-muted">С уроком</dt>
              <dd className="mt-1 font-technical text-section font-semibold text-text">
                {closedWithLesson}/{closedDecisions.length}
              </dd>
            </div>
            <div className="px-3 last:pr-0 sm:px-5">
              <dt className="text-meta text-muted">Learning coverage</dt>
              <dd className="mt-1 font-technical text-section font-semibold text-accent">
                {learningCoverage}%
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="surface-band overflow-hidden" aria-labelledby="learning-loop-heading">
        <div className="grid lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
          <div className="bg-obsidian p-5 text-surface sm:p-6">
            <p className="font-technical text-meta uppercase tracking-[0.16em] text-accent-soft">
              Learning loop
            </p>
            <h2 id="learning-loop-heading" className="mt-1 text-section font-semibold">
              Решение возвращает знание в следующий цикл
            </h2>
            <ol className="mt-5 space-y-0">
              {[
                ["01", "Завершить исполнение", "Зафиксировать фактический результат"],
                ["02", "Сопоставить plan / fact", "Не скрывать величину и характер отклонения"],
                ["03", "Определить причину", "Отделить данные, модель, исполнение и внешний риск"],
                ["04", "Вернуть урок", "Использовать вывод в новом evidence dossier"],
              ].map(([number, title, note], index, items) => (
                <li key={number} className="grid grid-cols-[28px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="font-technical text-table font-semibold text-accent-soft">
                      {number}
                    </span>
                    {index < items.length - 1 && <span className="my-1 min-h-7 w-px flex-1 bg-white/20" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-base font-semibold">{title}</p>
                    <p className="mt-0.5 text-table text-white/60">{note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Cause pattern · текущая выборка</p>
                <h2 className="mt-1 text-section font-semibold text-text">Паттерн причин отклонений</h2>
              </div>
              <p className="text-table text-muted">
                {lessons.length > 0 && dominantCause && dominantCause.count > 0
                  ? `Наиболее частая: ${ru.causeCategories[dominantCause.cause]}`
                  : "В выборке нет причин для сравнения"}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {byCause.map((item) => {
                const active = filters.cause === item.cause;
                return (
                  <Link
                    key={item.cause}
                    href={causeHref(item.cause)}
                    className="group grid grid-cols-[minmax(130px,0.8fr)_minmax(120px,1.2fr)_32px] items-center gap-3 text-table focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-current={active ? "true" : undefined}
                  >
                    <span className={cn("text-muted group-hover:text-text", active && "font-semibold text-accent")}>
                      {ru.causeCategories[item.cause]}
                    </span>
                    <span className="h-2 overflow-hidden rounded bg-surface-raised" aria-hidden="true">
                      <span
                        className={cn("block h-full", active ? "bg-action" : "bg-accent")}
                        style={{ width: `${(item.count / causeMax) * 100}%` }}
                      />
                    </span>
                    <span className="text-right font-technical font-semibold text-text">{item.count}</span>
                  </Link>
                );
              })}
            </div>
            <p className="mt-5 border-t border-line pt-3 text-meta text-muted">
              Всего в базе: {allLessonsCount}. Нажмите на причину, чтобы применить или снять фильтр.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-4" aria-label="Поиск и фильтры уроков">
        <form method="get" className="grid gap-3 px-1 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto] xl:items-end">
          <div>
            <label htmlFor="lesson-query" className="mb-1.5 block text-table font-medium text-text">
              Поиск похожей ситуации
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input
                id="lesson-query"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Решение, план, факт или вывод"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <label htmlFor="lesson-cause" className="mb-1.5 block text-table font-medium text-text">
              Причина
            </label>
            <Select id="lesson-cause" name="cause" defaultValue={filters.cause ?? ""}>
              <option value="">Все причины</option>
              {CAUSE_CATEGORIES.map((cause) => (
                <option key={cause} value={cause}>
                  {ru.causeCategories[cause]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="lesson-type" className="mb-1.5 block text-table font-medium text-text">
              Тип решения
            </label>
            <Select id="lesson-type" name="type" defaultValue={filters.type ?? ""}>
              <option value="">Все типы решений</option>
              {Object.entries(ru.decisionTypes).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-1">
            <Button type="submit">
              <Search className="h-4 w-4" aria-hidden="true" />
              Найти
            </Button>
            <Link
              href="/lessons"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-control px-3 text-table font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Сбросить
            </Link>
          </div>
        </form>
      </section>

      <section aria-labelledby="lesson-register-heading">
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="eyebrow">Knowledge register</p>
            <h2 id="lesson-register-heading" className="mt-1 text-section font-semibold text-text">
              Plan → Fact → Lesson
            </h2>
          </div>
          <p className="font-technical text-meta text-muted">Найдено: {lessons.length}</p>
        </div>

        {lessons.length === 0 ? (
          <div className="surface-band flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
            <BookOpenCheck className="h-8 w-8 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-text">По заданным условиям уроков не найдено</h3>
              <p className="mt-1 text-base text-muted">Измените запрос или сбросьте активные фильтры.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {lessons.map((lesson, index) => {
              const postEvaluation = lesson.decision.blocks.find((block) => block.kind === "POST_EVALUATION");
              const planFact = parseJson<{ planFact?: string }>(postEvaluation?.payload, {}).planFact;

              return (
                <article key={lesson.id} className="bg-surface px-4 py-5 sm:px-5">
                  <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 gap-3">
                      <span className="font-technical text-meta font-semibold text-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/decisions/${lesson.decisionId}`}
                            className="font-technical text-table font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {lesson.decision.code}
                          </Link>
                          <CriticalityBadge level={lesson.decision.criticality} />
                          <Badge variant="outline">
                            {ru.decisionTypes[lesson.decision.type as DecisionType]}
                          </Badge>
                          <Badge variant="neutral">
                            {ru.causeCategories[lesson.causeCategory as CauseCategory]}
                          </Badge>
                        </div>
                        <h3 className="mt-2 text-lead font-semibold text-text">{lesson.decision.title}</h3>
                      </div>
                    </div>
                    <p className="text-table text-muted lg:text-right">
                      {lesson.decision.decidedAt
                        ? `Решение принято ${format(lesson.decision.decidedAt, "d MMMM yyyy", {
                            locale: ruLocale,
                          })}`
                        : "Дата решения не зафиксирована"}
                    </p>
                  </header>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,1.12fr)] lg:items-stretch">
                    <section className="rounded-control border border-dotted border-action bg-action-soft p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="eyebrow !text-action">01 · Plan</p>
                        <Badge variant="assumption">Допущение</Badge>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-base text-text">{lesson.whatPlanned}</p>
                    </section>

                    <div className="hidden items-center justify-center lg:flex">
                      <ArrowRight className="h-5 w-5 text-muted" aria-hidden="true" />
                    </div>
                    <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted lg:hidden" aria-hidden="true" />

                    <section className="rounded-control border border-text bg-surface p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="eyebrow">02 · Fact</p>
                        <Badge variant="fact">Факт</Badge>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-base text-text">{lesson.whatHappened}</p>
                      {planFact && (
                        <div className="mt-4 border-t border-line pt-3">
                          <p className="text-meta text-muted">Пост-оценка паспорта</p>
                          <p className="mt-1 text-table text-text">{planFact}</p>
                        </div>
                      )}
                    </section>

                    <div className="hidden items-center justify-center lg:flex">
                      <ArrowRight className="h-5 w-5 text-muted" aria-hidden="true" />
                    </div>
                    <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted lg:hidden" aria-hidden="true" />

                    <section className="rounded-control bg-obsidian p-4 text-surface">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-technical text-meta uppercase tracking-[0.14em] text-accent-soft">
                          03 · Lesson
                        </p>
                        <BookOpenCheck className="h-4 w-4 text-accent-soft" aria-hidden="true" />
                      </div>
                      <p className="mt-3 whitespace-pre-line text-lead font-semibold text-surface">
                        {lesson.conclusion}
                      </p>
                      <p className="mt-4 border-t border-white/15 pt-3 text-meta text-white/55">
                        Вывод сохранён для поиска похожих решений и повторного использования.
                      </p>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
