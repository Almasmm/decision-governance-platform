// Прослеживаемость: любое число предметной области кликабельно до источника.
// Само значение и есть кнопка — пунктирное подчёркивание показывает, что за
// числом стоит система-источник, дата актуальности, владелец и формула.
//
// Провенанс ставится ТОЛЬКО на значения предметной области (показатель, расчёт
// эффекта, оценка риска). На служебных счётчиках интерфейса — никогда.
import { Badge } from "@/components/ui/badge";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export type ValueNature = "fact" | "forecast" | "assumption";

export interface ProvenanceProps {
  value: string;
  nature: ValueNature;
  source?: string;
  asOf?: string;
  owner?: string;
  formula?: string;
  note?: string;
  className?: string;
}

/** Метка природы числа: цвет и форма рамки различаются одновременно. */
export function NatureMark({ nature }: { nature: ValueNature }) {
  return (
    <Badge variant={nature} title={NATURE_TITLE[nature]}>
      {ru.badges[nature]}
    </Badge>
  );
}

const NATURE_TITLE: Record<ValueNature, string> = {
  fact: "Факт: измеренное значение из системы-источника",
  forecast: "Прогноз: расчётная величина, зависит от входных параметров",
  assumption: "Допущение: принято экспертно, действует до указанной даты",
};

export function Provenance({
  value,
  nature,
  source,
  asOf,
  owner,
  formula,
  note,
  className,
}: ProvenanceProps) {
  const hasSource = Boolean(source || asOf || owner || formula || note);

  if (!hasSource) {
    return (
      <span className={cn("inline-flex items-baseline gap-1.5", className)}>
        <span>{value}</span>
        <NatureMark nature={nature} />
      </span>
    );
  }

  return (
    <details className={cn("group relative inline-block", className)}>
      <summary className="inline-flex cursor-pointer items-baseline gap-1.5 rounded-control">
        <span className="border-b border-dotted border-muted group-open:border-solid group-open:border-accent">
          {value}
        </span>
        <NatureMark nature={nature} />
      </summary>
      <div className="reveal absolute left-1/2 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-panel border border-line bg-surface p-4 text-table font-normal text-text shadow-overlay sm:left-0 sm:translate-x-0">
        <div className="mb-3 border-b border-line pb-2 text-base font-semibold text-text">
          Происхождение значения
        </div>
        <dl className="space-y-2">
          {source && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">{ru.common.source}</dt>
              <dd className="text-right">{source}</dd>
            </div>
          )}
          {asOf && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">{ru.common.asOf}</dt>
              <dd className="text-right">{asOf}</dd>
            </div>
          )}
          {owner && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted">{ru.common.owner}</dt>
              <dd className="text-right">{owner}</dd>
            </div>
          )}
          {formula && (
            <div>
              <dt className="text-muted">{ru.common.formula}</dt>
              <dd className="mt-1 rounded-control bg-surface-raised px-2 py-1.5 font-technical text-meta">{formula}</dd>
            </div>
          )}
          {note && <p className="border-t border-line pt-2 text-muted">{note}</p>}
        </dl>
      </div>
    </details>
  );
}
