import { isTourAvailableToRole, TOUR_REGISTRY } from "@/lib/onboarding/registry";
import { isRouteAccessible, matchOnboardingRoute } from "@/lib/onboarding/routes";
import type {
  OnboardingRole,
  SearchParamsInput,
  TourDefinition,
} from "@/lib/onboarding/types";

const PASSPORT_TABS = new Set([
  "passport",
  "alternatives",
  "risks",
  "economics",
  "assignments",
  "ai",
  "audit",
]);

interface ParsedLocation {
  pathname: string;
  searchParams: URLSearchParams;
}

function parseLocation(location: string): ParsedLocation {
  const value = location.trim() || "/";
  try {
    const url = new URL(value, "http://onboarding.local");
    return { pathname: url.pathname || "/", searchParams: url.searchParams };
  } catch {
    const [pathname = "/", query = ""] = value.split("?", 2);
    return { pathname, searchParams: new URLSearchParams(query) };
  }
}

function mergeSearchParams(
  base: URLSearchParams,
  input?: SearchParamsInput
): URLSearchParams {
  if (input === undefined) return new URLSearchParams(base);
  const merged = new URLSearchParams(base);
  if (typeof input === "string") {
    const explicit = new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
    explicit.forEach((value, key) => merged.set(key, value));
    return merged;
  }
  if (input instanceof URLSearchParams) {
    input.forEach((value, key) => merged.set(key, value));
    return merged;
  }

  Object.entries(input).forEach(([key, value]) => {
    merged.delete(key);
    if (typeof value === "string") merged.set(key, value);
    else value?.forEach((item: string) => merged.append(key, item));
  });
  return merged;
}

function normalizePageQuery(routeId: string, params: URLSearchParams): URLSearchParams {
  const normalized = new URLSearchParams(params);
  if (routeId === "decision-passport") {
    const tab = normalized.get("tab");
    if (!tab || !PASSPORT_TABS.has(tab)) normalized.set("tab", "passport");
  }
  return normalized;
}

function queryMatches(
  expected: Readonly<Record<string, string>> | undefined,
  actual: URLSearchParams
): boolean {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => actual.get(key) === value);
}

/**
 * Resolve a PAGE tour from either `/path?query` or pathname plus explicit
 * search params. Passport tabs deliberately map to independent tour IDs.
 */
export function resolvePageTour(
  location: string,
  role?: OnboardingRole | null,
  searchParams?: SearchParamsInput
): TourDefinition | undefined {
  const parsed = parseLocation(location);
  const route = matchOnboardingRoute(parsed.pathname);
  if (!route || !route.pageTourRequired) return undefined;

  const domainRole = role && role !== "GUEST" ? role : null;
  if (!isRouteAccessible(route.id, domainRole)) return undefined;

  const query = normalizePageQuery(
    route.id,
    mergeSearchParams(parsed.searchParams, searchParams)
  );

  return TOUR_REGISTRY.filter(
    (tour) =>
      tour.mode === "PAGE" &&
      tour.routeRef.routeId === route.id &&
      queryMatches(tour.routeRef.query, query) &&
      isTourAvailableToRole(tour, role)
  ).sort(
    (left, right) =>
      Object.keys(right.routeRef.query ?? {}).length -
      Object.keys(left.routeRef.query ?? {}).length
  )[0];
}
