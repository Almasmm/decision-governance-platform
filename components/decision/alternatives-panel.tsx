"use client";

// Сравнение альтернатив: матрица «альтернативы × критерии» с обязательным
// столбцом «Статус-кво», лепестковая диаграмма, выбор варианта с мотивировкой.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addAlternative } from "@/app/actions/evidence";
import { decideDecision } from "@/app/actions/decisions";
import { CRITERIA_KEYS } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export interface AlternativeView {
  id: string;
  name: string;
  description: string;
  isStatusQuo: boolean;
  selected: boolean;
  scores: Record<string, number>;
}

const CHART_COLORS = ["#12305B", "#2E6DB4", "#7BA7D7", "#C77700", "#5B7A9B"];

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

  const chartData = CRITERIA_KEYS.map((k) => {
    const row: Record<string, string | number> = { criterion: ru.criteria[k] };
    alternatives.forEach((a) => {
      row[a.name] = a.scores[k] ?? 0;
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
      safety: 5, regulatory: 5, economics: 5, timeline: 5,
      resources: 5, hr: 5, cyber: 5, sustainability: 5,
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
    <div className="space-y-4">
      {!hasStatusQuo && (
        <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-brand-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Отсутствует обязательный вариант «статус-кво». Сравнение альтернатив без базового
            варианта не считается полным: невозможно оценить, что произойдёт при отказе от действий.
          </span>
        </div>
      )}
      {substantive.length < 2 && (
        <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-brand-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Содержательных альтернатив: {substantive.length}. Для уровней A и B требуется не менее
            двух содержательно различающихся вариантов помимо статус-кво.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Матрица «альтернативы × критерии»</CardTitle>
          <span className="text-[11px] text-slate-500">Шкала 0–10, единый набор из 8 критериев</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-brand-card">
                <tr>
                  <th className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-brand">
                    Критерий
                  </th>
                  {alternatives.map((a) => (
                    <th
                      key={a.id}
                      className={cn(
                        "px-2.5 py-2 text-left text-[11px] font-semibold text-brand",
                        a.isStatusQuo && "bg-slate-200/60"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {a.name}
                        {a.isStatusQuo && <Badge variant="neutral">статус-кво</Badge>}
                        {a.selected && <Badge variant="success">выбрано</Badge>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CRITERIA_KEYS.map((k) => (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="px-2.5 py-1.5 text-xs text-slate-700">{ru.criteria[k]}</td>
                    {alternatives.map((a) => {
                      const v = a.scores[k];
                      return (
                        <td
                          key={a.id}
                          className={cn(
                            "px-2.5 py-1.5 tabular-nums",
                            a.isStatusQuo && "bg-slate-50",
                            typeof v !== "number" && "text-brand-warn"
                          )}
                        >
                          {typeof v === "number" ? v : "не оценено"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-2.5 py-2 text-xs text-brand">Сумма (справочно)</td>
                  {alternatives.map((a) => (
                    <td key={a.id} className="px-2.5 py-2 tabular-nums text-brand">
                      {CRITERIA_KEYS.reduce((s, k) => s + (a.scores[k] ?? 0), 0)} / 80
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {alternatives.length > 0 && (
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
              Суммарная оценка — справочный ориентир, а не основание решения: веса критериев не
              откалиброваны, выбор делает уполномоченное лицо.
            </p>
          )}
        </CardContent>
      </Card>

      {alternatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Профиль альтернатив по критериям</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius="70%">
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11, fill: "#475569" }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                  {alternatives.map((a, i) => (
                    <Radar
                      key={a.id}
                      name={a.name}
                      dataKey={a.name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.12}
                      strokeDasharray={a.isStatusQuo ? "4 3" : undefined}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Описание вариантов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alternatives.length === 0 && (
              <p className="text-sm text-slate-500">Альтернативы не добавлены.</p>
            )}
            {alternatives.map((a) => (
              <div key={a.id} className="rounded border border-slate-200 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-900">{a.name}</span>
                  {a.isStatusQuo && <Badge variant="neutral">статус-кво</Badge>}
                  {a.selected && (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3" /> выбрано
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">{a.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Выбор варианта и мотивировка</CardTitle>
            {stageIsDecision ? (
              <Badge>стадия «Решение»</Badge>
            ) : (
              <Badge variant="neutral">доступно на стадии «Решение»</Badge>
            )}
          </CardHeader>
          <CardContent>
            {!canDecide ? (
              <p className="text-sm text-slate-500">
                Принятие решения — компетенция члена Совета директоров (роль BOARD_MEMBER).
                Система не выбирает вариант самостоятельно.
              </p>
            ) : !stageIsDecision ? (
              <p className="text-sm text-slate-500">
                Решение принимается на стадии «Решение». Сейчас паспорт на другой стадии цикла.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="alt-choice">Выбранная альтернатива</Label>
                  <Select id="alt-choice" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                    <option value="">— выберите вариант —</option>
                    {alternatives.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.isStatusQuo ? " (статус-кво)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="motivation">Мотивировка решения (обязательно)</Label>
                  <Textarea
                    id="motivation"
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    placeholder="Почему выбран именно этот вариант: какие критерии оказались решающими, какие риски приняты"
                  />
                </div>
                {error && <p className="text-xs text-red-700">{error}</p>}
                <div className="flex gap-2">
                  <Button onClick={() => decide("APPROVED")} disabled={busy || !chosen || motivation.trim().length < 10}>
                    Утвердить выбранный вариант
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decide("REJECTED")}
                    disabled={busy || motivation.trim().length < 10}
                  >
                    Отклонить вопрос
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Решение фиксируется от имени уполномоченного лица и попадает в аудит. Без
                  мотивировки утверждение невозможно.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Добавить альтернативу</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Свернуть" : "Развернуть форму"}
            </Button>
          </CardHeader>
          {showForm && (
            <CardContent>
              <form
                onSubmit={handleSubmit(async (values) => {
                  setError(null);
                  const scores: Record<string, number> = {};
                  for (const k of CRITERIA_KEYS) scores[k] = Number(values[k]);
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
                  router.refresh();
                })}
                className="space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                  <div>
                    <Label htmlFor="alt-name">Название варианта</Label>
                    <Input id="alt-name" {...register("name")} placeholder="Например: поэтапное расширение собственными силами" />
                    {errors.name && <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="alt-sq">Тип варианта</Label>
                    <Select id="alt-sq" {...register("isStatusQuo")}>
                      <option value="false">Содержательная альтернатива</option>
                      <option value="true">Статус-кво (бездействие)</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="alt-desc">Описание</Label>
                  <Textarea id="alt-desc" {...register("description")} placeholder="Суть варианта, объём, сроки, условия реализации" />
                  {errors.description && (
                    <p className="mt-1 text-xs text-red-700">{errors.description.message}</p>
                  )}
                </div>
                <div>
                  <Label>Оценки по единому набору критериев (0–10)</Label>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {CRITERIA_KEYS.map((k) => (
                      <div key={k}>
                        <label htmlFor={`crit-${k}`} className="mb-0.5 block text-[11px] text-slate-500">
                          {ru.criteria[k]}
                        </label>
                        <Input id={`crit-${k}`} type="number" min={0} max={10} step={1} {...register(k)} />
                      </div>
                    ))}
                  </div>
                </div>
                {error && <p className="text-xs text-red-700">{error}</p>}
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Добавление…" : "Добавить альтернативу"}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
