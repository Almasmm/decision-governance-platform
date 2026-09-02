// Индекс зрелости процесса принятия решений (5 уровней):
// 1 Фрагментарный · 2 Регламентированный · 3 Интегрированный · 4 Предиктивный · 5 Адаптивный.
// Среднее нормированных оценок KPI по выборке. Всегда возвращается с контекстом
// (размер выборки, период, перечень KPI) — UI обязан показывать его рядом
// с пометкой «расчёт по данным пилота», никогда — как официальный показатель компании.

import { kpiMetric } from "./kpi";

export interface MaturityInput {
  metricCode: string;
  value: number;
  sampleSize: number;
  measuredAt: Date;
}

export interface MaturityResult {
  /** Индекс 1.0–5.0 */
  index: number;
  levelNumber: 1 | 2 | 3 | 4 | 5;
  usedMetrics: Array<{ code: string; name: string; normalized: number }>;
  totalSampleSize: number;
  periodFrom: Date | null;
  periodTo: Date | null;
  /** Обязательная пометка для UI */
  disclaimer: string;
}

export const MATURITY_DISCLAIMER =
  "Расчёт по данным пилота. Не является официальным показателем компании.";

/** Нормирует значение метрики в 0..1 с учётом направления («больше лучше» / «меньше лучше»). */
export function normalizeMetric(code: string, value: number): number | null {
  const def = kpiMetric(code);
  if (!def) return null;
  const span = def.normMax - def.normMin;
  if (span <= 0) return null;
  const raw = (value - def.normMin) / span;
  const clamped = Math.min(1, Math.max(0, raw));
  return def.direction === "UP" ? clamped : 1 - clamped;
}

export function computeMaturity(inputs: MaturityInput[]): MaturityResult | null {
  const used: Array<{ code: string; name: string; normalized: number }> = [];
  let totalSample = 0;
  let from: Date | null = null;
  let to: Date | null = null;

  for (const m of inputs) {
    const norm = normalizeMetric(m.metricCode, m.value);
    const def = kpiMetric(m.metricCode);
    if (norm === null || !def) continue;
    used.push({ code: m.metricCode, name: def.name, normalized: norm });
    totalSample += m.sampleSize;
    if (!from || m.measuredAt < from) from = m.measuredAt;
    if (!to || m.measuredAt > to) to = m.measuredAt;
  }

  if (used.length === 0) return null;

  const avg = used.reduce((s, u) => s + u.normalized, 0) / used.length;
  const index = 1 + avg * 4; // 0..1 → 1..5
  const levelNumber = Math.min(5, Math.max(1, Math.round(index))) as 1 | 2 | 3 | 4 | 5;

  return {
    index: Math.round(index * 100) / 100,
    levelNumber,
    usedMetrics: used,
    totalSampleSize: totalSample,
    periodFrom: from,
    periodTo: to,
    disclaimer: MATURITY_DISCLAIMER,
  };
}
