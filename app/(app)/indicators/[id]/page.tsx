// Карточка показателя: паспорт метрики, история значений, граф происхождения данных.
import { notFound } from "next/navigation";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { ru } from "@/lib/i18n/ru";
import { parseJson, type SourceSystem } from "@/lib/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LineageGraph, type LineageNode } from "@/components/lineage-graph";
import { ValueHistoryChart } from "@/components/charts/value-history";
import { IndicatorLoadButton } from "@/components/indicator-load-button";

export const dynamic = "force-dynamic";

export default async function IndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const indicator = await prisma.indicator.findUnique({
    where: { id },
    include: {
      owner: true,
      values: { orderBy: { asOf: "desc" } },
      decisionLinks: { include: { decision: true } },
    },
  });
  if (!indicator) notFound();

  const latest = indicator.values[0];
  const lag = latest ? differenceInCalendarDays(new Date(), latest.asOf) : null;
  const stale = lag !== null && lag > indicator.maxLagDays;
  const autoLoadable = !["MANUAL", "EXTERNAL"].includes(indicator.sourceSystem);
  const qualityRules = parseJson<Record<string, unknown>>(indicator.qualityRules, {});

  const lineage: LineageNode[][] = [
    [
      {
        id: "src",
        title: ru.sourceSystems[indicator.sourceSystem as SourceSystem],
        subtitle: "система-источник",
        kind: "source",
      },
    ],
    [
      {
        id: "conn",
        title: autoLoadable ? `Коннектор ${indicator.sourceSystem}` : "Ручной ввод",
        subtitle: autoLoadable ? "fetchIndicator(code)" : "без автозагрузки",
        kind: "connector",
      },
    ],
    [
      {
        id: "cat",
        title: indicator.code,
        subtitle: `владелец: ${indicator.owner?.name ?? "не назначен"}`,
        kind: "catalog",
      },
    ],
    [
      {
        id: "val",
        title: latest ? `${latest.value.toLocaleString("ru-RU")} ${indicator.unit}` : "нет значений",
        subtitle: latest ? `на ${format(latest.asOf, "d MMM yyyy", { locale: ruLocale })}` : undefined,
        kind: "value",
      },
    ],
    indicator.decisionLinks.length > 0
      ? indicator.decisionLinks.slice(0, 5).map((l) => ({
          id: l.id,
          title: l.decision.code,
          subtitle: l.decision.title,
          kind: "decision" as const,
        }))
      : [{ id: "none", title: "Не используется", subtitle: "нет привязанных решений", kind: "decision" as const }],
  ];

  return (
    <div className="space-y-4">
      <Link href="/indicators" className="text-xs text-brand-accent hover:underline">
        ← Каталог показателей
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{indicator.code}</span>
                {indicator.isCritical && <Badge variant="warn">критический показатель</Badge>}
                <Badge variant="outline">{ru.sourceSystems[indicator.sourceSystem as SourceSystem]}</Badge>
              </div>
              <h1 className="mt-1 text-lg font-bold text-brand">{indicator.name}</h1>
              <p className="mt-0.5 max-w-3xl text-sm text-slate-600">{indicator.businessMeaning}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-brand">
                {latest ? `${latest.value.toLocaleString("ru-RU")} ${indicator.unit}` : "—"}
              </div>
              {latest && (
                <div className={`text-xs ${stale ? "text-brand-warn" : "text-slate-500"}`}>
                  на {format(latest.asOf, "d MMMM yyyy", { locale: ruLocale })}
                  {stale && ` · лаг ${lag} дн. при допустимых ${indicator.maxLagDays}`}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Владелец данных</dt>
              <dd className="font-medium">
                {indicator.owner?.name ?? <span className="text-brand-warn">не назначен</span>}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Периодичность</dt>
              <dd className="font-medium">
                {ru.frequency[indicator.frequency as keyof typeof ru.frequency] ?? indicator.frequency}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Допустимый лаг</dt>
              <dd className="font-medium">{indicator.maxLagDays} дн.</dd>
            </div>
            <div>
              <dt className="text-slate-500">Единица измерения</dt>
              <dd className="font-medium">{indicator.unit}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Формула расчёта</dt>
              <dd className="mt-0.5 rounded bg-slate-50 px-2 py-1 font-mono text-[11px]">
                {indicator.formula ?? "прямое измерение, формула не задана"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Правила качества</dt>
              <dd className="mt-0.5 rounded bg-slate-50 px-2 py-1 font-mono text-[11px]">
                {JSON.stringify(qualityRules)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Происхождение данных (data lineage)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineageGraph columns={lineage} />
          <p className="mt-2 text-[11px] text-slate-500">
            Цепочка прослеживаемости: от системы-источника через слой коннекторов к каталогу,
            конкретному значению и паспортам решений, где это число использовано как доказательство.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Динамика значений</CardTitle>
            {can(user.role, "indicator.manage") && (
              <IndicatorLoadButton
                indicatorId={indicator.id}
                disabled={!autoLoadable}
                hint={
                  autoLoadable
                    ? "Загрузка через коннектор-заглушку демо-контура"
                    : "Источник не поддерживает автозагрузку — только ручной ввод"
                }
              />
            )}
          </CardHeader>
          <CardContent>
            {indicator.values.length > 0 ? (
              <ValueHistoryChart
                data={[...indicator.values]
                  .reverse()
                  .map((v) => ({ date: format(v.asOf, "dd.MM.yy"), value: v.value }))}
                unit={indicator.unit}
              />
            ) : (
              <p className="text-sm text-slate-500">Значения не загружались.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История загрузок</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Актуально на</TH>
                  <TH>Значение</TH>
                  <TH>Способ</TH>
                  <TH>Примечание версии</TH>
                </TR>
              </THead>
              <TBody>
                {indicator.values.map((v) => (
                  <TR key={v.id}>
                    <TD className="whitespace-nowrap text-xs">
                      {format(v.asOf, "d MMM yyyy", { locale: ruLocale })}
                    </TD>
                    <TD className="text-xs tabular-nums">
                      {v.value.toLocaleString("ru-RU")} {indicator.unit}
                    </TD>
                    <TD className="text-xs">
                      <Badge variant={v.loadType === "AUTO" ? "default" : "outline"}>
                        {v.loadType === "AUTO" ? ru.loadTypes.AUTO : ru.loadTypes.MANUAL}
                      </Badge>
                    </TD>
                    <TD className="max-w-64 text-[11px] text-slate-600">{v.versionNote ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Где используется</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Решение</TH>
                <TH>Название</TH>
                <TH>Роль в решении</TH>
                <TH>Качество подтверждено</TH>
              </TR>
            </THead>
            <TBody>
              {indicator.decisionLinks.length === 0 && (
                <TR>
                  <TD colSpan={4} className="py-4 text-center text-sm text-slate-500">
                    Показатель не привязан ни к одному паспорту решения.
                  </TD>
                </TR>
              )}
              {indicator.decisionLinks.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <Link href={`/decisions/${l.decisionId}`} className="font-mono text-xs text-brand-accent hover:underline">
                      {l.decision.code}
                    </Link>
                  </TD>
                  <TD className="max-w-96 text-sm">{l.decision.title}</TD>
                  <TD className="text-xs">
                    {l.isCritical || indicator.isCritical ? (
                      <Badge variant="warn">критический</Badge>
                    ) : (
                      <Badge variant="neutral">справочный</Badge>
                    )}
                  </TD>
                  <TD className="text-xs">
                    {l.confirmedAt ? (
                      <span className="text-emerald-700">
                        {format(l.confirmedAt, "d MMM yyyy", { locale: ruLocale })}
                      </span>
                    ) : (
                      <span className="text-brand-warn">не подтверждено</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
