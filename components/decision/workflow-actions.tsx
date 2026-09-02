"use client";

// Отправка на экспертизу и возврат на доработку.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, RotateCcw } from "lucide-react";
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
    const res = await submitForReview(decisionId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function doReturn() {
    setBusy(true);
    setError(null);
    const res = await returnDecision(decisionId, reason);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowReturn(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {submittable && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={submit}>
            <Send className="h-3.5 w-3.5" />
            Отправить на экспертизу
          </Button>
        )}
        {returnable && (
          <Button variant="outline" size="sm" onClick={() => setShowReturn((v) => !v)}>
            <RotateCcw className="h-3.5 w-3.5" />
            Вернуть на доработку
          </Button>
        )}
      </div>
      {showReturn && (
        <div className="rounded border border-slate-200 p-2.5">
          <Label htmlFor="ret-reason">Причина возврата (фиксируется в аудите)</Label>
          <Textarea
            id="ret-reason"
            className="min-h-16"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Чего именно не хватает в доказательной базе"
          />
          <Button className="mt-2" size="sm" variant="warn" disabled={busy || reason.trim().length < 5} onClick={doReturn}>
            Вернуть на доработку
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
