"use client";

// Создание паспорта решения. Уровень критичности определяет набор обязательных
// блоков и правил контрольных ворот.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createDecision } from "@/app/actions/decisions";
import { CRITICALITIES, DECISION_TYPES } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";

const schema = z.object({
  title: z.string().min(5, "Название — не менее 5 символов"),
  goal: z.string().min(10, "Цель — не менее 10 символов"),
  type: z.enum(DECISION_TYPES),
  criticality: z.enum(CRITICALITIES),
  decisionBodyId: z.string().min(1, "Укажите орган принятия"),
  deadline: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const LEVEL_HINT: Record<string, string> = {
  A: "Обязательны: показатели с владельцем и подтверждением качества, ≥2 альтернативы со статус-кво, риск-профиль с остаточным риском, ключевые допущения с датой действия, независимая проверка расчётов, поручения с KPI, пост-оценка.",
  B: "Обязательны: показатели с владельцем и подтверждением, ≥2 альтернативы со статус-кво, риск-профиль, поручения с KPI, пост-оценка.",
  C: "Обязательна проверка формальной полноты: цель, тип и орган принятия. Типовая операция проходит контур по упрощённым правилам.",
};

export function NewDecisionForm({ bodies }: { bodies: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      goal: "",
      type: "INVESTMENT",
      criticality: "A",
      decisionBodyId: bodies[0]?.id ?? "",
      deadline: "",
    },
  });

  const level = watch("criticality");

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-bold text-brand">Новый паспорт управленческого решения</h1>

      <Card>
        <CardHeader>
          <CardTitle>Идентификация вопроса</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              const res = await createDecision(values);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.push(`/decisions/${res.data?.id}`);
              router.refresh();
            })}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="title">Название решения</Label>
              <Input id="title" {...register("title")} placeholder="Например: расширение добычных мощностей на месторождении" />
              {errors.title && <p className="mt-1 text-xs text-red-700">{errors.title.message}</p>}
            </div>

            <div>
              <Label htmlFor="goal">Цель решения</Label>
              <Textarea id="goal" {...register("goal")} placeholder="Какого измеримого результата нужно достичь и к какому сроку" />
              {errors.goal && <p className="mt-1 text-xs text-red-700">{errors.goal.message}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">Тип решения</Label>
                <Select id="type" {...register("type")}>
                  {DECISION_TYPES.map((t) => (
                    <option key={t} value={t}>{ru.decisionTypes[t]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="criticality">Уровень критичности</Label>
                <Select id="criticality" {...register("criticality")}>
                  {CRITICALITIES.map((c) => (
                    <option key={c} value={c}>{ru.criticality[c]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="body">Орган принятия решения</Label>
                <Select id="body" {...register("decisionBodyId")}>
                  {bodies.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
                {errors.decisionBodyId && (
                  <p className="mt-1 text-xs text-red-700">{errors.decisionBodyId.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="deadline">Срок решения</Label>
                <Input id="deadline" type="date" {...register("deadline")} />
              </div>
            </div>

            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">
              <span className="font-semibold text-brand-warn">Уровень {level}.</span>{" "}
              {LEVEL_HINT[level]}
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Создание…" : "Создать паспорт"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
