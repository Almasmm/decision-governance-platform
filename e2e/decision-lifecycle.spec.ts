import { test, expect, type Page } from "@playwright/test";

const ONBOARDING_E2E_BYPASS_KEY = "decision-passport:onboarding:e2e-bypass";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, "1");
  }, ONBOARDING_E2E_BYPASS_KEY);
});

/**
 * Сквозной сценарий жизненного цикла решения уровня A:
 * вход инициатором → создание паспорта → блокировка перехода без альтернатив
 * с объяснением → альтернативы, допущения, риск-профиль → подтверждение
 * владельцем данных → независимая проверка расчёта → принятие решения
 * с мотивировкой → поручение с KPI → пост-оценка → урок в базе знаний.
 */

const USERS = {
  initiator: "Динара Ахметова",
  dataOwner: "Ержан Смагулов",
  riskOfficer: "Тимур Бекетов",
  analyst: "Марат Касымов",
  board: "Нурлан Абишев",
} as const;

async function loginAs(page: Page, name: string): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL("**/dashboard");
}

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL("**/login");
}

async function switchTo(page: Page, name: string, decisionUrl?: string): Promise<void> {
  await logout(page);
  await loginAs(page, name);
  if (decisionUrl) await page.goto(decisionUrl);
}

/** Выбирает опцию <select> по подстроке её текста. */
async function selectByText(page: Page, selector: string, substring: string): Promise<void> {
  const value = await page
    .locator(`${selector} option`)
    .filter({ hasText: substring })
    .first()
    .getAttribute("value");
  if (!value) throw new Error(`Опция «${substring}» не найдена в ${selector}`);
  await page.locator(selector).selectOption(value);
}

/** Пытается перейти на следующую стадию и возвращает текст блокировки, если ворота закрыты. */
async function tryAdvance(page: Page): Promise<string | null> {
  const button = page.getByRole("button", { name: /^Перейти к стадии/ });
  await button.click();
  const blocked = page.getByTestId("gate-blocked");
  const appeared = await blocked
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) {
    await page.waitForTimeout(1200);
    return null;
  }
  return (await blocked.innerText()).trim();
}

async function expectStage(page: Page, stage: string): Promise<void> {
  await expect(page.locator("ol li").filter({ hasText: stage }).first()).toBeVisible();
}

test("жизненный цикл решения уровня A с контрольными воротами", async ({ page }) => {
  test.setTimeout(360_000);

  // ── 1. Вход инициатором и создание паспорта уровня A ──────────────────────
  await loginAs(page, USERS.initiator);
  await page.goto("/decisions/new");

  const title = `E2E: расширение мощностей ${Date.now()}`;
  await page.locator("#title").fill(title);
  await page
    .locator("#goal")
    .fill(
      "Увеличить годовую производственную мощность на 500 т урана к 2030 году без ухудшения показателей промышленной безопасности."
    );
  await page.locator("#type").selectOption("INVESTMENT");
  await page.locator("#criticality").selectOption("A");
  await page.getByRole("button", { name: "Создать паспорт" }).click();

  await page.waitForURL(/\/decisions\/(?!new)[a-z0-9]{15,}/);
  const decisionUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  // Уровень критичности показан в Decision Control Header, а не только цветом.
  const decisionHeader = page.getByRole("region", { name: title });
  await expect(decisionHeader.getByText("УРОВЕНЬ A", { exact: true })).toBeVisible();

  // ── 2. Стадия «Проблема» → «Данные»: цель, тип и орган заполнены ──────────
  await expectStage(page, "Проблема");
  expect(await tryAdvance(page)).toBeNull();
  await expectStage(page, "Данные");

  // ── 3. Привязка критического показателя ───────────────────────────────────
  await page.goto(`${decisionUrl}?tab=passport&block=DATA`);
  await selectByText(page, "#ind-select", "URN-PROD");
  await page.locator("#ind-crit").selectOption("true");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByRole("link", { name: "URN-PROD" })).toBeVisible();

  // Переход заблокирован: владелец данных ещё не подтвердил качество
  const dataBlock = await tryAdvance(page);
  expect(dataBlock).toContain("Владельцы данных подтвердили качество");
  expect(dataBlock).toContain("Ответственный: Владельцы данных");

  // ── 4. Владелец данных подтверждает качество показателя ───────────────────
  await switchTo(page, USERS.dataOwner, `${decisionUrl}?tab=passport&block=DATA`);
  await page.getByRole("button", { name: "Подтвердить качество" }).click();
  await expect(page.getByText(/Подтверждено:/)).toBeVisible();

  await switchTo(page, USERS.initiator, `${decisionUrl}?tab=passport&block=DATA`);
  expect(await tryAdvance(page)).toBeNull();
  await expectStage(page, "Альтернативы");

  // ── 5. Попытка двинуться к принятию решения без альтернатив — блокировка ──
  const altBlock = await tryAdvance(page);
  expect(altBlock).toContain("содержательно различающихся альтернативы");
  expect(altBlock).toContain("отсутствует вариант «статус-кво»");
  expect(altBlock).toContain("Ответственный");

  // ── 6. Добавление альтернатив, включая статус-кво ─────────────────────────
  const addAlternative = async (name: string, statusQuo: boolean, economics: string) => {
    await page.goto(`${decisionUrl}?tab=alternatives`);
    await page.getByRole("button", { name: "Добавить вариант" }).click();
    await page.locator("#alt-name").fill(name);
    await page.locator("#alt-desc").fill(`Описание варианта: ${name}. Условия реализации и объём работ.`);
    await page.locator("#alt-sq").selectOption(statusQuo ? "true" : "false");
    await page.locator("#crit-economics").fill(economics);
    await page.getByRole("button", { name: "Добавить вариант в сравнение" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  };

  await addAlternative("Статус-кво: сохранение профиля добычи", true, "3");
  await addAlternative("Поэтапное расширение собственными силами", false, "8");
  await addAlternative("Ускоренное расширение с EPC-подрядчиком", false, "6");

  await page.goto(`${decisionUrl}?tab=passport&block=ALTERNATIVES`);
  expect(await tryAdvance(page)).toBeNull();
  await expectStage(page, "Риски");

  // ── 7. Допущения (обязательны для уровня A) ───────────────────────────────
  await page.goto(`${decisionUrl}?tab=risks`);
  await page.locator("#asm-text").fill("Спотовая цена U₃O₈ в горизонте проекта не опускается ниже целевого уровня");
  await page.locator("#asm-value").fill("не ниже 70 USD/фунт");
  await page.locator("#asm-conf").selectOption("MEDIUM");
  await page.locator("#asm-until").fill("2028-06-30");
  await page.getByRole("button", { name: "Добавить допущение" }).click();
  await expect(page.getByText("не ниже 70 USD/фунт")).toBeVisible();

  // ── 8. Риск-профиль заполняет риск-офицер ─────────────────────────────────
  await switchTo(page, USERS.riskOfficer, `${decisionUrl}?tab=risks`);
  await page.getByRole("button", { name: "Добавить риск", exact: true }).click();
  await page.locator("#risk-name").fill("Задержка изменения лицензии на недропользование");
  await page.locator("#risk-p0").fill("0.35");
  await page.locator("#risk-l0").fill("6500000000");
  await page.locator("#risk-p1").fill("0.15");
  await page.locator("#risk-l1").fill("3000000000");
  await page.locator("#risk-mit").fill("Раннее взаимодействие с регулятором и параллельная подготовка документации");
  await page.locator("#risk-trg").fill("Отсутствие решения регулятора к контрольной дате");
  await page.getByRole("button", { name: "Добавить риск в профиль", exact: true }).click();
  await expect(page.getByText("Задержка изменения лицензии на недропользование").first()).toBeVisible();

  // ── 9. Расчёт эффекта и независимая проверка вторым пользователем ─────────
  await switchTo(page, USERS.initiator, `${decisionUrl}?tab=economics`);
  await page.locator("#t0").fill("46");
  await page.locator("#t1").fill("28");
  await page.locator("#n").fill("120");
  await page.locator("#c").fill("9500");
  await expect(page.getByText("Годовой эффект снижения трудоёмкости")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить расчёт в паспорт" }).first().click();
  await expect(page.getByText("ожидает независимой проверки")).toBeVisible();

  // Переход к решению заблокирован: расчёт не проверен независимо
  await page.goto(`${decisionUrl}?tab=passport&block=ECONOMICS`);
  const reviewBlock = await tryAdvance(page);
  expect(reviewBlock).toContain("Независимая проверка критических расчётов");

  await switchTo(page, USERS.analyst, `${decisionUrl}?tab=economics`);
  page.once("dialog", (d) => d.accept("Хронометраж и ставка часа подтверждены документально"));
  await page.getByRole("button", { name: "Подтвердить расчёт" }).click();
  await expect(page.getByText("независимо подтверждён")).toBeVisible();

  // ── 10. Переход на стадию «Решение» ───────────────────────────────────────
  await switchTo(page, USERS.initiator, `${decisionUrl}?tab=passport&block=RISKS`);
  expect(await tryAdvance(page)).toBeNull();
  await expectStage(page, "Решение");

  // Система не переводит решение на исполнение сама: нужен вердикт человека
  const humanRequired = await tryAdvance(page);
  expect(humanRequired).toBeTruthy();

  // ── 11. Принятие решения уполномоченным лицом с мотивировкой ──────────────
  await switchTo(page, USERS.board, `${decisionUrl}?tab=alternatives`);
  await selectByText(page, "#alt-choice", "Поэтапное расширение");
  await page
    .locator("#motivation")
    .fill(
      "Поэтапный вариант обеспечивает достижение цели при приемлемом профиле риска и не требует единовременного пикового финансирования."
    );
  await page.getByRole("button", { name: "Утвердить выбранный вариант" }).click();
  const humanDecision = page.getByRole("region", { name: "Решение человека" });
  await expect(humanDecision.getByText("Зафиксированный выбор", { exact: true })).toBeVisible();
  await expect(
    humanDecision.getByText("Поэтапное расширение собственными силами", { exact: true }).first()
  ).toBeVisible();

  // ── 12. Поручение, связанное с KPI результата ─────────────────────────────
  await switchTo(page, USERS.initiator, `${decisionUrl}?tab=assignments`);
  await page.locator("#asg-text").fill("Подготовить заявку на изменение лицензии на недропользование");
  await selectByText(page, "#asg-user", USERS.initiator);
  await page.locator("#asg-due").fill("2027-03-31");
  await selectByText(page, "#asg-kpi", "CAPEX-EXEC");
  await page.getByRole("button", { name: "Создать поручение" }).click();
  await expect(page.getByRole("cell", { name: /Подготовить заявку/ })).toBeVisible();

  await page.goto(`${decisionUrl}?tab=passport&block=EXECUTION`);
  expect(await tryAdvance(page)).toBeNull();
  await expectStage(page, "Исполнение");

  // ── 13. Пост-оценка: план/факт и урок в базе знаний ───────────────────────
  await page.goto(`${decisionUrl}?tab=passport&block=POST_EVALUATION`);

  const postEvalBlock = await tryAdvance(page);
  expect(postEvalBlock).toContain("Пост-оценка");

  await page
    .locator("#POST_EVALUATION-planFact")
    .fill(
      "План: ввод дополнительной мощности 500 т к 2030 году. Факт на контрольную дату: получено разрешение регулятора, работы идут с отставанием на один квартал."
    );
  await page.getByRole("button", { name: "Сохранить блок" }).click();
  await expect(page.getByText("Сохранено")).toBeVisible();

  await page.locator("#les-plan").fill("Изменение лицензии на недропользование за 9 месяцев");
  await page.locator("#les-fact").fill("Фактически согласование заняло 12 месяцев из-за дополнительных запросов регулятора");
  await page.locator("#les-cause").selectOption("EXTERNAL");
  await page
    .locator("#les-conclusion, #les-concl")
    .first()
    .fill("В паспортах инвестиционных решений закладывать срок согласований с запасом 30% и назначать владельца этого допущения.");
  await page.getByRole("button", { name: "Записать урок" }).click();
  await expect(page.getByText("Внешние факторы").first()).toBeVisible();

  // ── 14. Переход на стадию «Обратная связь» и закрытие решения ─────────────
  await page.goto(`${decisionUrl}?tab=passport&block=POST_EVALUATION`);
  expect(await tryAdvance(page)).toBeNull();
  await expectStage(page, "Обратная связь");

  await page.goto(`${decisionUrl}?tab=passport&block=POST_EVALUATION`);
  await page.getByRole("button", { name: "Закрыть решение" }).click();
  await expect(page.getByText("Закрыто").first()).toBeVisible();

  // ── 15. Аудит зафиксировал ключевые мутации ───────────────────────────────
  await page.goto(`${decisionUrl}?tab=audit`);
  const auditPanel = page.locator('section[aria-labelledby="decision-audit-title"]');
  await expect(auditPanel.getByRole("heading", { name: "История решения" })).toBeVisible();
  await expect(auditPanel.locator("h4").first()).toBeVisible();

  // Технические action codes существуют, но не подменяют человеческий timeline:
  // каждый код скрыт внутри disclosure до явного раскрытия пользователем.
  for (const action of ["CREATE", "CONFIRM_QUALITY", "STAGE_ADVANCE", "DECIDE", "CLOSE"]) {
    const actionValue = auditPanel.locator("dd").filter({ hasText: new RegExp(`^${action}$`) }).first();
    const technicalRecord = actionValue.locator("xpath=ancestor::details");
    await expect(technicalRecord).toHaveCount(1);
    await expect(actionValue).toBeHidden();
    await technicalRecord.getByText("Показать техническую запись", { exact: true }).click();
    await expect(actionValue).toBeVisible();
    await expect(actionValue).toHaveText(action);
  }

  // Урок попал в общую базу знаний
  await page.goto("/lessons");
  await expect(page.getByText(/срок согласований с запасом/).first()).toBeVisible();
});

test("ИИ не применяет рекомендацию без вердикта человека", async ({ page }) => {
  await loginAs(page, USERS.initiator);
  await page.goto("/decisions");
  await page.getByRole("link", { name: "INV-2026-001" }).first().click();
  await page.waitForURL(/\/decisions\/(?!new)[a-z0-9]{15,}/);
  const url = new URL(page.url()).pathname;

  await page.goto(`${url}?tab=ai`);
  await expect(page.getByRole("heading", { name: "AI-анализ решения" })).toBeVisible();
  await expect(page.getByText("Governance gates")).toBeVisible();
  await expect(page.getByText("Ожидает вердикта").first()).toBeVisible();
  await expect(page.getByText("Рекомендация не применена").first()).toBeVisible();
  await expect(page.getByText("Human verdict").first()).toBeVisible();
  // Все три человеческих исхода доступны как равноправные действия.
  await expect(page.getByRole("button", { name: "Принять рекомендацию" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Принять с изменениями" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отклонить рекомендацию" })).toBeVisible();
});

test("денежный эффект не показывается без введённых параметров", async ({ page }) => {
  await loginAs(page, USERS.initiator);
  await page.goto("/kpi");
  await expect(page.getByText("Недостаточно данных для расчёта").first()).toBeVisible();
  await expect(page.getByText(/Не заполнены параметры/).first()).toBeVisible();

  await page.locator("#k-t0").fill("40");
  await page.locator("#k-t1").fill("25");
  await page.locator("#k-n").fill("100");
  await page.locator("#k-c").fill("9000");
  await expect(page.locator("text=13,5 млн ₸").first()).toBeVisible();
});
