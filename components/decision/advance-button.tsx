"use client";

// Кнопка перехода на следующую стадию. Всегда идёт через
// POST /api/decisions/:id/advance — решение о допуске принимает сервер.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertTriangle, LockKeyhole } from "lucide-react";
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
  gateAllowed,
}: {
  decisionId: string;
  toStage: Stage;
  /** Есть ли у роли право на переход (проверяется и на сервере) */
  canAdvance: boolean;
  /** Визуальный статус не заменяет повторную серверную проверку по клику. */
  gateAllowed?: boolean;
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
      <div className="flex max-w-md items-start gap-2 text-meta leading-5 text-muted">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Переход по стадиям доступен инициатору, корпоративному секретарю и администратору.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={advance}
        disabled={busy}
        variant={gateAllowed === false ? "signalOutline" : "default"}
        size="lg"
      >
        {busy ? "Проверка ворот…" : `Перейти к стадии «${ru.stages[toStage]}»`}
        <ArrowRight className="h-4 w-4" />
      </Button>

      {blocked && (
        <div
          role="alert"
          className="max-w-xl rounded-control border border-action/30 border-l-4 bg-action-soft p-4"
          data-testid="gate-blocked"
        >
          <div className="flex items-center gap-1.5 text-base font-semibold text-action">
            <AlertTriangle className="h-4 w-4" />
            Сервер подтвердил блокировку перехода
          </div>
          <p className="mt-1 text-table text-text">{blocked.message}</p>
          <ul className="mt-2 space-y-2">
            {blocked.results
              .filter((r) => !r.passed)
              .map((r) => (
                <li key={r.code} className="border-t border-action/20 pt-2 text-meta first:border-0 first:pt-0">
                  <div className="font-semibold text-text">{ruleDescription(r.code)}</div>
                  <div className="mt-0.5 leading-5 text-action">{r.explanation}</div>
                  <div className="mt-0.5 text-muted">Ответственный: {r.responsible}</div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
