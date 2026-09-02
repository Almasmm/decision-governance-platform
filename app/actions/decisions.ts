"use server";

// Мутации паспорта решения. Каждая: проверка прав НА СЕРВЕРЕ → изменение → AuditEvent.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { CRITICALITIES, DECISION_TYPES, BLOCK_KINDS, type BlockKind } from "@/lib/domain";
import { type ActionResult, failure } from "@/lib/action-result";

const createSchema = z.object({
  title: z.string().min(5, "Название — не менее 5 символов"),
  goal: z.string().min(10, "Цель — не менее 10 символов"),
  type: z.enum(DECISION_TYPES),
  criticality: z.enum(CRITICALITIES),
  decisionBodyId: z.string().min(1, "Укажите орган принятия"),
  deadline: z.string().optional(),
});

const TYPE_PREFIX: Record<string, string> = {
  INVESTMENT: "INV", PRODUCTION: "PRD", PROCUREMENT: "PRC", HR: "HR",
  RISK: "RSK", STRATEGY: "STR", DIGITAL: "DIG",
};

export async function createDecision(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user.role, "decision.create");
    const data = createSchema.parse(input);

    const year = new Date().getFullYear();
    const prefix = TYPE_PREFIX[data.type] ?? "DEC";
    const count = await prisma.decision.count({ where: { code: { startsWith: `${prefix}-${year}` } } });
    const code = `${prefix}-${year}-${String(count + 1 + 100).slice(1)}`;

    const decision = await prisma.$transaction(async (tx) => {
      const d = await tx.decision.create({
        data: {
          code,
          title: data.title,
          goal: data.goal,
          type: data.type,
          criticality: data.criticality,
          stage: "PROBLEM",
          status: "DRAFT",
          initiatorId: user.id,
          decisionBodyId: data.decisionBodyId,
          deadline: data.deadline ? new Date(data.deadline) : null,
        },
      });
      for (const kind of BLOCK_KINDS) {
        await tx.decisionBlock.create({ data: { decisionId: d.id, kind, payload: "{}" } });
      }
      await writeAudit(tx, {
        entity: "Decision", entityId: d.id, action: "CREATE", actorId: user.id,
        after: { code, title: data.title, criticality: data.criticality },
      });
      return d;
    });

    revalidatePath("/decisions");
    return { ok: true, data: { id: decision.id } };
  } catch (e) {
    return failure(e);
  }
}

export async function updateBlockPayload(
  decisionId: string,
  kind: BlockKind,
  payload: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "decision.editBlocks");
    const block = await prisma.decisionBlock.findUnique({
      where: { decisionId_kind: { decisionId, kind } },
    });
    if (!block) return { ok: false, error: "Блок не найден" };
    await prisma.$transaction(async (tx) => {
      await tx.decisionBlock.update({
        where: { id: block.id },
        data: { payload: JSON.stringify(payload) },
      });
      await writeAudit(tx, {
        entity: "DecisionBlock", entityId: block.id, action: "UPDATE_PAYLOAD", actorId: user.id,
        before: JSON.parse(block.payload), after: payload,
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function submitForReview(decisionId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "decision.submit");
    const d = await prisma.decision.findUnique({ where: { id: decisionId } });
    if (!d) return { ok: false, error: "Решение не найдено" };
    if (d.status !== "DRAFT" && d.status !== "RETURNED")
      return { ok: false, error: "Отправить на экспертизу можно только черновик или возвращённое решение" };
    await prisma.$transaction(async (tx) => {
      await tx.decision.update({
        where: { id: decisionId },
        data: { status: "IN_REVIEW", packageReadyAt: d.packageReadyAt ?? new Date() },
      });
      await writeAudit(tx, {
        entity: "Decision", entityId: decisionId, action: "SUBMIT_FOR_REVIEW", actorId: user.id,
        before: { status: d.status }, after: { status: "IN_REVIEW" },
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function returnDecision(decisionId: string, reason: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "decision.return");
    if (!reason || reason.trim().length < 5)
      return { ok: false, error: "Укажите причину возврата (не менее 5 символов)" };
    const d = await prisma.decision.findUnique({ where: { id: decisionId } });
    if (!d) return { ok: false, error: "Решение не найдено" };
    await prisma.$transaction(async (tx) => {
      await tx.decision.update({
        where: { id: decisionId },
        data: { status: "RETURNED", returnCount: { increment: 1 } },
      });
      await writeAudit(tx, {
        entity: "Decision", entityId: decisionId, action: "RETURN", actorId: user.id,
        before: { status: d.status, returnCount: d.returnCount },
        after: { status: "RETURNED", returnCount: d.returnCount + 1, reason },
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Принятие решения уполномоченным лицом. Система НИКОГДА не делает это
 * автоматически: обязательны явный выбор альтернативы и текстовая мотивировка.
 */
export async function decideDecision(
  decisionId: string,
  alternativeId: string,
  motivation: string,
  verdict: "APPROVED" | "REJECTED"
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "decision.decide");
    if (!motivation || motivation.trim().length < 10)
      return { ok: false, error: "Мотивировка обязательна (не менее 10 символов)" };
    const d = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { alternatives: true },
    });
    if (!d) return { ok: false, error: "Решение не найдено" };
    if (d.stage !== "DECISION")
      return { ok: false, error: "Принятие возможно только на стадии «Решение»" };
    const alt = d.alternatives.find((a) => a.id === alternativeId);
    if (verdict === "APPROVED" && !alt) return { ok: false, error: "Выберите альтернативу" };

    await prisma.$transaction(async (tx) => {
      if (verdict === "APPROVED" && alt) {
        await tx.alternative.updateMany({ where: { decisionId }, data: { selected: false } });
        await tx.alternative.update({ where: { id: alt.id }, data: { selected: true } });
      }
      await tx.decision.update({
        where: { id: decisionId },
        data: { status: verdict, motivation, decidedAt: new Date() },
      });
      await writeAudit(tx, {
        entity: "Decision", entityId: decisionId, action: "DECIDE", actorId: user.id,
        before: { status: d.status },
        after: { status: verdict, motivation, selectedAlternative: alt?.name ?? null },
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function addLesson(
  decisionId: string,
  input: { whatPlanned: string; whatHappened: string; causeCategory: string; conclusion: string }
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "lesson.create");
    const schema = z.object({
      whatPlanned: z.string().min(5),
      whatHappened: z.string().min(5),
      causeCategory: z.enum(["EXTERNAL", "DATA_QUALITY", "WRONG_MODEL", "EXECUTION", "UNFORESEEN_RISK"]),
      conclusion: z.string().min(5),
    });
    const data = schema.parse(input);
    await prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.create({ data: { decisionId, ...data } });
      await writeAudit(tx, {
        entity: "Lesson", entityId: lesson.id, action: "CREATE", actorId: user.id, after: data,
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    revalidatePath("/lessons");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function closeDecision(decisionId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "decision.advance");
    const d = await prisma.decision.findUnique({ where: { id: decisionId }, include: { lessons: true } });
    if (!d) return { ok: false, error: "Решение не найдено" };
    if (d.stage !== "FEEDBACK")
      return { ok: false, error: "Закрыть можно только на стадии «Обратная связь»" };
    if (d.lessons.length === 0)
      return { ok: false, error: "Перед закрытием зафиксируйте хотя бы один урок в базе знаний" };
    await prisma.$transaction(async (tx) => {
      await tx.decision.update({ where: { id: decisionId }, data: { status: "CLOSED" } });
      await writeAudit(tx, {
        entity: "Decision", entityId: decisionId, action: "CLOSE", actorId: user.id,
        before: { status: d.status }, after: { status: "CLOSED" },
      });
    });
    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
