"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Plus, ShieldAlert, Trash2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CriticalityBadge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  updateUserRole,
  createDecisionBody,
  setGateBlocking,
  createGateCheck,
  deleteGateCheck,
} from "@/app/actions/admin";
import {
  ROLES,
  CRITICALITIES,
  STAGES,
  type Criticality,
  type Role,
  type Stage,
} from "@/lib/domain";
import { GATE_RULE_CODES, ruleDescription, type GateRuleCode } from "@/lib/gates";
import { ru } from "@/lib/i18n/ru";

const ROLE_SCOPE: Record<Role, string> = {
  INITIATOR: "Создание паспорта и подготовка evidence dossier",
  DATA_OWNER: "Подтверждение качества и происхождения данных",
  RISK_OFFICER: "Риск-профиль, controls и residual risk",
  ANALYST: "Расчёты, альтернативы и аналитические заключения",
  SECRETARY: "Маршрутизация, поручения и корпоративные процедуры",
  BOARD_MEMBER: "Финальный выбор и управленческий authority",
  ADMIN: "Глобальные роли, справочники и gate policy",
};

const BODY_KIND_LABELS: Record<string, string> = {
  BOARD: "Совет директоров",
  COMMITTEE: "Комитет",
  MANAGEMENT: "Правление",
  EXECUTIVE: "Единоличный исполнительный орган",
};

type GateView = {
  id: string;
  fromStage: string;
  toStage: string;
  criticality: string;
  rule: string;
  isBlocking: boolean;
};

function PanelHeader({
  eyebrow,
  title,
  description,
  count,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count: string;
  icon: React.ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 border-b border-line pb-4 lg:flex-row lg:items-end">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-accent">
          {icon}
          <p className="eyebrow !text-accent">{eyebrow}</p>
        </div>
        <h2 className="mt-1 text-decision font-semibold tracking-[-0.02em] text-text">{title}</h2>
        <p className="mt-2 text-base text-muted">{description}</p>
      </div>
      <p className="font-technical text-meta text-muted">{count}</p>
    </header>
  );
}

function ActionError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      className="mt-3 rounded-control border border-action bg-action-soft px-3 py-2 text-table text-action"
      role="alert"
    >
      {error}
    </p>
  );
}

export function UsersPanel({
  users,
}: {
  users: Array<{ id: string; name: string; email: string; role: string; position: string | null }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section id="admin-users" className="scroll-mt-24 space-y-4" aria-labelledby="admin-users-heading">
      <PanelHeader
        eyebrow="Identity & authority"
        title="Пользователи и роли"
        description="Роль определяет доступные действия во всём lifecycle. Изменение вступает в силу для следующего авторизованного запроса пользователя."
        count={`${users.length} учётных записей`}
        icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="overflow-hidden border-y border-line bg-surface">
        <ActionError error={error} />
        <Table className="min-w-[820px]">
          <THead>
            <TR>
              <TH scope="col">Пользователь</TH>
              <TH scope="col">Контакт</TH>
              <TH scope="col">Должность</TH>
              <TH scope="col" className="w-[360px]">Authority в системе</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((user) => {
              const currentRole = user.role as Role;
              return (
                <TR key={user.id}>
                  <TD>
                    <p className="text-base font-semibold text-text">{user.name}</p>
                    <p className="mt-0.5 font-technical text-meta text-muted">ID · {user.id}</p>
                  </TD>
                  <TD className="font-technical text-table text-muted">{user.email}</TD>
                  <TD className="text-table text-muted">{user.position ?? "Не указана"}</TD>
                  <TD>
                    <Select
                      className="w-full max-w-[300px]"
                      value={user.role}
                      disabled={busy}
                      aria-label={`Роль пользователя ${user.name}`}
                      onChange={async (event) => {
                        setBusy(true);
                        setError(null);
                        const result = await updateUserRole(user.id, event.target.value);
                        setBusy(false);
                        if (!result.ok) setError(result.error);
                        else router.refresh();
                      }}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ru.roles[role]}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1.5 text-meta text-muted">
                      {ROLE_SCOPE[currentRole] ?? "Область полномочий не определена"}
                    </p>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      <p className="flex items-start gap-2 text-meta text-muted">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-action" aria-hidden="true" />
        Смена роли меняет authority пользователя. Старое и новое значение фиксируются в журнале
        аудита.
      </p>
    </section>
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

  return (
    <section id="admin-bodies" className="scroll-mt-24 space-y-4" aria-labelledby="admin-bodies-heading">
      <PanelHeader
        eyebrow="Decision authority"
        title="Органы принятия решений"
        description="Справочник задаёт, какой орган может быть указан в компетенции паспорта. Создание записи не переносит существующие решения автоматически."
        count={`${bodies.length} органов`}
        icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden border-y border-line bg-surface">
          <Table className="min-w-[620px]">
            <THead>
              <TR>
                <TH scope="col">Орган</TH>
                <TH scope="col">Тип authority</TH>
                <TH scope="col" className="text-right">Паспортов в компетенции</TH>
              </TR>
            </THead>
            <TBody>
              {bodies.map((body) => (
                <TR key={body.id}>
                  <TD>
                    <p className="text-base font-semibold text-text">{body.name}</p>
                    <p className="mt-0.5 font-technical text-meta text-muted">ID · {body.id}</p>
                  </TD>
                  <TD className="text-table text-muted">
                    {BODY_KIND_LABELS[body.kind] ?? body.kind}
                  </TD>
                  <TD className="text-right font-technical text-table font-semibold tabular-nums text-text">
                    {body.count}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        <aside className="surface-band p-5" aria-labelledby="new-body-heading">
          <p className="eyebrow">Directory change</p>
          <h3 id="new-body-heading" className="mt-1 text-section font-semibold text-text">
            Новый орган
          </h3>
          <p className="mt-1 text-table text-muted">
            Запись станет доступна инициаторам при назначении decision authority.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="body-name">Наименование</Label>
              <Input
                id="body-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например: Комитет по стратегии"
              />
            </div>
            <div>
              <Label htmlFor="body-kind">Тип органа</Label>
              <Select id="body-kind" value={kind} onChange={(event) => setKind(event.target.value)}>
                {Object.entries(BODY_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={busy || name.trim().length < 3}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await createDecisionBody(name, kind);
                setBusy(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setName("");
                router.refresh();
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {busy ? "Добавление…" : ru.common.add}
            </Button>
            <ActionError error={error} />
          </div>
          <p className="mt-5 border-t border-line pt-3 text-meta text-muted">
            Создание справочной записи фиксируется в аудите. Удаление органов в этой консоли не
            предусмотрено.
          </p>
        </aside>
      </div>
    </section>
  );
}

function GatePolicyCell({
  gate,
  busy,
  onRun,
}: {
  gate: GateView | undefined;
  busy: boolean;
  onRun: (action: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  if (!gate) {
    return <span className="text-meta text-muted">Не применяется</span>;
  }

  return (
    <div className="flex min-w-[150px] items-center justify-between gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-table">
        <input
          type="checkbox"
          checked={gate.isBlocking}
          disabled={busy}
          onChange={(event) => onRun(() => setGateBlocking(gate.id, event.target.checked))}
          className="h-4 w-4 accent-accent"
        />
        <span className={gate.isBlocking ? "font-semibold text-action" : "text-muted"}>
          {gate.isBlocking ? "Блокирует" : "Предупреждает"}
        </span>
      </label>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 px-0"
        disabled={busy}
        onClick={() => onRun(() => deleteGateCheck(gate.id))}
        aria-label={`Удалить правило для уровня ${gate.criticality}`}
        title="Удалить правило"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function GatesPanel({ gates }: { gates: GateView[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRule, setNewRule] = useState<string>(GATE_RULE_CODES[0]);
  const [newFrom, setNewFrom] = useState<string>("PROBLEM");
  const [newCrit, setNewCrit] = useState<string>("A");

  const nextStageOf = (stage: string): string => {
    const index = STAGES.indexOf(stage as Stage);
    return STAGES[index + 1] ?? stage;
  };

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Ошибка");
      return;
    }
    router.refresh();
  }

  const transitionGroups = STAGES.slice(0, -1)
    .map((fromStage) => {
      const toStage = nextStageOf(fromStage);
      const transitionGates = gates.filter(
        (gate) => gate.fromStage === fromStage && gate.toStage === toStage
      );
      const rules = Array.from(new Set(transitionGates.map((gate) => gate.rule)));
      return { fromStage, toStage, transitionGates, rules };
    })
    .filter((group) => group.rules.length > 0);

  return (
    <section id="admin-gates" className="scroll-mt-24 space-y-4" aria-labelledby="admin-gates-heading">
      <PanelHeader
        eyebrow="Lifecycle control"
        title="Матрица контрольных ворот"
        description="Gate проверяет готовность доказательств перед переходом. Блокирующая проверка останавливает переход; предупреждение остаётся видимым, но не отнимает authority у человека."
        count={`${gates.length} правил · ${transitionGroups.length} переходов`}
        icon={<ShieldAlert className="h-4 w-4 text-action" aria-hidden="true" />}
      />

      <div className="border-l-2 border-action bg-action-soft px-4 py-3">
        <p className="text-table font-semibold text-action">Изменение применяется ко всем паспортам соответствующей критичности.</p>
        <p className="mt-1 text-meta text-muted">
          Удаление правила ослабляет gate policy. Переключение режима и удаление фиксируются в
          журнале аудита.
        </p>
      </div>
      <ActionError error={error} />

      {transitionGroups.length === 0 ? (
        <div className="surface-band p-6 text-base text-muted">Gate policy пока не содержит правил.</div>
      ) : (
        <div className="space-y-4">
          {transitionGroups.map((group, groupIndex) => (
            <section key={`${group.fromStage}-${group.toStage}`} className="overflow-hidden border-y border-line bg-surface">
              <header className="flex flex-col justify-between gap-2 border-b border-line bg-surface-raised px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="font-technical text-meta font-semibold text-muted">
                    {String(groupIndex + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-base font-semibold text-text">
                    {ru.stages[group.fromStage as Stage]}
                    <ArrowRight className="mx-2 inline h-4 w-4 text-muted" aria-hidden="true" />
                    {ru.stages[group.toStage as Stage]}
                  </h3>
                </div>
                <p className="font-technical text-meta text-muted">
                  {group.transitionGates.length} конфигураций
                </p>
              </header>

              <Table className="min-w-[880px] table-fixed">
                <THead>
                  <TR>
                    <TH scope="col" className="w-[40%]">Требование gate</TH>
                    {CRITICALITIES.map((criticality) => (
                      <TH key={criticality} scope="col" className="w-[20%]">
                        <span className="flex items-center gap-2">
                          <CriticalityBadge level={criticality} />
                          {ru.criticality[criticality]}
                        </span>
                      </TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {group.rules.map((rule) => (
                    <TR key={rule}>
                      <TH scope="row" className="px-3 py-3 text-left align-top font-normal">
                        <p className="text-table font-semibold text-text">{ruleDescription(rule)}</p>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-meta text-muted">Технический код</summary>
                          <code className="mt-1 block break-all font-technical text-meta text-muted">
                            {rule}
                          </code>
                        </details>
                      </TH>
                      {CRITICALITIES.map((criticality) => {
                        const gate = group.transitionGates.find(
                          (item) => item.rule === rule && item.criticality === criticality
                        );
                        return (
                          <TD key={criticality}>
                            <GatePolicyCell gate={gate} busy={busy} onRun={run} />
                          </TD>
                        );
                      })}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ))}
        </div>
      )}

      <section className="surface-band p-5" aria-labelledby="new-gate-heading">
        <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Policy change</p>
            <h3 id="new-gate-heading" className="mt-1 text-section font-semibold text-text">
              Добавить правило в матрицу
            </h3>
          </div>
          <p className="max-w-xl text-table text-muted">
            Новое правило создаётся блокирующим. После создания его можно перевести в режим
            предупреждения в соответствующей ячейке матрицы.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_150px_minmax(300px,1fr)_auto] xl:items-end">
          <div>
            <Label htmlFor="g-from">Переход из стадии</Label>
            <Select id="g-from" value={newFrom} onChange={(event) => setNewFrom(event.target.value)}>
              {STAGES.slice(0, -1).map((stage) => (
                <option key={stage} value={stage}>
                  {ru.stages[stage]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="g-to">В следующую стадию</Label>
            <Input id="g-to" value={ru.stages[nextStageOf(newFrom) as Stage]} disabled />
          </div>
          <div>
            <Label htmlFor="g-crit">Критичность</Label>
            <Select id="g-crit" value={newCrit} onChange={(event) => setNewCrit(event.target.value)}>
              {CRITICALITIES.map((criticality) => (
                <option key={criticality} value={criticality}>
                  Уровень {ru.criticalityShort[criticality as Criticality]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="g-rule">Проверяемое требование</Label>
            <Select id="g-rule" value={newRule} onChange={(event) => setNewRule(event.target.value)}>
              {GATE_RULE_CODES.map((rule) => (
                <option key={rule} value={rule}>
                  {ruleDescription(rule as GateRuleCode)}
                </option>
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
            <Plus className="h-4 w-4" aria-hidden="true" />
            {busy ? "Сохранение…" : "Добавить правило"}
          </Button>
        </div>
      </section>
    </section>
  );
}
