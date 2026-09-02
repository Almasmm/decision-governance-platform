# VISUAL AUDIT — DecisionPassport 2.x

Дата аудита: 2 сентября 2026 года. Аудит выполнен до проектирования DecisionPassport 3.0.

## Метод и ограничение baseline

Проверены реальные JSX-композиции, CSS, дизайн-токены, UI-примитивы, демо-данные и бизнес-состояния всех основных маршрутов. Локальное приложение отвечает на `http://localhost:3000`, однако управляемый браузер в текущей среде не предоставлен (`No browser is available`). Поэтому baseline-скриншоты технически заблокированы; скриншотный проход остаётся обязательным gate финального QA.

## Вердикт

Текущий слой представления следует заменить, а не улучшать локально. Он организован как функционально полная enterprise-админка в метафоре «электронного регламента»: тёплая бумага, serif-заголовки, мелкие подписи, рамочные панели и постоянный sidebar.

Статический срез подтверждает плоскость системы: 59 экземпляров `<Card>`, 304 применения 12px `text-meta` и 17 таблиц. Почти каждый маршрут повторяет `заголовок → пояснение → grid/cards/table`. Главный объект — качество решения и его доказательная база — не доминирует ни на dashboard, ни в паспорте.

## Системные дефекты

1. **Неверная продуктовая метафора.** Старый `DESIGN.md` прямо закрепляет «регламент, а не продуктовый дашборд» и Cambria для заголовков. Это противоречит Executive Decision Intelligence Platform.
2. **Chrome сильнее решения.** `app/(app)/layout.tsx` строит узнаваемый ERP-sidebar. Он не показывает текущий контекст, стадию, gate или ответственность пользователя.
3. **Равный вес неравных объектов.** Один `Card` используется для gate, аналитики, формы, справки и реестра; рамка стала универсальным способом композиции.
4. **Мелкая управленческая типографика.** 12px применяется не только к metadata, но и к причинам блокировки, ответственности, статусам и описаниям.
5. **Смысл спрятан в badges.** A/B/C, статус, отсутствие доказательств, природа данных и служебные пометки конкурируют в одной строке мелких меток.
6. **Lifecycle не является позвоночником.** Семь стадий представлены 12px wrap-stepper, на dashboard — обычным horizontal bar chart без переходов и bottleneck.
7. **Не виден следующий ответственный.** Роли существуют в данных, но композиция не отвечает за три секунды на вопрос «кто должен сделать следующий шаг?».
8. **Technical payload видим пользователю.** Dashboard и audit показывают raw `action/entity/before/after`; indicator печатает `JSON.stringify(qualityRules)`.
9. **Responsive-конфликт на 1024 px.** `lg` одновременно раскрывает 232px sidebar и включает многоколоночные desktop-сетки, оставляя паспорту и аналитике около 752px.

## Аудит по экранам

| Экран | Текущая композиция | Главный дефект | Требуемый сдвиг |
| --- | --- | --- | --- |
| `/login` | заголовок + сетка одинаковых ролей + форма | объясняет аккаунты, а не модель продукта | lifecycle-обещание + роли по этапам ответственности |
| `/dashboard` | ровно 5 `StatTile` → 2 cards → лента | буквальный dashboard-template | executive situation + action queue + единый Decision Flow |
| `/decisions` | filter-card + table-card | нет `GATE`, current owner и ясного blocked state | operational registry с CODE/TITLE/A-B-C/STAGE/GATE/OWNER/BODY/DEADLINE/STATUS |
| `/decisions/[id]` | header-card + tabs + 240px blocks + gate-card | паспорт ощущается формой; gate вторичен | Decision Control Header + Stage Rail + Evidence Index + Gate Control Center |
| Alternatives | таблица + radar + формы | сравнение раздроблено; model recommendation и human selection не разведены | единый comparison workspace и отдельные authority zones |
| Risks | две heatmap + таблица | `INITIAL → CONTROL → RESIDUAL` разорвано | управленческая история каждого риска с owner, trigger и mitigation |
| AI | bot-banner + 3 tier-cards + suggestions | ассоциация с chatbot; human verdict вложен и слабее recommendation | AI Analysis Workspace; вердикт человека — кульминация |
| `/indicators` | 4 stat tiles + filter + table | CRUD-каталог | operational data catalog с quality, owner и freshness |
| `/indicators/[id]` | metadata cards + маленький SVG + chart/table | lineage — приложение; виден raw JSON | lineage как главный доказательный путь с status/date/owner/version |
| `/kpi` | sample cards + общий bar chart + tables/cards | baseline→pilot раздроблен; разные единицы на одной оси | парные measures с n, period, absolute delta, comparability |
| Maturity | число + пять прямоугольников | не читается позиция на continuum | непрерывная шкала 1–5 и обязательный контекст пилота |
| `/models` | сетка одинаковых model-cards | каталог без governance trajectory | registry: validation, scope, owner, limits, next review |
| `/lessons` | 4 stat tiles + filters + lesson cards | архив, а не feedback loop | plan → fact → cause → reusable lesson |
| `/boards` | tabs + 4 cards + generic table | роли меняют фильтр, а не управленческую линзу | strategy / investment / production / risk views над единым набором решений |
| `/roadmap` | вертикальная стена 4 cards + risk table | не видны пороги перехода | горизонтальный transformation rail с KPI-gates |
| `/audit` | 4 stat tiles + filter + raw table | developer log | человекочитаемая timeline; raw data только в disclosure |
| `/admin` | table/form cards | допустимый CRUD, но raw rule доминирует | компактный control workspace с объяснением governance effect |

## Что сохраняется

- стадии, роли, A/B/C и gate rules;
- паспорт как единый метаобъект;
- provenance как доказательство;
- различение факта, прогноза и допущения;
- KPI baseline/pilot и методика зрелости;
- human-in-the-loop, мотивировка, RBAC и audit trail;
- server actions, формулы и Prisma-модель.

## Baseline-критерий отказа

Если после редизайна убрать логотип и экран всё ещё можно принять за CRM, ERP или обычный BI-dashboard, направление провалено. Новый экран обязан одновременно показывать lifecycle, качество доказательств, ответственность, gate и границу между рекомендацией и человеческим решением.
