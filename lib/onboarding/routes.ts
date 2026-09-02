import { ROLES, type Role } from "@/lib/domain";
import type { OnboardingRouteId } from "@/lib/onboarding/types";

export type RouteAccess = "redirect" | "public" | "authenticated" | "role-restricted";

export interface OnboardingRouteDefinition {
  id: OnboardingRouteId;
  pattern: string;
  title: string;
  access: RouteAccess;
  roles: readonly Role[];
  pageTourRequired: boolean;
  exception?: string;
}

const ALL_ROLES: readonly Role[] = ROLES;

/**
 * Mirrors the real App Router pages. Static routes precede dynamic patterns so
 * `/decisions/new` can never be mistaken for `/decisions/:id`.
 */
export const ONBOARDING_ROUTES: readonly OnboardingRouteDefinition[] = [
  {
    id: "home",
    pattern: "/",
    title: "Маршрутизация входа",
    access: "redirect",
    roles: ALL_ROLES,
    pageTourRequired: false,
    exception: "Служебный redirect на /login или /dashboard не имеет собственного интерфейса.",
  },
  {
    id: "login",
    pattern: "/login",
    title: "Вход и выбор роли",
    access: "public",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "dashboard",
    pattern: "/dashboard",
    title: "Управленческий контур",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "decision-new",
    pattern: "/decisions/new",
    title: "Новый паспорт решения",
    access: "role-restricted",
    roles: ["INITIATOR", "ADMIN"],
    pageTourRequired: true,
  },
  {
    id: "decision-passport",
    pattern: "/decisions/:id",
    title: "Цифровой паспорт решения",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "decisions",
    pattern: "/decisions",
    title: "Реестр решений",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "indicator-detail",
    pattern: "/indicators/:id",
    title: "Карточка показателя и data lineage",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "indicators",
    pattern: "/indicators",
    title: "Каталог показателей",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "kpi",
    pattern: "/kpi",
    title: "Эффект и зрелость",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "models",
    pattern: "/models",
    title: "Реестр моделей ИИ",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "lessons",
    pattern: "/lessons",
    title: "База извлечённых уроков",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "boards",
    pattern: "/boards",
    title: "Ролевые контуры органов управления",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "roadmap",
    pattern: "/roadmap",
    title: "Трансформационная дорожная карта",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "audit",
    pattern: "/audit",
    title: "Сквозной аудит",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
  {
    id: "admin",
    pattern: "/admin",
    title: "Администрирование контура",
    access: "role-restricted",
    roles: ["ADMIN"],
    pageTourRequired: true,
  },
  {
    id: "search",
    pattern: "/search",
    title: "Глобальный поиск",
    access: "authenticated",
    roles: ALL_ROLES,
    pageTourRequired: true,
  },
] as const;

/** Routes visible directly in the current icon rail. */
export const NAVIGATION_ROUTE_IDS: readonly OnboardingRouteId[] = [
  "dashboard",
  "decisions",
  "indicators",
  "kpi",
  "models",
  "lessons",
  "boards",
  "roadmap",
  "audit",
  "admin",
] as const;

export function getOnboardingRoute(id: OnboardingRouteId): OnboardingRouteDefinition | undefined {
  return ONBOARDING_ROUTES.find((route) => route.id === id);
}

function normalizePathname(location: string): string {
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

function patternMatches(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every(
    (segment, index) => segment.startsWith(":") || segment === pathSegments[index]
  );
}

export function matchOnboardingRoute(location: string): OnboardingRouteDefinition | undefined {
  const pathname = normalizePathname(location);
  return ONBOARDING_ROUTES.find((route) => patternMatches(route.pattern, pathname));
}

export function isRouteAccessible(routeId: OnboardingRouteId, role: Role | null): boolean {
  const route = getOnboardingRoute(routeId);
  if (!route) return false;
  if (route.access === "public" || route.access === "redirect") return true;
  return role !== null && route.roles.includes(role);
}
