import type { Role } from "@/lib/domain";
import type {
  TourDefinition,
  TourMode,
  TourRouteRef,
  TourStep,
} from "@/lib/onboarding/types";

export interface StepDraft
  extends Omit<TourStep, "id" | "order" | "routeRef" | "roles"> {
  key: string;
  routeRef?: TourRouteRef;
  roles?: readonly Role[];
}

export interface TourDraft
  extends Omit<TourDefinition, "steps" | "locale" | "autoStart" | "routeRef"> {
  routeRef: TourRouteRef;
  steps: readonly StepDraft[];
  locale?: string;
  autoStart?: boolean;
}

export function defineTour(draft: TourDraft): TourDefinition {
  const roles = draft.roles ?? [];
  return {
    id: draft.id,
    version: draft.version,
    mode: draft.mode,
    locale: draft.locale ?? "ru",
    title: draft.title,
    description: draft.description,
    roles,
    route: draft.route,
    routeRef: draft.routeRef,
    autoStart: draft.autoStart ?? draft.mode === "PAGE",
    ...(draft.estimatedMinutes ? { estimatedMinutes: draft.estimatedMinutes } : {}),
    steps: draft.steps.map(({ key, routeRef, roles: stepRoles, ...step }, index) => ({
      ...step,
      id: `${draft.id}:${key}`,
      order: index + 1,
      route: step.route ?? draft.route,
      routeRef: routeRef ?? draft.routeRef,
      roles: stepRoles ?? roles,
      targetPolicy: step.targetPolicy ?? "required",
    })),
  };
}

export function pageTour(
  draft: Omit<TourDraft, "mode" | "autoStart">
): TourDefinition {
  return defineTour({ ...draft, mode: "PAGE", autoStart: true });
}

export function guidedTour(
  mode: Exclude<TourMode, "PAGE">,
  draft: Omit<TourDraft, "mode" | "autoStart">
): TourDefinition {
  return defineTour({ ...draft, mode, autoStart: false });
}
