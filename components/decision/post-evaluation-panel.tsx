"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, BookOpenCheck, CheckCircle2, LockKeyhole, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select, Textarea } from "@/components/ui/input";
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
    defaultValues: {
      whatPlanned: "",
      whatHappened: "",
      causeCategory: "EXECUTION",
      conclusion: "",
    },
  });

  async function close() {
    setBusy(true);
    setError(null);
    const result = await closeDecision(decisionId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5" data-tour="post-evaluation-workspace">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-4 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow">Learning close-out</p>
          <h2 className="mt-1 text-decision font-semibold tracking-[-0.02em] text-text">
            Пост-оценка решения
          </h2>
          <p className="mt-2 text-base text-muted">
            Цикл замыкается сопоставлением ожидаемого и фактического результата. Причина объясняет
            отклонение, а урок меняет подготовку следующего решения.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={lessons.length > 0 ? "resolvedSoft" : "action"}>
            Уроков: {lessons.length}
          </Badge>
          {isClosed ? (
            <Badge variant="resolved">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Решение закрыто
            </Badge>
          ) : (
            <Badge variant="neutral">Цикл открыт</Badge>
          )}
        </div>
      </header>

      <section aria-labelledby="recorded-lessons-heading" data-tour="post-evaluation-loop">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Knowledge evidence</p>
            <h3 id="recorded-lessons-heading" className="mt-1 text-section font-semibold text-text">
              Зафиксированные уроки
            </h3>
          </div>
          <p className="hidden text-table text-muted sm:block">PLAN → FACT → LESSON</p>
        </div>

        {lessons.length === 0 ? (
          <div className="border-y border-line bg-surface px-5 py-8">
            <div className="flex max-w-2xl items-start gap-3">
              <BookOpenCheck className="mt-0.5 h-6 w-6 shrink-0 text-muted" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold text-text">Уроки не зафиксированы</p>
                <p className="mt-1 text-base text-muted">
                  Пост-оценка без применимого вывода не замыкает организационный цикл обучения.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {lessons.map((lesson, index) => (
              <article
                key={lesson.id}
                className="bg-surface px-4 py-5 sm:px-5"
                data-tour={index === 0 ? "post-evaluation-plan-fact-lesson" : undefined}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="font-technical text-meta font-semibold text-muted">
                    LESSON {String(index + 1).padStart(2, "0")}
                  </p>
                  <Badge variant="outline">
                    {ru.causeCategories[lesson.causeCategory as CauseCategory]}
                  </Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,1.1fr)] lg:items-stretch">
                  <section
                    className="rounded-control border border-dotted border-action bg-action-soft p-4"
                    data-tour={index === 0 ? "post-evaluation-plan" : undefined}
                  >
                    <p className="eyebrow !text-action">01 · Plan</p>
                    <p className="mt-3 whitespace-pre-line text-base text-text">{lesson.whatPlanned}</p>
                  </section>
                  <div className="hidden items-center justify-center lg:flex">
                    <ArrowRight className="h-5 w-5 text-muted" aria-hidden="true" />
                  </div>
                  <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted lg:hidden" aria-hidden="true" />
                  <section
                    className="rounded-control border border-text bg-surface p-4"
                    data-tour={index === 0 ? "post-evaluation-fact" : undefined}
                  >
                    <p className="eyebrow">02 · Fact</p>
                    <p className="mt-3 whitespace-pre-line text-base text-text">{lesson.whatHappened}</p>
                  </section>
                  <div className="hidden items-center justify-center lg:flex">
                    <ArrowRight className="h-5 w-5 text-muted" aria-hidden="true" />
                  </div>
                  <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted lg:hidden" aria-hidden="true" />
                  <section
                    className="rounded-control bg-obsidian p-4 text-surface"
                    data-tour={index === 0 ? "post-evaluation-lesson" : undefined}
                  >
                    <p className="font-technical text-meta uppercase tracking-[0.14em] text-accent-soft">
                      03 · Lesson
                    </p>
                    <p className="mt-3 whitespace-pre-line text-lead font-semibold">
                      {lesson.conclusion}
                    </p>
                  </section>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {canEdit && !isClosed && (
        <section
          className="surface-band p-5"
          aria-labelledby="new-lesson-heading"
          data-tour="post-evaluation-add-lesson"
        >
          <div className="border-b border-line pb-4">
            <p className="eyebrow">Close the loop</p>
            <h3 id="new-lesson-heading" className="mt-1 text-section font-semibold text-text">
              Записать урок в базу знаний
            </h3>
          </div>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              const result = await addLesson(decisionId, values);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              reset();
              router.refresh();
            })}
            className="mt-5 space-y-4"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] lg:items-center">
              <div>
                <Label htmlFor="les-plan">01 · Что планировалось</Label>
                <Textarea id="les-plan" {...register("whatPlanned")} />
                {errors.whatPlanned && (
                  <p className="mt-1 text-table text-action">{errors.whatPlanned.message}</p>
                )}
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 text-muted lg:block" aria-hidden="true" />
              <div>
                <Label htmlFor="les-fact">02 · Что произошло фактически</Label>
                <Textarea id="les-fact" {...register("whatHappened")} />
                {errors.whatHappened && (
                  <p className="mt-1 text-table text-action">{errors.whatHappened.message}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div>
                <Label htmlFor="les-cause">Категория причины отклонения</Label>
                <Select id="les-cause" {...register("causeCategory")}>
                  {CAUSE_CATEGORIES.map((cause) => (
                    <option key={cause} value={cause}>
                      {ru.causeCategories[cause]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="les-concl">03 · Вывод для будущих решений</Label>
                <Textarea id="les-concl" {...register("conclusion")} />
                {errors.conclusion && (
                  <p className="mt-1 text-table text-action">{errors.conclusion.message}</p>
                )}
              </div>
            </div>
            {error && (
              <p className="text-table text-action" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? "Сохранение…" : "Записать урок"}
            </Button>
          </form>
        </section>
      )}

      {canClose && stageIsFeedback && !isClosed && (
        <section
          className="rounded-panel bg-obsidian p-5 text-surface shadow-panel"
          aria-labelledby="close-decision-heading"
          data-tour="post-evaluation-close-cycle"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex max-w-3xl items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-accent-soft" aria-hidden="true" />
              <div>
                <p className="font-technical text-meta uppercase tracking-[0.14em] text-accent-soft">
                  Final lifecycle action
                </p>
                <h3 id="close-decision-heading" className="mt-1 text-section font-semibold">
                  Закрытие решения
                </h3>
                <p className="mt-2 text-base text-white/65">
                  Паспорт закрывается после фиксации хотя бы одного урока. Решение считается
                  завершённым, когда организация сохранила знание для следующего цикла.
                </p>
              </div>
            </div>
            <Button variant="secondary" className="shrink-0" disabled={busy} onClick={close}>
              {busy ? "Закрытие…" : "Закрыть решение"}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-table text-action-soft" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
