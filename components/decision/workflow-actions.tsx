"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { submitForReview, returnDecision } from "@/app/actions/decisions";

export function WorkflowActions({
  decisionId,
  status,
  canSubmit,
  canReturn,
}: {
  decisionId: string;
  status: string;
  canSubmit: boolean;
  canReturn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [reason, setReason] = useState("");

  const submittable = canSubmit && (status === "DRAFT" || status === "RETURNED");
  const returnable = canReturn && status === "IN_REVIEW";

  if (!submittable && !returnable) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await submitForReview(decisionId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function doReturn() {
    setBusy(true);
    setError(null);
    const result = await returnDecision(decisionId, reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowReturn(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Действия workflow">
        {submittable && (
          <Button type="button" size="sm" disabled={busy} onClick={submit}>
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Отправка…" : "Отправить на экспертизу"}
          </Button>
        )}
        {returnable && (
          <Button
            type="button"
            variant="signalOutline"
            size="sm"
            aria-expanded={showReturn}
            aria-controls="return-decision-reason"
            onClick={() => setShowReturn((visible) => !visible)}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Вернуть на доработку
          </Button>
        )}
      </div>

      {showReturn && (
        <section
          id="return-decision-reason"
          className="max-w-2xl border-l-2 border-action bg-action-soft px-4 py-3"
          aria-labelledby="return-reason-label"
        >
          <div className="mb-3 flex items-start gap-2 text-action">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-table">
              Возврат останавливает экспертизу. Причина попадёт в audit trail и должна точно
              указывать отсутствующее доказательство или требуемую доработку.
            </p>
          </div>
          <Label id="return-reason-label" htmlFor="ret-reason">
            Причина возврата (фиксируется в аудите)
          </Label>
          <Textarea
            id="ret-reason"
            className="min-h-20"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Чего именно не хватает в доказательной базе"
          />
          <Button
            type="button"
            className="mt-3"
            size="sm"
            variant="signal"
            disabled={busy || reason.trim().length < 5}
            onClick={doReturn}
          >
            {busy ? "Возврат…" : "Вернуть на доработку"}
          </Button>
        </section>
      )}

      {error && (
        <p className="text-table text-action" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
