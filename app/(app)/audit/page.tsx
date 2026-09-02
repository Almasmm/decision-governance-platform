// Сквозной журнал аудита с фильтрами по сущности, действию, пользователю и датам.
import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatTile } from "@/components/stat-tile";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; actor?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireUser();
  const f = await searchParams;
  const page = Math.max(1, Number(f.page ?? "1") || 1);

  const where: Prisma.AuditEventWhereInput = {};
  if (f.entity) where.entity = f.entity;
  if (f.action) where.action = f.action;
  if (f.actor) where.actorId = f.actor;
  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = new Date(f.from);
    if (f.to) {
      const to = new Date(f.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const [events, total, users, entities, actions] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditEvent.count({ where }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditEvent.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    prisma.auditEvent.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number): string => {
    const params = new URLSearchParams();
    if (f.entity) params.set("entity", f.entity);
    if (f.action) params.set("action", f.action);
    if (f.actor) params.set("actor", f.actor);
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
    params.set("page", String(p));
    return `/audit?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.audit}</h1>
        <p className="text-xs text-slate-500">
          Каждое изменение паспорта, подтверждение качества данных и вердикт по предложению ИИ
          фиксируются здесь.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatTile label="Событий по фильтру" value={String(total)} nature="fact" source="Журнал аудита" />
        <StatTile label="Типов сущностей" value={String(entities.length)} nature="fact" source="Журнал аудита" />
        <StatTile label="Типов действий" value={String(actions.length)} nature="fact" source="Журнал аудита" />
        <StatTile label="Страница" value={`${page} из ${totalPages}`} />
      </div>

      <Card>
        <CardContent className="py-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="a-entity" className="mb-0.5 block text-[11px] text-slate-500">Сущность</label>
              <select id="a-entity" name="entity" defaultValue={f.entity ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
                <option value="">Все</option>
                {entities.map((e) => (
                  <option key={e.entity} value={e.entity}>{e.entity}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="a-action" className="mb-0.5 block text-[11px] text-slate-500">Действие</label>
              <select id="a-action" name="action" defaultValue={f.action ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
                <option value="">Все</option>
                {actions.map((a) => (
                  <option key={a.action} value={a.action}>{a.action}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="a-actor" className="mb-0.5 block text-[11px] text-slate-500">Пользователь</label>
              <select id="a-actor" name="actor" defaultValue={f.actor ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
                <option value="">Все</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="a-from" className="mb-0.5 block text-[11px] text-slate-500">С даты</label>
              <input id="a-from" type="date" name="from" defaultValue={f.from ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs" />
            </div>
            <div>
              <label htmlFor="a-to" className="mb-0.5 block text-[11px] text-slate-500">По дату</label>
              <input id="a-to" type="date" name="to" defaultValue={f.to ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs" />
            </div>
            <Button type="submit" size="sm">Применить</Button>
            <Link href="/audit">
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
                <TH>Дата и время</TH>
                <TH>Сущность</TH>
                <TH>Действие</TH>
                <TH>Пользователь</TH>
                <TH>Было</TH>
                <TH>Стало</TH>
              </TR>
            </THead>
            <TBody>
              {events.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    По заданным фильтрам событий не найдено.
                  </TD>
                </TR>
              )}
              {events.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap text-xs">
                    {format(e.createdAt, "d MMM yyyy HH:mm:ss", { locale: ruLocale })}
                  </TD>
                  <TD className="text-xs">{e.entity}</TD>
                  <TD className="whitespace-nowrap text-xs font-medium text-brand">{e.action}</TD>
                  <TD className="text-xs">{e.actor.name}</TD>
                  <TD className="max-w-64 truncate text-[11px] text-slate-500" title={e.before ?? ""}>
                    {e.before ?? "—"}
                  </TD>
                  <TD className="max-w-80 truncate text-[11px] text-slate-600" title={e.after ?? ""}>
                    {e.after ?? "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs">
              {page > 1 ? (
                <Link href={qs(page - 1)} className="text-brand-accent hover:underline">← Предыдущая</Link>
              ) : (
                <span className="text-slate-300">← Предыдущая</span>
              )}
              <span className="text-slate-500">Страница {page} из {totalPages}</span>
              {page < totalPages ? (
                <Link href={qs(page + 1)} className="text-brand-accent hover:underline">Следующая →</Link>
              ) : (
                <span className="text-slate-300">Следующая →</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
