import { expect, test, type Page } from "@playwright/test";

const TOUR = '[data-testid="onboarding-tour"]';

async function expectTour(page: Page) {
  const tour = page.locator(TOUR);
  await expect(tour).toBeVisible({ timeout: 5_000 });
  return tour;
}

async function skipTour(page: Page): Promise<void> {
  const tour = page.locator(TOUR);
  if (await tour.isVisible().catch(() => false)) {
    await tour.getByRole("button", { name: "Пропустить", exact: true }).click();
    await expect(tour).toBeHidden();
    await expect(tour).not.toBeAttached();
  }
}

async function advanceTour(page: Page, tour = page.locator(TOUR)): Promise<void> {
  const previousStepId = await tour.getAttribute("data-tour-id");
  expect(previousStepId).toBeTruthy();
  await tour.getByRole("button", { name: "Далее", exact: true }).click();
  await page.waitForFunction(
    ({ selector, stepId }) => {
      const nextTour = document.querySelector(selector);
      const nextStepId = nextTour?.getAttribute("data-tour-id");
      return Boolean(nextStepId && nextStepId !== stepId);
    },
    { selector: TOUR, stepId: previousStepId }
  );
}

async function completeTour(page: Page, maximumSteps = 20): Promise<void> {
  const tour = await expectTour(page);
  for (let index = 0; index < maximumSteps; index += 1) {
    const currentStepId = await tour.getAttribute("data-tour-id");
    const action = tour.getByRole("button", { name: /^(Далее|Готово)$/ });
    await expect(action).toBeVisible();
    const completesTour = (await action.textContent())?.trim() === "Готово";
    await action.click();
    if (completesTour) {
      await expect(tour).toBeHidden();
      await expect(tour).not.toBeAttached();
      return;
    }
    await page.waitForFunction(
      ({ selector, stepId }) => {
        const nextTour = document.querySelector(selector);
        const nextStepId = nextTour?.getAttribute("data-tour-id");
        return Boolean(nextStepId && nextStepId !== stepId);
      },
      { selector: TOUR, stepId: currentStepId }
    );
  }
  throw new Error(`Tour did not complete within ${maximumSteps} steps`);
}

async function openLoginWithoutCompletedTour(page: Page): Promise<void> {
  await page.goto("/login");
  await page.evaluate(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("decision-passport:onboarding:")) localStorage.removeItem(key);
    }
  });
  await page.reload();
}

async function loginAs(page: Page, name: string, keepDashboardTour = true): Promise<void> {
  await skipTour(page);
  await page.getByRole("button", { name: new RegExp(`Войти как ${name}`) }).click();
  await page.waitForURL("**/dashboard");
  if (keepDashboardTour) await expectTour(page);
  else {
    await expectTour(page);
    await skipTour(page);
  }
}

test.beforeEach(async ({ page }) => {
  await openLoginWithoutCompletedTour(page);
});

test("1 · login и dashboard инициатора запускают page tour автоматически", async ({ page }) => {
  const loginTour = await expectTour(page);
  await expect(loginTour.getByRole("heading", { name: "Добро пожаловать в DecisionPassport" })).toBeVisible();
  await loginAs(page, "Динара Ахметова");
  await page.locator(TOUR).getByRole("button", { name: "Далее" }).click();
  await expect(page.locator(TOUR).getByText("Очередь подготовки вопроса", { exact: true })).toBeVisible();
});

test("2 · после dashboard новая страница получает собственную инструкцию", async ({ page }) => {
  await loginAs(page, "Динара Ахметова");
  await completeTour(page);
  await page.goto("/decisions");
  const registryTour = await expectTour(page);
  await expect(registryTour.getByText("Реестр управленческих решений", { exact: true })).toBeVisible();
});

test("3 · завершённый dashboard не запускается повторно", async ({ page }) => {
  await loginAs(page, "Динара Ахметова");
  await completeTour(page);
  await page.goto("/decisions");
  await skipTour(page);
  await page.goto("/dashboard");
  await expect(page.locator(TOUR)).toBeHidden({ timeout: 1_200 });
});

test("4 · обучение текущей страницы можно повторить из центра помощи", async ({ page }) => {
  await loginAs(page, "Динара Ахметова");
  await completeTour(page);
  await page.getByRole("button", { name: "Открыть центр обучения" }).click();
  await page.getByRole("button", { name: "Обучение по этой странице" }).click();
  await expectTour(page);
});

test("5 · владелец данных получает собственную очередь ответственности", async ({ page }) => {
  await loginAs(page, "Ержан Смагулов");
  const tour = await expectTour(page);
  await tour.getByRole("button", { name: "Далее" }).click();
  await expect(tour.getByText("Очередь подтверждения данных", { exact: true })).toBeVisible();
  await expect(tour).toContainText("источника, актуальности и владельца");
});

test("6 · член Совета директоров видит Human-in-the-loop на AI-вкладке", async ({ page }) => {
  await loginAs(page, "Нурлан Абишев", false);
  await page.goto("/decisions");
  await skipTour(page);
  const href = await page.getByRole("link", { name: "INV-2026-001", exact: true }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(`${href}?tab=ai`);
  const tour = await expectTour(page);
  await expect(tour).toContainText(/ИИ|модел/i);
  for (let index = 0; index < 6; index += 1) {
    if (await tour.getByText(/не применена/i).isVisible().catch(() => false)) break;
    await advanceTour(page, tour);
  }
  await expect(tour).toContainText(/не применена|человеческ/i);
});

test("7 · администратор получает tour конфигурации, а не бизнес-решения", async ({ page }) => {
  await loginAs(page, "Администратор", false);
  await page.goto("/admin");
  const tour = await expectTour(page);
  await expect(tour).toContainText(/Администрирование цифрового контура/i);
  await expect(tour).toContainText(/роль|пользовател/i);
});

test("8 · отсутствующий target диагностируется и безопасно пропускается", async ({ page }) => {
  await loginAs(page, "Динара Ахметова");
  await page.evaluate(() => {
    window.addEventListener("onboarding:missing-target", () => {
      document.body.dataset.onboardingMissingObserved = "true";
    });
    document.querySelector('[data-tour="dashboard-action-queue"]')?.removeAttribute("data-tour");
  });
  await page.locator(TOUR).getByRole("button", { name: "Далее" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-onboarding-missing-observed", "true");
  await expect(page.locator(TOUR)).toContainText(/Уровень A/);
});

test("9 · role tour сохраняется при переходе между маршрутами", async ({ page }) => {
  await loginAs(page, "Динара Ахметова");
  await skipTour(page);
  await page.getByRole("button", { name: "Открыть центр обучения" }).click();
  await page.getByRole("button", { name: "Экскурсия по моей роли" }).click();
  const tour = await expectTour(page);
  const startingUrl = page.url();
  for (let index = 0; index < 10 && page.url() === startingUrl; index += 1) {
    await advanceTour(page, tour);
  }
  await expect(page).not.toHaveURL(startingUrl);
  await expectTour(page);
});

test("10 · coach card остаётся внутри viewport 1366×768", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const tour = await expectTour(page);
  const bounds = await tour.getByRole("dialog").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1366);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(768);
});

test("11 · jury tour продолжается после реального выбора произвольной роли", async ({ page }) => {
  await skipTour(page);
  await page.getByRole("button", { name: "Открыть центр обучения" }).click();
  await page.getByRole("button", { name: "Демонстрация научной модели" }).click();

  const tour = await expectTour(page);
  await expect(tour.getByRole("heading", { name: "Зачем создан DecisionPassport" })).toBeVisible();
  await advanceTour(page, tour);
  await expect(tour.getByRole("heading", { name: "Посмотрите на одну базу через выбранную роль" })).toBeVisible();

  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /Войти как Динара Ахметова/);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /Войти как Тимур Бекетов/);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/dashboard");
  await expectTour(page);
  await expect(page.locator(TOUR)).toContainText("Портфель показывает состояние решений");
});

test("12 · spotlight и coach card корректны во всей обязательной viewport-матрице", async ({ page }) => {
  const tour = await expectTour(page);
  await advanceTour(page, tour);
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const dialog = page.locator(TOUR).getByRole("dialog");
    const spotlight = page.getByTestId("onboarding-spotlight");
    const dimmer = page.getByTestId("onboarding-dimmer");
    await expect(dialog).toBeVisible();
    await expect(spotlight).toBeVisible();
    await expect(dimmer).toHaveCSS("background-color", "rgba(16, 25, 28, 0.72)");
    await expect(spotlight).toHaveCSS("border-top-width", "3px");
    await expect(spotlight).toHaveCSS("outline-width", "2px");
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return Boolean(
          box &&
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width &&
            box.y + box.height <= viewport.height
        );
      })
      .toBe(true);
    const [dialogBox, spotlightBox] = await Promise.all([
      dialog.boundingBox(),
      spotlight.boundingBox(),
    ]);
    expect(dialogBox, `dialog ${viewport.width}×${viewport.height}`).not.toBeNull();
    expect(spotlightBox, `spotlight ${viewport.width}×${viewport.height}`).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height);
    expect(spotlightBox!.width).toBeGreaterThan(8);
    expect(spotlightBox!.height).toBeGreaterThan(8);
  }

  await page.keyboard.press("Escape");
  await expect(page.locator(TOUR)).toBeHidden();
});

test("13 · отдельный page tour открывается для блока пост-оценки", async ({ page }) => {
  await loginAs(page, "Динара Ахметова", false);
  await page.goto("/decisions");
  await skipTour(page);
  const decisionHref = await page
    .getByRole("link", { name: "INV-2026-001", exact: true })
    .first()
    .getAttribute("href");
  expect(decisionHref).toBeTruthy();

  await page.goto(`${decisionHref}?tab=passport&block=POST_EVALUATION`);
  const tour = await expectTour(page);
  await expect(tour).toHaveAttribute(
    "data-tour-id",
    "page-decision-post-evaluation:workspace"
  );
  await expect(tour).toContainText("Plan → Actual → Deviation → Cause → Lesson");
  await advanceTour(page, tour);
  await expect(tour).toHaveAttribute("data-tour-id", "page-decision-post-evaluation:plan");
  await expect(page.locator('[data-tour="post-evaluation-plan-fact"]')).toBeVisible();
});

test("14 · отдельная экскурсия показывает три природы evidence", async ({ page }) => {
  await loginAs(page, "Алия Нурланова", false);
  await page.getByRole("button", { name: "Открыть центр обучения" }).click();
  await page
    .getByRole("button", { name: "Факт, прогноз и допущение — три природы evidence" })
    .click();

  await page.waitForURL("**/indicators");
  const tour = await expectTour(page);
  await expect(tour).toHaveAttribute("data-tour-id", "thesis-evidence-natures:legend");
  await expect(tour).toContainText(/факт, прогноз и допущение/i);
});
