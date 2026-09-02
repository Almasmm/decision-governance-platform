"use client";

// Создание паспорта решения. Уровень критичности определяет набор обязательных
// блоков и правил контрольных ворот.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
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

const LEVEL_AUTHORITY: Record<string, { label: string; authority: string; evidence: string }> = {
  A: { label: "Стратегическое", authority: "Комитет / Совет директоров", evidence: "Максимальный доказательный контур" },
  B: { label: "Существенное", authority: "Коллегиальный орган", evidence: "Расширенный доказательный контур" },
  C: { label: "Типовое", authority: "Уполномоченный руководитель", evidence: "Формальная полнота и контроль" },
};

const LIFECYCLE = ["Проблема", "Данные", "Альтернативы", "Риски", "Решение", "Исполнение", "Обратная связь"];

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

  const levelConfig = LEVEL_AUTHORITY[level] ?? LEVEL_AUTHORITY.C!;

  return (
    <main className="workspace space-y-7">
      <header className="border-b border-line pb-5">
        <p className="eyebrow">Инициация управленческого цикла</p>
        <h1 className="mt-2 text-page font-semibold tracking-[-0.03em] text-text">Новый паспорт решения</h1>
        <p className="mt-2 max-w-3xl text-lead leading-7 text-muted">
          Сначала зафиксируйте управленческий вопрос, измеримую цель и орган, который несёт
          финальную ответственность. Доказательная база будет собираться по стадиям.
        </p>
      </header>

      <ol aria-label="Жизненный цикл будущего решения" className="grid grid-cols-2 border-y border-line sm:grid-cols-4 xl:grid-cols-7">
        {LIFECYCLE.map((stage, index) => (
          <li key={stage} className="flex min-h-14 items-center gap-2 border-line px-3 py-2 [&:not(:last-child)]:border-r">
            <span className="font-mono text-meta tabular-nums text-accent">{String(index + 1).padStart(2, "0")}</span>
            <span className="text-meta font-medium text-text">{stage}</span>
          </li>
        ))}
      </ol>

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
            className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
          >
        <section className="bg-surface shadow-panel" aria-labelledby="identification-heading">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <p className="eyebrow">01 · Предмет решения</p>
            <h2 id="identification-heading" className="mt-1 text-section font-semibold text-text">Идентификация вопроса</h2>
          </div>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div>
              <Label htmlFor="title">Название решения</Label>
              <Input id="title" {...register("title")} placeholder="Например: расширение добычных мощностей на месторождении" />
              {errors.title && <p className="mt-1 text-meta text-action">{errors.title.message}</p>}
            </div>

            <div>
              <Label htmlFor="goal">Измеримая управленческая цель</Label>
              <Textarea className="min-h-28" id="goal" {...register("goal")} placeholder="Какого результата нужно достичь, в каком масштабе и к какому сроку" />
              {errors.goal && <p className="mt-1 text-meta text-action">{errors.goal.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">Тип решения</Label>
                <Select id="type" {...register("type")}>
                  {DECISION_TYPES.map((type) => (
                    <option key={type} value={type}>{ru.decisionTypes[type]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="deadline">Контрольный срок</Label>
                <Input id="deadline" type="date" {...register("deadline")} />
              </div>
            </div>

            <div className="border-t border-line pt-5">
              <p className="eyebrow">02 · Authority</p>
              <div className="mt-3">
                <Label htmlFor="body">Орган принятия решения</Label>
                <Select id="body" {...register("decisionBodyId")}>
                  {bodies.map((body) => (
                    <option key={body.id} value={body.id}>{body.name}</option>
                  ))}
                </Select>
                {errors.decisionBodyId && <p className="mt-1 text-meta text-action">{errors.decisionBodyId.message}</p>}
              </div>
            </div>

            {error && <p className="border-l-2 border-action bg-action-soft px-3 py-2 text-base text-action">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="max-w-md text-meta leading-5 text-muted">
                После создания система сформирует пустое досье и проверит первый gate. Переходы не выполняются автоматически.
              </p>
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Создание…" : "Создать паспорт"}
                {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </section>

        <aside className="sticky top-24 overflow-hidden bg-obsidian text-white shadow-panel" aria-labelledby="criticality-heading">
          <div className="border-b border-white/15 px-5 py-5">
            <p className="text-meta font-semibold uppercase tracking-[0.16em] text-accent-soft">03 · Criticality</p>
            <label htmlFor="criticality" className="mt-4 flex items-center justify-between gap-4">
              <span>
                <span id="criticality-heading" className="block text-base font-semibold">Класс контроля</span>
                <span className="mt-1 block text-meta text-white/55">Определяет обязательность evidence</span>
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-control border border-white/40 text-decision font-semibold">{level}</span>
            </label>
            <Select id="criticality" {...register("criticality")} className="mt-4 border-white/25 bg-obsidian text-white">
              {CRITICALITIES.map((criticality) => (
                <option key={criticality} value={criticality} className="bg-surface text-text">{ru.criticality[criticality]}</option>
              ))}
            </Select>
          </div>
          <div className="px-5 py-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-soft" aria-hidden="true" />
              <div>
                <h3 className="text-section font-semibold">Уровень {level} · {levelConfig.label}</h3>
                <p className="mt-1 text-table text-white/60">{levelConfig.authority}</p>
              </div>
            </div>
            <div className="mt-5 border-l-2 border-accent pl-4">
              <p className="text-table font-semibold text-white">{levelConfig.evidence}</p>
              <p className="mt-2 text-meta leading-5 text-white/65">{LEVEL_HINT[level]}</p>
            </div>
            <p className="mt-6 border-t border-white/15 pt-4 text-meta leading-5 text-white/55">
              Gate проверяет минимальную достаточность доказательств. Он не одобряет решение и не принимает риск за человека.
            </p>
          </div>
        </aside>
      </form>
    </main>
  );
}
