import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
] as const;

const PASSPORT_TABS = [
  "passport",
  "alternatives",
  "risks",
  "economics",
  "assignments",
  "ai",
  "audit",
] as const;

interface OverflowMeasurement {
  htmlScrollWidth: number;
  htmlClientWidth: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
}

async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}

async function assertPageFrame({
  page,
  route,
  viewport,
  overflowFailures,
  heading,
}: {
  page: Page;
  route: string;
  viewport: (typeof VIEWPORTS)[number];
  overflowFailures: string[];
  heading?: string | RegExp;
}): Promise<void> {
  const context = `${route} @ ${viewport.width}×${viewport.height}`;
  const main = page.getByRole("main");
  await expect(main, `${context}: main landmark`).toBeVisible();

  const keyHeading = heading
    ? main.getByRole("heading", { level: 1, name: heading }).first()
    : main.getByRole("heading", { level: 1 }).first();
  await expect(keyHeading, `${context}: key h1`).toBeVisible();

  await settleLayout(page);
  const measurement = await page.evaluate<OverflowMeasurement>(() => ({
    htmlScrollWidth: document.documentElement.scrollWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));

  const htmlDelta = measurement.htmlScrollWidth - measurement.htmlClientWidth;
  const bodyDelta = measurement.bodyScrollWidth - measurement.bodyClientWidth;
  if (htmlDelta > 0 || bodyDelta > 0) {
    const actualUrl = `${new URL(page.url()).pathname}${new URL(page.url()).search}`;
    overflowFailures.push(
      `${context} (actual ${actualUrl}): ` +
        `html ${measurement.htmlScrollWidth}/${measurement.htmlClientWidth} (+${htmlDelta}px), ` +
        `body ${measurement.bodyScrollWidth}/${measurement.bodyClientWidth} (+${bodyDelta}px)`
    );
  }
}

async function visitAndAssert({
  page,
  route,
  viewport,
  overflowFailures,
  heading,
}: {
  page: Page;
  route: string;
  viewport: (typeof VIEWPORTS)[number];
  overflowFailures: string[];
  heading?: string | RegExp;
}): Promise<void> {
  await page.goto(route);
  await assertPageFrame({ page, route, viewport, overflowFailures, heading });
}

async function loginAs(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`Войти как ${name}`) }).click();
  await page.waitForURL("**/dashboard");
}

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.waitForURL("**/login");
}

for (const viewport of VIEWPORTS) {
  test(`нет page-level overflow на ${viewport.width}×${viewport.height}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize(viewport);
    const overflowFailures: string[] = [];

    // Login проверяется отдельно, до появления application shell.
    await visitAndAssert({
      page,
      route: "/login",
      viewport,
      overflowFailures,
      heading: "Качество корпоративного решения — управляемый контур",
    });

    // Board authority: executive cockpit, portfolio and every decision workspace.
    await loginAs(page, "Нурлан Абишев");
    await assertPageFrame({
      page,
      route: "/dashboard",
      viewport,
      overflowFailures,
      heading: "Контур управленческих решений",
    });
    await visitAndAssert({
      page,
      route: "/decisions",
      viewport,
      overflowFailures,
      heading: "Реестр решений",
    });

    const decisionHref = await page
      .getByRole("main")
      .getByRole("link", { name: "INV-2026-001", exact: true })
      .first()
      .getAttribute("href");
    expect(decisionHref, `/decisions @ ${viewport.width}×${viewport.height}: decision link`).toBeTruthy();

    await page.goto(decisionHref!);
    const decisionTitle = (await page.getByRole("main").getByRole("heading", { level: 1 }).first().innerText()).trim();
    await assertPageFrame({
      page,
      route: decisionHref!,
      viewport,
      overflowFailures,
      heading: decisionTitle,
    });
    const decisionPath = new URL(page.url()).pathname;

    for (const tab of PASSPORT_TABS) {
      await visitAndAssert({
        page,
        route: `${decisionPath}?tab=${tab}`,
        viewport,
        overflowFailures,
        heading: decisionTitle,
      });
    }

    // Admin authority: data, analytics, learning, audit and governance routes.
    await logout(page);
    await loginAs(page, "Администратор");

    await visitAndAssert({
      page,
      route: "/indicators",
      viewport,
      overflowFailures,
      heading: "Каталог показателей",
    });
    const indicatorHref = await page
      .getByRole("main")
      .getByRole("link", { name: "URN-PROD", exact: true })
      .first()
      .getAttribute("href");
    expect(indicatorHref, `/indicators @ ${viewport.width}×${viewport.height}: indicator link`).toBeTruthy();
    await visitAndAssert({
      page,
      route: indicatorHref!,
      viewport,
      overflowFailures,
    });

    const adminRoutes: Array<{ route: string; heading: string }> = [
      { route: "/kpi", heading: "Эффект цифрового контура" },
      { route: "/models", heading: "Реестр моделей ИИ" },
      { route: "/lessons", heading: "Журнал и база уроков" },
      { route: "/boards?panel=risk", heading: "Ролевые контуры" },
      { route: "/roadmap", heading: "Трансформационная дорожная карта" },
      { route: "/audit", heading: "Аудит" },
      { route: "/admin", heading: "Администрирование" },
    ];

    for (const destination of adminRoutes) {
      await visitAndAssert({
        page,
        route: destination.route,
        viewport,
        overflowFailures,
        heading: destination.heading,
      });
    }

    expect(
      overflowFailures,
      `Page-level horizontal overflow:\n${overflowFailures.join("\n")}`
    ).toEqual([]);
  });
}
