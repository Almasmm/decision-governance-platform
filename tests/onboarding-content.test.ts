import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/domain";
import { TOUR_REGISTRY } from "@/lib/onboarding/registry";
import { ONBOARDING_ROUTES } from "@/lib/onboarding/routes";

const VALID_MODES = new Set(["PAGE", "ROLE", "THESIS"]);
const VALID_PLACEMENTS = new Set(["top", "right", "bottom", "left", "center"]);
const VALID_ROLES = new Set<string>(ROLES);
const VALID_ROUTE_IDS = new Set(ONBOARDING_ROUTES.map((route) => route.id));
const TARGET_PATTERN = /^\[data-tour="[a-z0-9-]+"\]$/;

describe("onboarding content registry", () => {
  it("uses globally unique tour and step IDs", () => {
    const tourIds = TOUR_REGISTRY.map((tour) => tour.id);
    const stepIds = TOUR_REGISTRY.flatMap((tour) => tour.steps.map((step) => step.id));

    expect(new Set(tourIds).size).toBe(tourIds.length);
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  it("contains complete Russian, versioned definitions", () => {
    expect(TOUR_REGISTRY.length).toBeGreaterThan(20);

    for (const tour of TOUR_REGISTRY) {
      expect(VALID_MODES.has(tour.mode), tour.id).toBe(true);
      expect(Number.isInteger(tour.version), tour.id).toBe(true);
      expect(tour.version, tour.id).toBeGreaterThan(0);
      expect(tour.locale, tour.id).toBe("ru");
      expect(tour.title.trim().length, tour.id).toBeGreaterThan(8);
      expect(tour.description.trim().length, tour.id).toBeGreaterThan(20);
      expect(/[А-Яа-яЁё]/.test(`${tour.title} ${tour.description}`), tour.id).toBe(true);
      expect(tour.steps.length, tour.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps every step ordered, actionable and methodology-aware", () => {
    for (const tour of TOUR_REGISTRY) {
      tour.steps.forEach((step, index) => {
        expect(step.order, step.id).toBe(index + 1);
        expect(step.id.startsWith(`${tour.id}:`), step.id).toBe(true);
        expect(step.title.trim().length, step.id).toBeGreaterThan(5);
        expect(step.body.trim().length, step.id).toBeGreaterThan(45);
        expect(/[А-Яа-яЁё]/.test(`${step.title} ${step.body}`), step.id).toBe(true);
        expect(
          Boolean(step.responsibility?.trim() || step.thesisContext?.trim()),
          `${step.id} should explain an action/responsibility or thesis context`
        ).toBe(true);
        expect(VALID_ROUTE_IDS.has(step.routeRef.routeId), step.id).toBe(true);
        if (step.route) expect(step.route.startsWith("/"), step.id).toBe(true);
        if (step.placement) expect(VALID_PLACEMENTS.has(step.placement), step.id).toBe(true);
        expect(
          step.target === "body" || TARGET_PATTERN.test(step.target),
          `${step.id}: ${step.target}`
        ).toBe(true);
      });
    }
  });

  it("references only real roles and routes", () => {
    for (const tour of TOUR_REGISTRY) {
      expect(VALID_ROUTE_IDS.has(tour.routeRef.routeId), tour.id).toBe(true);
      if (tour.route) expect(tour.route.startsWith("/"), tour.id).toBe(true);
      for (const role of tour.roles ?? []) expect(VALID_ROLES.has(role), tour.id).toBe(true);
      for (const step of tour.steps) {
        for (const role of step.roles ?? []) expect(VALID_ROLES.has(role), step.id).toBe(true);
      }
    }
  });

  it("preserves the three explicitly different tour modes", () => {
    for (const mode of VALID_MODES) {
      expect(TOUR_REGISTRY.some((tour) => tour.mode === mode), mode).toBe(true);
    }
    expect(TOUR_REGISTRY.filter((tour) => tour.mode === "ROLE")).toHaveLength(ROLES.length);
    const jury = TOUR_REGISTRY.find((tour) => tour.id === "thesis-jury-methodology");
    expect(jury?.estimatedMinutes).toBe(13);
    expect(jury?.steps.every((step) => Boolean(step.responsibility?.trim()))).toBe(true);
    expect(jury?.steps.find((step) => step.id.endsWith(":economics"))?.target).toBe(
      '[data-tour="economics-inputs"]'
    );

    const evidenceNatures = TOUR_REGISTRY.find((tour) => tour.id === "thesis-evidence-natures");
    expect(evidenceNatures?.steps.map((step) => step.target)).toEqual([
      '[data-tour="indicator-nature"]',
      '[data-tour="indicator-current-value"]',
      '[data-tour="risk-exposure"]',
      '[data-tour="assumptions-register"]',
    ]);
    expect(evidenceNatures?.steps.at(-1)?.route).toBe("/decisions/:id?tab=risks");

    const dataOwner = TOUR_REGISTRY.find((tour) => tour.id === "role-data-owner");
    expect(dataOwner?.steps.find((step) => step.id.endsWith(":confirm-quality"))?.target).toBe(
      '[data-tour="decision-indicator-quality-control"]'
    );
  });
});
