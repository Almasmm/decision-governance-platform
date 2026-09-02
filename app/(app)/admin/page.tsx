import { redirect } from "next/navigation";
import { ArrowRight, Building2, ShieldAlert, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { ru } from "@/lib/i18n/ru";
import { STAGES, type Stage } from "@/lib/domain";
import { UsersPanel, BodiesPanel, GatesPanel } from "@/components/admin/admin-panels";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();
  if (!can(user.role, "admin.users")) redirect("/dashboard");

  const [users, bodies, gates] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.decisionBody.findMany({
      include: { _count: { select: { decisions: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.gateCheck.findMany(),
  ]);

  const stageOrder = (stage: string): number => STAGES.indexOf(stage as Stage);
  const sortedGates = [...gates].sort(
    (left, right) =>
      stageOrder(left.fromStage) - stageOrder(right.fromStage) ||
      left.criticality.localeCompare(right.criticality) ||
      left.rule.localeCompare(right.rule)
  );

  return (
    <div className="space-y-6" data-tour="admin-governance">
      <header className="border-b border-line pb-5">
        <p className="eyebrow">System governance</p>
        <div className="mt-1 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-page font-semibold tracking-[-0.025em] text-text">{ru.nav.admin}</h1>
            <p className="mt-2 text-lead text-muted">
              Глобальная консоль полномочий, органов принятия решений и правил перехода между
              стадиями. Изменения здесь влияют на весь контур, а не на один паспорт.
            </p>
          </div>
          <p className="border-l-2 border-accent pl-4 text-table text-muted">
            Текущая authority
            <span className="mt-1 block font-semibold text-text">{user.name} · {ru.roles[user.role]}</span>
          </p>
        </div>
      </header>

      <section
        className="overflow-hidden rounded-panel bg-obsidian text-surface shadow-panel"
        aria-label="Область и последствия изменений"
        data-tour="admin-governance-impact"
      >
        <div className="grid lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.2fr)]">
          <div className="border-b border-white/15 p-5 lg:border-b-0 lg:border-r lg:p-6">
            <div className="flex items-center gap-2 text-action-soft">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              <p className="font-technical text-meta font-semibold uppercase tracking-[0.14em]">
                Governance impact
              </p>
            </div>
            <h2 className="mt-2 text-section font-semibold">Изменения имеют системный эффект</h2>
            <p className="mt-2 text-base text-white/65">
              Перед сохранением проверьте область действия, влияние на lifecycle и основание для
              изменения политики.
            </p>
          </div>
          <dl className="grid divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-5">
              <dt className="text-meta uppercase tracking-[0.08em] text-white/45">Scope</dt>
              <dd className="mt-2 text-base font-semibold">Весь decision contour</dd>
              <p className="mt-1 text-table text-white/55">Пользователи, органы и gate policy</p>
            </div>
            <div className="p-5">
              <dt className="text-meta uppercase tracking-[0.08em] text-white/45">Impact</dt>
              <dd className="mt-2 text-base font-semibold">Текущие и будущие паспорта</dd>
              <p className="mt-1 text-table text-white/55">Доступ, маршрутизация и блокировки</p>
            </div>
            <div className="p-5">
              <dt className="text-meta uppercase tracking-[0.08em] text-white/45">Audit</dt>
              <dd className="mt-2 text-base font-semibold">Каждое действие фиксируется</dd>
              <p className="mt-1 text-table text-white/55">Автор, время и изменённая сущность</p>
            </div>
          </dl>
        </div>
      </section>

      <nav
        className="grid border-y border-line bg-surface md:grid-cols-3"
        aria-label="Разделы администрирования"
        data-tour="admin-sections"
      >
        <a
          href="#admin-users"
          className="group flex min-h-16 items-center justify-between gap-3 border-b border-line px-4 transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:border-b-0 md:border-r"
        >
          <span className="flex items-center gap-3">
            <UsersRound className="h-4 w-4 text-accent" aria-hidden="true" />
            <span>
              <span className="block text-base font-semibold text-text">Пользователи и роли</span>
              <span className="text-meta text-muted">{users.length} учётных записей</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent" aria-hidden="true" />
        </a>
        <a
          href="#admin-bodies"
          className="group flex min-h-16 items-center justify-between gap-3 border-b border-line px-4 transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:border-b-0 md:border-r"
        >
          <span className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
            <span>
              <span className="block text-base font-semibold text-text">Органы решений</span>
              <span className="text-meta text-muted">{bodies.length} записей</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent" aria-hidden="true" />
        </a>
        <a
          href="#admin-gates"
          className="group flex min-h-16 items-center justify-between gap-3 px-4 transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <span className="flex items-center gap-3">
            <ShieldAlert className="h-4 w-4 text-action" aria-hidden="true" />
            <span>
              <span className="block text-base font-semibold text-text">Gate policy</span>
              <span className="text-meta text-muted">{gates.length} правил</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent" aria-hidden="true" />
        </a>
      </nav>

      <UsersPanel
        users={users.map((account) => ({
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role,
          position: account.position,
        }))}
      />

      <BodiesPanel
        bodies={bodies.map((body) => ({
          id: body.id,
          name: body.name,
          kind: body.kind,
          count: body._count.decisions,
        }))}
      />

      <GatesPanel
        gates={sortedGates.map((gate) => ({
          id: gate.id,
          fromStage: gate.fromStage,
          toStage: gate.toStage,
          criticality: gate.criticality,
          rule: gate.rule,
          isBlocking: gate.isBlocking,
        }))}
      />
    </div>
  );
}
