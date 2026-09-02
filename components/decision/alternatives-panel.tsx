"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowRight, Plus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { addAlternative } from "@/app/actions/evidence";
import { decideDecision } from "@/app/actions/decisions";
import { CRITERIA_KEYS } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { T, SERIES, SERIES_DASH, axisTick } from "@/components/chart-tokens";

export interface AlternativeView {
  id: string;
  name: string;
  description: string;
  isStatusQuo: boolean;
  selected: boolean;
  scores: Record<string, number>;
}

const altSchema = z.object({
  name: z.string().min(3, "Название — не менее 3 символов"),
  description: z.string().min(5, "Описание — не менее 5 символов"),
  isStatusQuo: z.string(),
  safety: z.coerce.number().min(0).max(10),
  regulatory: z.coerce.number().min(0).max(10),
  economics: z.coerce.number().min(0).max(10),
  timeline: z.coerce.number().min(0).max(10),
  resources: z.coerce.number().min(0).max(10),
  hr: z.coerce.number().min(0).max(10),
  cyber: z.coerce.number().min(0).max(10),
  sustainability: z.coerce.number().min(0).max(10),
});
type AltValues = z.infer<typeof altSchema>;

export function AlternativesPanel({
  decisionId,
  alternatives,
  canEdit,
  canDecide,
  stageIsDecision,
  decidedMotivation,
}: {
  decisionId: string;
  alternatives: AlternativeView[];
  canEdit: boolean;
  canDecide: boolean;
  stageIsDecision: boolean;
  decidedMotivation: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [chosen, setChosen] = useState<string>(alternatives.find((a) => a.selected)?.id ?? "");
  const [motivation, setMotivation] = useState(decidedMotivation ?? "");
  const [busy, setBusy] = useState(false);

  const hasStatusQuo = alternatives.some((a) => a.isStatusQuo);
  const substantive = alternatives.filter((a) => !a.isStatusQuo);
  const selectedAlternative = alternatives.find((a) => a.selected) ?? null;
  const ranked = alternatives
    .map((alternative) => ({
      alternative,
      total: CRITERIA_KEYS.reduce((sum, key) => sum + (alternative.scores[key] ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);
  const analyticalLeader = ranked[0] ?? null;

  const chartData = CRITERIA_KEYS.map((key) => {
    const row: Record<string, string | number> = { criterion: ru.criteria[key] };
    alternatives.forEach((alternative) => {
      row[alternative.name] = alternative.scores[key] ?? 0;
    });
    return row;
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltValues>({
    resolver: zodResolver(altSchema),
    defaultValues: {
      name: "",
      description: "",
      isStatusQuo: "false",
      safety: 5,
      regulatory: 5,
      economics: 5,
      timeline: 5,
      resources: 5,
      hr: 5,
      cyber: 5,
      sustainability: 5,
    },
  });

  async function decide(verdict: "APPROVED" | "REJECTED") {
    setBusy(true);
    setError(null);
    const res = await decideDecision(decisionId, chosen, motivation, verdict);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow">Comparison workspace</p>
          <h2 className="mt-1 text-section font-semibold text-text">Сравнение вариантов решения</h2>
          <p className="mt-1 max-w-3xl text-base text-muted">
            Единый набор критериев делает варианты сопоставимыми. Итоговая сумма помогает анализу,
            но не выбирает решение за уполномоченное лицо.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-meta text-muted">Вариантов</dt>
            <dd className="text-section font-semibold text-text">{alternatives.length}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted">Критериев</dt>
            <dd className="text-section font-semibold text-text">{CRITERIA_KEYS.length}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted">Статус-кво</dt>
            <dd className={cn("text-base font-semibold", hasStatusQuo ? "text-success" : "text-action")}>
              {hasStatusQuo ? "присутствует" : "отсутствует"}
            </dd>
          </div>
          {canEdit && (
            <div className="flex items-end">
              <Button size="sm" variant="secondary" onClick={() => setShowForm((value) => !value)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {showForm ? "Скрыть форму" : "Добавить вариант"}
              </Button>
            </div>
          )}
        </dl>
      </header>

      {(!hasStatusQuo || substantive.length < 2) && (
        <section className="border-l-2 border-action bg-action-soft px-4 py-3" aria-label="Пробелы сравнения">
          <div className="flex items-center gap-2 text-base font-semibold text-action">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Сравнение требует дополнения
          </div>
          <ul className="mt-2 space-y-1 text-base text-text">
            {!hasStatusQuo && (
              <li>Добавьте статус-кво: без сценария бездействия невозможно оценить цену отказа от изменений.</li>
            )}
            {substantive.length < 2 && (
              <li>Содержательных вариантов: {substantive.length}. Для уровней A и B требуется не менее двух.</li>
            )}
          </ul>
        </section>
      )}

      <section className="surface-band overflow-hidden" aria-labelledby="comparison-matrix-title">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
          <h3 id="comparison-matrix-title" className="text-section font-semibold text-text">
            Матрица критериев
          </h3>
          <p className="text-table text-muted">Оценка 0–10 · одинаковая шкала для всех вариантов</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-table">
            <thead>
              <tr className="border-b border-line-strong">
                <th className="sticky left-0 z-20 w-52 bg-surface px-4 py-3 text-left font-semibold text-muted">
                  Критерий
                </th>
                {alternatives.map((alternative) => (
                  <th
                    key={alternative.id}
                    className={cn(
                      "min-w-44 px-4 py-3 text-left align-top font-semibold text-text",
                      alternative.isStatusQuo && !alternative.selected && "bg-canvas",
                      alternative.selected && "bg-accent-soft"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{alternative.name}</span>
                      {alternative.isStatusQuo && <Badge variant="neutral">статус-кво</Badge>}
                    </div>
                    {alternative.selected && (
                      <span className="mt-1 inline-flex items-center gap-1 text-meta font-semibold text-accent">
                        <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        выбор человека
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRITERIA_KEYS.map((key) => (
                <tr key={key} className="border-b border-line last:border-b-0">
                  <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-text">
                    {ru.criteria[key]}
                  </th>
                  {alternatives.map((alternative) => {
                    const value = alternative.scores[key];
                    return (
                      <td
                        key={alternative.id}
                        className={cn(
                          "px-4 py-3",
                          alternative.isStatusQuo && !alternative.selected && "bg-canvas",
                          alternative.selected && "bg-accent-soft"
                        )}
                      >
                        {typeof value === "number" ? (
                          <div className="flex items-center gap-3">
                            <span className="w-5 text-base font-semibold tabular-nums text-text">{value}</span>
                            <span className="h-1.5 w-16 overflow-hidden rounded bg-surface-raised" aria-hidden="true">
                              <span className="block h-full bg-accent" style={{ width: `${value * 10}%` }} />
                            </span>
                          </div>
                        ) : (
                          <span className="text-action">не оценено</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-line-strong">
                <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-semibold text-text">
                  Сумма <span className="block text-meta font-normal text-muted">справочный ориентир</span>
                </th>
                {ranked
                  .slice()
                  .sort(
                    (a, b) =>
                      alternatives.findIndex((item) => item.id === a.alternative.id) -
                      alternatives.findIndex((item) => item.id === b.alternative.id)
                  )
                  .map(({ alternative, total }) => (
                    <td
                      key={alternative.id}
                      className={cn(
                        "px-4 py-3 text-lead font-semibold tabular-nums text-text",
                        alternative.isStatusQuo && !alternative.selected && "bg-canvas",
                        alternative.selected && "bg-accent-soft"
                      )}
                    >
                      {total} <span className="text-table font-normal text-muted">/ 80</span>
                    </td>
                  ))}
              </tr>
            </tbody>
          </table>
        </div>

        {alternatives.length === 0 && (
          <p className="px-5 py-8 text-center text-base text-muted">Варианты ещё не добавлены.</p>
        )}

        {alternatives.length > 0 && (
          <details className="border-t border-line">
            <summary className="cursor-pointer px-5 py-3 text-base font-semibold text-accent">
              Контекст вариантов и дополнительный профиль
            </summary>
            <div className="grid gap-6 border-t border-line px-5 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
              <div className="space-y-4">
                {alternatives.map((alternative) => (
                  <article key={alternative.id} className="border-l-2 border-line-strong pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-text">{alternative.name}</h4>
                      {alternative.isStatusQuo && <Badge variant="neutral">статус-кво</Badge>}
                      {alternative.selected && <Badge variant="resolvedSoft">выбрано человеком</Badge>}
                    </div>
                    <p className="mt-1 text-base text-muted">{alternative.description}</p>
                  </article>
                ))}
              </div>
              <div className="h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData} outerRadius="68%">
                    <PolarGrid stroke={T.rule} />
                    <PolarAngleAxis dataKey="criterion" tick={axisTick} />
                    <PolarRadiusAxis domain={[0, 10]} tick={axisTick} />
                    {alternatives.map((alternative, index) => (
                      <Radar
                        key={alternative.id}
                        name={alternative.name}
                        dataKey={alternative.name}
                        stroke={SERIES[index % SERIES.length]}
                        fill={SERIES[index % SERIES.length]}
                        fillOpacity={0.08}
                        strokeDasharray={
                          alternative.isStatusQuo ? "4 3" : SERIES_DASH[index % SERIES_DASH.length]
                        }
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </details>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(440px,1.2fr)]">
        <section className="border-y border-line py-5" aria-labelledby="analytical-orientation-title">
          <p className="eyebrow">Analytical input</p>
          <h3 id="analytical-orientation-title" className="mt-1 text-section font-semibold text-text">
            Аналитический ориентир
          </h3>
          {analyticalLeader ? (
            <div className="mt-4">
              <p className="text-meta text-muted">Наибольшая невзвешенная сумма</p>
              <p className="mt-1 text-lead font-semibold text-text">{analyticalLeader.alternative.name}</p>
              <p className="text-section font-semibold tabular-nums text-accent">{analyticalLeader.total} / 80</p>
            </div>
          ) : (
            <p className="mt-4 text-base text-muted">Недостаточно вариантов для аналитического ориентира.</p>
          )}
          <p className="mt-4 text-base text-muted">
            Это арифметическая сводка, не рекомендация модели и не автоматический выбор. Веса критериев
            не откалиброваны.
          </p>
          <Link
            href={`/decisions/${decisionId}?tab=ai`}
            className="mt-4 inline-flex items-center gap-2 text-base font-semibold text-accent hover:underline"
          >
            Открыть отдельную рекомендацию модели
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <section className="rounded-panel bg-obsidian px-5 py-5 text-surface shadow-panel" aria-labelledby="human-decision-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-obsidian-line pb-4">
            <div>
              <p className="eyebrow !text-surface-raised">Final authority</p>
              <h3 id="human-decision-title" className="mt-1 flex items-center gap-2 text-section font-semibold text-surface">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
                Решение человека
              </h3>
            </div>
            <span className="rounded border border-obsidian-line px-2 py-1 text-meta text-surface-raised">
              {stageIsDecision ? "стадия «Решение»" : "ожидает стадии «Решение»"}
            </span>
          </div>

          {selectedAlternative && (
            <div className="border-b border-obsidian-line py-4">
              <p className="text-meta text-surface-raised">Зафиксированный выбор</p>
              <p className="mt-1 text-lead font-semibold text-surface">{selectedAlternative.name}</p>
              {decidedMotivation && <p className="mt-2 text-base text-surface-raised">{decidedMotivation}</p>}
            </div>
          )}

          <div className="pt-4">
            {!canDecide ? (
              <p className="text-base text-surface-raised">
                Финальный выбор относится к полномочиям члена Совета директоров. Система и модель не
                могут утвердить вариант самостоятельно.
              </p>
            ) : !stageIsDecision ? (
              <p className="text-base text-surface-raised">
                Вердикт станет доступен на стадии «Решение» после прохождения контрольных ворот.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="alt-choice" className="text-surface-raised">Выбранная альтернатива</Label>
                  <Select id="alt-choice" value={chosen} onChange={(event) => setChosen(event.target.value)}>
                    <option value="">— выберите вариант —</option>
                    {alternatives.map((alternative) => (
                      <option key={alternative.id} value={alternative.id}>
                        {alternative.name}{alternative.isStatusQuo ? " (статус-кво)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="motivation" className="text-surface-raised">Мотивировка решения — обязательно</Label>
                  <Textarea
                    id="motivation"
                    value={motivation}
                    onChange={(event) => setMotivation(event.target.value)}
                    placeholder="Какие критерии оказались решающими и какой риск принимает организация"
                  />
                </div>
                {error && <p className="text-table text-action-soft">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => decide("APPROVED")} disabled={busy || !chosen || motivation.trim().length < 10}>
                    Утвердить выбранный вариант
                  </Button>
                  <Button
                    variant="outline"
                    className="border-obsidian-line text-surface hover:border-surface hover:text-surface"
                    onClick={() => decide("REJECTED")}
                    disabled={busy || motivation.trim().length < 10}
                  >
                    Отклонить вопрос
                  </Button>
                </div>
                <p className="text-meta text-surface-raised">
                  Вердикт фиксируется от имени уполномоченного лица и сохраняется в аудите.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {canEdit && showForm && (
        <section className="surface-band px-5 py-5" aria-labelledby="add-alternative-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="eyebrow">Evidence input</p>
              <h3 id="add-alternative-title" className="mt-1 text-section font-semibold text-text">Новый вариант</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Свернуть</Button>
          </div>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              const scores: Record<string, number> = {};
              for (const key of CRITERIA_KEYS) scores[key] = Number(values[key]);
              const res = await addAlternative(decisionId, {
                name: values.name,
                description: values.description,
                isStatusQuo: values.isStatusQuo === "true",
                criteriaScores: scores,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              reset();
              setShowForm(false);
              router.refresh();
            })}
            className="mt-5 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <Label htmlFor="alt-name">Название варианта</Label>
                <Input id="alt-name" {...register("name")} placeholder="Например: поэтапное расширение собственными силами" />
                {errors.name && <p className="mt-1 text-table text-action">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="alt-sq">Тип варианта</Label>
                <Select id="alt-sq" {...register("isStatusQuo")}>
                  <option value="false">Содержательная альтернатива</option>
                  <option value="true">Статус-кво — бездействие</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="alt-desc">Описание</Label>
              <Textarea id="alt-desc" {...register("description")} placeholder="Суть варианта, объём, сроки и условия реализации" />
              {errors.description && <p className="mt-1 text-table text-action">{errors.description.message}</p>}
            </div>
            <fieldset>
              <legend className="mb-2 text-table font-semibold text-muted">Оценки по единому набору критериев — 0–10</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CRITERIA_KEYS.map((key) => (
                  <div key={key}>
                    <Label htmlFor={`crit-${key}`}>{ru.criteria[key]}</Label>
                    <Input id={`crit-${key}`} type="number" min={0} max={10} step={1} {...register(key)} />
                  </div>
                ))}
              </div>
            </fieldset>
            {error && <p className="text-table text-action">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Добавление…" : "Добавить вариант в сравнение"}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
