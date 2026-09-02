import Link from "next/link";
import { AlertCircle, Check, ChevronRight, Minus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import type { BlockKind, Criticality } from "@/lib/domain";
import type { PassportCompleteness } from "@/lib/snapshot";

export function EvidenceIndex({
  decisionId,
  activeBlock,
  completeness,
  criticality,
}: {
  decisionId: string;
  activeBlock: BlockKind;
  completeness: PassportCompleteness;
  criticality: Criticality;
}) {
  const required = completeness.blocks.filter((block) => block.required);
  const confirmed = required.filter((block) => block.completeness === 100).length;

  return (
    <aside className="min-w-0 self-start overflow-hidden rounded-panel bg-surface shadow-panel xl:sticky xl:top-20" aria-labelledby="evidence-index-title">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-meta font-semibold tracking-[0.12em] text-muted">EVIDENCE INDEX</p>
            <h2 id="evidence-index-title" className="mt-0.5 text-lead font-semibold text-text">
              Доказательная база
            </h2>
          </div>
          <span className="text-section font-semibold text-text">{completeness.percent}%</span>
        </div>
        <Progress
          className="mt-3"
          value={completeness.percent}
          warnBelow={100}
          label={`Полнота доказательной базы ${completeness.percent}%`}
        />
        <p className="mt-2 text-meta text-muted">
          {confirmed} из {required.length} обязательных блоков подтверждены · уровень {criticality}
        </p>
      </div>

      <ol className="flex gap-1 overflow-x-auto p-2 xl:block xl:space-y-0.5 xl:overflow-visible" aria-label="Девять блоков доказательной базы">
        {completeness.blocks.map((block, index) => (
          <EvidenceIndexItem
            key={block.kind}
            decisionId={decisionId}
            block={block}
            index={index}
            selected={activeBlock === block.kind}
          />
        ))}
      </ol>
    </aside>
  );
}

function EvidenceIndexItem({
  decisionId,
  block,
  index,
  selected,
}: {
  decisionId: string;
  block: PassportCompleteness["blocks"][number];
  index: number;
  selected: boolean;
}) {
  const complete = block.completeness === 100;
  const needsAction = block.required && !complete;
  const status = !block.required
    ? "Не обязателен"
    : complete
      ? "Подтверждено"
      : block.completeness === 0
        ? "Не начато"
        : `${block.completeness}%`;

  return (
    <li className="min-w-[190px] xl:min-w-0">
      <Link
        href={`/decisions/${decisionId}?tab=passport&block=${block.kind}`}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "group grid min-h-14 grid-cols-[28px_minmax(0,1fr)_18px] items-center gap-2 rounded-control border-l-2 px-2.5 py-2 transition-colors",
          selected && "border-obsidian bg-surface-raised",
          !selected && "border-transparent hover:bg-canvas",
          needsAction && selected && "border-action bg-action-soft"
        )}
      >
        <span className="font-technical text-meta text-muted">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className="block truncate text-table font-semibold text-text">{ru.blocks[block.kind]}</span>
          <span className={cn("mt-0.5 flex items-center gap-1 text-meta", needsAction ? "text-action" : "text-muted")}>
            {!block.required ? (
              <Minus className="h-3 w-3" aria-hidden="true" />
            ) : complete ? (
              <Check className="h-3 w-3 text-accent" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
            )}
            {status}
          </span>
        </span>
        <ChevronRight className={cn("h-4 w-4 text-line transition-colors", selected ? "text-text" : "group-hover:text-muted")} aria-hidden="true" />
      </Link>
    </li>
  );
}
