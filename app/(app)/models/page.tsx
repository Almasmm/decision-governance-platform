// Реестр моделей ИИ: назначение, владелец, версия, валидация, метрики,
// ограничения, разрешённые уровни решений.
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseJson } from "@/lib/domain";
import { ru } from "@/lib/i18n/ru";
import { getAiProvider } from "@/lib/ai/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, CriticalityBadge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  await requireUser();
  const models = await prisma.aiModel.findMany({
    include: { owner: true, _count: { select: { suggestions: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-brand">{ru.nav.models}</h1>
        <p className="text-xs text-slate-500">
          Рекомендательная ступень ИИ доступна только для моделей, зарегистрированных и
          валидированных здесь, и только для тех уровней решений, для которых модель допущена.
        </p>
      </div>

      <div className="rounded border border-slate-200 bg-brand-card/40 p-3 text-xs text-slate-700">
        Активный провайдер ИИ: <span className="font-medium">{getAiProvider().name}</span>. Приложение
        полностью работает без внешних API-ключей: при отсутствии ключа используется
        детерминированный mock-провайдер, все ответы строятся из данных паспорта.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {models.map((m) => {
          const metrics = parseJson<Record<string, number>>(m.qualityMetrics, {});
          const levels = parseJson<string[]>(m.allowedForLevels, []);
          const validated = m.validatedAt !== null;
          return (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>{m.name}</span>
                  {validated ? (
                    <Badge variant="success">
                      <ShieldCheck className="h-3 w-3" />
                      валидирована
                    </Badge>
                  ) : (
                    <Badge variant="warn">
                      <ShieldAlert className="h-3 w-3" />
                      не валидирована
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Назначение</dt>
                    <dd className="text-slate-800">{m.purpose}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <dt className="text-slate-500">Владелец модели</dt>
                      <dd className="font-medium">{m.owner.name}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Версия</dt>
                      <dd className="font-mono">{m.version}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Дата валидации</dt>
                      <dd className="font-medium">
                        {m.validatedAt
                          ? format(m.validatedAt, "d MMMM yyyy", { locale: ruLocale })
                          : "не проводилась"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Критичность модели</dt>
                      <dd className="font-medium">{m.criticality}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-slate-500">Входные данные</dt>
                    <dd className="text-slate-800">{m.inputs}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Метрики качества</dt>
                    <dd className="mt-0.5 flex flex-wrap gap-1.5">
                      {Object.entries(metrics).length === 0 && <span className="text-slate-400">не заданы</span>}
                      {Object.entries(metrics).map(([k, v]) => (
                        <Badge key={k} variant="outline">
                          {k}: {v}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Ограничения применения</dt>
                    <dd className="rounded bg-amber-50 px-2 py-1 text-brand-warn">{m.limitations}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="text-slate-500">Допущена для уровней решений:</dt>
                    <dd className="flex gap-1">
                      {levels.length === 0 ? (
                        <span className="text-brand-warn">не допущена</span>
                      ) : (
                        levels.map((l) => <CriticalityBadge key={l} level={l} />)
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-1 text-slate-500">
                    <dt>Предложений сформировано:</dt>
                    <dd className="font-medium text-slate-800">{m._count.suggestions}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500">
        Для решений уровня A любое предложение рекомендательной ступени требует явного вердикта
        человека с текстовым обоснованием. Отклонение рекомендации — полноправное действие,
        фиксируемое в аудите.
      </p>
    </div>
  );
}
