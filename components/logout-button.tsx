"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { ru } from "@/lib/i18n/ru";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-3.5 w-3.5" />
      {ru.common.logout}
    </button>
  );
}
