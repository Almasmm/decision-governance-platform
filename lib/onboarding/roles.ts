import { ROLES, type Role } from "@/lib/domain";
import type { OnboardingRouteId } from "@/lib/onboarding/types";

export interface OnboardingRoleProfile {
  role: Role;
  label: string;
  purpose: string;
  responsibilities: readonly string[];
  primaryRoutes: readonly OnboardingRouteId[];
  roleTourId: string;
}

export const ONBOARDING_ROLE_PROFILES: Readonly<Record<Role, OnboardingRoleProfile>> = {
  INITIATOR: {
    role: "INITIATOR",
    label: "Инициатор",
    purpose: "Формирует управленческий вопрос и собирает достаточную доказательную базу.",
    responsibilities: [
      "Определить цель, тип и орган принятия решения",
      "Подготовить альтернативы, допущения и измеримые поручения",
      "Устранить причины возврата и провести паспорт по стадиям",
    ],
    primaryRoutes: ["dashboard", "decision-new", "decision-passport", "indicators", "lessons"],
    roleTourId: "role-initiator",
  },
  DATA_OWNER: {
    role: "DATA_OWNER",
    label: "Владелец данных",
    purpose: "Отвечает за качество, актуальность и происхождение критических данных, а не за само решение.",
    responsibilities: [
      "Проверить источник, владельца и дату актуальности",
      "Подтвердить качество только собственных критических показателей",
      "Обеспечить воспроизводимую цепочку data lineage",
    ],
    primaryRoutes: ["dashboard", "indicators", "indicator-detail", "decision-passport", "audit"],
    roleTourId: "role-data-owner",
  },
  RISK_OFFICER: {
    role: "RISK_OFFICER",
    label: "Риск-офицер",
    purpose: "Показывает, какой риск организация принимает после мер контроля.",
    responsibilities: [
      "Оценить вероятность и воздействие исходного риска",
      "Зафиксировать меры, владельца и триггер пересмотра",
      "Подтвердить остаточный риск для decision gate",
    ],
    primaryRoutes: ["dashboard", "decision-passport", "boards", "audit"],
    roleTourId: "role-risk-officer",
  },
  ANALYST: {
    role: "ANALYST",
    label: "Аналитик",
    purpose: "Формирует проверяемую аналитическую часть доказательной базы решения.",
    responsibilities: [
      "Сопоставить альтернативы по единому набору критериев",
      "Проверить допущения, сценарии и критические расчёты",
      "Использовать модели и ИИ только в пределах подтверждённых данных",
    ],
    primaryRoutes: ["dashboard", "decision-passport", "indicators", "kpi", "models"],
    roleTourId: "role-analyst",
  },
  SECRETARY: {
    role: "SECRETARY",
    label: "Корпоративный секретарь",
    purpose: "Контролирует компетенцию органа, корпоративный маршрут и полноту gate evidence.",
    responsibilities: [
      "Проверить орган, стадию и статус вопроса",
      "Открыть переход только после прохождения контрольных ворот",
      "Вернуть пакет с конкретным основанием и сохранить audit trail",
    ],
    primaryRoutes: ["dashboard", "decisions", "decision-passport", "boards", "audit"],
    roleTourId: "role-secretary",
  },
  BOARD_MEMBER: {
    role: "BOARD_MEMBER",
    label: "Член органа управления",
    purpose: "Принимает мотивированное человеческое решение на основании проверяемого досье.",
    responsibilities: [
      "Сопоставить альтернативы, эффект и остаточный риск",
      "Рассмотреть рекомендацию ИИ как аналитический вход",
      "Зафиксировать выбор и мотивировку без передачи полномочий алгоритму",
    ],
    primaryRoutes: ["dashboard", "decisions", "decision-passport", "boards", "audit"],
    roleTourId: "role-board-member",
  },
  ADMIN: {
    role: "ADMIN",
    label: "Администратор",
    purpose: "Управляет конфигурацией цифрового контура, но не подменяет владельцев бизнес-решений.",
    responsibilities: [
      "Управлять пользователями, ролями и справочником органов",
      "Поддерживать gate policy и технические права доступа",
      "Сохранять воспроизводимость изменений через аудит",
    ],
    primaryRoutes: ["dashboard", "admin", "audit", "models", "roadmap"],
    roleTourId: "role-admin",
  },
};

export function getOnboardingRoleProfile(role: Role): OnboardingRoleProfile {
  return ONBOARDING_ROLE_PROFILES[role];
}

export function listOnboardingRoleProfiles(): OnboardingRoleProfile[] {
  return ROLES.map((role) => ONBOARDING_ROLE_PROFILES[role]);
}
