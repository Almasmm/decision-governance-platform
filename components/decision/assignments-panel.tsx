"use client";

// Поручения по исполнению решения. Каждое поручение обязано быть связано
// с KPI результата — иначе исполнение невозможно измерить.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isBefore } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUS_VARIANT: Record<string, "neutral" | "default" | "success" | "warn"> = {
  OPEN: "neutral",
  IN_PROGRESS: "default",
  DONE: "success",
  OVERDUE: "warn",
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

  const unlinked = assignments.filter((a) => !a.kpiCode);

  async function complete(id: string) {
    setBusy(true);
    setError(null);
    const res = await completeAssignment(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {unlinked.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-brand-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Поручений без связи с KPI результата: {unlinked.length}. Контрольные ворота перехода к
            исполнению не пропустят решение уровней A и B.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Поручения по исполнению решения</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Поручение</TH>
                <TH>Исполнитель</TH>
                <TH>Срок</TH>
                <TH>KPI результата</TH>
                <TH>Статус</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {assignments.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-4 text-center text-sm text-slate-500">
                    Поручения не созданы.
                  </TD>
                </TR>
              )}
              {assignments.map((a) => {
                const overdue =
                  a.status !== "DONE" && isBefore(new Date(a.dueDate), new Date());
                return (
                  <TR key={a.id}>
                    <TD className="max-w-80 text-sm">{a.text}</TD>
                    <TD className="text-xs">{a.assigneeName}</TD>
                    <TD className="whitespace-nowrap text-xs">
                      <span className={overdue ? "text-brand-warn" : ""}>
                        {format(new Date(a.dueDate), "d MMM yyyy", { locale: ruLocale })}
                      </span>
                    </TD>
                    <TD className="text-xs">
                      {a.kpiCode ? (
                        <span title={a.kpiName ?? undefined}>
                          <Badge variant="outline">{a.kpiCode}</Badge>
                        </span>
                      ) : (
                        <span className="text-brand-warn">не связано</span>
                      )}
                    </TD>
                    <TD>
                      <Badge variant={STATUS_VARIANT[overdue ? "OVERDUE" : a.status] ?? "neutral"}>
                        {ru.assignmentStatuses[(overdue ? "OVERDUE" : a.status) as AssignmentStatus]}
                      </Badge>
                    </TD>
                    <TD>
                      {canManage && a.status !== "DONE" && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => complete(a.id)}>
                          Отметить исполненным
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {error && <p className="px-4 py-2 text-xs text-red-700">{error}</p>}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Создать поручение</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                const res = await addAssignment(decisionId, values);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                reset();
                router.refresh();
              })}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="asg-text">Формулировка поручения</Label>
                <Textarea id="asg-text" {...register("text")} />
                {errors.text && <p className="mt-1 text-xs text-red-700">{errors.text.message}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="asg-user">Исполнитель</Label>
                  <Select id="asg-user" {...register("assigneeId")}>
                    <option value="">— выберите —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                  {errors.assigneeId && (
                    <p className="mt-1 text-xs text-red-700">{errors.assigneeId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="asg-due">Срок исполнения</Label>
                  <Input id="asg-due" type="date" {...register("dueDate")} />
                  {errors.dueDate && (
                    <p className="mt-1 text-xs text-red-700">{errors.dueDate.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="asg-kpi">KPI результата (обязательно)</Label>
                  <Select id="asg-kpi" {...register("linkedKpiId")}>
                    <option value="">— выберите показатель —</option>
                    {indicators.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} — {i.name}
                      </option>
                    ))}
                  </Select>
                  {errors.linkedKpiId && (
                    <p className="mt-1 text-xs text-red-700">{errors.linkedKpiId.message}</p>
                  )}
                </div>
              </div>
              {error && <p className="text-xs text-red-700">{error}</p>}
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Создание…" : "Создать поручение"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
