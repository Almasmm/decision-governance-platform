// Семантический data lineage: система-источник → интеграционный слой / DWH →
// определение расчёта → доказательство → решение → орган → бизнес-вывод.
// Узлы показывают статус, владельца, актуальность и ограничения без ложных связей.
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Calculator,
  CircleAlert,
  Database,
  FileCheck2,
  GitBranch,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { NatureMark, type ValueNature } from "@/components/provenance";
import { cn } from "@/lib/utils";

export type LineageNodeKind =
  | "source"
  | "integration"
  | "calculation"
  | "evidence"
  | "decision"
  | "authority"
  | "conclusion";

export type LineageNodeStatus = "verified" | "attention" | "demo" | "neutral" | "unavailable";

export interface LineageNode {
  id: string;
  title: string;
  description?: string;
  kind: LineageNodeKind;
  status: LineageNodeStatus;
  statusLabel: string;
  nature?: ValueNature;
  href?: string;
  metadata?: Array<{ label: string; value: string; attention?: boolean }>;
}

export interface LineageUse {
  id: string;
  decision: LineageNode;
  authority: LineageNode;
  conclusion: LineageNode;
}

const KIND_LABEL: Record<LineageNodeKind, string> = {
  source: "Система-источник",
  integration: "Интеграция / DWH",
  calculation: "Расчёт и определение",
  evidence: "Доказательство",
  decision: "Управленческое решение",
  authority: "Уполномоченный орган",
  conclusion: "Бизнес-вывод",
};

const NODE_STYLE: Record<LineageNodeStatus, string> = {
  verified: "border-accent bg-surface",
  attention: "border-action bg-action-soft",
  demo: "border-dashed border-muted bg-canvas",
  neutral: "border-line bg-surface",
  unavailable: "border-dotted border-muted bg-surface-raised",
};

export function LineageGraph({
  backbone,
  uses,
}: {
  backbone: LineageNode[];
  uses: LineageUse[];
}) {
  return (
    <div
      className="min-w-0"
      aria-label="Цепочка происхождения и использования показателя"
      data-tour="indicator-lineage"
    >
      <ol className="flex flex-col xl:flex-row xl:items-stretch" aria-label="Путь формирования доказательства">
        {backbone.map((node, index) => (
          <li key={node.id} className="contents">
            <LineageNodeCard node={node} className="flex-1" />
            {index < backbone.length - 1 && <LineageConnector />}
          </li>
        ))}
      </ol>

      <section className="mt-6 border-t border-line pt-5" aria-labelledby="lineage-use-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-meta font-semibold tracking-[0.1em] text-muted">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              ИСПОЛЬЗОВАНИЕ ДОКАЗАТЕЛЬСТВА
            </p>
            <h3 id="lineage-use-title" className="mt-1 text-lead font-semibold text-text">
              Решение → уполномоченный орган → бизнес-вывод
            </h3>
          </div>
          <p className="font-technical text-meta text-muted">{uses.length} связей</p>
        </div>

        {uses.length === 0 ? (
          <div className="mt-4 rounded-control border border-dashed border-line px-4 py-5 text-table text-muted">
            Показатель пока не включён в доказательную базу управленческих решений.
          </div>
        ) : (
          <ol className="mt-4 grid gap-3 2xl:grid-cols-2">
            {uses.map((use) => (
              <li key={use.id} className="grid min-w-0 gap-0 rounded-panel bg-canvas p-2 lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,0.8fr)_28px_minmax(0,1fr)] lg:items-stretch">
                <LineageNodeCard node={use.decision} compact />
                <LineageConnector compact />
                <LineageNodeCard node={use.authority} compact />
                <LineageConnector compact />
                <LineageNodeCard node={use.conclusion} compact />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function LineageNodeCard({ node, compact = false, className }: { node: LineageNode; compact?: boolean; className?: string }) {
  const icon = iconForKind(node.kind);

  return (
    <article
      className={cn(
        "min-w-0 rounded-panel border-l-[3px] p-4",
        NODE_STYLE[node.status],
        compact && "rounded-control p-3",
        className
      )}
      data-tour={node.kind === "conclusion" ? "indicator-business-conclusion" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-meta font-semibold tracking-[0.08em] text-muted">
          {icon}
          {KIND_LABEL[node.kind]}
        </p>
        <LineageStatus status={node.status} label={node.statusLabel} />
      </div>

      {node.href ? (
        <Link href={node.href} className="mt-3 block text-base font-semibold leading-5 text-text hover:text-accent hover:underline">
          {node.title}
        </Link>
      ) : (
        <h4 className="mt-3 text-base font-semibold leading-5 text-text">{node.title}</h4>
      )}
      {node.description && <p className="mt-1 text-meta leading-5 text-muted">{node.description}</p>}
      {node.nature && <div className="mt-3"><NatureMark nature={node.nature} /></div>}

      {node.metadata && node.metadata.length > 0 && (
        <dl className="mt-3 space-y-1.5 border-t border-line pt-3">
          {node.metadata.map((item) => (
            <div key={`${node.id}-${item.label}`} className="flex items-start justify-between gap-3 text-meta leading-4">
              <dt className="text-muted">{item.label}</dt>
              <dd className={cn("text-right font-medium text-text", item.attention && "text-action")}>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function LineageStatus({ status, label }: { status: LineageNodeStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-meta font-semibold",
        status === "verified" && "bg-accent-soft text-accent",
        status === "attention" && "bg-action-soft text-action",
        status === "demo" && "border border-dashed border-muted text-muted",
        status === "neutral" && "border border-line text-muted",
        status === "unavailable" && "border border-dotted border-muted text-muted"
      )}
    >
      {status === "verified" && <ShieldCheck className="h-3 w-3" aria-hidden="true" />}
      {status === "attention" && <CircleAlert className="h-3 w-3" aria-hidden="true" />}
      {status === "demo" && <span className="h-1.5 w-1.5 border border-dashed border-current" aria-hidden="true" />}
      {status === "unavailable" && <span className="h-1.5 w-1.5 rounded-full border border-dotted border-current" aria-hidden="true" />}
      {label}
    </span>
  );
}

function LineageConnector({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex h-9 shrink-0 items-center justify-center text-muted xl:h-auto xl:w-9",
        compact && "lg:h-auto lg:w-7"
      )}
      aria-hidden="true"
    >
      <span className={cn("h-full w-px bg-line xl:h-px xl:w-full", compact && "lg:h-px lg:w-full")} />
      <ArrowRight
        className={cn(
          "absolute h-4 w-4 rotate-90 bg-surface xl:rotate-0",
          compact && "bg-canvas lg:rotate-0"
        )}
      />
    </div>
  );
}

function iconForKind(kind: LineageNodeKind) {
  const className = "h-3.5 w-3.5 shrink-0";
  switch (kind) {
    case "source":
      return <Database className={className} aria-hidden="true" />;
    case "integration":
      return <GitBranch className={className} aria-hidden="true" />;
    case "calculation":
      return <Calculator className={className} aria-hidden="true" />;
    case "evidence":
      return <ShieldCheck className={className} aria-hidden="true" />;
    case "decision":
      return <Landmark className={className} aria-hidden="true" />;
    case "authority":
      return <Building2 className={className} aria-hidden="true" />;
    case "conclusion":
      return <FileCheck2 className={className} aria-hidden="true" />;
  }
}
