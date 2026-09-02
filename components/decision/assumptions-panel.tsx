"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isBefore } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { addAssumption } from "@/app/actions/evidence";
import { CONFIDENCE_LEVELS, type ConfidenceLevel } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";

export interface AssumptionView {
  id: string;
  text: string;
  value: string | null;
  confidence: string;
  validUntil: string;
  ownerName: string | null;
}

const schema = z.object({
  text: z.string().min(5, "Опишите допущение"),
  value: z.string().min(1, "Укажите значение или диапазон"),
  confidence: z.enum(CONFIDENCE_LEVELS),
  validUntil: z.string().min(8, "Укажите дату действия"),
});
type Values = z.infer<typeof schema>;

export function AssumptionsPanel({
  decisionId,
  assumptions,
  canEdit,
  requiredForLevel,
}: {
  decisionId: string;
  assumptions: AssumptionView[];
  canEdit: boolean;
  requiredForLevel: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", value: "", confidence: "MEDIUM", validUntil: "" },
  });

  const expiredCount = assumptions.filter((assumption) =>
    isBefore(new Date(assumption.validUntil), new Date())
  ).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-4 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow">Assumption register</p>
          <h2 className="mt-1 text-decision font-semibold tracking-[-0.02em] text-text">
            Ключевые допущения
          </h2>
          <p className="mt-2 text-base text-muted">
            Допущение — не факт. Для проверки решения фиксируются значение, уровень уверенности,
            срок действия и персональный владелец.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {requiredForLevel && <Badge variant="action">Обязательно для уровня A</Badge>}
          <Badge variant={expiredCount > 0 ? "partial" : "neutral"}>
            Истекло: {expiredCount}
          </Badge>
        </div>
      </header>

      {requiredForLevel && assumptions.length === 0 && (
        <div className="flex items-start gap-3 border-l-2 border-action bg-action-soft px-4 py-3 text-table text-action">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Evidence gap:</span> для решения уровня A не
            зафиксировано ни одного ключевого допущения.
          </p>
        </div>
      )}

      <section className="overflow-hidden border-y border-line bg-surface" aria-label="Реестр допущений">
        <Table className="min-w-[860px]">
          <THead>
            <TR>
              <TH scope="col" className="w-[34%]">Допущение</TH>
              <TH scope="col">Принятое значение</TH>
              <TH scope="col">Уверенность</TH>
              <TH scope="col">Действует до</TH>
              <TH scope="col">Владелец</TH>
            </TR>
          </THead>
          <TBody>
            {assumptions.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-base text-muted">
                  Допущения не зафиксированы.
                </TD>
              </TR>
            )}
            {assumptions.map((assumption) => {
              const expired = isBefore(new Date(assumption.validUntil), new Date());
              return (
                <TR key={assumption.id}>
                  <TD>
                    <div className="flex items-start gap-2">
                      <Badge variant="assumption" className="mt-0.5 shrink-0">
                        {ru.badges.assumption}
                      </Badge>
                      <p className="text-base font-semibold text-text">{assumption.text}</p>
                    </div>
                  </TD>
                  <TD className="text-table font-semibold text-text">
                    {assumption.value ?? "Не указано"}
                  </TD>
                  <TD className="text-table text-text">
                    {ru.confidence[assumption.confidence as ConfidenceLevel]}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-2 text-table ${
                        expired ? "font-semibold text-action" : "text-text"
                      }`}
                    >
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {format(new Date(assumption.validUntil), "d MMM yyyy", { locale: ruLocale })}
                      {expired && " · истекло"}
                    </span>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-2 text-table text-text">
                      <UserRound className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      {assumption.ownerName ?? <span className="font-semibold text-action">Не назначен</span>}
                    </span>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </section>

      {canEdit && (
        <section className="surface-band p-5" aria-labelledby="new-assumption-heading">
          <div className="border-b border-line pb-4">
            <p className="eyebrow">Evidence input</p>
            <h3 id="new-assumption-heading" className="mt-1 text-section font-semibold text-text">
              Зафиксировать допущение
            </h3>
          </div>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              const result = await addAssumption(decisionId, values);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              reset();
              router.refresh();
            })}
            className="mt-5 space-y-4"
          >
            <div>
              <Label htmlFor="asm-text">Формулировка допущения</Label>
              <Textarea
                id="asm-text"
                {...register("text")}
                placeholder="Например: спотовая цена U₃O₈ в горизонте проекта"
              />
              {errors.text && <p className="mt-1 text-table text-action">{errors.text.message}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="asm-value">Значение / диапазон</Label>
                <Input id="asm-value" {...register("value")} placeholder="не ниже 70 USD/фунт" />
                {errors.value && <p className="mt-1 text-table text-action">{errors.value.message}</p>}
              </div>
              <div>
                <Label htmlFor="asm-conf">Уверенность</Label>
                <Select id="asm-conf" {...register("confidence")}>
                  {CONFIDENCE_LEVELS.map((confidence) => (
                    <option key={confidence} value={confidence}>
                      {ru.confidence[confidence]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="asm-until">Действует до</Label>
                <Input id="asm-until" type="date" {...register("validUntil")} />
                {errors.validUntil && (
                  <p className="mt-1 text-table text-action">{errors.validUntil.message}</p>
                )}
              </div>
            </div>
            {error && (
              <p className="text-table text-action" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={isSubmitting}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? "Добавление…" : "Добавить допущение"}
              </Button>
              <p className="text-meta text-muted">
                Владельцем и автором evidence записи фиксируется текущий пользователь.
              </p>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
