// Демо-сиды DecisionPassport. Все цифры внутри решений — синтетические (бейдж «демо-данные»).
// Публичные агрегаты компании вынесены в отдельный блок дашборда и не смешиваются с этими сидами.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_GATE_CONFIG } from "../lib/gates";
import { BLOCK_KINDS } from "../lib/domain";
import { computeBlockCompleteness, decisionInclude } from "../lib/snapshot";

const prisma = new PrismaClient();

const PASSWORD = "demo1234";

function d(iso: string): Date {
  return new Date(iso);
}

async function main() {
  console.log("Очистка базы…");
  await prisma.auditEvent.deleteMany();
  await prisma.calcReview.deleteMany();
  await prisma.effectCalculation.deleteMany();
  await prisma.aiSuggestion.deleteMany();
  await prisma.aiModel.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.kpiMeasurement.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.assumption.deleteMany();
  await prisma.alternative.deleteMany();
  await prisma.decisionIndicator.deleteMany();
  await prisma.decisionBlock.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.indicatorValue.deleteMany();
  await prisma.indicator.deleteMany();
  await prisma.gateCheck.deleteMany();
  await prisma.decisionBody.deleteMany();
  await prisma.user.deleteMany();

  console.log("Пользователи…");
  const hash = bcrypt.hashSync(PASSWORD, 10);
  const mkUser = (email: string, name: string, role: string, position: string) =>
    prisma.user.create({ data: { email, name, role, position, passwordHash: hash } });

  const initiator = await mkUser("initiator@kap.kz", "Динара Ахметова", "INITIATOR", "Директор департамента стратегии");
  const dataOwner = await mkUser("dataowner@kap.kz", "Ержан Смагулов", "DATA_OWNER", "Владелец данных производственного блока");
  const dataOwner2 = await mkUser("dataowner2@kap.kz", "Гульнара Оспанова", "DATA_OWNER", "Владелец данных финансового блока");
  const riskOfficer = await mkUser("risk@kap.kz", "Тимур Бекетов", "RISK_OFFICER", "Руководитель службы риск-менеджмента");
  const analyst = await mkUser("analyst@kap.kz", "Алия Нурланова", "ANALYST", "Главный аналитик");
  const analyst2 = await mkUser("analyst2@kap.kz", "Марат Касымов", "ANALYST", "Ведущий аналитик (независимая проверка)");
  const secretary = await mkUser("secretary@kap.kz", "Сауле Жумабаева", "SECRETARY", "Корпоративный секретарь");
  const board = await mkUser("board@kap.kz", "Нурлан Абишев", "BOARD_MEMBER", "Член Совета директоров");
  const admin = await mkUser("admin@kap.kz", "Администратор системы", "ADMIN", "Администратор платформы");

  console.log("Органы принятия решений…");
  const bodyBoard = await prisma.decisionBody.create({ data: { name: "Совет директоров", kind: "BOARD" } });
  const bodyInvest = await prisma.decisionBody.create({ data: { name: "Комитет по инвестициям", kind: "COMMITTEE" } });
  const bodyAudit = await prisma.decisionBody.create({ data: { name: "Комитет по аудиту и рискам", kind: "COMMITTEE" } });
  const bodyMgmt = await prisma.decisionBody.create({ data: { name: "Правление", kind: "MANAGEMENT" } });

  console.log("Контрольные ворота…");
  await prisma.gateCheck.createMany({ data: DEFAULT_GATE_CONFIG });

  console.log("Каталог показателей (20, из них 8 критических)…");
  type Ind = {
    code: string; name: string; businessMeaning: string; formula?: string; unit: string;
    sourceSystem: string; frequency: string; ownerId?: string; maxLagDays: number; isCritical: boolean;
  };
  const inds: Ind[] = [
    { code: "URN-PROD", name: "Объём добычи урана", businessMeaning: "Фактическая добыча урана по всем ДЗО, приведённая к 100%", formula: "Σ добычи по ДЗО × доля участия", unit: "т", sourceSystem: "SAP", frequency: "MONTHLY", ownerId: dataOwner.id, maxLagDays: 10, isCritical: true },
    { code: "COST-C1", name: "Денежная себестоимость C1", businessMeaning: "Cash cost добычи фунта закиси-окиси урана", formula: "(OPEX добычи − попутная выручка) / объём", unit: "USD/фунт", sourceSystem: "SAP", frequency: "QUARTERLY", ownerId: dataOwner2.id, maxLagDays: 45, isCritical: true },
    { code: "HSE-LTIFR", name: "LTIFR (травматизм)", businessMeaning: "Частота травм с потерей рабочего времени на 1 млн часов", formula: "Травмы × 1 000 000 / отработанные часы", unit: "коэф.", sourceSystem: "EKAP", frequency: "MONTHLY", ownerId: dataOwner.id, maxLagDays: 15, isCritical: true },
    { code: "UR-PRICE", name: "Спотовая цена U3O8", businessMeaning: "Рыночная цена закиси-окиси урана (UxC)", unit: "USD/фунт", sourceSystem: "EXTERNAL", frequency: "WEEKLY", ownerId: dataOwner2.id, maxLagDays: 7, isCritical: true },
    { code: "ACID-STOCK", name: "Запас серной кислоты", businessMeaning: "Обеспеченность производств серной кислотой", formula: "Остаток на складах / среднесуточное потребление", unit: "суток", sourceSystem: "SAP", frequency: "DAILY", ownerId: dataOwner.id, maxLagDays: 2, isCritical: true },
    { code: "WELL-DEBIT", name: "Средний дебит скважин", businessMeaning: "Продуктивность технологических блоков ПСВ", unit: "м³/ч", sourceSystem: "DWH", frequency: "MONTHLY", ownerId: dataOwner.id, maxLagDays: 12, isCritical: true },
    { code: "CAPEX-EXEC", name: "Исполнение CAPEX", businessMeaning: "Освоение капитальных вложений к плану", formula: "Факт CAPEX / план CAPEX × 100", unit: "%", sourceSystem: "SAP", frequency: "QUARTERLY", ownerId: dataOwner2.id, maxLagDays: 30, isCritical: true },
    { code: "INV-RETURN", name: "IRR инвестиционного портфеля", businessMeaning: "Внутренняя норма доходности активных проектов", unit: "%", sourceSystem: "POWERBI", frequency: "QUARTERLY", ownerId: dataOwner2.id, maxLagDays: 45, isCritical: true },
    { code: "SALES-VOL", name: "Объём реализации", businessMeaning: "Продажи урановой продукции по контрактам", unit: "т", sourceSystem: "DWH", frequency: "QUARTERLY", ownerId: dataOwner2.id, maxLagDays: 30, isCritical: false },
    { code: "FX-KZT", name: "Курс USD/KZT", businessMeaning: "Средневзвешенный обменный курс", unit: "тенге", sourceSystem: "EXTERNAL", frequency: "DAILY", ownerId: dataOwner2.id, maxLagDays: 1, isCritical: false },
    { code: "NPV-PORT", name: "NPV портфеля проектов", businessMeaning: "Суммарная чистая приведённая стоимость проектов", unit: "млрд тенге", sourceSystem: "POWERBI", frequency: "QUARTERLY", ownerId: dataOwner2.id, maxLagDays: 45, isCritical: false },
    { code: "STAFF-TURN", name: "Текучесть персонала", businessMeaning: "Доля уволившихся к среднесписочной численности", unit: "%", sourceSystem: "EKAP", frequency: "QUARTERLY", ownerId: dataOwner.id, maxLagDays: 30, isCritical: false },
    { code: "DIGI-AUTOM", name: "Автоматизированные бизнес-процессы", businessMeaning: "Число процессов, автоматизированных в eKAP", unit: "шт.", sourceSystem: "EKAP", frequency: "QUARTERLY", ownerId: analyst.id, maxLagDays: 30, isCritical: false },
    { code: "RPA-COUNT", name: "Действующие RPA-роботы", businessMeaning: "Число роботизированных операций в промышленной эксплуатации", unit: "шт.", sourceSystem: "EKAP", frequency: "QUARTERLY", ownerId: analyst.id, maxLagDays: 30, isCritical: false },
    { code: "REP-TIME", name: "Трудоёмкость подготовки аналитического пакета", businessMeaning: "Часы на подготовку одного пакета для органа принятия решений", unit: "ч", sourceSystem: "MANUAL", frequency: "MONTHLY", ownerId: analyst.id, maxLagDays: 30, isCritical: false },
    { code: "PROC-LOCAL", name: "Доля местного содержания в закупках", businessMeaning: "Закупки у казахстанских поставщиков", unit: "%", sourceSystem: "SAP", frequency: "QUARTERLY", ownerId: dataOwner2.id, maxLagDays: 30, isCritical: false },
    { code: "ENERGY-CONS", name: "Энергопотребление", businessMeaning: "Потребление электроэнергии производствами", unit: "ГВт·ч", sourceSystem: "DWH", frequency: "MONTHLY", ownerId: dataOwner.id, maxLagDays: 20, isCritical: false },
    { code: "WATER-USE", name: "Водопотребление", businessMeaning: "Забор воды на производственные нужды", unit: "тыс. м³", sourceSystem: "DWH", frequency: "MONTHLY", ownerId: dataOwner.id, maxLagDays: 20, isCritical: false },
    { code: "CO2-EMIS", name: "Выбросы CO₂", businessMeaning: "Прямые выбросы парниковых газов (Scope 1)", unit: "тыс. т", sourceSystem: "EKAP", frequency: "YEARLY", ownerId: dataOwner.id, maxLagDays: 90, isCritical: false },
    { code: "TRAIN-HRS", name: "Часы обучения на сотрудника", businessMeaning: "Среднее число часов обучения в год", unit: "ч", sourceSystem: "EKAP", frequency: "YEARLY", ownerId: dataOwner.id, maxLagDays: 90, isCritical: false },
  ];
  const indicators: Record<string, { id: string }> = {};
  for (const i of inds) {
    indicators[i.code] = await prisma.indicator.create({
      data: {
        code: i.code, name: i.name, businessMeaning: i.businessMeaning, formula: i.formula ?? null,
        unit: i.unit, sourceSystem: i.sourceSystem, frequency: i.frequency, ownerId: i.ownerId ?? null,
        maxLagDays: i.maxLagDays, isCritical: i.isCritical,
        qualityRules: JSON.stringify({ notNull: true, maxLagDays: i.maxLagDays }),
      },
    });
  }

  console.log("История значений показателей…");
  const iv = (code: string, value: number, asOf: string, loadType: string, note?: string) =>
    prisma.indicatorValue.create({
      data: { indicatorId: indicators[code]!.id, value, asOf: d(asOf), loadType, versionNote: note ?? null },
    });
  await iv("URN-PROD", 1092, "2026-05-31", "AUTO", "Загрузка из SAP");
  await iv("URN-PROD", 1148, "2026-06-30", "AUTO", "Загрузка из SAP");
  await iv("URN-PROD", 1121, "2026-07-31", "AUTO", "Загрузка из SAP");
  await iv("URN-PROD", 1139, "2026-08-25", "MANUAL", "Оперативная сводка ДЗО (расходится с SAP на 1.6%)");
  await iv("COST-C1", 14.9, "2026-03-31", "AUTO");
  await iv("COST-C1", 15.4, "2026-06-30", "AUTO");
  await iv("HSE-LTIFR", 0.24, "2026-06-30", "AUTO");
  await iv("HSE-LTIFR", 0.21, "2026-07-31", "AUTO");
  await iv("UR-PRICE", 78.5, "2026-08-21", "MANUAL", "Еженедельный бюллетень UxC");
  await iv("UR-PRICE", 80.2, "2026-08-28", "MANUAL", "Еженедельный бюллетень UxC");
  await iv("ACID-STOCK", 23, "2026-08-29", "AUTO");
  await iv("ACID-STOCK", 19, "2026-08-30", "AUTO");
  await iv("WELL-DEBIT", 7.8, "2026-07-31", "AUTO");
  await iv("CAPEX-EXEC", 87.4, "2026-06-30", "AUTO");
  await iv("INV-RETURN", 16.2, "2026-06-30", "AUTO");
  await iv("SALES-VOL", 4210, "2026-06-30", "AUTO");
  await iv("FX-KZT", 512.3, "2026-08-29", "AUTO");
  await iv("NPV-PORT", 412, "2026-06-30", "AUTO");
  await iv("STAFF-TURN", 6.1, "2026-06-30", "AUTO");
  await iv("DIGI-AUTOM", 135, "2026-06-30", "AUTO", "Интегрированный годовой отчёт 2025");
  await iv("RPA-COUNT", 21, "2026-06-30", "AUTO");
  await iv("REP-TIME", 46, "2026-05-31", "MANUAL", "Хронометраж базового процесса");
  await iv("REP-TIME", 28, "2026-08-15", "MANUAL", "Хронометраж после пилота");
  await iv("PROC-LOCAL", 71.5, "2026-06-30", "AUTO");
  await iv("ENERGY-CONS", 98.4, "2026-07-31", "AUTO");
  await iv("WATER-USE", 812, "2026-07-31", "AUTO");
  await iv("CO2-EMIS", 402, "2026-01-31", "AUTO");
  await iv("TRAIN-HRS", 41, "2026-01-31", "AUTO");

  console.log("Реестр моделей ИИ…");
  const modelMcda = await prisma.aiModel.create({
    data: {
      name: "MCDA-ранжирование альтернатив",
      purpose: "Ранжирование альтернатив по взвешенным критериям с объяснением факторов выбора",
      ownerId: analyst.id,
      inputs: "Матрица «альтернативы × критерии» (8 критериев, шкала 0–10)",
      version: "1.2.0",
      validatedAt: d("2026-06-15"),
      qualityMetrics: JSON.stringify({ backtestAgreement: 0.82, expertAgreement: 0.77 }),
      limitations: "Равные веса критериев; не учитывает нелинейные зависимости и качественные ограничения. Только поддержка решения — не замена экспертизы.",
      criticality: "HIGH",
      allowedForLevels: JSON.stringify(["A", "B", "C"]),
    },
  });
  await prisma.aiModel.create({
    data: {
      name: "Детектор аномалий показателей",
      purpose: "Поиск расхождений одного показателя между источниками и аномальных значений",
      ownerId: analyst2.id,
      inputs: "Ряды значений показателей из двух и более источников",
      version: "0.9.1",
      validatedAt: d("2026-04-02"),
      qualityMetrics: JSON.stringify({ precision: 0.9, recall: 0.71 }),
      limitations: "Порог отклонения 5% фиксирован; не различает методологические расхождения и ошибки данных.",
      criticality: "MEDIUM",
      allowedForLevels: JSON.stringify(["B", "C"]),
    },
  });

  console.log("KPI: базовая и пилотная выборки…");
  const kpi = (group: string, metricCode: string, phase: string, value: number, sampleSize: number, measuredAt: string, periodNote: string) =>
    prisma.kpiMeasurement.create({ data: { group, metricCode, phase, value, sampleSize, measuredAt: d(measuredAt), periodNote } });
  const BASE_P = "01.07.2025 – 31.12.2025";
  const PILOT_P = "01.01.2026 – 30.06.2026";
  await kpi("SPEED", "SPEED_MEDIAN_DAYS", "BASELINE", 32, 40, "2025-12-31", BASE_P);
  await kpi("SPEED", "SPEED_MEDIAN_DAYS", "PILOT", 19, 12, "2026-06-30", PILOT_P);
  await kpi("DATA", "DATA_CRIT_OWNED_SHARE", "BASELINE", 58, 40, "2025-12-31", BASE_P);
  await kpi("DATA", "DATA_CRIT_OWNED_SHARE", "PILOT", 100, 12, "2026-06-30", PILOT_P);
  await kpi("DATA", "DATA_AUTO_SHARE", "BASELINE", 35, 40, "2025-12-31", BASE_P);
  await kpi("DATA", "DATA_AUTO_SHARE", "PILOT", 60, 12, "2026-06-30", PILOT_P);
  await kpi("DATA", "DATA_DISCREPANCIES", "BASELINE", 14, 40, "2025-12-31", BASE_P);
  await kpi("DATA", "DATA_DISCREPANCIES", "PILOT", 5, 12, "2026-06-30", PILOT_P);
  await kpi("JUSTIFICATION", "JUST_ALT_SHARE", "BASELINE", 22, 40, "2025-12-31", BASE_P);
  await kpi("JUSTIFICATION", "JUST_ALT_SHARE", "PILOT", 67, 12, "2026-06-30", PILOT_P);
  await kpi("EXECUTION", "EXEC_KPI_LINKED_SHARE", "BASELINE", 18, 40, "2025-12-31", BASE_P);
  await kpi("EXECUTION", "EXEC_KPI_LINKED_SHARE", "PILOT", 74, 12, "2026-06-30", PILOT_P);
  await kpi("EXECUTION", "EXEC_OVERDUE_SHARE", "BASELINE", 23, 40, "2025-12-31", BASE_P);
  await kpi("EXECUTION", "EXEC_OVERDUE_SHARE", "PILOT", 11, 12, "2026-06-30", PILOT_P);
  await kpi("LEARNING", "LEARN_POSTEVAL_SHARE", "BASELINE", 8, 40, "2025-12-31", BASE_P);
  await kpi("LEARNING", "LEARN_POSTEVAL_SHARE", "PILOT", 42, 12, "2026-06-30", PILOT_P);
  await kpi("LEARNING", "LEARN_RETURN_SHARE", "BASELINE", 35, 40, "2025-12-31", BASE_P);
  await kpi("LEARNING", "LEARN_RETURN_SHARE", "PILOT", 18, 12, "2026-06-30", PILOT_P);

  console.log("Решения…");

  const scores = (safety: number, regulatory: number, economics: number, timeline: number, resources: number, hr: number, cyber: number, sustainability: number) =>
    JSON.stringify({ safety, regulatory, economics, timeline, resources, hr, cyber, sustainability });

  const linkInd = (decisionId: string, code: string, isCritical: boolean, confirmed: boolean) =>
    prisma.decisionIndicator.create({
      data: {
        decisionId,
        indicatorId: indicators[code]!.id,
        isCritical,
        confirmedById: confirmed ? dataOwner.id : null,
        confirmedAt: confirmed ? new Date() : null,
      },
    });

  const mkBlocks = async (decisionId: string, payloads: Partial<Record<string, object>> = {}) => {
    for (const kind of BLOCK_KINDS) {
      await prisma.decisionBlock.create({
        data: { decisionId, kind, payload: JSON.stringify(payloads[kind] ?? {}) },
      });
    }
  };

  // ── 1. Уровень A: расширение добычных мощностей ──────────────────────────
  const d1 = await prisma.decision.create({
    data: {
      code: "INV-2026-001",
      title: "Расширение добычных мощностей на месторождении «Южный Инкай»",
      type: "INVESTMENT",
      criticality: "A",
      stage: "DECISION",
      status: "IN_REVIEW",
      goal: "Увеличить годовую производственную мощность на 800 т урана к 2029 году при сохранении C1 в первом квартиле мировой кривой затрат и без ухудшения показателей HSE.",
      initiatorId: initiator.id,
      decisionBodyId: bodyInvest.id,
      registeredAt: d("2026-05-12"),
      packageReadyAt: d("2026-06-20"),
      deadline: d("2026-10-01"),
    },
  });
  await mkBlocks(d1.id, {
    SAFETY: { safetyNote: "Оценка воздействия на промышленную безопасность проведена: расширение не затрагивает зоны с повышенным радиационным фоном; программа радиационного контроля актуализирована.", regulatoryNote: "Требуются изменения в лицензию на недропользование; предварительное согласование с уполномоченным органом получено 14.06.2026." },
    DATA: { dataNote: "Доказательная база: 6 критических показателей, автозагрузка из SAP/DWH, подтверждение владельцев данных получено." },
    ECONOMICS: { economicsNote: "Расчёт эффектов (1) и (2) выполнен; независимая проверка — М. Касымов." },
  });
  for (const [code, crit, conf] of [["URN-PROD", true, true], ["COST-C1", true, true], ["UR-PRICE", true, true], ["WELL-DEBIT", true, true], ["CAPEX-EXEC", true, true], ["INV-RETURN", true, true], ["SALES-VOL", false, false], ["FX-KZT", false, false]] as const) {
    await linkInd(d1.id, code, crit, conf);
  }
  await prisma.alternative.createMany({
    data: [
      { decisionId: d1.id, name: "Статус-кво: сохранение текущего профиля добычи", isStatusQuo: true, description: "Отказ от расширения; поддержание мощности 2 400 т/год с постепенным истощением действующих блоков.", criteriaScores: scores(8, 9, 3, 9, 8, 7, 8, 4), selected: false },
      { decisionId: d1.id, name: "Поэтапное расширение собственными силами", isStatusQuo: false, description: "Две очереди по 400 т/год с шагом 18 месяцев; финансирование из операционного денежного потока.", criteriaScores: scores(7, 7, 8, 6, 6, 6, 7, 7), selected: false },
      { decisionId: d1.id, name: "Ускоренное расширение с привлечением подрядчика EPC", isStatusQuo: false, description: "Единовременный ввод 800 т/год через 24 месяца; EPC-контракт с фиксированной ценой.", criteriaScores: scores(6, 6, 7, 8, 4, 5, 6, 6), selected: false },
      { decisionId: d1.id, name: "Совместное предприятие со стратегическим партнёром", isStatusQuo: false, description: "СП 60/40 с разделением CAPEX и гарантированным офтейком 50% дополнительного объёма.", criteriaScores: scores(7, 5, 8, 5, 8, 6, 5, 7), selected: false },
    ],
  });
  const asm = (text: string, value: string, confidence: string, validUntil: string) =>
    prisma.assumption.create({ data: { decisionId: d1.id, text, value, confidence, validUntil: d(validUntil), ownerId: analyst.id } });
  await asm("Спотовая цена U3O8 в горизонте проекта", "не ниже 70 USD/фунт", "MEDIUM", "2027-06-30");
  await asm("Курс USD/KZT в инвестиционном горизонте", "480–540 тенге", "MEDIUM", "2027-03-31");
  await asm("Доступность серной кислоты", "не менее 20 суток запаса", "HIGH", "2026-12-31");
  await asm("Сроки изменения лицензии на недропользование", "не более 9 месяцев", "MEDIUM", "2027-02-28");
  await asm("Ставка дисконтирования (WACC)", "12% в тенге", "HIGH", "2026-12-31");
  const rk = (name: string, probability: number, impact: number, mitigation: string, rp: number, ri: number, triggers: string) =>
    prisma.risk.create({ data: { decisionId: d1.id, name, probability, impact, mitigation, residualProbability: rp, residualImpact: ri, ownerId: riskOfficer.id, triggers } });
  await rk("Падение цены урана ниже 60 USD/фунт", 0.2, 18_000_000_000, "Хеджирование через долгосрочные контракты на 60% объёма", 0.12, 9_000_000_000, "Спот ниже 65 USD/фунт две недели подряд");
  await rk("Задержка изменения лицензии", 0.35, 6_500_000_000, "Раннее взаимодействие с регулятором, параллельная подготовка документации", 0.15, 3_000_000_000, "Отсутствие решения регулятора к 01.03.2027");
  await rk("Дефицит серной кислоты", 0.3, 8_200_000_000, "Долгосрочные контракты с двумя поставщиками + собственный проект производства", 0.15, 3_500_000_000, "Запас ниже 15 суток");
  await rk("Превышение CAPEX более чем на 15%", 0.25, 5_400_000_000, "EPC с фиксированной ценой, резерв 10%, стадийный контроль", 0.12, 2_200_000_000, "Освоение CAPEX отклоняется от графика на 10%");
  await rk("Дефицит квалифицированных кадров ПСВ", 0.3, 2_100_000_000, "Целевая подготовка с вузами, программа удержания", 0.18, 1_100_000_000, "Укомплектованность ниже 85%");
  await rk("Киберинцидент в АСУ ТП при расширении", 0.1, 4_000_000_000, "Сегментация сетей, аудит АСУ ТП, план реагирования", 0.05, 1_500_000_000, "Инциденты ИБ в контуре АСУ ТП");
  const calc1 = await prisma.effectCalculation.create({
    data: {
      decisionId: d1.id, kind: "AUTOMATION",
      inputs: JSON.stringify({ t0: 46, t1: 28, n: 120, c: 9500 }),
      result: (46 - 28) * 120 * 9500,
      calculatedById: analyst.id, isConservative: true,
    },
  });
  const calc2 = await prisma.effectCalculation.create({
    data: {
      decisionId: d1.id, kind: "RISK",
      inputs: JSON.stringify({ p0: 0.3, l0: 8_200_000_000, p1: 0.15, l1: 3_500_000_000, attributionShare: 0.5 }),
      result: (0.3 * 8_200_000_000 - 0.15 * 3_500_000_000) * 0.5,
      calculatedById: analyst.id, isConservative: true,
      attributionNote: "Консервативная доля 0.5: на снижение риска влияют также контрактные меры, не связанные с цифровым контуром.",
    },
  });
  await prisma.calcReview.create({ data: { calculationId: calc1.id, reviewerId: analyst2.id, verdict: "CONFIRMED", comment: "Хронометраж и ставка часа подтверждены документально." } });
  await prisma.calcReview.create({ data: { calculationId: calc2.id, reviewerId: analyst2.id, verdict: "CONFIRMED", comment: "Оценки вероятностей согласованы со службой риск-менеджмента." } });
  await prisma.assignment.createMany({
    data: [
      { decisionId: d1.id, text: "Подготовить заявку на изменение лицензии на недропользование", assigneeId: initiator.id, dueDate: d("2026-11-15"), linkedKpiId: indicators["CAPEX-EXEC"]!.id, status: "OPEN" },
      { decisionId: d1.id, text: "Заключить долгосрочные контракты на поставку серной кислоты", assigneeId: initiator.id, dueDate: d("2026-12-20"), linkedKpiId: indicators["ACID-STOCK"]!.id, status: "OPEN" },
    ],
  });
  await prisma.aiSuggestion.create({
    data: {
      decisionId: d1.id, tier: "RECOMMENDATIONAL", modelId: modelMcda.id,
      content: "Ранжирование: 1) Поэтапное расширение собственными силами (54/80); 2) СП со стратегическим партнёром (51/80); 3) Ускоренное расширение EPC (48/80); 4) Статус-кво (56/80 — но не решает задачу роста).",
      explanation: "Сумма равновзвешенных оценок по 8 критериям. Статус-кво силён по безопасности и срокам, но не достигает цели решения.",
      sourceRefs: JSON.stringify([{ ref: "alternatives", note: "матрица критериев" }]),
      humanVerdict: "PENDING",
    },
  });

  // ── 2. Уровень A: корректировка добычного плана ──────────────────────────
  const d2 = await prisma.decision.create({
    data: {
      code: "PRD-2026-002",
      title: "Корректировка добычного плана 2027 с влиянием на сбыт и HSE",
      type: "PRODUCTION",
      criticality: "A",
      stage: "RISKS",
      status: "IN_REVIEW",
      goal: "Скорректировать добычной план 2027 года с учётом рыночной конъюнктуры и обеспеченности реагентами, сохранив исполнение контрактных обязательств и целевые показатели HSE.",
      initiatorId: initiator.id,
      decisionBodyId: bodyMgmt.id,
      registeredAt: d("2026-06-18"),
      packageReadyAt: d("2026-07-30"),
      deadline: d("2026-11-01"),
    },
  });
  await mkBlocks(d2.id, {
    SAFETY: { safetyNote: "Изменение темпов закисления не влияет на радиационную обстановку; программа мониторинга сохраняется.", regulatoryNote: "Корректировка в пределах утверждённых проектных документов." },
  });
  for (const [code, crit, conf] of [["URN-PROD", true, true], ["ACID-STOCK", true, true], ["HSE-LTIFR", true, true], ["SALES-VOL", false, false], ["WELL-DEBIT", true, false]] as const) {
    await linkInd(d2.id, code, crit, conf);
  }
  await prisma.alternative.createMany({
    data: [
      { decisionId: d2.id, name: "Статус-кво: план без изменений", isStatusQuo: true, description: "Сохранение утверждённого плана 13 500 т с риском дефицита кислоты в 3 кв. 2027.", criteriaScores: scores(6, 8, 6, 8, 4, 7, 7, 6), selected: false },
      { decisionId: d2.id, name: "Снижение плана на 4% с приоритетом высокомаржинальных блоков", isStatusQuo: false, description: "Перераспределение добычи на блоки с высоким дебитом; высвобождение кислоты.", criteriaScores: scores(8, 8, 7, 7, 8, 7, 7, 7), selected: false },
      { decisionId: d2.id, name: "Сохранение плана с закупкой кислоты на споте", isStatusQuo: false, description: "Дозакупка кислоты по спотовым ценам (+18% к бюджету реагентов).", criteriaScores: scores(6, 7, 5, 8, 5, 7, 7, 5), selected: false },
    ],
  });
  await prisma.assumption.create({ data: { decisionId: d2.id, text: "Спотовые цены на серную кислоту", value: "рост не более 20% г/г", confidence: "MEDIUM", validUntil: d("2027-03-31"), ownerId: analyst.id } });
  await prisma.assumption.create({ data: { decisionId: d2.id, text: "Исполнение контрактных отгрузок 2027", value: "100% номинаций", confidence: "HIGH", validUntil: d("2027-12-31"), ownerId: initiator.id } });
  await prisma.risk.create({ data: { decisionId: d2.id, name: "Срыв контрактных отгрузок при снижении плана", probability: 0.18, impact: 12_000_000_000, mitigation: "Использование складских остатков и своп-операции с партнёрами", residualProbability: 0.08, residualImpact: 5_000_000_000, ownerId: riskOfficer.id, triggers: "Отставание добычи от плана более 3%" } });
  await prisma.risk.create({ data: { decisionId: d2.id, name: "Рост LTIFR при интенсификации работ", probability: 0.15, impact: 900_000_000, mitigation: "Усиленный контроль подрядчиков, стоп-карты", residualProbability: 0.08, residualImpact: 450_000_000, ownerId: riskOfficer.id, triggers: "Рост микротравм 2 месяца подряд" } });

  // ── 3. Уровень B: закупка критической категории ──────────────────────────
  const d3 = await prisma.decision.create({
    data: {
      code: "PRC-2026-003",
      title: "Закупка серной кислоты на 2027 год с риск-скорингом поставщиков",
      type: "PROCUREMENT",
      criticality: "B",
      stage: "RISKS",
      status: "IN_REVIEW",
      goal: "Обеспечить потребность производств в серной кислоте на 2027 год (620 тыс. т) с диверсификацией поставщиков и учётом риск-скоринга контрагентов.",
      initiatorId: initiator.id,
      decisionBodyId: bodyMgmt.id,
      registeredAt: d("2026-07-02"),
      packageReadyAt: d("2026-08-10"),
      deadline: d("2026-10-15"),
    },
  });
  await mkBlocks(d3.id, {
    SAFETY: { safetyNote: "Перевозка опасного груза класса 8 — требования к подвижному составу учтены в тендерной документации.", regulatoryNote: "Закупка по правилам холдинга; категория критическая." },
  });
  for (const [code, crit, conf] of [["ACID-STOCK", true, true], ["PROC-LOCAL", false, false], ["FX-KZT", false, false]] as const) {
    await linkInd(d3.id, code, crit, conf);
  }
  await prisma.alternative.createMany({
    data: [
      { decisionId: d3.id, name: "Статус-кво: продление контракта с единственным поставщиком", isStatusQuo: true, description: "Продление на год с текущим поставщиком (скоринг B-, 78% потребности).", criteriaScores: scores(6, 7, 7, 9, 6, 6, 7, 5), selected: false },
      { decisionId: d3.id, name: "Диверсификация 60/40 между двумя поставщиками", isStatusQuo: false, description: "Два долгосрочных контракта с поставщиками со скорингом A и B+.", criteriaScores: scores(8, 8, 7, 7, 7, 6, 7, 7), selected: false },
      { decisionId: d3.id, name: "Консорциумная закупка с партнёрами по отрасли", isStatusQuo: false, description: "Объединение объёмов с партнёрами для скидки 6–8%, скоринг участников A.", criteriaScores: scores(7, 6, 8, 5, 8, 6, 6, 7), selected: false },
    ],
  });
  await prisma.risk.create({ data: { decisionId: d3.id, name: "Дефолт поставщика с низким скорингом", probability: 0.22, impact: 4_800_000_000, mitigation: "Банковские гарантии, страховой запас 25 суток", residualProbability: 0.1, residualImpact: 2_000_000_000, ownerId: riskOfficer.id, triggers: "Понижение скоринга ниже B" } });
  await prisma.risk.create({ data: { decisionId: d3.id, name: "Логистические сбои на железной дороге", probability: 0.3, impact: 1_900_000_000, mitigation: "Альтернативные маршруты, буферные склады", residualProbability: 0.15, residualImpact: 800_000_000, ownerId: riskOfficer.id, triggers: "Просрочка поставок более 5 суток" } });

  // ── 4. Уровень B: цифровой проект с бизнес-кейсом ────────────────────────
  const d4 = await prisma.decision.create({
    data: {
      code: "DIG-2026-004",
      title: "Тиражирование цифрового паспорта решений на все комитеты СД",
      type: "DIGITAL",
      criticality: "B",
      stage: "EXECUTION",
      status: "IN_EXECUTION",
      goal: "Масштабировать пилот цифрового паспорта управленческих решений с одного комитета на все комитеты Совета директоров с подтверждённым бизнес-кейсом.",
      initiatorId: initiator.id,
      decisionBodyId: bodyBoard.id,
      registeredAt: d("2026-03-10"),
      packageReadyAt: d("2026-04-05"),
      decidedAt: d("2026-05-20"),
      deadline: d("2027-03-01"),
      motivation: "Пилот подтвердил сокращение медианного срока подготовки пакета с 32 до 19 дней и рост доли решений с альтернативами с 22% до 67%. Масштабирование поэтапное, с KPI-гейтом после каждого комитета.",
    },
  });
  await mkBlocks(d4.id, {
    SAFETY: { safetyNote: "Контур не затрагивает АСУ ТП; обрабатываются только управленческие данные.", regulatoryNote: "Соответствует политике ИБ холдинга; аттестация контура пройдена." },
    POST_EVALUATION: { planFact: "" },
  });
  for (const [code, crit, conf] of [["REP-TIME", true, true], ["DIGI-AUTOM", false, false], ["RPA-COUNT", false, false]] as const) {
    await linkInd(d4.id, code, crit, conf);
  }
  await prisma.alternative.createMany({
    data: [
      { decisionId: d4.id, name: "Статус-кво: паспорт только в пилотном комитете", isStatusQuo: true, description: "Сохранение пилотного контура без тиражирования.", criteriaScores: scores(7, 7, 4, 9, 8, 7, 7, 5), selected: false },
      { decisionId: d4.id, name: "Поэтапное тиражирование по комитетам", isStatusQuo: false, description: "По одному комитету в квартал с KPI-гейтом.", criteriaScores: scores(7, 8, 8, 6, 7, 7, 7, 8), selected: true },
      { decisionId: d4.id, name: "Одновременное внедрение во всех комитетах", isStatusQuo: false, description: "Big bang за один квартал силами интегратора.", criteriaScores: scores(6, 7, 6, 8, 4, 5, 6, 6), selected: false },
    ],
  });
  const calc4 = await prisma.effectCalculation.create({
    data: {
      decisionId: d4.id, kind: "AUTOMATION",
      inputs: JSON.stringify({ t0: 46, t1: 28, n: 96, c: 9500 }),
      result: (46 - 28) * 96 * 9500,
      calculatedById: analyst.id, isConservative: true,
    },
  });
  await prisma.calcReview.create({ data: { calculationId: calc4.id, reviewerId: analyst2.id, verdict: "CONFIRMED", comment: "Подтверждено по данным хронометража пилота." } });
  await prisma.assignment.createMany({
    data: [
      { decisionId: d4.id, text: "Перевести Комитет по аудиту и рискам на цифровой паспорт", assigneeId: analyst.id, dueDate: d("2026-10-01"), linkedKpiId: indicators["REP-TIME"]!.id, status: "IN_PROGRESS" },
      { decisionId: d4.id, text: "Обучить корпоративных секретарей работе с контуром", assigneeId: secretary.id, dueDate: d("2026-09-15"), linkedKpiId: indicators["TRAIN-HRS"]!.id, status: "DONE", completedAt: d("2026-08-28") },
    ],
  });

  // ── 5–7. Уровень C: типовые операции ─────────────────────────────────────
  const mkC = async (code: string, title: string, type: string, goal: string, status: string, stage: string, decided?: string) => {
    const dec = await prisma.decision.create({
      data: {
        code, title, type, criticality: "C", stage, status, goal,
        initiatorId: initiator.id, decisionBodyId: bodyMgmt.id,
        registeredAt: d("2026-07-15"), packageReadyAt: d("2026-07-18"),
        decidedAt: decided ? d(decided) : null,
        deadline: d("2026-09-30"),
        motivation: decided ? "Типовая операция, соответствует регламенту; прошла автоматическую проверку ворот уровня C." : null,
      },
    });
    await mkBlocks(dec.id);
    await linkInd(dec.id, "FX-KZT", false, false);
    return dec;
  };
  const d5 = await mkC("OPS-2026-005", "Утверждение графика отпусков руководителей ДЗО", "HR", "Утвердить сводный график отпусков руководителей дочерних организаций на 2027 год в соответствии с трудовым законодательством.", "APPROVED", "EXECUTION", "2026-07-25");
  await prisma.assignment.create({ data: { decisionId: d5.id, text: "Довести график до ДЗО", assigneeId: secretary.id, dueDate: d("2026-08-10"), linkedKpiId: indicators["STAFF-TURN"]!.id, status: "DONE", completedAt: d("2026-08-05") } });
  const d6 = await mkC("OPS-2026-006", "Продление типового договора аренды офисных площадей", "PROCUREMENT", "Продлить договор аренды офисных площадей филиала на 12 месяцев на действующих условиях.", "IN_EXECUTION", "EXECUTION", "2026-07-28");
  await prisma.assignment.create({ data: { decisionId: d6.id, text: "Подписать дополнительное соглашение", assigneeId: initiator.id, dueDate: d("2026-09-20"), linkedKpiId: indicators["PROC-LOCAL"]!.id, status: "IN_PROGRESS" } });
  const d7 = await mkC("OPS-2026-007", "Перераспределение лимитов командировочных расходов", "HR", "Перераспределить неиспользованные лимиты командировочных расходов между департаментами в пределах бюджета.", "CLOSED", "FEEDBACK", "2026-08-01");
  await prisma.decisionBlock.update({
    where: { decisionId_kind: { decisionId: d7.id, kind: "POST_EVALUATION" } },
    data: { payload: JSON.stringify({ planFact: "Лимиты перераспределены в полном объёме; отклонений от плана нет." }) },
  });
  await prisma.lesson.create({ data: { decisionId: d7.id, whatPlanned: "Перераспределение в течение 10 рабочих дней", whatHappened: "Выполнено за 7 рабочих дней", causeCategory: "EXECUTION", conclusion: "Типовые операции уровня C проходят контур быстрее регламентного срока — норматив можно ужесточить." } });

  // ── 8. RETURNED: стратегическое решение, возвращено на доработку ─────────
  const d8 = await prisma.decision.create({
    data: {
      code: "STR-2026-008",
      title: "Вход в сегмент производства топливных сборок (ТВС)",
      type: "STRATEGY",
      criticality: "A",
      stage: "ALTERNATIVES",
      status: "RETURNED",
      goal: "Оценить целесообразность расширения присутствия в производстве тепловыделяющих сборок для диверсификации выручки в вертикали ЯТЦ.",
      initiatorId: initiator.id,
      decisionBodyId: bodyBoard.id,
      registeredAt: d("2026-04-22"),
      deadline: d("2026-12-15"),
      returnCount: 2,
    },
  });
  await mkBlocks(d8.id);
  for (const [code, crit, conf] of [["UR-PRICE", true, false], ["INV-RETURN", true, false], ["NPV-PORT", false, false]] as const) {
    await linkInd(d8.id, code, crit, conf);
  }
  await prisma.alternative.create({ data: { decisionId: d8.id, name: "Статус-кво: участие только через существующее СП", isStatusQuo: true, description: "Сохранение текущей доли в действующем производстве ТВС.", criteriaScores: scores(7, 8, 5, 9, 8, 7, 7, 6), selected: false } });

  // ── 9–10. Закрытые решения с пост-оценкой и уроками ──────────────────────
  const d9 = await prisma.decision.create({
    data: {
      code: "DIG-2025-009",
      title: "Внедрение RPA в процесс закрытия управленческой отчётности",
      type: "DIGITAL",
      criticality: "B",
      stage: "FEEDBACK",
      status: "CLOSED",
      goal: "Сократить срок закрытия управленческой отчётности с 12 до 7 рабочих дней за счёт роботизации сверок.",
      initiatorId: initiator.id,
      decisionBodyId: bodyMgmt.id,
      registeredAt: d("2025-09-15"),
      packageReadyAt: d("2025-10-20"),
      decidedAt: d("2025-11-10"),
      deadline: d("2026-06-30"),
      motivation: "Бизнес-кейс подтверждён пилотом на двух сверках; тиражирование на 8 операций.",
    },
  });
  await mkBlocks(d9.id, {
    SAFETY: { safetyNote: "Не затрагивает производственный контур.", regulatoryNote: "Соответствует политике ИБ." },
    POST_EVALUATION: { planFact: "План: закрытие за 7 рабочих дней с 01.04.2026. Факт: 9 рабочих дней — два робота потребовали доработки из-за изменения формата выгрузки SAP." },
  });
  await linkInd(d9.id, "RPA-COUNT", false, false);
  await linkInd(d9.id, "REP-TIME", true, true);
  await prisma.alternative.createMany({
    data: [
      { decisionId: d9.id, name: "Статус-кво: ручные сверки", isStatusQuo: true, description: "Сохранение ручного процесса.", criteriaScores: scores(7, 7, 3, 9, 7, 6, 8, 4), selected: false },
      { decisionId: d9.id, name: "RPA-роботизация сверок", isStatusQuo: false, description: "Роботизация 8 типовых сверок.", criteriaScores: scores(7, 7, 8, 7, 7, 6, 6, 7), selected: true },
      { decisionId: d9.id, name: "Полная замена учётной системы", isStatusQuo: false, description: "Миграция на новую платформу консолидации.", criteriaScores: scores(6, 6, 5, 3, 3, 4, 5, 6), selected: false },
    ],
  });
  await prisma.assignment.create({ data: { decisionId: d9.id, text: "Ввести 8 RPA-роботов в промышленную эксплуатацию", assigneeId: analyst.id, dueDate: d("2026-03-31"), linkedKpiId: indicators["RPA-COUNT"]!.id, status: "DONE", completedAt: d("2026-04-18") } });
  await prisma.lesson.create({
    data: {
      decisionId: d9.id,
      whatPlanned: "Закрытие отчётности за 7 рабочих дней с апреля 2026",
      whatHappened: "Достигнуто 9 рабочих дней: изменение формата выгрузки SAP потребовало доработки двух роботов",
      causeCategory: "DATA_QUALITY",
      conclusion: "В паспорта цифровых решений включать допущение о стабильности форматов данных источников и владельца этого допущения; изменения форматов — в триггеры пересмотра.",
    },
  });

  const d10 = await prisma.decision.create({
    data: {
      code: "RSK-2025-010",
      title: "Программа снижения риска дефицита серной кислоты 2026",
      type: "RISK",
      criticality: "B",
      stage: "FEEDBACK",
      status: "CLOSED",
      goal: "Снизить ожидаемый ущерб от дефицита серной кислоты в 2026 году за счёт диверсификации поставок и буферных запасов.",
      initiatorId: initiator.id,
      decisionBodyId: bodyAudit.id,
      registeredAt: d("2025-08-05"),
      packageReadyAt: d("2025-09-01"),
      decidedAt: d("2025-09-25"),
      deadline: d("2026-07-01"),
      motivation: "Ожидаемый ущерб снижается с 2.46 до 0.53 млрд тенге при затратах на меры 0.4 млрд тенге.",
    },
  });
  await mkBlocks(d10.id, {
    SAFETY: { safetyNote: "Хранение дополнительного объёма кислоты — в пределах лицензированных мощностей складов.", regulatoryNote: "Требования промбезопасности к складам опасных веществ соблюдены." },
    POST_EVALUATION: { planFact: "План: запас не ниже 20 суток весь 2026 год. Факт: в феврале 2026 запас снижался до 14 суток из-за ремонтов на заводе поставщика — сработал триггер, задействован резервный контракт." },
  });
  await linkInd(d10.id, "ACID-STOCK", true, true);
  await prisma.alternative.createMany({
    data: [
      { decisionId: d10.id, name: "Статус-кво: один поставщик, запас 10 суток", isStatusQuo: true, description: "Текущая схема снабжения.", criteriaScores: scores(5, 7, 7, 9, 7, 7, 7, 5), selected: false },
      { decisionId: d10.id, name: "Диверсификация + буфер 25 суток", isStatusQuo: false, description: "Второй поставщик и наращивание буферного запаса.", criteriaScores: scores(8, 8, 6, 6, 6, 7, 7, 7), selected: true },
      { decisionId: d10.id, name: "Строительство собственного производства кислоты", isStatusQuo: false, description: "CAPEX-проект 3 года.", criteriaScores: scores(8, 7, 5, 2, 3, 5, 6, 8), selected: false },
    ],
  });
  const calc10 = await prisma.effectCalculation.create({
    data: {
      decisionId: d10.id, kind: "RISK",
      inputs: JSON.stringify({ p0: 0.3, l0: 8_200_000_000, p1: 0.15, l1: 3_500_000_000, attributionShare: 0.5 }),
      result: (0.3 * 8_200_000_000 - 0.15 * 3_500_000_000) * 0.5,
      calculatedById: analyst.id, isConservative: true,
      attributionNote: "0.5 — часть эффекта обеспечена контрактными мерами вне цифрового контура.",
    },
  });
  await prisma.calcReview.create({ data: { calculationId: calc10.id, reviewerId: analyst2.id, verdict: "CONFIRMED", comment: "Методика и входные данные подтверждены." } });
  await prisma.assignment.create({ data: { decisionId: d10.id, text: "Заключить резервный контракт на поставку кислоты", assigneeId: initiator.id, dueDate: d("2025-12-15"), linkedKpiId: indicators["ACID-STOCK"]!.id, status: "DONE", completedAt: d("2025-12-10") } });
  await prisma.lesson.create({
    data: {
      decisionId: d10.id,
      whatPlanned: "Запас кислоты не ниже 20 суток в течение всего 2026 года",
      whatHappened: "В феврале 2026 запас снижался до 14 суток (ремонт у поставщика); резервный контракт закрыл дефицит за 9 дней",
      causeCategory: "UNFORESEEN_RISK",
      conclusion: "Триггеры пересмотра сработали корректно; в риск-профиль аналогичных решений добавлять сценарий одновременного ремонта у двух поставщиков.",
    },
  });

  // ── 11. Уровень B: кадровое, ранняя стадия ───────────────────────────────
  const d11 = await prisma.decision.create({
    data: {
      code: "HR-2026-011",
      title: "Программа удержания дефицитных специальностей ПСВ-добычи",
      type: "HR",
      criticality: "B",
      stage: "DATA",
      status: "DRAFT",
      goal: "Снизить текучесть по дефицитным специальностям подземного скважинного выщелачивания с 9% до 5% к концу 2027 года.",
      initiatorId: initiator.id,
      decisionBodyId: bodyMgmt.id,
      registeredAt: d("2026-08-14"),
      deadline: d("2026-12-01"),
    },
  });
  await mkBlocks(d11.id);
  await linkInd(d11.id, "STAFF-TURN", true, false);
  await linkInd(d11.id, "TRAIN-HRS", false, false);

  // ── 12. Уровень B: инвестиционное на исполнении ──────────────────────────
  const d12 = await prisma.decision.create({
    data: {
      code: "INV-2026-012",
      title: "Модернизация перерабатывающего комплекса «Восток»",
      type: "INVESTMENT",
      criticality: "B",
      stage: "EXECUTION",
      status: "IN_EXECUTION",
      goal: "Повысить коэффициент извлечения на переделе переработки на 1.8 п.п. за счёт модернизации сорбционного передела.",
      initiatorId: initiator.id,
      decisionBodyId: bodyInvest.id,
      registeredAt: d("2026-02-10"),
      packageReadyAt: d("2026-03-15"),
      decidedAt: d("2026-04-20"),
      deadline: d("2027-06-30"),
      motivation: "NPV положителен при цене от 62 USD/фунт; срок окупаемости 4.2 года.",
    },
  });
  await mkBlocks(d12.id, {
    SAFETY: { safetyNote: "Проект прошёл экспертизу промышленной безопасности 12.03.2026.", regulatoryNote: "Разрешительная документация получена." },
  });
  for (const [code, crit, conf] of [["CAPEX-EXEC", true, true], ["URN-PROD", true, true]] as const) {
    await linkInd(d12.id, code, crit, conf);
  }
  await prisma.alternative.createMany({
    data: [
      { decisionId: d12.id, name: "Статус-кво: эксплуатация без модернизации", isStatusQuo: true, description: "Сохранение текущего коэффициента извлечения.", criteriaScores: scores(7, 8, 4, 9, 8, 7, 8, 5), selected: false },
      { decisionId: d12.id, name: "Модернизация сорбционного передела", isStatusQuo: false, description: "Замена ионообменных смол и обвязки, +1.8 п.п. извлечения.", criteriaScores: scores(7, 7, 8, 6, 6, 7, 7, 8), selected: true },
      { decisionId: d12.id, name: "Полная реконструкция комплекса", isStatusQuo: false, description: "Глубокая реконструкция с остановкой на 6 месяцев.", criteriaScores: scores(7, 6, 6, 3, 3, 5, 6, 8), selected: false },
    ],
  });
  await prisma.assignment.createMany({
    data: [
      { decisionId: d12.id, text: "Завершить поставку ионообменных смол", assigneeId: initiator.id, dueDate: d("2026-08-15"), linkedKpiId: indicators["CAPEX-EXEC"]!.id, status: "OVERDUE" },
      { decisionId: d12.id, text: "Смонтировать обвязку сорбционных колонн", assigneeId: initiator.id, dueDate: d("2026-11-30"), linkedKpiId: indicators["CAPEX-EXEC"]!.id, status: "IN_PROGRESS" },
    ],
  });

  console.log("Пересчёт полноты блоков…");
  const all = await prisma.decision.findMany({ include: decisionInclude });
  for (const dec of all) {
    for (const kind of BLOCK_KINDS) {
      const completeness = computeBlockCompleteness(dec, kind);
      await prisma.decisionBlock.update({
        where: { decisionId_kind: { decisionId: dec.id, kind } },
        data: { completeness },
      });
    }
  }

  console.log("Аудит-события сидов…");
  const auditSeed = (entity: string, entityId: string, action: string, actorId: string, after?: object) =>
    prisma.auditEvent.create({ data: { entity, entityId, action, actorId, after: after ? JSON.stringify(after) : null } });
  await auditSeed("Decision", d1.id, "CREATE", initiator.id, { code: d1.code });
  await auditSeed("Decision", d1.id, "INDICATOR_CONFIRM", dataOwner.id, { indicators: ["URN-PROD", "COST-C1", "WELL-DEBIT"] });
  await auditSeed("Decision", d8.id, "RETURN", secretary.id, { reason: "Недостаточно альтернатив: отсутствуют содержательные варианты помимо статус-кво", returnCount: 2 });
  await auditSeed("Decision", d4.id, "STAGE_ADVANCE", secretary.id, { from: "DECISION", to: "EXECUTION" });
  await auditSeed("Decision", d9.id, "CLOSE", secretary.id, { postEvaluation: true });
  await auditSeed("AiSuggestion", d1.id, "AI_RUN", analyst.id, { tier: "RECOMMENDATIONAL", model: "MCDA-ранжирование альтернатив" });

  console.log(`Готово. Пользователей: 9, решений: ${all.length}, показателей: ${inds.length}.`);
  console.log(`Пароль всех демо-аккаунтов: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
