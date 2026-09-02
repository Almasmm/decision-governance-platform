"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
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
    <div>
      <Button
        size="sm"
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
        <RefreshCw className="h-3.5 w-3.5" />
        {busy ? "Загрузка…" : "Загрузить из источника"}
      </Button>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
