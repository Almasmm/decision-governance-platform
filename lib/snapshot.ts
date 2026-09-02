// Снимок решения для движка ворот + расчёт полноты блоков паспорта.
// Полнота считается из фактического содержимого, а не хранится «на веру».
import { Prisma } from "@prisma/client";
import type { GateSnapshot } from "./gates";
import { GATE_RULES } from "./gates";
import type { BlockKind, Criticality } from "./domain";
import { BLOCK_KINDS, CRITERIA_KEYS, parseJson } from "./domain";

export const decisionInclude = {
  initiator: true,
  decisionBody: true,
  blocks: true,
  alternatives: true,
  assumptions: { include: { owner: true } },
  risks: { include: { owner: true } },
  assignments: { include: { assignee: true, linkedKpi: true } },
  calculations: { include: { reviews: true, calculatedBy: true } },
  suggestions: { include: { model: true, verifiedBy: true } },
  lessons: true,
  indicatorLinks: { include: { indicator: { include: { owner: true } } } },
} satisfies Prisma.DecisionInclude;

export type DecisionFull = Prisma.DecisionGetPayload<{ include: typeof decisionInclude }>;

export function buildGateSnapshot(d: DecisionFull): GateSnapshot {
  return {
    criticality: d.criticality as Criticality,
    goal: d.goal,
    type: d.type,
    decisionBodyId: d.decisionBodyId,
    motivation: d.motivation,
    alternatives: d.alternatives.map((a) => ({
      name: a.name,
      isStatusQuo: a.isStatusQuo,
      description: a.description,
      criteriaScores: parseJson<Record<string, number>>(a.criteriaScores, {}),
      selected: a.selected,
    })),
    risks: d.risks.map((r) => ({
      name: r.name,
      residualProbability: r.residualProbability,
      residualImpact: r.residualImpact,
      ownerId: r.ownerId,
    })),
    assumptions: d.assumptions.map((a) => ({ text: a.text, validUntil: a.validUntil })),
    assignments: d.assignments.map((a) => ({ text: a.text, linkedKpiId: a.linkedKpiId })),
    indicators: d.indicatorLinks.map((l) => ({
      code: l.indicator.code,
      name: l.indicator.name,
      isCritical: l.isCritical || l.indicator.isCritical,
      ownerId: l.indicator.ownerId,
      ownerName: l.indicator.owner?.name ?? null,
      sourceSystem: l.indicator.sourceSystem,
      confirmed: l.confirmedById !== null,
    })),
    calculations: d.calculations.map((c) => ({
      kind: c.kind,
      calculatedById: c.calculatedById,
      reviews: c.reviews.map((r) => ({ reviewerId: r.reviewerId, verdict: r.verdict })),
    })),
    postEvaluationCompleteness: computeBlockCompleteness(d, "POST_EVALUATION"),
  };
}

interface BlockPayload {
  summary?: string;
  safetyNote?: string;
  regulatoryNote?: string;
  planFact?: string;
  economicsNote?: string;
  dataNote?: string;
  executionNote?: string;
  decisionNote?: string;
  [key: string]: unknown;
}

function payloadOf(d: DecisionFull, kind: BlockKind): BlockPayload {
  const block = d.blocks.find((b) => b.kind === kind);
  return parseJson<BlockPayload>(block?.payload, {});
}

/** Полнота одного блока паспорта (0–100) из фактического содержимого. */
export function computeBlockCompleteness(d: DecisionFull, kind: BlockKind): number {
  const snapshotLite = () => buildGateSnapshotLite(d);
  switch (kind) {
    case "IDENTIFICATION": {
      let score = 0;
      if (d.goal && d.goal.trim().length >= 10) score += 40;
      if (d.type) score += 20;
      if (d.decisionBodyId) score += 20;
      if (d.deadline) score += 20;
      return score;
    }
    case "DATA": {
      const critical = d.indicatorLinks.filter((l) => l.isCritical || l.indicator.isCritical);
      if (d.indicatorLinks.length === 0) return 0;
      let score = 40;
      if (critical.length > 0) {
        const sourced = critical.filter((l) => l.indicator.ownerId && l.indicator.sourceSystem);
        const confirmed = critical.filter((l) => l.confirmedById);
        score += Math.round((sourced.length / critical.length) * 30);
        score += Math.round((confirmed.length / critical.length) * 30);
      } else {
        score += 30; // нет критических — достаточно привязки
      }
      return Math.min(100, score);
    }
    case "ALTERNATIVES": {
      const s = snapshotLite();
      const r1 = GATE_RULES.ALTERNATIVES_MIN(s);
      const r2 = GATE_RULES.UNIFORM_CRITERIA(s);
      if (d.alternatives.length === 0) return 0;
      let score = 40;
      if (r1.passed) score += 30;
      if (r2.passed) score += 30;
      return score;
    }
    case "ECONOMICS": {
      if (d.calculations.length === 0) return 0;
      const reviewed = d.calculations.some((c) =>
        c.reviews.some((r) => r.verdict === "CONFIRMED" && r.reviewerId !== c.calculatedById)
      );
      return reviewed ? 100 : 70;
    }
    case "SAFETY": {
      const p = payloadOf(d, "SAFETY");
      let score = 0;
      if (p.safetyNote && String(p.safetyNote).trim().length > 0) score += 50;
      if (p.regulatoryNote && String(p.regulatoryNote).trim().length > 0) score += 50;
      return score;
    }
    case "RISKS": {
      if (d.risks.length === 0) return 0;
      const complete = d.risks.filter(
        (r) => r.residualProbability !== null && r.residualImpact !== null && r.ownerId
      );
      return Math.round(40 + (complete.length / d.risks.length) * 60);
    }
    case "DECISION": {
      let score = 0;
      if (d.alternatives.some((a) => a.selected)) score += 40;
      if (d.motivation && d.motivation.trim().length >= 10) score += 40;
      if (d.decidedAt) score += 20;
      return score;
    }
    case "EXECUTION": {
      if (d.assignments.length === 0) return 0;
      const linked = d.assignments.filter((a) => a.linkedKpiId);
      return Math.round(40 + (linked.length / d.assignments.length) * 60);
    }
    case "POST_EVALUATION": {
      const p = payloadOf(d, "POST_EVALUATION");
      let score = 0;
      if (p.planFact && String(p.planFact).trim().length > 0) score += 50;
      if (d.lessons.length > 0) score += 50;
      return score;
    }
  }
}

// Лёгкий снимок без рекурсии в POST_EVALUATION (используется внутри расчёта полноты)
function buildGateSnapshotLite(d: DecisionFull): GateSnapshot {
  return {
    criticality: d.criticality as Criticality,
    goal: d.goal,
    type: d.type,
    decisionBodyId: d.decisionBodyId,
    motivation: d.motivation,
    alternatives: d.alternatives.map((a) => ({
      name: a.name,
      isStatusQuo: a.isStatusQuo,
      description: a.description,
      criteriaScores: parseJson<Record<string, number>>(a.criteriaScores, {}),
      selected: a.selected,
    })),
    risks: [],
    assumptions: [],
    assignments: [],
    indicators: [],
    calculations: [],
    postEvaluationCompleteness: 0,
  };
}

/** Какие блоки обязательны для уровня критичности. */
export const REQUIRED_BLOCKS: Record<Criticality, BlockKind[]> = {
  A: [...BLOCK_KINDS],
  B: [...BLOCK_KINDS],
  C: ["IDENTIFICATION", "DATA", "DECISION", "EXECUTION"],
};

export interface PassportCompleteness {
  percent: number;
  blocks: Array<{ kind: BlockKind; completeness: number; required: boolean }>;
}

export function computePassportCompleteness(d: DecisionFull): PassportCompleteness {
  const required = REQUIRED_BLOCKS[d.criticality as Criticality] ?? [...BLOCK_KINDS];
  const blocks = BLOCK_KINDS.map((kind) => ({
    kind,
    completeness: computeBlockCompleteness(d, kind),
    required: required.includes(kind),
  }));
  const req = blocks.filter((b) => b.required);
  const percent =
    req.length === 0 ? 0 : Math.round(req.reduce((s, b) => s + b.completeness, 0) / req.length);
  return { percent, blocks };
}

/** Проверка единого набора критериев (для UI матрицы альтернатив). */
export function hasUniformCriteria(scores: Record<string, number>): boolean {
  return CRITERIA_KEYS.every((k) => typeof scores[k] === "number");
}
