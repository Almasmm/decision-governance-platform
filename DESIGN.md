# DESIGN — DecisionPassport 3.0

Визуальная система Executive Decision Intelligence Platform. Документ заменяет отвергнутую метафору «бумажного регламента».

## 1. Продуктовая ось

Главный объект — управленческое решение и качество его доказательной базы.

**Проблема → Данные → Альтернативы → Риски → Решение → Исполнение → Обратная связь**

Gate располагается между стадиями. Он проверяет готовность доказательств, но не принимает решение. Authority всегда остаётся у человека или уполномоченного органа.

## 2. Два масштаба и четыре контура

### Portfolio scale — Executive Decision Cockpit

Показывает активные решения, action debt, заблокированные gates, A-level attention, bottlenecks и здоровье процесса.

### Decision scale — Evidence Dossier

Показывает предмет решения, lifecycle, readiness, evidence index, gaps, alternatives, risk, AI analysis, human verdict, execution и lesson.

### Четыре контура

Контуры не кодируются четырьмя декоративными цветами. Они выражены устойчивыми зонами:

- нормативно-процессный: stage rail, полномочия, criticality, gate rules;
- информационный: evidence index, indicator, source, quality, owner, lineage;
- аналитико-интеллектуальный: comparison, calculation, scenarios, model, recommendation;
- контрольный: human verdict, assignments, KPI, audit, post-evaluation.

## 3. Визуальный характер

Executive, precise, controlled, high-stakes, evidence-based, modern industrial, calm, premium, serious, data-dense.

Запрещены: paper imitation, generic admin, banking dashboard, SaaS-blue, glass, gradients, neon, glow, radiation/reactor decoration, empty hero и decorative card grids.

## 4. Цвет

| Токен | Значение | Назначение |
| --- | --- | --- |
| `obsidian` | `#10191C` | единственный dark structural tone: rail, authority, сильные выводы |
| `canvas` | `#F2F5F4` | основной cool mineral background |
| `surface` | `#FFFFFF` | рабочая поверхность |
| `surface-raised` | `#E7ECEA` | selected neutral и track |
| `text` | `#172023` | основной текст |
| `text-muted` | `#637074` | metadata |
| `line` | `#D5DDDA` | структурные разделители |
| `accent` | `#356F62` | primary interaction, current stage, verified analytical focus |
| `accent-soft` | `#DDEBE6` | selected/verified surface |
| `action` | `#B45D2D` | требует действия, blocked gate, overdue |
| `action-soft` | `#F6E6DC` | фон action zone |
| `success` | `#2F7559` | завершённый результат, только семантически |
| `danger` | `#AA3F46` | отказ/критическое нарушение, только семантически |

Атомная отрасль выражается точностью, ответственностью и controlled mineral palette, а не кислотно-зелёным или символикой.

Факт / прогноз / допущение различаются не только цветом:

- факт — solid marker/line и label «Факт»;
- прогноз — dashed marker/line и label «Прогноз»;
- допущение — dotted marker/line, subtle hatch и label «Допущение».

## 5. Типографика

Основной стек: `"Segoe UI Variable", "Inter", "Geist", system-ui, sans-serif`.

Технический стек: `"Cascadia Mono", "IBM Plex Mono", "JetBrains Mono", monospace`.

Serif не используется.

| Роль | Размер |
| --- | ---: |
| display / page title | 34px / 40px |
| decision title | 28px / 34px |
| section title | 20px / 26px |
| lead | 16px / 24px |
| primary body | 14px / 21px |
| table | 13px / 18px |
| metadata | 12px / 16px |
| major KPI | 40px / 44px |

Глобально включены tabular numerals. Metadata не используется как основной текст или длинное описание.

## 6. App shell

- navigation rail: 80px desktop, 72px tablet; icons, labels on hover/focus and tooltips;
- product mark и navigation trigger наверху, profile/role внизу;
- context bar: breadcrumb/context, global command (`Ctrl+K`), current role;
- secondary navigation появляется только внутри сложного контекста;
- workspace занимает остальную ширину; maximum canvas 1680px;
- shell никогда не забирает 232px у 1024px viewport.

## 7. Композиционные примитивы

- `WorkspaceHeader` — title, context, primary action;
- `DecisionFlow` — единая процессная ось портфеля;
- `DecisionStageRail` — lifecycle одного решения с gates между стадиями;
- `EvidenceIndex` — девять evidence sections и readiness;
- `DecisionGatePanel` — confirmed requirements, blockers, owners, destinations, locked next stage;
- `ComparisonWorkspace` — alternatives as columns, criteria as rows;
- `RiskTransition` — initial → control → residual;
- `HumanVerdictPanel` — равноправные accept / modify / reject;
- `LineagePath` — source → quality control → DWH → indicator → decision → use;
- `BeforeAfterMeasure` — baseline → pilot with n, period, absolute delta and comparability;
- `MaturityContinuum` — continuous 1–5 scale;
- `TransformationRail` — roadmap phases with KPI gates.

Универсальная card не является базовой единицей раскладки. Card разрешена только для самостоятельной сущности или интерактивного выбора.

## 8. Ключевые экраны

### Dashboard

1. Executive situation: active / your actions / blocked / A-level authority.
2. Action queue с decision code, next action, owner и urgency.
3. Decision Flow как главный analytical canvas.
4. Process Health: скорость, доказательность, исполнимость, обучение — не ряд одинаковых tiles.
5. Maturity continuum и meaningful events как secondary context.

### Decision passport

1. Decision Control Header: code, A/B/C, title, body, owner, deadline, status, readiness.
2. Stage Rail.
3. Gate Control Center.
4. Split workspace: Evidence Index + main material.
5. Прямой переход к missing evidence.

### Alternatives

Comparison matrix доминирует. Selected option отмечен как human selection. Model recommendation находится в отдельной analytical zone и не подменяет выбор.

### AI

Не chatbot. Сначала governance metadata и sources, затем recommendation/reasoning/uncertainties, затем визуально сильнейшая зона Human Verdict. До вердикта: «Рекомендация не применена».

### Audit

Timeline переводит action/entity в человеческую фразу. Raw `before/after` доступны только в `<details>` как technical record.

## 9. Criticality

- A — solid high-contrast slab, label «Уровень A», expanded evidence/gate emphasis;
- B — strong outline, label «Уровень B»;
- C — neutral compact marker, label «Уровень C».

Различие читается формой, текстом и плотностью требований, не только цветом.

## 10. Motion

120–180ms ease-out только для command palette, drawer, disclosure, selected state и gate transition. Никаких entrance-on-scroll, flying cards, animated background или fake loading. `prefers-reduced-motion` отключает непринципиальное движение.

## 11. Responsive

| Viewport | Поведение |
| --- | --- |
| 1920×1080 | canvas до 1680px; широкие comparisons и flow |
| 1600×900 / 1440×900 | основной демонстрационный режим; rail 80px; первый meaningful canvas виден без scroll |
| 1366×768 / 1280×800 | compact context bar; сокращены вторичные пояснения; content начинается в первом viewport |
| 1024×768 | rail 72px; Evidence Index становится horizontal selector/drawer; wide tables scroll внутри; split складывается |

Whole-page horizontal overflow запрещён.

## 12. Accessibility and truthfulness

- WCAG AA contrast;
- visible focus ring;
- target минимум 36px, для rail 44px;
- state не кодируется только цветом;
- `aria-current`, labels, semantic headings, table scopes;
- no official-company claim for pilot/demo calculations;
- provenance includes source/as-of/owner/formula when available;
- technical enum разрешён только в disclosure;
- официальная оценка цифровой зрелости 3.4/4 не смешивается с авторской шкалой процесса 1–5;
- maturity всегда показывает период, KPI, выборку и «Не является официальным показателем компании».

## 13. Acceptance test

На `/dashboard` за 5 секунд понятно: сколько активных решений, где blocked gates, что требует действия текущей роли и где bottleneck.

На `/decisions/[id]` за 5 секунд понятно: что решается, criticality, authority, stage, readiness, next gate, missing evidence и кто должен устранить blocker.

Если эти ответы требуют чтения мелких cards или перехода по вкладкам, дизайн не принят.
