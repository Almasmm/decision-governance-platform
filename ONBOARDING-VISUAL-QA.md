# Visual QA системы обучения

## Проверяемые разрешения

- 1920×1080
- 1600×900
- 1440×900
- 1366×768
- 1280×800
- 1024×768
- 768×1024

## Критерии каждого кадра

- Понятно, какой объект объясняется: spotlight совпадает с устойчивым `data-tour` target.
- Заголовок отвечает «что это», основной текст — «зачем», блок действия — «что сделать».
- Связь с управленческим процессом или методикой указана там, где она содержательно важна.
- Карточка остаётся внутри viewport и по возможности не перекрывает target.
- Затемнение сохраняет контекст страницы; target и focus outline читаются без glow и blur.
- Управление «Пропустить / Назад / Далее / Готово / Закрыть» доступно мышью и клавиатурой.
- Видимый focus, `Escape`, focus trap и screen-reader progress работают.
- При `prefers-reduced-motion` переходы происходят без анимации.
- Отсутствующий RBAC-target пропускается; обязательный отсутствующий target пишет диагностику и не блокирует интерфейс.
- После завершения auto-start не повторяется; ручной replay и сброс только обучения работают.

## Golden-набор

Файлы создаются в `.artifacts/onboarding-final/` и принимаются только после production build,
реального Chromium walkthrough и просмотра самих PNG.

| № | Файл | Сценарий | Статус |
|---:|---|---|---|
| 01 | `01-login-welcome.png` | Вводный экран | PASS |
| 02 | `02-login-role-model.png` | Ролевая модель | PASS |
| 03 | `03-initiator-dashboard.png` | Dashboard инициатора | PASS |
| 04 | `04-data-owner-dashboard.png` | Dashboard владельца данных | PASS |
| 05 | `05-risk-officer-dashboard.png` | Dashboard риск-офицера | PASS |
| 06 | `06-analyst-dashboard.png` | Dashboard аналитика | PASS |
| 07 | `07-secretary-dashboard.png` | Dashboard секретаря | PASS |
| 08 | `08-board-dashboard.png` | Dashboard члена СД | PASS |
| 09 | `09-admin-dashboard.png` | Dashboard администратора | PASS |
| 10 | `10-decision-passport.png` | Контрольная шапка паспорта | PASS |
| 11 | `11-decision-gate.png` | Закрытые ворота | PASS |
| 12 | `12-alternatives.png` | Статус-кво и единые критерии | PASS |
| 13 | `13-data-lineage.png` | Происхождение показателя | PASS |
| 14 | `14-ai-human-verdict.png` | ИИ и человеческий вердикт | PASS |
| 15 | `15-kpi-baseline-pilot.png` | Сравнение baseline/pilot | PASS |
| 16 | `16-roadmap-gate.png` | KPI-gate дорожной карты | PASS |
| 17 | `17-audit.png` | Воспроизводимый audit trail | PASS |
| 18 | `18-jury-tour.png` | Финал экскурсии по методике | PASS |

## Приёмочная запись

Статусы меняются на PASS только после визуальной проверки реального кадра. TypeScript, unit-тест или наличие DOM-узла сами по себе не являются визуальной проверкой.

## Фактическая приёмка

- Дата: 2 сентября 2026 года.
- Spotlight acceptance обновлён 3 сентября 2026 года: фон `rgba(16, 25, 28, 0.72)`,
  белая рамка 3 px и внешний акцентный контур 2 px; fallback выбирает позицию coach card
  с минимальным перекрытием target.
- Golden viewport: 1440×900; просмотрены все 18 PNG после финальной регенерации.
- Отдельно исправлен и повторно принят кадр 14: target человеческого вердикта полностью виден,
  coach card его не перекрывает, metadata-заголовок не сталкивается с соседними колонками.
- Browser acceptance: Playwright Chromium, 25/25 сценариев PASS; golden generation — 1/1 PASS.
- Production acceptance: `next build` PASS, включая встроенные проверки типов и lint.
- Responsive matrix: 1920×1080, 1600×900, 1440×900, 1366×768, 1280×800,
  1024×768 и 768×1024 — 7/7 PASS без page-level overflow.
- Встроенный in-app Browser runtime не предоставил активный browser instance; фактическая проверка
  выполнена в установленном Chromium через Playwright с просмотром результатов средствами visual QA.
