import { PAGE_TOURS } from "@/lib/onboarding/content/page";
import { ROLE_TOURS } from "@/lib/onboarding/content/role";
import { THESIS_TOURS } from "@/lib/onboarding/content/thesis";
import type {
  OnboardingRole,
  TourDefinition,
  TourMode,
} from "@/lib/onboarding/types";

/** Single source of truth for Help, progress and resolver UIs. */
export const TOUR_REGISTRY: readonly TourDefinition[] = [
  ...PAGE_TOURS,
  ...ROLE_TOURS,
  ...THESIS_TOURS,
] as const;

export function isTourAvailableToRole(
  tour: TourDefinition,
  role?: OnboardingRole | null
): boolean {
  if (!tour.roles?.length) return true;
  if (!role || role === "GUEST") return false;
  return tour.roles.includes(role);
}

export function getTourById(
  id: string,
  role?: OnboardingRole | null
): TourDefinition | undefined {
  const tour = TOUR_REGISTRY.find((candidate) => candidate.id === id);
  return tour && isTourAvailableToRole(tour, role) ? tour : undefined;
}

export function listToursForRole(role?: OnboardingRole | null): TourDefinition[] {
  return TOUR_REGISTRY.filter((tour) => isTourAvailableToRole(tour, role));
}

// Public provider-facing entry point kept beside the registry helpers.
export { resolvePageTour } from "@/lib/onboarding/resolver";

export function listToursByMode(
  mode: TourMode,
  role?: OnboardingRole | null
): TourDefinition[] {
  return TOUR_REGISTRY.filter(
    (tour) => tour.mode === mode && isTourAvailableToRole(tour, role)
  );
}
