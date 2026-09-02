// Журнал решений и база уроков: отклонение факта от плана, категория причины,
// поиск похожих решений.
import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { CAUSE_CATEGORIES, parseJson, type CauseCategory, type DecisionType } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stat-tile";

export const dynamic = "force-dynamic";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cause?: string; type?: string }>;
}) {
  await requireUser();
  const f = await searchParams;

  const where: Prisma.LessonWhereInput = {};
  if (f.cause && CAUSE_CATEGORIES.includes(f.cause as CauseCategory)) where.causeCategory = f.cause;
  if (f.type) where.decision = { type: f.type };
  if (f.q)
    where.OR = [
      { whatPlanned: { contains: f.q } },
      { whatHappened: { contains: f.q } },
      { conclusion: { contains: f.q } },
      { decision: { title: { contains: f.q } } },
    ];

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

  const byCause = CAUSE_CATEGORIES.map((c) => ({
    cause: c,
    count: lessons.filter((l) => l.causeCategory === c).length,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.lessons}</h1>
        <p className="text-xs text-slate-500">
          Цикл замыкается здесь: организация фиксирует расхождение факта с планом, его причину и
          вывод для будущих решений.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatTile label="Закрытых решений" value={String(closedDecisions.length)} nature="fact" source="Реестр решений" />
        <StatTile label="Записей в базе уроков" value={String(allLessonsCount)} nature="fact" source="База уроков" />
        <StatTile
          label="Закрытых решений с уроком"
          value={`${closedDecisions.length > 0 ? Math.round((closedDecisions.filter((d) => d.lessons.length > 0).length / closedDecisions.length) * 100) : 0} %`}
          nature="fact"
          source="Реестр решений и база уроков"
          formula="закрытые решения с уроком / все закрытые × 100"
        />
        <StatTile
          label="Преобладающая причина отклонений"
          value={
            ru.causeCategories[
              (byCause.slice().sort((a, b) => b.count - a.count)[0]?.cause ?? "EXECUTION") as CauseCategory
            ]
          }
          nature="fact"
          source="База уроков"
        />
      </div>

      <Card>
        <CardContent className="py-3">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Поиск похожих ситуаций по тексту урока"
              className="h-8 w-72 rounded border border-slate-300 px-2 text-xs"
            />
            <select name="cause" defaultValue={f.cause ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все причины</option>
              {CAUSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{ru.causeCategories[c]}</option>
              ))}
            </select>
            <select name="type" defaultValue={f.type ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все типы решений</option>
              {Object.entries(ru.decisionTypes).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Button type="submit" size="sm">Найти</Button>
            <Link href="/lessons">
              <Button type="button" size="sm" variant="ghost">Сбросить</Button>
            </Link>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {byCause.map((b) => (
              <Link key={b.cause} href={`/lessons?cause=${b.cause}`}>
                <Badge variant={b.count > 0 ? "default" : "neutral"}>
                  {ru.causeCategories[b.cause]}: {b.count}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {lessons.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-slate-500">
              По заданным условиям уроков не найдено.
            </CardContent>
          </Card>
        )}
        {lessons.map((l) => {
          const postEval = l.decision.blocks.find((b) => b.kind === "POST_EVALUATION");
          const planFact = parseJson<{ planFact?: string }>(postEval?.payload, {}).planFact;
          return (
            <Card key={l.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/decisions/${l.decisionId}`} className="font-mono text-xs text-brand-accent hover:underline">
                      {l.decision.code}
                    </Link>
                    <CriticalityBadge level={l.decision.criticality} />
                    <Badge variant="outline">{ru.decisionTypes[l.decision.type as DecisionType]}</Badge>
                    <Badge variant="warn">{ru.causeCategories[l.causeCategory as CauseCategory]}</Badge>
                    <Badge variant="neutral">{ru.statuses[l.decision.status as keyof typeof ru.statuses]}</Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {l.decision.decidedAt
                      ? `решение принято ${format(l.decision.decidedAt, "d MMMM yyyy", { locale: ruLocale })}`
                      : "дата решения не зафиксирована"}
                  </span>
                </div>
                <CardTitle className="mt-1 text-sm">{l.decision.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-slate-200 p-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Badge variant="assumption">План</Badge>
                    </div>
                    <p className="text-xs text-slate-700">{l.whatPlanned}</p>
                  </div>
                  <div className="rounded border border-slate-200 p-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Badge variant="fact">Факт</Badge>
                    </div>
                    <p className="text-xs text-slate-700">{l.whatHappened}</p>
                  </div>
                </div>
                {planFact && (
                  <p className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                    Пост-оценка паспорта: {planFact}
                  </p>
                )}
                <div className="mt-2 rounded border-l-2 border-brand-accent bg-brand-card/50 px-2.5 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Вывод для будущих решений
                  </div>
                  <p className="text-sm font-medium text-brand">{l.conclusion}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
