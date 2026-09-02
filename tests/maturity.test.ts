import { describe, it, expect } from "vitest";
import { computeMaturity, normalizeMetric, MATURITY_DISCLAIMER } from "@/lib/maturity";
import { kpiMetric } from "@/lib/kpi";

const at = new Date("2026-06-30");

describe("Нормирование KPI", () => {
  it("для метрики «больше — лучше» максимум даёт 1", () => {
    expect(normalizeMetric("DATA_CRIT_OWNED_SHARE", 100)).toBe(1);
    expect(normalizeMetric("DATA_CRIT_OWNED_SHARE", 0)).toBe(0);
    expect(normalizeMetric("DATA_CRIT_OWNED_SHARE", 50)).toBeCloseTo(0.5, 6);
  });

  it("для метрики «меньше — лучше» шкала инвертируется", () => {
    const def = kpiMetric("SPEED_MEDIAN_DAYS");
    expect(def?.direction).toBe("DOWN");
    expect(normalizeMetric("SPEED_MEDIAN_DAYS", def!.normMin)).toBe(1);
    expect(normalizeMetric("SPEED_MEDIAN_DAYS", def!.normMax)).toBe(0);
  });

  it("значения за границами шкалы обрезаются", () => {
    expect(normalizeMetric("DATA_AUTO_SHARE", 150)).toBe(1);
    expect(normalizeMetric("DATA_AUTO_SHARE", -20)).toBe(0);
  });

  it("неизвестная метрика не нормируется", () => {
    expect(normalizeMetric("NO_SUCH_METRIC", 10)).toBeNull();
  });
});

describe("Индекс зрелости процесса", () => {
  it("возвращает null при отсутствии пригодных измерений", () => {
    expect(computeMaturity([])).toBeNull();
    expect(
      computeMaturity([{ metricCode: "UNKNOWN", value: 1, sampleSize: 5, measuredAt: at }])
    ).toBeNull();
  });

  it("идеальные значения дают уровень 5 «Адаптивный»", () => {
    const res = computeMaturity([
      { metricCode: "DATA_CRIT_OWNED_SHARE", value: 100, sampleSize: 10, measuredAt: at },
      { metricCode: "JUST_ALT_SHARE", value: 100, sampleSize: 10, measuredAt: at },
      { metricCode: "SPEED_MEDIAN_DAYS", value: 2, sampleSize: 10, measuredAt: at },
    ]);
    expect(res).not.toBeNull();
    expect(res!.index).toBe(5);
    expect(res!.levelNumber).toBe(5);
  });

  it("худшие значения дают уровень 1 «Фрагментарный»", () => {
    const res = computeMaturity([
      { metricCode: "DATA_CRIT_OWNED_SHARE", value: 0, sampleSize: 8, measuredAt: at },
      { metricCode: "SPEED_MEDIAN_DAYS", value: 45, sampleSize: 8, measuredAt: at },
    ]);
    expect(res!.index).toBe(1);
    expect(res!.levelNumber).toBe(1);
  });

  it("индекс есть среднее нормированных оценок, приведённое к шкале 1–5", () => {
    // одна метрика со значением 50% из диапазона 0..100 → норм. 0.5 → индекс 3
    const res = computeMaturity([
      { metricCode: "DATA_CRIT_OWNED_SHARE", value: 50, sampleSize: 12, measuredAt: at },
    ]);
    expect(res!.index).toBe(3);
    expect(res!.levelNumber).toBe(3);
  });

  it("суммирует размер выборки и определяет период измерений", () => {
    const res = computeMaturity([
      { metricCode: "DATA_AUTO_SHARE", value: 60, sampleSize: 12, measuredAt: new Date("2026-01-31") },
      { metricCode: "JUST_ALT_SHARE", value: 67, sampleSize: 12, measuredAt: new Date("2026-06-30") },
    ]);
    expect(res!.totalSampleSize).toBe(24);
    expect(res!.periodFrom?.toISOString()).toBe(new Date("2026-01-31").toISOString());
    expect(res!.periodTo?.toISOString()).toBe(new Date("2026-06-30").toISOString());
    expect(res!.usedMetrics).toHaveLength(2);
  });

  it("всегда возвращает пометку о характере расчёта", () => {
    const res = computeMaturity([
      { metricCode: "JUST_ALT_SHARE", value: 67, sampleSize: 12, measuredAt: at },
    ]);
    expect(res!.disclaimer).toBe(MATURITY_DISCLAIMER);
    expect(res!.disclaimer).toContain("Не является официальным показателем компании");
  });

  it("игнорирует неизвестные метрики, но считает по остальным", () => {
    const res = computeMaturity([
      { metricCode: "JUST_ALT_SHARE", value: 100, sampleSize: 10, measuredAt: at },
      { metricCode: "NOT_A_METRIC", value: 999, sampleSize: 99, measuredAt: at },
    ]);
    expect(res!.usedMetrics).toHaveLength(1);
    expect(res!.totalSampleSize).toBe(10);
  });
});
