"use server";

// Администрирование: роли пользователей, справочник органов принятия решений,
// настройка правил контрольных ворот. Все операции — только роль ADMIN, всё в аудит.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ROLES, CRITICALITIES, STAGES } from "@/lib/domain";
import { GATE_RULE_CODES, ruleDescription } from "@/lib/gates";
import { type ActionResult, failure } from "@/lib/action-result";

export async function updateUserRole(userId: string, role: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "admin.users");
    const parsed = z.enum(ROLES).parse(role);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return { ok: false, error: "Пользователь не найден" };
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role: parsed } });
      await writeAudit(tx, {
        entity: "User", entityId: userId, action: "UPDATE_ROLE", actorId: user.id,
        before: { role: target.role }, after: { role: parsed },
      });
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function createDecisionBody(name: string, kind: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "admin.bodies");
    const data = z
      .object({ name: z.string().min(3), kind: z.enum(["BOARD", "COMMITTEE", "MANAGEMENT", "EXECUTIVE"]) })
      .parse({ name, kind });
    await prisma.$transaction(async (tx) => {
      const b = await tx.decisionBody.create({ data });
      await writeAudit(tx, {
        entity: "DecisionBody", entityId: b.id, action: "CREATE", actorId: user.id, after: data,
      });
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function setGateBlocking(gateId: string, isBlocking: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "admin.gates");
    const gate = await prisma.gateCheck.findUnique({ where: { id: gateId } });
    if (!gate) return { ok: false, error: "Правило не найдено" };
    await prisma.$transaction(async (tx) => {
      await tx.gateCheck.update({ where: { id: gateId }, data: { isBlocking } });
      await writeAudit(tx, {
        entity: "GateCheck", entityId: gateId, action: "UPDATE_BLOCKING", actorId: user.id,
        before: { isBlocking: gate.isBlocking },
        after: { isBlocking, rule: gate.rule, criticality: gate.criticality },
      });
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function createGateCheck(input: {
  fromStage: string;
  toStage: string;
  criticality: string;
  rule: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "admin.gates");
    const data = z
      .object({
        fromStage: z.enum(STAGES),
        toStage: z.enum(STAGES),
        criticality: z.enum(CRITICALITIES),
        rule: z.enum(GATE_RULE_CODES),
      })
      .parse(input);
    const fromIdx = STAGES.indexOf(data.fromStage);
    const toIdx = STAGES.indexOf(data.toStage);
    if (toIdx !== fromIdx + 1)
      return { ok: false, error: "Правило задаётся только для перехода на следующую стадию цикла" };

    await prisma.$transaction(async (tx) => {
      const g = await tx.gateCheck.create({
        data: { ...data, description: ruleDescription(data.rule), isBlocking: true },
      });
      await writeAudit(tx, {
        entity: "GateCheck", entityId: g.id, action: "CREATE", actorId: user.id, after: data,
      });
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteGateCheck(gateId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "admin.gates");
    const gate = await prisma.gateCheck.findUnique({ where: { id: gateId } });
    if (!gate) return { ok: false, error: "Правило не найдено" };
    await prisma.$transaction(async (tx) => {
      await tx.gateCheck.delete({ where: { id: gateId } });
      await writeAudit(tx, {
        entity: "GateCheck", entityId: gateId, action: "DELETE", actorId: user.id,
        before: { rule: gate.rule, criticality: gate.criticality, fromStage: gate.fromStage, toStage: gate.toStage },
      });
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
