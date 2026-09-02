"use client";

// Блок «Данные и источники»: привязка показателей каталога и подтверждение
// качества владельцем данных.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Provenance } from "@/components/provenance";
import { linkIndicator, confirmIndicatorQuality } from "@/app/actions/evidence";
import { ru } from "@/lib/i18n/ru";
import type { SourceSystem } from "@/lib/domain";

export interface LinkedIndicator {
  linkId: string;
  indicatorId: string;
  code: string;
  name: string;
  unit: string;
  formula: string | null;
  sourceSystem: string;
  ownerName: string | null;
  ownerId: string | null;
  isCritical: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  latestValue: number | null;
  latestAsOf: string | null;
  latestLoadType: string | null;
}

export function IndicatorPanel({
  decisionId,
  linked,
  available,
  canLink,
  canConfirm,
  isAdmin,
  currentUserId,
}: {
  decisionId: string;
  linked: LinkedIndicator[];
  available: Array<{ id: string; code: string; name: string; isCritical: boolean }>;
  canLink: boolean;
  /** Роль в принципе вправе подтверждать качество данных */
  canConfirm: boolean;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [critical, setCritical] = useState("true");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doLink() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await linkIndicator(decisionId, selected, critical === "true");
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSelected("");
    router.refresh();
  }

  async function doConfirm(linkId: string) {
    setBusy(true);
    setError(null);
    const res = await confirmIndicatorQuality(linkId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Table>
        <THead>
          <TR>
            <TH>Показатель</TH>
            <TH>Источник</TH>
            <TH>Владелец</TH>
            <TH>Последнее значение</TH>
            <TH>Качество данных</TH>
          </TR>
        </THead>
        <TBody>
          {linked.length === 0 && (
            <TR>
              <TD colSpan={5} className="py-4 text-center text-sm text-slate-500">
                Показатели не привязаны. Доказательная база решения пуста.
              </TD>
            </TR>
          )}
          {linked.map((i) => (
            <TR key={i.linkId}>
              <TD>
                <Link href={`/indicators/${i.indicatorId}`} className="font-medium text-brand-accent hover:underline">
                  {i.code}
                </Link>
                <div className="text-xs text-slate-600">{i.name}</div>
                {i.isCritical && (
                  <Badge variant="warn" className="mt-0.5">
                    критический
                  </Badge>
                )}
              </TD>
              <TD className="text-xs">
                {i.sourceSystem ? (
                  ru.sourceSystems[i.sourceSystem as SourceSystem]
                ) : (
                  <span className="text-brand-warn">не указан</span>
                )}
              </TD>
              <TD className="text-xs">
                {i.ownerName ?? <span className="text-brand-warn">не назначен</span>}
              </TD>
              <TD>
                {i.latestValue !== null ? (
                  <Provenance
                    value={`${i.latestValue.toLocaleString("ru-RU")} ${i.unit}`}
                    nature="fact"
                    source={i.sourceSystem ? ru.sourceSystems[i.sourceSystem as SourceSystem] : undefined}
                    asOf={i.latestAsOf ?? undefined}
                    owner={i.ownerName ?? undefined}
                    formula={i.formula ?? undefined}
                    note={
                      i.latestLoadType
                        ? `Способ загрузки: ${i.latestLoadType === "AUTO" ? ru.loadTypes.AUTO : ru.loadTypes.MANUAL}`
                        : undefined
                    }
                  />
                ) : (
                  <span className="text-xs text-slate-400">нет значений</span>
                )}
              </TD>
              <TD>
                {i.confirmedBy ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Подтверждено: {i.confirmedBy}
                  </span>
                ) : canConfirm && (isAdmin || i.ownerId === currentUserId) ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => doConfirm(i.linkId)}>
                    Подтвердить качество
                  </Button>
                ) : (
                  <span className="text-xs text-brand-warn">
                    Ожидает подтверждения владельца
                  </span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {error && <p className="text-xs text-red-700">{error}</p>}

      {canLink && available.length > 0 && (
        <div className="rounded border border-slate-200 bg-brand-card/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-brand">
            <Link2 className="h-4 w-4" />
            Привязать показатель из каталога
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <Label htmlFor="ind-select">Показатель</Label>
              <Select id="ind-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">— выберите —</option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                    {a.isCritical ? " (критический)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="ind-crit">Роль в решении</Label>
              <Select id="ind-crit" value={critical} onChange={(e) => setCritical(e.target.value)}>
                <option value="true">Критический</option>
                <option value="false">Справочный</option>
              </Select>
            </div>
            <Button onClick={doLink} disabled={busy || !selected}>
              {ru.common.add}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
