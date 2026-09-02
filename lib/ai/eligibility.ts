// Ограничения доступности ступеней ИИ («сначала данные и процесс — затем интеллект»):
// Ступень 2 — только если у всех привязанных показателей заполнены источник и владелец.
// Ступень 3 — только если есть зарегистрированная и валидированная модель,
// допущенная для уровня критичности решения.
import type { AiTier, Criticality } from "../domain";
import { parseJson } from "../domain";

export interface TierEligibility {
  tier: AiTier;
  allowed: boolean;
  reason: string;
}

export interface EligibilityInput {
  criticality: Criticality;
  indicators: Array<{ code: string; ownerId: string | null; sourceSystem: string | null }>;
  models: Array<{ id: string; name: string; validatedAt: Date | null; allowedForLevels: string }>;
}

export function checkTierEligibility(input: EligibilityInput): TierEligibility[] {
  const result: TierEligibility[] = [
    {
      tier: "INFORMATIONAL",
      allowed: true,
      reason: "Информационная ступень доступна всегда: работает только с содержимым паспорта.",
    },
  ];

  const badIndicators = input.indicators.filter((i) => !i.ownerId || !i.sourceSystem);
  if (input.indicators.length === 0) {
    result.push({
      tier: "ANALYTICAL",
      allowed: false,
      reason: "К решению не привязаны показатели — аналитической ступени не с чем работать.",
    });
  } else if (badIndicators.length > 0) {
    result.push({
      tier: "ANALYTICAL",
      allowed: false,
      reason: `У показателей не заполнены источник или владелец: ${badIndicators.map((i) => i.code).join(", ")}. Принцип «сначала данные — затем интеллект».`,
    });
  } else {
    result.push({
      tier: "ANALYTICAL",
      allowed: true,
      reason: "Все привязанные показатели имеют источник и владельца.",
    });
  }

  const validModels = input.models.filter((m) => {
    if (!m.validatedAt) return false;
    const levels = parseJson<string[]>(m.allowedForLevels, []);
    return levels.includes(input.criticality);
  });
  if (validModels.length === 0) {
    result.push({
      tier: "RECOMMENDATIONAL",
      allowed: false,
      reason: `Нет валидированной модели, допущенной для уровня ${input.criticality}. Зарегистрируйте и валидируйте модель в реестре.`,
    });
  } else {
    result.push({
      tier: "RECOMMENDATIONAL",
      allowed: true,
      reason: `Доступна валидированная модель: ${validModels.map((m) => m.name).join(", ")}.`,
    });
  }

  return result;
}
