// Пять групп KPI процесса принятия решений и метаданные метрик.
import type { KpiGroup } from "./domain";

export interface KpiMetricDef {
  code: string;
  group: KpiGroup;
  name: string;
  unit: string;
  /** UP — больше лучше; DOWN — меньше лучше */
  direction: "UP" | "DOWN";
  /** Границы нормирования для индекса зрелости */
  normMin: number;
  normMax: number;
}

export const KPI_METRICS: KpiMetricDef[] = [
  {
    code: "SPEED_MEDIAN_DAYS",
    group: "SPEED",
    name: "Медианное время от регистрации полного запроса до готовности аналитического пакета",
    unit: "дней",
    direction: "DOWN",
    normMin: 2,
    normMax: 45,
  },
  {
    code: "DATA_CRIT_OWNED_SHARE",
    group: "DATA",
    name: "Доля критических показателей с владельцем и источником",
    unit: "%",
    direction: "UP",
    normMin: 0,
    normMax: 100,
  },
  {
    code: "DATA_AUTO_SHARE",
    group: "DATA",
    name: "Доля автозагружаемых показателей",
    unit: "%",
    direction: "UP",
    normMin: 0,
    normMax: 100,
  },
  {
    code: "DATA_DISCREPANCIES",
    group: "DATA",
    name: "Число расхождений между источниками",
    unit: "шт.",
    direction: "DOWN",
    normMin: 0,
    normMax: 20,
  },
  {
    code: "JUST_ALT_SHARE",
    group: "JUSTIFICATION",
    name: "Доля решений с альтернативами и риск-сценариями",
    unit: "%",
    direction: "UP",
    normMin: 0,
    normMax: 100,
  },
  {
    code: "EXEC_KPI_LINKED_SHARE",
    group: "EXECUTION",
    name: "Доля поручений, связанных с KPI результата",
    unit: "%",
    direction: "UP",
    normMin: 0,
    normMax: 100,
  },
  {
    code: "EXEC_OVERDUE_SHARE",
    group: "EXECUTION",
    name: "Уровень просрочки поручений",
    unit: "%",
    direction: "DOWN",
    normMin: 0,
    normMax: 50,
  },
  {
    code: "LEARN_POSTEVAL_SHARE",
    group: "LEARNING",
    name: "Доля решений с пост-оценкой",
    unit: "%",
    direction: "UP",
    normMin: 0,
    normMax: 100,
  },
  {
    code: "LEARN_RETURN_SHARE",
    group: "LEARNING",
    name: "Доля материалов, возвращённых на доработку",
    unit: "%",
    direction: "DOWN",
    normMin: 0,
    normMax: 60,
  },
];

export function kpiMetric(code: string): KpiMetricDef | undefined {
  return KPI_METRICS.find((m) => m.code === code);
}
