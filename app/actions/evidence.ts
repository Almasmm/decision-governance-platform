"use server";

// Доказательная база решения: альтернативы, допущения, риски, поручения,
// показатели, расчёты эффектов и их независимая проверка.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { CRITERIA_KEYS, CONFIDENCE_LEVELS } from "@/lib/domain";
import { automationEffect, riskEffect, npvEffect, type EffectResult } from "@/lib/effects";
import { type ActionResult, failure } from "@/lib/action-result";

const altSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(5),
  isStatusQuo: z.boolean(),
  criteriaScores: z.record(z.string(), z.number().min(0).max(10)),
});

export async function addAlternative(decisionId: string, input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "alternative.edit");
    const data = altSchema.parse(input);
    const scores: Record<string, number> = {};
    for (const k of CRITERIA_KEYS) scores[k] = data.criteriaScores[k] ?? 0;
    await prisma.$transaction(async (tx) => {
      const alt = await tx.alternative.create({
        data: {
          decisionId,
          name: data.name,
          description: data.description,
          isStatusQuo: data.isStatusQuo,
          criteriaScores: JSON.stringify(scores),
        },
      });
      await writeAudit(tx, {
        entity: "Alternative", entityId: alt.id, action: "CREATE", actorId: user.id,
        after: { decisionId, name: data.name, isStatusQuo: data.isStatusQuo },
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function addAssumption(
  decisionId: string,
  input: { text: string; value: string; confidence: string; validUntil: string }
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "assumption.edit");
    const schema = z.object({
      text: z.string().min(5),
      value: z.string().min(1),
      confidence: z.enum(CONFIDENCE_LEVELS),
      validUntil: z.string().min(8),
    });
    const data = schema.parse(input);
    await prisma.$transaction(async (tx) => {
      const a = await tx.assumption.create({
        data: {
          decisionId, text: data.text, value: data.value, confidence: data.confidence,
          validUntil: new Date(data.validUntil), ownerId: user.id,
        },
      });
      await writeAudit(tx, {
        entity: "Assumption", entityId: a.id, action: "CREATE", actorId: user.id, after: data,
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function addRisk(
  decisionId: string,
  input: {
    name: string; probability: number; impact: number; mitigation: string;
    residualProbability: number; residualImpact: number; triggers: string;
  }
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "risk.edit");
    const schema = z.object({
      name: z.string().min(3),
      probability: z.number().min(0).max(1),
      impact: z.number().min(0),
      mitigation: z.string().min(5),
      residualProbability: z.number().min(0).max(1),
      residualImpact: z.number().min(0),
      triggers: z.string().min(3),
    });
    const data = schema.parse(input);
    await prisma.$transaction(async (tx) => {
      const r = await tx.risk.create({ data: { decisionId, ...data, ownerId: user.id } });
      await writeAudit(tx, {
        entity: "Risk", entityId: r.id, action: "CREATE", actorId: user.id, after: data,
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function addAssignment(
  decisionId: string,
  input: { text: string; assigneeId: string; dueDate: string; linkedKpiId: string }
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "assignment.manage");
    const schema = z.object({
      text: z.string().min(5),
      assigneeId: z.string().min(1),
      dueDate: z.string().min(8),
      linkedKpiId: z.string().min(1, "Поручение должно быть связано с KPI результата"),
    });
    const data = schema.parse(input);
    await prisma.$transaction(async (tx) => {
      const a = await tx.assignment.create({
        data: {
          decisionId, text: data.text, assigneeId: data.assigneeId,
          dueDate: new Date(data.dueDate), linkedKpiId: data.linkedKpiId, status: "OPEN",
        },
      });
      await writeAudit(tx, {
        entity: "Assignment", entityId: a.id, action: "CREATE", actorId: user.id, after: data,
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function completeAssignment(assignmentId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "assignment.manage");
    const a = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!a) return { ok: false, error: "Поручение не найдено" };
    await prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: "DONE", completedAt: new Date() },
      });
      await writeAudit(tx, {
        entity: "Assignment", entityId: assignmentId, action: "COMPLETE", actorId: user.id,
        before: { status: a.status }, after: { status: "DONE" },
      });
    });
    revalidatePath(`/decisions/${a.decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function linkIndicator(
  decisionId: string,
  indicatorId: string,
  isCritical: boolean
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "indicator.link");
    await prisma.$transaction(async (tx) => {
      const link = await tx.decisionIndicator.create({
        data: { decisionId, indicatorId, isCritical },
      });
      await writeAudit(tx, {
        entity: "DecisionIndicator", entityId: link.id, action: "LINK", actorId: user.id,
        after: { decisionId, indicatorId, isCritical },
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Подтверждение качества показателя владельцем данных (только владелец или админ). */
export async function confirmIndicatorQuality(linkId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "indicator.confirmQuality");
    const link = await prisma.decisionIndicator.findUnique({
      where: { id: linkId },
      include: { indicator: true },
    });
    if (!link) return { ok: false, error: "Связь показателя не найдена" };
    if (user.role !== "ADMIN" && link.indicator.ownerId !== user.id)
      return { ok: false, error: "Подтверждать качество может только владелец этого показателя" };
    await prisma.$transaction(async (tx) => {
      await tx.decisionIndicator.update({
        where: { id: linkId },
        data: { confirmedById: user.id, confirmedAt: new Date() },
      });
      await writeAudit(tx, {
        entity: "DecisionIndicator", entityId: linkId, action: "CONFIRM_QUALITY", actorId: user.id,
        after: { indicator: link.indicator.code, confirmedBy: user.name },
      });
    });
    revalidatePath(`/decisions/${link.decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** Расчёт эффекта. Сохраняется только при полном наборе параметров. */
export async function addCalculation(
  decisionId: string,
  kind: "AUTOMATION" | "RISK" | "NPV",
  inputs: Record<string, unknown>,
  attributionNote?: string
): Promise<ActionResult<{ result: number }>> {
  try {
    const user = await requireUser();
    assertCan(user.role, "calc.create");
    let res: EffectResult;
    if (kind === "AUTOMATION") {
      res = automationEffect(inputs as { t0?: number; t1?: number; n?: number; c?: number });
    } else if (kind === "RISK") {
      res = riskEffect(inputs as { p0?: number; l0?: number; p1?: number; l1?: number; attributionShare?: number });
    } else {
      res = npvEffect(inputs as { rate?: number; years?: Array<{ et?: number; er?: number; tco?: number }> });
    }
    if (!res.ok)
      return { ok: false, error: `Недостаточно данных для расчёта. Не заполнены: ${res.missing.join(", ")}` };
    await prisma.$transaction(async (tx) => {
      const c = await tx.effectCalculation.create({
        data: {
          decisionId, kind, inputs: JSON.stringify(inputs), result: res.value,
          calculatedById: user.id, isConservative: true, attributionNote: attributionNote ?? null,
        },
      });
      await writeAudit(tx, {
        entity: "EffectCalculation", entityId: c.id, action: "CREATE", actorId: user.id,
        after: { kind, inputs, result: res.value },
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true, data: { result: res.value } };
  } catch (e) {
    return failure(e);
  }
}

/** Независимая проверка расчёта: проверяющий ≠ автор. */
export async function reviewCalculation(
  calculationId: string,
  verdict: "CONFIRMED" | "REJECTED",
  comment: string
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "calc.review");
    const calc = await prisma.effectCalculation.findUnique({ where: { id: calculationId } });
    if (!calc) return { ok: false, error: "Расчёт не найден" };
    if (calc.calculatedById === user.id)
      return { ok: false, error: "Независимую проверку не может выполнять автор расчёта" };
    await prisma.$transaction(async (tx) => {
      const r = await tx.calcReview.create({
        data: { calculationId, reviewerId: user.id, verdict, comment },
      });
      await writeAudit(tx, {
        entity: "CalcReview", entityId: r.id, action: "REVIEW", actorId: user.id,
        after: { calculationId, verdict, comment },
      });
    });
    revalidatePath(`/decisions/${calc.decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
