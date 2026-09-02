"use server";

// Работа с каталогом показателей: автозагрузка значения через коннектор-заглушку
// и ручной ввод. Обе операции пишут в аудит.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { fetchIndicator } from "@/lib/connectors";
import { type ActionResult, failure } from "@/lib/action-result";

/** Загрузка значения из системы-источника через слой коннекторов. */
export async function loadIndicatorFromSource(
  indicatorId: string
): Promise<ActionResult<{ value: number }>> {
  try {
    const user = await requireUser();
    assertCan(user.role, "indicator.manage");
    const indicator = await prisma.indicator.findUnique({ where: { id: indicatorId } });
    if (!indicator) return { ok: false, error: "Показатель не найден" };

    const fetched = await fetchIndicator(indicator.code);
    await prisma.$transaction(async (tx) => {
      const v = await tx.indicatorValue.create({
        data: {
          indicatorId,
          value: fetched.value,
          asOf: fetched.asOf,
          loadType: fetched.loadType,
          versionNote: fetched.versionNote ?? null,
        },
      });
      await writeAudit(tx, {
        entity: "IndicatorValue",
        entityId: v.id,
        action: "LOAD_FROM_SOURCE",
        actorId: user.id,
        after: { code: indicator.code, value: fetched.value, source: fetched.sourceSystem },
      });
    });

    revalidatePath(`/indicators/${indicatorId}`);
    revalidatePath("/indicators");
    return { ok: true, data: { value: fetched.value } };
  } catch (e) {
    return failure(e);
  }
}

/** Ручной ввод значения показателя с обязательным примечанием о версии. */
export async function addIndicatorValueManually(
  indicatorId: string,
  input: { value: number; asOf: string; versionNote: string }
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user.role, "indicator.manage");
    const schema = z.object({
      value: z.number(),
      asOf: z.string().min(8),
      versionNote: z.string().min(3, "Укажите источник и основание ручного ввода"),
    });
    const data = schema.parse(input);
    await prisma.$transaction(async (tx) => {
      const v = await tx.indicatorValue.create({
        data: {
          indicatorId,
          value: data.value,
          asOf: new Date(data.asOf),
          loadType: "MANUAL",
          versionNote: data.versionNote,
        },
      });
      await writeAudit(tx, {
        entity: "IndicatorValue",
        entityId: v.id,
        action: "MANUAL_INPUT",
        actorId: user.id,
        after: data,
      });
    });
    revalidatePath(`/indicators/${indicatorId}`);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
