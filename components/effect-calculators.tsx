"use client";

// Автономные калькуляторы формул (1)–(3) для экрана «Замер эффекта».
// Результат не показывается, пока не введены все параметры.
import { useMemo, useState } from "react";
import { AlertTriangle, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { formatMoney } from "@/lib/utils";

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

function label(key: string): string {
  if (PARAM_LABELS[key]) return PARAM_LABELS[key];
  const m = /^years\[(\d+)\]\.(\w+)$/.exec(key);
  if (m) {
    const field = m[2] === "et" ? "Eₜ" : m[2] === "er" ? "Eᵣ" : "TCO";
    return `год ${Number(m[1]) + 1}: ${field}`;
  }
  return key;
}

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function Result({ res, formula, note }: { res: EffectResult; formula: string; note: string }) {
  if (!res.ok)
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-warn">
          <AlertTriangle className="h-4 w-4" />
          {ru.common.notEnoughData}
        </div>
        <p className="mt-1 text-xs text-slate-700">
          {ru.common.missingParams}: {res.missing.map(label).join("; ")}.
        </p>
      </div>
    );
  return (
    <div className="rounded border border-slate-200 bg-brand-card/50 p-3">
      <div className="text-lg font-bold text-brand">
        <Provenance
          value={formatMoney(res.value)}
          nature="forecast"
          source="Расчёт по введённым пользователем параметрам"
          formula={formula}
          note={note}
        />
      </div>
      <dl className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
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

export function EffectCalculators() {
  const [t0, setT0] = useState("");
  const [t1, setT1] = useState("");
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const auto = useMemo(() => automationEffect({ t0: num(t0), t1: num(t1), n: num(n), c: num(c) }), [t0, t1, n, c]);

  const [p0, setP0] = useState("");
  const [l0, setL0] = useState("");
  const [p1, setP1] = useState("");
  const [l1, setL1] = useState("");
  const [share, setShare] = useState(String(DEFAULT_ATTRIBUTION_SHARE));
  const [shareNote, setShareNote] = useState("");
  const risk = useMemo(
    () =>
      riskEffect({
        p0: num(p0), l0: num(l0), p1: num(p1), l1: num(l1),
        attributionShare: num(share) ?? DEFAULT_ATTRIBUTION_SHARE,
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
        rate: num(rate),
        years: years.map((y) => ({ et: num(y.et), er: num(y.er), tco: num(y.tco) })),
      }),
    [rate, years]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <span className="inline-flex items-center gap-1.5">
              <Calculator className="h-4 w-4" />
              (1) Эффект снижения трудоёмкости
            </span>
          </CardTitle>
          <Badge variant="accent">прямой эффект</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px]">Eₜ = (T₀ − T₁) × N × C</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label htmlFor="k-t0">T₀, ч</Label><Input id="k-t0" type="number" value={t0} onChange={(e) => setT0(e.target.value)} /></div>
            <div><Label htmlFor="k-t1">T₁, ч</Label><Input id="k-t1" type="number" value={t1} onChange={(e) => setT1(e.target.value)} /></div>
            <div><Label htmlFor="k-n">N, пакетов/год</Label><Input id="k-n" type="number" value={n} onChange={(e) => setN(e.target.value)} /></div>
            <div><Label htmlFor="k-c">C, ₸/ч</Label><Input id="k-c" type="number" value={c} onChange={(e) => setC(e.target.value)} /></div>
          </div>
          <Result res={auto} formula="Eₜ = (T₀ − T₁) × N × C" note="Высвобожденное время участников процесса подготовки решений" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <span className="inline-flex items-center gap-1.5">
              <Calculator className="h-4 w-4" />
              (2) Эффект снижения ожидаемого ущерба
            </span>
          </CardTitle>
          <Badge variant="outline">косвенный эффект</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px]">
            Eᵣ = [(P₀ × L₀) − (P₁ × L₁)] × доля атрибуции
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label htmlFor="k-p0">P₀ (0–1)</Label><Input id="k-p0" type="number" step="0.01" value={p0} onChange={(e) => setP0(e.target.value)} /></div>
            <div><Label htmlFor="k-l0">L₀, ₸</Label><Input id="k-l0" type="number" value={l0} onChange={(e) => setL0(e.target.value)} /></div>
            <div><Label htmlFor="k-p1">P₁ (0–1)</Label><Input id="k-p1" type="number" step="0.01" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
            <div><Label htmlFor="k-l1">L₁, ₸</Label><Input id="k-l1" type="number" value={l1} onChange={(e) => setL1(e.target.value)} /></div>
          </div>
          <div>
            <Label htmlFor="k-share">Консервативный коэффициент влияния цифрового механизма</Label>
            <Input id="k-share" type="number" step="0.05" min={0} max={1} value={share} onChange={(e) => setShare(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="k-share-note">Обоснование коэффициента</Label>
            <Textarea id="k-share-note" className="min-h-16" value={shareNote} onChange={(e) => setShareNote(e.target.value)} placeholder="Какая часть снижения риска обеспечена цифровым контуром" />
          </div>
          <Result res={risk} formula="Eᵣ = [(P₀×L₀) − (P₁×L₁)] × доля атрибуции" note="Снижение ожидаемых потерь, а не денежный приток" />
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
            TCO: лицензии, инфраструктура, интеграция, сопровождение, киберзащита, обучение,
            валидация моделей
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px]">
            NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ
          </p>
          <div className="w-48">
            <Label htmlFor="k-rate">Ставка дисконтирования r</Label>
            <Input id="k-rate" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.12" />
          </div>
          {years.map((y, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[60px_1fr_1fr_1fr]">
              <div className="flex items-end pb-2 text-xs text-slate-500">Год {i + 1}</div>
              <div>
                <Label htmlFor={`k-et-${i}`}>Eₜ, ₸</Label>
                <Input id={`k-et-${i}`} type="number" value={y.et} onChange={(e) => setYears((p) => p.map((v, j) => (j === i ? { ...v, et: e.target.value } : v)))} />
              </div>
              <div>
                <Label htmlFor={`k-er-${i}`}>Eᵣ, ₸</Label>
                <Input id={`k-er-${i}`} type="number" value={y.er} onChange={(e) => setYears((p) => p.map((v, j) => (j === i ? { ...v, er: e.target.value } : v)))} />
              </div>
              <div>
                <Label htmlFor={`k-tco-${i}`}>TCOₜ, ₸</Label>
                <Input id={`k-tco-${i}`} type="number" value={y.tco} onChange={(e) => setYears((p) => p.map((v, j) => (j === i ? { ...v, tco: e.target.value } : v)))} />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50" onClick={() => setYears((p) => [...p, { et: "", er: "", tco: "" }])}>
              Добавить год
            </button>
            {years.length > 1 && (
              <button type="button" className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100" onClick={() => setYears((p) => p.slice(0, -1))}>
                Убрать год
              </button>
            )}
          </div>
          <Result res={npv} formula="NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ" note="Считается только при заполненных Eₜ, Eᵣ и TCO по каждому году" />
        </CardContent>
      </Card>
    </div>
  );
}
