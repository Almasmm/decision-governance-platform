"use client";

// Пост-оценка: сопоставление плана и факта, извлечённые уроки, закрытие решения.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addLesson, closeDecision } from "@/app/actions/decisions";
import { CAUSE_CATEGORIES, type CauseCategory } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";

export interface LessonView {
  id: string;
  whatPlanned: string;
  whatHappened: string;
  causeCategory: string;
  conclusion: string;
}

const schema = z.object({
  whatPlanned: z.string().min(5, "Опишите, что планировалось"),
  whatHappened: z.string().min(5, "Опишите, что произошло фактически"),
  causeCategory: z.enum(CAUSE_CATEGORIES),
  conclusion: z.string().min(5, "Сформулируйте вывод для будущих решений"),
});
type Values = z.infer<typeof schema>;

export function PostEvaluationPanel({
  decisionId,
  lessons,
  canEdit,
  canClose,
  stageIsFeedback,
  isClosed,
}: {
  decisionId: string;
  lessons: LessonView[];
  canEdit: boolean;
  canClose: boolean;
  stageIsFeedback: boolean;
  isClosed: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { whatPlanned: "", whatHappened: "", causeCategory: "EXECUTION", conclusion: "" },
  });

  async function close() {
    setBusy(true);
    setError(null);
    const res = await closeDecision(decisionId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Извлечённые уроки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lessons.length === 0 && (
            <p className="text-sm text-slate-500">
              Уроки не зафиксированы. Пост-оценка без вывода не замыкает цикл обучения.
            </p>
          )}
          {lessons.map((l) => (
            <div key={l.id} className="rounded border border-slate-200 p-3">
              <Badge variant="outline">{ru.causeCategories[l.causeCategory as CauseCategory]}</Badge>
              <dl className="mt-1.5 space-y-1 text-xs">
                <div>
                  <dt className="text-slate-500">Планировалось</dt>
                  <dd className="text-slate-800">{l.whatPlanned}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Фактически</dt>
                  <dd className="text-slate-800">{l.whatHappened}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Вывод</dt>
                  <dd className="font-medium text-brand">{l.conclusion}</dd>
                </div>
              </dl>
            </div>
          ))}
        </CardContent>
      </Card>

      {canEdit && !isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>Записать урок в базу знаний</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                const res = await addLesson(decisionId, values);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                reset();
                router.refresh();
              })}
              className="space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="les-plan">Что планировалось</Label>
                  <Textarea id="les-plan" {...register("whatPlanned")} />
                  {errors.whatPlanned && (
                    <p className="mt-1 text-xs text-red-700">{errors.whatPlanned.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="les-fact">Что произошло фактически</Label>
                  <Textarea id="les-fact" {...register("whatHappened")} />
                  {errors.whatHappened && (
                    <p className="mt-1 text-xs text-red-700">{errors.whatHappened.message}</p>
                  )}
                </div>
              </div>
              <div className="sm:w-72">
                <Label htmlFor="les-cause">Категория причины отклонения</Label>
                <Select id="les-cause" {...register("causeCategory")}>
                  {CAUSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {ru.causeCategories[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="les-concl">Вывод для будущих решений</Label>
                <Textarea id="les-concl" {...register("conclusion")} />
                {errors.conclusion && (
                  <p className="mt-1 text-xs text-red-700">{errors.conclusion.message}</p>
                )}
              </div>
              {error && <p className="text-xs text-red-700">{error}</p>}
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Сохранение…" : "Записать урок"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {canClose && stageIsFeedback && !isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>Закрытие решения</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-slate-600">
              Закрыть паспорт можно только после того, как зафиксирован хотя бы один урок:
              решение считается завершённым, когда организация чему-то научилась.
            </p>
            {error && <p className="mb-2 text-xs text-red-700">{error}</p>}
            <Button size="sm" disabled={busy} onClick={close}>
              Закрыть решение
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
