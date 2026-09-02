// Интерфейсные строки (RU). Для добавления KZ/EN — создать kz.ts/en.ts с тем же контрактом.

export const ru = {
  appName: "DecisionPassport",
  appSubtitle: "Цифровой контур принятия управленческих решений",
  org: "АО «НАК «Казатомпром» (демо-контур)",
  demoBadge: "демо-данные",
  annualReportNote: "данные интегрированного годового отчёта 2025",

  roles: {
    INITIATOR: "Инициатор",
    DATA_OWNER: "Владелец данных",
    RISK_OFFICER: "Риск-офицер",
    ANALYST: "Аналитик",
    SECRETARY: "Корпоративный секретарь",
    BOARD_MEMBER: "Член Совета директоров",
    ADMIN: "Администратор",
  },

  decisionTypes: {
    INVESTMENT: "Инвестиционное",
    PRODUCTION: "Производственное",
    PROCUREMENT: "Закупочное",
    HR: "Кадровое",
    RISK: "Управление рисками",
    STRATEGY: "Стратегическое",
    DIGITAL: "Цифровая трансформация",
  },

  criticality: {
    A: "Уровень A — стратегическое",
    B: "Уровень B — существенное",
    C: "Уровень C — типовое",
  },
  criticalityShort: { A: "A", B: "B", C: "C" },

  stages: {
    PROBLEM: "Проблема",
    DATA: "Данные",
    ALTERNATIVES: "Альтернативы",
    RISKS: "Риски",
    DECISION: "Решение",
    EXECUTION: "Исполнение",
    FEEDBACK: "Обратная связь",
  },

  statuses: {
    DRAFT: "Черновик",
    IN_REVIEW: "На экспертизе",
    RETURNED: "Возвращено на доработку",
    APPROVED: "Утверждено",
    REJECTED: "Отклонено",
    IN_EXECUTION: "На исполнении",
    POST_EVALUATION: "Пост-оценка",
    CLOSED: "Закрыто",
  },

  blocks: {
    IDENTIFICATION: "Идентификация",
    DATA: "Данные и источники",
    ALTERNATIVES: "Альтернативы",
    ECONOMICS: "Экономика",
    SAFETY: "Безопасность и регуляторика",
    RISKS: "Риски",
    DECISION: "Решение",
    EXECUTION: "Исполнение",
    POST_EVALUATION: "Пост-оценка",
  },

  sourceSystems: {
    SAP: "SAP ERP",
    EKAP: "eKAP",
    POWERBI: "Power BI",
    DWH: "Хранилище данных",
    MANUAL: "Ручной ввод",
    EXTERNAL: "Внешний источник",
  },

  frequency: {
    DAILY: "Ежедневно",
    WEEKLY: "Еженедельно",
    MONTHLY: "Ежемесячно",
    QUARTERLY: "Ежеквартально",
    YEARLY: "Ежегодно",
  },

  loadTypes: { AUTO: "Автозагрузка", MANUAL: "Ручной ввод" },

  kpiGroups: {
    SPEED: "Скорость",
    DATA: "Данные",
    JUSTIFICATION: "Обоснование",
    EXECUTION: "Исполнение",
    LEARNING: "Обучение",
  },
  kpiPhases: { BASELINE: "Базовая выборка", PILOT: "Пилот" },

  effectKinds: {
    AUTOMATION: "Снижение трудоёмкости",
    RISK: "Снижение ожидаемого ущерба",
    NPV: "NPV (стадия масштабирования)",
  },

  aiTiers: {
    INFORMATIONAL: "Ступень 1 — информационная",
    ANALYTICAL: "Ступень 2 — аналитическая",
    RECOMMENDATIONAL: "Ступень 3 — рекомендательная",
  },

  aiVerdicts: {
    ACCEPTED: "Принято",
    REJECTED: "Отклонено",
    MODIFIED: "Принято с изменениями",
    PENDING: "Ожидает вердикта",
  },

  causeCategories: {
    EXTERNAL: "Внешние факторы",
    DATA_QUALITY: "Качество данных",
    WRONG_MODEL: "Ошибочная модель/допущение",
    EXECUTION: "Недостатки исполнения",
    UNFORESEEN_RISK: "Непредвиденный риск",
  },

  assignmentStatuses: {
    OPEN: "Открыто",
    IN_PROGRESS: "В работе",
    DONE: "Исполнено",
    OVERDUE: "Просрочено",
  },

  confidence: { HIGH: "Высокая", MEDIUM: "Средняя", LOW: "Низкая" },

  criteria: {
    safety: "Безопасность",
    regulatory: "Регуляторика",
    economics: "Экономика",
    timeline: "Сроки",
    resources: "Ресурсы",
    hr: "Кадры",
    cyber: "Киберриск",
    sustainability: "Устойчивость",
  },

  badges: {
    fact: "Факт",
    forecast: "Прогноз",
    assumption: "Допущение",
  },

  maturityLevels: {
    1: "Фрагментарный",
    2: "Регламентированный",
    3: "Интегрированный",
    4: "Предиктивный",
    5: "Адаптивный",
  } as Record<number, string>,

  nav: {
    dashboard: "Дашборд руководителя",
    decisions: "Реестр решений",
    indicators: "Каталог показателей",
    kpi: "Замер эффекта и KPI",
    models: "Реестр моделей ИИ",
    lessons: "Журнал и база уроков",
    boards: "Ролевые дашборды",
    roadmap: "Дорожная карта",
    audit: "Аудит",
    admin: "Администрирование",
  },

  common: {
    login: "Войти",
    logout: "Выйти",
    email: "Email",
    password: "Пароль",
    save: "Сохранить",
    cancel: "Отмена",
    add: "Добавить",
    search: "Поиск",
    notEnoughData: "Недостаточно данных для расчёта",
    missingParams: "Не заполнены параметры",
    source: "Источник",
    owner: "Владелец",
    formula: "Формула",
    asOf: "Актуально на",
    loadedAt: "Загружено",
    completeness: "Полнота паспорта",
    whatIsMissing: "Чего не хватает для следующей стадии",
    accessDenied: "Недостаточно прав для выполнения действия",
    pilotCalcNote: "Расчёт по данным пилота — не официальный показатель компании",
    sampleSize: "Размер выборки",
    period: "Период",
  },
} as const;

export type RuDict = typeof ru;
