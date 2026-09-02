"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export function LogoutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "group relative inline-flex h-11 items-center justify-center rounded text-rule-strong transition-colors duration-150 hover:bg-graphite-soft hover:text-paper",
        compact ? "w-11" : "gap-2 px-3 text-base",
        className
      )}
      aria-label={ru.common.logout}
      title={compact ? ru.common.logout : undefined}
    >
      <LogOut className="h-5 w-5" aria-hidden="true" />
      {!compact && ru.common.logout}
      {compact && (
        <span className="pointer-events-none absolute bottom-1/2 left-[calc(100%+12px)] z-50 w-max translate-y-1/2 rounded border border-rule bg-sheet px-3 py-2 text-base font-medium text-ink opacity-0 shadow-overlay transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          {ru.common.logout}
        </span>
      )}
    </button>
  );
}
