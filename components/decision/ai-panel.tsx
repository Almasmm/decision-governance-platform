"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileSearch,
  LockKeyhole,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Label, Textarea } from "@/components/ui/input";
import { runAiTier, setAiVerdict } from "@/app/actions/ai";
import { ru } from "@/lib/i18n/ru";
import { AI_TIERS, type AiTier, type AiVerdict } from "@/lib/domain";

export interface SuggestionView {
  id: string;
  tier: string;
  modelName: string | null;
  modelVersion: string | null;
  modelValidatedAt: string | null;
  modelAllowedForLevels: string[];
  modelLimitations: string | null;
  content: string;
  explanation: string;
  sourceRefs: Array<{ ref: string; note: string }>;
  humanVerdict: string;
  verdictReason: string | null;
  verifiedByName: string | null;
  createdAt: string;
}

const TIER_NUMBER: Record<AiTier, string> = {
  INFORMATIONAL: "01",
  ANALYTICAL: "02",
  RECOMMENDATIONAL: "03",
};

const TIER_HINT: Record<AiTier, string> = {
  INFORMATIONAL:
    "Поиск по базе решений, суммаризация и проверка формальной полноты пакета доказательств.",
  ANALYTICAL:
    "Поиск аномалий, сверка показателей между источниками и сравнение сценариев.",
  RECOMMENDATIONAL:
    "Ранжирование альтернатив с объяснением факторов. Authority остаётся у человека.",
};

const TIER_LIMIT: Record<AiTier, string> = {
  INFORMATIONAL: "Не оценивает предпочтительность альтернатив и не принимает решение.",
  ANALYTICAL: "Результат зависит от качества входных данных и заданных допущений.",
  RECOMMENDATIONAL: "Рекомендация не применяется без отдельного человеческого вердикта.",
};

function tierLabel(tier: string) {
  return ru.aiTiers[tier as AiTier] ?? tier;
}

function verdictLabel(verdict: string) {
  return ru.aiVerdicts[verdict as AiVerdict] ?? verdict;
}

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
    <section
      className="rounded-panel bg-obsidian p-4 text-surface shadow-panel sm:p-5"
      aria-labelledby={`human-verdict-${suggestionId}`}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-technical text-meta uppercase tracking-[0.16em] text-accent-soft">
            Human verdict
          </p>
          <h4 id={`human-verdict-${suggestionId}`} className="mt-1 text-section font-semibold">
            Решение остаётся за уполномоченным лицом
          </h4>
        </div>
        <Badge variant="action" className="self-start">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Требуется действие
        </Badge>
      </div>

      <div className="mt-4 border-y border-white/15 py-3">
        <p className="font-technical text-table font-semibold uppercase tracking-[0.08em] text-action-soft">
          Рекомендация не применена
        </p>
        <p className="mt-1 max-w-3xl text-base text-white/70">
          Анализ зафиксирован как вход для решения. До явного вердикта он не меняет выбранную
          альтернативу и не запускает исполнение.
        </p>
      </div>

      {!canVerdict ? (
        <div className="mt-4 flex gap-3 rounded-control border border-white/15 p-3">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-accent-soft" aria-hidden="true" />
          <p className="text-base text-white/75">
            Вердикт может вынести инициатор, аналитик или член Совета директоров с соответствующим
            полномочием.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <Label htmlFor={`reason-${suggestionId}`} className="text-surface">
              Обоснование вердикта{isLevelA ? " — обязательно для уровня A" : ""}
            </Label>
            <Textarea
              id={`reason-${suggestionId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-20 border-white/20 bg-white text-text"
              placeholder="Зафиксируйте, почему рекомендация принимается, корректируется или отклоняется"
            />
          </div>
          {error && (
            <p className="mt-2 text-table text-action-soft" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            <Button
              variant="secondary"
              className="h-auto min-h-11 whitespace-normal border-white/25 bg-transparent px-3 py-2 text-surface hover:border-accent-soft hover:bg-white/10"
              disabled={busy}
              onClick={() => submit("ACCEPTED")}
            >
              Принять рекомендацию
            </Button>
            <Button
              variant="secondary"
              className="h-auto min-h-11 whitespace-normal border-white/25 bg-transparent px-3 py-2 text-surface hover:border-accent-soft hover:bg-white/10"
              disabled={busy}
              onClick={() => submit("MODIFIED")}
            >
              Принять с изменениями
            </Button>
            <Button
              variant="secondary"
              className="h-auto min-h-11 whitespace-normal border-white/25 bg-transparent px-3 py-2 text-surface hover:border-accent-soft hover:bg-white/10"
              disabled={busy}
              onClick={() => submit("REJECTED")}
            >
              Отклонить рекомендацию
            </Button>
          </div>
          <p className="mt-3 text-meta text-white/55">
            Все три исхода равноправны и фиксируются в аудите вместе с автором и обоснованием.
          </p>
        </>
      )}
    </section>
  );
}

function RecordedVerdict({ suggestion }: { suggestion: SuggestionView }) {
  return (
    <section
      className="rounded-panel bg-obsidian p-4 text-surface shadow-panel sm:p-5"
      aria-label="Зафиксированный человеческий вердикт"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-technical text-meta uppercase tracking-[0.16em] text-accent-soft">
            Human verdict
          </p>
          <h4 className="mt-1 text-section font-semibold">{verdictLabel(suggestion.humanVerdict)}</h4>
        </div>
        <Badge variant="resolved" className="self-start">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Вердикт зафиксирован
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 border-t border-white/15 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <p className="whitespace-pre-line text-lead text-white/85">
          {suggestion.verdictReason ?? "Обоснование не указано."}
        </p>
        <div className="text-left sm:text-right">
          <p className="text-meta uppercase tracking-[0.08em] text-white/45">Authority</p>
          <p className="mt-1 text-table font-semibold">
            {suggestion.verifiedByName ?? "Уполномоченное лицо"}
          </p>
        </div>
      </div>
    </section>
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
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="eyebrow">Analytical workspace</p>
            <h2 className="mt-1 text-decision font-semibold tracking-[-0.02em] text-text">
              AI-анализ решения
            </h2>
            <p className="mt-2 text-lead text-muted">
              Модель формирует проверяемый аналитический вход. Источники, границы применимости и
              человеческий вердикт остаются частью одного доказательного следа.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-l-2 border-accent pl-4 text-table sm:grid-cols-3">
            <div>
              <p className="text-meta uppercase tracking-[0.08em] text-muted">Провайдер</p>
              <p className="mt-1 font-semibold text-text">{providerName}</p>
            </div>
            <div>
              <p className="text-meta uppercase tracking-[0.08em] text-muted">Критичность</p>
              <p className="mt-1 font-semibold text-text">Уровень {criticality}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-meta uppercase tracking-[0.08em] text-muted">Authority</p>
              <p className="mt-1 font-semibold text-text">Только человек</p>
            </div>
          </div>
        </div>
      </header>

      <section className="surface-band overflow-hidden" aria-labelledby="capabilities-heading">
        <div className="flex flex-col justify-between gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Governance gates</p>
            <h3 id="capabilities-heading" className="mt-0.5 text-section font-semibold text-text">
              Разрешённые уровни анализа
            </h3>
          </div>
          <p className="max-w-xl text-table text-muted">
            Каждый следующий уровень требует более строгой готовности данных и модели.
          </p>
        </div>

        <div className="divide-y divide-line">
          {AI_TIERS.map((tier) => {
            const tierEligibility = eligibility.find((item) => item.tier === tier);
            const allowed = tierEligibility?.allowed ?? false;
            return (
              <article
                key={tier}
                className="grid gap-3 px-4 py-4 lg:grid-cols-[48px_minmax(180px,0.75fr)_minmax(260px,1.5fr)_minmax(180px,1fr)_auto] lg:items-center"
              >
                <span className="font-technical text-section font-semibold text-muted">
                  {TIER_NUMBER[tier]}
                </span>
                <div>
                  <h4 className="text-base font-semibold text-text">{ru.aiTiers[tier]}</h4>
                  <div className="mt-1">
                    {allowed ? (
                      <Badge variant="resolvedSoft">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> доступен
                      </Badge>
                    ) : (
                      <Badge variant="partial">
                        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> закрыт
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-base text-text">{TIER_HINT[tier]}</p>
                <div>
                  <p className="text-table text-muted">{tierEligibility?.reason ?? "Правило не задано."}</p>
                  <p className="mt-1 text-meta text-action">Ограничение: {TIER_LIMIT[tier]}</p>
                </div>
                {canRun ? (
                  <Button
                    size="sm"
                    variant={allowed ? "default" : "secondary"}
                    disabled={!allowed || busy !== null}
                    onClick={() => run(tier)}
                  >
                    {busy === tier ? "Выполняется…" : "Запустить анализ"}
                  </Button>
                ) : (
                  <span className="text-meta text-muted">Нет права запуска</span>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="rounded-control border border-action bg-action-soft px-3 py-2 text-table text-action" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="analysis-register-heading">
        <div className="mb-3 flex flex-col justify-between gap-2 border-b border-line pb-3 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Analysis register</p>
            <h3 id="analysis-register-heading" className="mt-0.5 text-section font-semibold text-text">
              Рекомендации и вердикты
            </h3>
          </div>
          <p className="font-technical text-meta text-muted">
            {suggestions.length} {suggestions.length === 1 ? "запись" : "записей"}
          </p>
        </div>

        {suggestions.length === 0 ? (
          <div className="surface-band flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
            <FileSearch className="h-8 w-8 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <h4 className="text-base font-semibold text-text">Аналитические записи ещё не созданы</h4>
              <p className="mt-1 text-base text-muted">
                Запустите разрешённый governance gate выше. Результат появится здесь вместе с
                источниками и зоной человеческого вердикта.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {suggestions.map((suggestion, index) => {
              const suggestionTier = suggestion.tier as AiTier;
              const sourceCount = suggestion.sourceRefs.length;
              return (
                <article key={suggestion.id} className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
                  <div className="grid gap-4 border-b border-line bg-surface-raised px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-obsidian font-technical text-table font-semibold text-surface">
                        {String(suggestions.length - index).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="accent">{tierLabel(suggestion.tier)}</Badge>
                          <span className="text-table font-semibold text-text">
                            {suggestion.modelName ?? "Процедурный анализ"}
                          </span>
                        </div>
                        <p className="mt-1 font-technical text-meta text-muted">
                          {format(new Date(suggestion.createdAt), "d MMM yyyy, HH:mm", {
                            locale: ruLocale,
                          })}
                        </p>
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-table sm:grid-cols-3 xl:grid-cols-6">
                      <div>
                        <dt className="text-meta uppercase tracking-[0.08em] text-muted">Провайдер</dt>
                        <dd className="mt-1 font-semibold text-text">{providerName}</dd>
                      </div>
                      <div>
                        <dt className="text-meta uppercase tracking-[0.08em] text-muted">Версия</dt>
                        <dd className="mt-1 font-technical font-semibold text-text">
                          {suggestion.modelVersion ? `v${suggestion.modelVersion}` : "Не применимо"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-meta uppercase tracking-[0.08em] text-muted">Валидация</dt>
                        <dd className="mt-1 font-semibold text-text">
                          {suggestion.modelValidatedAt
                            ? format(new Date(suggestion.modelValidatedAt), "d MMM yyyy", {
                                locale: ruLocale,
                              })
                            : suggestion.modelName
                              ? "Не проводилась"
                              : "Модель не использована"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-meta uppercase tracking-[0.08em] text-muted">Допуск</dt>
                        <dd className="mt-1 flex flex-wrap gap-1">
                          {suggestion.modelAllowedForLevels.length > 0 ? (
                            suggestion.modelAllowedForLevels.map((level) => (
                              <CriticalityBadge key={level} level={level} className="h-6 min-w-6 px-1.5" />
                            ))
                          ) : (
                            <span className="font-semibold text-action">Не зафиксирован</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-meta uppercase tracking-[0.08em] text-muted">Источники</dt>
                        <dd className="mt-1 font-semibold text-text">{sourceCount}</dd>
                      </div>
                      <div>
                        <dt className="text-meta uppercase tracking-[0.08em] text-muted">Вердикт</dt>
                        <dd className="mt-1 font-semibold text-text">{verdictLabel(suggestion.humanVerdict)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                      <section aria-labelledby={`recommendation-${suggestion.id}`}>
                        <div className="flex items-center gap-2 text-accent">
                          <Scale className="h-4 w-4" aria-hidden="true" />
                          <p className="eyebrow text-accent">Model recommendation</p>
                        </div>
                        <h4
                          id={`recommendation-${suggestion.id}`}
                          className="mt-2 text-section font-semibold text-text"
                        >
                          Рекомендация
                        </h4>
                        <p className="mt-3 whitespace-pre-line text-lead text-text">
                          {suggestion.content}
                        </p>
                      </section>

                      <aside className="space-y-4 border-t border-line pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                        <section>
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-muted" aria-hidden="true" />
                            <h5 className="text-table font-semibold uppercase tracking-[0.08em] text-muted">
                              Обоснование и ключевые факторы
                            </h5>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-base text-text">
                            {suggestion.explanation || "Объяснение не предоставлено."}
                          </p>
                        </section>

                        <section className="border-t border-line pt-4">
                          <div className="flex items-center gap-2">
                            <TriangleAlert className="h-4 w-4 text-action" aria-hidden="true" />
                            <h5 className="text-table font-semibold uppercase tracking-[0.08em] text-muted">
                              Неопределённости
                            </h5>
                          </div>
                          <dl className="mt-2 space-y-3 text-table">
                            <div>
                              <dt className="font-semibold text-muted">Ограничения модели</dt>
                              <dd className="mt-1 text-base text-text">
                                {suggestion.modelLimitations ??
                                  "Отдельная модель не использована; применяется процедурный анализ."}
                              </dd>
                            </div>
                            <div className="border-t border-line pt-3">
                              <dt className="font-semibold text-muted">Ограничение уровня анализа</dt>
                              <dd className="mt-1 text-text">
                                {TIER_LIMIT[suggestionTier] ??
                                  "Вывод зависит от полноты и актуальности доступных источников."}
                              </dd>
                            </div>
                          </dl>
                          <p className="mt-3 border-l-2 border-action pl-3 text-table text-muted">
                            Вывод ограничен перечисленными источниками. Модель не подтверждает
                            внешние факты и не обладает полномочием утвердить решение.
                          </p>
                        </section>
                      </aside>
                    </div>

                    <section className="mt-5 border-y border-line py-4" aria-label="Источники анализа">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-accent" aria-hidden="true" />
                          <h5 className="text-table font-semibold uppercase tracking-[0.08em] text-text">
                            Источники и доказательный след
                          </h5>
                        </div>
                        <span className="font-technical text-meta text-muted">{sourceCount}</span>
                      </div>
                      {sourceCount > 0 ? (
                        <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                          {suggestion.sourceRefs.map((source, sourceIndex) => (
                            <li key={`${source.ref}-${sourceIndex}`} className="grid grid-cols-[auto_1fr] gap-2 text-table">
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 text-accent" aria-hidden="true" />
                              <p className="min-w-0 text-muted">
                                <span className="break-all font-technical font-semibold text-text">
                                  {source.ref}
                                </span>
                                {source.note ? ` — ${source.note}` : ""}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-3 flex gap-2 rounded-control bg-action-soft p-3 text-table text-action">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          Источники не зафиксированы. Учитывайте это ограничение при вынесении
                          вердикта.
                        </div>
                      )}
                    </section>

                    <div className="mt-5">
                      {suggestion.humanVerdict === "PENDING" ? (
                        <VerdictForm
                          suggestionId={suggestion.id}
                          isLevelA={criticality === "A"}
                          canVerdict={canVerdict}
                          onDone={() => router.refresh()}
                        />
                      ) : (
                        <RecordedVerdict suggestion={suggestion} />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
