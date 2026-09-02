// Каталог показателей: владельцы, источники, актуальность, критичность.
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { SOURCE_SYSTEMS, type SourceSystem } from "@/lib/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatTile } from "@/components/stat-tile";

export const dynamic = "force-dynamic";

export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; critical?: string }>;
}) {
  await requireUser();
  const f = await searchParams;

  const indicators = await prisma.indicator.findMany({
    where: {
      ...(f.q ? { OR: [{ code: { contains: f.q } }, { name: { contains: f.q } }] } : {}),
      ...(f.source && SOURCE_SYSTEMS.includes(f.source as SourceSystem) ? { sourceSystem: f.source } : {}),
      ...(f.critical === "1" ? { isCritical: true } : {}),
    },
    include: { owner: true, values: { orderBy: { asOf: "desc" }, take: 1 }, _count: { select: { values: true } } },
    orderBy: [{ isCritical: "desc" }, { code: "asc" }],
  });

  const all = await prisma.indicator.findMany({ select: { isCritical: true, ownerId: true, sourceSystem: true } });
  const criticalAll = all.filter((i) => i.isCritical);
  const criticalOwned = criticalAll.filter((i) => i.ownerId && i.sourceSystem);
  const autoLoadable = all.filter((i) => !["MANUAL", "EXTERNAL"].includes(i.sourceSystem));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.indicators}</h1>
        <p className="text-xs text-slate-500">
          Каждое число в паспорте решения ведёт сюда: система-источник, дата актуальности, владелец,
          формула расчёта.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatTile label="Показателей в каталоге" value={String(all.length)} nature="fact" source="Каталог показателей" />
        <StatTile label="Критических показателей" value={String(criticalAll.length)} nature="fact" source="Каталог показателей" />
        <StatTile
          label="Критические с владельцем и источником"
          value={`${criticalAll.length > 0 ? Math.round((criticalOwned.length / criticalAll.length) * 100) : 0} %`}
          hint={`${criticalOwned.length} из ${criticalAll.length}`}
          warn={criticalOwned.length < criticalAll.length}
          nature="fact"
          source="Каталог показателей"
          formula="критические с владельцем и источником / все критические × 100"
        />
        <StatTile
          label="Доля автозагружаемых"
          value={`${all.length > 0 ? Math.round((autoLoadable.length / all.length) * 100) : 0} %`}
          hint="Источники SAP, eKAP, Power BI, DWH"
          nature="fact"
          source="Каталог показателей"
        />
      </div>

      <Card>
        <CardContent className="py-3">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Поиск по коду или названию"
              className="h-8 w-64 rounded border border-slate-300 px-2 text-xs"
            />
            <select name="source" defaultValue={f.source ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все источники</option>
              {SOURCE_SYSTEMS.map((s) => (
                <option key={s} value={s}>{ru.sourceSystems[s]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" name="critical" value="1" defaultChecked={f.critical === "1"} />
              Только критические
            </label>
            <Button type="submit" size="sm">Применить</Button>
            <Link href="/indicators">
              <Button type="button" size="sm" variant="ghost">Сбросить</Button>
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Код</TH>
                <TH>Наименование</TH>
                <TH>Ед.</TH>
                <TH>Источник</TH>
                <TH>Владелец</TH>
                <TH>Периодичность</TH>
                <TH>Актуально на</TH>
                <TH>Значений</TH>
              </TR>
            </THead>
            <TBody>
              {indicators.map((i) => {
                const latest = i.values[0];
                const lag = latest ? differenceInCalendarDays(new Date(), latest.asOf) : null;
                const stale = lag !== null && lag > i.maxLagDays;
                return (
                  <TR key={i.id}>
                    <TD className="whitespace-nowrap">
                      <Link href={`/indicators/${i.id}`} className="font-mono text-xs text-brand-accent hover:underline">
                        {i.code}
                      </Link>
                      {i.isCritical && <Badge variant="warn" className="ml-1">крит.</Badge>}
                    </TD>
                    <TD className="max-w-80 text-sm">{i.name}</TD>
                    <TD className="text-xs">{i.unit}</TD>
                    <TD className="text-xs">{ru.sourceSystems[i.sourceSystem as SourceSystem]}</TD>
                    <TD className="text-xs">
                      {i.owner?.name ?? <span className="text-brand-warn">не назначен</span>}
                    </TD>
                    <TD className="text-xs">
                      {ru.frequency[i.frequency as keyof typeof ru.frequency] ?? i.frequency}
                    </TD>
                    <TD className="whitespace-nowrap text-xs">
                      {latest ? (
                        <span className={stale ? "text-brand-warn" : ""}>
                          {format(latest.asOf, "d MMM yyyy", { locale: ruLocale })}
                          {stale && ` (лаг ${lag} дн. > ${i.maxLagDays})`}
                        </span>
                      ) : (
                        <span className="text-brand-warn">нет значений</span>
                      )}
                    </TD>
                    <TD className="text-xs tabular-nums">{i._count.values}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
