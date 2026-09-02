import { ru } from "@/lib/i18n/ru";

type AuditPayload = Record<string, unknown>;

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Decision: "Решение",
  DecisionBlock: "Раздел паспорта",
  DecisionIndicator: "Показатель решения",
  Indicator: "Показатель",
  IndicatorValue: "Значение показателя",
  Alternative: "Альтернатива",
  Assumption: "Допущение",
  Risk: "Риск",
  Assignment: "Поручение",
  EffectCalculation: "Расчёт эффекта",
  CalcReview: "Проверка расчёта",
  AiSuggestion: "Рекомендация ИИ",
  User: "Пользователь",
  GateCheck: "Правило контрольных ворот",
  AiModel: "Модель ИИ",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Создание записи",
  UPDATE_PAYLOAD: "Обновление доказательной базы",
  SUBMIT_FOR_REVIEW: "Передача на экспертизу",
  RETURN: "Возврат решения на доработку",
  DECIDE: "Вердикт уполномоченного органа",
  CLOSE: "Закрытие решения после пост-оценки",
  STAGE_ADVANCE: "Переход на следующую стадию",
  LINK: "Связь с доказательной базой",
  CONFIRM_QUALITY: "Подтверждение качества показателя",
  INDICATOR_CONFIRM: "Подтверждение качества показателей",
  MANUAL_INPUT: "Ручной ввод значения",
  LOAD_FROM_SOURCE: "Загрузка значения из источника",
  COMPLETE: "Исполнение поручения",
  REVIEW: "Независимая проверка расчёта",
  AI_RUN: "Формирование рекомендации ИИ",
  AI_VERDICT: "Человеческий вердикт по рекомендации ИИ",
  UPDATE_ROLE: "Изменение роли пользователя",
  UPDATE_BLOCKING: "Изменение правила контрольных ворот",
  DELETE: "Удаление записи",
};

const VERDICT_LABELS: Record<string, string> = {
  APPROVED: "Утверждено",
  REJECTED: "Отклонено",
  ACCEPTED: "Рекомендация принята",
  MODIFIED: "Принято с изменениями",
  PENDING: "Ожидает решения человека",
  CONFIRMED: "Подтверждено",
};

const AI_TIER_LABELS: Record<string, string> = {
  INFORMATIONAL: "Информационная",
  ANALYTICAL: "Аналитическая",
  RECOMMENDATIONAL: "Рекомендательная",
};

export function parseAuditPayload(value: string | null): AuditPayload | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AuditPayload)
      : { value: parsed };
  } catch {
    return { value };
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stage(value: unknown): string | null {
  const key = text(value);
  if (!key) return null;
  return (ru.stages as Record<string, string>)[key] ?? key;
}

function status(value: unknown): string | null {
  const key = text(value);
  if (!key) return null;
  return (ru.statuses as Record<string, string>)[key] ?? VERDICT_LABELS[key] ?? key;
}

export type AuditEventPresentation = {
  entityLabel: string;
  actionLabel: string;
  headline: string;
  primaryDetail: string | null;
  secondaryDetail: string | null;
  decisionId: string | null;
};

export function presentAuditEvent(input: {
  entity: string;
  entityId: string;
  action: string;
  before: string | null;
  after: string | null;
}): AuditEventPresentation {
  const before = parseAuditPayload(input.before);
  const after = parseAuditPayload(input.after);
  const entityLabel = AUDIT_ENTITY_LABELS[input.entity] ?? input.entity;
  const actionLabel = AUDIT_ACTION_LABELS[input.action] ?? input.action;
  const decisionId =
    text(after?.decisionId) ??
    text(before?.decisionId) ??
    (input.entity === "Decision" ? input.entityId : null);

  if (input.action === "STAGE_ADVANCE") {
    const from = stage(after?.from ?? before?.stage);
    const to = stage(after?.to ?? after?.stage);
    return {
      entityLabel,
      actionLabel,
      headline: "Решение переведено на следующую стадию",
      primaryDetail: from && to ? `${from} → ${to}` : to ? `Новая стадия: ${to}` : null,
      secondaryDetail: "Основание: контрольные ворота подтверждены",
      decisionId,
    };
  }

  if (input.action === "RETURN") {
    return {
      entityLabel,
      actionLabel,
      headline: "Решение возвращено на доработку",
      primaryDetail: text(after?.reason),
      secondaryDetail:
        typeof after?.returnCount === "number"
          ? `Возвратов на доработку: ${after.returnCount}`
          : null,
      decisionId,
    };
  }

  if (input.action === "CONFIRM_QUALITY" || input.action === "INDICATOR_CONFIRM") {
    const indicator = text(after?.indicator);
    const indicators = Array.isArray(after?.indicators)
      ? after.indicators.filter((item): item is string => typeof item === "string").join(", ")
      : null;
    return {
      entityLabel,
      actionLabel,
      headline: "Качество производственных данных подтверждено",
      primaryDetail: indicator ? `Показатель: ${indicator}` : indicators ? `Показатели: ${indicators}` : null,
      secondaryDetail: text(after?.confirmedBy)
        ? `Владелец данных: ${text(after?.confirmedBy)}`
        : "Подтверждение включено в доказательную базу решения",
      decisionId,
    };
  }

  if (input.action === "AI_RUN") {
    const tierKey = text(after?.tier);
    const tierLabel = tierKey ? AI_TIER_LABELS[tierKey] ?? tierKey : null;
    return {
      entityLabel,
      actionLabel,
      headline: "Сформирована аналитическая рекомендация ИИ",
      primaryDetail: text(after?.model)
        ? `Модель: ${text(after?.model)}`
        : tierLabel
          ? `Уровень: ${tierLabel}`
          : null,
      secondaryDetail: "Рекомендация не является решением и требует человеческого вердикта",
      decisionId,
    };
  }

  if (input.action === "AI_VERDICT") {
    const verdict = status(after?.humanVerdict);
    return {
      entityLabel,
      actionLabel,
      headline: "Зафиксирован человеческий вердикт по рекомендации ИИ",
      primaryDetail: verdict,
      secondaryDetail: text(after?.verdictReason)
        ? `Обоснование: ${text(after?.verdictReason)}`
        : null,
      decisionId,
    };
  }

  if (input.action === "DECIDE") {
    return {
      entityLabel,
      actionLabel,
      headline: "Уполномоченный орган зафиксировал решение",
      primaryDetail: status(after?.status ?? after?.verdict),
      secondaryDetail: text(after?.comment) ?? text(after?.reason),
      decisionId,
    };
  }

  if (input.action === "CLOSE") {
    return {
      entityLabel,
      actionLabel,
      headline: "Цикл решения закрыт после обратной связи",
      primaryDetail: after?.postEvaluation === true ? "Пост-оценка зафиксирована" : null,
      secondaryDetail: "Результаты доступны для организационного обучения",
      decisionId,
    };
  }

  if (input.action === "COMPLETE" && input.entity === "Assignment") {
    return {
      entityLabel,
      actionLabel,
      headline: "Поручение отмечено исполненным",
      primaryDetail: status(after?.status),
      secondaryDetail: "Факт исполнения добавлен в контрольный контур",
      decisionId,
    };
  }

  if (input.action === "REVIEW") {
    return {
      entityLabel,
      actionLabel,
      headline: "Завершена независимая проверка расчёта",
      primaryDetail: status(after?.verdict),
      secondaryDetail: text(after?.comment),
      decisionId,
    };
  }

  const code = text(after?.code);
  const name = text(after?.name);
  const detail = code ? `Код: ${code}` : name ? name : status(after?.status);
  return {
    entityLabel,
    actionLabel,
    headline: `${actionLabel}: ${entityLabel.toLocaleLowerCase("ru-RU")}`,
    primaryDetail: detail,
    secondaryDetail: text(after?.reason) ?? text(after?.comment),
    decisionId,
  };
}

export function prettyAuditJson(value: string | null): string {
  if (!value) return "Запись отсутствует";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
