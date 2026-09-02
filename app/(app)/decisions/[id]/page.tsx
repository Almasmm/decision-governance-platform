// Паспорт управленческого решения — центральный экран системы.
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { decisionInclude, computePassportCompleteness, type DecisionFull } from "@/lib/snapshot";
import { buildGateContext } from "@/lib/gate-service";
import { ruleDescription } from "@/lib/gates";
import { getAiProvider } from "@/lib/ai/provider";
import { checkTierEligibility } from "@/lib/ai/eligibility";
import { BLOCK_KINDS, parseJson, type BlockKind, type Criticality } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { cn, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PassportHeader } from "@/components/decision/passport-header";
import { PassportTabs, PASSPORT_TABS } from "@/components/decision/passport-tabs";
import { GateChecklist } from "@/components/decision/gate-checklist";
import { AdvanceButton } from "@/components/decision/advance-button";
import { WorkflowActions } from "@/components/decision/workflow-actions";
import { BlockTextForm } from "@/components/decision/forms/block-text-form";
import { IndicatorPanel } from "@/components/decision/forms/indicator-panel";
import { AlternativesPanel } from "@/components/decision/alternatives-panel";
import { RisksPanel } from "@/components/decision/risks-panel";
import { AssumptionsPanel } from "@/components/decision/assumptions-panel";
import { EconomicsPanel } from "@/components/decision/economics-panel";
import { AssignmentsPanel } from "@/components/decision/assignments-panel";
import { AiPanel } from "@/components/decision/ai-panel";
import { PostEvaluationPanel } from "@/components/decision/post-evaluation-panel";

export const dynamic = "force-dynamic";

export default async function DecisionPassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; block?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const decision = await prisma.decision.findUnique({ where: { id }, include: decisionInclude });
  if (!decision) notFound();

  const tab = PASSPORT_TABS.some((t) => t.key === sp.tab) ? sp.tab! : "passport";
  const activeBlock: BlockKind = BLOCK_KINDS.includes(sp.block as BlockKind)
    ? (sp.block as BlockKind)
    : "IDENTIFICATION";

  const gate = await buildGateContext(decision);
  const completeness = computePassportCompleteness(decision);
  const failedRules = gate.evaluation?.results.filter((r) => !r.passed) ?? [];
  const missingForNextStage = failedRules.map((r) => ruleDescription(r.code));

  const criticality = decision.criticality as Criticality;
  const perms = {
    editBlocks: can(user.role, "decision.editBlocks"),
    advance: can(user.role, "decision.advance"),
    submit: can(user.role, "decision.submit"),
    return: can(user.role, "decision.return"),
    decide: can(user.role, "decision.decide"),
    link: can(user.role, "indicator.link"),
    confirm: can(user.role, "indicator.confirmQuality"),
    risk: can(user.role, "risk.edit"),
    assumption: can(user.role, "assumption.edit"),
    alternative: can(user.role, "alternative.edit"),
    calc: can(user.role, "calc.create"),
    review: can(user.role, "calc.review"),
    assignment: can(user.role, "assignment.manage"),
    aiRun: can(user.role, "ai.run"),
    aiVerdict: can(user.role, "ai.verdict"),
    lesson: can(user.role, "lesson.create"),
  };

  return (
    <div className="space-y-4">
      <Link href="/decisions" className="text-xs text-brand-accent hover:underline">
        ← Реестр решений
      </Link>

      <PassportHeader
        decision={decision}
        completeness={completeness.percent}
        gateAllowed={gate.evaluation?.allowed ?? null}
        missingForNextStage={missingForNextStage}
      />

      <PassportTabs decisionId={decision.id} active={tab} />

      {tab === "passport" && (
        <PassportTab
          decision={decision}
          activeBlock={activeBlock}
          completeness={completeness}
          gate={gate}
          perms={perms}
          user={user}
          criticality={criticality}
        />
      )}

      {tab === "alternatives" && (
        <AlternativesPanel
          decisionId={decision.id}
          alternatives={decision.alternatives.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            isStatusQuo: a.isStatusQuo,
            selected: a.selected,
            scores: parseJson<Record<string, number>>(a.criteriaScores, {}),
          }))}
          canEdit={perms.alternative}
          canDecide={perms.decide}
          stageIsDecision={decision.stage === "DECISION"}
          decidedMotivation={decision.motivation}
        />
      )}

      {tab === "risks" && (
        <div className="space-y-4">
          <RisksPanel
            decisionId={decision.id}
            risks={decision.risks.map((r) => ({
              id: r.id,
              name: r.name,
              probability: r.probability,
              impact: r.impact,
              mitigation: r.mitigation,
              residualProbability: r.residualProbability,
              residualImpact: r.residualImpact,
              ownerName: r.owner?.name ?? null,
              triggers: r.triggers,
            }))}
            canEdit={perms.risk}
          />
          <AssumptionsPanel
            decisionId={decision.id}
            assumptions={decision.assumptions.map((a) => ({
              id: a.id,
              text: a.text,
              value: a.value,
              confidence: a.confidence,
              validUntil: a.validUntil.toISOString(),
              ownerName: a.owner?.name ?? null,
            }))}
            canEdit={perms.assumption}
            requiredForLevel={criticality === "A"}
          />
        </div>
      )}

      {tab === "economics" && (
        <EconomicsPanel
          decisionId={decision.id}
          calculations={decision.calculations.map((c) => ({
            id: c.id,
            kind: c.kind,
            inputs: parseJson<Record<string, unknown>>(c.inputs, {}),
            result: c.result,
            calculatedAt: c.calculatedAt.toISOString(),
            calculatedByName: c.calculatedBy.name,
            calculatedById: c.calculatedById,
            attributionNote: c.attributionNote,
            reviews: c.reviews.map((r) => ({
              id: r.id,
              reviewerName: r.reviewer.name,
              reviewerId: r.reviewerId,
              verdict: r.verdict,
              comment: r.comment,
            })),
          }))}
          canCalculate={perms.calc}
          canReview={perms.review}
          currentUserId={user.id}
        />
      )}

      {tab === "assignments" && <AssignmentsTab decisionId={decision.id} canManage={perms.assignment} />}

      {tab === "ai" && <AiTab decision={decision} canRun={perms.aiRun} canVerdict={perms.aiVerdict} />}

      {tab === "audit" && <AuditTab decisionId={decision.id} />}
    </div>
  );
}

/* ─── Вкладка «Паспорт»: 9 блоков ────────────────────────────────────────── */

async function PassportTab({
  decision,
  activeBlock,
  completeness,
  gate,
  perms,
  user,
  criticality,
}: {
  decision: DecisionFull;
  activeBlock: BlockKind;
  completeness: ReturnType<typeof computePassportCompleteness>;
  gate: Awaited<ReturnType<typeof buildGateContext>>;
  perms: Record<string, boolean>;
  user: { id: string; role: string; name: string };
  criticality: Criticality;
}) {
  const blockPayload = (kind: BlockKind): Record<string, string> => {
    const b = decision.blocks.find((x) => x.kind === kind);
    return parseJson<Record<string, string>>(b?.payload, {});
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <nav className="space-y-0.5" aria-label="Блоки паспорта">
        {completeness.blocks.map((b) => (
          <Link
            key={b.kind}
            href={`/decisions/${decision.id}?tab=passport&block=${b.kind}`}
            className={cn(
              "block rounded border px-2.5 py-2 transition-colors",
              activeBlock === b.kind
                ? "border-brand-accent bg-brand-card"
                : "border-transparent hover:bg-slate-100"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-xs font-medium",
                  activeBlock === b.kind ? "text-brand" : "text-slate-700"
                )}
              >
                {ru.blocks[b.kind]}
              </span>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  b.required && b.completeness < 100 ? "text-brand-warn" : "text-slate-500"
                )}
              >
                {b.completeness}%
              </span>
            </div>
            <Progress className="mt-1 h-1" value={b.completeness} warnBelow={b.required ? 100 : 0} />
            {!b.required && (
              <span className="mt-0.5 block text-[10px] text-slate-400">
                не обязателен для уровня {criticality}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{ru.blocks[activeBlock]}</CardTitle>
            <Badge variant="neutral">
              полнота {completeness.blocks.find((b) => b.kind === activeBlock)?.completeness ?? 0}%
            </Badge>
          </CardHeader>
          <CardContent>
            <BlockContent
              kind={activeBlock}
              decision={decision}
              payload={blockPayload(activeBlock)}
              perms={perms}
              user={user}
            />
          </CardContent>
        </Card>

        {gate.evaluation && gate.targetStage && (
          <>
            <GateChecklist
              results={gate.evaluation.results}
              fromStage={gate.currentStage}
              toStage={gate.targetStage}
              allowed={gate.evaluation.allowed}
            />
            <div className="flex flex-wrap items-start gap-4">
              <AdvanceButton
                decisionId={decision.id}
                toStage={gate.targetStage}
                canAdvance={Boolean(perms.advance)}
              />
              <WorkflowActions
                decisionId={decision.id}
                status={decision.status}
                canSubmit={Boolean(perms.submit)}
                canReturn={Boolean(perms.return)}
              />
            </div>
          </>
        )}
        {!gate.targetStage && (
          <p className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Решение находится на последней стадии цикла — «Обратная связь».
          </p>
        )}
      </div>
    </div>
  );
}

async function BlockContent({
  kind,
  decision,
  payload,
  perms,
  user,
}: {
  kind: BlockKind;
  decision: DecisionFull;
  payload: Record<string, string>;
  perms: Record<string, boolean>;
  user: { id: string; role: string; name: string };
}) {
  switch (kind) {
    case "IDENTIFICATION":
      return (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Код паспорта</dt>
            <dd className="font-mono text-sm">{decision.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Тип решения</dt>
            <dd className="text-sm">{ru.decisionTypes[decision.type as keyof typeof ru.decisionTypes]}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Орган принятия решения</dt>
            <dd className="text-sm">{decision.decisionBody.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Инициатор</dt>
            <dd className="text-sm">{decision.initiator.name}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Цель решения</dt>
            <dd className="text-sm">{decision.goal}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Уровень критичности</dt>
            <dd className="text-sm">{ru.criticality[decision.criticality as Criticality]}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Срок</dt>
            <dd className="text-sm">
              {decision.deadline
                ? format(decision.deadline, "d MMMM yyyy", { locale: ruLocale })
                : "не задан"}
            </dd>
          </div>
        </dl>
      );

    case "DATA": {
      const linkedIds = decision.indicatorLinks.map((l) => l.indicatorId);
      const [available, values] = await Promise.all([
        prisma.indicator.findMany({
          where: { id: { notIn: linkedIds } },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true, isCritical: true },
        }),
        prisma.indicatorValue.findMany({
          where: { indicatorId: { in: linkedIds } },
          orderBy: { asOf: "desc" },
        }),
      ]);
      const confirmers = await prisma.user.findMany({
        where: { id: { in: decision.indicatorLinks.map((l) => l.confirmedById).filter((x): x is string => Boolean(x)) } },
        select: { id: true, name: true },
      });
      return (
        <IndicatorPanel
          decisionId={decision.id}
          linked={decision.indicatorLinks.map((l) => {
            const latest = values.find((v) => v.indicatorId === l.indicatorId) ?? null;
            return {
              linkId: l.id,
              indicatorId: l.indicatorId,
              code: l.indicator.code,
              name: l.indicator.name,
              unit: l.indicator.unit,
              formula: l.indicator.formula,
              sourceSystem: l.indicator.sourceSystem,
              ownerName: l.indicator.owner?.name ?? null,
              ownerId: l.indicator.ownerId,
              isCritical: l.isCritical || l.indicator.isCritical,
              confirmedBy: confirmers.find((c) => c.id === l.confirmedById)?.name ?? null,
              confirmedAt: l.confirmedAt?.toISOString() ?? null,
              latestValue: latest?.value ?? null,
              latestAsOf: latest ? format(latest.asOf, "d MMMM yyyy", { locale: ruLocale }) : null,
              latestLoadType: latest?.loadType ?? null,
            };
          })}
          available={available}
          canLink={Boolean(perms.link)}
          canConfirm={Boolean(perms.confirm)}
          isAdmin={user.role === "ADMIN"}
          currentUserId={user.id}
        />
      );
    }

    case "ALTERNATIVES":
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Вариантов в паспорте: {decision.alternatives.length}, из них «статус-кво»:{" "}
            {decision.alternatives.filter((a) => a.isStatusQuo).length}.
          </p>
          <ul className="space-y-1">
            {decision.alternatives.map((a) => (
              <li key={a.id} className="text-sm">
                • {a.name}
                {a.isStatusQuo && <Badge variant="neutral" className="ml-1">статус-кво</Badge>}
                {a.selected && <Badge variant="success" className="ml-1">выбрано</Badge>}
              </li>
            ))}
          </ul>
          <Link href={`/decisions/${decision.id}?tab=alternatives`} className="text-xs text-brand-accent hover:underline">
            Перейти к матрице сравнения альтернатив →
          </Link>
        </div>
      );

    case "ECONOMICS":
      return (
        <div className="space-y-2">
          {decision.calculations.length === 0 ? (
            <p className="text-sm text-slate-600">
              Расчёты эффекта не выполнены. {ru.common.notEnoughData}: параметры формул не введены.
            </p>
          ) : (
            <ul className="space-y-1">
              {decision.calculations.map((c) => (
                <li key={c.id} className="text-sm">
                  • {ru.effectKinds[c.kind as keyof typeof ru.effectKinds]}:{" "}
                  <span className="font-medium">{formatMoney(c.result)}</span>{" "}
                  {c.reviews.some((r) => r.verdict === "CONFIRMED" && r.reviewerId !== c.calculatedById) ? (
                    <Badge variant="success">проверен независимо</Badge>
                  ) : (
                    <Badge variant="warn">без независимой проверки</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/decisions/${decision.id}?tab=economics`} className="text-xs text-brand-accent hover:underline">
            Перейти к калькуляторам эффекта →
          </Link>
        </div>
      );

    case "SAFETY":
      return (
        <BlockTextForm
          decisionId={decision.id}
          kind="SAFETY"
          initial={payload}
          disabled={!perms.editBlocks}
          fields={[
            {
              key: "safetyNote",
              label: "Влияние на ядерную, радиационную и промышленную безопасность",
              placeholder: "Какие аспекты безопасности затрагивает решение и какие меры предусмотрены",
              required: true,
            },
            {
              key: "regulatoryNote",
              label: "Регуляторные требования и разрешительная документация",
              placeholder: "Требуются ли согласования регулятора, изменения лицензий, экспертизы",
              required: true,
            },
          ]}
        />
      );

    case "RISKS":
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Рисков в профиле: {decision.risks.length}; допущений: {decision.assumptions.length}.
          </p>
          <Link href={`/decisions/${decision.id}?tab=risks`} className="text-xs text-brand-accent hover:underline">
            Перейти к риск-профилю и допущениям →
          </Link>
        </div>
      );

    case "DECISION": {
      const selected = decision.alternatives.find((a) => a.selected);
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-xs text-slate-500">Выбранная альтернатива:</span>{" "}
            {selected ? (
              <span className="font-medium">{selected.name}</span>
            ) : (
              <span className="text-brand-warn">не выбрана</span>
            )}
          </div>
          <div>
            <span className="text-xs text-slate-500">Мотивировка:</span>{" "}
            {decision.motivation ? (
              <span>{decision.motivation}</span>
            ) : (
              <span className="text-brand-warn">не зафиксирована</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Решение принимается человеком на вкладке «Альтернативы». Система не выбирает вариант
            и не утверждает решение автоматически.
          </p>
        </div>
      );
    }

    case "EXECUTION":
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Поручений: {decision.assignments.length}; связано с KPI:{" "}
            {decision.assignments.filter((a) => a.linkedKpiId).length}.
          </p>
          <Link href={`/decisions/${decision.id}?tab=assignments`} className="text-xs text-brand-accent hover:underline">
            Перейти к поручениям →
          </Link>
        </div>
      );

    case "POST_EVALUATION":
      return (
        <div className="space-y-4">
          <BlockTextForm
            decisionId={decision.id}
            kind="POST_EVALUATION"
            initial={payload}
            disabled={!perms.editBlocks}
            fields={[
              {
                key: "planFact",
                label: "Сопоставление плана и факта",
                placeholder: "Что планировалось достичь и что достигнуто фактически, с указанием периода",
                required: true,
              },
            ]}
          />
          <PostEvaluationPanel
            decisionId={decision.id}
            lessons={decision.lessons.map((l) => ({
              id: l.id,
              whatPlanned: l.whatPlanned,
              whatHappened: l.whatHappened,
              causeCategory: l.causeCategory,
              conclusion: l.conclusion,
            }))}
            canEdit={Boolean(perms.lesson)}
            canClose={Boolean(perms.advance)}
            stageIsFeedback={decision.stage === "FEEDBACK"}
            isClosed={decision.status === "CLOSED"}
          />
        </div>
      );
  }
}

/* ─── Вкладка «Поручения» ─────────────────────────────────────────────────── */

async function AssignmentsTab({ decisionId, canManage }: { decisionId: string; canManage: boolean }) {
  const [assignments, users, indicators] = await Promise.all([
    prisma.assignment.findMany({
      where: { decisionId },
      include: { assignee: true, linkedKpi: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.indicator.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  return (
    <AssignmentsPanel
      decisionId={decisionId}
      assignments={assignments.map((a) => ({
        id: a.id,
        text: a.text,
        assigneeName: a.assignee.name,
        dueDate: a.dueDate.toISOString(),
        status: a.status,
        completedAt: a.completedAt?.toISOString() ?? null,
        kpiCode: a.linkedKpi?.code ?? null,
        kpiName: a.linkedKpi?.name ?? null,
      }))}
      users={users}
      indicators={indicators}
      canManage={canManage}
    />
  );
}

/* ─── Вкладка «ИИ-помощник» ───────────────────────────────────────────────── */

async function AiTab({
  decision,
  canRun,
  canVerdict,
}: {
  decision: DecisionFull;
  canRun: boolean;
  canVerdict: boolean;
}) {
  const models = await prisma.aiModel.findMany();
  const eligibility = checkTierEligibility({
    criticality: decision.criticality as Criticality,
    indicators: decision.indicatorLinks.map((l) => ({
      code: l.indicator.code,
      ownerId: l.indicator.ownerId,
      sourceSystem: l.indicator.sourceSystem,
    })),
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      validatedAt: m.validatedAt,
      allowedForLevels: m.allowedForLevels,
    })),
  });

  return (
    <AiPanel
      decisionId={decision.id}
      criticality={decision.criticality}
      eligibility={eligibility.map((e) => ({ tier: e.tier, allowed: e.allowed, reason: e.reason }))}
      suggestions={decision.suggestions
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((s) => ({
          id: s.id,
          tier: s.tier,
          modelName: s.model?.name ?? null,
          content: s.content,
          explanation: s.explanation,
          sourceRefs: parseJson<Array<{ ref: string; note: string }>>(s.sourceRefs, []),
          humanVerdict: s.humanVerdict,
          verdictReason: s.verdictReason,
          verifiedByName: s.verifiedBy?.name ?? null,
          createdAt: s.createdAt.toISOString(),
        }))}
      canRun={canRun}
      canVerdict={canVerdict}
      providerName={getAiProvider().name}
    />
  );
}

/* ─── Вкладка «Аудит» ─────────────────────────────────────────────────────── */

async function AuditTab({ decisionId }: { decisionId: string }) {
  const related = await prisma.$transaction([
    prisma.alternative.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.risk.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.assumption.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.assignment.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.decisionBlock.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.decisionIndicator.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.effectCalculation.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.aiSuggestion.findMany({ where: { decisionId }, select: { id: true } }),
    prisma.lesson.findMany({ where: { decisionId }, select: { id: true } }),
  ]);
  const ids = [decisionId, ...related.flat().map((r) => r.id)];

  const events = await prisma.auditEvent.findMany({
    where: { entityId: { in: ids } },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал изменений паспорта</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Дата</TH>
              <TH>Сущность</TH>
              <TH>Действие</TH>
              <TH>Пользователь</TH>
              <TH>Изменение</TH>
            </TR>
          </THead>
          <TBody>
            {events.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-4 text-center text-sm text-slate-500">
                  Событий нет.
                </TD>
              </TR>
            )}
            {events.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap text-xs">
                  {format(e.createdAt, "d MMM yyyy HH:mm", { locale: ruLocale })}
                </TD>
                <TD className="text-xs">{e.entity}</TD>
                <TD className="text-xs font-medium">{e.action}</TD>
                <TD className="text-xs">{e.actor.name}</TD>
                <TD className="max-w-96 truncate text-[11px] text-slate-500" title={e.after ?? ""}>
                  {e.after ?? "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
