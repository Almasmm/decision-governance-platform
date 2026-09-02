import type { SessionUser } from "@/lib/auth";
import type { GateContext } from "@/lib/gate-service";
import { STAGES, type Role, type Stage } from "@/lib/domain";

const INACTIVE_STATUSES = new Set(["CLOSED", "REJECTED"]);

const RULE_PRESENTATION: Record<
  string,
  { action: string; roles: Role[]; destination: string }
> = {
  GOAL_TYPE_BODY: {
    action: "Завершить идентификацию решения",
    roles: ["INITIATOR"],
    destination: "?tab=passport&block=IDENTIFICATION",
  },
  CRITICAL_INDICATORS_SOURCED: {
    action: "Назначить источники и владельцев критических данных",
    roles: ["INITIATOR", "ANALYST"],
    destination: "?tab=passport&block=DATA",
  },
  DATA_OWNERS_CONFIRMED: {
    action: "Подтвердить качество критических данных",
    roles: ["DATA_OWNER"],
    destination: "?tab=passport&block=DATA",
  },
  ALTERNATIVES_MIN: {
    action: "Добавить содержательно отличающиеся альтернативы",
    roles: ["INITIATOR", "ANALYST"],
    destination: "?tab=alternatives",
  },
  UNIFORM_CRITERIA: {
    action: "Сопоставить варианты по единому набору критериев",
    roles: ["INITIATOR", "ANALYST"],
    destination: "?tab=alternatives",
  },
  RISK_PROFILE: {
    action: "Завершить оценку остаточного риска",
    roles: ["RISK_OFFICER"],
    destination: "?tab=risks",
  },
  ASSUMPTIONS_FIXED: {
    action: "Зафиксировать ключевые допущения и срок их действия",
    roles: ["INITIATOR", "ANALYST"],
    destination: "?tab=risks",
  },
  INDEPENDENT_REVIEW: {
    action: "Провести независимую проверку расчётов",
    roles: ["ANALYST", "RISK_OFFICER"],
    destination: "?tab=economics",
  },
  DECISION_RECORDED: {
    action: "Зафиксировать мотивированный выбор человека",
    roles: ["BOARD_MEMBER"],
    destination: "?tab=alternatives",
  },
  ASSIGNMENTS_KPI: {
    action: "Связать поручения с KPI результата",
    roles: ["INITIATOR", "SECRETARY"],
    destination: "?tab=assignments",
  },
  POST_EVALUATION_REQUIRED: {
    action: "Завершить план-факт и зафиксировать урок",
    roles: ["INITIATOR", "ANALYST"],
    destination: "?tab=passport&block=POST_EVALUATION",
  },
};

export type DashboardUrgency = "overdue" | "high" | "normal";

export interface DashboardAction {
  id: string;
  decisionId: string;
  decisionCode: string;
  decisionTitle: string;
  criticality: string;
  action: string;
  reason: string;
  responsible: string;
  href: string;
  dueAt: Date | null;
  urgency: DashboardUrgency;
}

export interface DecisionFlowPoint {
  stage: Stage;
  count: number;
  blocked: number;
  returns: number;
}

export function isActiveContext(context: GateContext): boolean {
  return !INACTIVE_STATUSES.has(context.decision.status);
}

function urgencyFor(
  criticality: string,
  status: string,
  dueAt: Date | null,
  now: Date
): DashboardUrgency {
  if (dueAt && dueAt.getTime() < now.getTime()) return "overdue";
  if (criticality === "A" || status === "RETURNED") return "high";
  return "normal";
}

function roleOwnsRule(
  role: Role,
  ruleCode: string,
  context: GateContext,
  userId: string
): boolean {
  if (role === "ADMIN") return true;
  const meta = RULE_PRESENTATION[ruleCode];
  if (!meta?.roles.includes(role)) return false;

  if (ruleCode === "DATA_OWNERS_CONFIRMED" && role === "DATA_OWNER") {
    return context.decision.indicatorLinks.some(
      (link) =>
        (link.isCritical || link.indicator.isCritical) &&
        !link.confirmedById &&
        link.indicator.ownerId === userId
    );
  }

  return true;
}

function actionScore(action: DashboardAction): number {
  const urgency = action.urgency === "overdue" ? 300 : action.urgency === "high" ? 200 : 100;
  const criticality = action.criticality === "A" ? 30 : action.criticality === "B" ? 20 : 10;
  return urgency + criticality;
}

function presentGateReason(code: string, explanation: string): string {
  if (code === "INDEPENDENT_REVIEW") {
    return "Один или несколько критических расчётов не подтверждены независимым специалистом.";
  }
  return explanation;
}

/**
 * Создаёт персональную очередь исключительно из существующих поручений,
 * результатов штатного gate engine и ожидающих human verdict рекомендаций.
 */
export function buildDashboardActionQueue(
  user: SessionUser,
  contexts: GateContext[],
  now = new Date()
): DashboardAction[] {
  const actions: DashboardAction[] = [];

  for (const context of contexts.filter(isActiveContext)) {
    const decision = context.decision;
    const base = {
      decisionId: decision.id,
      decisionCode: decision.code,
      decisionTitle: decision.title,
      criticality: decision.criticality,
    };

    for (const assignment of decision.assignments) {
      if (assignment.assigneeId !== user.id || assignment.status === "DONE") continue;
      actions.push({
        ...base,
        id: `assignment-${assignment.id}`,
        action: assignment.text,
        reason: assignment.linkedKpi
          ? `Поручение связано с показателем «${assignment.linkedKpi.name}»`
          : "Поручение необходимо связать с KPI результата",
        responsible: assignment.assignee.name,
        href: `/decisions/${decision.id}?tab=assignments`,
        dueAt: assignment.dueDate,
        urgency: urgencyFor(decision.criticality, decision.status, assignment.dueDate, now),
      });
    }

    for (const result of context.evaluation?.results.filter((item) => !item.passed) ?? []) {
      if (!roleOwnsRule(user.role, result.code, context, user.id)) continue;
      const meta = RULE_PRESENTATION[result.code];
      if (!meta) continue;
      actions.push({
        ...base,
        id: `gate-${decision.id}-${result.code}`,
        action: meta.action,
        reason: presentGateReason(result.code, result.explanation),
        responsible: user.role === "ADMIN" ? result.responsible : user.name,
        href: `/decisions/${decision.id}${meta.destination}`,
        dueAt: decision.deadline,
        urgency: urgencyFor(decision.criticality, decision.status, decision.deadline, now),
      });
    }

    const pendingRecommendation = decision.suggestions.some(
      (suggestion) => suggestion.tier === "RECOMMENDATIONAL" && suggestion.humanVerdict === "PENDING"
    );
    if (
      pendingRecommendation &&
      (["BOARD_MEMBER", "INITIATOR", "ANALYST", "ADMIN"] as Role[]).includes(user.role)
    ) {
      actions.push({
        ...base,
        id: `ai-verdict-${decision.id}`,
        action: "Вынести человеческий вердикт по рекомендации модели",
        reason: "Рекомендация сформирована, но не применена и не является решением организации.",
        responsible: user.name,
        href: `/decisions/${decision.id}?tab=ai`,
        dueAt: decision.deadline,
        urgency: urgencyFor(decision.criticality, decision.status, decision.deadline, now),
      });
    }

    if (
      user.role === "SECRETARY" &&
      context.targetStage &&
      context.evaluation?.allowed &&
      decision.status === "IN_REVIEW"
    ) {
      actions.push({
        ...base,
        id: `route-${decision.id}-${context.targetStage}`,
        action: "Проверить маршрут и открыть следующий переход",
        reason: "Обязательные условия текущих контрольных ворот подтверждены.",
        responsible: user.name,
        href: `/decisions/${decision.id}?tab=passport`,
        dueAt: decision.deadline,
        urgency: urgencyFor(decision.criticality, decision.status, decision.deadline, now),
      });
    }
  }

  return actions.sort((a, b) => {
    const scoreDelta = actionScore(b) - actionScore(a);
    if (scoreDelta !== 0) return scoreDelta;
    const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return aDue - bDue || a.decisionCode.localeCompare(b.decisionCode, "ru");
  });
}

export function buildDecisionFlow(contexts: GateContext[]): DecisionFlowPoint[] {
  const active = contexts.filter(isActiveContext);
  return STAGES.map((stage) => {
    const atStage = active.filter((context) => context.currentStage === stage);
    return {
      stage,
      count: atStage.length,
      blocked: atStage.filter((context) => context.evaluation && !context.evaluation.allowed).length,
      returns: atStage.reduce((sum, context) => sum + context.decision.returnCount, 0),
    };
  });
}

export function countAlevelAttention(contexts: GateContext[]): number {
  return contexts.filter((context) => {
    if (!isActiveContext(context) || context.decision.criticality !== "A") return false;
    const pendingHumanVerdict = context.decision.suggestions.some(
      (suggestion) => suggestion.tier === "RECOMMENDATIONAL" && suggestion.humanVerdict === "PENDING"
    );
    return (
      context.decision.status === "RETURNED" ||
      context.evaluation?.allowed === false ||
      (context.currentStage === "DECISION" && context.decision.status !== "APPROVED") ||
      pendingHumanVerdict
    );
  }).length;
}
