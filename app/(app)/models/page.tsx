import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Database,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseJson } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { getAiProvider } from "@/lib/ai/provider";
import { Badge, CriticalityBadge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const HUMAN_LOOP = [
  { label: "Данные", note: "Паспорт и источники", icon: Database },
  { label: "Аналитика", note: "Модель и объяснение", icon: BrainCircuit },
  { label: "Рекомендация", note: "Ограниченный вывод", icon: Bot },
  { label: "Решение человека", note: "Мотивированный вердикт", icon: UserRoundCheck },
] as const;

const MODEL_CRITICALITY_LABELS: Record<string, string> = {
  HIGH: "Высокая",
  MEDIUM: "Средняя",
  LOW: "Низкая",
};

const QUALITY_METRIC_LABELS: Record<string, string> = {
  backtestAgreement: "Совпадение на ретроспективе",
  expertAgreement: "Согласованность с экспертами",
  precision: "Точность положительных выводов",
  recall: "Полнота выявления",
};

function presentMetricValue(value: number): string {
  return value >= 0 && value <= 1
    ? value.toLocaleString("ru-RU", { style: "percent", maximumFractionDigits: 1 })
    : value.toLocaleString("ru-RU");
}

export default async function ModelsPage() {
  await requireUser();
  const models = await prisma.aiModel.findMany({
    include: { owner: true, _count: { select: { suggestions: true } } },
    orderBy: [{ validatedAt: "desc" }, { name: "asc" }],
  });
  const validatedCount = models.filter((model) => model.validatedAt).length;
  const provider = getAiProvider();

  return (
    <div className="workspace space-y-7">
      <header className="grid gap-5 border-b border-line pb-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div>
          <p className="eyebrow">Аналитико-интеллектуальный контур</p>
          <h1 className="mt-2 text-page font-semibold tracking-[-0.03em] text-text">{ru.nav.models}</h1>
          <p className="mt-2 max-w-3xl text-lead leading-7 text-muted">
            Реестр определяет, какой аналитике организация доверяет, для каких решений она
            допустима и где проходит граница ответственности модели.
          </p>
        </div>
        <div className="border-l-2 border-accent pl-4">
          <div className="text-decision font-semibold tabular-nums text-text">{validatedCount} / {models.length}</div>
          <p className="mt-1 text-meta text-muted">моделей прошли формальную валидацию</p>
        </div>
      </header>

      <section
        aria-labelledby="human-loop-title"
        className="bg-obsidian px-5 py-6 text-white sm:px-7"
        data-tour="model-human-loop"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-meta font-semibold uppercase tracking-[0.16em] text-accent-soft">Human-in-the-loop</p>
            <h2 id="human-loop-title" className="mt-2 text-section font-semibold">ИИ участвует в анализе, но не принимает решение</h2>
          </div>
          <Badge variant="partial" className="border-white/40 text-white">Authority: человек / орган управления</Badge>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.15fr] xl:items-center">
          {HUMAN_LOOP.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="contents">
                <div className={index === HUMAN_LOOP.length - 1 ? "border-l-2 border-accent bg-white/10 p-4" : "border border-white/15 p-4"}>
                  <Icon className={index === HUMAN_LOOP.length - 1 ? "h-5 w-5 text-accent-soft" : "h-5 w-5 text-white/65"} aria-hidden="true" />
                  <p className="mt-3 text-base font-semibold">{step.label}</p>
                  <p className="mt-1 text-meta text-white/55">{step.note}</p>
                </div>
                {index < HUMAN_LOOP.length - 1 && <ArrowRight className="mx-auto hidden h-4 w-4 text-white/35 xl:block" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-band flex flex-wrap items-center justify-between gap-4 px-5 py-4" aria-label="Провайдер аналитики">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-accent-soft text-accent"><BrainCircuit className="h-4 w-4" /></span>
          <div>
            <p className="text-table font-semibold text-text">Активный провайдер: {provider.name}</p>
            <p className="text-meta text-muted">Ответ формируется только из доказательной базы открытого паспорта.</p>
          </div>
        </div>
        <Badge variant="technical">Демо-контур · mock без внешних ключей</Badge>
      </section>

      <section aria-labelledby="registry-heading" data-tour="model-registry">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Model governance</p>
            <h2 id="registry-heading" className="mt-1 text-section font-semibold text-text">Допуски и ограничения моделей</h2>
          </div>
          <span className="text-meta text-muted">{models.length} записей</span>
        </div>
        <div className="divide-y divide-line border-y border-line" data-tour="model-governance">
          {models.map((model) => {
            const metrics = parseJson<Record<string, number>>(model.qualityMetrics, {});
            const levels = parseJson<string[]>(model.allowedForLevels, []);
            const validated = model.validatedAt !== null;
            return (
              <article key={model.id} className="grid gap-5 py-6 xl:grid-cols-[minmax(260px,.9fr)_minmax(360px,1.35fr)_minmax(260px,.75fr)] xl:gap-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {validated ? (
                      <Badge variant="resolvedSoft"><ShieldCheck className="h-3.5 w-3.5" /> Валидирована</Badge>
                    ) : (
                      <Badge variant="action"><ShieldAlert className="h-3.5 w-3.5" /> Не допущена</Badge>
                    )}
                    <span className="font-mono text-meta text-muted">v{model.version}</span>
                  </div>
                  <h3 className="mt-3 text-section font-semibold leading-7 text-text">{model.name}</h3>
                  <p className="mt-2 text-table leading-5 text-muted">{model.purpose}</p>
                  <dl className="mt-4 space-y-2 text-meta">
                    <div className="flex justify-between gap-3"><dt className="text-muted">Владелец</dt><dd className="text-right font-medium text-text">{model.owner.name}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Критичность</dt><dd className="font-medium text-text">{MODEL_CRITICALITY_LABELS[model.criticality] ?? "Не классифицирована"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Валидация</dt><dd className="text-right font-medium text-text">{model.validatedAt ? format(model.validatedAt, "d MMM yyyy", { locale: ruLocale }) : "Не проводилась"}</dd></div>
                  </dl>
                </div>

                <div className="border-l border-line pl-5">
                  <p className="text-meta font-semibold uppercase tracking-wider text-muted">Входной контур</p>
                  <p className="mt-2 text-base leading-6 text-text">{model.inputs}</p>
                  <div className="mt-5">
                    <p className="text-meta font-semibold uppercase tracking-wider text-muted">Контроль качества</p>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                      {Object.entries(metrics).length ? Object.entries(metrics).map(([key, value]) => (
                        <div key={key}>
                          <span className="block text-section font-semibold tabular-nums text-text">{presentMetricValue(value)}</span>
                          <span className="text-meta text-muted">{QUALITY_METRIC_LABELS[key] ?? "Метрика качества"}</span>
                        </div>
                      )) : <span className="text-table text-action">Метрики качества не заданы</span>}
                    </div>
                  </div>
                  <div className="mt-5 border-l-2 border-action bg-action-soft px-4 py-3">
                    <div className="flex items-center gap-2 text-table font-semibold text-action"><Scale className="h-4 w-4" /> Ограничение применения</div>
                    <p className="mt-1 text-table leading-5 text-text">{model.limitations}</p>
                  </div>
                </div>

                <div>
                  <p className="text-meta font-semibold uppercase tracking-wider text-muted">Допуск по критичности</p>
                  <div className="mt-3 flex items-center gap-2">
                    {levels.length ? levels.map((level) => <CriticalityBadge key={level} level={level} />) : <Badge variant="action">Нет допуска</Badge>}
                  </div>
                  <p className="mt-3 text-meta leading-5 text-muted">
                    Допуск означает право сформировать рекомендацию — не право принять решение.
                  </p>
                  <div className="mt-6 border-t border-line pt-4">
                    <span className="block text-decision font-semibold tabular-nums text-text">{model._count.suggestions}</span>
                    <span className="text-meta text-muted">рекомендаций сформировано</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="border-l-2 border-action pl-4 text-table leading-6 text-muted">
        Для решений уровня A любая рекомендательная аналитика требует явного человеческого
        вердикта с мотивировкой. Принятие, изменение и отклонение одинаково фиксируются в аудите.
      </p>
    </div>
  );
}
