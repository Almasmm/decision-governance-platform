// Signature component досье: контрольные ворота отделяют проверку полноты
// доказательств от человеческого решения и ведут к конкретному месту исправления.
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, CircleAlert, LockKeyhole, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ruleDescription, type GateRuleResult } from "@/lib/gates";
import { ru } from "@/lib/i18n/ru";
import type { Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface DecisionGatePanelProps {
  decisionId: string;
  results: GateRuleResult[];
  fromStage: Stage;
  toStage: Stage;
  allowed: boolean;
  className?: string;
  children?: ReactNode;
}

export function DecisionGatePanel({
  decisionId,
  results,
  fromStage,
  toStage,
  allowed,
  className,
  children,
}: DecisionGatePanelProps) {
  const confirmed = results.filter((result) => result.passed);
  const actions = results.filter((result) => !result.passed);
  const progress = results.length === 0 ? 100 : Math.round((confirmed.length / results.length) * 100);

  return (
    <section className={cn("overflow-hidden rounded-panel bg-surface shadow-panel", className)} aria-labelledby="decision-gate-title">
      <header className="bg-obsidian px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-meta font-semibold tracking-[0.12em] text-white/60">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              КОНТРОЛЬНЫЕ ВОРОТА
            </p>
            <h2 id="decision-gate-title" className="mt-2 text-section font-semibold text-white sm:text-[24px] sm:leading-8">
              {ru.stages[fromStage]} <span className="text-white/40">→</span> {ru.stages[toStage]}
            </h2>
            <p className="mt-1 max-w-2xl text-table text-white/60">
              Проверяется минимальная полнота доказательной базы. Итоговое решение остаётся за уполномоченным органом.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded px-3 text-table font-semibold",
              allowed ? "bg-accent text-white" : "bg-action text-white"
            )}
          >
            {allowed ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
            {allowed ? "Ворота открыты" : "Переход заблокирован"}
          </span>
        </div>

        <div className="mt-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-4 text-table">
              <p className="font-semibold text-white">
                {results.length === 0
                  ? "Обязательные проверки для перехода не заданы"
                  : `${confirmed.length} из ${results.length} требований подтверждены`}
              </p>
              <span className="font-technical text-white/60">{progress}%</span>
            </div>
            <Progress
              className="h-2 bg-white/20"
              value={progress}
              warnBelow={100}
              label={`Подтверждено ${confirmed.length} из ${results.length} требований ворот`}
            />
          </div>
          {actions.length > 0 && (
            <p className="text-meta text-white/60">Требуют действия: {actions.length}</p>
          )}
        </div>
      </header>

      {results.length === 0 ? (
        <div className="px-5 py-5 text-base text-muted sm:px-6">
          Для этого перехода и уровня критичности нет обязательных правил. Сервер разрешит переход без дополнительной проверки доказательств.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="border-b border-line px-5 py-5 sm:px-6 lg:border-b-0 lg:border-r" aria-labelledby="gate-confirmed-title">
            <h3 id="gate-confirmed-title" className="text-meta font-semibold tracking-[0.1em] text-muted">
              ПОДТВЕРЖДЕНО
            </h3>
            {confirmed.length === 0 ? (
              <p className="mt-4 text-table text-muted">Ни одно требование пока не подтверждено.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {confirmed.map((result) => (
                  <li key={result.code} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-table font-semibold text-text">{ruleDescription(result.code)}</p>
                      <p className="mt-0.5 text-meta leading-5 text-muted">{result.explanation}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cn("px-5 py-5 sm:px-6", actions.length > 0 && "bg-action-soft/50")} aria-labelledby="gate-actions-title">
            <h3 id="gate-actions-title" className={cn("text-meta font-semibold tracking-[0.1em]", actions.length > 0 ? "text-action" : "text-muted")}>
              ТРЕБУЕТ ДЕЙСТВИЯ
            </h3>
            {actions.length === 0 ? (
              <div className="mt-4 flex items-start gap-2.5 text-table text-text">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-accent" aria-hidden="true" />
                Все применимые требования подтверждены. Ворота готовы к серверной проверке перехода.
              </div>
            ) : (
              <ol className="mt-3 space-y-4">
                {actions.map((result, index) => {
                  const destination = destinationForRule(decisionId, result.code);
                  return (
                    <li key={result.code} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-b border-action/20 pb-4 last:border-0 last:pb-0">
                      <span className="font-technical text-table font-semibold text-action">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-base font-semibold text-text">{ruleDescription(result.code)}</p>
                        <p className="mt-1 text-table leading-5 text-text/75">{result.explanation}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-meta text-muted">
                            <CircleAlert className="h-3.5 w-3.5 text-action" aria-hidden="true" />
                            Ответственный: <span className="font-semibold text-text">{result.responsible}</span>
                          </p>
                          <Link href={destination.href} className="inline-flex min-h-8 items-center gap-1 text-table font-semibold text-action hover:underline">
                            {destination.label}
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}

      <footer
        className={cn(
          "flex flex-col gap-4 border-t px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between",
          allowed ? "border-accent/20 bg-accent-soft" : "border-action/20 bg-action-soft"
        )}
      >
        <div className="flex items-start gap-2.5">
          {allowed ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          ) : (
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-action" aria-hidden="true" />
          )}
          <div>
            <p className="text-base font-semibold text-text">
              {allowed
                ? `Переход на стадию «${ru.stages[toStage]}» доступен`
                : `Следующая стадия «${ru.stages[toStage]}» заблокирована`}
            </p>
            <p className="mt-0.5 text-meta text-muted">
              {allowed
                ? "Переход всё равно выполняется только после серверной проверки."
                : "Устраните недостающие доказательства и повторите проверку ворот."}
            </p>
          </div>
        </div>
        {children && <div className="flex shrink-0 flex-wrap items-start gap-3">{children}</div>}
      </footer>
    </section>
  );
}

/** Обратная совместимость для существующих импортов. */
export function GateChecklist(props: DecisionGatePanelProps) {
  return <DecisionGatePanel {...props} />;
}

function destinationForRule(decisionId: string, code: string): { href: string; label: string } {
  const passportBlock = (block: string, label: string) => ({
    href: `/decisions/${decisionId}?tab=passport&block=${block}`,
    label,
  });

  switch (code) {
    case "GOAL_TYPE_BODY":
      return passportBlock("IDENTIFICATION", "Открыть идентификацию");
    case "CRITICAL_INDICATORS_SOURCED":
    case "DATA_OWNERS_CONFIRMED":
      return passportBlock("DATA", "Открыть данные");
    case "ALTERNATIVES_MIN":
    case "UNIFORM_CRITERIA":
    case "DECISION_RECORDED":
      return { href: `/decisions/${decisionId}?tab=alternatives`, label: "Открыть сравнение" };
    case "RISK_PROFILE":
    case "ASSUMPTIONS_FIXED":
      return { href: `/decisions/${decisionId}?tab=risks`, label: "Открыть риск-профиль" };
    case "INDEPENDENT_REVIEW":
      return { href: `/decisions/${decisionId}?tab=economics`, label: "Открыть расчёты" };
    case "ASSIGNMENTS_KPI":
      return { href: `/decisions/${decisionId}?tab=assignments`, label: "Открыть поручения" };
    case "POST_EVALUATION_REQUIRED":
      return passportBlock("POST_EVALUATION", "Открыть пост-оценку");
    default:
      return passportBlock("IDENTIFICATION", "Открыть досье");
  }
}
