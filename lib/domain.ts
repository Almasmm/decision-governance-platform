// Доменные перечисления и типы. В БД (SQLite) хранятся строки —
// здесь единственный источник допустимых значений + zod-схемы.
import { z } from "zod";

export const ROLES = [
  "INITIATOR",
  "DATA_OWNER",
  "RISK_OFFICER",
  "ANALYST",
  "SECRETARY",
  "BOARD_MEMBER",
  "ADMIN",
] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const DECISION_TYPES = [
  "INVESTMENT",
  "PRODUCTION",
  "PROCUREMENT",
  "HR",
  "RISK",
  "STRATEGY",
  "DIGITAL",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const CRITICALITIES = ["A", "B", "C"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const STAGES = [
  "PROBLEM",
  "DATA",
  "ALTERNATIVES",
  "RISKS",
  "DECISION",
  "EXECUTION",
  "FEEDBACK",
] as const;
export type Stage = (typeof STAGES)[number];

export const STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "RETURNED",
  "APPROVED",
  "REJECTED",
  "IN_EXECUTION",
  "POST_EVALUATION",
  "CLOSED",
] as const;
export type DecisionStatus = (typeof STATUSES)[number];

export const BLOCK_KINDS = [
  "IDENTIFICATION",
  "DATA",
  "ALTERNATIVES",
  "ECONOMICS",
  "SAFETY",
  "RISKS",
  "DECISION",
  "EXECUTION",
  "POST_EVALUATION",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const SOURCE_SYSTEMS = ["SAP", "EKAP", "POWERBI", "DWH", "MANUAL", "EXTERNAL"] as const;
export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

export const KPI_GROUPS = ["SPEED", "DATA", "JUSTIFICATION", "EXECUTION", "LEARNING"] as const;
export type KpiGroup = (typeof KPI_GROUPS)[number];

export const KPI_PHASES = ["BASELINE", "PILOT"] as const;
export type KpiPhase = (typeof KPI_PHASES)[number];

export const EFFECT_KINDS = ["AUTOMATION", "RISK", "NPV"] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

export const AI_TIERS = ["INFORMATIONAL", "ANALYTICAL", "RECOMMENDATIONAL"] as const;
export type AiTier = (typeof AI_TIERS)[number];

export const AI_VERDICTS = ["ACCEPTED", "REJECTED", "MODIFIED", "PENDING"] as const;
export type AiVerdict = (typeof AI_VERDICTS)[number];

export const CAUSE_CATEGORIES = [
  "EXTERNAL",
  "DATA_QUALITY",
  "WRONG_MODEL",
  "EXECUTION",
  "UNFORESEEN_RISK",
] as const;
export type CauseCategory = (typeof CAUSE_CATEGORIES)[number];

export const ASSIGNMENT_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "OVERDUE"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// Единый набор критериев сравнения альтернатив (принципиально одинаковый для всех альтернатив решения)
export const CRITERIA_KEYS = [
  "safety",
  "regulatory",
  "economics",
  "timeline",
  "resources",
  "hr",
  "cyber",
  "sustainability",
] as const;
export type CriterionKey = (typeof CRITERIA_KEYS)[number];

export const criteriaScoresSchema = z.record(z.enum(CRITERIA_KEYS), z.number().min(0).max(10));

export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  if (i < 0 || i === STAGES.length - 1) return null;
  return STAGES[i + 1] ?? null;
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
