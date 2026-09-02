"use client";

// Ключевые допущения с датой действия — обязательны для решений уровня A.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isBefore } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  /** Уровень A: допущения обязательны */
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ключевые допущения</CardTitle>
        {requiredForLevel && <Badge variant="warn">обязательно для уровня A</Badge>}
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        <Table>
          <THead>
            <TR>
              <TH>Допущение</TH>
              <TH>Значение</TH>
              <TH>Уверенность</TH>
              <TH>Действует до</TH>
              <TH>Владелец</TH>
            </TR>
          </THead>
          <TBody>
            {assumptions.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-4 text-center text-sm text-slate-500">
                  Допущения не зафиксированы.
                </TD>
              </TR>
            )}
            {assumptions.map((a) => {
              const expired = isBefore(new Date(a.validUntil), new Date());
              return (
                <TR key={a.id}>
                  <TD className="max-w-80 text-sm">{a.text}</TD>
                  <TD>
                    <Badge variant="assumption">{ru.badges.assumption}</Badge>{" "}
                    <span className="text-xs">{a.value ?? "—"}</span>
                  </TD>
                  <TD className="text-xs">{ru.confidence[a.confidence as ConfidenceLevel]}</TD>
                  <TD className="whitespace-nowrap text-xs">
                    <span className={expired ? "text-brand-warn" : ""}>
                      {format(new Date(a.validUntil), "d MMM yyyy", { locale: ruLocale })}
                      {expired && " — истекло"}
                    </span>
                  </TD>
                  <TD className="text-xs">{a.ownerName ?? "—"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>

        {canEdit && (
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              const res = await addAssumption(decisionId, values);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              reset();
              router.refresh();
            })}
            className="space-y-2 border-t border-slate-100 px-4 py-3"
          >
            <div>
              <Label htmlFor="asm-text">Формулировка допущения</Label>
              <Textarea id="asm-text" {...register("text")} placeholder="Например: спотовая цена U₃O₈ в горизонте проекта" />
              {errors.text && <p className="mt-1 text-xs text-red-700">{errors.text.message}</p>}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label htmlFor="asm-value">Значение / диапазон</Label>
                <Input id="asm-value" {...register("value")} placeholder="не ниже 70 USD/фунт" />
                {errors.value && <p className="mt-1 text-xs text-red-700">{errors.value.message}</p>}
              </div>
              <div>
                <Label htmlFor="asm-conf">Уверенность</Label>
                <Select id="asm-conf" {...register("confidence")}>
                  {CONFIDENCE_LEVELS.map((c) => (
                    <option key={c} value={c}>
                      {ru.confidence[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="asm-until">Действует до</Label>
                <Input id="asm-until" type="date" {...register("validUntil")} />
                {errors.validUntil && (
                  <p className="mt-1 text-xs text-red-700">{errors.validUntil.message}</p>
                )}
              </div>
            </div>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Добавление…" : "Добавить допущение"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
