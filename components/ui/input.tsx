import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:bg-slate-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-20 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent",
      className
    )}
    {...props}
  />
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-xs font-medium text-slate-600", className)} {...props} />;
}
