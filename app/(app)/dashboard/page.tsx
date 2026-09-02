// Дашборд руководителя: воронка стадий, сроки подготовки, возвраты,
// доля решений с альтернативами и пост-оценкой, индекс зрелости, лента событий.
import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDashboardStats, getMaturityIndex, getBaselineMaturity } from "@/lib/analytics";
import { COMPANY_FACTS_2025, COMPANY_REPORT_SOURCE, COMPANY_REPORT_URL } from "@/lib/company";
import { ru } from "@/lib/i18n/ru";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/stat-tile";
import { StageFunnel } from "@/components/charts/stage-funnel";
import { MaturityCard } from "@/components/maturity-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, maturity, baselineMaturity, events] = await Promise.all([
    getDashboardStats(),
    getMaturityIndex(),
    getBaselineMaturity(),
    prisma.auditEvent.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.dashboard}</h1>
        <p className="text-xs text-slate-500">
          Здравствуйте, {user.name}. Контур измеряет качество процесса принятия решений, а не только
          результат исполнения.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Паспортов решений в контуре"
          value={String(stats.total)}
          hint={`Уровень A: ${stats.byCriticality.find((c) => c.level === "A")?.count ?? 0} · B: ${stats.byCriticality.find((c) => c.level === "B")?.count ?? 0} · C: ${stats.byCriticality.find((c) => c.level === "C")?.count ?? 0}`}
          nature="fact"
          source="База паспортов решений"
        />
        <StatTile
          label="Медианный срок подготовки пакета"
          value={stats.medianPreparationDays !== null ? `${stats.medianPreparationDays} дн.` : "нет данных"}
          hint={`Выборка: ${stats.preparationSample} решений; от регистрации до готовности пакета`}
          nature="fact"
          source="Паспорта решений: registeredAt → packageReadyAt"
          formula="медиана(дата готовности пакета − дата регистрации)"
        />
        <StatTile
          label="Возвраты на доработку"
          value={String(stats.totalReturns)}
          hint={`Затронуто решений: ${stats.decisionsWithReturns}`}
          warn={stats.totalReturns > 0}
          nature="fact"
          source="Аудит паспортов (действие RETURN)"
        />
        <StatTile
          label="Решения с альтернативами"
          value={`${stats.shareWithAlternatives} %`}
          hint="≥ 2 содержательных варианта и статус-кво"
          nature="fact"
          source="Паспорта решений"
          formula="решения с альтернативами / все решения × 100"
        />
        <StatTile
          label="Решения с пост-оценкой"
          value={`${stats.shareWithPostEvaluation} %`}
          hint="Зафиксирован хотя бы один урок"
          nature="fact"
          source="Паспорта решений: база уроков"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Воронка решений по стадиям цикла</CardTitle>
          </CardHeader>
          <CardContent>
            <StageFunnel data={stats.funnel} />
          </CardContent>
        </Card>

        <MaturityCard
          result={maturity.result}
          periodNote={maturity.periodNote}
          baseline={baselineMaturity}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Лента событий контура</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 px-4 py-2 text-xs">
                  <span className="w-32 shrink-0 text-slate-500">
                    {format(e.createdAt, "d MMM yyyy HH:mm", { locale: ruLocale })}
                  </span>
                  <span className="w-40 shrink-0 font-medium text-brand">{e.action}</span>
                  <span className="w-40 shrink-0 text-slate-600">{e.actor.name}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-500" title={e.after ?? ""}>
                    {e.entity} · {e.after ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-2">
              <Link href="/audit" className="text-xs text-brand-accent hover:underline">
                Весь журнал аудита →
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Исполнение поручений</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatTile
                label="Поручения, связанные с KPI результата"
                value={`${stats.shareAssignmentsWithKpi} %`}
                nature="fact"
                source="Паспорта решений: поручения"
              />
              <StatTile
                label="Просроченные поручения"
                value={String(stats.overdueAssignments)}
                warn={stats.overdueAssignments > 0}
                nature="fact"
                source="Паспорта решений: поручения"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle>Показатели компании</CardTitle>
              <Badge variant="outline">годовой отчёт 2025</Badge>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1">
                {COMPANY_FACTS_2025.map((f) => (
                  <div key={f.label} className="flex justify-between gap-3 text-xs">
                    <dt className="text-slate-600">{f.label}</dt>
                    <dd className="shrink-0 text-right font-medium text-slate-900">
                      {f.value}
                      {f.note && <span className="block text-[10px] font-normal text-slate-400">{f.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <a
                href={COMPANY_REPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-accent hover:underline"
              >
                {COMPANY_REPORT_SOURCE}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-1 text-[10px] text-slate-400">
                {ru.annualReportNote}. Показатели внутри паспортов решений — синтетические
                демо-данные.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
