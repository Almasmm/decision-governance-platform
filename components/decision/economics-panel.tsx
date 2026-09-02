"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Plus,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Provenance } from "@/components/provenance";
import { addCalculation, reviewCalculation } from "@/app/actions/evidence";
import {
  automationEffect,
  riskEffect,
  npvEffect,
  DEFAULT_ATTRIBUTION_SHARE,
  type EffectResult,
} from "@/lib/effects";
import { ru } from "@/lib/i18n/ru";
import { formatMoney } from "@/lib/utils";
import type { EffectKind } from "@/lib/domain";

export interface CalcView {
  id: string;
  kind: string;
  inputs: Record<string, unknown>;
  result: number;
  calculatedAt: string;
  calculatedByName: string;
  calculatedById: string;
  attributionNote: string | null;
  reviews: Array<{
    id: string;
    reviewerName: string;
    reviewerId: string;
    verdict: string;
    comment: string | null;
  }>;
}

const PARAM_LABELS: Record<string, string> = {
  t0: "T₀ — трудоёмкость подготовки пакета до внедрения, ч",
  t1: "T₁ — трудоёмкость после внедрения, ч",
  n: "N — число пакетов в год",
  c: "C — средняя стоимость часа труда, ₸/ч",
  p0: "P₀ — вероятность события до, 0–1",
  l0: "L₀ — потенциальные потери до, ₸",
  p1: "P₁ — вероятность события после, 0–1",
  l1: "L₁ — потенциальные потери после, ₸",
  attributionShare: "Доля атрибуции цифровому механизму",
  rate: "r — ставка дисконтирования",
  years: "Годы прогнозного периода",
};

const EFFECT_CLASS: Record<string, string> = {
  AUTOMATION: "Прямой эффект",
  RISK: "Косвенный эффект",
  NPV: "Инвестиционная оценка",
};

function paramLabel(key: string): string {
  if (PARAM_LABELS[key]) return PARAM_LABELS[key];
  const match = /^years\[(\d+)\]\.(\w+)$/.exec(key);
  if (match) {
    const index = Number(match[1]) + 1;
    const field = match[2] === "et" ? "Eₜ" : match[2] === "er" ? "Eᵣ" : "TCO";
    return `Год ${index}: ${field}`;
  }
  return key;
}

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function displayInput(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function FormulaBand({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-accent bg-accent-soft px-3 py-2 font-technical text-table text-text">
      {children}
    </p>
  );
}

function ResultBox({
  res,
  label,
  nature,
  formula,
  note,
}: {
  res: EffectResult;
  label: string;
  nature: "forecast" | "fact";
  formula: string;
  note?: string;
}) {
  if (!res.ok) {
    return (
      <div className="border-l-2 border-action bg-action-soft px-4 py-3">
        <div className="flex items-center gap-2 text-base font-semibold text-action">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {ru.common.notEnoughData}
        </div>
        <p className="mt-1 text-table text-text">
          {ru.common.missingParams}: {res.missing.map(paramLabel).join("; ")}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-control border border-accent bg-surface p-4">
      <p className="text-table text-muted">{label}</p>
      <div className="mt-1 text-section font-semibold text-text">
        <Provenance
          value={formatMoney(res.value)}
          nature={nature}
          source="Расчёт по введённым пользователем параметрам"
          formula={formula}
          note={note}
        />
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-line pt-3 text-meta sm:grid-cols-2">
        {Object.entries(res.details).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2">
            <dt className="text-muted">{key}</dt>
            <dd className="font-technical tabular-nums text-text">
              {Math.abs(value) >= 1e6
                ? formatMoney(value)
                : value.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EconomicsPanel({
  decisionId,
  calculations,
  canCalculate,
  canReview,
  currentUserId,
}: {
  decisionId: string;
  calculations: CalcView[];
  canCalculate: boolean;
  canReview: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [t0, setT0] = useState("");
  const [t1, setT1] = useState("");
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const autoRes = useMemo(
    () => automationEffect({ t0: num(t0), t1: num(t1), n: num(n), c: num(c) }),
    [t0, t1, n, c]
  );

  const [p0, setP0] = useState("");
  const [l0, setL0] = useState("");
  const [p1, setP1] = useState("");
  const [l1, setL1] = useState("");
  const [share, setShare] = useState(String(DEFAULT_ATTRIBUTION_SHARE));
  const [shareNote, setShareNote] = useState("");
  const riskRes = useMemo(
    () =>
      riskEffect({
        p0: num(p0),
        l0: num(l0),
        p1: num(p1),
        l1: num(l1),
        attributionShare: num(share) ?? DEFAULT_ATTRIBUTION_SHARE,
      }),
    [p0, l0, p1, l1, share]
  );

  const [rate, setRate] = useState("");
  const [years, setYears] = useState<Array<{ et: string; er: string; tco: string }>>([
    { et: "", er: "", tco: "" },
  ]);
  const npvRes = useMemo(
    () =>
      npvEffect({
        rate: num(rate),
        years: years.map((year) => ({
          et: num(year.et),
          er: num(year.er),
          tco: num(year.tco),
        })),
      }),
    [rate, years]
  );

  const confirmedCount = calculations.filter((calculation) =>
    calculation.reviews.some(
      (review) =>
        review.verdict === "CONFIRMED" && review.reviewerId !== calculation.calculatedById
    )
  ).length;

  async function save(kind: EffectKind, inputs: Record<string, unknown>, note?: string) {
    setBusy(true);
    setError(null);
    const result = await addCalculation(decisionId, kind, inputs, note);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function review(calculationId: string, verdict: "CONFIRMED" | "REJECTED") {
    const comment = window.prompt(
      verdict === "CONFIRMED"
        ? "Комментарий независимой проверки (что именно проверено):"
        : "Причина отклонения расчёта:"
    );
    if (comment === null) return;
    setBusy(true);
    setError(null);
    const result = await reviewCalculation(calculationId, verdict, comment);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5" data-tour="economics-inputs">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-4 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow">Economic evidence</p>
          <h2 className="mt-1 text-decision font-semibold tracking-[-0.02em] text-text">
            Экономика решения
          </h2>
          <p className="mt-2 text-base text-muted">
            Эффект отображается только при полном наборе параметров. Формула, автор, дата и
            независимая проверка сохраняются вместе с результатом.
          </p>
        </div>
        <dl
          className="grid grid-cols-2 divide-x divide-line border-y border-line py-2 text-center"
          data-tour="economics-review"
        >
          <div className="px-5">
            <dt className="text-meta text-muted">Расчётов</dt>
            <dd className="font-technical text-lead font-semibold text-text">{calculations.length}</dd>
          </div>
          <div className="px-5">
            <dt className="text-meta text-muted">Подтверждено</dt>
            <dd className="font-technical text-lead font-semibold text-success">{confirmedCount}</dd>
          </div>
        </dl>
      </header>

      {calculations.length > confirmedCount && (
        <div className="flex items-start gap-3 border-l-2 border-action bg-action-soft px-4 py-3 text-table text-action">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Independent review required:</span>{" "}
            {calculations.length - confirmedCount} расчёт(а) ожидают проверки вторым пользователем.
          </p>
        </div>
      )}

      <section aria-labelledby="calculation-register-heading" data-tour="economics-result">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Evidence register</p>
            <h3 id="calculation-register-heading" className="mt-1 text-section font-semibold text-text">
              Сохранённые расчёты
            </h3>
          </div>
          <p className="hidden text-table text-muted sm:block">Автор → формула → результат → review</p>
        </div>

        <p
          className="mb-3 border-l-2 border-line-strong bg-surface px-4 py-3 text-table text-muted"
          data-tour="economics-attribution"
        >
          Доля атрибуции отделяет обоснованно связанный с решением эффект от влияния внешних
          факторов и сохраняется вместе с исходными параметрами расчёта.
        </p>

        {calculations.length === 0 ? (
          <div className="border-y border-line bg-surface px-5 py-8 text-base text-muted">
            Расчёты эффекта не выполнены. Для уровня A требуется как минимум один расчёт с
            независимой проверкой вторым пользователем.
          </div>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {calculations.map((calculation, index) => {
              const confirmed = calculation.reviews.some(
                (reviewItem) =>
                  reviewItem.verdict === "CONFIRMED" &&
                  reviewItem.reviewerId !== calculation.calculatedById
              );
              const effectKind = calculation.kind as EffectKind;
              const formula =
                calculation.kind === "AUTOMATION"
                  ? "Eₜ = (T₀ − T₁) × N × C"
                  : calculation.kind === "RISK"
                    ? "Eᵣ = [(P₀×L₀) − (P₁×L₁)] × доля атрибуции"
                    : "NPV = Σ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ";

              return (
                <article key={calculation.id} className="bg-surface px-4 py-5 sm:px-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="flex min-w-0 gap-3">
                      <span className="font-technical text-meta font-semibold text-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={calculation.kind === "AUTOMATION" ? "accent" : "forecast"}>
                            {EFFECT_CLASS[calculation.kind] ?? "Расчётный эффект"}
                          </Badge>
                          {confirmed ? (
                            <Badge variant="resolvedSoft">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              независимо подтверждён
                            </Badge>
                          ) : (
                            <Badge variant="action">ожидает независимой проверки</Badge>
                          )}
                        </div>
                        <h4 className="mt-2 text-lead font-semibold text-text">
                          {ru.effectKinds[effectKind]}
                        </h4>
                        <p className="mt-1 text-table text-muted">
                          Автор: <span className="font-semibold text-text">{calculation.calculatedByName}</span>
                          {" · "}
                          {format(new Date(calculation.calculatedAt), "d MMMM yyyy", {
                            locale: ruLocale,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-meta uppercase tracking-[0.08em] text-muted">Результат</p>
                      <div className="mt-1 text-section font-semibold text-text">
                        <Provenance
                          value={formatMoney(calculation.result)}
                          nature="forecast"
                          source={`Расчёт: ${calculation.calculatedByName}`}
                          asOf={format(new Date(calculation.calculatedAt), "d MMMM yyyy", {
                            locale: ruLocale,
                          })}
                          formula={formula}
                          note="Величина рассчитана только из введённых параметров"
                        />
                      </div>
                    </div>
                  </div>

                  {calculation.attributionNote && (
                    <p className="mt-4 border-l-2 border-accent bg-accent-soft px-3 py-2 text-table text-text">
                      <span className="font-semibold">Обоснование коэффициента:</span>{" "}
                      {calculation.attributionNote}
                    </p>
                  )}

                  <details className="mt-4 border-t border-line pt-3">
                    <summary className="cursor-pointer text-table font-semibold text-muted">
                      Входные параметры и формула
                    </summary>
                    <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
                      <dl className="grid gap-x-5 gap-y-2 text-table sm:grid-cols-2">
                        {Object.entries(calculation.inputs).map(([key, value]) => (
                          <div key={key} className="border-b border-line pb-2">
                            <dt className="text-muted">{paramLabel(key)}</dt>
                            <dd className="mt-1 break-all font-technical text-text">
                              {displayInput(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <FormulaBand>{formula}</FormulaBand>
                    </div>
                  </details>

                  {calculation.reviews.length > 0 && (
                    <section className="mt-4 border-t border-line pt-3" aria-label="История независимой проверки">
                      <p className="text-meta font-semibold uppercase tracking-[0.08em] text-muted">
                        Review trail
                      </p>
                      <ul className="mt-2 space-y-2">
                        {calculation.reviews.map((reviewItem) => (
                          <li key={reviewItem.id} className="flex items-start gap-2 text-table text-text">
                            {reviewItem.verdict === "CONFIRMED" ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-action" aria-hidden="true" />
                            )}
                            <p>
                              <span className="font-semibold">{reviewItem.reviewerName}:</span>{" "}
                              {reviewItem.comment ?? "Комментарий не указан"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {canReview && calculation.calculatedById !== currentUserId && !confirmed && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => review(calculation.id, "CONFIRMED")}
                      >
                        Подтвердить расчёт
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="signalOutline"
                        disabled={busy}
                        onClick={() => review(calculation.id, "REJECTED")}
                      >
                        Отклонить расчёт
                      </Button>
                    </div>
                  )}
                  {canReview && calculation.calculatedById === currentUserId && !confirmed && (
                    <p className="mt-4 border-l-2 border-action bg-action-soft px-3 py-2 text-table text-action">
                      Независимую проверку не может выполнить автор расчёта — требуется второй
                      пользователь.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-control border border-action bg-action-soft px-3 py-2 text-table text-action" role="alert">
          {error}
        </p>
      )}

      {canCalculate && (
        <section aria-labelledby="calculation-workspace-heading" data-tour="economics-missing">
          <div className="mb-3 border-b border-line pb-3">
            <p className="eyebrow">Calculation workspace</p>
            <h3 id="calculation-workspace-heading" className="mt-1 text-section font-semibold text-text">
              Подготовить новый расчёт
            </h3>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section
              className="surface-band p-5"
              aria-labelledby="automation-effect-heading"
              data-tour="economics-labor-effect"
            >
              <div className="flex items-start gap-3 border-b border-line pb-4">
                <span className="font-technical text-section font-semibold text-muted">01</span>
                <div>
                  <p className="eyebrow">Direct effect</p>
                  <h4 id="automation-effect-heading" className="mt-1 text-lead font-semibold text-text">
                    Эффект снижения трудоёмкости
                  </h4>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <FormulaBand>Eₜ = (T₀ − T₁) × N × C</FormulaBand>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="t0">T₀, ч</Label>
                    <Input id="t0" type="number" value={t0} onChange={(event) => setT0(event.target.value)} placeholder="напр. 46" />
                  </div>
                  <div>
                    <Label htmlFor="t1">T₁, ч</Label>
                    <Input id="t1" type="number" value={t1} onChange={(event) => setT1(event.target.value)} placeholder="напр. 28" />
                  </div>
                  <div>
                    <Label htmlFor="n">N, пакетов/год</Label>
                    <Input id="n" type="number" value={n} onChange={(event) => setN(event.target.value)} placeholder="напр. 120" />
                  </div>
                  <div>
                    <Label htmlFor="c">C, ₸/ч</Label>
                    <Input id="c" type="number" value={c} onChange={(event) => setC(event.target.value)} placeholder="напр. 9500" />
                  </div>
                </div>
                <ResultBox
                  res={autoRes}
                  label="Годовой эффект снижения трудоёмкости"
                  nature="forecast"
                  formula="Eₜ = (T₀ − T₁) × N × C"
                  note="Прямой эффект: высвобождённое время участников процесса"
                />
                <Button
                  type="button"
                  disabled={!autoRes.ok || busy}
                  onClick={() =>
                    save("AUTOMATION", { t0: num(t0), t1: num(t1), n: num(n), c: num(c) })
                  }
                >
                  Сохранить расчёт в паспорт
                </Button>
              </div>
            </section>

            <section
              className="surface-band p-5"
              aria-labelledby="risk-effect-heading"
              data-tour="economics-attribution-input"
            >
              <div className="flex items-start gap-3 border-b border-line pb-4">
                <span className="font-technical text-section font-semibold text-muted">02</span>
                <div>
                  <p className="eyebrow">Indirect effect</p>
                  <h4 id="risk-effect-heading" className="mt-1 text-lead font-semibold text-text">
                    Снижение ожидаемого ущерба
                  </h4>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <FormulaBand>Eᵣ = [(P₀ × L₀) − (P₁ × L₁)] × доля атрибуции</FormulaBand>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p0">P₀ (0–1)</Label>
                    <Input id="p0" type="number" step="0.01" value={p0} onChange={(event) => setP0(event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="l0">L₀, ₸</Label>
                    <Input id="l0" type="number" value={l0} onChange={(event) => setL0(event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="p1">P₁ (0–1)</Label>
                    <Input id="p1" type="number" step="0.01" value={p1} onChange={(event) => setP1(event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="l1">L₁, ₸</Label>
                    <Input id="l1" type="number" value={l1} onChange={(event) => setL1(event.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="share">
                    Консервативный коэффициент влияния цифрового механизма (по умолчанию 0.5)
                  </Label>
                  <Input
                    id="share"
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={share}
                    onChange={(event) => setShare(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="share-note">Обоснование коэффициента</Label>
                  <Textarea
                    id="share-note"
                    value={shareNote}
                    onChange={(event) => setShareNote(event.target.value)}
                    placeholder="Какая часть снижения риска обеспечена цифровым контуром, а какая — иными мерами"
                  />
                </div>
                <ResultBox
                  res={riskRes}
                  label="Годовой эффект снижения ожидаемого ущерба (с учётом атрибуции)"
                  nature="forecast"
                  formula="Eᵣ = [(P₀×L₀) − (P₁×L₁)] × доля атрибуции"
                  note="Косвенный эффект: снижение ожидаемых потерь, а не денежный приток"
                />
                <Button
                  type="button"
                  disabled={!riskRes.ok || busy}
                  onClick={() =>
                    save(
                      "RISK",
                      {
                        p0: num(p0),
                        l0: num(l0),
                        p1: num(p1),
                        l1: num(l1),
                        attributionShare: num(share),
                      },
                      shareNote
                    )
                  }
                >
                  Сохранить расчёт в паспорт
                </Button>
              </div>
            </section>

            <section
              className="surface-band p-5 xl:col-span-2"
              aria-labelledby="npv-heading"
              data-tour="economics-npv"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 lg:flex-row lg:items-start">
                <div className="flex items-start gap-3">
                  <span className="font-technical text-section font-semibold text-muted">03</span>
                  <div>
                    <p className="eyebrow">Scale-stage investment case</p>
                    <h4 id="npv-heading" className="mt-1 text-lead font-semibold text-text">
                      NPV — только для стадии масштабирования
                    </h4>
                  </div>
                </div>
                <p className="max-w-2xl text-table text-muted">
                  TCO включает лицензии, инфраструктуру, интеграцию, сопровождение, киберзащиту,
                  обучение и валидацию моделей.
                </p>
              </div>
              <div className="mt-4 space-y-4">
                <FormulaBand>NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ</FormulaBand>
                <div className="max-w-xs">
                  <Label htmlFor="rate">Ставка дисконтирования r (доля)</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    placeholder="напр. 0.12"
                  />
                </div>

                <div className="overflow-x-auto border-y border-line">
                  <div className="min-w-[700px] divide-y divide-line">
                    {years.map((year, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[70px_repeat(3,minmax(180px,1fr))] gap-3 px-3 py-3"
                      >
                        <div className="flex items-center font-technical text-table font-semibold text-muted">
                          Год {index + 1}
                        </div>
                        <div>
                          <Label htmlFor={`et-${index}`}>Eₜ, ₸</Label>
                          <Input
                            id={`et-${index}`}
                            type="number"
                            value={year.et}
                            onChange={(event) =>
                              setYears((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, et: event.target.value } : item
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`er-${index}`}>Eᵣ, ₸</Label>
                          <Input
                            id={`er-${index}`}
                            type="number"
                            value={year.er}
                            onChange={(event) =>
                              setYears((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, er: event.target.value } : item
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`tco-${index}`}>TCOₜ, ₸</Label>
                          <Input
                            id={`tco-${index}`}
                            type="number"
                            value={year.tco}
                            onChange={(event) =>
                              setYears((previous) =>
                                previous.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, tco: event.target.value } : item
                                )
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setYears((previous) => [...previous, { et: "", er: "", tco: "" }])
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Добавить год
                  </Button>
                  {years.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setYears((previous) => previous.slice(0, -1))}
                    >
                      Убрать год
                    </Button>
                  )}
                </div>

                <ResultBox
                  res={npvRes}
                  label="Чистая приведённая стоимость проекта"
                  nature="forecast"
                  formula="NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ"
                  note="Считается только при заполненных Eₜ, Eᵣ и TCO по каждому году"
                />
                <Button
                  type="button"
                  disabled={!npvRes.ok || busy}
                  onClick={() =>
                    save("NPV", {
                      rate: num(rate),
                      years: years.map((year) => ({
                        et: num(year.et),
                        er: num(year.er),
                        tco: num(year.tco),
                      })),
                    })
                  }
                >
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                  Сохранить расчёт в паспорт
                </Button>
              </div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
