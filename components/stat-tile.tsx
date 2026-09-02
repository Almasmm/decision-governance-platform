import { cn } from "@/lib/utils";
import { Provenance, type ValueNature } from "@/components/provenance";

/**
 * Показатель состояния контура. Провенанс подключается только для значений
 * предметной области — у служебных счётчиков интерфейса его быть не должно
 * (DESIGN.md § 7, п. 5).
 */
export function StatTile({
  label,
  value,
  hint,
  nature,
  source,
  formula,
  asOf,
  owner,
  needsAction = false,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Задаётся только для значений предметной области */
  nature?: ValueNature;
  source?: string;
  formula?: string;
  asOf?: string;
  owner?: string;
  /** Значение требует действия ответственного лица */
  needsAction?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-l-2 px-4 py-2",
        needsAction ? "border-l-action bg-action-soft" : "border-l-accent bg-accent-soft",
        className
      )}
    >
      <div className="text-table font-medium text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 text-decision font-semibold tracking-[-0.03em]",
          needsAction ? "text-action" : "text-text"
        )}
      >
        {nature ? (
          <Provenance
            value={value}
            nature={nature}
            source={source}
            formula={formula}
            asOf={asOf}
            owner={owner}
          />
        ) : (
          value
        )}
      </div>
      {hint && <div className="mt-1 text-table text-muted">{hint}</div>}
    </div>
  );
}

/** Строка служебных счётчиков интерфейса: без провенанса и без плиток. */
export function CounterLine({
  items,
  className,
}: {
  items: Array<{ label: string; value: string }>;
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-wrap items-baseline gap-x-6 gap-y-1 text-meta", className)}>
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-1.5">
          <dt className="text-ink-muted">{i.label}</dt>
          <dd className="font-semibold text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
