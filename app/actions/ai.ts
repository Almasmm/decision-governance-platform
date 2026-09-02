"use server";

// ИИ-помощник. Ограничения ступеней проверяются НА СЕРВЕРЕ (lib/ai/eligibility.ts).
// Результат всегда сохраняется как AiSuggestion со статусом PENDING:
// ни одна рекомендация не применяется автоматически.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { getAiProvider, type AiDecisionContext } from "@/lib/ai/provider";
import { checkTierEligibility } from "@/lib/ai/eligibility";
import { decisionInclude, computeBlockCompleteness } from "@/lib/snapshot";
import { BLOCK_KINDS, parseJson, type AiTier, type Criticality } from "@/lib/domain";
import { type ActionResult, failure } from "@/lib/action-result";

async function buildAiContext(decisionId: string): Promise<AiDecisionContext | null> {
  const d = await prisma.decision.findUnique({ where: { id: decisionId }, include: decisionInclude });
  if (!d) return null;

  const indicatorIds = d.indicatorLinks.map((l) => l.indicatorId);
  const values = await prisma.indicatorValue.findMany({
    where: { indicatorId: { in: indicatorIds } },
    orderBy: { asOf: "desc" },
  });

  return {
    code: d.code,
    title: d.title,
    criticality: d.criticality,
    goal: d.goal,
    stage: d.stage,
    blocks: BLOCK_KINDS.map((kind) => ({ kind, completeness: computeBlockCompleteness(d, kind) })),
    alternatives: d.alternatives.map((a) => ({
      name: a.name,
      isStatusQuo: a.isStatusQuo,
      criteriaScores: parseJson<Record<string, number>>(a.criteriaScores, {}),
    })),
    risks: d.risks.map((r) => ({ name: r.name, probability: r.probability, impact: r.impact })),
    indicators: d.indicatorLinks.map((l) => {
      const own = values.filter((v) => v.indicatorId === l.indicatorId);
      const latest = own[0] ?? null;
      // Сверка между источниками: ближайшее значение, загруженное иным способом
      const cross = latest ? (own.find((v) => v.loadType !== latest.loadType) ?? null) : null;
      return {
        code: l.indicator.code,
        name: l.indicator.name,
        sourceSystem: l.indicator.sourceSystem,
        ownerName: l.indicator.owner?.name ?? null,
        latestValue: latest?.value ?? null,
        crossSourceValue: cross?.value ?? null,
      };
    }),
  };
}

export async function runAiTier(decisionId: string, tier: AiTier): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user.role, "ai.run");

    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      include: { indicatorLinks: { include: { indicator: true } } },
    });
    if (!decision) return { ok: false, error: "Решение не найдено" };

    const models = await prisma.aiModel.findMany();
    const eligibility = checkTierEligibility({
      criticality: decision.criticality as Criticality,
      indicators: decision.indicatorLinks.map((l) => ({
        code: l.indicator.code,
        ownerId: l.indicator.ownerId,
        sourceSystem: l.indicator.sourceSystem,
      })),
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        validatedAt: m.validatedAt,
        allowedForLevels: m.allowedForLevels,
      })),
    });
    const tierCheck = eligibility.find((e) => e.tier === tier);
    if (!tierCheck || !tierCheck.allowed)
      return { ok: false, error: tierCheck?.reason ?? "Ступень недоступна" };

    const ctx = await buildAiContext(decisionId);
    if (!ctx) return { ok: false, error: "Не удалось собрать контекст решения" };

    const provider = getAiProvider();
    const answer =
      tier === "INFORMATIONAL"
        ? await provider.informational(ctx)
        : tier === "ANALYTICAL"
          ? await provider.analytical(ctx)
          : await provider.recommendational(ctx);

    // Для рекомендательной ступени фиксируем, какая именно модель использована
    const modelId =
      tier === "RECOMMENDATIONAL"
        ? (models.find((m) => {
            const levels = parseJson<string[]>(m.allowedForLevels, []);
            return m.validatedAt !== null && levels.includes(decision.criticality);
          })?.id ?? null)
        : null;

    const created = await prisma.$transaction(async (tx) => {
      const s = await tx.aiSuggestion.create({
        data: {
          decisionId,
          tier,
          modelId,
          content: answer.content,
          explanation: answer.explanation,
          sourceRefs: JSON.stringify(answer.sourceRefs),
          humanVerdict: "PENDING",
        },
      });
      await writeAudit(tx, {
        entity: "AiSuggestion",
        entityId: s.id,
        action: "AI_RUN",
        actorId: user.id,
        after: { tier, provider: provider.name, modelId, decisionId },
      });
      return s;
    });

    revalidatePath(`/decisions/${decisionId}`);
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Вердикт человека по предложению ИИ. Для уровня A обоснование обязательно
 * при любом вердикте: ответственность остаётся на уполномоченном лице.
 */
export async function setAiVerdict(
  suggestionId: string,
  verdict: "ACCEPTED" | "REJECTED" | "MODIFIED",
  reason: string
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "ai.verdict");
    const s = await prisma.aiSuggestion.findUnique({
      where: { id: suggestionId },
      include: { decision: true },
    });
    if (!s) return { ok: false, error: "Предложение не найдено" };

    const needsReason = s.decision.criticality === "A" || verdict !== "ACCEPTED";
    if (needsReason && reason.trim().length < 5)
      return {
        ok: false,
        error:
          s.decision.criticality === "A"
            ? "Для решений уровня A вердикт по рекомендации ИИ требует текстового обоснования"
            : "Укажите обоснование вердикта",
      };

    await prisma.$transaction(async (tx) => {
      await tx.aiSuggestion.update({
        where: { id: suggestionId },
        data: { humanVerdict: verdict, verdictReason: reason, verifiedById: user.id },
      });
      await writeAudit(tx, {
        entity: "AiSuggestion",
        entityId: suggestionId,
        action: "AI_VERDICT",
        actorId: user.id,
        before: { humanVerdict: s.humanVerdict },
        after: { humanVerdict: verdict, verdictReason: reason },
      });
    });

    revalidatePath(`/decisions/${s.decisionId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
