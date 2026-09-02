import type { Role } from "@/lib/domain";

export type OnboardingRole = Role | "GUEST";

export type TourMode = "PAGE" | "ROLE" | "THESIS";

export type TourPlacement = "top" | "right" | "bottom" | "left" | "center";

export type OnboardingRouteId =
  | "home"
  | "login"
  | "dashboard"
  | "decisions"
  | "decision-new"
  | "decision-passport"
  | "indicators"
  | "indicator-detail"
  | "kpi"
  | "models"
  | "lessons"
  | "boards"
  | "roadmap"
  | "audit"
  | "admin"
  | "search";

export interface TourRouteRef {
  routeId: OnboardingRouteId;
  /** Exact query values required for this tour. Omitted keys are ignored. */
  query?: Readonly<Record<string, string>>;
}

export type TourTargetPolicy = "required" | "optional-rbac";

export interface TourStep {
  /** Globally unique, stable identifier; never derived from translated copy. */
  id: string;
  /** One-based contiguous order inside a tour. */
  order: number;
  /** Concrete route/pattern for cross-page ROLE and THESIS walkthroughs. */
  route?: string;
  routeRef: TourRouteRef;
  /** Stable selector contract. `body` is reserved for untargeted introductions. */
  target: string;
  targetPolicy?: TourTargetPolicy;
  placement?: TourPlacement;
  title: string;
  body: string;
  responsibility?: string;
  thesisContext?: string;
  roles?: readonly Role[];
  section?: string;
  advance?: "next" | "target-click";
}

export interface TourDefinition {
  /** Globally unique logical ID. Version is stored separately in progress keys. */
  id: string;
  version: number;
  mode: TourMode;
  locale: string;
  title: string;
  description: string;
  roles?: readonly Role[];
  /** Initial route and PAGE-tour matching contract. */
  route?: string;
  routeRef: TourRouteRef;
  autoStart: boolean;
  estimatedMinutes?: number;
  steps: readonly TourStep[];
}

export type TourProgressStatus = "in_progress" | "completed" | "skipped" | "dismissed";

export interface TourProgressKey {
  userId: string;
  role: OnboardingRole;
  tourId: string;
  tourVersion: number;
}

export interface TourProgressRecord extends TourProgressKey {
  status: TourProgressStatus;
  currentStepId?: string;
  updatedAt: string;
}

export interface TourProgressUpdate {
  status: TourProgressStatus;
  currentStepId?: string;
}

/** Minimal Web Storage surface, injectable for deterministic unit tests. */
export interface OnboardingStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export type SearchParamsInput =
  | string
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>;
