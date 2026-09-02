// Матрица прав. Проверяется НА СЕРВЕРЕ в каждом server action / route handler.
import type { Role } from "./domain";

export const PERMISSIONS = {
  "decision.create": ["INITIATOR", "ADMIN"],
  "decision.editBlocks": ["INITIATOR", "ANALYST", "ADMIN"],
  "decision.advance": ["INITIATOR", "SECRETARY", "ADMIN"],
  "decision.return": ["SECRETARY", "BOARD_MEMBER", "ADMIN"],
  "decision.decide": ["BOARD_MEMBER", "ADMIN"],
  "decision.submit": ["INITIATOR", "ADMIN"],
  "indicator.manage": ["ANALYST", "ADMIN"],
  "indicator.confirmQuality": ["DATA_OWNER", "ADMIN"],
  "indicator.link": ["INITIATOR", "ANALYST", "ADMIN"],
  "risk.edit": ["RISK_OFFICER", "ADMIN"],
  "assumption.edit": ["INITIATOR", "ANALYST", "ADMIN"],
  "alternative.edit": ["INITIATOR", "ANALYST", "ADMIN"],
  "calc.create": ["ANALYST", "INITIATOR", "ADMIN"],
  "calc.review": ["ANALYST", "RISK_OFFICER", "ADMIN"],
  "assignment.manage": ["INITIATOR", "SECRETARY", "ADMIN"],
  "aiModel.manage": ["ANALYST", "ADMIN"],
  "ai.run": ["INITIATOR", "ANALYST", "BOARD_MEMBER", "SECRETARY", "ADMIN"],
  "ai.verdict": ["INITIATOR", "ANALYST", "BOARD_MEMBER", "ADMIN"],
  "lesson.create": ["INITIATOR", "ANALYST", "ADMIN"],
  "kpi.manage": ["ANALYST", "ADMIN"],
  "admin.users": ["ADMIN"],
  "admin.gates": ["ADMIN"],
  "admin.bodies": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type PermissionAction = keyof typeof PERMISSIONS;

export function can(role: Role | string | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  return (PERMISSIONS[action] as readonly string[]).includes(role);
}

export class AccessDeniedError extends Error {
  constructor(action: string) {
    super(`Недостаточно прав: ${action}`);
    this.name = "AccessDeniedError";
  }
}

export function assertCan(role: Role | string | undefined | null, action: PermissionAction): void {
  if (!can(role, action)) throw new AccessDeniedError(action);
}
