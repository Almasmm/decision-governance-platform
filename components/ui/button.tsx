import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand-accent",
        secondary: "bg-brand-card text-brand hover:bg-blue-100 border border-blue-200",
        outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        ghost: "text-slate-700 hover:bg-slate-100",
        destructive: "bg-red-700 text-white hover:bg-red-800",
        warn: "bg-brand-warn text-white hover:bg-amber-700",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-10 px-6",
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
