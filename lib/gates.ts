// Движок контрольных ворот (decision gates) — ядро продукта.
// Ворота НЕ принимают решение: они проверяют полноту доказательной базы
// и объясняют, чего не хватает и кто это должен заполнить.
//
// Чистые функции над снимком решения (GateSnapshot) — тестируются без БД.
// Таблица GateCheck в БД задаёт применимость правил (переход × критичность),
// сами проверки — здесь, по кодам правил.

import type { Criticality, Stage } from "./domain";
import { CRITERIA_KEYS } from "./domain";

export interface GateSnapshot {
  criticality: Criticality;
  goal: string | null;
  type: string | null;
  decisionBodyId: string | null;
  motivation: string | null;
  alternatives: Array<{
    name: string;
    isStatusQuo: boolean;
    description: string;
    criteriaScores: Record<string, number>;
    selected: boolean;
  }>;
  risks: Array<{
    name: string;
    residualProbability: number | null;
    residualImpact: number | null;
    ownerId: string | null;
  }>;
  assumptions: Array<{ text: string; validUntil: Date | null }>;
  assignments: Array<{ text: string; linkedKpiId: string | null }>;
  /** Показатели, привязанные к решению */
  indicators: Array<{
    code: string;
    name: string;
    isCritical: boolean;
    ownerId: string | null;
    ownerName: string | null;
    sourceSystem: string | null;
    confirmed: boolean;
  }>;
  calculations: Array<{
    kind: string;
    calculatedById: string;
    reviews: Array<{ reviewerId: string; verdict: string }>;
  }>;
  /** Полнота блока пост-оценки, 0–100 */
  postEvaluationCompleteness: number;
}

export interface GateRuleResult {
  code: string;
  passed: boolean;
  /** Точное объяснение, чего не хватает */
  explanation: string;
  /** Кто должен это заполнить */
  responsible: string;
}

export type GateRuleFn = (s: GateSnapshot) => GateRuleResult;

export const GATE_RULE_CODES = [
  "GOAL_TYPE_BODY",
  "CRITICAL_INDICATORS_SOURCED",
  "DATA_OWNERS_CONFIRMED",
  "ALTERNATIVES_MIN",
  "UNIFORM_CRITERIA",
  "RISK_PROFILE",
  "ASSUMPTIONS_FIXED",
  "INDEPENDENT_REVIEW",
  "DECISION_RECORDED",
  "ASSIGNMENTS_KPI",
  "POST_EVALUATION_REQUIRED",
] as const;
export type GateRuleCode = (typeof GATE_RULE_CODES)[number];

const ok = (code: GateRuleCode, explanation: string, responsible: string): GateRuleResult => ({
  code,
  passed: true,
  explanation,
  responsible,
});
const fail = (code: GateRuleCode, explanation: string, responsible: string): GateRuleResult => ({
  code,
  passed: false,
  explanation,
  responsible,
});

export const GATE_RULES: Record<GateRuleCode, GateRuleFn> = {
  GOAL_TYPE_BODY: (s) => {
    const missing: string[] = [];
    if (!s.goal || s.goal.trim().length < 10) missing.push("цель решения (не менее 10 символов)");
    if (!s.type) missing.push("тип решения");
    if (!s.decisionBodyId) missing.push("орган принятия решения");
    if (missing.length > 0)
      return fail("GOAL_TYPE_BODY", `Не заполнено: ${missing.join(", ")}.`, "Инициатор");
    return ok("GOAL_TYPE_BODY", "Цель, тип и орган принятия заполнены.", "Инициатор");
  },

  CRITICAL_INDICATORS_SOURCED: (s) => {
    const critical = s.indicators.filter((i) => i.isCritical);
    if (critical.length === 0)
      return fail(
        "CRITICAL_INDICATORS_SOURCED",
        "К решению не привязан ни один критический показатель из каталога.",
        "Инициатор / Аналитик"
      );
    const bad = critical.filter((i) => !i.ownerId || !i.sourceSystem);
    if (bad.length > 0)
      return fail(
        "CRITICAL_INDICATORS_SOURCED",
        `Без владельца или источника: ${bad.map((i) => `${i.code} «${i.name}»`).join("; ")}.`,
        "Аналитик (каталог показателей)"
      );
    return ok(
      "CRITICAL_INDICATORS_SOURCED",
      `Все критические показатели (${critical.length}) имеют владельца и источник.`,
      "Аналитик"
    );
  },

  DATA_OWNERS_CONFIRMED: (s) => {
    const critical = s.indicators.filter((i) => i.isCritical);
    if (critical.length === 0)
      return fail(
        "DATA_OWNERS_CONFIRMED",
        "Нет критических показателей — подтверждать нечего; сначала привяжите показатели.",
        "Инициатор / Аналитик"
      );
    const unconfirmed = critical.filter((i) => !i.confirmed);
    if (unconfirmed.length > 0)
      return fail(
        "DATA_OWNERS_CONFIRMED",
        `Качество не подтверждено владельцами: ${unconfirmed
          .map((i) => `${i.code} (владелец: ${i.ownerName ?? "не назначен"})`)
          .join("; ")}.`,
        "Владельцы данных"
      );
    return ok("DATA_OWNERS_CONFIRMED", "Владельцы данных подтвердили качество всех критических показателей.", "Владельцы данных");
  },

  ALTERNATIVES_MIN: (s) => {
    const statusQuo = s.alternatives.filter((a) => a.isStatusQuo);
    const substantive = s.alternatives.filter((a) => !a.isStatusQuo);
    // «содержательно различающиеся» — различаются по названию и хотя бы одному критерию или описанию
    const distinct = new Set(
      substantive.map((a) => `${a.name.trim().toLowerCase()}|${JSON.stringify(a.criteriaScores)}`)
    );
    const problems: string[] = [];
    if (statusQuo.length === 0) problems.push("отсутствует вариант «статус-кво»");
    if (substantive.length < 2)
      problems.push(`содержательных альтернатив: ${substantive.length}, требуется не менее 2`);
    else if (distinct.size < 2) problems.push("альтернативы не различаются содержательно (совпадают названия и оценки)");
    if (problems.length > 0)
      return fail("ALTERNATIVES_MIN", `Недостаточно альтернатив: ${problems.join("; ")}.`, "Инициатор / Аналитик");
    return ok(
      "ALTERNATIVES_MIN",
      `Представлено ${substantive.length} содержательных альтернатив и вариант «статус-кво».`,
      "Инициатор"
    );
  },

  UNIFORM_CRITERIA: (s) => {
    if (s.alternatives.length === 0)
      return fail("UNIFORM_CRITERIA", "Альтернативы не добавлены — сравнивать нечего.", "Инициатор");
    const incomplete = s.alternatives.filter((a) =>
      CRITERIA_KEYS.some((k) => typeof a.criteriaScores[k] !== "number")
    );
    if (incomplete.length > 0)
      return fail(
        "UNIFORM_CRITERIA",
        `Не по всем критериям оценены альтернативы: ${incomplete.map((a) => `«${a.name}»`).join(", ")}. Единый набор: ${CRITERIA_KEYS.length} критериев.`,
        "Инициатор / Аналитик"
      );
    return ok("UNIFORM_CRITERIA", "Все альтернативы оценены по единому набору критериев.", "Аналитик");
  },

  RISK_PROFILE: (s) => {
    if (s.risks.length === 0)
      return fail("RISK_PROFILE", "Риск-профиль пуст: не описан ни один риск.", "Риск-офицер");
    const bad = s.risks.filter(
      (r) => r.residualProbability === null || r.residualImpact === null || !r.ownerId
    );
    if (bad.length > 0)
      return fail(
        "RISK_PROFILE",
        `Без остаточного риска или владельца: ${bad.map((r) => `«${r.name}»`).join(", ")}.`,
        "Риск-офицер"
      );
    return ok("RISK_PROFILE", `Риск-профиль заполнен: ${s.risks.length} рисков с остаточной оценкой и владельцами.`, "Риск-офицер");
  },

  ASSUMPTIONS_FIXED: (s) => {
    if (s.assumptions.length === 0)
      return fail(
        "ASSUMPTIONS_FIXED",
        "Для уровня A обязательны ключевые допущения — не зафиксировано ни одного.",
        "Инициатор / Аналитик"
      );
    const noDate = s.assumptions.filter((a) => !a.validUntil);
    if (noDate.length > 0)
      return fail(
        "ASSUMPTIONS_FIXED",
        `Без даты действия: ${noDate.map((a) => `«${a.text.slice(0, 60)}»`).join("; ")}.`,
        "Инициатор"
      );
    return ok("ASSUMPTIONS_FIXED", `Зафиксировано ${s.assumptions.length} допущений с датами действия.`, "Инициатор");
  },

  INDEPENDENT_REVIEW: (s) => {
    if (s.calculations.length === 0)
      return fail(
        "INDEPENDENT_REVIEW",
        "Критические расчёты отсутствуют — для уровня A требуется хотя бы один расчёт эффекта с независимой проверкой.",
        "Аналитик"
      );
    const unreviewed = s.calculations.filter(
      (c) =>
        !c.reviews.some((r) => r.verdict === "CONFIRMED" && r.reviewerId !== c.calculatedById)
    );
    if (unreviewed.length > 0)
      return fail(
        "INDEPENDENT_REVIEW",
        `Расчёты без подтверждения вторым пользователем: ${unreviewed.map((c) => c.kind).join(", ")}. Проверяющий не может совпадать с автором расчёта.`,
        "Второй аналитик / Риск-офицер"
      );
    return ok("INDEPENDENT_REVIEW", "Все критические расчёты независимо подтверждены вторым пользователем.", "Аналитик");
  },

  DECISION_RECORDED: (s) => {
    const selected = s.alternatives.filter((a) => a.selected);
    const problems: string[] = [];
    if (selected.length === 0) problems.push("не выбрана альтернатива");
    if (!s.motivation || s.motivation.trim().length < 10)
      problems.push("не зафиксирована мотивировка решения");
    if (problems.length > 0)
      return fail("DECISION_RECORDED", `Решение не оформлено: ${problems.join("; ")}.`, "Орган принятия решения");
    return ok("DECISION_RECORDED", "Выбранная альтернатива и мотивировка зафиксированы.", "Орган принятия решения");
  },

  ASSIGNMENTS_KPI: (s) => {
    if (s.assignments.length === 0)
      return fail("ASSIGNMENTS_KPI", "Не создано ни одного поручения по исполнению решения.", "Корпоративный секретарь / Инициатор");
    const unlinked = s.assignments.filter((a) => !a.linkedKpiId);
    if (unlinked.length > 0)
      return fail(
        "ASSIGNMENTS_KPI",
        `Поручения без связи с KPI результата: ${unlinked.map((a) => `«${a.text.slice(0, 50)}»`).join("; ")}.`,
        "Корпоративный секретарь"
      );
    return ok("ASSIGNMENTS_KPI", `Все поручения (${s.assignments.length}) связаны с KPI результата.`, "Корпоративный секретарь");
  },

  POST_EVALUATION_REQUIRED: (s) => {
    if (s.postEvaluationCompleteness < 100)
      return fail(
        "POST_EVALUATION_REQUIRED",
        `Пост-оценка заполнена на ${s.postEvaluationCompleteness}% — требуется план/факт и извлечённый урок.`,
        "Инициатор / Аналитик"
      );
    return ok("POST_EVALUATION_REQUIRED", "Пост-оценка заполнена: план/факт сопоставлены, урок зафиксирован.", "Инициатор");
  },
};

/** Конфигурация по умолчанию: переход × критичность × правило (сидится в таблицу GateCheck). */
export interface GateConfigEntry {
  fromStage: Stage;
  toStage: Stage;
  criticality: Criticality;
  rule: GateRuleCode;
  description: string;
  isBlocking: boolean;
}

const RULE_DESCRIPTIONS: Record<GateRuleCode, string> = {
  GOAL_TYPE_BODY: "Заполнены цель, тип, орган принятия",
  CRITICAL_INDICATORS_SOURCED: "У всех критических показателей назначен владелец и указан источник",
  DATA_OWNERS_CONFIRMED: "Владельцы данных подтвердили качество показателей",
  ALTERNATIVES_MIN: "≥ 2 содержательно различающихся альтернативы + вариант «статус-кво»",
  UNIFORM_CRITERIA: "Единый набор критериев сравнения по всем альтернативам",
  RISK_PROFILE: "Заполнен риск-профиль с остаточным риском и владельцем риска",
  ASSUMPTIONS_FIXED: "Зафиксированы ключевые допущения с датой действия",
  INDEPENDENT_REVIEW: "Независимая проверка критических расчётов (второй пользователь)",
  DECISION_RECORDED: "Выбор альтернативы и мотивировка зафиксированы",
  ASSIGNMENTS_KPI: "Каждое поручение связано с KPI результата",
  POST_EVALUATION_REQUIRED: "Пост-оценка обязательна",
};

export function ruleDescription(code: string): string {
  return (RULE_DESCRIPTIONS as Record<string, string>)[code] ?? code;
}

function entries(
  fromStage: Stage,
  toStage: Stage,
  rule: GateRuleCode,
  levels: Criticality[]
): GateConfigEntry[] {
  return levels.map((criticality) => ({
    fromStage,
    toStage,
    criticality,
    rule,
    description: RULE_DESCRIPTIONS[rule],
    isBlocking: true,
  }));
}

export const DEFAULT_GATE_CONFIG: GateConfigEntry[] = [
  ...entries("PROBLEM", "DATA", "GOAL_TYPE_BODY", ["A", "B", "C"]),
  ...entries("DATA", "ALTERNATIVES", "CRITICAL_INDICATORS_SOURCED", ["A", "B"]),
  ...entries("DATA", "ALTERNATIVES", "DATA_OWNERS_CONFIRMED", ["A", "B"]),
  ...entries("ALTERNATIVES", "RISKS", "ALTERNATIVES_MIN", ["A", "B"]),
  ...entries("ALTERNATIVES", "RISKS", "UNIFORM_CRITERIA", ["A", "B"]),
  ...entries("RISKS", "DECISION", "RISK_PROFILE", ["A", "B"]),
  ...entries("RISKS", "DECISION", "ASSUMPTIONS_FIXED", ["A"]),
  ...entries("RISKS", "DECISION", "INDEPENDENT_REVIEW", ["A"]),
  ...entries("DECISION", "EXECUTION", "DECISION_RECORDED", ["A", "B"]),
  ...entries("DECISION", "EXECUTION", "ASSIGNMENTS_KPI", ["A", "B"]),
  ...entries("EXECUTION", "FEEDBACK", "POST_EVALUATION_REQUIRED", ["A", "B"]),
];

export interface GateEvaluation {
  fromStage: Stage;
  toStage: Stage;
  allowed: boolean;
  results: GateRuleResult[];
}

/**
 * Прогоняет применимые правила для перехода. `config` — активная конфигурация
 * (из таблицы GateCheck); неизвестные коды правил пропускаются как пройденные
 * с пометкой (конфигурация могла быть создана для будущей версии движка).
 */
export function evaluateGate(
  snapshot: GateSnapshot,
  fromStage: Stage,
  toStage: Stage,
  config: Array<{ fromStage: string; toStage: string; criticality: string; rule: string; isBlocking: boolean }> = DEFAULT_GATE_CONFIG
): GateEvaluation {
  const applicable = config.filter(
    (c) =>
      c.fromStage === fromStage && c.toStage === toStage && c.criticality === snapshot.criticality
  );
  const results: GateRuleResult[] = applicable.map((c) => {
    const fn = (GATE_RULES as Record<string, GateRuleFn | undefined>)[c.rule];
    if (!fn)
      return {
        code: c.rule,
        passed: true,
        explanation: "Правило не реализовано в текущей версии движка — пропущено.",
        responsible: "Администратор",
      };
    return fn(snapshot);
  });
  const allowed = results.every((r) => r.passed || !applicable.find((c) => c.rule === r.code)?.isBlocking);
  return { fromStage, toStage, allowed, results };
}
