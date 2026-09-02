"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, DatabaseZap, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadIndicatorFromSource } from "@/app/actions/indicators";

export function IndicatorLoadButton({
  indicatorId,
  disabled,
  hint,
}: {
  indicatorId: string;
  disabled: boolean;
  hint: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="max-w-sm">
      <Button
        size="default"
        variant="secondary"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await loadIndicatorFromSource(indicatorId);
          setBusy(false);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.refresh();
        }}
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <DatabaseZap className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? "Проверка источника…" : "Получить новое значение"}
      </Button>
      <p className="mt-1.5 text-meta leading-4 text-muted">{hint}</p>
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-meta leading-4 text-action" role="alert">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
