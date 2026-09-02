// Паспорт управленческого решения — центральный экран системы.
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ChevronDown, Clock3, FileClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz";
import { decisionInclude, computePassportCompleteness, type DecisionFull } from "@/lib/snapshot";
import { buildGateContext } from "@/lib/gate-service";
import { ruleDescription } from "@/lib/gates";
import { getAiProvider } from "@/lib/ai/provider";
import { checkTierEligibility } from "@/lib/ai/eligibility";
import { BLOCK_KINDS, parseJson, type BlockKind, type Criticality, type Role, type Stage } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PassportHeader } from "@/components/decision/passport-header";
import { PassportTabs, PASSPORT_TABS } from "@/components/decision/passport-tabs";
import { EvidenceIndex } from "@/components/decision/evidence-index";
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

const BLOCK_CONTOUR: Record<BlockKind, string> = {
  IDENTIFICATION: "Нормативно-процессный контур",
  DATA: "Информационный контур",
  ALTERNATIVES: "Аналитико-интеллектуальный контур",
  ECONOMICS: "Аналитико-интеллектуальный контур",
  SAFETY: "Нормативно-процессный контур",
  RISKS: "Аналитико-интеллектуальный контур",
  DECISION: "Нормативно-процессный контур",
  EXECUTION: "Контрольный контур",
  POST_EVALUATION: "Контрольный контур",
};

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
  const requiredEvidence = completeness.blocks.filter((block) => block.required);
  const readyEvidence = requiredEvidence.filter((block) => block.completeness === 100).length;

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
    <div className="space-y-5">
      <Link href="/decisions" className="inline-flex min-h-8 items-center text-table font-medium text-muted hover:text-text hover:underline">
        ← Реестр решений
      </Link>

      <PassportHeader
        decision={decision}
        completeness={completeness.percent}
        readyEvidence={readyEvidence}
        requiredEvidence={requiredEvidence.length}
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
  const activeEvidence = completeness.blocks.find((block) => block.kind === activeBlock);
  const activeIndex = completeness.blocks.findIndex((block) => block.kind === activeBlock);

  return (
    <div className="space-y-6">
      {gate.evaluation && gate.targetStage && (
        <GateChecklist
          decisionId={decision.id}
          results={gate.evaluation.results}
          fromStage={gate.currentStage}
          toStage={gate.targetStage}
          allowed={gate.evaluation.allowed}
        >
          <AdvanceButton
            decisionId={decision.id}
            toStage={gate.targetStage}
            canAdvance={Boolean(perms.advance)}
            gateAllowed={gate.evaluation.allowed}
          />
          <WorkflowActions
            decisionId={decision.id}
            status={decision.status}
            canSubmit={Boolean(perms.submit)}
            canReturn={Boolean(perms.return)}
          />
        </GateChecklist>
      )}

      {!gate.targetStage && (
        <section className="flex items-start gap-3 rounded-panel border-l-4 border-accent bg-accent-soft px-5 py-4 shadow-panel">
          <div>
            <h2 className="text-lead font-semibold text-text">Цикл решения замкнут</h2>
            <p className="mt-1 text-table text-muted">
              Решение находится на стадии «Обратная связь»: фактический результат и извлечённые уроки возвращаются в корпоративную базу знаний.
            </p>
          </div>
        </section>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
        <EvidenceIndex
          decisionId={decision.id}
          activeBlock={activeBlock}
          completeness={completeness}
          criticality={criticality}
        />

        <Card id={`evidence-${activeBlock.toLowerCase()}`} className="min-w-0 scroll-mt-24">
          <CardHeader className="items-start border-b border-line pb-4">
            <div>
              <p className="text-meta font-semibold tracking-[0.1em] text-muted">
                БЛОК {String(activeIndex + 1).padStart(2, "0")} / {String(completeness.blocks.length).padStart(2, "0")} · {BLOCK_CONTOUR[activeBlock]}
              </p>
              <CardTitle className="mt-1">{ru.blocks[activeBlock]}</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activeEvidence?.required ? "outline" : "neutral"}>
                {activeEvidence?.required ? `Обязательный блок · уровень ${criticality}` : `Не обязателен · уровень ${criticality}`}
              </Badge>
              <Badge variant={activeEvidence?.required && (activeEvidence?.completeness ?? 0) < 100 ? "partial" : "resolvedSoft"}>
                Полнота {activeEvidence?.completeness ?? 0}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <BlockContent
              kind={activeBlock}
              decision={decision}
              payload={blockPayload(activeBlock)}
              perms={perms}
              user={user}
            />
          </CardContent>
        </Card>
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
            <dt className="text-meta text-ink-muted">Код паспорта</dt>
            <dd className="font-technical text-base">{decision.code}</dd>
          </div>
          <div>
            <dt className="text-meta text-ink-muted">Тип решения</dt>
            <dd className="text-base">{ru.decisionTypes[decision.type as keyof typeof ru.decisionTypes]}</dd>
          </div>
          <div>
            <dt className="text-meta text-ink-muted">Орган принятия решения</dt>
            <dd className="text-base">{decision.decisionBody.name}</dd>
          </div>
          <div>
            <dt className="text-meta text-ink-muted">Инициатор</dt>
            <dd className="text-base">{decision.initiator.name}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-meta text-ink-muted">Цель решения</dt>
            <dd className="text-base">{decision.goal}</dd>
          </div>
          <div>
            <dt className="text-meta text-ink-muted">Уровень критичности</dt>
            <dd className="text-base">{ru.criticality[decision.criticality as Criticality]}</dd>
          </div>
          <div>
            <dt className="text-meta text-ink-muted">Срок</dt>
            <dd className="text-base">
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
          <p className="text-base text-ink-muted">
            Вариантов в паспорте: {decision.alternatives.length}, из них «статус-кво»:{" "}
            {decision.alternatives.filter((a) => a.isStatusQuo).length}.
          </p>
          <ul className="space-y-1">
            {decision.alternatives.map((a) => (
              <li key={a.id} className="text-base">
                • {a.name}
                {a.isStatusQuo && <Badge variant="neutral" className="ml-1">статус-кво</Badge>}
                {a.selected && <Badge variant="resolvedSoft" className="ml-1">выбрано</Badge>}
              </li>
            ))}
          </ul>
          <Link href={`/decisions/${decision.id}?tab=alternatives`} className="text-meta text-graphite hover:underline">
            Перейти к матрице сравнения альтернатив →
          </Link>
        </div>
      );

    case "ECONOMICS":
      return (
        <div className="space-y-2">
          {decision.calculations.length === 0 ? (
            <p className="text-base text-ink-muted">
              Расчёты эффекта не выполнены. {ru.common.notEnoughData}: параметры формул не введены.
            </p>
          ) : (
            <ul className="space-y-1">
              {decision.calculations.map((c) => (
                <li key={c.id} className="text-base">
                  • {ru.effectKinds[c.kind as keyof typeof ru.effectKinds]}:{" "}
                  <span className="font-medium">{formatMoney(c.result)}</span>{" "}
                  {c.reviews.some((r) => r.verdict === "CONFIRMED" && r.reviewerId !== c.calculatedById) ? (
                    <Badge variant="resolvedSoft">проверен независимо</Badge>
                  ) : (
                    <Badge variant="action">без независимой проверки</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/decisions/${decision.id}?tab=economics`} className="text-meta text-graphite hover:underline">
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
          <p className="text-base text-ink-muted">
            Рисков в профиле: {decision.risks.length}; допущений: {decision.assumptions.length}.
          </p>
          <Link href={`/decisions/${decision.id}?tab=risks`} className="text-meta text-graphite hover:underline">
            Перейти к риск-профилю и допущениям →
          </Link>
        </div>
      );

    case "DECISION": {
      const selected = decision.alternatives.find((a) => a.selected);
      return (
        <div className="space-y-2 text-base">
          <div>
            <span className="text-meta text-ink-muted">Выбранная альтернатива:</span>{" "}
            {selected ? (
              <span className="font-medium">{selected.name}</span>
            ) : (
              <span className="text-signal">не выбрана</span>
            )}
          </div>
          <div>
            <span className="text-meta text-ink-muted">Мотивировка:</span>{" "}
            {decision.motivation ? (
              <span>{decision.motivation}</span>
            ) : (
              <span className="text-signal">не зафиксирована</span>
            )}
          </div>
          <p className="text-meta text-ink-muted">
            Решение принимается человеком на вкладке «Альтернативы». Система не выбирает вариант
            и не утверждает решение автоматически.
          </p>
        </div>
      );
    }

    case "EXECUTION":
      return (
        <div className="space-y-2">
          <p className="text-base text-ink-muted">
            Поручений: {decision.assignments.length}; связано с KPI:{" "}
            {decision.assignments.filter((a) => a.linkedKpiId).length}.
          </p>
          <Link href={`/decisions/${decision.id}?tab=assignments`} className="text-meta text-graphite hover:underline">
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

interface AuditEventView {
  entity: string;
  action: string;
  before: string | null;
  after: string | null;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Создал запись в досье решения",
  UPDATE_PAYLOAD: "Обновил доказательную базу",
  SUBMIT_FOR_REVIEW: "Направил решение на экспертизу",
  RETURN: "Вернул решение на доработку",
  DECIDE: "Зафиксировал решение уполномоченного органа",
  CLOSE: "Закрыл цикл решения после пост-оценки",
  LINK: "Связал показатель с доказательной базой",
  INDICATOR_CONFIRM: "Подтвердил качество показателей",
  CONFIRM_QUALITY: "Подтвердил качество показателя",
  COMPLETE: "Подтвердил исполнение поручения",
  REVIEW: "Выполнил независимую проверку расчёта",
  AI_RUN: "Запустил аналитическую модель",
  AI_VERDICT: "Зафиксировал человеческий вердикт по рекомендации ИИ",
  LOAD_FROM_SOURCE: "Обновил показатель из системы-источника",
  MANUAL_INPUT: "Зафиксировал ручное значение показателя",
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Decision: "Паспорт решения",
  DecisionBlock: "Блок доказательной базы",
  DecisionIndicator: "Показатель решения",
  Alternative: "Альтернатива",
  Risk: "Риск",
  Assumption: "Ключевое допущение",
  Assignment: "Поручение",
  EffectCalculation: "Расчёт эффекта",
  CalcReview: "Проверка расчёта",
  AiSuggestion: "Рекомендация ИИ",
  Lesson: "Извлечённый урок",
};

function auditEventNarrative(event: AuditEventView): { title: string; detail: string | null } {
  const before = parseAuditRecord(event.before);
  const after = parseAuditRecord(event.after);

  if (event.action === "STAGE_ADVANCE") {
    const from = stageName(readString(after, "from") ?? readString(before, "stage"));
    const to = stageName(readString(after, "to") ?? readString(after, "stage"));
    return {
      title: "Перевёл решение на следующую стадию",
      detail: from && to ? `${from} → ${to}` : "Переход подтверждён контрольными воротами",
    };
  }

  if (event.action === "RETURN") {
    const reason = readString(after, "reason");
    return {
      title: AUDIT_ACTION_LABELS.RETURN ?? "Вернул решение на доработку",
      detail: reason ? `Основание: ${reason}` : "Основание зафиксировано в технической записи",
    };
  }

  if (event.action === "AI_VERDICT") {
    const verdict = readString(after, "humanVerdict");
    const verdictLabel = verdict && verdict in ru.aiVerdicts
      ? ru.aiVerdicts[verdict as keyof typeof ru.aiVerdicts]
      : null;
    return {
      title: AUDIT_ACTION_LABELS.AI_VERDICT ?? "Зафиксировал человеческий вердикт по рекомендации ИИ",
      detail: verdictLabel ? `Вердикт человека: ${verdictLabel}` : null,
    };
  }

  if (event.action === "DECIDE") {
    const motivation = readString(after, "motivation");
    return {
      title: AUDIT_ACTION_LABELS.DECIDE ?? "Зафиксировал решение уполномоченного органа",
      detail: motivation ? `Мотивировка: ${motivation}` : "Выбор и мотивировка сохранены в паспорте",
    };
  }

  const entity = AUDIT_ENTITY_LABELS[event.entity] ?? "Объект досье";
  return {
    title: AUDIT_ACTION_LABELS[event.action] ?? "Зафиксировал изменение в досье решения",
    detail: `Объект: ${entity}`,
  };
}

function parseAuditRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function stageName(value: string | null): string | null {
  return value && value in ru.stages ? ru.stages[value as Stage] : null;
}

function prettyAuditPayload(raw: string | null): string {
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

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

  const groups: Array<{ label: string; events: typeof events }> = [];
  for (const event of events) {
    const label = format(event.createdAt, "d MMMM yyyy", { locale: ruLocale });
    const current = groups.at(-1);
    if (current?.label === label) current.events.push(event);
    else groups.push({ label, events: [event] });
  }

  return (
    <section className="overflow-hidden rounded-panel bg-surface shadow-panel" aria-labelledby="decision-audit-title">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-meta font-semibold tracking-[0.1em] text-muted">
            <FileClock className="h-4 w-4" aria-hidden="true" />
            КОНТРОЛЬНЫЙ СЛЕД
          </p>
          <h2 id="decision-audit-title" className="mt-1 text-section font-semibold text-text">
            История решения
          </h2>
          <p className="mt-1 max-w-2xl text-table text-muted">
            Человеческое описание событий показано первым. Технические коды и исходные данные доступны только по раскрытию.
          </p>
        </div>
        <span className="font-technical text-meta text-muted">{events.length} событий</span>
      </header>

      {events.length === 0 ? (
        <p className="px-6 py-10 text-center text-base text-muted">Событий по этому решению пока нет.</p>
      ) : (
        <div className="px-5 py-5 sm:px-6">
          {groups.map((group) => (
            <section key={group.label} className="mb-7 last:mb-0" aria-labelledby={`audit-${group.events[0]!.id}`}>
              <h3 id={`audit-${group.events[0]!.id}`} className="mb-3 text-table font-semibold text-text">
                {group.label}
              </h3>
              <ol className="ml-2 border-l border-line">
                {group.events.map((event) => {
                  const narrative = auditEventNarrative(event);
                  const role = ru.roles[event.actor.role as Role] ?? event.actor.role;
                  return (
                    <li key={event.id} className="relative pb-6 pl-6 last:pb-1">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden="true" />
                      <div className="grid gap-3 lg:grid-cols-[90px_minmax(0,1fr)]">
                        <p className="flex items-center gap-1.5 font-technical text-meta text-muted">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {format(event.createdAt, "HH:mm:ss")}
                        </p>
                        <article>
                          <p className="text-table text-muted">
                            <span className="font-semibold text-text">{event.actor.name}</span> · {role}
                          </p>
                          <h4 className="mt-1 text-base font-semibold text-text">{narrative.title}</h4>
                          {narrative.detail && <p className="mt-1 text-table leading-5 text-muted">{narrative.detail}</p>}

                          <details className="group mt-3 rounded-control border border-line bg-canvas/70">
                            <summary className="flex min-h-9 cursor-pointer items-center justify-between gap-3 px-3 text-meta font-semibold text-muted hover:text-text">
                              Показать техническую запись
                              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <div className="border-t border-line px-3 py-3">
                              <dl className="grid gap-2 text-meta sm:grid-cols-3">
                                <div>
                                  <dt className="text-muted">Сущность</dt>
                                  <dd className="font-technical text-text">{event.entity}</dd>
                                </div>
                                <div>
                                  <dt className="text-muted">Действие</dt>
                                  <dd className="font-technical text-text">{event.action}</dd>
                                </div>
                                <div>
                                  <dt className="text-muted">ID записи</dt>
                                  <dd className="break-all font-technical text-text">{event.entityId}</dd>
                                </div>
                              </dl>
                              <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
                                <div className="min-w-0">
                                  <p className="mb-1 text-meta font-semibold text-muted">До изменения</p>
                                  <pre className="max-h-64 overflow-auto rounded-control bg-obsidian p-3 font-technical text-meta text-white/80">{prettyAuditPayload(event.before)}</pre>
                                </div>
                                <div className="min-w-0">
                                  <p className="mb-1 text-meta font-semibold text-muted">После изменения</p>
                                  <pre className="max-h-64 overflow-auto rounded-control bg-obsidian p-3 font-technical text-meta text-white/80">{prettyAuditPayload(event.after)}</pre>
                                </div>
                              </div>
                            </div>
                          </details>
                        </article>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
