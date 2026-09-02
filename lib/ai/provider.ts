// ИИ-слой. Три ступени, обязательный вердикт человека, работа без API-ключей.
// MockProvider — детерминированные ответы из фактических данных решения (дефолт).
// ApiProvider — читает AI_API_KEY из env; при отсутствии ключа откатывается на mock.
// НИ ОДИН ответ не применяется автоматически: результат сохраняется как AiSuggestion
// со статусом PENDING и ждёт явного вердикта уполномоченного лица.

import type { AiTier } from "../domain";
import { CRITERIA_KEYS } from "../domain";
import { BLOCK_KINDS } from "../domain";

export interface AiDecisionContext {
  code: string;
  title: string;
  criticality: string;
  goal: string;
  stage: string;
  blocks: Array<{ kind: string; completeness: number }>;
  alternatives: Array<{
    name: string;
    isStatusQuo: boolean;
    criteriaScores: Record<string, number>;
  }>;
  risks: Array<{ name: string; probability: number; impact: number }>;
  indicators: Array<{
    code: string;
    name: string;
    sourceSystem: string | null;
    ownerName: string | null;
    latestValue: number | null;
    crossSourceValue: number | null; // значение того же показателя из альтернативного источника
  }>;
}

export interface AiAnswer {
  tier: AiTier;
  content: string;
  explanation: string;
  sourceRefs: Array<{ ref: string; note: string }>;
}

export interface AiProvider {
  readonly name: string;
  /** Ступень 1: суммаризация, проверка формальной полноты, пропущенные блоки */
  informational(ctx: AiDecisionContext): Promise<AiAnswer>;
  /** Ступень 2: аномалии, сверка показателя между источниками, сравнение сценариев */
  analytical(ctx: AiDecisionContext): Promise<AiAnswer>;
  /** Ступень 3: ранжирование альтернатив с объяснением факторов */
  recommendational(ctx: AiDecisionContext): Promise<AiAnswer>;
}

const CRITERIA_RU: Record<string, string> = {
  safety: "безопасность",
  regulatory: "регуляторика",
  economics: "экономика",
  timeline: "сроки",
  resources: "ресурсы",
  hr: "кадры",
  cyber: "киберриск",
  sustainability: "устойчивость",
};

export class MockProvider implements AiProvider {
  readonly name = "MockProvider (детерминированный, без внешних API)";

  async informational(ctx: AiDecisionContext): Promise<AiAnswer> {
    const missing = BLOCK_KINDS.filter((k) => {
      const b = ctx.blocks.find((x) => x.kind === k);
      return !b || b.completeness < 100;
    });
    const weak = missing.map((k) => {
      const b = ctx.blocks.find((x) => x.kind === k);
      return `${k} (${b?.completeness ?? 0}%)`;
    });
    const content =
      missing.length === 0
        ? `Пакет по решению ${ctx.code} «${ctx.title}» формально полон: все 9 блоков паспорта заполнены.`
        : `По решению ${ctx.code} «${ctx.title}» не полностью заполнены блоки: ${weak.join(", ")}. Цель: ${ctx.goal.slice(0, 160)}. Стадия: ${ctx.stage}. Рекомендуется дозаполнить блоки до вынесения на орган принятия.`;
    return {
      tier: "INFORMATIONAL",
      content,
      explanation:
        "Проверка формальной полноты: сравнение фактической полноты каждого из 9 блоков паспорта со 100%. Ответ построен детерминированно из данных паспорта, без внешних сервисов.",
      sourceRefs: ctx.blocks.map((b) => ({
        ref: `block:${b.kind}`,
        note: `полнота ${b.completeness}%`,
      })),
    };
  }

  async analytical(ctx: AiDecisionContext): Promise<AiAnswer> {
    const findings: string[] = [];
    const refs: Array<{ ref: string; note: string }> = [];

    // Сверка показателей между источниками
    for (const ind of ctx.indicators) {
      if (ind.latestValue !== null && ind.crossSourceValue !== null) {
        const diff = Math.abs(ind.latestValue - ind.crossSourceValue);
        const rel = ind.latestValue !== 0 ? diff / Math.abs(ind.latestValue) : 1;
        if (rel > 0.05) {
          findings.push(
            `Расхождение по показателю ${ind.code} «${ind.name}»: ${ind.latestValue} (${ind.sourceSystem ?? "?"}) против ${ind.crossSourceValue} (альтернативный источник), отклонение ${(rel * 100).toFixed(1)}%.`
          );
          refs.push({ ref: `indicator:${ind.code}`, note: `отклонение ${(rel * 100).toFixed(1)}%` });
        }
      }
    }

    // Аномалии в риск-профиле
    for (const r of ctx.risks) {
      if (r.probability > 0.7) {
        findings.push(
          `Аномально высокая вероятность риска «${r.name}» (${(r.probability * 100).toFixed(0)}%) — проверьте обоснование оценки.`
        );
        refs.push({ ref: `risk:${r.name}`, note: `p=${r.probability}` });
      }
    }

    const content =
      findings.length === 0
        ? "Аномалий и расхождений между источниками не выявлено (порог отклонения 5%)."
        : findings.join("\n");
    return {
      tier: "ANALYTICAL",
      content,
      explanation:
        "Правила: расхождение значений одного показателя между источниками свыше 5% и вероятность риска свыше 0.7 помечаются как аномалии. Пороговые значения фиксированы, расчёт детерминированный.",
      sourceRefs: refs,
    };
  }

  async recommendational(ctx: AiDecisionContext): Promise<AiAnswer> {
    const scored = ctx.alternatives
      .map((a) => {
        const total = CRITERIA_KEYS.reduce((s, k) => s + (a.criteriaScores[k] ?? 0), 0);
        return { ...a, total };
      })
      .sort((x, y) => y.total - x.total);

    if (scored.length === 0) {
      return {
        tier: "RECOMMENDATIONAL",
        content: "Ранжирование невозможно: альтернативы не добавлены.",
        explanation: "Нет входных данных для модели ранжирования.",
        sourceRefs: [],
      };
    }

    const lines = scored.map((a, i) => {
      const strongest = CRITERIA_KEYS.map((k) => ({ k, v: a.criteriaScores[k] ?? 0 }))
        .sort((x, y) => y.v - x.v)
        .slice(0, 2)
        .map((x) => `${CRITERIA_RU[x.k] ?? x.k} (${x.v}/10)`);
      return `${i + 1}. «${a.name}»${a.isStatusQuo ? " [статус-кво]" : ""} — суммарная оценка ${a.total}/${CRITERIA_KEYS.length * 10}; сильные стороны: ${strongest.join(", ")}.`;
    });

    return {
      tier: "RECOMMENDATIONAL",
      content: `Ранжирование альтернатив по сумме равновзвешенных критериев:\n${lines.join("\n")}\n\nЭто рекомендация, а не решение: выбор и ответственность — за уполномоченным лицом.`,
      explanation:
        "Модель: сумма оценок по 8 критериям с равными весами. Ограничение: веса критериев не откалиброваны под тип решения; результат чувствителен к качеству экспертных оценок. Требуется явный вердикт человека.",
      sourceRefs: scored.map((a) => ({ ref: `alternative:${a.name}`, note: `сумма ${a.total}` })),
    };
  }
}

export class ApiProvider implements AiProvider {
  readonly name = "ApiProvider (внешний API с откатом на mock)";
  private fallback = new MockProvider();

  private hasKey(): boolean {
    return Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0);
  }

  async informational(ctx: AiDecisionContext): Promise<AiAnswer> {
    // Внешний вызов не реализован в демо-контуре: при наличии ключа здесь будет
    // обращение к API; сейчас в обоих случаях — детерминированный mock.
    return this.fallback.informational(ctx);
  }
  async analytical(ctx: AiDecisionContext): Promise<AiAnswer> {
    return this.fallback.analytical(ctx);
  }
  async recommendational(ctx: AiDecisionContext): Promise<AiAnswer> {
    return this.fallback.recommendational(ctx);
  }
}

export function getAiProvider(): AiProvider {
  if (process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0) {
    return new ApiProvider();
  }
  return new MockProvider();
}
