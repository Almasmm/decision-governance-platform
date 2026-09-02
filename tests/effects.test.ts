import { describe, it, expect } from "vitest";
import {
  automationEffect,
  riskEffect,
  npvEffect,
  DEFAULT_ATTRIBUTION_SHARE,
} from "@/lib/effects";

describe("(1) Эффект снижения трудоёмкости Eₜ = (T₀ − T₁) × N × C", () => {
  it("считает эффект при полном наборе параметров", () => {
    const res = automationEffect({ t0: 46, t1: 28, n: 120, c: 9500 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toBe((46 - 28) * 120 * 9500);
    expect(res.details.hoursSavedPerPackage).toBe(18);
    expect(res.details.hoursSavedPerYear).toBe(2160);
  });

  it("не показывает результат и перечисляет недостающие параметры", () => {
    const res = automationEffect({ t0: 46, t1: 28 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.missing).toEqual(["n", "c"]);
  });

  it("считает нулевой параметр заполненным, а не отсутствующим", () => {
    const res = automationEffect({ t0: 10, t1: 0, n: 5, c: 1000 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toBe(50000);
  });

  it("допускает отрицательный эффект, если трудоёмкость выросла", () => {
    const res = automationEffect({ t0: 10, t1: 15, n: 10, c: 1000 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toBe(-50000);
  });

  it("отклоняет NaN как незаполненный параметр", () => {
    const res = automationEffect({ t0: Number.NaN, t1: 1, n: 1, c: 1 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.missing).toContain("t0");
  });
});

describe("(2) Эффект снижения ожидаемого ущерба Eᵣ", () => {
  it("применяет консервативный коэффициент атрибуции 0.5 по умолчанию", () => {
    const res = riskEffect({ p0: 0.3, l0: 8_200_000_000, p1: 0.15, l1: 3_500_000_000 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const gross = 0.3 * 8_200_000_000 - 0.15 * 3_500_000_000;
    expect(res.details.grossEffect).toBeCloseTo(gross, 2);
    expect(res.details.attributionShare).toBe(DEFAULT_ATTRIBUTION_SHARE);
    expect(res.value).toBeCloseTo(gross * 0.5, 2);
  });

  it("использует заданный коэффициент атрибуции", () => {
    const res = riskEffect({ p0: 0.4, l0: 1_000_000, p1: 0.1, l1: 1_000_000, attributionShare: 1 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toBeCloseTo(300_000, 2);
  });

  it("раскрывает ожидаемые потери до и после мер", () => {
    const res = riskEffect({ p0: 0.5, l0: 2_000_000, p1: 0.2, l1: 1_000_000 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.details.expectedLossBefore).toBe(1_000_000);
    expect(res.details.expectedLossAfter).toBe(200_000);
  });

  it("не считает эффект без вероятностей и потерь", () => {
    const res = riskEffect({ p0: 0.3, l0: 1000 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.missing).toEqual(["p1", "l1"]);
  });

  it("коэффициент атрибуции не входит в число обязательных параметров", () => {
    const res = riskEffect({ p0: 0.3, l0: 1000, p1: 0.1, l1: 500, attributionShare: null });
    expect(res.ok).toBe(true);
  });
});

describe("(3) NPV = Σₜ (Eₜ + Eᵣ − TCOₜ) / (1 + r)ᵗ", () => {
  it("дисконтирует денежные потоки по годам", () => {
    const res = npvEffect({
      rate: 0.1,
      years: [
        { et: 100, er: 50, tco: 50 },
        { et: 100, er: 50, tco: 50 },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const expected = 100 / 1.1 + 100 / 1.21;
    expect(res.value).toBeCloseTo(expected, 6);
    expect(res.details.horizonYears).toBe(2);
    expect(res.details.totalTco).toBe(100);
  });

  it("указывает конкретный незаполненный параметр года", () => {
    const res = npvEffect({ rate: 0.12, years: [{ et: 100, er: 50 }] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.missing).toEqual(["years[0].tco"]);
  });

  it("не считает NPV без ставки дисконтирования", () => {
    const res = npvEffect({ years: [{ et: 1, er: 1, tco: 1 }] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.missing).toContain("rate");
  });

  it("не считает NPV без горизонта", () => {
    const res = npvEffect({ rate: 0.1, years: [] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.missing).toContain("years");
  });

  it("даёт отрицательный NPV, когда TCO превышает эффекты", () => {
    const res = npvEffect({ rate: 0.1, years: [{ et: 10, er: 10, tco: 100 }] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toBeLessThan(0);
  });
});
