"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TourPlacement, TourStep } from "@/lib/onboarding/types";

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Position {
  top: number;
  left: number;
  placement: TourPlacement;
}

interface TourSurfaceProps {
  tourTitle: string;
  tourDescription: string;
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  targetRect: SpotlightRect | null;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onDismiss: () => void;
  onRestart?: () => void;
  onChooseRole?: () => void;
  allowTargetInteraction?: boolean;
  requireTargetAction?: boolean;
  closing?: boolean;
  targetPending?: boolean;
  mandatory?: boolean;
  roleBrief?: {
    label: string;
    purpose: string;
    responsibilities: readonly string[];
  };
}

const VIEWPORT_MARGIN = 12;
const TARGET_GAP = 14;

function preferredPlacements(preferred: TourPlacement): TourPlacement[] {
  if (preferred === "center") return ["center"];
  const placements: TourPlacement[] = [preferred, "right", "bottom", "left", "top"];
  return placements.filter((placement, index) => placements.indexOf(placement) === index);
}

function candidatePosition(
  placement: TourPlacement,
  target: SpotlightRect,
  cardWidth: number,
  cardHeight: number
): { top: number; left: number } {
  switch (placement) {
    case "top":
      return {
        top: target.top - cardHeight - TARGET_GAP,
        left: target.left + target.width / 2 - cardWidth / 2,
      };
    case "bottom":
      return {
        top: target.top + target.height + TARGET_GAP,
        left: target.left + target.width / 2 - cardWidth / 2,
      };
    case "left":
      return {
        top: target.top + target.height / 2 - cardHeight / 2,
        left: target.left - cardWidth - TARGET_GAP,
      };
    case "right":
      return {
        top: target.top + target.height / 2 - cardHeight / 2,
        left: target.left + target.width + TARGET_GAP,
      };
    case "center":
      return {
        top: (window.innerHeight - cardHeight) / 2,
        left: (window.innerWidth - cardWidth) / 2,
      };
  }
}

function fitsViewport(position: { top: number; left: number }, width: number, height: number): boolean {
  return (
    position.top >= VIEWPORT_MARGIN &&
    position.left >= VIEWPORT_MARGIN &&
    position.top + height <= window.innerHeight - VIEWPORT_MARGIN &&
    position.left + width <= window.innerWidth - VIEWPORT_MARGIN
  );
}

function clampPosition(position: { top: number; left: number }, width: number, height: number) {
  return {
    top: Math.max(VIEWPORT_MARGIN, Math.min(position.top, window.innerHeight - height - VIEWPORT_MARGIN)),
    left: Math.max(VIEWPORT_MARGIN, Math.min(position.left, window.innerWidth - width - VIEWPORT_MARGIN)),
  };
}

function overlapArea(
  position: { top: number; left: number },
  width: number,
  height: number,
  target: SpotlightRect
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(position.left + width, target.left + target.width) -
      Math.max(position.left, target.left)
  );
  const overlapHeight = Math.max(
    0,
    Math.min(position.top + height, target.top + target.height) -
      Math.max(position.top, target.top)
  );
  return overlapWidth * overlapHeight;
}

function resolvePosition(
  target: SpotlightRect | null,
  preferred: TourPlacement,
  width: number,
  height: number
): Position {
  if (window.innerWidth <= 768) {
    const targetInLowerHalf = target
      ? target.top + target.height / 2 > window.innerHeight / 2
      : false;
    const sheet = clampPosition(
      {
        top: targetInLowerHalf ? VIEWPORT_MARGIN : window.innerHeight - height - VIEWPORT_MARGIN,
        left: VIEWPORT_MARGIN,
      },
      width,
      height
    );
    return { ...sheet, placement: "bottom" };
  }

  if (!target || preferred === "center") {
    const centered = clampPosition(
      { top: (window.innerHeight - height) / 2, left: (window.innerWidth - width) / 2 },
      width,
      height
    );
    return { ...centered, placement: "center" };
  }

  for (const placement of preferredPlacements(preferred)) {
    const candidate = candidatePosition(placement, target, width, height);
    if (fitsViewport(candidate, width, height)) return { ...candidate, placement };
  }

  const fallback = preferredPlacements(preferred)
    .map((placement) => {
      const clamped = clampPosition(
        candidatePosition(placement, target, width, height),
        width,
        height
      );
      return {
        ...clamped,
        placement,
        overlap: overlapArea(clamped, width, height, target),
      };
    })
    .sort((left, right) => left.overlap - right.overlap)[0]!;

  return {
    top: fallback.top,
    left: fallback.left,
    placement: fallback.placement,
  };
}

export function TourSurface({
  tourTitle,
  tourDescription,
  step,
  stepIndex,
  stepCount,
  targetRect,
  onBack,
  onNext,
  onSkip,
  onDismiss,
  onRestart,
  onChooseRole,
  allowTargetInteraction = false,
  requireTargetAction = false,
  closing = false,
  targetPending = false,
  mandatory = false,
  roleBrief,
}: TourSurfaceProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const isLast = stepIndex === stepCount - 1;

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!mounted || !cardRef.current) return;
    const update = () => {
      const card = cardRef.current;
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      setPosition(resolvePosition(targetRect, step.placement ?? "bottom", bounds.width, bounds.height));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted, step.id, step.placement, targetRect]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (requireTargetAction) {
      const target = document.querySelector<HTMLElement>(step.target);
      const interactive = target?.matches("button, a[href], input, select, textarea, [tabindex]")
        ? target
        : target?.querySelector<HTMLElement>(
            "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
          );
      interactive?.focus({ preventScroll: true });
      return;
    }
    card.focus({ preventScroll: true });
  }, [mounted, requireTargetAction, step.id, step.target]);

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || requireTargetAction || mandatory) return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === event.currentTarget) {
      event.preventDefault();
      first.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!mounted) return null;

  const dimmerClass = `onboarding-dimmer fixed z-[90] transition-[top,left,width,height] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
    mandatory ? "pointer-events-none" : "pointer-events-auto"
  }`;
  const progress = ((stepIndex + 1) / stepCount) * 100;

  return createPortal(
    <div
      className={`fixed inset-0 z-[89] transition-opacity duration-[140ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        closing ? "pointer-events-none opacity-0" : "pointer-events-none opacity-100"
      }`}
      data-testid="onboarding-tour"
      data-tour-id={step.id}
    >
      {closing && (
        <div className="pointer-events-auto fixed inset-0 z-[110]" aria-hidden="true" />
      )}
      {targetRect ? (
        <>
          <div
            className={dimmerClass}
            style={{ inset: `0 0 auto 0`, height: targetRect.top }}
            data-testid="onboarding-dimmer"
          />
          <div className={dimmerClass} style={{ top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height }} />
          <div
            className={dimmerClass}
            style={{
              top: targetRect.top,
              left: targetRect.left + targetRect.width,
              right: 0,
              height: targetRect.height,
            }}
          />
          <div
            className={dimmerClass}
            style={{ top: targetRect.top + targetRect.height, right: 0, bottom: 0, left: 0 }}
          />
          <div
            className="onboarding-spotlight pointer-events-none fixed z-[91] rounded-control transition-[top,left,width,height] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={targetRect}
            aria-hidden="true"
            data-testid="onboarding-spotlight"
          >
            <span
              className={`onboarding-focus-label absolute left-0 whitespace-nowrap rounded-control ${
                targetRect.top >= 44 ? "bottom-[calc(100%+11px)]" : "top-[calc(100%+11px)]"
              }`}
              data-testid="onboarding-focus-label"
            >
              Фокус · шаг {stepIndex + 1}
            </span>
          </div>
          {!mandatory && !allowTargetInteraction && (
            <div
              className="pointer-events-auto fixed z-[92]"
              style={targetRect}
              aria-hidden="true"
            />
          )}
        </>
      ) : (
        <div
          className={`onboarding-dimmer fixed inset-0 z-[90] ${mandatory ? "pointer-events-none" : "pointer-events-auto"}`}
          aria-hidden="true"
          data-testid="onboarding-dimmer"
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal={!mandatory && !requireTargetAction}
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-body"
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="pointer-events-auto fixed z-[100] max-h-[calc(100vh-24px)] w-[min(410px,calc(100vw-24px))] overflow-y-auto rounded-panel border border-line bg-surface p-5 text-text shadow-overlay outline-none transition-[top,left,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:p-6"
        style={{
          top: position?.top ?? "50%",
          left: position?.left ?? "50%",
          maxHeight: "calc(100vh - 24px)",
          opacity: position ? 1 : 0,
          transform: position ? undefined : "translate(-50%, -50%)",
        }}
        data-placement={position?.placement ?? "center"}
        data-mandatory={mandatory ? "true" : "false"}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-meta font-semibold uppercase tracking-[0.1em] text-muted">{tourTitle}</p>
            {step.section && <p className="mt-1 text-meta font-medium text-accent">{step.section}</p>}
            <h2 id="tour-step-title" className="mt-1 text-section font-semibold text-text">
              {step.title}
            </h2>
          </div>
          {mandatory ? (
            <span className="shrink-0 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-meta font-semibold uppercase tracking-[0.08em] text-accent">
              Всегда включено
            </span>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Закрыть текущую инструкцию"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div key={step.id} data-tour-step-content>
          {targetPending && step.target !== "body" && (
            <p className="mt-3 flex items-center gap-2 text-table font-medium text-accent" role="status">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" aria-hidden="true" />
              Подготавливаем выделение области…
            </p>
          )}
          <p id="tour-step-body" className="mt-3 text-base leading-6 text-muted">
            {step.body}
          </p>
          {stepIndex === 0 && roleBrief && (
            <section
              className="mt-4 rounded-control border-2 border-line-strong bg-canvas px-3.5 py-3"
              data-testid="onboarding-role-brief"
              aria-label={`Рабочий кабинет роли ${roleBrief.label}`}
            >
              <p className="text-meta font-semibold uppercase tracking-[0.08em] text-accent">
                Ваш кабинет · {roleBrief.label}
              </p>
              <p className="mt-1.5 text-table leading-5 text-text">{tourDescription}</p>
              <p className="mt-2 text-table leading-5 text-muted">{roleBrief.purpose}</p>
              <ul className="mt-2 space-y-1.5 text-table leading-5 text-text">
                {roleBrief.responsibilities.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="font-bold text-accent" aria-hidden="true">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {step.responsibility && (
            <div className="mt-4 border-l-2 border-accent pl-3">
              <p className="text-meta font-semibold uppercase tracking-[0.08em] text-muted">Что сделать</p>
              <p className="mt-1 text-table leading-5 text-text">{step.responsibility}</p>
            </div>
          )}
          {step.thesisContext && (
            <div className="mt-4 rounded-control bg-canvas px-3 py-2.5">
              <p className="text-meta font-semibold uppercase tracking-[0.08em] text-muted">Связь с методикой</p>
              <p className="mt-1 text-table leading-5 text-text">{step.thesisContext}</p>
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 text-meta text-muted">
            <span aria-live="polite">Шаг {stepIndex + 1} из {stepCount}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full bg-accent transition-[width] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {isLast && onRestart && onChooseRole ? (
            <>
              <Button type="button" variant="secondary" onClick={onBack}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Назад
              </Button>
              <Button type="button" onClick={onNext} className="sm:ml-auto">
                Открыть платформу самостоятельно
              </Button>
              <Button type="button" variant="secondary" onClick={onRestart}>
                Повторить экскурсию
              </Button>
              <Button type="button" variant="ghost" onClick={onChooseRole}>
                Выбрать другую роль
              </Button>
            </>
          ) : (
            <>
              {!mandatory && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="mr-auto min-h-10 px-1 text-table font-medium text-muted hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Пропустить
                </button>
              )}
              <Button type="button" variant="secondary" onClick={onBack} disabled={stepIndex === 0}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Назад
              </Button>
              {requireTargetAction && !isLast ? (
                <span className="max-w-48 text-right text-meta text-muted" role="status">
                  Продолжите действием в выделенной области
                </span>
              ) : (
                <Button type="button" onClick={onNext}>
                  {isLast ? (mandatory ? "Сначала" : "Готово") : "Далее"}
                  {!isLast && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
