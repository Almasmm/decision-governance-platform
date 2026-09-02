import { expect, test, type Locator, type Page } from "@playwright/test";

const ONBOARDING_STORAGE_PREFIX = "decision-passport:onboarding:";
const ACTIVE_TOUR_SESSION_KEY = "decision-passport:onboarding:active-tour";
const TOUR = '[data-testid="onboarding-tour"]';
const SCREENSHOT_DIRECTORY = ".artifacts/onboarding-final";

const SCREENSHOTS = [
  "01-login-welcome.png",
  "02-login-role-model.png",
  "03-initiator-dashboard.png",
  "04-data-owner-dashboard.png",
  "05-risk-officer-dashboard.png",
  "06-analyst-dashboard.png",
  "07-secretary-dashboard.png",
  "08-board-dashboard.png",
  "09-admin-dashboard.png",
  "10-decision-passport.png",
  "11-decision-gate.png",
  "12-alternatives.png",
  "13-data-lineage.png",
  "14-ai-human-verdict.png",
  "15-kpi-baseline-pilot.png",
  "16-roadmap-gate.png",
  "17-audit.png",
  "18-jury-tour.png",
] as const;

type ScreenshotName = (typeof SCREENSHOTS)[number];

const DASHBOARD_CAPTURES: ReadonlyArray<{
  userName: string;
  stepId: string;
  screenshot: ScreenshotName;
}> = [
  {
    userName: "Динара Ахметова",
    stepId: "page-dashboard-initiator:responsibility",
    screenshot: "03-initiator-dashboard.png",
  },
  {
    userName: "Ержан Смагулов",
    stepId: "page-dashboard-data-owner:responsibility",
    screenshot: "04-data-owner-dashboard.png",
  },
  {
    userName: "Тимур Бекетов",
    stepId: "page-dashboard-risk-officer:responsibility",
    screenshot: "05-risk-officer-dashboard.png",
  },
  {
    userName: "Алия Нурланова",
    stepId: "page-dashboard-analyst:responsibility",
    screenshot: "06-analyst-dashboard.png",
  },
  {
    userName: "Сауле Жумабаева",
    stepId: "page-dashboard-secretary:responsibility",
    screenshot: "07-secretary-dashboard.png",
  },
  {
    userName: "Нурлан Абишев",
    stepId: "page-dashboard-board-member:responsibility",
    screenshot: "08-board-dashboard.png",
  },
  {
    userName: "Администратор",
    stepId: "page-dashboard-admin:responsibility",
    screenshot: "09-admin-dashboard.png",
  },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForTour(page: Page): Promise<Locator> {
  const tour = page.locator(TOUR);
  await expect(tour).toBeVisible({ timeout: 10_000 });
  await expect(tour.getByRole("dialog")).toHaveCSS("opacity", "1");
  return tour;
}

async function settleVisualState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });

  const tour = page.locator(TOUR);
  if (await tour.isVisible().catch(() => false)) {
    await expect(tour.getByRole("dialog")).toHaveCSS("opacity", "1");
    await expect(tour.locator("[data-tour-step-content]")).toBeVisible();
    // Let smooth scroll and the 260 ms spotlight/card transitions reach their final geometry.
    await page.waitForTimeout(450);
  }
}

async function advanceTourToStep(
  page: Page,
  expectedStepId: string,
  maximumSteps = 24
): Promise<Locator> {
  const tour = await waitForTour(page);

  for (let index = 0; index < maximumSteps; index += 1) {
    const currentStepId = await tour.getAttribute("data-tour-id");
    if (currentStepId === expectedStepId) {
      await settleVisualState(page);
      return tour;
    }

    const next = tour.getByRole("button", { name: "Далее", exact: true });
    if (!(await next.isVisible().catch(() => false))) {
      throw new Error(
        `Tour ended at "${currentStepId ?? "unknown"}" before reaching "${expectedStepId}".`
      );
    }

    await next.click();
    await expect
      .poll(async () => {
        if (!(await tour.isVisible().catch(() => false))) return "tour-closed";
        return (await tour.getAttribute("data-tour-id")) ?? "missing-step-id";
      })
      .not.toBe(currentStepId);
  }

  throw new Error(`Tour did not reach "${expectedStepId}" within ${maximumSteps} steps.`);
}

async function skipTourIfPresent(page: Page, waitForAppearance = false): Promise<void> {
  const tour = page.locator(TOUR);
  const visible = waitForAppearance
    ? await tour
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false)
    : await tour.isVisible().catch(() => false);

  if (!visible) return;

  await tour.getByRole("button", { name: "Пропустить", exact: true }).click();
  await expect(tour).toBeHidden();
  await expect(tour).not.toBeAttached();
}

async function clearOnlyOnboardingProgress(page: Page): Promise<void> {
  await page.goto("/login");
  await page.evaluate((prefix) => {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }, ONBOARDING_STORAGE_PREFIX);
  await page.reload();
}

async function loginAs(page: Page, userName: string): Promise<void> {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await skipTourIfPresent(page);

  const loginButton = page.getByRole("button", {
    name: new RegExp(`^Войти как ${escapeRegExp(userName)}(?:,|$)`),
  });
  await expect(loginButton).toBeVisible();
  await loginButton.click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("main")).toBeVisible();
}

async function logout(page: Page): Promise<void> {
  await skipTourIfPresent(page);
  const button = page.getByRole("button", { name: "Выйти", exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await page.waitForURL("**/login");
  await expect(page.getByRole("main")).toBeVisible();
}

async function discoverSeedRoutes(
  page: Page
): Promise<{ decisionPath: string; indicatorPath: string }> {
  await loginAs(page, "Администратор");
  await skipTourIfPresent(page, true);

  await page.goto("/decisions");
  await expect(page.getByRole("heading", { level: 1, name: "Реестр решений" })).toBeVisible();
  await skipTourIfPresent(page, true);
  const decisionHref = await page
    .getByRole("main")
    .getByRole("link", { name: "INV-2026-001", exact: true })
    .first()
    .getAttribute("href");
  expect(decisionHref, "Seed decision INV-2026-001 must be present").toBeTruthy();

  await page.goto("/indicators");
  await expect(
    page.getByRole("heading", { level: 1, name: "Каталог показателей" })
  ).toBeVisible();
  await skipTourIfPresent(page, true);
  const indicatorHref = await page
    .getByRole("main")
    .getByRole("link", { name: "URN-PROD", exact: true })
    .first()
    .getAttribute("href");
  expect(indicatorHref, "Seed indicator URN-PROD must be present").toBeTruthy();

  await logout(page);
  return {
    decisionPath: new URL(decisionHref!, page.url()).pathname,
    indicatorPath: new URL(indicatorHref!, page.url()).pathname,
  };
}

test.use({
  viewport: { width: 1440, height: 900 },
  colorScheme: "light",
  reducedMotion: "reduce",
});

test("создаёт 18 эталонных PNG guided onboarding без изменения бизнес-данных", async ({
  page,
}) => {
  test.setTimeout(900_000);
  expect(SCREENSHOTS, "Golden screenshot contract must contain exactly 18 PNG files").toHaveLength(
    18
  );

  let captureIndex = 0;
  const capture = async (name: ScreenshotName): Promise<void> => {
    expect(name, "Screenshot sequence must match the 18-file acceptance contract").toBe(
      SCREENSHOTS[captureIndex]
    );
    await settleVisualState(page);
    await page.screenshot({
      path: `${SCREENSHOT_DIRECTORY}/${name}`,
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      scale: "css",
    });
    captureIndex += 1;
  };

  // Login: introduction and the shared role model.
  await clearOnlyOnboardingProgress(page);
  await advanceTourToStep(page, "page-login:welcome");
  await capture("01-login-welcome.png");
  await advanceTourToStep(page, "page-login:roles");
  await capture("02-login-role-model.png");
  await skipTourIfPresent(page);

  // Role-aware dashboard: the same evidence base, seven distinct responsibilities.
  for (const scenario of DASHBOARD_CAPTURES) {
    await loginAs(page, scenario.userName);
    await advanceTourToStep(page, scenario.stepId);
    await capture(scenario.screenshot);
    await skipTourIfPresent(page);
    await logout(page);
  }

  // Resolve stable seeded objects through the real registries; database ids stay opaque.
  const { decisionPath, indicatorPath } = await discoverSeedRoutes(page);

  // The central decision dossier and its gate are shown from the initiator's perspective.
  await loginAs(page, "Динара Ахметова");
  await skipTourIfPresent(page);
  await page.goto(`${decisionPath}?tab=passport`);
  await advanceTourToStep(page, "page-decision-passport:header");
  await capture("10-decision-passport.png");
  await advanceTourToStep(page, "page-decision-passport:gate");
  await capture("11-decision-gate.png");
  await skipTourIfPresent(page);

  await page.goto(`${decisionPath}?tab=alternatives`);
  await advanceTourToStep(page, "page-decision-alternatives:status-quo");
  await capture("12-alternatives.png");
  await skipTourIfPresent(page);
  await logout(page);

  // Data lineage is captured under the actual owner-of-data role.
  await loginAs(page, "Ержан Смагулов");
  await skipTourIfPresent(page);
  await page.goto(indicatorPath);
  await advanceTourToStep(page, "page-indicator-detail:lineage");
  await capture("13-data-lineage.png");
  await skipTourIfPresent(page);
  await logout(page);

  // Human-in-the-loop is demonstrated under the authority that may issue the verdict.
  await loginAs(page, "Нурлан Абишев");
  await skipTourIfPresent(page);
  await page.goto(`${decisionPath}?tab=ai`);
  await advanceTourToStep(page, "page-decision-ai:human-verdict");
  await capture("14-ai-human-verdict.png");
  await skipTourIfPresent(page);
  await logout(page);

  // Measurement methodology is shown under the analyst role.
  await loginAs(page, "Алия Нурланова");
  await skipTourIfPresent(page);
  await page.goto("/kpi");
  await advanceTourToStep(page, "page-kpi:baseline");
  await capture("15-kpi-baseline-pilot.png");
  await skipTourIfPresent(page);
  await logout(page);

  // Transformation governance uses ADMIN, while audit uses the route-control role.
  await loginAs(page, "Администратор");
  await skipTourIfPresent(page);
  await page.goto("/roadmap");
  await advanceTourToStep(page, "page-roadmap:gate");
  await capture("16-roadmap-gate.png");
  await skipTourIfPresent(page);
  await logout(page);

  await loginAs(page, "Сауле Жумабаева");
  await skipTourIfPresent(page);
  await page.goto("/audit");
  await advanceTourToStep(page, "page-audit:timeline");
  await capture("17-audit.png");
  await skipTourIfPresent(page);
  await logout(page);

  // Verify the jury can launch the methodology from the unauthenticated help centre.
  await skipTourIfPresent(page);
  await page.getByRole("button", { name: "Открыть центр обучения" }).click();
  const trainingCenter = page.getByRole("dialog", { name: "Обучение DecisionPassport" });
  await expect(trainingCenter).toBeVisible();
  await trainingCenter
    .getByRole("button", {
      name: /^(Демонстрация научной модели|Экскурсия по методике)$/,
    })
    .click();
  const launchedThesisTour = await waitForTour(page);
  await expect(launchedThesisTour).toHaveAttribute(
    "data-tour-id",
    "thesis-jury-methodology:purpose"
  );
  await skipTourIfPresent(page);

  // Restore the same cross-route tour on its final step after a real role login.
  // GUEST is intentional: it exercises the supported jury role-handoff contract.
  await loginAs(page, "Нурлан Абишев");
  await page.evaluate(
    ({ storageKey, session }) => {
      window.sessionStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      storageKey: ACTIVE_TOUR_SESSION_KEY,
      session: {
        tourId: "thesis-jury-methodology",
        tourVersion: 1,
        stepId: "thesis-jury-methodology:complete",
        userId: "jury-demo-guest",
        role: "GUEST",
      },
    }
  );
  await page.reload();

  const finalTour = await advanceTourToStep(
    page,
    "thesis-jury-methodology:complete"
  );
  await expect(
    finalTour.getByRole("button", { name: "Открыть платформу самостоятельно" })
  ).toBeVisible();
  await expect(
    finalTour.getByRole("button", { name: "Повторить экскурсию" })
  ).toBeVisible();
  await expect(
    finalTour.getByRole("button", { name: "Выбрать другую роль" })
  ).toBeVisible();
  await capture("18-jury-tour.png");

  expect(captureIndex, "All and only the 18 required PNG files must be generated").toBe(
    SCREENSHOTS.length
  );
});
