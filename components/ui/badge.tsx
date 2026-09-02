import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-4",
  {
    variants: {
      variant: {
        default: "bg-brand-card text-brand",
        accent: "bg-brand text-white",
        outline: "border border-slate-300 text-slate-700",
        warn: "bg-amber-50 text-brand-warn border border-amber-200",
        success: "bg-emerald-50 text-emerald-800 border border-emerald-200",
        danger: "bg-red-50 text-red-800 border border-red-200",
        neutral: "bg-slate-100 text-slate-700",
        // Принципиальное различие природы числа:
        fact: "bg-emerald-50 text-emerald-800 border border-emerald-300",
        forecast: "bg-blue-50 text-blue-800 border border-blue-300 border-dashed",
        assumption: "bg-amber-50 text-brand-warn border border-amber-300 italic",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Бейдж уровня критичности A/B/C */
export function CriticalityBadge({ level, className }: { level: string; className?: string }) {
  const styles: Record<string, string> = {
    A: "bg-brand text-white",
    B: "bg-brand-accent text-white",
    C: "bg-slate-200 text-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-bold",
        styles[level] ?? styles.C,
        className
      )}
      title={`Уровень критичности ${level}`}
    >
      {level}
    </span>
  );
}
