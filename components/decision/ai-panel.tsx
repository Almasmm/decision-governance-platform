"use client";

// ИИ-помощник: три ступени с ограничениями доступа и обязательным вердиктом человека.
// «Отклонить рекомендацию» — равноправная кнопка, а не «пропустить».
import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Bot, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runAiTier, setAiVerdict } from "@/app/actions/ai";
import { ru } from "@/lib/i18n/ru";
import { AI_TIERS, type AiTier, type AiVerdict } from "@/lib/domain";

export interface SuggestionView {
  id: string;
  tier: string;
  modelName: string | null;
  content: string;
  explanation: string;
  sourceRefs: Array<{ ref: string; note: string }>;
  humanVerdict: string;
  verdictReason: string | null;
  verifiedByName: string | null;
  createdAt: string;
}

const TIER_HINT: Record<AiTier, string> = {
  INFORMATIONAL: "Поиск по базе решений, суммаризация, проверка формальной полноты пакета, выявление пропущенных обязательных блоков.",
  ANALYTICAL: "Поиск аномалий, сверка показателя между источниками, сравнение сценариев, простой прогноз.",
  RECOMMENDATIONAL: "Ранжирование альтернатив с объяснением факторов выбора. Решение остаётся за уполномоченным лицом.",
};

const VERDICT_VARIANT: Record<string, "success" | "danger" | "default" | "warn"> = {
  ACCEPTED: "success",
  REJECTED: "danger",
  MODIFIED: "default",
  PENDING: "warn",
};

function VerdictForm({
  suggestionId,
  isLevelA,
  canVerdict,
  onDone,
}: {
  suggestionId: string;
  isLevelA: boolean;
  canVerdict: boolean;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canVerdict)
    return (
      <p className="text-xs text-slate-500">
        Вердикт по предложению ИИ выносит уполномоченное лицо (инициатор, аналитик или член Совета
        директоров).
      </p>
    );

  async function submit(verdict: "ACCEPTED" | "REJECTED" | "MODIFIED") {
    setBusy(true);
    setError(null);
    const res = await setAiVerdict(suggestionId, verdict, reason);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-2 rounded border border-amber-300 bg-amber-50/60 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-warn">
        <ShieldAlert className="h-3.5 w-3.5" />
        Требуется вердикт человека
        {isLevelA && " — для уровня A обоснование обязательно"}
      </div>
      <div className="mt-1.5">
        <Label htmlFor={`reason-${suggestionId}`}>Обоснование вердикта</Label>
        <Textarea
          id={`reason-${suggestionId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-16"
          placeholder="Почему предложение принимается, изменяется или отклоняется"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => submit("ACCEPTED")}>
          Принять к сведению
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => submit("MODIFIED")}>
          Принять с изменениями
        </Button>
        <Button size="sm" variant="warn" disabled={busy} onClick={() => submit("REJECTED")}>
          Отклонить рекомендацию
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-600">
        Ни одно предложение не применяется автоматически. Отклонение — полноправное действие
        с фиксацией в аудите.
      </p>
    </div>
  );
}

export function AiPanel({
  decisionId,
  criticality,
  eligibility,
  suggestions,
  canRun,
  canVerdict,
  providerName,
}: {
  decisionId: string;
  criticality: string;
  eligibility: Array<{ tier: string; allowed: boolean; reason: string }>;
  suggestions: SuggestionView[];
  canRun: boolean;
  canVerdict: boolean;
  providerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(tier: AiTier) {
    setBusy(tier);
    setError(null);
    const res = await runAiTier(decisionId, tier);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-200 bg-brand-card/40 p-3 text-xs text-slate-700">
        <div className="flex items-center gap-1.5 font-semibold text-brand">
          <Bot className="h-4 w-4" />
          Принцип «человек в контуре»
        </div>
        <p className="mt-1">
          Система готовит, проверяет и предлагает — выбирает и отвечает уполномоченное лицо. Доступ к
          аналитической ступени открывается только для показателей с заполненным источником и
          владельцем; рекомендательная — только для валидированных моделей из реестра.
        </p>
        <p className="mt-1 text-slate-500">Активный провайдер: {providerName}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {AI_TIERS.map((tier) => {
          const el = eligibility.find((e) => e.tier === tier);
          const allowed = el?.allowed ?? false;
          return (
            <Card key={tier}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{ru.aiTiers[tier]}</span>
                  {allowed ? <Badge variant="success">доступна</Badge> : <Badge variant="warn"><Lock className="h-3 w-3" />закрыта</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-slate-600">{TIER_HINT[tier]}</p>
                <p className={`text-[11px] ${allowed ? "text-slate-500" : "text-brand-warn"}`}>
                  {el?.reason}
                </p>
                {canRun && (
                  <Button
                    size="sm"
                    variant={allowed ? "default" : "outline"}
                    disabled={!allowed || busy !== null}
                    onClick={() => run(tier)}
                  >
                    {busy === tier ? "Выполняется…" : "Запустить"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Предложения ИИ и вердикты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.length === 0 && (
            <p className="text-sm text-slate-500">Предложения не запрашивались.</p>
          )}
          {suggestions.map((s) => (
            <div key={s.id} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge>{ru.aiTiers[s.tier as AiTier]}</Badge>
                  {s.modelName && <Badge variant="outline">модель: {s.modelName}</Badge>}
                  <span className="text-[11px] text-slate-500">
                    {format(new Date(s.createdAt), "d MMM yyyy HH:mm", { locale: ruLocale })}
                  </span>
                </div>
                <Badge variant={VERDICT_VARIANT[s.humanVerdict] ?? "warn"}>
                  {ru.aiVerdicts[s.humanVerdict as AiVerdict]}
                </Badge>
              </div>

              <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{s.content}</p>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-brand-accent">
                  Объяснение и источники
                </summary>
                <p className="mt-1 text-xs text-slate-600">{s.explanation}</p>
                {s.sourceRefs.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {s.sourceRefs.map((r, i) => (
                      <li key={i} className="text-[11px] text-slate-500">
                        <span className="font-mono">{r.ref}</span> — {r.note}
                      </li>
                    ))}
                  </ul>
                )}
              </details>

              {s.humanVerdict === "PENDING" ? (
                <VerdictForm
                  suggestionId={s.id}
                  isLevelA={criticality === "A"}
                  canVerdict={canVerdict}
                  onDone={() => router.refresh()}
                />
              ) : (
                <p className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                  <span className="font-medium">
                    {ru.aiVerdicts[s.humanVerdict as AiVerdict]}
                    {s.verifiedByName ? ` — ${s.verifiedByName}` : ""}:
                  </span>{" "}
                  {s.verdictReason ?? "—"}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
