"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getTourById, listToursForRole, resolvePageTour } from "@/lib/onboarding";
import {
  listProgress,
  resetOnboardingProgress,
  setTourState,
} from "@/lib/onboarding/progress";
import type {
  OnboardingRole,
  TourDefinition,
  TourProgressRecord,
} from "@/lib/onboarding/types";
import { getOnboardingRoleProfile } from "@/lib/onboarding/roles";
import { TourSurface, type SpotlightRect } from "@/components/onboarding/tour-surface";

interface OnboardingContextValue {
  activeTour: TourDefinition | null;
  pageTour: TourDefinition | null;
  availableTours: readonly TourDefinition[];
  progress: TourProgressRecord[];
  startTour: (tour: TourDefinition) => void;
  startTourById: (tourId: string) => boolean;
  replayPageTour: () => void;
  startRoleTour: () => boolean;
  startThesisTour: () => boolean;
  resetTraining: () => number;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);
const ACTIVE_TOUR_SESSION_KEY = "decision-passport:onboarding:active-tour";
const LAST_DECISION_ROUTE_KEY = "decision-passport:onboarding:last-decision-route";
const LAST_INDICATOR_ROUTE_KEY = "decision-passport:onboarding:last-indicator-route";
const E2E_AUTO_START_BYPASS_KEY = "decision-passport:onboarding:e2e-bypass";
const TARGET_WAIT_MS = 2_400;

interface ActiveTourSession {
  tourId: string;
  tourVersion: number;
  stepId: string;
  userId: string;
  role: OnboardingRole;
}

function readActiveSession(): ActiveTourSession | null {
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_TOUR_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveTourSession>;
    if (
      typeof parsed.tourId !== "string" ||
      !Number.isInteger(parsed.tourVersion) ||
      typeof parsed.stepId !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.role !== "string"
    ) {
      return null;
    }
    return parsed as ActiveTourSession;
  } catch {
    return null;
  }
}

function writeActiveSession(session: ActiveTourSession | null): void {
  try {
    if (session) window.sessionStorage.setItem(ACTIVE_TOUR_SESSION_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(ACTIVE_TOUR_SESSION_KEY);
  } catch {
    // Guidance persistence is optional; the product remains usable without it.
  }
}

function pageTourAutoStartIsBypassed(): boolean {
  try {
    return window.localStorage.getItem(E2E_AUTO_START_BYPASS_KEY) === "1";
  } catch {
    return false;
  }
}

function routeMatches(pattern: string, currentRoute: string): boolean {
  const [patternPath = "", patternQuery = ""] = pattern.split("?");
  const [currentPath = "", currentQuery = ""] = currentRoute.split("?");
  const pathExpression = patternPath
    .split("/")
    .map((part) => (part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  if (!new RegExp(`^${pathExpression}$`).test(currentPath)) return false;
  const required = new URLSearchParams(patternQuery);
  const actual = new URLSearchParams(currentQuery);
  return Array.from(required.entries()).every(([key, value]) => actual.get(key) === value);
}

function concreteRoute(pattern: string, currentRoute: string): string | null {
  if (!pattern.includes(":")) return pattern;
  const currentPath = currentRoute.split("?")[0] ?? "";
  const [, query = ""] = pattern.split("?");
  const withRequiredQuery = (path: string) => `${path}${query ? `?${query}` : ""}`;
  const decisionMatch = currentPath.match(/^\/decisions\/(?!new(?:\/|$))([^/]+)/);
  const indicatorMatch = currentPath.match(/^\/indicators\/([^/]+)/);
  if (pattern.startsWith("/decisions/:id") && decisionMatch) {
    return pattern.replace(":id", decisionMatch[1]!);
  }
  if (pattern.startsWith("/indicators/:id") && indicatorMatch) {
    return pattern.replace(":id", indicatorMatch[1]!);
  }
  try {
    const storageKey = pattern.startsWith("/decisions/:id")
      ? LAST_DECISION_ROUTE_KEY
      : LAST_INDICATOR_ROUTE_KEY;
    const remembered = window.sessionStorage.getItem(storageKey);
    if (remembered) return withRequiredQuery(remembered);
  } catch {
    // A dynamic guided route can still be skipped safely when storage is unavailable.
  }
  return null;
}

function eligibleForRole(tour: TourDefinition, role: OnboardingRole): boolean {
  return !tour.roles || tour.roles.length === 0 || (role !== "GUEST" && tour.roles.includes(role));
}

function stepIsEligible(step: TourDefinition["steps"][number], role: OnboardingRole): boolean {
  return !step.roles || step.roles.length === 0 || (role !== "GUEST" && step.roles.includes(role));
}

function runnableSteps(tour: TourDefinition, role: OnboardingRole) {
  return tour.steps.filter(
    (step) =>
      stepIsEligible(step, role) &&
      !(tour.mode === "THESIS" && role !== "GUEST" && step.routeRef.routeId === "login")
  );
}

export function OnboardingProvider({
  userId,
  role,
  children,
}: {
  userId: string;
  role: OnboardingRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams.toString();
  const currentRoute = `${pathname}${search ? `?${search}` : ""}`;
  const pageTour = useMemo(
    () => resolvePageTour(currentRoute, role) ?? null,
    [currentRoute, role]
  );
  const availableTours = useMemo(
    () => listToursForRole(role).filter((tour) => eligibleForRole(tour, role)),
    [role]
  );
  const roleBrief = useMemo(
    () => (role === "GUEST" ? undefined : getOnboardingRoleProfile(role)),
    [role]
  );

  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const [progressRevision, setProgressRevision] = useState(0);
  const [restorationComplete, setRestorationComplete] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeTimer = useRef(0);
  const closingRef = useRef(false);
  const requiredMissingSteps = useRef(new Set<string>());

  const [progress, setProgress] = useState<TourProgressRecord[]>([]);

  useEffect(() => {
    void progressRevision;
    setProgress(listProgress({ userId, role }));
  }, [progressRevision, role, userId]);

  const progressKey = useCallback(
    (tour: TourDefinition) => ({
      userId,
      role,
      tourId: tour.id,
      tourVersion: tour.version,
    }),
    [role, userId]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const decisionPath = pathname.match(/^\/decisions\/([^/]+)/)?.[0];
        const indicatorPath = pathname.match(/^\/indicators\/([^/]+)/)?.[0];
        if (decisionPath && decisionPath !== "/decisions/new") {
          window.sessionStorage.setItem(LAST_DECISION_ROUTE_KEY, decisionPath);
        } else {
          const decisionLink = Array.from(
            document.querySelectorAll<HTMLAnchorElement>('a[href^="/decisions/"]')
          ).find((link) => !link.getAttribute("href")?.startsWith("/decisions/new"));
          const href = decisionLink?.getAttribute("href")?.split("?")[0];
          if (href) window.sessionStorage.setItem(LAST_DECISION_ROUTE_KEY, href);
        }
        if (indicatorPath) {
          window.sessionStorage.setItem(LAST_INDICATOR_ROUTE_KEY, indicatorPath);
        } else {
          const indicatorLink = document.querySelector<HTMLAnchorElement>('a[href^="/indicators/"]');
          const href = indicatorLink?.getAttribute("href")?.split("?")[0];
          if (href) window.sessionStorage.setItem(LAST_INDICATOR_ROUTE_KEY, href);
        }
      } catch {
        // Cross-page continuation is enhanced by memory but does not depend on it.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const closeTour = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closingRef.current = true;
    setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 140;
    closeTimer.current = window.setTimeout(() => {
      setActiveTour(null);
      setStepIndex(0);
      setTargetRect(null);
      setTargetReady(false);
      setClosing(false);
      closingRef.current = false;
      window.requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
    }, delay);
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const startTour = useCallback(
    (tour: TourDefinition) => {
      if (!eligibleForRole(tour, role)) return;
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const eligibleSteps = runnableSteps(tour, role);
      if (eligibleSteps.length === 0) return;
      const runnableTour =
        eligibleSteps.length === tour.steps.length ? tour : { ...tour, steps: eligibleSteps };
      window.clearTimeout(closeTimer.current);
      closingRef.current = false;
      setClosing(false);
      setActiveTour(runnableTour);
      setStepIndex(0);
      setTargetRect(null);
      setTargetReady(false);
      requiredMissingSteps.current.clear();
      setTourState(progressKey(tour), {
        status: "in_progress",
        currentStepId: eligibleSteps[0]!.id,
      });
      if (tour.mode !== "PAGE") {
        writeActiveSession({
          tourId: tour.id,
          tourVersion: tour.version,
          stepId: eligibleSteps[0]!.id,
          userId,
          role,
        });
      }
      setProgressRevision((value) => value + 1);
    },
    [progressKey, role, userId]
  );

  const startTourById = useCallback(
    (tourId: string) => {
      const tour = getTourById(tourId, role);
      if (!tour || !eligibleForRole(tour, role)) return false;
      startTour(tour);
      return true;
    },
    [role, startTour]
  );

  const finishWith = useCallback(
    (status: "completed" | "skipped" | "dismissed") => {
      if (!activeTour || closingRef.current) return;
      setTourState(progressKey(activeTour), { status });
      writeActiveSession(null);
      setProgressRevision((value) => value + 1);
      closeTour();
    },
    [activeTour, closeTour, progressKey]
  );

  const moveToStep = useCallback(
    (direction: 1 | -1) => {
      if (!activeTour || closingRef.current) return;
      let candidate = stepIndex + direction;
      while (
        candidate >= 0 &&
        candidate < activeTour.steps.length &&
        !stepIsEligible(activeTour.steps[candidate]!, role)
      ) {
        candidate += direction;
      }
      if (candidate >= activeTour.steps.length) {
        if (activeTour.mode === "PAGE") {
          setStepIndex(0);
          setTargetRect(null);
          setTargetReady(false);
          setTourState(progressKey(activeTour), {
            status: "in_progress",
            currentStepId: activeTour.steps[0]!.id,
          });
          setProgressRevision((value) => value + 1);
          return;
        }
        finishWith(requiredMissingSteps.current.size > 0 ? "dismissed" : "completed");
        return;
      }
      if (candidate < 0) return;
      setClosing(false);
      setStepIndex(candidate);
      setTargetRect(null);
      setTargetReady(false);
      setTourState(progressKey(activeTour), {
        status: "in_progress",
        currentStepId: activeTour.steps[candidate]!.id,
      });
      if (activeTour.mode !== "PAGE") {
        writeActiveSession({
          tourId: activeTour.id,
          tourVersion: activeTour.version,
          stepId: activeTour.steps[candidate]!.id,
          userId,
          role,
        });
      }
      setProgressRevision((value) => value + 1);
    },
    [activeTour, finishWith, progressKey, role, stepIndex, userId]
  );

  useEffect(() => {
    const session = readActiveSession();
    if (!session) {
      setRestorationComplete(true);
      return;
    }
    const sameIdentity = session.userId === userId && session.role === role;
    const guestThesisHandoff = session.role === "GUEST" && role !== "GUEST";
    const tour = getTourById(session.tourId, role);
    if (
      !tour ||
      tour.version !== session.tourVersion ||
      (!sameIdentity && !(guestThesisHandoff && tour.mode === "THESIS"))
    ) {
      writeActiveSession(null);
      setRestorationComplete(true);
      return;
    }
    const eligibleSteps = runnableSteps(tour, role);
    const restoredIndex = eligibleSteps.findIndex((step) => step.id === session.stepId);
    if (restoredIndex < 0) {
      writeActiveSession(null);
      setRestorationComplete(true);
      return;
    }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveTour({ ...tour, steps: eligibleSteps });
    setStepIndex(restoredIndex);
    setTargetReady(false);
    setTourState(progressKey(tour), { status: "in_progress", currentStepId: session.stepId });
    writeActiveSession({ ...session, userId, role });
    setProgressRevision((value) => value + 1);
    setRestorationComplete(true);
  }, [progressKey, role, userId]);

  useEffect(() => {
    if (!restorationComplete || !pageTour || pageTourAutoStartIsBypassed()) return;
    if (activeTour?.mode !== "PAGE" && activeTour !== null) return;
    if (activeTour?.id === pageTour.id) return;
    const frame = window.requestAnimationFrame(() => {
      startTour(pageTour);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTour, pageTour, restorationComplete, startTour]);

  const activeStep = activeTour?.steps[stepIndex] ?? null;

  useEffect(() => {
    if (!activeTour || !activeStep) return;
    if (!stepIsEligible(activeStep, role)) {
      moveToStep(1);
      return;
    }

    if (
      activeTour.mode === "PAGE" &&
      pageTour &&
      activeTour.id !== pageTour.id
    ) {
      return;
    }

    if (activeStep.route && !routeMatches(activeStep.route, currentRoute)) {
      if (role === "GUEST" && activeStep.routeRef.routeId !== "login") return;
      const destination = concreteRoute(activeStep.route, currentRoute);
      if (destination) {
        setTargetRect(null);
        setTargetReady(false);
        router.push(destination);
      }
      else {
        console.warn(`[onboarding] Cannot resolve route "${activeStep.route}" for step "${activeStep.id}".`);
        moveToStep(1);
      }
      return;
    }

    if (activeStep.target === "body") {
      setTargetRect(null);
      setTargetReady(true);
      return;
    }

    let element: HTMLElement | null = null;
    let frame = 0;
    let settleFrame = 0;
    let timeout = 0;
    let observer: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let targetClickHandler: ((event: Event) => void) | null = null;

    const isUsableTarget = (candidate: Element) => {
      if (!document.documentElement.contains(candidate)) return false;
      const bounds = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    };

    const updateRect = () => {
      if (!element || !isUsableTarget(element)) {
        setTargetRect(null);
        setTargetReady(false);
        return;
      }
      const rect = element.getBoundingClientRect();
      const padding = 7;
      const top = Math.max(4, rect.top - padding);
      const left = Math.max(4, rect.left - padding);
      const right = Math.min(window.innerWidth - 4, rect.right + padding);
      const bottom = Math.min(window.innerHeight - 4, rect.bottom + padding);
      setTargetRect({
        top,
        left,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
      });
      setTargetReady(true);
    };

    const detachTarget = () => {
      if (element && targetClickHandler) {
        element.removeEventListener("click", targetClickHandler);
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      targetClickHandler = null;
      element = null;
    };

    const activate = (candidate: Element) => {
      element = candidate as HTMLElement;
      const bounds = element.getBoundingClientRect();
      const outside =
        bounds.top < 72 ||
        bounds.bottom > window.innerHeight - 24 ||
        bounds.left < 8 ||
        bounds.right > window.innerWidth - 8;
      if (outside) {
        element.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "center",
          inline: "nearest",
        });
      }
      frame = window.requestAnimationFrame(() => {
        settleFrame = window.requestAnimationFrame(updateRect);
      });
      resizeObserver = new ResizeObserver(updateRect);
      resizeObserver.observe(element);
      if (activeStep.advance === "target-click") {
        targetClickHandler = (event) => {
          if (
            activeStep.target === '[data-tour="login-role-groups"]' &&
            (!(event.target instanceof Element) ||
              !event.target.closest("button:not([disabled])"))
          ) {
            return;
          }
          moveToStep(1);
        };
        element.addEventListener("click", targetClickHandler);
      }
    };

    const findTarget = () => {
      try {
        const candidate = Array.from(document.querySelectorAll(activeStep.target)).find(
          isUsableTarget
        );
        if (!candidate) return false;
        activate(candidate);
        window.clearTimeout(timeout);
        timeout = 0;
        return true;
      } catch (error) {
        console.warn(`[onboarding] Invalid selector "${activeStep.target}" in step "${activeStep.id}".`, error);
        return false;
      }
    };

    const scheduleMissingTarget = () => {
      if (timeout) return;
      timeout = window.setTimeout(() => {
        timeout = 0;
        if (element || findTarget()) return;
        const level = activeStep.targetPolicy === "optional-rbac" ? "debug" : "warn";
        if (activeStep.targetPolicy !== "optional-rbac") {
          requiredMissingSteps.current.add(activeStep.id);
        }
        console[level](`[onboarding] Target "${activeStep.target}" is missing for step "${activeStep.id}"; step skipped.`);
        window.dispatchEvent(
          new CustomEvent("onboarding:missing-target", {
            detail: { tourId: activeTour.id, stepId: activeStep.id, target: activeStep.target },
          })
        );
        if (role === "GUEST" && activeStep.advance === "target-click") {
          finishWith("dismissed");
        } else {
          moveToStep(1);
        }
      }, TARGET_WAIT_MS);
    };

    observer = new MutationObserver(() => {
      if (element && !isUsableTarget(element)) {
        detachTarget();
        setTargetRect(null);
        setTargetReady(false);
      }
      if (!element && !findTarget()) scheduleMissingTarget();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tour", "class", "style", "hidden"],
    });
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    if (!findTarget()) {
      setTargetRect(null);
      setTargetReady(false);
      scheduleMissingTarget();
    }

    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
      detachTarget();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [activeStep, activeTour, currentRoute, finishWith, moveToStep, pageTour, role, router]);

  useEffect(() => {
    if (!activeTour) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (activeTour.mode === "PAGE" && !pageTourAutoStartIsBypassed()) return;
        finishWith("dismissed");
      }
      if (event.key === "ArrowRight" && !(role === "GUEST" && activeStep?.advance === "target-click")) {
        event.preventDefault();
        moveToStep(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveToStep(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeStep?.advance, activeTour, finishWith, moveToStep, role]);

  const resetTraining = useCallback(() => {
    const removed = resetOnboardingProgress({ userId, role });
    writeActiveSession(null);
    setProgressRevision((value) => value + 1);
    closeTour();
    return removed;
  }, [closeTour, role, userId]);

  const restartActiveTour = useCallback(() => {
    if (!activeTour || activeTour.steps.length === 0 || closingRef.current) return;
    setStepIndex(0);
    setTargetReady(false);
    setTourState(progressKey(activeTour), {
      status: "in_progress",
      currentStepId: activeTour.steps[0]!.id,
    });
    writeActiveSession({
      tourId: activeTour.id,
      tourVersion: activeTour.version,
      stepId: activeTour.steps[0]!.id,
      userId,
      role,
    });
    setProgressRevision((value) => value + 1);
  }, [activeTour, progressKey, role, userId]);

  const chooseAnotherRole = useCallback(() => {
    if (!activeTour || closingRef.current) return;
    setTourState(progressKey(activeTour), { status: "completed" });
    writeActiveSession(null);
    setProgressRevision((value) => value + 1);
    closeTour();
    router.push("/login");
  }, [activeTour, closeTour, progressKey, router]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      activeTour,
      pageTour,
      availableTours,
      progress,
      startTour,
      startTourById,
      replayPageTour: () => pageTour && startTour(pageTour),
      startRoleTour: () => {
        const tour = availableTours.find((item) => item.mode === "ROLE");
        if (!tour) return false;
        startTour(tour);
        return true;
      },
      startThesisTour: () => {
        const tour = availableTours.find((item) => item.mode === "THESIS");
        if (!tour) return false;
        startTour(tour);
        return true;
      },
      resetTraining,
    }),
    [activeTour, availableTours, pageTour, progress, resetTraining, startTour, startTourById]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {activeTour && activeStep && (
        <TourSurface
          tourTitle={activeTour.title}
          tourDescription={activeTour.description}
          step={activeStep}
          stepIndex={stepIndex}
          stepCount={activeTour.steps.length}
          targetRect={targetRect}
          onBack={() => moveToStep(-1)}
          onNext={() => moveToStep(1)}
          onSkip={() => finishWith("skipped")}
          onDismiss={() => finishWith("dismissed")}
          onRestart={activeTour.mode === "THESIS" ? restartActiveTour : undefined}
          onChooseRole={activeTour.mode === "THESIS" ? chooseAnotherRole : undefined}
          allowTargetInteraction={activeStep.advance === "target-click"}
          requireTargetAction={role === "GUEST" && activeStep.advance === "target-click"}
          closing={closing}
          targetPending={!targetReady && activeStep.target !== "body"}
          roleBrief={activeTour.mode === "PAGE" ? roleBrief : undefined}
          mandatory={activeTour.mode === "PAGE"}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return context;
}

export function useOptionalOnboarding(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}
