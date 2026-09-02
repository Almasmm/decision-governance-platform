import { cn } from "@/lib/utils";

/**
 * Измерительная полоса. Заполнение спокойно (графит), пока значение
 * не ниже требуемого порога; ниже порога — сигнал «требуется действие».
 * Незаполненный остаток штрихуется, чтобы состояние читалось без цвета.
 */
export function Progress({
  value,
  className,
  warnBelow = 100,
  label,
}: {
  value: number;
  className?: string;
  warnBelow?: number;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const needsAction = clamped < warnBelow;
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-raised", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-150", needsAction ? "bg-action" : "bg-accent")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
