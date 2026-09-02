"use client";

// Риск-профиль: матрица «вероятность × воздействие» до и после мер,
// остаточный риск, владелец риска, триггеры пересмотра.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Provenance } from "@/components/provenance";
import { addRisk } from "@/app/actions/evidence";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface RiskView {
  id: string;
  name: string;
  probability: number;
  impact: number;
  mitigation: string;
  residualProbability: number | null;
  residualImpact: number | null;
  ownerName: string | null;
  triggers: string | null;
}

const PROB_BANDS = [
  { label: "0–20%", min: 0, max: 0.2 },
  { label: "20–40%", min: 0.2, max: 0.4 },
  { label: "40–60%", min: 0.4, max: 0.6 },
  { label: "60–80%", min: 0.6, max: 0.8 },
  { label: "80–100%", min: 0.8, max: 1.01 },
];

const IMPACT_BANDS = [
  { label: "< 1 млрд ₸", min: 0, max: 1e9 },
  { label: "1–3 млрд ₸", min: 1e9, max: 3e9 },
  { label: "3–6 млрд ₸", min: 3e9, max: 6e9 },
  { label: "6–12 млрд ₸", min: 6e9, max: 12e9 },
  { label: "> 12 млрд ₸", min: 12e9, max: Infinity },
];

function bandIndex(bands: Array<{ min: number; max: number }>, v: number): number {
  const i = bands.findIndex((b) => v >= b.min && v < b.max);
  return i === -1 ? bands.length - 1 : i;
}

/** Цвет ячейки матрицы: чем выше произведение индексов, тем «горячее». */
function cellTone(pi: number, ii: number): string {
  const score = pi + ii;
  if (score >= 6) return "bg-red-50 border-red-200";
  if (score >= 4) return "bg-amber-50 border-amber-200";
  return "bg-emerald-50 border-emerald-200";
}

const riskSchema = z.object({
  name: z.string().min(3, "Название — не менее 3 символов"),
  probability: z.coerce.number().min(0).max(1),
  impact: z.coerce.number().min(0),
  mitigation: z.string().min(5, "Опишите меры воздействия"),
  residualProbability: z.coerce.number().min(0).max(1),
  residualImpact: z.coerce.number().min(0),
  triggers: z.string().min(3, "Укажите триггеры пересмотра"),
});
type RiskValues = z.infer<typeof riskSchema>;

function RiskMatrix({ risks, mode }: { risks: RiskView[]; mode: "before" | "after" }) {
  const items = risks
    .map((r) => {
      const p = mode === "before" ? r.probability : r.residualProbability;
      const l = mode === "before" ? r.impact : r.residualImpact;
      if (p === null || l === null) return null;
      return { risk: r, pi: bandIndex(PROB_BANDS, p), ii: bandIndex(IMPACT_BANDS, l) };
    })
    .filter((x): x is { risk: RiskView; pi: number; ii: number } => x !== null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="w-24 border border-slate-200 bg-brand-card px-1.5 py-1 text-left font-semibold text-brand">
              Вероятность \ Ущерб
            </th>
            {IMPACT_BANDS.map((b) => (
              <th key={b.label} className="border border-slate-200 bg-brand-card px-1.5 py-1 font-semibold text-brand">
                {b.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...PROB_BANDS].reverse().map((pb) => {
            const pi = PROB_BANDS.indexOf(pb);
            return (
              <tr key={pb.label}>
                <th className="border border-slate-200 bg-brand-card px-1.5 py-1 text-left font-semibold text-brand">
                  {pb.label}
                </th>
                {IMPACT_BANDS.map((_, ii) => {
                  const inCell = items.filter((x) => x.pi === pi && x.ii === ii);
                  return (
                    <td
                      key={ii}
                      className={cn(
                        "h-14 border align-top",
                        inCell.length > 0 ? cellTone(pi, ii) : "border-slate-200 bg-white"
                      )}
                    >
                      <ul className="space-y-0.5 p-1">
                        {inCell.map((x) => (
                          <li key={x.risk.id} className="truncate text-slate-800" title={x.risk.name}>
                            • {x.risk.name}
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RisksPanel({
  decisionId,
  risks,
  canEdit,
}: {
  decisionId: string;
  risks: RiskView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RiskValues>({
    resolver: zodResolver(riskSchema),
    defaultValues: {
      name: "", probability: 0.2, impact: 1_000_000_000, mitigation: "",
      residualProbability: 0.1, residualImpact: 500_000_000, triggers: "",
    },
  });

  const totalBefore = risks.reduce((s, r) => s + r.probability * r.impact, 0);
  const totalAfter = risks.reduce(
    (s, r) => s + (r.residualProbability ?? r.probability) * (r.residualImpact ?? r.impact),
    0
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Матрица рисков до мер воздействия</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskMatrix risks={risks} mode="before" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Матрица остаточных рисков (после мер)</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskMatrix risks={risks} mode="after" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ожидаемый ущерб по портфелю рисков решения</CardTitle>
          <Badge variant="warn">{"демо-данные"}</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="text-xs text-slate-500">До мер воздействия (Σ P₀ × L₀)</div>
              <div className="mt-0.5">
                <Provenance
                  value={formatMoney(totalBefore)}
                  nature="forecast"
                  source="Расчёт по риск-профилю решения"
                  formula="Σ (вероятность × потенциальные потери)"
                  note="Оценка экспертная, синтетические демо-значения"
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">После мер (Σ P₁ × L₁)</div>
              <div className="mt-0.5">
                <Provenance
                  value={formatMoney(totalAfter)}
                  nature="forecast"
                  source="Расчёт по риск-профилю решения"
                  formula="Σ (остаточная вероятность × остаточные потери)"
                  note="Оценка экспертная, синтетические демо-значения"
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Снижение ожидаемого ущерба</div>
              <div className="mt-0.5 text-sm font-semibold text-brand">
                {risks.length > 0 ? formatMoney(totalBefore - totalAfter) : "—"}
              </div>
              <p className="text-[11px] text-slate-500">
                Валовая величина. Эффект Eᵣ с коэффициентом атрибуции — на вкладке «Экономика».
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Реестр рисков решения</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Риск</TH>
                <TH>P₀ / L₀</TH>
                <TH>Меры воздействия</TH>
                <TH>P₁ / L₁ (остаточный)</TH>
                <TH>Владелец</TH>
                <TH>Триггеры пересмотра</TH>
              </TR>
            </THead>
            <TBody>
              {risks.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-4 text-center text-sm text-slate-500">
                    Риск-профиль не заполнен.
                  </TD>
                </TR>
              )}
              {risks.map((r) => (
                <TR key={r.id}>
                  <TD className="max-w-64 text-sm font-medium text-slate-900">{r.name}</TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums">
                    {(r.probability * 100).toFixed(0)}% / {formatMoney(r.impact)}
                  </TD>
                  <TD className="max-w-72 text-xs text-slate-600">{r.mitigation}</TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums">
                    {r.residualProbability !== null && r.residualImpact !== null ? (
                      <>
                        {(r.residualProbability * 100).toFixed(0)}% / {formatMoney(r.residualImpact)}
                      </>
                    ) : (
                      <span className="text-brand-warn">не оценён</span>
                    )}
                  </TD>
                  <TD className="text-xs">
                    {r.ownerName ?? <span className="text-brand-warn">не назначен</span>}
                  </TD>
                  <TD className="max-w-56 text-xs text-slate-600">{r.triggers ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Добавить риск</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Свернуть" : "Развернуть форму"}
            </Button>
          </CardHeader>
          {showForm && (
            <CardContent>
              <form
                onSubmit={handleSubmit(async (values) => {
                  setError(null);
                  const res = await addRisk(decisionId, {
                    name: values.name,
                    probability: Number(values.probability),
                    impact: Number(values.impact),
                    mitigation: values.mitigation,
                    residualProbability: Number(values.residualProbability),
                    residualImpact: Number(values.residualImpact),
                    triggers: values.triggers,
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
                <div>
                  <Label htmlFor="risk-name">Наименование риска</Label>
                  <Input id="risk-name" {...register("name")} />
                  {errors.name && <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <Label htmlFor="risk-p0">Вероятность P₀ (0–1)</Label>
                    <Input id="risk-p0" type="number" step="0.01" min={0} max={1} {...register("probability")} />
                  </div>
                  <div>
                    <Label htmlFor="risk-l0">Потери L₀, ₸</Label>
                    <Input id="risk-l0" type="number" step="1000000" min={0} {...register("impact")} />
                  </div>
                  <div>
                    <Label htmlFor="risk-p1">Остаточная P₁ (0–1)</Label>
                    <Input id="risk-p1" type="number" step="0.01" min={0} max={1} {...register("residualProbability")} />
                  </div>
                  <div>
                    <Label htmlFor="risk-l1">Остаточные L₁, ₸</Label>
                    <Input id="risk-l1" type="number" step="1000000" min={0} {...register("residualImpact")} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="risk-mit">Меры воздействия</Label>
                  <Textarea id="risk-mit" {...register("mitigation")} />
                  {errors.mitigation && (
                    <p className="mt-1 text-xs text-red-700">{errors.mitigation.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="risk-trg">Триггеры пересмотра</Label>
                  <Textarea id="risk-trg" {...register("triggers")} placeholder="При каких событиях риск пересматривается" />
                  {errors.triggers && (
                    <p className="mt-1 text-xs text-red-700">{errors.triggers.message}</p>
                  )}
                </div>
                {error && <p className="text-xs text-red-700">{error}</p>}
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Добавление…" : "Добавить риск"}
                </Button>
                <p className="text-[11px] text-slate-500">
                  Владельцем риска фиксируется текущий пользователь (роль «Риск-офицер»).
                </p>
              </form>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
