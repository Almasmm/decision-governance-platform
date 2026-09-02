import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-ui font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "bg-accent text-surface hover:bg-obsidian",
        secondary: "border border-line bg-surface text-text hover:border-accent hover:bg-accent-soft",
        outline: "border border-line-strong bg-transparent text-text hover:border-accent hover:text-accent",
        ghost: "text-muted hover:bg-surface-raised hover:text-text",
        signal: "bg-action text-surface hover:bg-obsidian",
        signalOutline: "border border-action bg-transparent text-action hover:bg-action-soft",
      },
      size: {
        default: "h-9 px-4 text-base",
        sm: "h-8 px-3 text-table",
        lg: "h-11 px-5 text-lead",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
