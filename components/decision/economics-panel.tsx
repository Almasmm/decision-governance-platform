"use client";

// Экономика решения: калькуляторы формул (1) Eₜ, (2) Eᵣ, (3) NPV.
// Денежная величина не показывается, пока не введены все параметры —
// вместо результата выводится перечень недостающих параметров.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Calculator, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  reviews: Array<{ id: string; reviewerName: string; reviewerId: string; verdict: string; comment: string | null }>;
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
  rate: "r — ставка дисконтирования",
  years: "Годы прогнозного периода",
};

function paramLabel(key: string): string {
  if (PARAM_LABELS[key]) return PARAM_LABELS[key];
  const m = /^years\[(\d+)\]\.(\w+)$/.exec(key);
  if (m) {
    const idx = Number(m[1]) + 1;
    const field = m[2] === "et" ? "Eₜ" : m[2] === "er" ? "Eᵣ" : "TCO";
    return `Год ${idx}: ${field}`;
  }
  return key;
}

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
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
      <div className="rounded border border-amber-300 bg-amber-50 p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-warn">
          <AlertTriangle className="h-4 w-4" />
          {ru.common.notEnoughData}
        </div>
        <p className="mt-1 text-xs text-slate-700">
          {ru.common.missingParams}: {res.missing.map(paramLabel).join("; ")}.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded border border-slate-200 bg-brand-card/50 p-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-brand">
        <Provenance
          value={formatMoney(res.value)}
          nature={nature}
          source="Расчёт по введённым пользователем параметрам"
          formula={formula}
          note={note}
        />
      </div>
      <dl className="mt-2 space-y-0.5 text-[11px] text-slate-600">
        {Object.entries(res.details).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt>{k}</dt>
            <dd className="tabular-nums">
              {Math.abs(v) >= 1e6 ? formatMoney(v) : v.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
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

  // (1) Трудоёмкость
  const [t0, setT0] = useState("");
  const [t1, setT1] = useState("");
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const autoRes = useMemo(
    () => automationEffect({ t0: num(t0), t1: num(t1), n: num(n), c: num(c) }),
    [t0, t1, n, c]
  );

  // (2) Риск
  const [p0, setP0] = useState("");
  const [l0, setL0] = useState("");
  const [p1, setP1] = useState("");
  const [l1, setL1] = useState("");
  const [share, setShare] = useState(String(DEFAULT_ATTRIBUTION_SHARE));
  const [shareNote, setShareNote] = useState("");
  const riskRes = useMemo(
    () =>
      riskEffect({
        p0: num(p0), l0: num(l0), p1: num(p1), l1: num(l1),
        attributionShare: num(share) ?? DEFAULT_ATTRIBUTION_SHARE,
      }),
    [p0, l0, p1, l1, share]
  );

  // (3) NPV
  const [rate, setRate] = useState("");
  const [years, setYears] = useState<Array<{ et: string; er: string; tco: string }>>([
    { et: "", er: "", tco: "" },
  ]);
  const npvRes = useMemo(
    () =>
      npvEffect({
        rate: num(rate),
        years: years.map((y) => ({ et: num(y.et), er: num(y.er), tco: num(y.tco) })),
      }),
    [rate, years]
  );

  async function save(kind: EffectKind, inputs: Record<string, unknown>, note?: string) {
    setBusy(true);
    setError(null);
    const res = await addCalculation(decisionId, kind, inputs, note);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function review(calcId: string, verdict: "CONFIRMED" | "REJECTED") {
    const comment = window.prompt(
      verdict === "CONFIRMED"
        ? "Комментарий независимой проверки (что именно проверено):"
        : "Причина отклонения расчёта:"
    );
    if (comment === null) return;
    setBusy(true);
    setError(null);
    const res = await reviewCalculation(calcId, verdict, comment);
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
          <CardTitle>Выполненные расчёты и независимая проверка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {calculations.length === 0 && (
            <p className="text-sm text-slate-500">
              Расчёты эффекта не выполнены. Для уровня A требуется как минимум один расчёт с
              независимой проверкой вторым пользователем.
            </p>
          )}
          {calculations.map((calc) => {
            const confirmed = calc.reviews.some(
              (r) => r.verdict === "CONFIRMED" && r.reviewerId !== calc.calculatedById
            );
            const isDirect = calc.kind === "AUTOMATION";
            return (
              <div
                key={calc.id}
                className={`rounded border p-3 ${isDirect ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50/60"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={isDirect ? "accent" : "outline"}>
                      {isDirect ? "прямой эффект" : "косвенный эффект"}
                    </Badge>
                    <span className="text-sm font-medium text-slate-900">
                      {ru.effectKinds[calc.kind as EffectKind]}
                    </span>
                    {confirmed ? (
                      <Badge variant="success">
                        <ShieldCheck className="h-3 w-3" /> независимо подтверждён
                      </Badge>
                    ) : (
                      <Badge variant="warn">ожидает независимой проверки</Badge>
                    )}
                  </div>
                  <div className="text-sm font-bold text-brand">
                    <Provenance
                      value={formatMoney(calc.result)}
                      nature="forecast"
                      source={`Расчёт: ${calc.calculatedByName}`}
                      asOf={format(new Date(calc.calculatedAt), "d MMMM yyyy", { locale: ruLocale })}
                      formula={
                        calc.kind === "AUTOMATION"
                          ? "Eₜ = (T₀ − T₁) × N × C"
                          : calc.kind === "RISK"
                            ? "Eᵣ = [(P₀×L₀) − (P₁×L₁)] × доля атрибуции"
                            : "NPV = Σ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ"
                      }
                      note="Величина рассчитана только из введённых параметров"
                    />
                  </div>
                </div>
                <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-600">
                  {Object.entries(calc.inputs).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <dt className="text-slate-400">{k}:</dt>
                      <dd className="tabular-nums">
                        {typeof v === "number" ? v.toLocaleString("ru-RU") : JSON.stringify(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {calc.attributionNote && (
                  <p className="mt-1 text-[11px] italic text-slate-500">
                    Обоснование коэффициента атрибуции: {calc.attributionNote}
                  </p>
                )}
                {calc.reviews.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {calc.reviews.map((r) => (
                      <li key={r.id} className="text-[11px] text-slate-600">
                        {r.verdict === "CONFIRMED" ? "✔" : "✘"} {r.reviewerName}: {r.comment ?? "—"}
                      </li>
                    ))}
                  </ul>
                )}
                {canReview && calc.calculatedById !== currentUserId && !confirmed && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => review(calc.id, "CONFIRMED")}>
                      Подтвердить расчёт
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => review(calc.id, "REJECTED")}>
                      Отклонить расчёт
                    </Button>
                  </div>
                )}
                {canReview && calc.calculatedById === currentUserId && !confirmed && (
                  <p className="mt-2 text-[11px] text-brand-warn">
                    Независимую проверку не может выполнить автор расчёта — требуется второй
                    пользователь.
                  </p>
                )}
              </div>
            );
          })}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </CardContent>
      </Card>

      {canCalculate && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Calculator className="h-4 w-4" />
                  (1) Эффект снижения трудоёмкости — прямой
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">
                Eₜ = (T₀ − T₁) × N × C
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="t0">T₀, ч</Label>
                  <Input id="t0" type="number" value={t0} onChange={(e) => setT0(e.target.value)} placeholder="напр. 46" />
                </div>
                <div>
                  <Label htmlFor="t1">T₁, ч</Label>
                  <Input id="t1" type="number" value={t1} onChange={(e) => setT1(e.target.value)} placeholder="напр. 28" />
                </div>
                <div>
                  <Label htmlFor="n">N, пакетов/год</Label>
                  <Input id="n" type="number" value={n} onChange={(e) => setN(e.target.value)} placeholder="напр. 120" />
                </div>
                <div>
                  <Label htmlFor="c">C, ₸/ч</Label>
                  <Input id="c" type="number" value={c} onChange={(e) => setC(e.target.value)} placeholder="напр. 9500" />
                </div>
              </div>
              <ResultBox
                res={autoRes}
                label="Годовой эффект снижения трудоёмкости"
                nature="forecast"
                formula="Eₜ = (T₀ − T₁) × N × C"
                note="Прямой эффект: высвобожденное время участников процесса"
              />
              <Button
                size="sm"
                disabled={!autoRes.ok || busy}
                onClick={() =>
                  save("AUTOMATION", { t0: num(t0), t1: num(t1), n: num(n), c: num(c) })
                }
              >
                Сохранить расчёт в паспорт
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Calculator className="h-4 w-4" />
                  (2) Эффект снижения ожидаемого ущерба — косвенный
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">
                Eᵣ = [(P₀ × L₀) − (P₁ × L₁)] × доля атрибуции
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p0">P₀ (0–1)</Label>
                  <Input id="p0" type="number" step="0.01" value={p0} onChange={(e) => setP0(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="l0">L₀, ₸</Label>
                  <Input id="l0" type="number" value={l0} onChange={(e) => setL0(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="p1">P₁ (0–1)</Label>
                  <Input id="p1" type="number" step="0.01" value={p1} onChange={(e) => setP1(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="l1">L₁, ₸</Label>
                  <Input id="l1" type="number" value={l1} onChange={(e) => setL1(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="share">
                  Консервативный коэффициент влияния цифрового механизма (по умолчанию 0.5)
                </Label>
                <Input id="share" type="number" step="0.05" min={0} max={1} value={share} onChange={(e) => setShare(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="share-note">Обоснование коэффициента</Label>
                <Textarea
                  id="share-note"
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="Какая часть снижения риска обеспечена именно цифровым контуром, а какая — иными мерами"
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
                size="sm"
                disabled={!riskRes.ok || busy}
                onClick={() =>
                  save(
                    "RISK",
                    { p0: num(p0), l0: num(l0), p1: num(p1), l1: num(l1), attributionShare: num(share) },
                    shareNote
                  )
                }
              >
                Сохранить расчёт в паспорт
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Calculator className="h-4 w-4" />
                  (3) NPV — только для стадии масштабирования
                </span>
              </CardTitle>
              <span className="text-[11px] text-slate-500">
                TCO включает лицензии, инфраструктуру, интеграцию, сопровождение, киберзащиту,
                обучение и валидацию моделей
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">
                NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ
              </p>
              <div className="w-48">
                <Label htmlFor="rate">Ставка дисконтирования r (доля)</Label>
                <Input id="rate" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="напр. 0.12" />
              </div>
              <div className="space-y-2">
                {years.map((y, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[60px_1fr_1fr_1fr]">
                    <div className="flex items-end pb-2 text-xs text-slate-500">Год {i + 1}</div>
                    <div>
                      <Label htmlFor={`et-${i}`}>Eₜ, ₸</Label>
                      <Input
                        id={`et-${i}`}
                        type="number"
                        value={y.et}
                        onChange={(e) =>
                          setYears((prev) => prev.map((p, j) => (j === i ? { ...p, et: e.target.value } : p)))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`er-${i}`}>Eᵣ, ₸</Label>
                      <Input
                        id={`er-${i}`}
                        type="number"
                        value={y.er}
                        onChange={(e) =>
                          setYears((prev) => prev.map((p, j) => (j === i ? { ...p, er: e.target.value } : p)))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`tco-${i}`}>TCOₜ, ₸</Label>
                      <Input
                        id={`tco-${i}`}
                        type="number"
                        value={y.tco}
                        onChange={(e) =>
                          setYears((prev) => prev.map((p, j) => (j === i ? { ...p, tco: e.target.value } : p)))
                        }
                      />
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setYears((p) => [...p, { et: "", er: "", tco: "" }])}>
                    Добавить год
                  </Button>
                  {years.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setYears((p) => p.slice(0, -1))}>
                      Убрать год
                    </Button>
                  )}
                </div>
              </div>
              <ResultBox
                res={npvRes}
                label="Чистая приведённая стоимость проекта"
                nature="forecast"
                formula="NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ"
                note="Считается только при заполненных Eₜ, Eᵣ и TCO по каждому году"
              />
              <Button
                size="sm"
                disabled={!npvRes.ok || busy}
                onClick={() =>
                  save("NPV", {
                    rate: num(rate),
                    years: years.map((y) => ({ et: num(y.et), er: num(y.er), tco: num(y.tco) })),
                  })
                }
              >
                Сохранить расчёт в паспорт
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
