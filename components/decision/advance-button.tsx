"use client";

// Кнопка перехода на следующую стадию. Всегда идёт через
// POST /api/decisions/:id/advance — решение о допуске принимает сервер.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ru } from "@/lib/i18n/ru";
import { ruleDescription } from "@/lib/gates";
import type { Stage } from "@/lib/domain";

interface RuleResult {
  code: string;
  passed: boolean;
  explanation: string;
  responsible: string;
}

export function AdvanceButton({
  decisionId,
  toStage,
  canAdvance,
}: {
  decisionId: string;
  toStage: Stage;
  /** Есть ли у роли право на переход (проверяется и на сервере) */
  canAdvance: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<{ message: string; results: RuleResult[] } | null>(null);

  async function advance() {
    setBusy(true);
    setBlocked(null);
    const res = await fetch(`/api/decisions/${decisionId}/advance`, { method: "POST" });
    const body: { ok: boolean; message?: string; results?: RuleResult[] } = await res.json();
    setBusy(false);
    if (body.ok) {
      router.refresh();
      return;
    }
    setBlocked({ message: body.message ?? "Переход невозможен", results: body.results ?? [] });
  }

  if (!canAdvance) {
    return (
      <span className="text-xs text-slate-500">
        Переход по стадиям доступен инициатору, корпоративному секретарю и администратору.
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={advance} disabled={busy}>
        {busy ? "Проверка ворот…" : `Перейти к стадии «${ru.stages[toStage]}»`}
        <ArrowRight className="h-4 w-4" />
      </Button>

      {blocked && (
        <div
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-3"
          data-testid="gate-blocked"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-warn">
            <AlertTriangle className="h-4 w-4" />
            Переход заблокирован
          </div>
          <p className="mt-1 text-xs text-slate-700">{blocked.message}</p>
          <ul className="mt-2 space-y-2">
            {blocked.results
              .filter((r) => !r.passed)
              .map((r) => (
                <li key={r.code} className="text-xs">
                  <div className="font-medium text-slate-900">{ruleDescription(r.code)}</div>
                  <div className="text-brand-warn">{r.explanation}</div>
                  <div className="text-slate-500">Ответственный: {r.responsible}</div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
