import { describe, it, expect } from "vitest";
import { can, assertCan, AccessDeniedError, PERMISSIONS, type PermissionAction } from "@/lib/authz";
import { ROLES, type Role } from "@/lib/domain";

describe("Матрица прав по ролям", () => {
  it("инициатор создаёт паспорта, но не принимает решения", () => {
    expect(can("INITIATOR", "decision.create")).toBe(true);
    expect(can("INITIATOR", "decision.editBlocks")).toBe(true);
    expect(can("INITIATOR", "decision.submit")).toBe(true);
    expect(can("INITIATOR", "decision.decide")).toBe(false);
    expect(can("INITIATOR", "admin.users")).toBe(false);
  });

  it("владелец данных подтверждает качество показателей и ничего больше не меняет", () => {
    expect(can("DATA_OWNER", "indicator.confirmQuality")).toBe(true);
    expect(can("DATA_OWNER", "decision.create")).toBe(false);
    expect(can("DATA_OWNER", "risk.edit")).toBe(false);
    expect(can("DATA_OWNER", "indicator.manage")).toBe(false);
  });

  it("риск-офицер ведёт риск-профиль и участвует в независимой проверке", () => {
    expect(can("RISK_OFFICER", "risk.edit")).toBe(true);
    expect(can("RISK_OFFICER", "calc.review")).toBe(true);
    expect(can("RISK_OFFICER", "decision.decide")).toBe(false);
    expect(can("RISK_OFFICER", "decision.create")).toBe(false);
  });

  it("аналитик ведёт каталог показателей и реестр моделей", () => {
    expect(can("ANALYST", "indicator.manage")).toBe(true);
    expect(can("ANALYST", "aiModel.manage")).toBe(true);
    expect(can("ANALYST", "calc.create")).toBe(true);
    expect(can("ANALYST", "calc.review")).toBe(true);
    expect(can("ANALYST", "decision.decide")).toBe(false);
  });

  it("корпоративный секретарь ведёт маршрут, но не принимает решение", () => {
    expect(can("SECRETARY", "decision.advance")).toBe(true);
    expect(can("SECRETARY", "decision.return")).toBe(true);
    expect(can("SECRETARY", "assignment.manage")).toBe(true);
    expect(can("SECRETARY", "decision.decide")).toBe(false);
  });

  it("член Совета директоров принимает решение и выносит вердикт по ИИ", () => {
    expect(can("BOARD_MEMBER", "decision.decide")).toBe(true);
    expect(can("BOARD_MEMBER", "ai.verdict")).toBe(true);
    expect(can("BOARD_MEMBER", "decision.return")).toBe(true);
    expect(can("BOARD_MEMBER", "decision.create")).toBe(false);
    expect(can("BOARD_MEMBER", "indicator.manage")).toBe(false);
  });

  it("администратор имеет доступ к настройкам контура", () => {
    expect(can("ADMIN", "admin.users")).toBe(true);
    expect(can("ADMIN", "admin.gates")).toBe(true);
    expect(can("ADMIN", "admin.bodies")).toBe(true);
  });

  it("настройки контура закрыты для всех, кроме администратора", () => {
    const adminActions: PermissionAction[] = ["admin.users", "admin.gates", "admin.bodies"];
    for (const role of ROLES.filter((r) => r !== "ADMIN")) {
      for (const action of adminActions) {
        expect(can(role, action)).toBe(false);
      }
    }
  });

  it("принятие решения доступно только члену СД и администратору", () => {
    const allowed = ROLES.filter((r) => can(r, "decision.decide"));
    expect(allowed.sort()).toEqual(["ADMIN", "BOARD_MEMBER"]);
  });

  it("подтверждение качества данных доступно только владельцу данных и администратору", () => {
    const allowed = ROLES.filter((r) => can(r, "indicator.confirmQuality"));
    expect(allowed.sort()).toEqual(["ADMIN", "DATA_OWNER"]);
  });

  it("отсутствие роли не даёт никаких прав", () => {
    for (const action of Object.keys(PERMISSIONS) as PermissionAction[]) {
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
      expect(can("UNKNOWN_ROLE", action)).toBe(false);
    }
  });

  it("каждое право закреплено хотя бы за одной ролью", () => {
    for (const action of Object.keys(PERMISSIONS) as PermissionAction[]) {
      const holders = ROLES.filter((r: Role) => can(r, action));
      expect(holders.length).toBeGreaterThan(0);
    }
  });

  it("assertCan бросает AccessDeniedError при отсутствии права", () => {
    expect(() => assertCan("ADMIN", "decision.decide")).not.toThrow();
    expect(() => assertCan("INITIATOR", "decision.decide")).toThrow(AccessDeniedError);
    try {
      assertCan("DATA_OWNER", "admin.gates");
    } catch (e) {
      expect(e).toBeInstanceOf(AccessDeniedError);
      expect((e as Error).message).toContain("admin.gates");
    }
  });
});
