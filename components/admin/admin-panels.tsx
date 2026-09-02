"use client";

// Клиентские панели администрирования: роли, справочник органов, правила ворот.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, CriticalityBadge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  updateUserRole,
  createDecisionBody,
  setGateBlocking,
  createGateCheck,
  deleteGateCheck,
} from "@/app/actions/admin";
import { ROLES, CRITICALITIES, STAGES, type Criticality, type Role, type Stage } from "@/lib/domain";
import { GATE_RULE_CODES, ruleDescription, type GateRuleCode } from "@/lib/gates";
import { ru } from "@/lib/i18n/ru";

export function UsersPanel({
  users,
}: {
  users: Array<{ id: string; name: string; email: string; role: string; position: string | null }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи и роли</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {error && <p className="px-4 py-2 text-xs text-red-700">{error}</p>}
        <Table>
          <THead>
            <TR>
              <TH>Пользователь</TH>
              <TH>Email</TH>
              <TH>Должность</TH>
              <TH>Роль в системе</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="text-sm font-medium">{u.name}</TD>
                <TD className="font-mono text-xs text-slate-600">{u.email}</TD>
                <TD className="text-xs text-slate-600">{u.position ?? "—"}</TD>
                <TD>
                  <Select
                    className="h-7 w-56 text-xs"
                    value={u.role}
                    disabled={busy}
                    onChange={async (e) => {
                      setBusy(true);
                      setError(null);
                      const res = await updateUserRole(u.id, e.target.value);
                      setBusy(false);
                      if (!res.ok) setError(res.error);
                      else router.refresh();
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ru.roles[r as Role]}</option>
                    ))}
                  </Select>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function BodiesPanel({
  bodies,
}: {
  bodies: Array<{ id: string; name: string; kind: string; count: number }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("COMMITTEE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const KIND_RU: Record<string, string> = {
    BOARD: "Совет директоров",
    COMMITTEE: "Комитет",
    MANAGEMENT: "Правление",
    EXECUTIVE: "Единоличный исполнительный орган",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Справочник органов принятия решений</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <THead>
            <TR>
              <TH>Наименование</TH>
              <TH>Тип органа</TH>
              <TH>Решений в компетенции</TH>
            </TR>
          </THead>
          <TBody>
            {bodies.map((b) => (
              <TR key={b.id}>
                <TD className="text-sm">{b.name}</TD>
                <TD className="text-xs">{KIND_RU[b.kind] ?? b.kind}</TD>
                <TD className="text-xs tabular-nums">{b.count}</TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div className="min-w-64 flex-1">
            <Label htmlFor="body-name">Новый орган</Label>
            <Input id="body-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Комитет по стратегии" />
          </div>
          <div className="w-56">
            <Label htmlFor="body-kind">Тип</Label>
            <Select id="body-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(KIND_RU).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <Button
            disabled={busy || name.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await createDecisionBody(name, kind);
              setBusy(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setName("");
              router.refresh();
            }}
          >
            {ru.common.add}
          </Button>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function GatesPanel({
  gates,
}: {
  gates: Array<{
    id: string;
    fromStage: string;
    toStage: string;
    criticality: string;
    rule: string;
    isBlocking: boolean;
  }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRule, setNewRule] = useState<string>(GATE_RULE_CODES[0]);
  const [newFrom, setNewFrom] = useState<string>("PROBLEM");
  const [newCrit, setNewCrit] = useState<string>("A");

  const nextStageOf = (s: string): string => {
    const i = STAGES.indexOf(s as Stage);
    return STAGES[i + 1] ?? s;
  };

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Ошибка");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Правила контрольных ворот</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-600">
          Правило применяется к переходу между соседними стадиями для конкретного уровня
          критичности. Блокирующее правило не пропускает переход; неблокирующее показывается в
          чек-листе как предупреждение.
        </p>

        <Table>
          <THead>
            <TR>
              <TH>Переход</TH>
              <TH>Уровень</TH>
              <TH>Правило</TH>
              <TH>Блокирует</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {gates.map((g) => (
              <TR key={g.id}>
                <TD className="whitespace-nowrap text-xs">
                  {ru.stages[g.fromStage as Stage]} → {ru.stages[g.toStage as Stage]}
                </TD>
                <TD><CriticalityBadge level={g.criticality} /></TD>
                <TD className="max-w-96 text-xs">
                  {ruleDescription(g.rule)}
                  <span className="ml-1 font-mono text-[10px] text-slate-400">{g.rule}</span>
                </TD>
                <TD>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={g.isBlocking}
                      disabled={busy}
                      onChange={(e) => run(() => setGateBlocking(g.id, e.target.checked))}
                    />
                    {g.isBlocking ? <Badge variant="warn">блокирует</Badge> : <Badge variant="neutral">предупреждение</Badge>}
                  </label>
                </TD>
                <TD>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => run(() => deleteGateCheck(g.id))}
                    aria-label="Удалить правило"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div className="w-52">
            <Label htmlFor="g-from">Стадия «из»</Label>
            <Select id="g-from" value={newFrom} onChange={(e) => setNewFrom(e.target.value)}>
              {STAGES.slice(0, -1).map((s) => (
                <option key={s} value={s}>{ru.stages[s]}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Label htmlFor="g-to">Стадия «в»</Label>
            <Input id="g-to" value={ru.stages[nextStageOf(newFrom) as Stage]} disabled />
          </div>
          <div className="w-32">
            <Label htmlFor="g-crit">Уровень</Label>
            <Select id="g-crit" value={newCrit} onChange={(e) => setNewCrit(e.target.value)}>
              {CRITICALITIES.map((c) => (
                <option key={c} value={c}>{ru.criticalityShort[c as Criticality]}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-72 flex-1">
            <Label htmlFor="g-rule">Правило</Label>
            <Select id="g-rule" value={newRule} onChange={(e) => setNewRule(e.target.value)}>
              {GATE_RULE_CODES.map((r) => (
                <option key={r} value={r}>{ruleDescription(r as GateRuleCode)}</option>
              ))}
            </Select>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              run(() =>
                createGateCheck({
                  fromStage: newFrom,
                  toStage: nextStageOf(newFrom),
                  criticality: newCrit,
                  rule: newRule,
                })
              )
            }
          >
            Добавить правило
          </Button>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}
