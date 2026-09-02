// «Любое число кликабельно до источника»: иконка происхождения открывает
// панель с системой-источником, датой актуальности, владельцем и формулой.
// Реализовано на <details> — работает в серверных компонентах без JS.
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ru } from "@/lib/i18n/ru";

export type ValueNature = "fact" | "forecast" | "assumption";

export interface ProvenanceProps {
  value: string;
  nature: ValueNature;
  source?: string;
  asOf?: string;
  owner?: string;
  formula?: string;
  note?: string;
}

export function Provenance({ value, nature, source, asOf, owner, formula, note }: ProvenanceProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium tabular-nums">{value}</span>
      <Badge variant={nature}>{ru.badges[nature]}</Badge>
      <details className="relative inline-block align-middle">
        <summary className="flex cursor-pointer list-none items-center text-brand-accent hover:text-brand [&::-webkit-details-marker]:hidden">
          <Info className="h-3.5 w-3.5" aria-label="Происхождение значения" />
        </summary>
        <div className="absolute left-0 top-5 z-30 w-72 rounded border border-slate-200 bg-white p-3 text-xs shadow-lg">
          <div className="mb-1.5 font-semibold text-brand">Происхождение значения</div>
          <dl className="space-y-1">
            {source && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{ru.common.source}</dt>
                <dd className="text-right font-medium">{source}</dd>
              </div>
            )}
            {asOf && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{ru.common.asOf}</dt>
                <dd className="text-right font-medium">{asOf}</dd>
              </div>
            )}
            {owner && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{ru.common.owner}</dt>
                <dd className="text-right font-medium">{owner}</dd>
              </div>
            )}
            {formula && (
              <div>
                <dt className="text-slate-500">{ru.common.formula}</dt>
                <dd className="mt-0.5 rounded bg-slate-50 px-1.5 py-1 font-mono text-[11px]">{formula}</dd>
              </div>
            )}
            {note && <div className="mt-1 text-slate-500">{note}</div>}
          </dl>
        </div>
      </details>
    </span>
  );
}
