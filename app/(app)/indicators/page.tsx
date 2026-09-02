// Каталог показателей как evidence registry: определение, источник, владелец,
// политика обновления, качество и использование в решениях.
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ArrowUpRight, CircleAlert, Database, Search, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { parseJson, SOURCE_SYSTEMS, type SourceSystem } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { NatureMark } from "@/components/provenance";
import { EvidenceNatureLegend } from "@/components/indicators/evidence-nature-legend";

export const dynamic = "force-dynamic";

export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; critical?: string }>;
}) {
  await requireUser();
  const filters = await searchParams;

  const [indicators, all] = await Promise.all([
    prisma.indicator.findMany({
      where: {
        ...(filters.q ? { OR: [{ code: { contains: filters.q } }, { name: { contains: filters.q } }] } : {}),
        ...(filters.source && SOURCE_SYSTEMS.includes(filters.source as SourceSystem)
          ? { sourceSystem: filters.source }
          : {}),
        ...(filters.critical === "1" ? { isCritical: true } : {}),
      },
      include: {
        owner: true,
        values: { orderBy: { asOf: "desc" }, take: 1 },
        _count: { select: { values: true, decisionLinks: true } },
      },
      orderBy: [{ isCritical: "desc" }, { code: "asc" }],
    }),
    prisma.indicator.findMany({
      select: {
        isCritical: true,
        ownerId: true,
        sourceSystem: true,
        maxLagDays: true,
        values: { orderBy: { asOf: "desc" }, take: 1, select: { asOf: true } },
      },
    }),
  ]);

  const today = new Date();
  const critical = all.filter((indicator) => indicator.isCritical);
  const criticalGoverned = critical.filter((indicator) => indicator.ownerId && indicator.sourceSystem);
  const governanceCoverage = critical.length > 0
    ? Math.round((criticalGoverned.length / critical.length) * 100)
    : 0;
  const autoLoadable = all.filter((indicator) => !["MANUAL", "EXTERNAL"].includes(indicator.sourceSystem));
  const current = all.filter((indicator) => {
    const latest = indicator.values[0];
    return latest && differenceInCalendarDays(today, latest.asOf) <= indicator.maxLagDays;
  });
  const withoutValues = all.filter((indicator) => indicator.values.length === 0);
  const stale = all.length - current.length - withoutValues.length;

  return (
    <div className="space-y-6" data-tour="indicator-catalog">
      <section
        className="grid overflow-hidden rounded-panel bg-surface shadow-panel xl:grid-cols-[minmax(0,1fr)_320px]"
        data-tour="indicator-catalog-overview"
      >
        <div className="bg-obsidian px-5 py-6 text-white sm:px-7 sm:py-7">
          <p className="flex items-center gap-2 text-meta font-semibold tracking-[0.12em] text-white/60">
            <Database className="h-4 w-4" aria-hidden="true" />
            ИНФОРМАЦИОННЫЙ КОНТУР
          </p>
          <h1 className="mt-3 text-page font-semibold tracking-[-0.025em] text-white">{ru.nav.indicators}</h1>
          <p className="mt-2 max-w-3xl text-lead text-white/70">
            Утверждённые определения показателей связывают каждое число с источником, владельцем,
            формулой, периодом актуальности и решениями, где оно используется как доказательство.
          </p>
          <dl className="mt-6 grid gap-4 border-t border-white/20 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-meta text-white/50">Показателей</dt>
              <dd className="mt-1 text-section font-semibold text-white">{all.length}</dd>
            </div>
            <div data-tour="decision-criticality">
              <dt className="text-meta text-white/50">Критических</dt>
              <dd className="mt-1 text-section font-semibold text-white">{critical.length}</dd>
            </div>
            <div>
              <dt className="text-meta text-white/50">Автозагрузка доступна</dt>
              <dd className="mt-1 text-section font-semibold text-white">{autoLoadable.length}</dd>
            </div>
          </dl>
        </div>

        <aside
          className="flex flex-col justify-between border-t border-line px-5 py-5 xl:border-l xl:border-t-0"
          aria-label="Готовность критических данных"
          data-tour="indicator-governance-readiness"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-meta font-semibold tracking-[0.1em] text-muted">DATA GOVERNANCE</p>
                <h2 className="mt-1 text-lead font-semibold text-text">Готовность критических данных</h2>
              </div>
              <span className="text-hero font-semibold tracking-[-0.04em] text-text">{governanceCoverage}%</span>
            </div>
            <Progress
              className="mt-4 h-2.5"
              value={governanceCoverage}
              warnBelow={100}
              label={`Критические показатели с владельцем и источником: ${governanceCoverage}%`}
            />
            <p className="mt-2 text-table text-muted">
              {criticalGoverned.length} из {critical.length} имеют владельца и зарегистрированный источник
            </p>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div>
              <dt className="text-meta text-muted">Актуальны</dt>
              <dd className="mt-1 text-lead font-semibold text-accent">{current.length}</dd>
            </div>
            <div>
              <dt className="text-meta text-muted">Просрочены</dt>
              <dd className="mt-1 text-lead font-semibold text-action">{stale}</dd>
            </div>
            <div>
              <dt className="text-meta text-muted">Без значений</dt>
              <dd className="mt-1 text-lead font-semibold text-action">{withoutValues.length}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section
        className="grid overflow-hidden rounded-panel bg-surface shadow-panel xl:grid-cols-[minmax(0,1fr)_410px]"
        aria-label="Фильтры каталога и легенда"
        data-tour="indicator-catalog-filters"
      >
        <form method="get" className="flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5">
          <div className="min-w-[220px] flex-1 sm:max-w-sm">
            <label htmlFor="indicator-search" className="mb-1 block text-meta font-semibold text-muted">
              Поиск доказательства
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="indicator-search"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Код, название или показатель"
                className="h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 text-base text-text"
              />
            </div>
          </div>
          <div>
            <label htmlFor="indicator-source" className="mb-1 block text-meta font-semibold text-muted">
              Система-источник
            </label>
            <select
              id="indicator-source"
              name="source"
              defaultValue={filters.source ?? ""}
              className="h-10 rounded-control border border-line-strong bg-surface px-3 text-base text-text"
            >
              <option value="">Все источники</option>
              {SOURCE_SYSTEMS.map((source) => (
                <option key={source} value={source}>{ru.sourceSystems[source]}</option>
              ))}
            </select>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-control border border-line px-3 text-table text-muted">
            <input type="checkbox" name="critical" value="1" defaultChecked={filters.critical === "1"} />
            Только критические
          </label>
          <Button type="submit">Применить</Button>
          <Link href="/indicators"><Button type="button" variant="ghost">Сбросить</Button></Link>
        </form>
        <EvidenceNatureLegend compact className="border-t border-line px-5 py-4 xl:border-l xl:border-t-0" />
      </section>

      <section aria-labelledby="evidence-catalog-title" data-tour="indicator-evidence-registry">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-meta font-semibold tracking-[0.1em] text-muted">EVIDENCE REGISTRY</p>
            <h2 id="evidence-catalog-title" className="mt-1 text-section font-semibold text-text">Утверждённые показатели</h2>
          </div>
          <p className="text-table text-muted">Показано {indicators.length} из {all.length}</p>
        </div>

        <div className="overflow-hidden rounded-panel bg-surface shadow-panel">
          <Table className="min-w-[1180px]">
            <THead>
              <TR>
                <TH className="w-[310px]" data-tour="indicator-definition">Показатель и определение</TH>
                <TH className="w-[170px]" data-tour="indicator-current-value">Последнее значение</TH>
                <TH className="w-[155px]" data-tour="indicator-source">Источник</TH>
                <TH className="w-[180px]" data-tour="indicator-owner">Владелец</TH>
                <TH className="w-[150px]" data-tour="indicator-freshness">Политика обновления</TH>
                <TH className="w-[145px]" data-tour="indicator-quality">Качество</TH>
                <TH className="w-[90px] text-right">Использование</TH>
              </TR>
            </THead>
            <TBody>
              {indicators.length === 0 && (
                <TR>
                  <TD colSpan={7} className="py-10 text-center text-base text-muted">
                    По заданным фильтрам показатели не найдены.
                  </TD>
                </TR>
              )}
              {indicators.map((indicator, index) => {
                const latest = indicator.values[0];
                const lag = latest ? differenceInCalendarDays(today, latest.asOf) : null;
                const isStale = lag !== null && lag > indicator.maxLagDays;
                const rules = parseJson<Record<string, unknown>>(indicator.qualityRules, {});
                const isAutoSource = !["MANUAL", "EXTERNAL"].includes(indicator.sourceSystem);

                return (
                  <TR key={indicator.id}>
                    <TD>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/indicators/${indicator.id}`}
                          className="font-technical text-table font-semibold text-accent hover:underline"
                          data-tour={index === 0 ? "indicator-open-detail" : undefined}
                        >
                          {indicator.code}
                        </Link>
                        {indicator.isCritical && <Badge variant="outline">Критический</Badge>}
                      </div>
                      <Link href={`/indicators/${indicator.id}`} className="mt-1 inline-flex items-start gap-1 text-base font-semibold leading-5 text-text hover:text-accent hover:underline">
                        {indicator.name}
                        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      </Link>
                      <p className="mt-1 line-clamp-2 text-meta leading-4 text-muted">{indicator.businessMeaning}</p>
                    </TD>
                    <TD>
                      {latest ? (
                        <>
                          <p className="whitespace-nowrap text-base font-semibold tabular-nums text-text">
                            {latest.value.toLocaleString("ru-RU")} {indicator.unit}
                          </p>
                          <div className="mt-1"><NatureMark nature="fact" /></div>
                          <p className="mt-1 text-meta text-muted">на {format(latest.asOf, "d MMM yyyy", { locale: ruLocale })}</p>
                        </>
                      ) : (
                        <div className="flex items-start gap-1.5 text-table text-action">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          Значение отсутствует
                        </div>
                      )}
                    </TD>
                    <TD>
                      <p className="text-table font-semibold text-text">{ru.sourceSystems[indicator.sourceSystem as SourceSystem]}</p>
                      <p className="mt-1 text-meta leading-4 text-muted">
                        {isAutoSource ? "Демо-коннектор доступен" : "Ручная фиксация"}
                      </p>
                    </TD>
                    <TD>
                      {indicator.owner ? (
                        <p className="text-table font-semibold text-text">{indicator.owner.name}</p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-table font-semibold text-action">
                          <CircleAlert className="h-4 w-4" aria-hidden="true" />
                          Не назначен
                        </p>
                      )}
                      <p className="mt-1 text-meta text-muted">Владелец определения и качества</p>
                    </TD>
                    <TD>
                      <p className="text-table text-text">
                        {ru.frequency[indicator.frequency as keyof typeof ru.frequency] ?? indicator.frequency}
                      </p>
                      <p className="mt-1 text-meta text-muted">Допустимый лаг: {indicator.maxLagDays} дн.</p>
                    </TD>
                    <TD>
                      {!latest ? (
                        <Badge variant="action">Нет значения</Badge>
                      ) : isStale ? (
                        <Badge variant="action">Лаг превышен</Badge>
                      ) : (
                        <Badge variant="resolvedSoft"><ShieldCheck className="h-3 w-3" />Актуально</Badge>
                      )}
                      <p className="mt-1.5 text-meta text-muted">
                        {lag === null ? "Нет даты" : `лаг ${lag} / ${indicator.maxLagDays} дн.`}
                      </p>
                      <p className="mt-1 text-meta text-muted">Правил качества: {Object.keys(rules).length}</p>
                    </TD>
                    <TD className="text-right">
                      <p className="text-base font-semibold text-text">{indicator._count.decisionLinks}</p>
                      <p className="text-meta text-muted">решений</p>
                      <p className="mt-2 text-meta text-muted">{indicator._count.values} версий</p>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
