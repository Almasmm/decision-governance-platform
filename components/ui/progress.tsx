import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  warnBelow = 100,
}: {
  value: number;
  className?: string;
  /** Ниже этого значения полоса подсвечивается янтарным (незаполненный обязательный блок) */
  warnBelow?: number;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded bg-slate-100", className)}>
      <div
        className={cn("h-full rounded transition-all", clamped < warnBelow ? "bg-brand-warn" : "bg-brand-accent")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
