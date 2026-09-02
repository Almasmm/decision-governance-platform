// Формулы экономического эффекта (раздел 3 диссертации).
// Принцип: деньги считаются ТОЛЬКО из введённых пользователем параметров.
// Если хоть один параметр отсутствует — возвращаем список недостающих, а не оценку.

export type EffectResult =
  | { ok: true; value: number; details: Record<string, number> }
  | { ok: false; missing: string[] };

function collectMissing(params: Record<string, number | null | undefined>): string[] {
  return Object.entries(params)
    .filter(([, v]) => v === null || v === undefined || Number.isNaN(v))
    .map(([k]) => k);
}

export interface AutomationInputs {
  /** T₀ — трудоёмкость подготовки одного пакета до внедрения, ч */
  t0?: number | null;
  /** T₁ — трудоёмкость после внедрения, ч */
  t1?: number | null;
  /** N — число пакетов в год */
  n?: number | null;
  /** C — средняя стоимость часа труда, тенге/ч */
  c?: number | null;
}

/** (1) Эффект снижения трудоёмкости: Eₜ = (T₀ − T₁) × N × C */
export function automationEffect(inputs: AutomationInputs): EffectResult {
  const missing = collectMissing({ t0: inputs.t0, t1: inputs.t1, n: inputs.n, c: inputs.c });
  if (missing.length > 0) return { ok: false, missing };
  const { t0, t1, n, c } = inputs as Required<{ [K in keyof AutomationInputs]: number }>;
  const value = (t0 - t1) * n * c;
  return { ok: true, value, details: { hoursSavedPerPackage: t0 - t1, hoursSavedPerYear: (t0 - t1) * n } };
}

export interface RiskInputs {
  /** P₀ — вероятность неблагоприятного события до, 0–1 */
  p0?: number | null;
  /** L₀ — потенциальные потери до, тенге */
  l0?: number | null;
  /** P₁ — вероятность после, 0–1 */
  p1?: number | null;
  /** L₁ — потенциальные потери после, тенге */
  l1?: number | null;
  /** Консервативная доля влияния цифрового механизма (по умолчанию 0.5) */
  attributionShare?: number | null;
}

export const DEFAULT_ATTRIBUTION_SHARE = 0.5;

/**
 * (2) Эффект снижения ожидаемого ущерба: Eᵣ = [(P₀×L₀) − (P₁×L₁)] × attributionShare.
 * attributionShare — консервативный коэффициент влияния цифрового механизма (дефолт 0.5).
 */
export function riskEffect(inputs: RiskInputs): EffectResult {
  const missing = collectMissing({ p0: inputs.p0, l0: inputs.l0, p1: inputs.p1, l1: inputs.l1 });
  if (missing.length > 0) return { ok: false, missing };
  const p0 = inputs.p0 as number;
  const l0 = inputs.l0 as number;
  const p1 = inputs.p1 as number;
  const l1 = inputs.l1 as number;
  const share = inputs.attributionShare ?? DEFAULT_ATTRIBUTION_SHARE;
  const gross = p0 * l0 - p1 * l1;
  const value = gross * share;
  return {
    ok: true,
    value,
    details: {
      expectedLossBefore: p0 * l0,
      expectedLossAfter: p1 * l1,
      grossEffect: gross,
      attributionShare: share,
    },
  };
}

export interface NpvInputs {
  /** Ставка дисконтирования, доля (напр. 0.12) */
  rate?: number | null;
  /** По годам t=1..T: эффект трудоёмкости, риск-эффект, TCO */
  years?: Array<{ et?: number | null; er?: number | null; tco?: number | null }> | null;
}

/** (3) NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ — только для стадии масштабирования. */
export function npvEffect(inputs: NpvInputs): EffectResult {
  const missing: string[] = [];
  if (inputs.rate === null || inputs.rate === undefined || Number.isNaN(inputs.rate)) missing.push("rate");
  if (!inputs.years || inputs.years.length === 0) missing.push("years");
  else {
    inputs.years.forEach((y, i) => {
      if (y.et === null || y.et === undefined || Number.isNaN(y.et)) missing.push(`years[${i}].et`);
      if (y.er === null || y.er === undefined || Number.isNaN(y.er)) missing.push(`years[${i}].er`);
      if (y.tco === null || y.tco === undefined || Number.isNaN(y.tco)) missing.push(`years[${i}].tco`);
    });
  }
  if (missing.length > 0) return { ok: false, missing };
  const rate = inputs.rate as number;
  const years = inputs.years as Array<{ et: number; er: number; tco: number }>;
  let npv = 0;
  let totalTco = 0;
  years.forEach((y, i) => {
    const t = i + 1;
    npv += (y.et + y.er - y.tco) / Math.pow(1 + rate, t);
    totalTco += y.tco;
  });
  return { ok: true, value: npv, details: { horizonYears: years.length, totalTco } };
}
