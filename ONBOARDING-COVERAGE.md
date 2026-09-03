# Guided Onboarding — post-implementation coverage inventory

> Baseline audited on 2 September 2026 at `db16d89`; the coverage matrix below is reconciled with the current `ONBOARDING_ROUTES`, role profiles and `TOUR_REGISTRY`.
>
> Purpose: source-of-truth inventory and structural coverage record for PAGE, ROLE and THESIS onboarding.
>
> Scope: routes, layouts, navigation, roles, page access, action permissions, passport states, forms and disclosure surfaces. No business rule is redefined here.

## How to read this document

The inventory separates three things that must not be conflated:

1. **Route access** — whether a role can render a page.
2. **Action authority** — whether that role may mutate a particular business object.
3. **Tour coverage** — whether an accessible page has a tested onboarding definition and stable targets.

The original baseline had no central onboarding registry. The matrix is now a post-implementation reconciliation: route access comes from `ONBOARDING_ROUTES`, role scope from `ROLES`/role profiles, and tour ids and step counts from `TOUR_REGISTRY`. `PASS` in this document is a structural coverage result; it does not by itself claim production build, visual-regression or manual-browser acceptance.

Status legend:

- `PASS` — an accessible role-route obligation has a matching role-compatible PAGE definition in the current registry.
- `N/A — RBAC` — the role is redirected before the page renders; no tour for that role-route pair.
- `EXCEPTION` — deliberately no PAGE tour because the route has no user-facing page.

Symbols in permission tables: `✓` allowed; `—` denied.

## Inventory summary

| Item | Fact found in the repository |
|---|---:|
| App Router page patterns | 16 |
| User-facing page patterns requiring a PAGE tour | 15 |
| Non-visual redirect page exceptions | 1 (`/`) |
| API route patterns | 2 |
| Layouts | 2 |
| Authenticated workspace page patterns | 14 |
| Configured sidebar entries | 10 (9 shared + 1 ADMIN-only) |
| Off-sidebar working page patterns | 4 |
| Domain roles | 7 |
| Role × accessible-page obligations | 94 |
| Structurally covered obligations | 94/94 PASS |
| PAGE definitions / steps | 28 / 193 |
| ROLE definitions / steps | 7 / 58 |
| THESIS definitions / steps | 2 / 30 |
| All registered tours / steps | 37 / 281 |
| Permission actions in `PERMISSIONS` | 23 |
| Server mutation entry points | 26 (25 currently exposed in UI, 1 server-only) |
| Passport top-level tabs | 7 |
| Passport evidence blocks | 9 |
| Lifecycle stages | 7 |
| Gate rule codes | 11 |
| Role-dashboard panel states | 4 |
| Pre-onboarding business dialogs/drawers | 0 |

The 16 page patterns are `/`, `/login`, and 14 pages inside the authenticated `(app)` route group. The 94 PASS cells count `/login` for every eventual role because it remains directly renderable, while all seven rows correctly resolve to the one shared five-step GUEST tour `page-login`.

## Sources of truth

| Concern | Authoritative source |
|---|---|
| Page and API routes | `app/**/page.tsx`, `app/**/route.ts` |
| Global layout | `app/layout.tsx` |
| Authenticated shell and navigation | `app/(app)/layout.tsx` |
| Session resolution | `lib/auth.ts` |
| Domain roles, stages and block kinds | `lib/domain.ts` |
| Permission map | `lib/authz.ts` |
| Gate semantics | `lib/gates.ts`, `lib/gate-service.ts` |
| Server mutations | `app/actions/*.ts`, `app/api/decisions/[id]/advance/route.ts` |
| Demo identities | `prisma/seed.ts`, plus the quick-login list in `app/login/page.tsx` |
| Conditional action visibility | page files and `components/decision/**`, `components/admin/**` |

The server permission checks are authoritative. Hiding a control in React is only a usability layer and must never be described by onboarding as the security boundary.

## Layout and route-guard inventory

| Layer | Pages covered | Confirmed behavior | Onboarding consequence |
|---|---|---|---|
| `app/layout.tsx` | Entire application | Root HTML metadata/styles only; no auth or navigation | Provider may be mounted here only if login and authenticated tours both need it and failure remains non-blocking |
| `app/(app)/layout.tsx` | All 14 workspace pages | `getSessionUser()`; anonymous users redirect to `/login`; renders skip link, icon rail, context bar, global search and user/logout controls | Shared shell targets are available on every authenticated page |
| `/` | Root redirect | Authenticated → `/dashboard`; anonymous → `/login`; renders no persistent UI | Documented PAGE-tour exception |
| `/login` | Public login | No server redirect for an already authenticated visitor; credentials are handled by NextAuth | Use a GUEST/page introduction; do not infer a business role before sign-in succeeds |
| `/decisions/new` | Restricted workspace page | `decision.create` required; otherwise redirect to `/decisions` | Only INITIATOR and ADMIN receive this PAGE tour |
| `/admin` | Restricted workspace page | `admin.users` required; otherwise redirect to `/dashboard` | Only ADMIN receives this PAGE tour |
| `/decisions/:id` | Dynamic detail | Any authenticated role may read; unknown id calls `notFound()` | Tour requires a real demo decision id; 404 is not a tour route |
| `/indicators/:id` | Dynamic detail | Any authenticated role may read; unknown id calls `notFound()` | Tour requires a real demo indicator id; 404 is not a tour route |
| All other `(app)` pages | Shared workspace | All seven authenticated roles may render them | PAGE tour required for all seven roles |

There is no `middleware.ts`, no tenant filter and no per-record read restriction in the current repository. Every authenticated role can read every decision and indicator record. Object-level restrictions apply to actions, not to detail-page visibility.

Session roles are copied from `User.role` into a JWT and cast to the TypeScript `Role` type by `requireUser()`. The Prisma schema stores the role as a string; `roleSchema` exists in `lib/domain.ts`, but session creation does not perform a separate runtime enum parse. Tour role resolution must derive its supported values from `ROLES`, and must fail closed or fall back safely if an unexpected string ever appears.

## Navigation inventory

### Authenticated icon rail

| Navigation group | Route | Label | Visible to |
|---|---|---|---|
| Контур решений | `/dashboard` | Dashboard | All authenticated roles |
| Контур решений | `/decisions` | Decisions | All authenticated roles |
| Доказательная база | `/indicators` | Indicators | All authenticated roles |
| Аналитика и интеллект | `/kpi` | KPI | All authenticated roles |
| Аналитика и интеллект | `/models` | Models | All authenticated roles |
| Контроль и обучение | `/lessons` | Lessons | All authenticated roles |
| Контроль и обучение | `/boards` | Boards | All authenticated roles |
| Контроль и обучение | `/roadmap` | Roadmap | All authenticated roles |
| Контроль и обучение | `/audit` | Audit | All authenticated roles |
| Система | `/admin` | Admin | ADMIN only |

`NavLink` treats `/dashboard` as an exact match and the other entries as prefix matches.

### Working routes not represented by their own rail item

| Route | Entry point |
|---|---|
| `/search` | Context-bar global search form; `Ctrl/Cmd+K` focuses it |
| `/decisions/new` | “Создать паспорт” CTA in `/decisions`, only for INITIATOR/ADMIN |
| `/decisions/:id` | Decision links in dashboard, registry, boards, lessons, search and audit |
| `/indicators/:id` | Indicator links in the catalogue and search |

These are still accessible working pages and therefore are not exceptions to tour coverage.

## Actual roles and demo identities

| Role value | Russian label | Demo users found | Quick-login availability |
|---|---|---|---|
| `INITIATOR` | Инициатор | Динара Ахметова — `initiator@kap.kz` | Yes |
| `DATA_OWNER` | Владелец данных | Ержан Смагулов — `dataowner@kap.kz`; Гульнара Оспанова — `dataowner2@kap.kz` | Ержан only; Гульнара remains available through manual credentials |
| `RISK_OFFICER` | Риск-офицер | Тимур Бекетов — `risk@kap.kz` | Yes |
| `ANALYST` | Аналитик | Алия Нурланова — `analyst@kap.kz`; Марат Касымов — `analyst2@kap.kz` | Both; the second identity supports independent-review scenarios |
| `SECRETARY` | Корпоративный секретарь | Сауле Жумабаева — `secretary@kap.kz` | Yes |
| `BOARD_MEMBER` | Член Совета директоров | Нурлан Абишев — `board@kap.kz` | Yes |
| `ADMIN` | Администратор | Администратор системы — `admin@kap.kz` | Yes |

All seeded demo accounts use `demo1234`. The login screen exposes eight quick-login identities; the ninth seeded identity, `dataowner2@kap.kz`, can be entered manually. Onboarding progress must be keyed by `userId + role + tourId + tourVersion`, not only by role, because the two DATA_OWNER and two ANALYST accounts are distinct actors.

## Role × route coverage matrix

This is the post-implementation structural matrix. Counts are read from the current registry, not from the earlier design budget. The decision-passport row deliberately includes the base tour and all seven registered query-state tours, including the dedicated post-evaluation context. A PASS asserts that the accessible role-route obligation resolves to a role-compatible PAGE definition; runtime visual/build acceptance remains a separate check.

### Registered PAGE definitions

| Route pattern | Exact PAGE tour id(s) | Actual steps | Registry role scope |
|---|---|---:|---|
| `/login` | `page-login` | 5 | Shared GUEST introduction |
| `/dashboard` | `page-dashboard-initiator`<br>`page-dashboard-data-owner`<br>`page-dashboard-risk-officer`<br>`page-dashboard-analyst`<br>`page-dashboard-secretary`<br>`page-dashboard-board-member`<br>`page-dashboard-admin` | 10 each; 70 total | One role-specific definition for each of 7 roles; navigation, search and training controls included |
| `/decisions` | `page-decisions` | 8 | All authenticated roles; create step is filtered to INITIATOR and ADMIN |
| `/decisions/new` | `page-decision-new` | 4 | INITIATOR, ADMIN |
| `/decisions/:id` | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 9 + 7 + 7 + 6 + 8 + 6 + 6 + 4 = 53 | Base passport plus seven query-state contexts; role-filtered action steps preserve RBAC |
| `/indicators` | `page-indicators` | 9 | All authenticated roles |
| `/indicators/:id` | `page-indicator-detail` | 6 | All authenticated roles |
| `/kpi` | `page-kpi` | 4 | All authenticated roles |
| `/models` | `page-models` | 5 | All authenticated roles |
| `/lessons` | `page-lessons` | 5 | All authenticated roles |
| `/boards` | `page-boards` | 5 | All authenticated roles |
| `/roadmap` | `page-roadmap` | 4 | All authenticated roles |
| `/audit` | `page-audit` | 4 | All authenticated roles |
| `/admin` | `page-admin` | 7 | ADMIN |
| `/search` | `page-search` | 4 | All authenticated roles |

Unique PAGE registry total: **28 definitions / 193 steps**. Every authenticated PAGE tour opens with a page-specific explanation plus a role brief rendered from the current identity. `/` is not included because it is a non-visual redirect exception.

### Registered ROLE and THESIS definitions

| Mode | Exact tour id | Actual steps | Scope / purpose |
|---|---|---:|---|
| ROLE | `role-initiator` | 9 | INITIATOR working route |
| ROLE | `role-data-owner` | 9 | DATA_OWNER working route, including owned-data confirmation |
| ROLE | `role-risk-officer` | 7 | RISK_OFFICER working route |
| ROLE | `role-analyst` | 9 | ANALYST working route |
| ROLE | `role-secretary` | 8 | SECRETARY working route |
| ROLE | `role-board-member` | 9 | BOARD_MEMBER working route |
| ROLE | `role-admin` | 7 | ADMIN working route |
| THESIS | `thesis-jury-methodology` | 26 | End-to-end jury methodology and decision lifecycle |
| THESIS | `thesis-evidence-natures` | 4 | Separate fact / forecast / assumption evidence-nature explanation |

Registry totals for these modes: **7 ROLE definitions / 58 steps** and **2 THESIS definitions / 30 steps**.

### Post-implementation role obligations

#### INITIATOR

| Role | Route | Page | Accessible | Exact PAGE tour id(s) | Actual steps | Status |
|---|---|---|---|---|---:|---|
| INITIATOR | `/` | Redirect resolver | redirect only | — | 0 | EXCEPTION |
| INITIATOR | `/login` | Login and role selection | Yes | `page-login` | 5 | PASS |
| INITIATOR | `/dashboard` | Executive dashboard | Yes | `page-dashboard-initiator` | 10 | PASS |
| INITIATOR | `/decisions` | Decision registry | Yes | `page-decisions` | 8 | PASS |
| INITIATOR | `/decisions/new` | New decision passport | Yes | `page-decision-new` | 4 | PASS |
| INITIATOR | `/decisions/:id` | Decision passport + seven contextual tours | Yes | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 53 (9+7+7+6+8+6+6+4) | PASS |
| INITIATOR | `/indicators` | Indicator catalogue | Yes | `page-indicators` | 9 | PASS |
| INITIATOR | `/indicators/:id` | Indicator evidence card | Yes | `page-indicator-detail` | 6 | PASS |
| INITIATOR | `/kpi` | KPI, effect and maturity | Yes | `page-kpi` | 4 | PASS |
| INITIATOR | `/models` | Model governance registry | Yes | `page-models` | 5 | PASS |
| INITIATOR | `/lessons` | Corporate lessons | Yes | `page-lessons` | 5 | PASS |
| INITIATOR | `/boards` | Governance panels | Yes | `page-boards` | 5 | PASS |
| INITIATOR | `/roadmap` | Transformation roadmap | Yes | `page-roadmap` | 4 | PASS |
| INITIATOR | `/audit` | Audit timeline | Yes | `page-audit` | 4 | PASS |
| INITIATOR | `/admin` | Administration | No; → `/dashboard` | — | 0 | N/A — RBAC |
| INITIATOR | `/search` | Global search results | Yes | `page-search` | 4 | PASS |

Accessible obligations: **14 PASS**; referenced PAGE steps eligible for this role: **126**.

#### DATA_OWNER

| Role | Route | Page | Accessible | Exact PAGE tour id(s) | Actual steps | Status |
|---|---|---|---|---|---:|---|
| DATA_OWNER | `/` | Redirect resolver | redirect only | — | 0 | EXCEPTION |
| DATA_OWNER | `/login` | Login and role selection | Yes | `page-login` | 5 | PASS |
| DATA_OWNER | `/dashboard` | Executive dashboard | Yes | `page-dashboard-data-owner` | 10 | PASS |
| DATA_OWNER | `/decisions` | Decision registry | Yes | `page-decisions` | 7 | PASS |
| DATA_OWNER | `/decisions/new` | New decision passport | No; → `/decisions` | — | 0 | N/A — RBAC |
| DATA_OWNER | `/decisions/:id` | Decision passport + seven contextual tours | Yes | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 49 (9+6+6+6+8+5+5+4) | PASS |
| DATA_OWNER | `/indicators` | Indicator catalogue | Yes | `page-indicators` | 9 | PASS |
| DATA_OWNER | `/indicators/:id` | Indicator evidence card | Yes | `page-indicator-detail` | 6 | PASS |
| DATA_OWNER | `/kpi` | KPI, effect and maturity | Yes | `page-kpi` | 4 | PASS |
| DATA_OWNER | `/models` | Model governance registry | Yes | `page-models` | 5 | PASS |
| DATA_OWNER | `/lessons` | Corporate lessons | Yes | `page-lessons` | 5 | PASS |
| DATA_OWNER | `/boards` | Governance panels | Yes | `page-boards` | 5 | PASS |
| DATA_OWNER | `/roadmap` | Transformation roadmap | Yes | `page-roadmap` | 4 | PASS |
| DATA_OWNER | `/audit` | Audit timeline | Yes | `page-audit` | 4 | PASS |
| DATA_OWNER | `/admin` | Administration | No; → `/dashboard` | — | 0 | N/A — RBAC |
| DATA_OWNER | `/search` | Global search results | Yes | `page-search` | 4 | PASS |

Accessible obligations: **13 PASS**; referenced PAGE steps eligible for this role: **117**.

#### RISK_OFFICER

| Role | Route | Page | Accessible | Exact PAGE tour id(s) | Actual steps | Status |
|---|---|---|---|---|---:|---|
| RISK_OFFICER | `/` | Redirect resolver | redirect only | — | 0 | EXCEPTION |
| RISK_OFFICER | `/login` | Login and role selection | Yes | `page-login` | 5 | PASS |
| RISK_OFFICER | `/dashboard` | Executive dashboard | Yes | `page-dashboard-risk-officer` | 10 | PASS |
| RISK_OFFICER | `/decisions` | Decision registry | Yes | `page-decisions` | 7 | PASS |
| RISK_OFFICER | `/decisions/new` | New decision passport | No; → `/decisions` | — | 0 | N/A — RBAC |
| RISK_OFFICER | `/decisions/:id` | Decision passport + seven contextual tours | Yes | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 49 (9+6+6+6+8+5+5+4) | PASS |
| RISK_OFFICER | `/indicators` | Indicator catalogue | Yes | `page-indicators` | 9 | PASS |
| RISK_OFFICER | `/indicators/:id` | Indicator evidence card | Yes | `page-indicator-detail` | 6 | PASS |
| RISK_OFFICER | `/kpi` | KPI, effect and maturity | Yes | `page-kpi` | 4 | PASS |
| RISK_OFFICER | `/models` | Model governance registry | Yes | `page-models` | 5 | PASS |
| RISK_OFFICER | `/lessons` | Corporate lessons | Yes | `page-lessons` | 5 | PASS |
| RISK_OFFICER | `/boards` | Governance panels | Yes | `page-boards` | 5 | PASS |
| RISK_OFFICER | `/roadmap` | Transformation roadmap | Yes | `page-roadmap` | 4 | PASS |
| RISK_OFFICER | `/audit` | Audit timeline | Yes | `page-audit` | 4 | PASS |
| RISK_OFFICER | `/admin` | Administration | No; → `/dashboard` | — | 0 | N/A — RBAC |
| RISK_OFFICER | `/search` | Global search results | Yes | `page-search` | 4 | PASS |

Accessible obligations: **13 PASS**; referenced PAGE steps eligible for this role: **117**.

#### ANALYST

| Role | Route | Page | Accessible | Exact PAGE tour id(s) | Actual steps | Status |
|---|---|---|---|---|---:|---|
| ANALYST | `/` | Redirect resolver | redirect only | — | 0 | EXCEPTION |
| ANALYST | `/login` | Login and role selection | Yes | `page-login` | 5 | PASS |
| ANALYST | `/dashboard` | Executive dashboard | Yes | `page-dashboard-analyst` | 10 | PASS |
| ANALYST | `/decisions` | Decision registry | Yes | `page-decisions` | 7 | PASS |
| ANALYST | `/decisions/new` | New decision passport | No; → `/decisions` | — | 0 | N/A — RBAC |
| ANALYST | `/decisions/:id` | Decision passport + seven contextual tours | Yes | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 51 (9+6+7+6+8+5+6+4) | PASS |
| ANALYST | `/indicators` | Indicator catalogue | Yes | `page-indicators` | 9 | PASS |
| ANALYST | `/indicators/:id` | Indicator evidence card | Yes | `page-indicator-detail` | 6 | PASS |
| ANALYST | `/kpi` | KPI, effect and maturity | Yes | `page-kpi` | 4 | PASS |
| ANALYST | `/models` | Model governance registry | Yes | `page-models` | 5 | PASS |
| ANALYST | `/lessons` | Corporate lessons | Yes | `page-lessons` | 5 | PASS |
| ANALYST | `/boards` | Governance panels | Yes | `page-boards` | 5 | PASS |
| ANALYST | `/roadmap` | Transformation roadmap | Yes | `page-roadmap` | 4 | PASS |
| ANALYST | `/audit` | Audit timeline | Yes | `page-audit` | 4 | PASS |
| ANALYST | `/admin` | Administration | No; → `/dashboard` | — | 0 | N/A — RBAC |
| ANALYST | `/search` | Global search results | Yes | `page-search` | 4 | PASS |

Accessible obligations: **13 PASS**; referenced PAGE steps eligible for this role: **119**.

#### SECRETARY

| Role | Route | Page | Accessible | Exact PAGE tour id(s) | Actual steps | Status |
|---|---|---|---|---|---:|---|
| SECRETARY | `/` | Redirect resolver | redirect only | — | 0 | EXCEPTION |
| SECRETARY | `/login` | Login and role selection | Yes | `page-login` | 5 | PASS |
| SECRETARY | `/dashboard` | Executive dashboard | Yes | `page-dashboard-secretary` | 10 | PASS |
| SECRETARY | `/decisions` | Decision registry | Yes | `page-decisions` | 7 | PASS |
| SECRETARY | `/decisions/new` | New decision passport | No; → `/decisions` | — | 0 | N/A — RBAC |
| SECRETARY | `/decisions/:id` | Decision passport + seven contextual tours | Yes | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 51 (9+7+6+6+8+6+5+4) | PASS |
| SECRETARY | `/indicators` | Indicator catalogue | Yes | `page-indicators` | 9 | PASS |
| SECRETARY | `/indicators/:id` | Indicator evidence card | Yes | `page-indicator-detail` | 6 | PASS |
| SECRETARY | `/kpi` | KPI, effect and maturity | Yes | `page-kpi` | 4 | PASS |
| SECRETARY | `/models` | Model governance registry | Yes | `page-models` | 5 | PASS |
| SECRETARY | `/lessons` | Corporate lessons | Yes | `page-lessons` | 5 | PASS |
| SECRETARY | `/boards` | Governance panels | Yes | `page-boards` | 5 | PASS |
| SECRETARY | `/roadmap` | Transformation roadmap | Yes | `page-roadmap` | 4 | PASS |
| SECRETARY | `/audit` | Audit timeline | Yes | `page-audit` | 4 | PASS |
| SECRETARY | `/admin` | Administration | No; → `/dashboard` | — | 0 | N/A — RBAC |
| SECRETARY | `/search` | Global search results | Yes | `page-search` | 4 | PASS |

Accessible obligations: **13 PASS**; referenced PAGE steps eligible for this role: **119**.

#### BOARD_MEMBER

| Role | Route | Page | Accessible | Exact PAGE tour id(s) | Actual steps | Status |
|---|---|---|---|---|---:|---|
| BOARD_MEMBER | `/` | Redirect resolver | redirect only | — | 0 | EXCEPTION |
| BOARD_MEMBER | `/login` | Login and role selection | Yes | `page-login` | 5 | PASS |
| BOARD_MEMBER | `/dashboard` | Executive dashboard | Yes | `page-dashboard-board-member` | 10 | PASS |
| BOARD_MEMBER | `/decisions` | Decision registry | Yes | `page-decisions` | 7 | PASS |
| BOARD_MEMBER | `/decisions/new` | New decision passport | No; → `/decisions` | — | 0 | N/A — RBAC |
| BOARD_MEMBER | `/decisions/:id` | Decision passport + seven contextual tours | Yes | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 50 (9+6+6+6+8+5+6+4) | PASS |
| BOARD_MEMBER | `/indicators` | Indicator catalogue | Yes | `page-indicators` | 9 | PASS |
| BOARD_MEMBER | `/indicators/:id` | Indicator evidence card | Yes | `page-indicator-detail` | 6 | PASS |
| BOARD_MEMBER | `/kpi` | KPI, effect and maturity | Yes | `page-kpi` | 4 | PASS |
| BOARD_MEMBER | `/models` | Model governance registry | Yes | `page-models` | 5 | PASS |
| BOARD_MEMBER | `/lessons` | Corporate lessons | Yes | `page-lessons` | 5 | PASS |
| BOARD_MEMBER | `/boards` | Governance panels | Yes | `page-boards` | 5 | PASS |
| BOARD_MEMBER | `/roadmap` | Transformation roadmap | Yes | `page-roadmap` | 4 | PASS |
| BOARD_MEMBER | `/audit` | Audit timeline | Yes | `page-audit` | 4 | PASS |
| BOARD_MEMBER | `/admin` | Administration | No; → `/dashboard` | — | 0 | N/A — RBAC |
| BOARD_MEMBER | `/search` | Global search results | Yes | `page-search` | 4 | PASS |

Accessible obligations: **13 PASS**; referenced PAGE steps eligible for this role: **118**.

#### ADMIN

| Role | Route | Page | Accessible | Exact PAGE tour id(s) | Actual steps | Status |
|---|---|---|---|---|---:|---|
| ADMIN | `/` | Redirect resolver | redirect only | — | 0 | EXCEPTION |
| ADMIN | `/login` | Login and role selection | Yes | `page-login` | 5 | PASS |
| ADMIN | `/dashboard` | Executive dashboard | Yes | `page-dashboard-admin` | 10 | PASS |
| ADMIN | `/decisions` | Decision registry | Yes | `page-decisions` | 8 | PASS |
| ADMIN | `/decisions/new` | New decision passport | Yes | `page-decision-new` | 4 | PASS |
| ADMIN | `/decisions/:id` | Decision passport + seven contextual tours | Yes | `page-decision-passport`<br>`page-decision-post-evaluation`<br>`page-decision-alternatives`<br>`page-decision-risks`<br>`page-decision-economics`<br>`page-decision-assignments`<br>`page-decision-ai`<br>`page-decision-audit` | 53 (9+7+7+6+8+6+6+4) | PASS |
| ADMIN | `/indicators` | Indicator catalogue | Yes | `page-indicators` | 9 | PASS |
| ADMIN | `/indicators/:id` | Indicator evidence card | Yes | `page-indicator-detail` | 6 | PASS |
| ADMIN | `/kpi` | KPI, effect and maturity | Yes | `page-kpi` | 4 | PASS |
| ADMIN | `/models` | Model governance registry | Yes | `page-models` | 5 | PASS |
| ADMIN | `/lessons` | Corporate lessons | Yes | `page-lessons` | 5 | PASS |
| ADMIN | `/boards` | Governance panels | Yes | `page-boards` | 5 | PASS |
| ADMIN | `/roadmap` | Transformation roadmap | Yes | `page-roadmap` | 4 | PASS |
| ADMIN | `/audit` | Audit timeline | Yes | `page-audit` | 4 | PASS |
| ADMIN | `/admin` | Administration | Yes | `page-admin` | 7 | PASS |
| ADMIN | `/search` | Global search results | Yes | `page-search` | 4 | PASS |

Accessible obligations: **15 PASS**; referenced PAGE steps eligible for this role: **133**.

Matrix total: **94 PASS**, **11 N/A — RBAC**, and **7 EXCEPTION** cells across 7 roles × 16 route patterns. The 94 PASS cells are obligations, not unique tour instances; shared definitions are intentionally reused. Referenced step totals apply step-level eligibility: the post-evaluation close step is available only to INITIATOR, SECRETARY and ADMIN, while the AI human-verdict step is available only to INITIATOR, ANALYST, BOARD_MEMBER and ADMIN.

## Route and screen inventory

| Route | Screen and important states | Inputs/actions visible on the page | Tour content obligation |
|---|---|---|---|
| `/login` | Welcome thesis, seven-stage lifecycle, Human-in-the-loop statement, four role groups, eight quick-login identities | Quick role login buttons; collapsible manual email/password form | Explain the product before highlighting a person; lifecycle; human authority; role groups; role selection |
| `/dashboard` | Executive situation, active/action/blocked/A-attention signals, level-A focus, personal responsibility queue, seven-stage flow, process health, maturity, significant events, public context disclosure | Links to passport, audit and KPI; no business mutation | Ten-step role-aware tour including navigation, global search and training controls; action-queue copy changes by role |
| `/decisions` | Portfolio signals, registry filters, table with code, A/B/C, stage, gate, responsibility, body, deadline and status | Search and filters `q`, `criticality`, `stage`, `status`; advanced `type`, `body`, `overdue`; reset; create CTA for INITIATOR/ADMIN | Explain “stuck” as missing evidence, not UI failure; cover every operational column and filters |
| `/decisions/new` | New passport form and lifecycle/criticality guidance | Title, goal, type, criticality, decision body, optional deadline; create | Explain why the unit is a decision, how A/B/C changes required evidence, and why the body is selected before creation |
| `/decisions/:id` | Decision Control Header, readiness, stage rail, gate checklist, evidence index, seven tabs and audit | Role/state-dependent mutations listed below | Central walkthrough; more than ten steps permitted; role-aware optional targets must skip safely |
| `/indicators` | Evidence catalogue, governance coverage, freshness signals, fact/forecast/assumption legend, indicator table | Filters `q`, `source`, `critical`; reset; links to indicator detail | Explain that a number without source, owner and date is not full evidence |
| `/indicators/:id` | Evidence card, current fact, data contract, quality rules, value-nature contract, lineage graph, time series, version history, use in decisions | Auto-load for ANALYST/ADMIN when source is not MANUAL/EXTERNAL; detail links | Explain source → integration/quality → catalogue/calculation → decision evidence → authority, plus fact/forecast/assumption |
| `/kpi` | Comparability frame, baseline/pilot paired comparison, nine-KPI register, maturity continuum, effect methodology and calculators | Local, non-persisted calculators for automation, risk effect and NPV | Explain sample and period as part of the result, non-causality disclaimer, maturity 1–5 and no invented money |
| `/models` | Human-in-the-loop sequence, active provider disclosure, model governance registry, version/owner/validation/allowed levels/quality/limitations | Read-only; no model-management control is wired | Explain model eligibility and why a recommendation carries no decision authority |
| `/lessons` | Learning loop, cause pattern, filters, Plan → Fact → Lesson register | Search/filter by `q`, `cause`, `type`; clickable cause filter; links to passport | Explain corporate memory and that lesson creation happens after execution inside the passport |
| `/boards` | Four governance views over one evidence base; current user role shown | Query-state navigation `panel=strategy|investment|production|risk`; links to decisions and indicators | Explain shared evidence vs different competence; cover all four panel meanings, not only the default strategy state |
| `/roadmap` | Horizontal 0/6/18/30+ phases, current barrier, phase KPI gates, fact/target/gap, implementation-risk register | Read-only phase evidence disclosures | Explain that time does not unlock a phase; actual KPI thresholds do, and scaling can be premature |
| `/audit` | Human-readable grouped timeline, entity/action/actor/date filters, pagination, technical before/after disclosure | Filters `entity`, `action`, `actor`, `from`, `to`, `page`; links to decisions | Explain actor, time, object and change; technical JSON is supporting evidence, not primary copy |
| `/admin` | System-impact warning, section jump navigation, users/roles, decision bodies, gate policy | Update role; create body; toggle gate blocking; delete gate; create gate rule | Explain global consequences and that ADMIN configuration power does not transfer business decision authority |
| `/search` | Query input; grouped decision, indicator, model and assignment results; empty/no-match states | GET search `q`; links to matching business objects | Short tour: search scope, result types, route destinations and empty states |
| `/` | No screen; conditional redirect | None | No PAGE tour; explicit exception |

## Decision passport inventory

### Top-level tabs

| Query | Label | Main surface | Role-sensitive actions |
|---|---|---|---|
| `?tab=passport` | Доказательная база | Gate, stage rail, nine-block Evidence Index and active evidence block | Advance, submit/return, edit text blocks, link/confirm indicators, add lesson/close |
| `?tab=alternatives` | Альтернативы | Status quo, substantive alternatives, common eight-criterion matrix, selected decision/motivation | Add alternative; BOARD_MEMBER/ADMIN human decision at DECISION stage |
| `?tab=risks` | Риски | Initial → mitigation → residual risk, owners/triggers; assumptions register | Add risk; add assumption |
| `?tab=economics` | Экономика | Persisted automation/risk/NPV calculations, inputs, missing parameters, attribution, reviews | Create calculation; independent confirm/reject if reviewer is not author |
| `?tab=assignments` | Исполнение | Decision → assignment → KPI → actual/status | Add assignment; mark complete |
| `?tab=ai` | Аналитика ИИ | Model eligibility/governance, sources, recommendation, limitations, pending human verdict | Run eligible tier; accept/modify/reject recommendation |
| `?tab=audit` | Аудит | Decision-scoped human-readable event history and technical before/after | Read-only |

Default/unknown `tab` resolves to `passport`.

### Evidence Index blocks

| Query block | Label | Current behavior |
|---|---|---|
| `IDENTIFICATION` | 01 Идентификация | Read-only code, type, goal, initiator, authority and criticality |
| `DATA` | 02 Данные | Linked indicators, provenance and quality confirmation; link form when authorized |
| `ALTERNATIVES` | 03 Альтернативы | Summary and deep link to the alternatives workspace |
| `ECONOMICS` | 04 Экономика | Summary and deep link to calculations |
| `SAFETY` | 05 Безопасность | Editable safety/regulatory text for `decision.editBlocks` roles |
| `RISKS` | 06 Риски | Summary and deep link to risk/assumption workspace |
| `DECISION` | 07 Решение | Read-only selected alternative and motivation |
| `EXECUTION` | 08 Исполнение | Summary and deep link to assignments |
| `POST_EVALUATION` | 09 Пост-оценка | Editable plan/fact block, lessons and close control |

Default/unknown `block` resolves to `IDENTIFICATION`. The PAGE tour must explain all nine blocks without forcing nine unrelated tooltips; the Evidence Index may introduce the taxonomy, while contextual steps explain complex workspaces.

### Alternatives criteria

Every saved alternative is normalized to the same eight criteria: safety, regulatory, economics, time, resources, staffing, cyber risk and sustainability. The gate for significant decisions requires at least two substantively different alternatives, a status-quo alternative and uniform criteria. Onboarding must not imply that merely adding rows satisfies the methodology.

### Gate lifecycle

The immutable seven-stage sequence is:

`PROBLEM → DATA → ALTERNATIVES → RISKS → DECISION → EXECUTION → FEEDBACK`

The configured rule vocabulary is:

| Rule | Business requirement | Responsible role shown by the gate |
|---|---|---|
| `GOAL_TYPE_BODY` | Goal, type and decision body are present | Initiator |
| `CRITICAL_INDICATORS_SOURCED` | Critical indicators are linked and have source/owner | Initiator / Analyst |
| `DATA_OWNERS_CONFIRMED` | Owners confirmed critical data quality | Data owners |
| `ALTERNATIVES_MIN` | Status quo + at least two distinct substantive alternatives | Initiator / Analyst |
| `UNIFORM_CRITERIA` | All alternatives use the common criteria set | Analyst |
| `RISK_PROFILE` | Residual probability/impact and owner are recorded | Risk officer |
| `ASSUMPTIONS_FIXED` | Level-A assumptions have validity dates | Initiator / Analyst |
| `INDEPENDENT_REVIEW` | Critical calculation confirmed by a second user | Second analyst / Risk officer |
| `DECISION_RECORDED` | Human choice and motivation recorded | Decision body |
| `ASSIGNMENTS_KPI` | Every assignment is linked to an outcome KPI | Secretary / Initiator |
| `POST_EVALUATION_REQUIRED` | Plan/fact and learning evidence are complete | Initiator / Analyst |

Gate configuration varies by transition and A/B/C level. A gate checks evidence; it never makes the decision. Even with a passed DECISION gate, the server rejects DECISION → EXECUTION unless status is explicitly `APPROVED` by an authorized human.

## Permission matrix

Abbreviations: `I` INITIATOR, `D` DATA_OWNER, `R` RISK_OFFICER, `A` ANALYST, `S` SECRETARY, `B` BOARD_MEMBER, `X` ADMIN.

| Permission action | I | D | R | A | S | B | X | Current UI surface / extra condition |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| `decision.create` | ✓ | — | — | — | — | — | ✓ | `/decisions/new`; create CTA in registry |
| `decision.editBlocks` | ✓ | — | — | ✓ | — | — | ✓ | Safety and post-evaluation block forms |
| `decision.advance` | ✓ | — | — | — | ✓ | — | ✓ | Gate transition; also close at FEEDBACK |
| `decision.return` | — | — | — | — | ✓ | ✓ | ✓ | Return form shown only while `IN_REVIEW`; reason ≥5 chars |
| `decision.decide` | — | — | — | — | — | ✓ | ✓ | Alternatives tab at DECISION stage; motivation ≥10 chars |
| `decision.submit` | ✓ | — | — | — | — | — | ✓ | DRAFT/RETURNED → IN_REVIEW |
| `indicator.manage` | — | — | — | ✓ | — | — | ✓ | Auto-load button on indicator detail; manual action has no UI |
| `indicator.confirmQuality` | — | ✓ | — | — | — | — | ✓ | Non-admin must also be the actual owner of that indicator |
| `indicator.link` | ✓ | — | — | ✓ | — | — | ✓ | Passport DATA block |
| `risk.edit` | — | — | ✓ | — | — | — | ✓ | Risks tab |
| `assumption.edit` | ✓ | — | — | ✓ | — | — | ✓ | Risks tab |
| `alternative.edit` | ✓ | — | — | ✓ | — | — | ✓ | Alternatives tab |
| `calc.create` | ✓ | — | — | ✓ | — | — | ✓ | Economics tab; persists only with complete parameters |
| `calc.review` | — | — | ✓ | ✓ | — | — | ✓ | Reviewer cannot be the calculation author |
| `assignment.manage` | ✓ | — | — | — | ✓ | — | ✓ | Add and complete assignments |
| `aiModel.manage` | — | — | — | ✓ | — | — | ✓ | Defined in RBAC; no model-management UI/action is wired |
| `ai.run` | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | AI tab; additionally constrained by tier eligibility/model/data |
| `ai.verdict` | ✓ | — | — | ✓ | — | ✓ | ✓ | AI tab; reason required for all level-A or non-accept verdicts |
| `lesson.create` | ✓ | — | — | ✓ | — | — | ✓ | Post-evaluation inside passport; not the lessons register |
| `kpi.manage` | — | — | — | ✓ | — | — | ✓ | Defined in RBAC; no KPI mutation UI/action is wired |
| `admin.users` | — | — | — | — | — | — | ✓ | Admin user-role panel and route guard |
| `admin.gates` | — | — | — | — | — | — | ✓ | Admin gate policy panel |
| `admin.bodies` | — | — | — | — | — | — | ✓ | Admin decision-body panel |

ADMIN is included in every permission list. That is technical superuser authority in the current code. Onboarding copy must still state that governance configuration does not make an automated recommendation or the platform itself the business decision-maker.

## Mutation and action inventory

| Entry point | Permission | UI exposure | Important server condition |
|---|---|---|---|
| `createDecision` | `decision.create` | New-decision form | Creates all nine empty blocks; initial stage/status `PROBLEM`/`DRAFT` |
| `updateBlockPayload` | `decision.editBlocks` | Passport text-block forms | Existing block required |
| `submitForReview` | `decision.submit` | Gate workflow actions | Only `DRAFT` or `RETURNED` |
| `returnDecision` | `decision.return` | Inline return-reason panel | UI limits to `IN_REVIEW`; server validates reason but does not repeat that status check |
| `decideDecision` | `decision.decide` | Alternatives decision panel | DECISION stage; motivation; APPROVED requires a valid alternative |
| `addLesson` | `lesson.create` | Post-evaluation panel | Valid Plan/Fact/Cause/Conclusion payload |
| `closeDecision` | `decision.advance` | Post-evaluation panel | FEEDBACK stage and at least one lesson |
| `addAlternative` | `alternative.edit` | Alternatives inline form | Normalizes all eight criteria |
| `addAssumption` | `assumption.edit` | Assumptions inline form | Current actor becomes owner |
| `addRisk` | `risk.edit` | Risks inline form | Current actor becomes owner; residual and trigger required |
| `addAssignment` | `assignment.manage` | Assignments inline form | KPI link is mandatory |
| `completeAssignment` | `assignment.manage` | Assignment row action | Marks `DONE` and records completion time |
| `linkIndicator` | `indicator.link` | Passport DATA block | Creates decision-indicator relationship |
| `confirmIndicatorQuality` | `indicator.confirmQuality` | Passport DATA block | Actual indicator owner or ADMIN only |
| `addCalculation` | `calc.create` | Economics calculators | No saved result until all formula parameters exist |
| `reviewCalculation` | `calc.review` | Economics calculation row | Reviewer must differ from author |
| `loadIndicatorFromSource` | `indicator.manage` | Indicator detail | Connector must support the indicator; UI disables MANUAL/EXTERNAL |
| `addIndicatorValueManually` | `indicator.manage` | **No current UI import** | Version/source note ≥3 chars; documented server-only surface |
| `runAiTier` | `ai.run` | AI workspace | Dynamic criticality/data/model eligibility; suggestion remains `PENDING` |
| `setAiVerdict` | `ai.verdict` | AI workspace | ACCEPTED/MODIFIED/REJECTED; explicit human actor is audited |
| `updateUserRole` | `admin.users` | Admin users panel | ADMIN only |
| `createDecisionBody` | `admin.bodies` | Admin bodies panel | ADMIN only |
| `setGateBlocking` | `admin.gates` | Admin gate matrix | ADMIN only |
| `createGateCheck` | `admin.gates` | Admin gate form | Adjacent lifecycle stages only |
| `deleteGateCheck` | `admin.gates` | Admin gate matrix | ADMIN only |
| `POST /api/decisions/:id/advance` | `decision.advance` | Advance button | 401 anonymous; 403 permission; 404 unknown; 409 blocked/decision-required |

All mutations call a server permission assertion and write audit evidence, except the login transport itself. Tours may demonstrate real actions only in a demo-safe scenario and must never bypass these validations for the sake of a walkthrough.

## Role-specific responsibility surfaces

The dashboard personal queue is not a cosmetic role label. It is built from open assignments, failed gate rules and pending AI verdicts:

| Role | Queue and walkthrough emphasis confirmed by code |
|---|---|
| INITIATOR | Identification, critical data linkage, alternatives/uniform criteria, assumptions, assignments with KPI, post-evaluation, returned work |
| DATA_OWNER | Only unconfirmed critical indicators actually owned by the signed-in user |
| RISK_OFFICER | Residual-risk gate and independent calculation review |
| ANALYST | Data sourcing, alternatives, assumptions, independent review and pending AI verdicts |
| SECRETARY | Route-ready transitions, return workflow, assignments/KPI |
| BOARD_MEMBER | Human decision and pending recommendation verdict; no stage-advance permission |
| ADMIN | All failed gate-rule responsibilities and pending verdicts, plus governance pages |

Recommended ROLE-tour route sequences derived from those responsibilities:

- INITIATOR: dashboard → registry/new passport → passport evidence → alternatives → assignments → post-evaluation.
- DATA_OWNER: dashboard → indicator catalogue/detail → passport DATA block → gate/audit.
- RISK_OFFICER: dashboard → passport risks/economics review → risk panel → audit.
- ANALYST: dashboard → indicators → alternatives/economics/AI → models → KPI.
- SECRETARY: dashboard → registry → passport gate/return/assignments → audit.
- BOARD_MEMBER: dashboard → registry → passport alternatives/risk/economics/AI → explicit human verdict → audit.
- ADMIN: dashboard → users/roles → bodies → gate policy → audit/models/roadmap.

These ROLE tours are cross-page scenarios. They do not replace any mandatory PAGE tour.

The THESIS layer contains two complementary narratives: `thesis-jury-methodology` follows the complete decision lifecycle, while `thesis-evidence-natures` separately distinguishes fact, forecast and assumption so users do not present unlike forms of evidence as interchangeable.

## Forms, disclosures, dialogs and drawers

### Persistent and inline forms

- Login: quick-role buttons and manual credentials form.
- Decision registry: search/basic filters and collapsible advanced filters.
- New decision: one creation form.
- Passport: block text edit, indicator link/quality confirmation, alternative, human decision, risk, assumption, calculation, independent review, assignment, AI run/verdict, lesson, close, submit, return and advance controls, each conditional by role/state.
- Indicator catalogue: search/source/criticality filters.
- Indicator detail: auto-load button; no manual-entry form is wired.
- KPI: client-side effect calculators; results are illustrative/local until saved in a decision economics workspace.
- Lessons, audit and search: GET filter/search forms.
- Admin: role selects, body form and gate-policy controls.

### Disclosure surfaces present before onboarding

- Login manual-credentials `<details>`.
- Decision registry advanced filters.
- Dashboard public-company context.
- Indicator data-quality technical configuration.
- Provenance detail disclosures wherever `Provenance` is rendered.
- Alternatives scoring detail, risk detail and economics input/review detail.
- Maturity methodology.
- Roadmap phase evidence.
- Audit and decision-audit technical before/after payloads.
- Admin technical gate code.
- Workflow return reason is an inline expanded panel, not a dialog.

### Dialog/drawer result

The pre-onboarding business UI contains no modal, dialog, drawer or popover component. Complex forms expand inline or use native `<details>`. The onboarding coach card/help panel introduces its own overlay semantics during implementation, but it is not a business dialog and must not be counted as a previously existing domain surface.

## Query-state coverage

These are not additional App Router pages, but a complete tour system must resolve them intentionally:

| Page | Query states | Coverage rule |
|---|---|---|
| Decision registry | `q`, `criticality`, `stage`, `status`, `type`, `body`, `overdue` | One PAGE tour; filtered/empty states must not break targets |
| Decision passport | `tab` plus `block` | Base passport tour, six specialist-tab tours and one dedicated `POST_EVALUATION` block tour; the Evidence Index explains all nine block kinds |
| Indicators | `q`, `source`, `critical` | One PAGE tour; filtered/empty table is a valid state |
| Lessons | `q`, `cause`, `type` | One PAGE tour; selected cause and empty result are valid states |
| Boards | `panel=strategy|investment|production|risk` | One PAGE route with four governed perspectives; tour must explain all four |
| Audit | `entity`, `action`, `actor`, `from`, `to`, `page` | One PAGE tour; empty/paginated states must remain safe |
| Search | `q` | Tour must support initial, no-match and grouped-result states |

## Stable target contract required by the brief

The following anchors are mandatory minimum contracts; selectors must not depend on Russian text or DOM position:

| Anchor | Owning screen/component |
|---|---|
| `dashboard-action-queue` | Dashboard personal queue |
| `dashboard-process-rail` | Dashboard seven-stage flow |
| `decision-criticality` | Passport Control Header |
| `decision-readiness` | Passport readiness |
| `decision-gate` | Gate checklist |
| `alternatives-status-quo` | Alternatives workspace |
| `risk-residual` | Risk workspace |
| `indicator-lineage` | Indicator detail lineage |
| `ai-recommendation` | AI workspace |
| `ai-human-verdict` | AI workspace human actions |
| `kpi-baseline` | KPI baseline/pilot frame |
| `maturity-scale` | Maturity continuum |
| `roadmap-gate` | Roadmap phase gate |

Additional required target families follow directly from the inventory: login lifecycle/role groups, shell navigation/search/help, decision registry columns, new-decision form fields, passport tabs and evidence blocks, economics inputs/results/reviews, assignments flow, audit details and admin sections.

## Documented exceptions and asymmetries

The structural matrix has one route-level PAGE exception (`/`), two non-page API exceptions, 11 role-route cells excluded by RBAC and no exception for an accessible working page.

1. **`/` has no PAGE tour.** It renders no UI and immediately redirects according to session state.
2. **API routes have no PAGE tour.** `/api/auth/[...nextauth]` is authentication transport; `/api/decisions/:id/advance` is explained through the passport gate/advance UI.
3. **404 output is not a tour route.** Unknown decision or indicator ids call `notFound()` and are not stable demonstration targets.
4. **RBAC redirects are not coverage gaps.** Non-INITIATOR/ADMIN users do not receive `/decisions/new`; non-ADMIN users do not receive `/admin`.
5. **Filters and pagination are states, not pages.** They remain inside their route's PAGE-tour obligation.
6. **Passport tabs/blocks are query states, not route exceptions.** Their complexity requires contextual definitions even though App Router sees one page pattern.
7. **Boards are competence views, not separate databases or role guards.** Any authenticated role can select any of the four panels; onboarding must not call them private role cabinets.
8. **Login is role-neutral until authentication succeeds.** Its introduction is shared/GUEST; role-specific onboarding begins on dashboard after role resolution.
9. **`aiModel.manage` and `kpi.manage` exist in RBAC without a mutation UI.** Do not coach users toward management controls that do not exist.
10. **Manual indicator input exists only as a protected server action.** There is no current component importing it, so it is not a walkthrough action.
11. **DATA_OWNER quality confirmation has an object-level rule.** The role alone is insufficient; the signed-in user must own that indicator unless ADMIN.
12. **Independent review has an object-level rule.** ANALYST/RISK_OFFICER/ADMIN cannot review their own calculation.
13. **Return status enforcement is asymmetric.** The UI exposes return only for `IN_REVIEW`; the server action validates permission/reason but does not repeat that status condition. Tours must follow the UI-supported state and not present other states as valid.
14. **All authenticated users can read all non-admin business pages.** Mutating controls differ by permission; page visibility must not be used as a proxy for authority.
15. **No pre-existing business dialogs or drawers need separate coverage.** Native details and inline expansion states do.
16. **External public-company source links leave the product.** They are supporting provenance, not additional DecisionPassport routes.

## Structural verification performed for this matrix

This document reconciles the current route inventory, route role scopes, role profiles and central registry. The resulting source-level checks are:

1. All 15 user-facing page patterns have at least one PAGE definition; `/` remains the sole non-visual page exception.
2. Dashboard resolution has one distinct ten-step PAGE definition for each of the seven authenticated roles.
3. `/decisions/new` is scoped to INITIATOR and ADMIN; `/admin` is scoped to ADMIN. The other roles retain `N/A — RBAC` rather than false PASS rows.
4. The shared login definition is `page-login` with exactly five steps.
5. The decision-passport route has one nine-step base definition and seven contextual definitions totalling 44 more registered steps: 53 across the complete route suite. Per-role runnable totals are 49–53 because action steps preserve RBAC.
6. Registry arithmetic is internally consistent: 28 PAGE / 193 steps, 7 ROLE / 58 steps and 2 THESIS / 30 steps, for 37 tours / 281 steps overall.
7. The expanded role matrix is internally consistent: 94 PASS + 11 N/A — RBAC + 7 EXCEPTION = 112 cells (7 roles × 16 route patterns).

The PASS labels above are intentionally limited to this structural reconciliation. This document does not claim production-build, visual-regression, keyboard/focus or manual-browser results; those require their own execution evidence.

## Runtime acceptance criteria outside this matrix

The following remain separate release checks and do not alter the source-coverage arithmetic above:

1. Dynamic decision and indicator routes must use valid seeded ids during ROLE/THESIS navigation.
2. Optional RBAC targets must skip without delay; required missing targets must emit diagnostics and avoid deadlock.
3. Progress must remain isolated by `userId + role + tourId + tourVersion`; complete, skip and dismiss must remain distinct.
4. Replay, role tour, methodology tour, progress display and onboarding-only reset must remain available from Help.
5. Runtime E2E must cover first visit, non-repeat after completion, replay, role variance, missing targets, route transitions and the 1366×768 viewport.
6. Visual placement and keyboard/focus behavior require browser-level verification.

## Post-implementation coverage conclusion

The application exposes one shared evidence environment to seven roles, with page-level restriction only for new-decision creation and administration. The current registry structurally covers every accessible page obligation while preserving those RBAC boundaries.

- **15/15** user-facing page patterns have PAGE coverage.
- **94/94** accessible role-route obligations are marked PASS.
- **28 PAGE tours / 193 PAGE steps** cover the route layer, including the shared five-step login, seven ten-step role-aware dashboard variants and dedicated post-evaluation context.
- **7 ROLE tours / 58 ROLE steps** explain role-specific responsibilities.
- **2 THESIS tours / 30 THESIS steps** provide the jury methodology walkthrough and a separate evidence-nature explanation.
- **37 tours / 281 steps** are registered overall.
- **1** non-visual page pattern (`/`) and **2** API patterns remain documented exceptions.
- **11** matrix cells remain `N/A — RBAC`; no accessible working page is granted a `Tour: NO` exception.
