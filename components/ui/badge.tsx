import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Семантика: цвет означает ровно одно — требуется ли действие ответственного лица.
 * Спокойное/разрешённое состояние — структурный графит; ожидающее человека — сигнал.
 * Природа числа (факт/прогноз/допущение) различается ещё и формой рамки,
 * чтобы смысл не зависел только от цвета (DESIGN.md § 2).
 */
const badgeVariants = cva(
  "inline-flex min-h-5 items-center gap-1 rounded px-2 py-0.5 text-meta font-medium leading-4 align-middle",
  {
    variants: {
      variant: {
        // Спокойные состояния
        neutral: "bg-surface-raised text-muted",
        outline: "border border-line-strong text-text",
        calm: "bg-surface-raised text-muted",
        /** Разрешено, подтверждено, гейт пройден */
        resolved: "bg-success text-surface",
        /** То же, но лёгким весом — в плотных таблицах */
        resolvedSoft: "bg-accent-soft text-accent",
        /** Требуется действие ответственного лица */
        action: "bg-action text-surface",
        /** Частично: контур без заливки */
        partial: "border border-action text-action",
        /** Код, идентификатор, значение перечисления */
        technical: "border border-line font-technical text-muted",

        // Природа числа — цвет + форма
        fact: "border border-text bg-surface text-text",
        forecast: "border border-dashed border-muted text-muted",
        assumption: "hatch-assumption border border-dotted border-action text-action",

        // Совместимость со старыми именами
        default: "bg-surface-raised text-muted",
        accent: "bg-accent text-surface",
        success: "bg-accent-soft text-accent",
        warn: "border border-action text-action",
        danger: "bg-danger text-surface",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * Уровень критичности. Вес формы соответствует объёму обязательных требований:
 * A — сплошная заливка, B — контур, C — тонкая линейка.
 */
export function CriticalityBadge({ level, className }: { level: string; className?: string }) {
  const styles: Record<string, string> = {
    A: "border border-obsidian bg-obsidian text-surface",
    B: "border-2 border-accent bg-surface text-accent",
    C: "border border-line-strong bg-surface-raised text-muted",
  };
  const label: Record<string, string> = {
    A: "Уровень критичности A — стратегическое решение",
    B: "Уровень критичности B — существенное решение",
    C: "Уровень критичности C — типовая операция",
  };
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-control px-2 font-technical text-table font-bold leading-none",
        styles[level] ?? styles.C,
        className
      )}
      title={`Уровень критичности ${level}`}
      aria-label={label[level] ?? label.C}
    >
      {level}
    </span>
  );
}
