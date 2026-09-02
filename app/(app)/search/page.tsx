import Link from "next/link";
import { Bot, CheckSquare, Database, FileText, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import type { DecisionStatus, Stage } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q: rawQuery } = await searchParams;
  const query = rawQuery?.trim() ?? "";

  const [decisions, indicators, models, assignments] = query
    ? await Promise.all([
        prisma.decision.findMany({
          where: { OR: [{ code: { contains: query } }, { title: { contains: query } }, { goal: { contains: query } }] },
          include: { decisionBody: true },
          take: 12,
        }),
        prisma.indicator.findMany({
          where: { OR: [{ code: { contains: query } }, { name: { contains: query } }, { businessMeaning: { contains: query } }] },
          include: { owner: true },
          take: 12,
        }),
        prisma.aiModel.findMany({
          where: { OR: [{ name: { contains: query } }, { purpose: { contains: query } }, { inputs: { contains: query } }] },
          include: { owner: true },
          take: 12,
        }),
        prisma.assignment.findMany({
          where: { text: { contains: query } },
          include: { decision: true, assignee: true },
          take: 12,
        }),
      ])
    : [[], [], [], []];

  const total = decisions.length + indicators.length + models.length + assignments.length;

  return (
    <div className="workspace space-y-8">
      <header>
        <p className="eyebrow">Global command</p>
        <h1 className="mt-2 text-page font-semibold tracking-[-0.035em] text-text">Поиск по контуру решений</h1>
        <p className="mt-2 text-lead text-muted">Решения, показатели, модели и поручения в одном контексте.</p>
      </header>

      <form role="search" className="surface-band flex items-center gap-3 p-3">
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
        <input
          autoFocus
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Введите код, название, показатель, модель или поручение"
          className="h-11 min-w-0 flex-1 bg-transparent text-lead text-text outline-none placeholder:text-muted"
        />
        <button className="h-9 rounded-control bg-accent px-4 text-base font-semibold text-surface">Найти</button>
      </form>

      {!query ? (
        <section className="border-l-2 border-accent pl-5">
          <h2 className="text-section font-semibold text-text">Начните с управленческого объекта</h2>
          <p className="mt-2 max-w-2xl text-base text-muted">
            Например: <span className="font-technical text-text">INV-2026-001</span>, «добыча», «риск» или «подтвердить качество».
          </p>
        </section>
      ) : total === 0 ? (
        <section className="border-l-2 border-line pl-5">
          <h2 className="text-section font-semibold text-text">Совпадений не найдено</h2>
          <p className="mt-2 text-base text-muted">Проверьте код или используйте более короткую формулировку.</p>
        </section>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          <ResultSection icon={FileText} title="Решения" count={decisions.length}>
            {decisions.map((decision) => (
              <ResultLink key={decision.id} href={`/decisions/${decision.id}`} code={decision.code} title={decision.title}>
                {ru.stages[decision.stage as Stage]} · {ru.statuses[decision.status as DecisionStatus]} · {decision.decisionBody.name}
              </ResultLink>
            ))}
          </ResultSection>

          <ResultSection icon={Database} title="Показатели" count={indicators.length}>
            {indicators.map((indicator) => (
              <ResultLink key={indicator.id} href={`/indicators/${indicator.id}`} code={indicator.code} title={indicator.name}>
                {ru.sourceSystems[indicator.sourceSystem as keyof typeof ru.sourceSystems]} · владелец {indicator.owner?.name ?? "не назначен"}
              </ResultLink>
            ))}
          </ResultSection>

          <ResultSection icon={Bot} title="Модели" count={models.length}>
            {models.map((model) => (
              <ResultLink key={model.id} href="/models" code={model.version} title={model.name}>
                {model.purpose} · владелец {model.owner.name}
              </ResultLink>
            ))}
          </ResultSection>

          <ResultSection icon={CheckSquare} title="Поручения" count={assignments.length}>
            {assignments.map((assignment) => (
              <ResultLink key={assignment.id} href={`/decisions/${assignment.decisionId}?tab=assignments`} code={assignment.decision.code} title={assignment.text}>
                Ответственный {assignment.assignee.name} · {ru.assignmentStatuses[assignment.status as keyof typeof ru.assignmentStatuses]}
              </ResultLink>
            ))}
          </ResultSection>
        </div>
      )}
    </div>
  );
}

function ResultSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof FileText;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 className="text-section font-semibold text-text">{title}</h2>
        <span className="ml-auto font-technical text-meta text-muted">{count}</span>
      </div>
      <div>{count > 0 ? children : <p className="py-5 text-base text-muted">Нет совпадений</p>}</div>
    </section>
  );
}

function ResultLink({
  href,
  code,
  title,
  children,
}: {
  href: string;
  code: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block border-b border-line py-4 last:border-0 hover:bg-accent-soft">
      <span className="font-technical text-meta font-semibold text-accent">{code}</span>
      <span className="mt-1 block text-base font-semibold text-text group-hover:text-accent">{title}</span>
      <span className="mt-1 block text-table text-muted">{children}</span>
    </Link>
  );
}
