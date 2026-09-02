"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isBefore } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Plus, Target, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { addAssignment, completeAssignment } from "@/app/actions/evidence";
import { ru } from "@/lib/i18n/ru";
import type { AssignmentStatus } from "@/lib/domain";

export interface AssignmentView {
  id: string;
  text: string;
  assigneeName: string;
  dueDate: string;
  status: string;
  completedAt: string | null;
  kpiCode: string | null;
  kpiName: string | null;
}

const schema = z.object({
  text: z.string().min(5, "Опишите поручение"),
  assigneeId: z.string().min(1, "Выберите исполнителя"),
  dueDate: z.string().min(8, "Укажите срок"),
  linkedKpiId: z.string().min(1, "Поручение должно быть связано с KPI результата"),
});
type Values = z.infer<typeof schema>;

const STATUS_VARIANT: Record<string, "neutral" | "accent" | "resolvedSoft" | "action"> = {
  OPEN: "neutral",
  IN_PROGRESS: "accent",
  DONE: "resolvedSoft",
  OVERDUE: "action",
};

export function AssignmentsPanel({
  decisionId,
  assignments,
  users,
  indicators,
  canManage,
}: {
  decisionId: string;
  assignments: AssignmentView[];
  users: Array<{ id: string; name: string; role: string }>;
  indicators: Array<{ id: string; code: string; name: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", assigneeId: "", dueDate: "", linkedKpiId: "" },
  });

  const unlinked = assignments.filter((assignment) => !assignment.kpiCode);
  const overdueCount = assignments.filter(
    (assignment) =>
      assignment.status !== "DONE" && isBefore(new Date(assignment.dueDate), new Date())
  ).length;
  const completedCount = assignments.filter((assignment) => assignment.status === "DONE").length;

  async function complete(id: string) {
    setBusy(true);
    setError(null);
    const result = await completeAssignment(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-4 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow">Execution control</p>
          <h2 className="mt-1 text-decision font-semibold tracking-[-0.02em] text-text">
            Поручения по исполнению
          </h2>
          <p className="mt-2 text-base text-muted">
            Каждое поручение связывает ответственность, контрольный срок и измеримый KPI
            результата. Без этой цепочки исполнение не проходит gate.
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line border-y border-line py-2 text-center">
          <div className="px-4">
            <dt className="text-meta text-muted">Всего</dt>
            <dd className="font-technical text-lead font-semibold text-text">{assignments.length}</dd>
          </div>
          <div className="px-4">
            <dt className="text-meta text-muted">Исполнено</dt>
            <dd className="font-technical text-lead font-semibold text-success">{completedCount}</dd>
          </div>
          <div className="px-4">
            <dt className="text-meta text-muted">Просрочено</dt>
            <dd className="font-technical text-lead font-semibold text-action">{overdueCount}</dd>
          </div>
        </dl>
      </header>

      {unlinked.length > 0 && (
        <div className="flex items-start gap-3 border-l-2 border-action bg-action-soft px-4 py-3 text-table text-action">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Gate blocker:</span> поручений без KPI — {unlinked.length}.
            Переход к исполнению для уровней A и B будет заблокирован.
          </p>
        </div>
      )}

      <section className="overflow-hidden border-y border-line bg-surface" aria-labelledby="assignment-register-heading">
        <div className="flex flex-col justify-between gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <h3 id="assignment-register-heading" className="text-section font-semibold text-text">
            Контур ответственности
          </h3>
          <p className="text-table text-muted">Поручение → исполнитель → срок → KPI → статус</p>
        </div>
        <Table className="min-w-[940px]">
          <THead>
            <TR>
              <TH scope="col" className="w-[34%]">Поручение</TH>
              <TH scope="col">Исполнитель</TH>
              <TH scope="col">Контрольный срок</TH>
              <TH scope="col">KPI результата</TH>
              <TH scope="col">Статус</TH>
              <TH scope="col" aria-label="Действие" />
            </TR>
          </THead>
          <TBody>
            {assignments.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-base text-muted">
                  Поручения не созданы.
                </TD>
              </TR>
            )}
            {assignments.map((assignment) => {
              const overdue =
                assignment.status !== "DONE" &&
                isBefore(new Date(assignment.dueDate), new Date());
              const displayStatus = overdue ? "OVERDUE" : assignment.status;
              return (
                <TR key={assignment.id}>
                  <TD>
                    <p className="text-base font-semibold text-text">{assignment.text}</p>
                    {assignment.completedAt && (
                      <p className="mt-1 text-meta text-muted">
                        Завершено {format(new Date(assignment.completedAt), "d MMM yyyy", { locale: ruLocale })}
                      </p>
                    )}
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-2 text-table font-semibold text-text">
                      <UserRound className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      {assignment.assigneeName}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap font-technical text-table">
                    <span className={overdue ? "font-semibold text-action" : "text-text"}>
                      {format(new Date(assignment.dueDate), "d MMM yyyy", { locale: ruLocale })}
                    </span>
                  </TD>
                  <TD>
                    {assignment.kpiCode ? (
                      <span className="inline-flex items-start gap-2" title={assignment.kpiName ?? undefined}>
                        <Target className="mt-0.5 h-3.5 w-3.5 text-accent" aria-hidden="true" />
                        <span>
                          <span className="block font-technical text-table font-semibold text-text">
                            {assignment.kpiCode}
                          </span>
                          {assignment.kpiName && (
                            <span className="mt-0.5 block max-w-52 text-meta text-muted">
                              {assignment.kpiName}
                            </span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="text-table font-semibold text-action">Не связано</span>
                    )}
                  </TD>
                  <TD>
                    <Badge variant={STATUS_VARIANT[displayStatus] ?? "neutral"}>
                      {displayStatus === "DONE" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {ru.assignmentStatuses[displayStatus as AssignmentStatus]}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    {canManage && assignment.status !== "DONE" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => complete(assignment.id)}
                      >
                        Отметить исполненным
                      </Button>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </section>

      {error && (
        <p className="rounded-control border border-action bg-action-soft px-3 py-2 text-table text-action" role="alert">
          {error}
        </p>
      )}

      {canManage && (
        <section className="surface-band p-5" aria-labelledby="new-assignment-heading">
          <div className="border-b border-line pb-4">
            <p className="eyebrow">New accountability</p>
            <h3 id="new-assignment-heading" className="mt-1 text-section font-semibold text-text">
              Создать поручение
            </h3>
          </div>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              const result = await addAssignment(decisionId, values);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              reset();
              router.refresh();
            })}
            className="mt-5 space-y-4"
          >
            <div>
              <Label htmlFor="asg-text">Формулировка поручения</Label>
              <Textarea id="asg-text" {...register("text")} />
              {errors.text && <p className="mt-1 text-table text-action">{errors.text.message}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <Label htmlFor="asg-user">Исполнитель</Label>
                <Select id="asg-user" {...register("assigneeId")}>
                  <option value="">— выберите —</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
                {errors.assigneeId && (
                  <p className="mt-1 text-table text-action">{errors.assigneeId.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="asg-due">Срок исполнения</Label>
                <Input id="asg-due" type="date" {...register("dueDate")} />
                {errors.dueDate && (
                  <p className="mt-1 text-table text-action">{errors.dueDate.message}</p>
                )}
              </div>
              <div className="md:col-span-2 xl:col-span-1">
                <Label htmlFor="asg-kpi">KPI результата (обязательно)</Label>
                <Select id="asg-kpi" {...register("linkedKpiId")}>
                  <option value="">— выберите показатель —</option>
                  {indicators.map((indicator) => (
                    <option key={indicator.id} value={indicator.id}>
                      {indicator.code} — {indicator.name}
                    </option>
                  ))}
                </Select>
                {errors.linkedKpiId && (
                  <p className="mt-1 text-table text-action">{errors.linkedKpiId.message}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={isSubmitting}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? "Создание…" : "Создать поручение"}
              </Button>
              <p className="text-meta text-muted">
                Автор, исполнитель, срок и KPI сохраняются в evidence trail решения.
              </p>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
