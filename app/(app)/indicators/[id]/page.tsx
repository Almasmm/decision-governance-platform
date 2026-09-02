// Карточка доказательства: утверждённое определение показателя, его значения,
// происхождение и решения, которые используют показатель.
import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import {
  Activity,
  ArrowLeft,
  CircleAlert,
  Clock3,
  Database,
  ShieldCheck,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { ru } from "@/lib/i18n/ru";
import { parseJson, type SourceSystem } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardNote, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  LineageGraph,
  type LineageNode,
  type LineageUse,
} from "@/components/lineage-graph";
import { NatureMark, Provenance } from "@/components/provenance";
import { EvidenceNatureLegend } from "@/components/indicators/evidence-nature-legend";
import { ValueHistoryChart } from "@/components/charts/value-history";
import { IndicatorLoadButton } from "@/components/indicator-load-button";

export const dynamic = "force-dynamic";

const BODY_KIND: Record<string, string> = {
  BOARD: "Совет директоров",
  COMMITTEE: "Комитет",
  MANAGEMENT: "Правление",
  EXECUTIVE: "Руководитель",
};

const LINEAGE_NOT_REGISTERED = "Не зарегистрировано";
const LINEAGE_NOT_APPLICABLE = "Не применимо";

export default async function IndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const indicator = await prisma.indicator.findUnique({
    where: { id },
    include: {
      owner: true,
      values: { orderBy: { asOf: "desc" } },
      decisionLinks: {
        include: {
          decision: {
            include: {
              decisionBody: true,
              initiator: true,
            },
          },
        },
      },
    },
  });
  if (!indicator) notFound();

  const latest = indicator.values[0];
  const lag = latest
    ? Math.max(0, differenceInCalendarDays(new Date(), latest.asOf))
    : null;
  const stale = lag !== null && lag > indicator.maxLagDays;
  const autoLoadable = !["MANUAL", "EXTERNAL"].includes(indicator.sourceSystem);
  const qualityRules = parseJson<Record<string, unknown>>(indicator.qualityRules, {});
  const qualityLabels = describeQualityRules(qualityRules, indicator.maxLagDays);
  const sourceName = ru.sourceSystems[indicator.sourceSystem as SourceSystem];
  const ownerName = indicator.owner?.name ?? "Не назначен";
  const lineageOwner = indicator.owner?.name ?? LINEAGE_NOT_REGISTERED;

  const backbone: LineageNode[] = [
    {
      id: "source",
      title: sourceName,
      description:
        indicator.sourceSystem === "MANUAL"
          ? "Значение фиксируется человеком; первичный документ должен быть указан в примечании версии."
          : indicator.sourceSystem === "EXTERNAL"
            ? "Внешнее доказательство регистрируется в каталоге с датой актуальности и версией."
            : "Система зарегистрирована как первичный источник показателя.",
      kind: "source",
      status: indicator.sourceSystem === "MANUAL" ? "attention" : "neutral",
      statusLabel: indicator.sourceSystem === "MANUAL" ? "Ручной контроль" : "Зарегистрирован",
      metadata: [
        { label: "Дата", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Владелец", value: lineageOwner, attention: !indicator.owner },
        { label: "Версия", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Канал", value: autoLoadable ? "Демо-коннектор" : "Ручная фиксация" },
      ],
    },
    buildIntegrationNode(indicator.sourceSystem),
    {
      id: "calculation",
      title: indicator.formula ?? "Прямое измерение",
      description: indicator.formula
        ? "Утверждённая формула преобразует входные данные в показатель."
        : "Расчётное преобразование не задано: в реестр передаётся измеренное значение.",
      kind: "calculation",
      status: "verified",
      statusLabel: "Определено",
      metadata: [
        { label: "Дата", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Владелец", value: lineageOwner, attention: !indicator.owner },
        { label: "Версия", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Единица", value: indicator.unit },
        { label: "Контроль качества", value: `${qualityLabels.length} правил` },
      ],
    },
    {
      id: "evidence",
      title: latest ? `${latest.value.toLocaleString("ru-RU")} ${indicator.unit}` : "Значение отсутствует",
      description: latest
        ? `Версия показателя на ${format(latest.asOf, "d MMMM yyyy", { locale: ruLocale })}.`
        : "Показатель определён, но датированное наблюдение ещё не зарегистрировано.",
      kind: "evidence",
      status: !latest || stale ? "attention" : "verified",
      statusLabel: !latest ? "Нет значения" : stale ? "Требует обновления" : "Актуально",
      nature: latest ? "fact" : undefined,
      metadata: [
        {
          label: "Дата",
          value: latest
            ? format(latest.asOf, "d MMMM yyyy", { locale: ruLocale })
            : LINEAGE_NOT_REGISTERED,
          attention: !latest,
        },
        { label: "Владелец", value: lineageOwner, attention: !indicator.owner },
        {
          label: "Версия",
          value: latest
            ? latest.versionNote ?? LINEAGE_NOT_REGISTERED
            : LINEAGE_NOT_APPLICABLE,
          attention: Boolean(latest && !latest.versionNote),
        },
        { label: "Источник", value: sourceName },
        {
          label: "Лаг",
          value: lag === null ? "Не рассчитывается" : `${lag} / ${indicator.maxLagDays} дн.`,
          attention: !latest || stale,
        },
      ],
    },
  ];

  const uses: LineageUse[] = indicator.decisionLinks.map((link) => ({
    id: link.id,
    decision: {
      id: `decision-${link.decisionId}`,
      title: `${link.decision.code} · ${link.decision.title}`,
      description:
        link.isCritical || indicator.isCritical
          ? "Показатель входит в критическую доказательную базу."
          : "Показатель используется как справочное доказательство.",
      kind: "decision",
      status: link.confirmedAt ? "verified" : "attention",
      statusLabel: link.confirmedAt ? "Качество подтверждено" : "Ожидает подтверждения",
      href: `/decisions/${link.decisionId}`,
      metadata: [
        {
          label: "Дата",
          value: format(link.decision.registeredAt, "d MMMM yyyy", { locale: ruLocale }),
        },
        { label: "Владелец", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Версия", value: LINEAGE_NOT_REGISTERED, attention: true },
        {
          label: "Этап",
          value: ru.stages[link.decision.stage as keyof typeof ru.stages] ?? link.decision.stage,
        },
        {
          label: "Статус решения",
          value: ru.statuses[link.decision.status as keyof typeof ru.statuses] ?? link.decision.status,
        },
        { label: "Инициатор", value: link.decision.initiator.name },
      ],
    },
    authority: {
      id: `authority-${link.decisionId}`,
      title: link.decision.decisionBody.name,
      description: "Орган, уполномоченный рассматривать и принимать это решение.",
      kind: "authority",
      status: "neutral",
      statusLabel: "Назначен",
      metadata: [
        { label: "Дата", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Владелец", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Версия", value: LINEAGE_NOT_REGISTERED, attention: true },
        {
          label: "Тип",
          value: BODY_KIND[link.decision.decisionBody.kind] ?? link.decision.decisionBody.kind,
        },
      ],
    },
  }));

  return (
    <div className="space-y-6" data-tour="indicator-detail">
      <Link
        href="/indicators"
        className="inline-flex items-center gap-1.5 text-table font-medium text-muted hover:text-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Каталог показателей
      </Link>

      <section
        className="grid overflow-hidden rounded-panel bg-surface shadow-panel lg:grid-cols-[minmax(0,1fr)_340px]"
        data-tour="indicator-detail-overview"
      >
        <div className="bg-obsidian px-5 py-6 text-white sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-technical text-table font-semibold tracking-[0.08em] text-white/65">
              {indicator.code}
            </span>
            {indicator.isCritical && (
              <Badge className="border-white/35 text-white" variant="outline">Критический показатель</Badge>
            )}
            <Badge className="border-white/35 text-white" variant="outline">{sourceName}</Badge>
          </div>
          <p className="mt-5 text-meta font-semibold tracking-[0.12em] text-white/55">КАРТОЧКА ДОКАЗАТЕЛЬСТВА</p>
          <h1 className="mt-2 max-w-4xl text-page font-semibold tracking-[-0.025em] text-white">
            {indicator.name}
          </h1>
          <p className="mt-3 max-w-4xl text-lead leading-7 text-white/75">{indicator.businessMeaning}</p>
          <dl className="mt-6 grid gap-4 border-t border-white/20 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-meta text-white/50">Владелец данных</dt>
              <dd className="mt-1 text-table font-semibold text-white">{ownerName}</dd>
            </div>
            <div>
              <dt className="text-meta text-white/50">Периодичность</dt>
              <dd className="mt-1 text-table font-semibold text-white">
                {ru.frequency[indicator.frequency as keyof typeof ru.frequency] ?? indicator.frequency}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-white/50">Допустимый лаг</dt>
              <dd className="mt-1 text-table font-semibold text-white">{indicator.maxLagDays} дн.</dd>
            </div>
          </dl>
        </div>

        <aside
          className="flex flex-col justify-between border-t border-line px-5 py-5 lg:border-l lg:border-t-0"
          aria-label="Текущее значение показателя"
          data-tour="indicator-provenance"
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-meta font-semibold tracking-[0.1em] text-muted">ТЕКУЩЕЕ ДОКАЗАТЕЛЬСТВО</p>
              {latest && <NatureMark nature="fact" />}
            </div>
            {latest ? (
              <Provenance
                className="mt-4"
                value={`${latest.value.toLocaleString("ru-RU")} ${indicator.unit}`}
                nature="fact"
                source={sourceName}
                asOf={format(latest.asOf, "d MMMM yyyy", { locale: ruLocale })}
                owner={indicator.owner?.name}
                formula={indicator.formula ?? "Прямое измерение"}
                note={latest.versionNote ?? undefined}
              />
            ) : (
              <p className="mt-4 text-section font-semibold text-action">Значение отсутствует</p>
            )}
            <p className="mt-2 text-table text-muted">
              {latest
                ? `Актуально на ${format(latest.asOf, "d MMMM yyyy", { locale: ruLocale })}`
                : "Нет датированного наблюдения"}
            </p>
          </div>
          <div className="mt-6 border-t border-line pt-4" data-tour="indicator-freshness">
            <div className="flex items-center gap-2">
              {!latest || stale ? (
                <CircleAlert className="h-4 w-4 text-action" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
              )}
              <p className={`text-table font-semibold ${!latest || stale ? "text-action" : "text-accent"}`}>
                {!latest ? "Требуется загрузка" : stale ? "Превышен допустимый лаг" : "В пределах политики актуальности"}
              </p>
            </div>
            <p className="mt-2 text-meta text-muted">
              Лаг: {lag === null ? "не рассчитывается" : `${lag} из ${indicator.maxLagDays} дн.`}
            </p>
          </div>
        </aside>
      </section>

      <section
        className="grid overflow-hidden rounded-panel bg-surface shadow-panel lg:grid-cols-[minmax(0,1fr)_340px]"
        aria-labelledby="data-contract-title"
        data-tour="indicator-definition"
      >
        <div className="px-5 py-5 sm:px-6">
          <p className="text-meta font-semibold tracking-[0.1em] text-muted">DATA CONTRACT</p>
          <h2 id="data-contract-title" className="mt-1 text-section font-semibold text-text">Утверждённое определение</h2>
          <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="text-meta font-semibold text-muted">Бизнес-смысл</dt>
              <dd className="mt-1 text-base leading-6 text-text">{indicator.businessMeaning}</dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Формула расчёта</dt>
              <dd className="mt-1 rounded-control bg-surface-raised px-3 py-2 font-technical text-table leading-5 text-text">
                {indicator.formula ?? "Прямое измерение — формула преобразования не применяется"}
              </dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Источник и единица</dt>
              <dd className="mt-1 text-base text-text">{sourceName} · {indicator.unit}</dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Владелец определения</dt>
              <dd className={`mt-1 text-base font-medium ${indicator.owner ? "text-text" : "text-action"}`}>
                {ownerName}
              </dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Частота обновления</dt>
              <dd className="mt-1 text-base text-text">
                {ru.frequency[indicator.frequency as keyof typeof ru.frequency] ?? indicator.frequency}
              </dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Политика актуальности</dt>
              <dd className="mt-1 text-base text-text">Не старше {indicator.maxLagDays} календарных дней</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-meta font-semibold text-muted">Правила качества</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {qualityLabels.map((label) => (
                <li key={label} className="flex items-start gap-2 text-table text-text">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
            <details className="mt-4 text-meta text-muted">
              <summary className="cursor-pointer font-medium hover:text-text">Техническая конфигурация правил</summary>
              <pre className="mt-2 overflow-x-auto rounded-control bg-surface-raised p-3 font-technical text-meta text-text">
                {JSON.stringify(qualityRules, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        <aside className="border-t border-line px-5 py-5 lg:border-l lg:border-t-0">
          <EvidenceNatureLegend />
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-table font-semibold text-text">Контракт природы значения</p>
            <p className="mt-1 text-meta leading-5 text-muted">
              История этого показателя содержит датированные наблюдения и поэтому маркируется как
              «Факт». Прогнозы и допущения не подменяют это значение и должны храниться отдельно.
            </p>
          </div>
        </aside>
      </section>

      <Card data-tour="indicator-lineage-workspace">
        <CardHeader>
          <div>
            <p className="flex items-center gap-2 text-meta font-semibold tracking-[0.1em] text-muted">
              <Database className="h-4 w-4" aria-hidden="true" />
              DATA LINEAGE
            </p>
            <CardTitle className="mt-1">От источника до органа принятия решения</CardTitle>
          </div>
          <CardNote>Статус, лаг и владелец показаны непосредственно на узлах</CardNote>
        </CardHeader>
        <CardContent>
          <LineageGraph backbone={backbone} uses={uses} />
          <p className="mt-4 border-t border-line pt-3 text-meta leading-5 text-muted">
            Пунктирный интеграционный узел обозначает демонстрационный маршрут, а не действующее
            промышленное подключение. Каждая связь с решением соответствует записи в реестре доказательств.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card data-tour="indicator-history">
          <CardHeader className="items-start">
            <div>
              <p className="flex items-center gap-2 text-meta font-semibold tracking-[0.1em] text-muted">
                <Activity className="h-4 w-4" aria-hidden="true" />
                TIME SERIES
              </p>
              <CardTitle className="mt-1">Динамика фактических значений</CardTitle>
            </div>
            {can(user.role, "indicator.manage") && (
              <IndicatorLoadButton
                indicatorId={indicator.id}
                disabled={!autoLoadable}
                hint={
                  autoLoadable
                    ? "Получение через серверный демо-коннектор; результат будет новой версией факта."
                    : "Для этого источника автоматическая загрузка не поддерживается."
                }
              />
            )}
          </CardHeader>
          <CardContent>
            {indicator.values.length > 0 ? (
              <ValueHistoryChart
                data={[...indicator.values]
                  .reverse()
                  .map((value) => ({ date: format(value.asOf, "dd.MM.yy"), value: value.value }))}
                unit={indicator.unit}
              />
            ) : (
              <div className="flex min-h-56 items-center justify-center rounded-control border border-dashed border-line px-4 text-center text-base text-muted">
                Значения ещё не загружались.
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-tour="indicator-version-history">
          <CardHeader>
            <div>
              <p className="flex items-center gap-2 text-meta font-semibold tracking-[0.1em] text-muted">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                VERSION HISTORY
              </p>
              <CardTitle className="mt-1">История загрузок</CardTitle>
            </div>
            <CardNote>{indicator.values.length} версий</CardNote>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-[720px]">
              <THead>
                <TR>
                  <TH>Природа</TH>
                  <TH>Актуально на</TH>
                  <TH>Значение</TH>
                  <TH>Загружено</TH>
                  <TH>Способ / версия</TH>
                </TR>
              </THead>
              <TBody>
                {indicator.values.length === 0 && (
                  <TR>
                    <TD colSpan={5} className="py-8 text-center text-base text-muted">История пуста.</TD>
                  </TR>
                )}
                {indicator.values.map((value) => (
                  <TR key={value.id}>
                    <TD><NatureMark nature="fact" /></TD>
                    <TD className="whitespace-nowrap text-table">
                      {format(value.asOf, "d MMM yyyy", { locale: ruLocale })}
                    </TD>
                    <TD className="whitespace-nowrap text-table font-semibold tabular-nums">
                      {value.value.toLocaleString("ru-RU")} {indicator.unit}
                    </TD>
                    <TD className="whitespace-nowrap text-table text-muted">
                      {format(value.loadedAt, "d MMM yyyy, HH:mm", { locale: ruLocale })}
                    </TD>
                    <TD className="max-w-64 text-table">
                      <Badge variant={value.loadType === "AUTO" ? "resolvedSoft" : "outline"}>
                        {value.loadType === "AUTO" ? ru.loadTypes.AUTO : ru.loadTypes.MANUAL}
                      </Badge>
                      <p className="mt-1 text-meta leading-4 text-muted">{value.versionNote ?? "Без примечания версии"}</p>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card data-tour="indicator-decision-usage">
        <CardHeader>
          <div>
            <p className="text-meta font-semibold tracking-[0.1em] text-muted">EVIDENCE USAGE</p>
            <CardTitle className="mt-1">Где используется показатель</CardTitle>
          </div>
          <CardNote>{indicator.decisionLinks.length} паспортов решений</CardNote>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[900px]">
            <THead>
              <TR>
                <TH>Решение</TH>
                <TH>Роль показателя</TH>
                <TH>Этап / статус</TH>
                <TH>Уполномоченный орган</TH>
                <TH>Качество данных</TH>
              </TR>
            </THead>
            <TBody>
              {indicator.decisionLinks.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-base text-muted">
                    Показатель пока не включён в доказательную базу решений.
                  </TD>
                </TR>
              )}
              {indicator.decisionLinks.map((link) => (
                <TR key={link.id}>
                  <TD className="max-w-96">
                    <Link href={`/decisions/${link.decisionId}`} className="font-technical text-table font-semibold text-accent hover:underline">
                      {link.decision.code}
                    </Link>
                    <p className="mt-1 text-table font-medium text-text">{link.decision.title}</p>
                  </TD>
                  <TD>
                    {link.isCritical || indicator.isCritical ? (
                      <Badge variant="outline">Критическое доказательство</Badge>
                    ) : (
                      <Badge variant="neutral">Справочное доказательство</Badge>
                    )}
                  </TD>
                  <TD className="text-table">
                    <p>{ru.stages[link.decision.stage as keyof typeof ru.stages] ?? link.decision.stage}</p>
                    <p className="mt-1 text-meta text-muted">
                      {ru.statuses[link.decision.status as keyof typeof ru.statuses] ?? link.decision.status}
                    </p>
                  </TD>
                  <TD className="text-table">
                    <p className="font-medium">{link.decision.decisionBody.name}</p>
                    <p className="mt-1 text-meta text-muted">
                      {BODY_KIND[link.decision.decisionBody.kind] ?? link.decision.decisionBody.kind}
                    </p>
                  </TD>
                  <TD className="text-table">
                    {link.confirmedAt ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        {format(link.confirmedAt, "d MMM yyyy", { locale: ruLocale })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-medium text-action">
                        <CircleAlert className="h-4 w-4" aria-hidden="true" />
                        Не подтверждено
                      </span>
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

function describeQualityRules(rules: Record<string, unknown>, maxLagDays: number) {
  const labels: string[] = [];

  if (rules.notNull === true) labels.push("Пустые значения запрещены");
  if (typeof rules.maxLagDays === "number") {
    labels.push(`Актуальность: не старше ${rules.maxLagDays} календарных дней`);
  } else {
    labels.push(`Актуальность: не старше ${maxLagDays} календарных дней`);
  }
  if (typeof rules.min === "number") labels.push(`Нижняя граница: ${rules.min}`);
  if (typeof rules.max === "number") labels.push(`Верхняя граница: ${rules.max}`);

  const describedKeys = new Set(["notNull", "maxLagDays", "min", "max"]);
  const additionalRuleCount = Object.keys(rules).filter((key) => !describedKeys.has(key)).length;
  if (additionalRuleCount > 0) labels.push(`Дополнительных машинных проверок: ${additionalRuleCount}`);

  return labels;
}

function buildIntegrationNode(sourceSystem: string): LineageNode {
  if (sourceSystem === "DWH") {
    return {
      id: "integration",
      title: "DWH · доверенный слой данных",
      description: "Целевой прямой маршрут из хранилища в каталог; текущее получение выполняет демо-коннектор.",
      kind: "integration",
      status: "demo",
      statusLabel: "Демо-коннектор",
      metadata: [
        { label: "Дата", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Владелец", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Версия", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Маршрут", value: "DWH → каталог" },
      ],
    };
  }

  if (["SAP", "EKAP", "POWERBI"].includes(sourceSystem)) {
    const routeSource = sourceSystem === "EKAP" ? "eKAP" : sourceSystem === "POWERBI" ? "Power BI" : sourceSystem;
    return {
      id: "integration",
      title: "DWH · интеграционный слой",
      description: "Целевой маршрут нормализации данных. В демо используется серверный коннектор-заглушка.",
      kind: "integration",
      status: "demo",
      statusLabel: "Демо-маршрут",
      metadata: [
        { label: "Дата", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Владелец", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Версия", value: LINEAGE_NOT_REGISTERED, attention: true },
        { label: "Маршрут", value: `${routeSource} → DWH` },
      ],
    };
  }

  return {
    id: "integration",
    title: "DWH · интеграционный слой",
    description: "Автоматический маршрут не настроен; перед публикацией требуется ручная проверка доказательства.",
    kind: "integration",
    status: "unavailable",
    statusLabel: "Не подключён",
    metadata: [
      { label: "Дата", value: LINEAGE_NOT_APPLICABLE },
      { label: "Владелец", value: LINEAGE_NOT_APPLICABLE },
      { label: "Версия", value: LINEAGE_NOT_APPLICABLE },
      { label: "Маршрут", value: "Ручная регистрация" },
    ],
  };
}
