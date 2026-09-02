// Администрирование: пользователи и роли, справочники, настройка правил ворот.
import { redirect } from "next/navigation";
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

  const stageOrder = (s: string): number => STAGES.indexOf(s as Stage);
  const sortedGates = [...gates].sort(
    (a, b) =>
      stageOrder(a.fromStage) - stageOrder(b.fromStage) ||
      a.criticality.localeCompare(b.criticality) ||
      a.rule.localeCompare(b.rule)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.admin}</h1>
        <p className="text-xs text-slate-500">
          Настройки применяются ко всему контуру. Каждое изменение фиксируется в журнале аудита.
        </p>
      </div>

      <UsersPanel
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          position: u.position,
        }))}
      />

      <BodiesPanel
        bodies={bodies.map((b) => ({
          id: b.id,
          name: b.name,
          kind: b.kind,
          count: b._count.decisions,
        }))}
      />

      <GatesPanel
        gates={sortedGates.map((g) => ({
          id: g.id,
          fromStage: g.fromStage,
          toStage: g.toStage,
          criticality: g.criticality,
          rule: g.rule,
          isBlocking: g.isBlocking,
        }))}
      />
    </div>
  );
}
