# DecisionPassport 3.0 — Visual QA

Дата проверки: 02.09.2026.

## Статус проверки

Кодовая responsive/accessibility-ревизия завершена. Автоматический Chromium-прогон открыл 20
маршрутов и состояний во всех шести заданных viewport-ах (120 проверок), подтвердил наличие главного
landmark/заголовка и отсутствие page-level horizontal overflow. Pixel-level проверка и golden
screenshots пока заблокированы инфраструктурой: список backend-ов встроенного браузера пуст.
`AUTO` не заменяет визуальную оценку кадра и не засчитывается как screenshot PASS.

Легенда:

- `PASS` — проверено фактически;
- `AUTO` — реальный Chromium проверил route, viewport, landmark и page-level overflow;
- `CODE` — проверены структура, breakpoint-правила и локализация overflow, но не пиксельный рендер;
- `BROWSER` — требуется реальный viewport и screenshot;
- `—` — проверка ещё не завершена.

## Матрица экранов и разрешений

| Экран | 1920×1080 | 1600×900 | 1440×900 | 1366×768 | 1280×800 | 1024×768 | Иерархия | Overflow | Итог |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Login | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Executive dashboard | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Реестр решений | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Паспорт — overview | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Паспорт — gate blocked | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Alternatives workspace | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Risk decision view | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| AI + human verdict | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Indicator catalog | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Indicator lineage | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| KPI before/after | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Maturity continuum | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Transformation roadmap | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Audit timeline | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Role dashboards | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| AI model governance | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Learning loop | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |
| Governance admin | AUTO | AUTO | AUTO | AUTO | AUTO | AUTO | CODE | PASS | ожидает screenshot |

## Автоматический responsive pass

- Команда: `npx playwright test e2e/responsive.spec.ts`.
- Матрица: 6 viewport-ов × 20 маршрутов/состояний = 120 проверок.
- Эталонный паспорт: `INV-2026-001`; lineage: `URN-PROD`; ролевая панель: risk.
- Проверяется: загрузка маршрута, видимость `main` и `h1`, равенство `scrollWidth` и
  `clientWidth` у `html`/`body`.
- Локальные широкие таблицы и process rails могут прокручиваться внутри своего контейнера.
- В первом прогоне на 1024 px найдены и устранены два источника overflow: скрытая подпись крайнего
  столбца поручений (+6 px) и четырёхколоночный фильтр базы уроков (+30 px).

## Golden set manifest

Файлы должны находиться в `.artifacts/ui-final/` и сниматься после сброса к эталонным seed-данным.

| Файл | Маршрут / состояние | Главный объект кадра |
| --- | --- | --- |
| `01-login.png` | `/login` | модель контура и выбор роли |
| `02-dashboard.png` | `/dashboard` | управленческая ситуация и Decision Flow |
| `03-decisions.png` | `/decisions` | operational registry с gate и ответственным |
| `04-passport-overview.png` | `/decisions/[A-level]` | Decision Control Header + lifecycle + evidence index |
| `05-passport-gate-blocked.png` | закрытый gate | недостающие evidence, владелец, deep link |
| `06-alternatives.png` | `?tab=alternatives` | comparison workspace и отдельное решение человека |
| `07-risk-profile.png` | `?tab=risks` | initial → control → residual |
| `08-ai-human-verdict.png` | `?tab=ai` | ограниченная рекомендация и доминирующий human verdict |
| `09-indicator-lineage.png` | `/indicators/[id]` | source → integration → evidence → decision → authority |
| `10-kpi-before-after.png` | `/kpi` | сопоставимые baseline → pilot |
| `11-maturity.png` | `/kpi` | maturity continuum 1–5 с периодом и выборкой |
| `12-roadmap-gate.png` | `/roadmap` | KPI-gate и разрыв до порога |
| `13-audit.png` | `/audit` | человекочитаемая audit timeline |
| `14-role-dashboard.png` | `/boards?panel=risk` | ответственность панели и residual exposure |

## Критика каждого кадра

Для каждого golden screenshot необходимо зафиксировать ответы:

1. Что является главным объектом и считывается ли он за три секунды?
2. Остался ли generic admin pattern или лишняя рамка?
3. Можно ли убрать элемент без потери управленческого смысла?
4. Видны ли текущий ответственный и препятствие следующему шагу?
5. Различены ли факт, прогноз и допущение не только цветом?
6. Ясно ли, что gate проверяет evidence, а решение принимает человек?
7. Нет ли глобального horizontal overflow, обрезанных подписей или невидимых действий?

Если два и более ответа неудовлетворительны, экран не получает PASS и переделывается до повторного
снимка.

## Кодовые проверки responsive и accessibility

- Общая страница не должна иметь горизонтальный scroll; широкие реестры и матрицы используют
  локальный `overflow-x-auto`.
- На 1024 px evidence index и stage rail переходят в горизонтально управляемый локальный режим.
- На 1366×768 после context bar видны заголовок и начало содержательного объекта, а не только hero.
- Основной текст — 14–16 px, metadata — 12 px; 10/11 px не используются.
- Все интерактивные элементы доступны с клавиатуры и имеют заметный `focus-visible`.
- A/B/C различаются заливкой, толщиной контура и текстовой меткой.
- Fact / forecast / assumption различаются типом рамки, паттерном и текстом.
- Raw JSON находится только внутри закрытого `details` технической записи.
- `prefers-reduced-motion` отключает необязательные transitions.

## Условия закрытия QA

Матрица может быть переведена в PASS только после подключения встроенного браузера, проверки всех
шести viewport-ов, сохранения 14 PNG и повторной критики каждого кадра. До этого визуальная часть
Definition of Done остаётся открытой независимо от результатов TypeScript, ESLint, unit, E2E и build.

## Финальная техническая верификация

- `npm run typecheck` — PASS.
- `npm run lint` — PASS, без warnings.
- `npm run test` — PASS, 4 файла / 77 тестов.
- `npx playwright test` — PASS, 9 тестов: полный lifecycle, AI human-in-the-loop, KPI и шесть
  responsive viewport-ов.
- `npm run build` — PASS, production build Next.js 15.1.6.
- После E2E демо-база восстановлена командой `npm run seed`: 9 пользователей, 12 решений,
  20 показателей.
