import { NatureMark } from "@/components/provenance";
import { cn } from "@/lib/utils";

const NATURES = [
  {
    kind: "fact" as const,
    description: "измерено и датировано системой-источником",
  },
  {
    kind: "forecast" as const,
    description: "рассчитано моделью из входных данных",
  },
  {
    kind: "assumption" as const,
    description: "принято человеком и ограничено сроком действия",
  },
];

export function EvidenceNatureLegend({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <section className={cn("min-w-0", className)} aria-labelledby="evidence-nature-title">
      <p id="evidence-nature-title" className="text-meta font-semibold tracking-[0.1em] text-muted">
        ПРИРОДА ЧИСЛА
      </p>
      <div className={cn("mt-2", compact ? "flex flex-wrap gap-x-4 gap-y-2" : "grid gap-2")}>
        {NATURES.map((nature) => (
          <div key={nature.kind} className="flex items-start gap-2">
            <NatureMark nature={nature.kind} />
            {!compact && <p className="text-meta leading-4 text-muted">{nature.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
