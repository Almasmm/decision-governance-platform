// Семь стадий жизненного цикла решения. Контрольные ворота показаны именно
// между стадиями: это процессный позвоночник досье, а не компактный breadcrumb.
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { STAGES, type Stage } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export function StageStepper({
  current,
  gateAllowed,
}: {
  current: Stage;
  /** Пройдут ли ворота к следующей стадии (null — стадия последняя). */
  gateAllowed: boolean | null;
}) {
  const currentIdx = STAGES.indexOf(current);

  return (
    <section className="border-t border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="decision-lifecycle-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-1">
        <div>
          <p className="text-meta font-semibold tracking-[0.12em] text-muted">ЖИЗНЕННЫЙ ЦИКЛ РЕШЕНИЯ</p>
          <h2 id="decision-lifecycle-title" className="mt-0.5 text-lead font-semibold text-text">
            Текущая стадия: {ru.stages[current]}
          </h2>
        </div>
        <p className="font-technical text-meta text-muted">
          {String(currentIdx + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
        </p>
      </div>

      <div className="overflow-x-auto pb-1" aria-label="Стадии и контрольные ворота">
        <ol className="flex min-w-[820px] items-stretch">
          {STAGES.map((stage, index) => {
            const complete = index < currentIdx;
            const active = index === currentIdx;

            return (
              <li key={stage} className="contents">
                <div
                  className={cn(
                    "relative min-w-[92px] flex-1 border-t-2 px-1.5 pb-1 pt-2.5",
                    complete && "border-accent text-text",
                    active && "border-obsidian text-text",
                    !complete && !active && "border-line text-muted"
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "absolute -top-[7px] left-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 bg-surface",
                      complete && "border-accent",
                      active && "-top-2 h-3.5 w-3.5 border-obsidian bg-obsidian",
                      !complete && !active && "border-line"
                    )}
                    aria-hidden="true"
                  />
                  <span className="block font-technical text-meta text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={cn("mt-0.5 block text-table font-semibold", active && "text-obsidian")}>
                    {ru.stages[stage]}
                  </span>
                  <span className="mt-1 flex min-h-4 items-center gap-1 text-meta">
                    {complete ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                        <span>пройдено</span>
                      </>
                    ) : active ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-obsidian" aria-hidden="true" />
                        <span>в работе</span>
                      </>
                    ) : (
                      <span>ожидает</span>
                    )}
                  </span>
                </div>

                {index < STAGES.length - 1 && (
                  <GateBetweenStages
                    passed={index < currentIdx}
                    current={index === currentIdx}
                    allowed={index === currentIdx ? gateAllowed : null}
                    destination={STAGES[index + 1]!}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function GateBetweenStages({
  passed,
  current,
  allowed,
  destination,
}: {
  passed: boolean;
  current: boolean;
  allowed: boolean | null;
  destination: Stage;
}) {
  const locked = current && allowed === false;
  const open = passed || (current && allowed === true);
  const label = passed
    ? `Ворота к стадии «${ru.stages[destination]}» пройдены`
    : locked
      ? `Ворота к стадии «${ru.stages[destination]}» закрыты`
      : open
        ? `Ворота к стадии «${ru.stages[destination]}» открыты`
        : `Будущие ворота к стадии «${ru.stages[destination]}»`;

  return (
    <div className="flex w-8 shrink-0 flex-col items-center justify-start pt-1" aria-label={label} title={label}>
      <span className={cn("h-px w-full", open ? "bg-accent" : locked ? "bg-action" : "bg-line")} />
      <span
        className={cn(
          "-mt-2 flex h-5 w-5 items-center justify-center rounded-full border bg-surface",
          open && "border-accent text-accent",
          locked && "border-action bg-action-soft text-action",
          !open && !locked && "border-line text-muted"
        )}
      >
        {locked ? (
          <LockKeyhole className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        )}
      </span>
      <span className="mt-1 text-[10px] leading-3 text-muted">gate</span>
    </div>
  );
}
