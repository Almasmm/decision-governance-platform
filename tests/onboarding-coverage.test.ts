import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROLES, type Role } from "@/lib/domain";
import {
  getTourById,
  listToursForRole,
  resolvePageTour,
  TOUR_REGISTRY,
} from "@/lib/onboarding/registry";
import {
  isRouteAccessible,
  matchOnboardingRoute,
  ONBOARDING_ROUTES,
} from "@/lib/onboarding/routes";
import { TOUR_TARGETS } from "@/lib/onboarding/targets";

const concreteLocation = (pattern: string): string =>
  pattern.replace(":id", "demo-entity");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("onboarding route and role coverage", () => {
  it("covers every accessible working route or documents an exception", () => {
    for (const route of ONBOARDING_ROUTES) {
      if (!route.pageTourRequired) {
        expect(route.exception?.trim().length, route.pattern).toBeGreaterThan(20);
        continue;
      }

      if (route.access === "public") {
        expect(resolvePageTour(concreteLocation(route.pattern), "GUEST"), route.pattern).toBeDefined();
        continue;
      }

      for (const role of ROLES) {
        const accessible = isRouteAccessible(route.id, role);
        const resolved = resolvePageTour(concreteLocation(route.pattern), role);
        expect(Boolean(resolved), `${role} ${route.pattern}`).toBe(accessible);
      }
    }
  });

  it("keeps static routes ahead of dynamic entity patterns", () => {
    expect(matchOnboardingRoute("/decisions/new")?.id).toBe("decision-new");
    expect(matchOnboardingRoute("/decisions/demo")?.id).toBe("decision-passport");
    expect(matchOnboardingRoute("/indicators/demo")?.id).toBe("indicator-detail");
    expect(matchOnboardingRoute("/search?query=gate")?.id).toBe("search");
  });

  it("enforces real route permissions in the resolver", () => {
    expect(resolvePageTour("/decisions/new", "INITIATOR")?.id).toBe("page-decision-new");
    expect(resolvePageTour("/decisions/new", "ADMIN")?.id).toBe("page-decision-new");
    expect(resolvePageTour("/decisions/new", "ANALYST")).toBeUndefined();
    expect(resolvePageTour("/admin", "ADMIN")?.id).toBe("page-admin");
    expect(resolvePageTour("/admin", "BOARD_MEMBER")).toBeUndefined();
    expect(resolvePageTour("/dashboard", "GUEST")).toBeUndefined();
  });

  it("resolves role-aware dashboard tours", () => {
    for (const role of ROLES) {
      const suffix = role.toLowerCase().replaceAll("_", "-");
      expect(resolvePageTour("/dashboard", role)?.id).toBe(`page-dashboard-${suffix}`);
    }
  });

  it("resolves independent passport tours for default and all six tabs", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["/decisions/demo", "page-decision-passport"],
      ["/decisions/demo?tab=passport", "page-decision-passport"],
      ["/decisions/demo?tab=alternatives", "page-decision-alternatives"],
      ["/decisions/demo?tab=risks", "page-decision-risks"],
      ["/decisions/demo?tab=economics", "page-decision-economics"],
      ["/decisions/demo?tab=assignments", "page-decision-assignments"],
      ["/decisions/demo?tab=ai", "page-decision-ai"],
      ["/decisions/demo?tab=audit", "page-decision-audit"],
    ];

    for (const [location, expectedId] of cases) {
      expect(resolvePageTour(location, "BOARD_MEMBER")?.id, location).toBe(expectedId);
    }

    expect(resolvePageTour("/decisions/demo", "ANALYST", { tab: "risks" })?.id).toBe(
      "page-decision-risks"
    );
    expect(resolvePageTour("/decisions/demo?tab=unknown", "ANALYST")?.id).toBe(
      "page-decision-passport"
    );
  });

  it("provides one subject-specific ROLE tour for every domain role", () => {
    for (const role of ROLES) {
      const roleTours = TOUR_REGISTRY.filter(
        (tour) => tour.mode === "ROLE" && tour.roles?.includes(role)
      );
      expect(roleTours, role).toHaveLength(1);
      expect(roleTours[0]!.steps.length, role).toBeGreaterThanOrEqual(7);
      expect(getTourById(roleTours[0]!.id, role)).toBeDefined();
      const anotherRole = ROLES.find((candidate) => candidate !== role) as Role;
      expect(getTourById(roleTours[0]!.id, anotherRole)).toBeUndefined();
    }
  });

  it("makes login and the self-guided thesis tour available before role resolution", () => {
    const guestTours = listToursForRole("GUEST");
    expect(resolvePageTour("/login", "GUEST")?.id).toBe("page-login");
    expect(guestTours.some((tour) => tour.id === "page-login")).toBe(true);
    const thesis = guestTours.find((tour) => tour.id === "thesis-jury-methodology");
    expect(thesis?.roles ?? []).toHaveLength(0);
    expect(thesis?.steps[1]?.target).toBe('[data-tour="login-role-groups"]');
    expect(thesis?.steps[1]?.advance).toBe("target-click");
  });

  it("includes the real search route in addition to the core route inventory", () => {
    expect(ONBOARDING_ROUTES.filter((route) => route.access !== "redirect")).toHaveLength(15);
    expect(resolvePageTour("/search?q=решение", "SECRETARY")?.id).toBe("page-search");
  });

  it("backs every selector contract with a literal or dynamic data-tour anchor", () => {
    const uiSource = [...collectSourceFiles("app"), ...collectSourceFiles("components")]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    for (const target of new Set(Object.values(TOUR_TARGETS))) {
      if (target === "body") continue;
      const name = target.match(/^\[data-tour="([a-z0-9-]+)"\]$/)?.[1];
      expect(name, target).toBeDefined();
      const escaped = name!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const anchor = new RegExp(
        `data-tour\\s*=\\s*(?:["']${escaped}["']|\\{[^}]*["']${escaped}["'][^}]*\\})`
      );
      expect(anchor.test(uiSource), `${target} has no DOM anchor`).toBe(true);
    }
  });
});
