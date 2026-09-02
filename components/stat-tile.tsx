import { cn } from "@/lib/utils";
import { Provenance, type ValueNature } from "@/components/provenance";

export function StatTile({
  label,
  value,
  hint,
  nature,
  source,
  formula,
  asOf,
  owner,
  warn = false,
}: {
  label: string;
  value: string;
  hint?: string;
  nature?: ValueNature;
  source?: string;
  formula?: string;
  asOf?: string;
  owner?: string;
  warn?: boolean;
}) {
  return (
    <div className={cn("rounded border bg-white p-3", warn ? "border-amber-300" : "border-slate-200")}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", warn ? "text-brand-warn" : "text-brand")}>
        {nature ? (
          <Provenance value={value} nature={nature} source={source} formula={formula} asOf={asOf} owner={owner} />
        ) : (
          value
        )}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
