// Шапка паспорта: идентификация, критичность, статус, полнота, срок, возвраты.
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { RotateCcw, CalendarDays, Building2, User as UserIcon } from "lucide-react";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StageStepper } from "@/components/stage-stepper";
import { ru } from "@/lib/i18n/ru";
import type { DecisionFull } from "@/lib/snapshot";
import type { Criticality, DecisionStatus, DecisionType, Stage } from "@/lib/domain";

const STATUS_VARIANT: Record<string, "neutral" | "warn" | "success" | "danger" | "default"> = {
  DRAFT: "neutral",
  IN_REVIEW: "default",
  RETURNED: "warn",
  APPROVED: "success",
  REJECTED: "danger",
  IN_EXECUTION: "default",
  POST_EVALUATION: "default",
  CLOSED: "neutral",
};

export function PassportHeader({
  decision,
  completeness,
  gateAllowed,
  missingForNextStage,
}: {
  decision: DecisionFull;
  completeness: number;
  gateAllowed: boolean | null;
  missingForNextStage: string[];
}) {
  const status = decision.status as DecisionStatus;
  return (
    <section className="rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{decision.code}</span>
              <CriticalityBadge level={decision.criticality} />
              <Badge variant="outline">{ru.decisionTypes[decision.type as DecisionType]}</Badge>
              <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{ru.statuses[status]}</Badge>
              {decision.returnCount > 0 && (
                <Badge variant="warn">
                  <RotateCcw className="h-3 w-3" />
                  Возвратов на доработку: {decision.returnCount}
                </Badge>
              )}
              <Badge variant="warn">{ru.demoBadge}</Badge>
            </div>
            <h1 className="mt-1.5 text-lg font-bold leading-6 text-brand">{decision.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{decision.goal}</p>
          </div>

          <div className="w-56 shrink-0">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">{ru.common.completeness}</span>
              <span className="text-lg font-bold tabular-nums text-brand">{completeness}%</span>
            </div>
            <Progress value={completeness} />
            <p className="mt-1 text-[11px] text-slate-500">
              {ru.criticality[decision.criticality as Criticality]}
            </p>
          </div>
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <dt className="sr-only">Орган принятия</dt>
            <dd>{decision.decisionBody.name}</dd>
          </div>
          <div className="flex items-center gap-1">
            <UserIcon className="h-3.5 w-3.5 text-slate-400" />
            <dt className="sr-only">Инициатор</dt>
            <dd>{decision.initiator.name}</dd>
          </div>
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <dt className="sr-only">Зарегистрировано</dt>
            <dd>
              Зарегистрировано {format(decision.registeredAt, "d MMMM yyyy", { locale: ruLocale })}
            </dd>
          </div>
          {decision.deadline && (
            <div className="flex items-center gap-1">
              <dt className="text-slate-400">Срок:</dt>
              <dd>{format(decision.deadline, "d MMMM yyyy", { locale: ruLocale })}</dd>
            </div>
          )}
          {decision.decidedAt && (
            <div className="flex items-center gap-1">
              <dt className="text-slate-400">Решение принято:</dt>
              <dd>{format(decision.decidedAt, "d MMMM yyyy", { locale: ruLocale })}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <StageStepper current={decision.stage as Stage} gateAllowed={gateAllowed} />
        {missingForNextStage.length > 0 && (
          <p className="text-xs text-brand-warn">
            <span className="font-medium">{ru.common.whatIsMissing}:</span>{" "}
            {missingForNextStage.join("; ")}
          </p>
        )}
      </div>
    </section>
  );
}
