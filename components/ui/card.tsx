import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A card is reserved for a genuinely separate entity or interactive choice.
 * Page structure should prefer bands, rails and split views.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-panel bg-surface shadow-panel", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-5 pb-3 pt-5", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-section font-semibold tracking-[-0.015em] text-text", className)} {...props} />;
}

/** Подпись справа в шапке раздела: контекст расчёта, период, выборка. */
export function CardNote({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-table text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 pt-2", className)} {...props} />;
}

/** Вложенный блок внутри раздела: линейка сверху вместо рамки. */
export function Subsection({
  title,
  note,
  className,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border-t border-line pt-5", className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-lead font-semibold text-text">{title}</h3>
        {note && <span className="text-table text-muted">{note}</span>}
      </div>
      {children}
    </div>
  );
}
