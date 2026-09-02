// Реестр решений: фильтры по типу, критичности, стадии, статусу, органу, сроку + поиск.
import Link from "next/link";
import { format, isBefore } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Plus, RotateCcw } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { ru } from "@/lib/i18n/ru";
import {
  DECISION_TYPES, CRITICALITIES, STAGES, STATUSES,
  type Criticality, type DecisionStatus, type DecisionType, type Stage,
} from "@/lib/domain";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface Filters {
  type?: string;
  criticality?: string;
  stage?: string;
  status?: string;
  body?: string;
  q?: string;
  overdue?: string;
}

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const user = await requireUser();
  const f = await searchParams;

  const where: Prisma.DecisionWhereInput = {};
  if (f.type && DECISION_TYPES.includes(f.type as DecisionType)) where.type = f.type;
  if (f.criticality && CRITICALITIES.includes(f.criticality as Criticality)) where.criticality = f.criticality;
  if (f.stage && STAGES.includes(f.stage as Stage)) where.stage = f.stage;
  if (f.status && STATUSES.includes(f.status as DecisionStatus)) where.status = f.status;
  if (f.body) where.decisionBodyId = f.body;
  if (f.q) where.OR = [{ title: { contains: f.q } }, { code: { contains: f.q } }, { goal: { contains: f.q } }];
  if (f.overdue === "1")
    where.AND = [{ deadline: { lt: new Date() } }, { status: { notIn: ["CLOSED", "REJECTED"] } }];

  const [decisions, bodies] = await Promise.all([
    prisma.decision.findMany({
      where,
      include: {
        decisionBody: true,
        initiator: true,
        _count: { select: { alternatives: true, risks: true, assignments: true } },
      },
      orderBy: { registeredAt: "desc" },
    }),
    prisma.decisionBody.findMany({ orderBy: { name: "asc" } }),
  ]);

  const canCreate = can(user.role, "decision.create");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand">{ru.nav.decisions}</h1>
          <p className="text-xs text-slate-500">
            Найдено паспортов: {decisions.length}. Единица управления — управленческий вопрос, а не документ.
          </p>
        </div>
        {canCreate && (
          <Link href="/decisions/new">
            <Button>
              <Plus className="h-4 w-4" />
              Создать паспорт решения
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="py-3">
          <form method="get" className="grid gap-2 md:grid-cols-3 lg:grid-cols-7">
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Поиск по коду, названию, цели"
              className="h-8 rounded border border-slate-300 px-2 text-xs lg:col-span-2"
            />
            <select name="type" defaultValue={f.type ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все типы</option>
              {DECISION_TYPES.map((t) => (
                <option key={t} value={t}>{ru.decisionTypes[t]}</option>
              ))}
            </select>
            <select name="criticality" defaultValue={f.criticality ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все уровни</option>
              {CRITICALITIES.map((c) => (
                <option key={c} value={c}>{ru.criticality[c]}</option>
              ))}
            </select>
            <select name="stage" defaultValue={f.stage ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все стадии</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{ru.stages[s]}</option>
              ))}
            </select>
            <select name="status" defaultValue={f.status ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все статусы</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{ru.statuses[s]}</option>
              ))}
            </select>
            <select name="body" defaultValue={f.body ?? ""} className="h-8 rounded border border-slate-300 px-1.5 text-xs">
              <option value="">Все органы</option>
              {bodies.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" name="overdue" value="1" defaultChecked={f.overdue === "1"} />
              Только просроченные
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Применить</Button>
              <Link href="/decisions">
                <Button type="button" size="sm" variant="ghost">Сбросить</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Код</TH>
                <TH>Название</TH>
                <TH>Тип</TH>
                <TH>Ур.</TH>
                <TH>Стадия</TH>
                <TH>Статус</TH>
                <TH>Орган принятия</TH>
                <TH>Срок</TH>
                <TH>Доказательная база</TH>
              </TR>
            </THead>
            <TBody>
              {decisions.length === 0 && (
                <TR>
                  <TD colSpan={9} className="py-6 text-center text-sm text-slate-500">
                    По заданным фильтрам решений не найдено.
                  </TD>
                </TR>
              )}
              {decisions.map((d) => {
                const overdue =
                  d.deadline && isBefore(d.deadline, new Date()) && !["CLOSED", "REJECTED"].includes(d.status);
                return (
                  <TR key={d.id}>
                    <TD className="whitespace-nowrap">
                      <Link href={`/decisions/${d.id}`} className="font-mono text-xs text-brand-accent hover:underline">
                        {d.code}
                      </Link>
                    </TD>
                    <TD className="max-w-96">
                      <Link href={`/decisions/${d.id}`} className="text-sm text-slate-900 hover:text-brand-accent">
                        {d.title}
                      </Link>
                      {d.returnCount > 0 && (
                        <Badge variant="warn" className="ml-1">
                          <RotateCcw className="h-3 w-3" />
                          {d.returnCount}
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-xs">{ru.decisionTypes[d.type as DecisionType]}</TD>
                    <TD><CriticalityBadge level={d.criticality} /></TD>
                    <TD className="text-xs">{ru.stages[d.stage as Stage]}</TD>
                    <TD className="text-xs">{ru.statuses[d.status as DecisionStatus]}</TD>
                    <TD className="text-xs">{d.decisionBody.name}</TD>
                    <TD className="whitespace-nowrap text-xs">
                      {d.deadline ? (
                        <span className={overdue ? "text-brand-warn" : ""}>
                          {format(d.deadline, "d MMM yyyy", { locale: ruLocale })}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-[11px] text-slate-500">
                      альт. {d._count.alternatives} · риски {d._count.risks} · пор. {d._count.assignments}
                    </TD>
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
