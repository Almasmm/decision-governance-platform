import { describe, it, expect } from "vitest";
import {
  GATE_RULES,
  DEFAULT_GATE_CONFIG,
  evaluateGate,
  type GateSnapshot,
} from "@/lib/gates";
import { CRITERIA_KEYS, type Criticality } from "@/lib/domain";

const fullScores = Object.fromEntries(CRITERIA_KEYS.map((k) => [k, 7])) as Record<string, number>;

function snapshot(overrides: Partial<GateSnapshot> = {}): GateSnapshot {
  return {
    criticality: "A",
    goal: "Увеличить производственную мощность на 800 т к 2029 году без ухудшения HSE",
    type: "INVESTMENT",
    decisionBodyId: "body-1",
    motivation: "Выбран поэтапный вариант: приемлемый профиль риска при достижении цели",
    alternatives: [
      { name: "Статус-кво", isStatusQuo: true, description: "Бездействие", criteriaScores: { ...fullScores }, selected: false },
      { name: "Поэтапное расширение", isStatusQuo: false, description: "Две очереди", criteriaScores: { ...fullScores, safety: 8 }, selected: true },
      { name: "Ускоренное расширение", isStatusQuo: false, description: "EPC-подрядчик", criteriaScores: { ...fullScores, economics: 9 }, selected: false },
    ],
    risks: [
      { name: "Падение цены урана", residualProbability: 0.12, residualImpact: 9e9, ownerId: "risk-1" },
    ],
    assumptions: [{ text: "Цена U3O8 не ниже 70 USD/фунт", validUntil: new Date("2027-06-30") }],
    assignments: [{ text: "Подготовить заявку на лицензию", linkedKpiId: "kpi-1" }],
    indicators: [
      {
        code: "URN-PROD", name: "Объём добычи", isCritical: true, ownerId: "u-1",
        ownerName: "Ержан Смагулов", sourceSystem: "SAP", confirmed: true,
      },
    ],
    calculations: [
      { kind: "AUTOMATION", calculatedById: "analyst-1", reviews: [{ reviewerId: "analyst-2", verdict: "CONFIRMED" }] },
    ],
    postEvaluationCompleteness: 100,
    ...overrides,
  };
}

describe("Правило: заполнены цель, тип, орган принятия", () => {
  it("проходит при заполненных полях", () => {
    expect(GATE_RULES.GOAL_TYPE_BODY(snapshot()).passed).toBe(true);
  });

  it("не проходит при слишком короткой цели и называет, чего не хватает", () => {
    const r = GATE_RULES.GOAL_TYPE_BODY(snapshot({ goal: "рост" }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("цель решения");
    expect(r.responsible).toBe("Инициатор");
  });

  it("не проходит без органа принятия", () => {
    const r = GATE_RULES.GOAL_TYPE_BODY(snapshot({ decisionBodyId: null }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("орган принятия");
  });
});

describe("Правило: у критических показателей есть владелец и источник", () => {
  it("проходит, когда владелец и источник заданы", () => {
    expect(GATE_RULES.CRITICAL_INDICATORS_SOURCED(snapshot()).passed).toBe(true);
  });

  it("не проходит, если показатели вовсе не привязаны", () => {
    const r = GATE_RULES.CRITICAL_INDICATORS_SOURCED(snapshot({ indicators: [] }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("ни один критический показатель");
  });

  it("называет конкретный показатель без владельца", () => {
    const r = GATE_RULES.CRITICAL_INDICATORS_SOURCED(
      snapshot({
        indicators: [
          { code: "COST-C1", name: "Себестоимость", isCritical: true, ownerId: null, ownerName: null, sourceSystem: "SAP", confirmed: false },
        ],
      })
    );
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("COST-C1");
  });
});

describe("Правило: владельцы данных подтвердили качество", () => {
  it("не проходит, пока подтверждение не получено, и называет владельца", () => {
    const r = GATE_RULES.DATA_OWNERS_CONFIRMED(
      snapshot({
        indicators: [
          { code: "URN-PROD", name: "Добыча", isCritical: true, ownerId: "u-1", ownerName: "Ержан Смагулов", sourceSystem: "SAP", confirmed: false },
        ],
      })
    );
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("Ержан Смагулов");
    expect(r.responsible).toBe("Владельцы данных");
  });

  it("проходит после подтверждения", () => {
    expect(GATE_RULES.DATA_OWNERS_CONFIRMED(snapshot()).passed).toBe(true);
  });
});

describe("Правило: ≥ 2 различающихся альтернативы + статус-кво", () => {
  it("проходит при двух содержательных вариантах и статус-кво", () => {
    expect(GATE_RULES.ALTERNATIVES_MIN(snapshot()).passed).toBe(true);
  });

  it("не проходит без варианта «статус-кво»", () => {
    const alts = snapshot().alternatives.filter((a) => !a.isStatusQuo);
    const r = GATE_RULES.ALTERNATIVES_MIN(snapshot({ alternatives: alts }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("статус-кво");
  });

  it("не проходит при единственной содержательной альтернативе", () => {
    const base = snapshot();
    const alts = [base.alternatives[0]!, base.alternatives[1]!];
    const r = GATE_RULES.ALTERNATIVES_MIN(snapshot({ alternatives: alts }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("требуется не менее 2");
  });

  it("не проходит, если альтернативы неотличимы друг от друга", () => {
    const clone = { name: "Вариант", isStatusQuo: false, description: "то же самое", criteriaScores: { ...fullScores }, selected: false };
    const r = GATE_RULES.ALTERNATIVES_MIN(
      snapshot({
        alternatives: [
          { name: "Статус-кво", isStatusQuo: true, description: "Бездействие", criteriaScores: { ...fullScores }, selected: false },
          clone,
          { ...clone },
        ],
      })
    );
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("не различаются содержательно");
  });
});

describe("Правило: единый набор критериев", () => {
  it("проходит, когда все альтернативы оценены по всем 8 критериям", () => {
    expect(GATE_RULES.UNIFORM_CRITERIA(snapshot()).passed).toBe(true);
  });

  it("не проходит, если у альтернативы нет части оценок", () => {
    const base = snapshot();
    const partial = { ...base.alternatives[1]!, name: "Неполный вариант", criteriaScores: { safety: 5 } };
    const r = GATE_RULES.UNIFORM_CRITERIA(snapshot({ alternatives: [base.alternatives[0]!, partial] }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("Неполный вариант");
  });
});

describe("Правило: риск-профиль с остаточным риском и владельцем", () => {
  it("не проходит при пустом профиле", () => {
    const r = GATE_RULES.RISK_PROFILE(snapshot({ risks: [] }));
    expect(r.passed).toBe(false);
    expect(r.responsible).toBe("Риск-офицер");
  });

  it("не проходит без остаточной оценки", () => {
    const r = GATE_RULES.RISK_PROFILE(
      snapshot({ risks: [{ name: "Дефицит кислоты", residualProbability: null, residualImpact: null, ownerId: "r-1" }] })
    );
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("Дефицит кислоты");
  });

  it("не проходит без владельца риска", () => {
    const r = GATE_RULES.RISK_PROFILE(
      snapshot({ risks: [{ name: "Киберинцидент", residualProbability: 0.05, residualImpact: 1e9, ownerId: null }] })
    );
    expect(r.passed).toBe(false);
  });
});

describe("Правило: ключевые допущения с датой действия (уровень A)", () => {
  it("не проходит без допущений", () => {
    const r = GATE_RULES.ASSUMPTIONS_FIXED(snapshot({ assumptions: [] }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("уровня A");
  });

  it("не проходит без даты действия", () => {
    const r = GATE_RULES.ASSUMPTIONS_FIXED(snapshot({ assumptions: [{ text: "Курс USD/KZT", validUntil: null }] }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("Без даты действия");
  });
});

describe("Правило: независимая проверка критических расчётов", () => {
  it("проходит при подтверждении вторым пользователем", () => {
    expect(GATE_RULES.INDEPENDENT_REVIEW(snapshot()).passed).toBe(true);
  });

  it("не проходит, если расчёт подтвердил его же автор", () => {
    const r = GATE_RULES.INDEPENDENT_REVIEW(
      snapshot({
        calculations: [
          { kind: "RISK", calculatedById: "analyst-1", reviews: [{ reviewerId: "analyst-1", verdict: "CONFIRMED" }] },
        ],
      })
    );
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("не может совпадать с автором");
  });

  it("не проходит без расчётов вовсе", () => {
    expect(GATE_RULES.INDEPENDENT_REVIEW(snapshot({ calculations: [] })).passed).toBe(false);
  });

  it("не проходит при отклонённой проверке", () => {
    const r = GATE_RULES.INDEPENDENT_REVIEW(
      snapshot({
        calculations: [
          { kind: "NPV", calculatedById: "a-1", reviews: [{ reviewerId: "a-2", verdict: "REJECTED" }] },
        ],
      })
    );
    expect(r.passed).toBe(false);
  });
});

describe("Правило: решение оформлено человеком", () => {
  it("не проходит без выбранной альтернативы", () => {
    const alts = snapshot().alternatives.map((a) => ({ ...a, selected: false }));
    const r = GATE_RULES.DECISION_RECORDED(snapshot({ alternatives: alts }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("не выбрана альтернатива");
  });

  it("не проходит без мотивировки", () => {
    const r = GATE_RULES.DECISION_RECORDED(snapshot({ motivation: null }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("мотивировка");
  });
});

describe("Правило: поручения связаны с KPI результата", () => {
  it("не проходит без поручений", () => {
    expect(GATE_RULES.ASSIGNMENTS_KPI(snapshot({ assignments: [] })).passed).toBe(false);
  });

  it("не проходит, если поручение не связано с KPI", () => {
    const r = GATE_RULES.ASSIGNMENTS_KPI(
      snapshot({ assignments: [{ text: "Провести совещание", linkedKpiId: null }] })
    );
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("Провести совещание");
  });
});

describe("Правило: пост-оценка обязательна", () => {
  it("не проходит при незаполненной пост-оценке", () => {
    const r = GATE_RULES.POST_EVALUATION_REQUIRED(snapshot({ postEvaluationCompleteness: 50 }));
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("50%");
  });

  it("проходит при полной пост-оценке", () => {
    expect(GATE_RULES.POST_EVALUATION_REQUIRED(snapshot()).passed).toBe(true);
  });
});

describe("Применимость правил по уровням критичности", () => {
  const rulesFor = (criticality: Criticality, from: string, to: string): string[] =>
    DEFAULT_GATE_CONFIG.filter(
      (c) => c.criticality === criticality && c.fromStage === from && c.toStage === to
    ).map((c) => c.rule);

  it("для уровня C действует только проверка цели, типа и органа", () => {
    expect(rulesFor("C", "PROBLEM", "DATA")).toEqual(["GOAL_TYPE_BODY"]);
    expect(rulesFor("C", "DATA", "ALTERNATIVES")).toEqual([]);
    expect(rulesFor("C", "ALTERNATIVES", "RISKS")).toEqual([]);
    expect(rulesFor("C", "RISKS", "DECISION")).toEqual([]);
    expect(rulesFor("C", "EXECUTION", "FEEDBACK")).toEqual([]);
  });

  it("для уровня B добавляются данные, альтернативы, риски, поручения и пост-оценка", () => {
    expect(rulesFor("B", "DATA", "ALTERNATIVES")).toEqual([
      "CRITICAL_INDICATORS_SOURCED",
      "DATA_OWNERS_CONFIRMED",
    ]);
    expect(rulesFor("B", "ALTERNATIVES", "RISKS")).toEqual(["ALTERNATIVES_MIN", "UNIFORM_CRITERIA"]);
    expect(rulesFor("B", "RISKS", "DECISION")).toEqual(["RISK_PROFILE"]);
    expect(rulesFor("B", "DECISION", "EXECUTION")).toEqual(["DECISION_RECORDED", "ASSIGNMENTS_KPI"]);
    expect(rulesFor("B", "EXECUTION", "FEEDBACK")).toEqual(["POST_EVALUATION_REQUIRED"]);
  });

  it("уровень A дополнительно требует допущений и независимой проверки", () => {
    const aRules = rulesFor("A", "RISKS", "DECISION");
    expect(aRules).toContain("ASSUMPTIONS_FIXED");
    expect(aRules).toContain("INDEPENDENT_REVIEW");
    expect(rulesFor("B", "RISKS", "DECISION")).not.toContain("ASSUMPTIONS_FIXED");
    expect(rulesFor("B", "RISKS", "DECISION")).not.toContain("INDEPENDENT_REVIEW");
  });
});

describe("evaluateGate", () => {
  it("разрешает переход при полной доказательной базе уровня A", () => {
    const ev = evaluateGate(snapshot(), "RISKS", "DECISION");
    expect(ev.allowed).toBe(true);
    expect(ev.results.every((r) => r.passed)).toBe(true);
  });

  it("блокирует переход и объясняет каждое невыполненное правило", () => {
    const ev = evaluateGate(snapshot({ risks: [], assumptions: [] }), "RISKS", "DECISION");
    expect(ev.allowed).toBe(false);
    const failed = ev.results.filter((r) => !r.passed);
    expect(failed.length).toBeGreaterThanOrEqual(2);
    for (const f of failed) {
      expect(f.explanation.length).toBeGreaterThan(10);
      expect(f.responsible.length).toBeGreaterThan(0);
    }
  });

  it("для уровня C переход с данных на альтернативы не блокируется", () => {
    const ev = evaluateGate(
      snapshot({ criticality: "C", indicators: [], alternatives: [] }),
      "DATA",
      "ALTERNATIVES"
    );
    expect(ev.allowed).toBe(true);
    expect(ev.results).toHaveLength(0);
  });

  it("для уровня A тот же переход блокируется без подтверждённых данных", () => {
    const ev = evaluateGate(snapshot({ indicators: [] }), "DATA", "ALTERNATIVES");
    expect(ev.allowed).toBe(false);
  });

  it("неблокирующее правило не запрещает переход", () => {
    const ev = evaluateGate(snapshot({ risks: [] }), "RISKS", "DECISION", [
      { fromStage: "RISKS", toStage: "DECISION", criticality: "A", rule: "RISK_PROFILE", isBlocking: false },
    ]);
    expect(ev.allowed).toBe(true);
    expect(ev.results[0]?.passed).toBe(false);
  });

  it("не падает на неизвестном коде правила из конфигурации", () => {
    const ev = evaluateGate(snapshot(), "PROBLEM", "DATA", [
      { fromStage: "PROBLEM", toStage: "DATA", criticality: "A", rule: "FUTURE_RULE", isBlocking: true },
    ]);
    expect(ev.allowed).toBe(true);
    expect(ev.results[0]?.explanation).toContain("не реализовано");
  });
});
