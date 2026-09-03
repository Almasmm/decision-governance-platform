"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenCheck, CircleHelp, GraduationCap, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalOnboarding } from "@/components/onboarding/onboarding-provider";
import { Button } from "@/components/ui/button";

export function OnboardingHelp({ variant = "shell" }: { variant?: "shell" | "login" }) {
  const onboarding = useOptionalOnboarding();
  if (!onboarding) return null;
  return <ConnectedOnboardingHelp variant={variant} onboarding={onboarding} />;
}

function ConnectedOnboardingHelp({
  variant,
  onboarding,
}: {
  variant: "shell" | "login";
  onboarding: NonNullable<ReturnType<typeof useOptionalOnboarding>>;
}) {
  const {
    pageTour,
    availableTours,
    replayPageTour,
    startRoleTour,
    startTourById,
    resetTraining,
  } = onboarding;
  const [open, setOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const roleTour = availableTours.find((tour) => tour.mode === "ROLE");
  const thesisTours = availableTours.filter((tour) => tour.mode === "THESIS");
  const pageTours = availableTours.filter((tour) => tour.mode === "PAGE");

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
    const closeOnOutside = (event: MouseEvent) => {
      const node = event.target as Node;
      if (!panelRef.current?.contains(node) && !triggerRef.current?.contains(node)) closePanel();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closePanel();
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closePanel, open]);

  const launch = (action: () => void | boolean) => {
    setOpen(false);
    setResetMessage(null);
    triggerRef.current?.focus({ preventScroll: true });
    window.requestAnimationFrame(() => action());
  };

  return (
    <div className={cn("relative", variant === "login" && "inline-flex")} data-tour="help-control">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-control font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          variant === "shell"
            ? "min-w-10 border border-line bg-surface px-3 text-table text-text hover:border-accent hover:bg-accent-soft"
            : "border border-rule-strong px-4 text-base text-paper hover:bg-white/10"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Открыть центр обучения"
      >
        <CircleHelp className="h-4 w-4" aria-hidden="true" />
        <span className={variant === "shell" ? "hidden 2xl:inline" : undefined}>Обучение</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Обучение DecisionPassport"
          tabIndex={-1}
          className={cn(
            "absolute z-[70] mt-2 w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-panel border border-line bg-surface text-left text-text shadow-overlay",
            variant === "shell" ? "right-0 top-full" : "left-0 top-full"
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-meta font-semibold uppercase tracking-[0.1em] text-muted">Центр помощи</p>
              <h2 className="mt-1 text-lead font-semibold">Обучение DecisionPassport</h2>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Закрыть центр обучения"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-2">
              <Button
                type="button"
                variant="secondary"
                className="justify-start"
                disabled={!pageTour}
                onClick={() => launch(replayPageTour)}
              >
                <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                Обучение по этой странице
              </Button>
              {roleTour && (
                <Button
                  type="button"
                  variant="secondary"
                  className="justify-start"
                  onClick={() => launch(startRoleTour)}
                >
                  <CircleHelp className="h-4 w-4" aria-hidden="true" />
                  Экскурсия по моей роли
                </Button>
              )}
              {thesisTours.map((tour) => (
                <Button
                  key={tour.id}
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-10 justify-start whitespace-normal py-2 text-left"
                  onClick={() => launch(() => startTourById(tour.id))}
                >
                  <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tour.id === "thesis-jury-methodology"
                    ? "Демонстрация научной модели"
                    : tour.title}
                </Button>
              ))}
            </div>

            {pageTours.length > 0 && (
              <section
                aria-labelledby="training-progress-title"
                className="rounded-control border border-accent bg-accent-soft px-3.5 py-3"
              >
                <h3 id="training-progress-title" className="text-table font-semibold text-text">
                  Постоянное обучение включено
                </h3>
                <p className="mt-1.5 text-meta leading-5 text-muted">
                  На каждой доступной странице автоматически работает её инструкция. Закрыть или
                  пропустить PAGE-обучение нельзя; после последнего шага оно начинается сначала.
                </p>
                <p className="mt-2 font-technical text-meta font-semibold text-accent">
                  {pageTours.length} инструкций доступны вашей роли
                </p>
              </section>
            )}

            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => {
                  const removed = resetTraining();
                  setResetMessage(
                    removed > 0 ? `Сброшено разделов: ${removed}. Бизнес-данные не изменены.` : "Обучение уже сброшено."
                  );
                }}
                className="inline-flex min-h-9 items-center gap-2 text-table font-medium text-muted hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Начать обучение заново
              </button>
              {resetMessage && (
                <p className="mt-2 text-meta text-muted" role="status">
                  {resetMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
