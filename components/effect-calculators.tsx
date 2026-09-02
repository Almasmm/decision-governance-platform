"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Calculator, Sigma } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Provenance } from "@/components/provenance";
import {
  automationEffect,
  riskEffect,
  npvEffect,
  DEFAULT_ATTRIBUTION_SHARE,
  type EffectResult,
} from "@/lib/effects";
import { ru } from "@/lib/i18n/ru";
import { cn, formatMoney } from "@/lib/utils";

type CalculatorKey = "automation" | "risk" | "npv";

const CALCULATORS: Array<{
  key: CalculatorKey;
  number: string;
  title: string;
  caption: string;
}> = [
  {
    key: "automation",
    number: "01",
    title: "Трудоёмкость",
    caption: "Прямой операционный эффект",
  },
  {
    key: "risk",
    number: "02",
    title: "Ожидаемый ущерб",
    caption: "Консервативный риск-эффект",
  },
  {
    key: "npv",
    number: "03",
    title: "NPV масштабирования",
    caption: "Эффект за вычетом полного TCO",
  },
];

const PARAM_LABELS: Record<string, string> = {
  t0: "T₀ — трудоёмкость до внедрения, ч",
  t1: "T₁ — трудоёмкость после внедрения, ч",
  n: "N — число пакетов в год",
  c: "C — стоимость часа труда, ₸/ч",
  p0: "P₀ — вероятность до",
  l0: "L₀ — потери до, ₸",
  p1: "P₁ — вероятность после",
  l1: "L₁ — потери после, ₸",
  rate: "r — ставка дисконтирования",
  years: "годы прогнозного периода",
};

const DETAIL_LABELS: Record<string, { label: string; format?: "money" | "percent" | "number" }> = {
  hoursSavedPerPackage: { label: "Высвобождено на один пакет, ч", format: "number" },
  hoursSavedPerYear: { label: "Высвобождено за год, ч", format: "number" },
  expectedLossBefore: { label: "Ожидаемый ущерб до мер", format: "money" },
  expectedLossAfter: { label: "Ожидаемый ущерб после мер", format: "money" },
  grossEffect: { label: "Снижение ожидаемого ущерба до атрибуции", format: "money" },
  attributionShare: { label: "Доля эффекта цифрового контура", format: "percent" },
  horizonYears: { label: "Горизонт расчёта, лет", format: "number" },
  totalTco: { label: "Совокупный TCO", format: "money" },
};

function parameterLabel(key: string): string {
  if (PARAM_LABELS[key]) return PARAM_LABELS[key];
  const match = /^years\[(\d+)\]\.(\w+)$/.exec(key);
  if (match) {
    const field = match[2] === "et" ? "Eₜ" : match[2] === "er" ? "Eᵣ" : "TCO";
    return `год ${Number(match[1]) + 1}: ${field}`;
  }
  return "обязательный параметр";
}

function numberValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function detailValue(key: string, value: number): string {
  const format = DETAIL_LABELS[key]?.format;
  if (format === "money") return formatMoney(value);
  if (format === "percent") return `${(value * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}

function Result({ result, formula, note }: { result: EffectResult; formula: string; note: string }) {
  if (!result.ok) {
    return (
      <aside className="border-l-4 border-action bg-action-soft px-4 py-4">
        <p className="flex items-center gap-2 text-base font-semibold text-action">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {ru.common.notEnoughData}
        </p>
        <p className="mt-2 text-meta text-text">
          {ru.common.missingParams}: {result.missing.map(parameterLabel).join("; ")}.
        </p>
        <p className="mt-3 text-meta text-muted">Система не строит оценку из предположений по умолчанию.</p>
      </aside>
    );
  }

  return (
    <aside className="border-l-4 border-accent bg-accent-soft px-4 py-4">
      <p className="text-meta font-semibold text-accent">Расчётный сценарий</p>
      <div className="mt-2 text-section font-semibold text-text">
        <Provenance
          value={formatMoney(result.value)}
          nature="forecast"
          source="Расчёт по введённым пользователем параметрам"
          formula={formula}
          note={note}
        />
      </div>
      <dl className="mt-4 divide-y divide-line border-t border-line text-meta">
        {Object.entries(result.details).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4 py-2">
            <dt className="text-muted">{DETAIL_LABELS[key]?.label ?? "Параметр расчёта"}</dt>
            <dd className="shrink-0 font-technical font-semibold tabular-nums text-text">
              {detailValue(key, value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-meta text-muted">
        Результат не является подтверждённым денежным притоком или официальным эффектом компании.
      </p>
    </aside>
  );
}

export function EffectCalculators() {
  const [active, setActive] = useState<CalculatorKey>("automation");

  const [t0, setT0] = useState("");
  const [t1, setT1] = useState("");
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const automation = useMemo(
    () => automationEffect({ t0: numberValue(t0), t1: numberValue(t1), n: numberValue(n), c: numberValue(c) }),
    [t0, t1, n, c]
  );

  const [p0, setP0] = useState("");
  const [l0, setL0] = useState("");
  const [p1, setP1] = useState("");
  const [l1, setL1] = useState("");
  const [share, setShare] = useState(String(DEFAULT_ATTRIBUTION_SHARE));
  const [shareNote, setShareNote] = useState("");
  const risk = useMemo(
    () =>
      riskEffect({
        p0: numberValue(p0),
        l0: numberValue(l0),
        p1: numberValue(p1),
        l1: numberValue(l1),
        attributionShare: numberValue(share) ?? DEFAULT_ATTRIBUTION_SHARE,
      }),
    [p0, l0, p1, l1, share]
  );

  const [rate, setRate] = useState("");
  const [years, setYears] = useState<Array<{ et: string; er: string; tco: string }>>([
    { et: "", er: "", tco: "" },
  ]);
  const npv = useMemo(
    () =>
      npvEffect({
        rate: numberValue(rate),
        years: years.map((year) => ({
          et: numberValue(year.et),
          er: numberValue(year.er),
          tco: numberValue(year.tco),
        })),
      }),
    [rate, years]
  );

  return (
    <div className="overflow-hidden rounded-panel bg-surface shadow-panel lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav className="border-b border-line bg-obsidian p-2 lg:border-b-0 lg:border-r" aria-label="Формулы оценки эффекта">
        <p className="px-3 py-2 text-meta font-semibold text-line-strong">Выберите расчёт</p>
        <div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {CALCULATORS.map((calculator) => (
            <button
              key={calculator.key}
              type="button"
              aria-pressed={active === calculator.key}
              onClick={() => setActive(calculator.key)}
              className={cn(
                "min-h-16 rounded-control px-3 py-2 text-left transition-colors",
                active === calculator.key
                  ? "bg-surface text-text"
                  : "text-line-strong hover:bg-graphite-soft hover:text-surface"
              )}
            >
              <span className="font-technical text-meta">{calculator.number}</span>
              <span className="ml-2 text-base font-semibold">{calculator.title}</span>
              <span className={cn("mt-1 block text-meta", active === calculator.key ? "text-muted" : "text-line-strong")}>
                {calculator.caption}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className="min-w-0 p-4 sm:p-5">
        {active === "automation" && (
          <CalculatorPanel
            number="01"
            title="Эффект снижения трудоёмкости"
            formula="Eₜ = (T₀ − T₁) × N × C"
            badge="прямой эффект"
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] items-stretch gap-2">
                  <fieldset className="border border-dashed border-line-strong bg-canvas p-3">
                    <legend className="px-1 text-meta font-semibold text-muted">Baseline · до</legend>
                    <Label htmlFor="k-t0">T₀, часов на пакет</Label>
                    <Input id="k-t0" type="number" value={t0} onChange={(event) => setT0(event.target.value)} />
                  </fieldset>
                  <div className="flex items-center justify-center text-muted" aria-hidden="true">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  <fieldset className="border-l-4 border-accent bg-accent-soft p-3">
                    <legend className="px-1 text-meta font-semibold text-accent">После внедрения</legend>
                    <Label htmlFor="k-t1">T₁, часов на пакет</Label>
                    <Input id="k-t1" type="number" value={t1} onChange={(event) => setT1(event.target.value)} />
                  </fieldset>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="k-n">N — пакетов в год</Label>
                    <Input id="k-n" type="number" value={n} onChange={(event) => setN(event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="k-c">C — стоимость часа, ₸/ч</Label>
                    <Input id="k-c" type="number" value={c} onChange={(event) => setC(event.target.value)} />
                  </div>
                </div>
              </div>
              <Result
                result={automation}
                formula="Eₜ = (T₀ − T₁) × N × C"
                note="Высвобождённое время участников подготовки решений"
              />
            </div>
          </CalculatorPanel>
        )}

        {active === "risk" && (
          <CalculatorPanel
            number="02"
            title="Эффект снижения ожидаемого ущерба"
            formula="Eᵣ = [(P₀ × L₀) − (P₁ × L₁)] × доля атрибуции"
            badge="косвенный эффект"
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] items-stretch gap-2">
                  <fieldset className="border border-dashed border-line-strong bg-canvas p-3">
                    <legend className="px-1 text-meta font-semibold text-muted">Начальный риск · до мер</legend>
                    <div>
                      <Label htmlFor="k-p0">P₀ — вероятность, 0–1</Label>
                      <Input id="k-p0" type="number" step="0.01" value={p0} onChange={(event) => setP0(event.target.value)} />
                    </div>
                    <div className="mt-3">
                      <Label htmlFor="k-l0">L₀ — потенциальные потери, ₸</Label>
                      <Input id="k-l0" type="number" value={l0} onChange={(event) => setL0(event.target.value)} />
                    </div>
                  </fieldset>
                  <div className="flex items-center justify-center text-muted" aria-hidden="true">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  <fieldset className="border-l-4 border-accent bg-accent-soft p-3">
                    <legend className="px-1 text-meta font-semibold text-accent">Остаточный риск · после мер</legend>
                    <div>
                      <Label htmlFor="k-p1">P₁ — вероятность, 0–1</Label>
                      <Input id="k-p1" type="number" step="0.01" value={p1} onChange={(event) => setP1(event.target.value)} />
                    </div>
                    <div className="mt-3">
                      <Label htmlFor="k-l1">L₁ — остаточные потери, ₸</Label>
                      <Input id="k-l1" type="number" value={l1} onChange={(event) => setL1(event.target.value)} />
                    </div>
                  </fieldset>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <Label htmlFor="k-share">Доля атрибуции контуру</Label>
                    <Input id="k-share" type="number" step="0.05" min={0} max={1} value={share} onChange={(event) => setShare(event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="k-share-note">Обоснование коэффициента</Label>
                    <Textarea
                      id="k-share-note"
                      className="min-h-20"
                      value={shareNote}
                      onChange={(event) => setShareNote(event.target.value)}
                      placeholder="Какая часть снижения риска обеспечена именно цифровым контуром"
                    />
                  </div>
                </div>
              </div>
              <Result
                result={risk}
                formula="Eᵣ = [(P₀ × L₀) − (P₁ × L₁)] × доля атрибуции"
                note={shareNote.trim() || "Снижение ожидаемых потерь, а не денежный приток"}
              />
            </div>
          </CalculatorPanel>
        )}

        {active === "npv" && (
          <CalculatorPanel
            number="03"
            title="NPV стадии масштабирования"
            formula="NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ"
            badge="после KPI-gate"
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <div className="border-l-4 border-line-strong bg-canvas px-3 py-2 text-meta text-muted">
                  NPV применяется только после обоснования масштабирования. TCO включает лицензии,
                  инфраструктуру, интеграцию, сопровождение, киберзащиту, обучение и валидацию моделей.
                </div>
                <div className="mt-4 w-full max-w-xs">
                  <Label htmlFor="k-rate">Ставка дисконтирования r</Label>
                  <Input id="k-rate" type="number" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="0.12" />
                </div>
                <div className="mt-4 overflow-x-auto">
                  <div className="min-w-[620px]">
                    <div className="grid grid-cols-[64px_1fr_1fr_1fr] gap-3 border-b border-line pb-2 text-meta font-semibold text-muted">
                      <span>Период</span>
                      <span>Eₜ · трудоёмкость</span>
                      <span>Eᵣ · риск</span>
                      <span>TCO</span>
                    </div>
                    {years.map((year, index) => (
                      <div key={index} className="grid grid-cols-[64px_1fr_1fr_1fr] gap-3 border-b border-line py-3">
                        <div className="flex items-center font-technical text-meta text-muted">Год {index + 1}</div>
                        <div>
                          <Label className="sr-only" htmlFor={`k-et-${index}`}>Eₜ, ₸</Label>
                          <Input id={`k-et-${index}`} type="number" value={year.et} onChange={(event) => setYears((previous) => previous.map((value, yearIndex) => yearIndex === index ? { ...value, et: event.target.value } : value))} placeholder="₸" />
                        </div>
                        <div>
                          <Label className="sr-only" htmlFor={`k-er-${index}`}>Eᵣ, ₸</Label>
                          <Input id={`k-er-${index}`} type="number" value={year.er} onChange={(event) => setYears((previous) => previous.map((value, yearIndex) => yearIndex === index ? { ...value, er: event.target.value } : value))} placeholder="₸" />
                        </div>
                        <div>
                          <Label className="sr-only" htmlFor={`k-tco-${index}`}>TCO, ₸</Label>
                          <Input id={`k-tco-${index}`} type="number" value={year.tco} onChange={(event) => setYears((previous) => previous.map((value, yearIndex) => yearIndex === index ? { ...value, tco: event.target.value } : value))} placeholder="₸" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setYears((previous) => [...previous, { et: "", er: "", tco: "" }])}>
                    Добавить год
                  </Button>
                  {years.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setYears((previous) => previous.slice(0, -1))}>
                      Убрать последний год
                    </Button>
                  )}
                </div>
              </div>
              <Result
                result={npv}
                formula="NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ"
                note="Расчёт только при заполненных Eₜ, Eᵣ и TCO каждого года"
              />
            </div>
          </CalculatorPanel>
        )}
      </div>
    </div>
  );
}

function CalculatorPanel({
  number,
  title,
  formula,
  badge,
  children,
}: {
  number: string;
  title: string;
  formula: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="flex items-center gap-2 font-technical text-meta text-muted">
            <Calculator className="h-4 w-4" aria-hidden="true" /> Формула {number}
          </p>
          <h3 className="mt-1 text-section font-semibold text-text">{title}</h3>
        </div>
        <Badge variant="technical">{badge}</Badge>
      </header>
      <p className="my-4 flex items-center gap-2 bg-canvas px-3 py-2 font-technical text-table text-text">
        <Sigma className="h-4 w-4 text-muted" aria-hidden="true" /> {formula}
      </p>
      {children}
    </section>
  );
}
