// Decision Control Header: предмет решения, authority, criticality, readiness
// и жизненный цикл читаются до перехода к материалам досье.
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  LockKeyhole,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StageStepper } from "@/components/stage-stepper";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import type { DecisionFull } from "@/lib/snapshot";
import type { Criticality, DecisionStatus, DecisionType, Stage } from "@/lib/domain";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "border-white/30 text-white/80",
  IN_REVIEW: "bg-white text-obsidian",
  RETURNED: "border-action bg-action text-white",
  APPROVED: "border-accent bg-accent text-white",
  REJECTED: "border-danger bg-danger text-white",
  IN_EXECUTION: "bg-white text-obsidian",
  POST_EVALUATION: "bg-white text-obsidian",
  CLOSED: "border-white/30 text-white/75",
};

const CRITICALITY_STYLE: Record<string, string> = {
  A: "border-white bg-white text-obsidian",
  B: "border-white text-white",
  C: "border-white/40 text-white/75",
};

export function PassportHeader({
  decision,
  completeness,
  readyEvidence,
  requiredEvidence,
  gateAllowed,
  missingForNextStage,
}: {
  decision: DecisionFull;
  completeness: number;
  readyEvidence: number;
  requiredEvidence: number;
  gateAllowed: boolean | null;
  missingForNextStage: string[];
}) {
  const status = decision.status as DecisionStatus;
  const criticality = decision.criticality as Criticality;
  const hasNextGate = gateAllowed !== null;

  return (
    <section className="overflow-hidden rounded-panel bg-surface shadow-panel" aria-labelledby="decision-title">
      <div className="grid xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="bg-obsidian px-5 py-5 text-white sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-technical text-table font-semibold tracking-[0.04em] text-white/60">
              {decision.code}
            </span>
            <span
              className={cn(
                "inline-flex min-h-7 items-center rounded border px-2.5 font-technical text-meta font-bold tracking-[0.1em]",
                CRITICALITY_STYLE[criticality]
              )}
            >
              УРОВЕНЬ {criticality}
            </span>
            <span className="inline-flex min-h-7 items-center rounded border border-white/25 px-2.5 text-table text-white/80">
              {ru.decisionTypes[decision.type as DecisionType]}
            </span>
            <span
              className={cn(
                "inline-flex min-h-7 items-center rounded border border-transparent px-2.5 text-table font-semibold",
                STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT
              )}
            >
              {ru.statuses[status]}
            </span>
          </div>

          <h1 id="decision-title" className="mt-4 max-w-5xl text-decision font-semibold tracking-[-0.025em] text-white sm:text-page">
            {decision.title}
          </h1>
          <p className="mt-2 max-w-4xl text-lead text-white/70">{decision.goal}</p>

          <dl className="mt-5 grid gap-x-7 gap-y-3 border-t border-white/20 pt-4 text-table text-white/70 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="flex items-center gap-1.5 text-meta text-white/40">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                Орган, принимающий решение
              </dt>
              <dd className="mt-1 font-medium text-white">{decision.decisionBody.name}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-meta text-white/40">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                Инициатор
              </dt>
              <dd className="mt-1 font-medium text-white">{decision.initiator.name}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-meta text-white/40">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Контрольный срок
              </dt>
              <dd className="mt-1 font-medium text-white">
                {decision.deadline
                  ? format(decision.deadline, "d MMMM yyyy", { locale: ruLocale })
                  : "Не задан"}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-white/40">Регистрация</dt>
              <dd className="mt-1 font-medium text-white">
                {format(decision.registeredAt, "d MMMM yyyy", { locale: ruLocale })}
              </dd>
            </div>
          </dl>
        </div>

        <aside className="flex flex-col justify-between border-t border-line bg-surface px-5 py-5 xl:border-l xl:border-t-0" aria-label="Готовность решения">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-meta font-semibold tracking-[0.12em] text-muted">ГОТОВНОСТЬ ДОСЬЕ</p>
                <p className="mt-1 text-table text-muted">Обязательная доказательная база</p>
              </div>
              <span className="text-hero font-semibold tracking-[-0.04em] text-text">{completeness}%</span>
            </div>
            <Progress
              className="mt-3 h-2.5"
              value={completeness}
              warnBelow={100}
              label={`Готовность досье ${completeness}%`}
            />
            <p className="mt-2 text-table text-text">
              <span className="font-semibold">{readyEvidence} / {requiredEvidence}</span>{" "}
              обязательных блоков сформированы
            </p>
            <p className="mt-1 text-meta leading-5 text-muted">{ru.criticality[criticality]}</p>
          </div>

          <div
            className={cn(
              "mt-5 border-l-2 px-3 py-2.5",
              !hasNextGate || gateAllowed ? "border-accent bg-accent-soft" : "border-action bg-action-soft"
            )}
          >
            <div className="flex items-start gap-2">
              {!hasNextGate || gateAllowed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              ) : (
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-action" aria-hidden="true" />
              )}
              <div>
                <p className="text-table font-semibold text-text">
                  {!hasNextGate
                    ? "Жизненный цикл завершён"
                    : gateAllowed
                      ? "Следующие ворота открыты"
                      : "Следующая стадия заблокирована"}
                </p>
                {hasNextGate && (
                  <p className="mt-0.5 text-meta leading-5 text-muted">
                    {gateAllowed
                      ? "Минимальные требования перехода подтверждены."
                      : `${missingForNextStage.length} ${pluralizeConditions(missingForNextStage.length)} требуют действия.`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {(decision.returnCount > 0 || decision.decidedAt) && (
            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-meta text-muted">
              {decision.returnCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-action" aria-hidden="true" />
                  <dt className="sr-only">Возвраты на доработку</dt>
                  <dd>Возвратов на доработку: {decision.returnCount}</dd>
                </div>
              )}
              {decision.decidedAt && (
                <div className="flex justify-between gap-3">
                  <dt>Решение принято</dt>
                  <dd>{format(decision.decidedAt, "d MMM yyyy", { locale: ruLocale })}</dd>
                </div>
              )}
            </dl>
          )}
        </aside>
      </div>

      <StageStepper current={decision.stage as Stage} gateAllowed={gateAllowed} />
    </section>
  );
}

function pluralizeConditions(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "условие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "условия";
  return "условий";
}
