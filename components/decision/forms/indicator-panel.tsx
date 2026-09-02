"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Database, Link2, UserRound } from "lucide-react";
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
  canConfirm: boolean;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [critical, setCritical] = useState("true");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const criticalIndicators = linked.filter((indicator) => indicator.isCritical);
  const completeLineage = criticalIndicators.filter(
    (indicator) => indicator.sourceSystem && indicator.ownerId
  ).length;
  const confirmed = criticalIndicators.filter((indicator) => indicator.confirmedBy).length;
  const evidenceGaps = criticalIndicators.filter(
    (indicator) => !indicator.sourceSystem || !indicator.ownerId || !indicator.confirmedBy
  ).length;

  async function doLink() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const result = await linkIndicator(decisionId, selected, critical === "true");
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelected("");
    router.refresh();
  }

  async function doConfirm(linkId: string) {
    setBusy(true);
    setError(null);
    const result = await confirmIndicatorQuality(linkId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-4 xl:flex-row xl:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow">Evidence index · data</p>
          <h2 className="mt-1 text-decision font-semibold tracking-[-0.02em] text-text">
            Показатели и источники
          </h2>
          <p className="mt-2 text-base text-muted">
            Критический показатель готов к gate только когда прослеживается источник, назначен
            владелец и качество подтверждено уполномоченным владельцем данных.
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line border-y border-line py-2 text-center">
          <div className="px-3 sm:px-4">
            <dt className="text-meta text-muted">Критических</dt>
            <dd className="font-technical text-lead font-semibold text-text">
              {criticalIndicators.length}
            </dd>
          </div>
          <div className="px-3 sm:px-4">
            <dt className="text-meta text-muted">С lineage</dt>
            <dd className="font-technical text-lead font-semibold text-accent">{completeLineage}</dd>
          </div>
          <div className="px-3 sm:px-4">
            <dt className="text-meta text-muted">Подтверждено</dt>
            <dd className="font-technical text-lead font-semibold text-success">{confirmed}</dd>
          </div>
        </dl>
      </header>

      {evidenceGaps > 0 && (
        <div className="flex items-start gap-3 border-l-2 border-action bg-action-soft px-4 py-3 text-table text-action">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Evidence gaps: {evidenceGaps}.</span> Для критических
            показателей требуется источник, владелец и подтверждение качества.
          </p>
        </div>
      )}

      <section className="overflow-hidden border-y border-line bg-surface" aria-label="Индекс показателей решения">
        <Table className="min-w-[980px]">
          <THead>
            <TR>
              <TH scope="col" className="w-[27%]">Показатель</TH>
              <TH scope="col">Источник</TH>
              <TH scope="col">Владелец данных</TH>
              <TH scope="col">Последнее значение</TH>
              <TH scope="col" className="w-[24%]">Контроль качества</TH>
            </TR>
          </THead>
          <TBody>
            {linked.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-base text-muted">
                  Показатели не привязаны. Доказательная база решения пуста.
                </TD>
              </TR>
            )}
            {linked.map((indicator) => (
              <TR key={indicator.linkId}>
                <TD>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/indicators/${indicator.indicatorId}`}
                        className="font-technical text-table font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {indicator.code}
                      </Link>
                      <p className="mt-1 text-base font-semibold text-text">{indicator.name}</p>
                    </div>
                    <Badge variant={indicator.isCritical ? "action" : "neutral"}>
                      {indicator.isCritical ? "Критический" : "Справочный"}
                    </Badge>
                  </div>
                </TD>
                <TD>
                  {indicator.sourceSystem ? (
                    <span className="inline-flex items-center gap-2 text-table text-text">
                      <Database className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                      {ru.sourceSystems[indicator.sourceSystem as SourceSystem]}
                    </span>
                  ) : (
                    <span className="text-table font-semibold text-action">Не указан</span>
                  )}
                </TD>
                <TD>
                  {indicator.ownerName ? (
                    <span className="inline-flex items-center gap-2 text-table text-text">
                      <UserRound className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                      {indicator.ownerName}
                    </span>
                  ) : (
                    <span className="text-table font-semibold text-action">Не назначен</span>
                  )}
                </TD>
                <TD>
                  {indicator.latestValue !== null ? (
                    <Provenance
                      value={`${indicator.latestValue.toLocaleString("ru-RU")} ${indicator.unit}`}
                      nature="fact"
                      source={
                        indicator.sourceSystem
                          ? ru.sourceSystems[indicator.sourceSystem as SourceSystem]
                          : undefined
                      }
                      asOf={indicator.latestAsOf ?? undefined}
                      owner={indicator.ownerName ?? undefined}
                      formula={indicator.formula ?? undefined}
                      note={
                        indicator.latestLoadType
                          ? `Способ загрузки: ${
                              indicator.latestLoadType === "AUTO"
                                ? ru.loadTypes.AUTO
                                : ru.loadTypes.MANUAL
                            }`
                          : undefined
                      }
                    />
                  ) : (
                    <span className="text-table text-muted">Нет значений</span>
                  )}
                </TD>
                <TD>
                  {indicator.confirmedBy ? (
                    <div className="flex items-start gap-2 text-table text-success">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-semibold">Подтверждено: {indicator.confirmedBy}</p>
                        {indicator.confirmedAt && (
                          <p className="mt-0.5 font-technical text-meta text-muted">
                            {format(new Date(indicator.confirmedAt), "d MMM yyyy, HH:mm", {
                              locale: ruLocale,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : canConfirm && (isAdmin || indicator.ownerId === currentUserId) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => doConfirm(indicator.linkId)}
                    >
                      Подтвердить качество
                    </Button>
                  ) : (
                    <span className="text-table font-semibold text-action">
                      Ожидает подтверждения владельца
                    </span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>

      {error && (
        <p className="rounded-control border border-action bg-action-soft px-3 py-2 text-table text-action" role="alert">
          {error}
        </p>
      )}

      {canLink && available.length > 0 && (
        <section className="surface-band p-5" aria-labelledby="link-indicator-heading">
          <div className="flex items-start gap-3 border-b border-line pb-4">
            <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="eyebrow">Catalog link</p>
              <h3 id="link-indicator-heading" className="mt-1 text-section font-semibold text-text">
                Привязать показатель из каталога
              </h3>
              <p className="mt-1 text-table text-muted">
                Связь добавляет показатель в evidence dossier; критическая роль включает его в gate
                готовности данных.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(260px,1fr)_220px_auto] md:items-end">
            <div>
              <Label htmlFor="ind-select">Показатель</Label>
              <Select
                id="ind-select"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">— выберите —</option>
                {available.map((indicator) => (
                  <option key={indicator.id} value={indicator.id}>
                    {indicator.code} — {indicator.name}
                    {indicator.isCritical ? " (критический)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ind-crit">Роль в решении</Label>
              <Select
                id="ind-crit"
                value={critical}
                onChange={(event) => setCritical(event.target.value)}
              >
                <option value="true">Критический</option>
                <option value="false">Справочный</option>
              </Select>
            </div>
            <Button onClick={doLink} disabled={busy || !selected}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {busy ? "Добавление…" : ru.common.add}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
