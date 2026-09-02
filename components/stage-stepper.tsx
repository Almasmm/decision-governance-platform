// Степпер семи стадий цикла решения с индикатором ворот.
import { Check, Lock } from "lucide-react";
import { STAGES, type Stage } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export function StageStepper({
  current,
  gateAllowed,
}: {
  current: Stage;
  /** Пройдут ли ворота к следующей стадии (null — стадия последняя) */
  gateAllowed: boolean | null;
}) {
  const currentIdx = STAGES.indexOf(current);
  return (
    <ol className="flex flex-wrap items-center gap-0.5">
      {STAGES.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const isNextGate = i === currentIdx + 1;
        return (
          <li key={s} className="flex items-center">
            {i > 0 && (
              <span
                className={cn(
                  "mx-1 flex h-4 w-4 items-center justify-center",
                  isNextGate && gateAllowed === false ? "text-brand-warn" : "text-slate-300"
                )}
                title={isNextGate ? (gateAllowed ? "Ворота открыты" : "Ворота закрыты: доказательная база неполна") : undefined}
              >
                {isNextGate && gateAllowed === false ? <Lock className="h-3.5 w-3.5" /> : <span>›</span>}
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
                done && "bg-brand-card text-brand",
                active && "bg-brand text-white",
                !done && !active && "text-slate-400"
              )}
            >
              {done && <Check className="h-3 w-3" />}
              {ru.stages[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
