"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowDown, ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Provenance } from "@/components/provenance";
import { addRisk } from "@/app/actions/evidence";
import { cn, formatMoney } from "@/lib/utils";

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

function bandIndex(bands: Array<{ min: number; max: number }>, value: number): number {
  const index = bands.findIndex((band) => value >= band.min && value < band.max);
  return index === -1 ? bands.length - 1 : index;
}

function cellTone(probabilityIndex: number, impactIndex: number): string {
  const score = probabilityIndex + impactIndex;
  if (score >= 6) return "border-action bg-action-soft";
  if (score >= 4) return "border-line-strong bg-canvas";
  return "border-line bg-surface";
}

function exposureBefore(risk: RiskView): number {
  return risk.probability * risk.impact;
}

function exposureAfter(risk: RiskView): number | null {
  if (risk.residualProbability === null || risk.residualImpact === null) return null;
  return risk.residualProbability * risk.residualImpact;
}

function RiskMatrix({ risks, mode }: { risks: RiskView[]; mode: "before" | "after" }) {
  const items = risks
    .map((risk) => {
      const probability = mode === "before" ? risk.probability : risk.residualProbability;
      const impact = mode === "before" ? risk.impact : risk.residualImpact;
      if (probability === null || impact === null) return null;
      return {
        risk,
        probabilityIndex: bandIndex(PROB_BANDS, probability),
        impactIndex: bandIndex(IMPACT_BANDS, impact),
      };
    })
    .filter(
      (item): item is { risk: RiskView; probabilityIndex: number; impactIndex: number } => item !== null
    );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[560px] w-full border-collapse text-meta">
        <thead>
          <tr>
            <th className="w-24 border border-line bg-canvas px-2 py-1.5 text-left font-semibold text-text">
              Вероятность / ущерб
            </th>
            {IMPACT_BANDS.map((band) => (
              <th key={band.label} className="border border-line bg-canvas px-2 py-1.5 font-semibold text-text">
                {band.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...PROB_BANDS].reverse().map((probabilityBand) => {
            const probabilityIndex = PROB_BANDS.indexOf(probabilityBand);
            return (
              <tr key={probabilityBand.label}>
                <th className="border border-line bg-canvas px-2 py-1.5 text-left font-semibold text-text">
                  {probabilityBand.label}
                </th>
                {IMPACT_BANDS.map((_, impactIndex) => {
                  const inCell = items.filter(
                    (item) =>
                      item.probabilityIndex === probabilityIndex && item.impactIndex === impactIndex
                  );
                  return (
                    <td
                      key={impactIndex}
                      className={cn(
                        "h-14 border p-1 align-top",
                        inCell.length > 0
                          ? cellTone(probabilityIndex, impactIndex)
                          : "border-line bg-surface"
                      )}
                    >
                      {inCell.map((item) => (
                        <span
                          key={item.risk.id}
                          className="block truncate rounded bg-surface px-1 py-0.5 text-text"
                          title={item.risk.name}
                        >
                          {item.risk.name}
                        </span>
                      ))}
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
      name: "",
      probability: 0.2,
      impact: 1_000_000_000,
      mitigation: "",
      residualProbability: 0.1,
      residualImpact: 500_000_000,
      triggers: "",
    },
  });

  const totalBefore = risks.reduce((sum, risk) => sum + exposureBefore(risk), 0);
  const totalAfter = risks.reduce(
    (sum, risk) => sum + (exposureAfter(risk) ?? exposureBefore(risk)),
    0
  );
  const incompleteResidual = risks.filter((risk) => exposureAfter(risk) === null).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
        <div>
          <p className="eyebrow">Risk decision view</p>
          <h2 className="mt-1 text-section font-semibold text-text">Переход риска после мер контроля</h2>
          <p className="mt-1 max-w-3xl text-base text-muted">
            Каждый риск читается как управленческая цепочка: исходная экспозиция, контрольное
            воздействие и остаточный риск, который принимает организация.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <p className="text-meta text-muted">Рисков в профиле</p>
            <p className="text-section font-semibold text-text">{risks.length}</p>
          </div>
          <div>
            <p className="text-meta text-muted">Остаточный риск</p>
            <p className={cn("text-base font-semibold", incompleteResidual ? "text-action" : "text-success")}>
              {incompleteResidual ? `не оценён: ${incompleteResidual}` : "оценён полностью"}
            </p>
          </div>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setShowForm((value) => !value)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {showForm ? "Скрыть форму" : "Добавить риск"}
            </Button>
          )}
        </div>
      </header>

      <section className="surface-band px-5 py-5" aria-labelledby="risk-exposure-summary">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="eyebrow">Portfolio exposure</p>
            <h3 id="risk-exposure-summary" className="mt-1 text-section font-semibold text-text">
              Ожидаемый ущерб по профилю решения
            </h3>
          </div>
          <Badge variant="technical">демо-данные</Badge>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-meta text-muted">До мер · Σ P₀ × L₀</p>
            <div className="mt-1 text-section font-semibold text-text">
              <Provenance
                value={formatMoney(totalBefore)}
                nature="forecast"
                source="Расчёт по риск-профилю решения"
                formula="Σ (вероятность × потенциальные потери)"
                note="Экспертная оценка, синтетические демо-значения"
              />
            </div>
          </div>
          <ArrowRight className="hidden h-5 w-5 text-muted md:block" aria-hidden="true" />
          <div className="border-l-2 border-accent pl-4">
            <p className="text-meta text-muted">После мер · Σ P₁ × L₁</p>
            <div className="mt-1 text-section font-semibold text-text">
              <Provenance
                value={formatMoney(totalAfter)}
                nature="forecast"
                source="Расчёт по риск-профилю решения"
                formula="Σ (остаточная вероятность × остаточные потери)"
                note="Для рисков без остаточной оценки сохранена исходная экспозиция"
              />
            </div>
            <p className="mt-1 text-table font-semibold text-accent">
              Снижение экспозиции: {risks.length > 0 ? formatMoney(totalBefore - totalAfter) : "—"}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="risk-transitions-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="risk-transitions-title" className="text-section font-semibold text-text">Риски и принятые меры</h3>
          <p className="hidden text-table text-muted sm:block">INITIAL → CONTROL → RESIDUAL</p>
        </div>

        {risks.length === 0 ? (
          <div className="border-y border-line py-10 text-center">
            <p className="text-base text-muted">Риск-профиль не заполнен.</p>
          </div>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {risks.map((risk, index) => {
              const initial = exposureBefore(risk);
              const residual = exposureAfter(risk);
              const scaleMax = Math.max(initial, residual ?? 0, 1);
              const reduction = residual === null || initial === 0 ? null : ((initial - residual) / initial) * 100;
              return (
                <article key={risk.id} className="bg-surface px-4 py-5 sm:px-5">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="mt-0.5 font-technical text-meta font-semibold text-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h4 className="text-lead font-semibold text-text">{risk.name}</h4>
                        <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-table">
                          <div className="flex gap-1.5">
                            <dt className="text-muted">Владелец</dt>
                            <dd className={risk.ownerName ? "font-semibold text-text" : "font-semibold text-action"}>
                              {risk.ownerName ?? "не назначен"}
                            </dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt className="text-muted">Триггер пересмотра</dt>
                            <dd className={risk.triggers ? "text-text" : "text-action"}>{risk.triggers ?? "не задан"}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                    {residual === null ? (
                      <Badge variant="action">требуется остаточная оценка</Badge>
                    ) : (
                      <Badge variant="resolvedSoft">остаточный риск зафиксирован</Badge>
                    )}
                  </header>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(220px,1.15fr)_32px_minmax(0,1fr)] lg:items-stretch">
                    <div className="rounded-control border border-line bg-canvas p-4">
                      <p className="eyebrow">Initial risk</p>
                      <p className="mt-2 text-section font-semibold tabular-nums text-text">{formatMoney(initial)}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-table">
                        <div>
                          <dt className="text-muted">Вероятность P₀</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-text">{(risk.probability * 100).toFixed(0)}%</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Потери L₀</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-text">{formatMoney(risk.impact)}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 h-2 overflow-hidden rounded bg-surface-raised" aria-hidden="true">
                        <div className="h-full bg-action" style={{ width: `${(initial / scaleMax) * 100}%` }} />
                      </div>
                    </div>

                    <div className="hidden items-center justify-center lg:flex">
                      <ArrowRight className="h-5 w-5 text-muted" aria-hidden="true" />
                    </div>
                    <ArrowDown className="mx-auto h-5 w-5 text-muted lg:hidden" aria-hidden="true" />

                    <div className="rounded-control border border-accent bg-accent-soft p-4">
                      <p className="eyebrow !text-accent">Control</p>
                      <div className="mt-2 flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        <p className="text-base text-text">{risk.mitigation}</p>
                      </div>
                      <p className="mt-4 text-meta text-muted">
                        Мера снижает экспозицию, но не отменяет необходимость принять остаточный риск.
                      </p>
                    </div>

                    <div className="hidden items-center justify-center lg:flex">
                      <ArrowRight className="h-5 w-5 text-muted" aria-hidden="true" />
                    </div>
                    <ArrowDown className="mx-auto h-5 w-5 text-muted lg:hidden" aria-hidden="true" />

                    <div className={cn("rounded-control border p-4", residual === null ? "border-action bg-action-soft" : "border-line bg-surface")}>
                      <p className={cn("eyebrow", residual === null && "!text-action")}>Residual risk</p>
                      {residual === null ? (
                        <div className="mt-3 flex items-start gap-2 text-action">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <p className="text-base font-semibold">Остаточная экспозиция не подтверждена</p>
                        </div>
                      ) : (
                        <>
                          <p className="mt-2 text-section font-semibold tabular-nums text-text">{formatMoney(residual)}</p>
                          <dl className="mt-3 grid grid-cols-2 gap-3 text-table">
                            <div>
                              <dt className="text-muted">Вероятность P₁</dt>
                              <dd className="mt-0.5 font-semibold tabular-nums text-text">
                                {((risk.residualProbability ?? 0) * 100).toFixed(0)}%
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted">Потери L₁</dt>
                              <dd className="mt-0.5 font-semibold tabular-nums text-text">
                                {formatMoney(risk.residualImpact ?? 0)}
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-4 h-2 overflow-hidden rounded bg-surface-raised" aria-hidden="true">
                            <div className="h-full bg-accent" style={{ width: `${(residual / scaleMax) * 100}%` }} />
                          </div>
                          {reduction !== null && (
                            <p className={cn("mt-2 text-table font-semibold", reduction >= 0 ? "text-success" : "text-action")}>
                              {reduction >= 0 ? "Снижение" : "Рост"}: {Math.abs(reduction).toFixed(0)}%
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {risks.length > 0 && (
        <details className="surface-band overflow-hidden">
          <summary className="cursor-pointer px-5 py-4 text-base font-semibold text-accent">
            Открыть портфельные матрицы вероятности и ущерба
          </summary>
          <div className="grid gap-6 border-t border-line px-5 py-5 xl:grid-cols-2">
            <section>
              <h4 className="mb-3 text-base font-semibold text-text">До мер воздействия</h4>
              <RiskMatrix risks={risks} mode="before" />
            </section>
            <section>
              <h4 className="mb-3 text-base font-semibold text-text">После мер воздействия</h4>
              <RiskMatrix risks={risks} mode="after" />
            </section>
          </div>
        </details>
      )}

      {canEdit && showForm && (
        <section className="surface-band px-5 py-5" aria-labelledby="add-risk-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="eyebrow">Risk evidence input</p>
              <h3 id="add-risk-title" className="mt-1 text-section font-semibold text-text">Новый риск</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Свернуть</Button>
          </div>
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
              setShowForm(false);
              router.refresh();
            })}
            className="mt-5 space-y-4"
          >
            <div>
              <Label htmlFor="risk-name">Наименование риска</Label>
              <Input id="risk-name" {...register("name")} />
              {errors.name && <p className="mt-1 text-table text-action">{errors.name.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label htmlFor="risk-p0">Вероятность P₀ · 0–1</Label>
                <Input id="risk-p0" type="number" step="0.01" min={0} max={1} {...register("probability")} />
              </div>
              <div>
                <Label htmlFor="risk-l0">Потери L₀ · ₸</Label>
                <Input id="risk-l0" type="number" step="1000000" min={0} {...register("impact")} />
              </div>
              <div>
                <Label htmlFor="risk-p1">Остаточная P₁ · 0–1</Label>
                <Input id="risk-p1" type="number" step="0.01" min={0} max={1} {...register("residualProbability")} />
              </div>
              <div>
                <Label htmlFor="risk-l1">Остаточные L₁ · ₸</Label>
                <Input id="risk-l1" type="number" step="1000000" min={0} {...register("residualImpact")} />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor="risk-mit">Меры воздействия</Label>
                <Textarea id="risk-mit" {...register("mitigation")} />
                {errors.mitigation && <p className="mt-1 text-table text-action">{errors.mitigation.message}</p>}
              </div>
              <div>
                <Label htmlFor="risk-trg">Триггеры пересмотра</Label>
                <Textarea id="risk-trg" {...register("triggers")} placeholder="При каких событиях риск пересматривается" />
                {errors.triggers && <p className="mt-1 text-table text-action">{errors.triggers.message}</p>}
              </div>
            </div>
            {error && <p className="text-table text-action">{error}</p>}
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Добавление…" : "Добавить риск в профиль"}
              </Button>
              <p className="text-meta text-muted">Владельцем фиксируется текущий пользователь — риск-офицер.</p>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
