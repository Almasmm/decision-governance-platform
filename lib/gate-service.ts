// Серверный слой контрольных ворот: загружает конфигурацию из таблицы GateCheck,
// строит снимок решения и прогоняет правила из lib/gates.ts.
// Используется и route handler'ом POST /api/decisions/:id/advance, и UI-чек-листом.
import { prisma } from "./prisma";
import { assertCan } from "./authz";
import { writeAudit } from "./audit";
import { buildGateSnapshot, decisionInclude, type DecisionFull } from "./snapshot";
import { evaluateGate, type GateEvaluation } from "./gates";
import { nextStage, type Stage, type Role, type DecisionStatus } from "./domain";

export interface GateContext {
  decision: DecisionFull;
  currentStage: Stage;
  targetStage: Stage | null;
  evaluation: GateEvaluation | null;
}

export async function loadGateContext(decisionId: string): Promise<GateContext | null> {
  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    include: decisionInclude,
  });
  if (!decision) return null;
  return buildGateContext(decision);
}

export async function buildGateContext(decision: DecisionFull): Promise<GateContext> {
  const currentStage = decision.stage as Stage;
  const targetStage = nextStage(currentStage);
  if (!targetStage) {
    return { decision, currentStage, targetStage: null, evaluation: null };
  }
  const config = await prisma.gateCheck.findMany({
    where: { fromStage: currentStage, toStage: targetStage, criticality: decision.criticality },
  });
  const snapshot = buildGateSnapshot(decision);
  const evaluation = evaluateGate(snapshot, currentStage, targetStage, config);
  return { decision, currentStage, targetStage, evaluation };
}

/** Статус решения, соответствующий стадии после перехода. */
function statusForStage(stage: Stage, current: DecisionStatus): DecisionStatus {
  switch (stage) {
    case "EXECUTION":
      return "IN_EXECUTION";
    case "FEEDBACK":
      return "POST_EVALUATION";
    case "DECISION":
      return current === "RETURNED" ? "IN_REVIEW" : "IN_REVIEW";
    default:
      return current === "DRAFT" ? "DRAFT" : current;
  }
}

export type AdvanceOutcome =
  | { ok: true; fromStage: Stage; toStage: Stage; evaluation: GateEvaluation }
  | { ok: false; reason: "NOT_FOUND" | "LAST_STAGE" | "GATE_BLOCKED" | "DECISION_REQUIRED"; message: string; evaluation: GateEvaluation | null };

/**
 * Переход на следующую стадию. Ворота НЕ принимают решение — они проверяют
 * полноту доказательной базы. Переход с DECISION на EXECUTION дополнительно
 * требует, чтобы решение было принято человеком (status APPROVED).
 */
export async function advanceDecisionStage(
  decisionId: string,
  actor: { id: string; role: Role }
): Promise<AdvanceOutcome> {
  assertCan(actor.role, "decision.advance");

  const ctx = await loadGateContext(decisionId);
  if (!ctx) return { ok: false, reason: "NOT_FOUND", message: "Решение не найдено", evaluation: null };
  if (!ctx.targetStage || !ctx.evaluation)
    return {
      ok: false,
      reason: "LAST_STAGE",
      message: "Решение находится на последней стадии цикла",
      evaluation: null,
    };

  if (!ctx.evaluation.allowed) {
    const failed = ctx.evaluation.results.filter((r) => !r.passed);
    return {
      ok: false,
      reason: "GATE_BLOCKED",
      message: `Переход заблокирован контрольными воротами. Не выполнено правил: ${failed.length}.`,
      evaluation: ctx.evaluation,
    };
  }

  // Human-in-the-loop: выход со стадии «Решение» возможен только после того,
  // как уполномоченное лицо приняло решение явно.
  if (ctx.currentStage === "DECISION" && ctx.decision.status !== "APPROVED") {
    return {
      ok: false,
      reason: "DECISION_REQUIRED",
      message:
        "Система не переводит решение на исполнение автоматически: требуется явное решение уполномоченного лица с мотивировкой (вкладка «Решение»).",
      evaluation: ctx.evaluation,
    };
  }

  const target = ctx.targetStage;
  await prisma.$transaction(async (tx) => {
    await tx.decision.update({
      where: { id: decisionId },
      data: {
        stage: target,
        status: statusForStage(target, ctx.decision.status as DecisionStatus),
        packageReadyAt:
          target === "ALTERNATIVES" && !ctx.decision.packageReadyAt
            ? new Date()
            : ctx.decision.packageReadyAt,
      },
    });
    await writeAudit(tx, {
      entity: "Decision",
      entityId: decisionId,
      action: "STAGE_ADVANCE",
      actorId: actor.id,
      before: { stage: ctx.currentStage, status: ctx.decision.status },
      after: {
        stage: target,
        gateResults: ctx.evaluation?.results.map((r) => ({ code: r.code, passed: r.passed })),
      },
    });
  });

  return { ok: true, fromStage: ctx.currentStage, toStage: target, evaluation: ctx.evaluation };
}
