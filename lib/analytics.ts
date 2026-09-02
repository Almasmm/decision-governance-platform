// Серверная аналитика по контуру решений: воронка стадий, сроки подготовки,
// возвраты, доля решений с альтернативами и пост-оценкой, индекс зрелости.
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "./prisma";
import { STAGES, type Stage } from "./domain";
import { computeMaturity, type MaturityResult } from "./maturity";
import { KPI_METRICS } from "./kpi";

export interface FunnelPoint {
  stage: Stage;
  count: number;
}

export interface DashboardStats {
  total: number;
  funnel: FunnelPoint[];
  /** Медианное время от регистрации до готовности аналитического пакета, дней */
  medianPreparationDays: number | null;
  /** Среднее время подготовки, дней */
  avgPreparationDays: number | null;
  preparationSample: number;
  totalReturns: number;
  decisionsWithReturns: number;
  shareWithAlternatives: number;
  shareWithPostEvaluation: number;
  shareAssignmentsWithKpi: number;
  overdueAssignments: number;
  byCriticality: Array<{ level: string; count: number }>;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (lo === undefined || hi === undefined) return null;
  return (lo + hi) / 2;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const decisions = await prisma.decision.findMany({
    include: {
      alternatives: true,
      lessons: true,
      assignments: true,
      blocks: true,
    },
  });

  const prepDays = decisions
    .filter((d) => d.packageReadyAt)
    .map((d) => differenceInCalendarDays(d.packageReadyAt as Date, d.registeredAt))
    .filter((n) => n >= 0);

  const withAlternatives = decisions.filter(
    (d) => d.alternatives.filter((a) => !a.isStatusQuo).length >= 2 && d.alternatives.some((a) => a.isStatusQuo)
  ).length;

  const withPostEval = decisions.filter((d) => d.lessons.length > 0).length;

  const allAssignments = decisions.flatMap((d) => d.assignments);
  const linked = allAssignments.filter((a) => a.linkedKpiId).length;
  const overdue = allAssignments.filter(
    (a) => a.status !== "DONE" && a.dueDate.getTime() < Date.now()
  ).length;

  return {
    total: decisions.length,
    funnel: STAGES.map((stage) => ({
      stage,
      count: decisions.filter((d) => d.stage === stage).length,
    })),
    medianPreparationDays: median(prepDays),
    avgPreparationDays:
      prepDays.length > 0 ? Math.round((prepDays.reduce((s, n) => s + n, 0) / prepDays.length) * 10) / 10 : null,
    preparationSample: prepDays.length,
    totalReturns: decisions.reduce((s, d) => s + d.returnCount, 0),
    decisionsWithReturns: decisions.filter((d) => d.returnCount > 0).length,
    shareWithAlternatives:
      decisions.length > 0 ? Math.round((withAlternatives / decisions.length) * 100) : 0,
    shareWithPostEvaluation:
      decisions.length > 0 ? Math.round((withPostEval / decisions.length) * 100) : 0,
    shareAssignmentsWithKpi:
      allAssignments.length > 0 ? Math.round((linked / allAssignments.length) * 100) : 0,
    overdueAssignments: overdue,
    byCriticality: ["A", "B", "C"].map((level) => ({
      level,
      count: decisions.filter((d) => d.criticality === level).length,
    })),
  };
}

export interface KpiComparison {
  metricCode: string;
  name: string;
  group: string;
  unit: string;
  direction: "UP" | "DOWN";
  baseline: { value: number; sampleSize: number; period: string | null } | null;
  pilot: { value: number; sampleSize: number; period: string | null } | null;
  /** Улучшение в процентных единицах относительно базовой выборки */
  changePercent: number | null;
  improved: boolean | null;
}

export async function getKpiComparison(): Promise<KpiComparison[]> {
  const measurements = await prisma.kpiMeasurement.findMany({ orderBy: { measuredAt: "desc" } });

  return KPI_METRICS.map((def) => {
    const base = measurements.find((m) => m.metricCode === def.code && m.phase === "BASELINE");
    const pilot = measurements.find((m) => m.metricCode === def.code && m.phase === "PILOT");
    let change: number | null = null;
    let improved: boolean | null = null;
    if (base && pilot && base.value !== 0) {
      change = Math.round(((pilot.value - base.value) / Math.abs(base.value)) * 1000) / 10;
      improved = def.direction === "UP" ? pilot.value > base.value : pilot.value < base.value;
    }
    return {
      metricCode: def.code,
      name: def.name,
      group: def.group,
      unit: def.unit,
      direction: def.direction,
      baseline: base
        ? { value: base.value, sampleSize: base.sampleSize, period: base.periodNote }
        : null,
      pilot: pilot
        ? { value: pilot.value, sampleSize: pilot.sampleSize, period: pilot.periodNote }
        : null,
      changePercent: change,
      improved,
    };
  });
}

export interface MaturityWithContext {
  result: MaturityResult | null;
  phase: "PILOT";
  periodNote: string | null;
}

/** Индекс зрелости считается по пилотной выборке и всегда возвращается с контекстом. */
export async function getMaturityIndex(): Promise<MaturityWithContext> {
  const pilot = await prisma.kpiMeasurement.findMany({ where: { phase: "PILOT" } });
  const result = computeMaturity(
    pilot.map((m) => ({
      metricCode: m.metricCode,
      value: m.value,
      sampleSize: m.sampleSize,
      measuredAt: m.measuredAt,
    }))
  );
  return { result, phase: "PILOT", periodNote: pilot[0]?.periodNote ?? null };
}

/** Индекс зрелости по базовой выборке — для сравнения «до/после». */
export async function getBaselineMaturity(): Promise<MaturityResult | null> {
  const base = await prisma.kpiMeasurement.findMany({ where: { phase: "BASELINE" } });
  return computeMaturity(
    base.map((m) => ({
      metricCode: m.metricCode,
      value: m.value,
      sampleSize: m.sampleSize,
      measuredAt: m.measuredAt,
    }))
  );
}
