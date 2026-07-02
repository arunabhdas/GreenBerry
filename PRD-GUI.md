# PRD-GUI — GreenBerry Desktop for macOS

| | |
|---|---|
| **Product** | GreenBerry Desktop — a macOS database client & admin GUI |
| **Codebase** | `greenberry-frontend-macos/` (Tauri 2 + React + TypeScript) |
| **Companion docs** | `ROADMAP-GUI.md` (epics E1–E9, milestones M0–M5) · `PRD-TUI.md` (sibling product) |
| **Status** | Draft v1 — July 2026 |
| **Owner** | GreenBerry / OffsideAI |

---

## 1. Overview

GreenBerry Desktop is a macOS-first database client and admin tool modeled on **Arctype** — the SQL client acquired by ClickHouse in 2022 and discontinued, remembered as "the SQL client that felt like Linear/VS Code." Arctype's users lost a product with a Cmd+K palette, a Monaco editor with streaming results, spreadsheet-style table editing, `{{query variables}}`, and charts/dashboards built directly from queries. Nothing on the market has fully replaced that combination.

GreenBerry Desktop rebuilds it on **Tauri 2** (not Electron), supports **PostgreSQL, MySQL/MariaDB, SQLite, and SQL Server**, and extends it with the safety features (staged edits with SQL preview) and admin surface (sessions, roles, backups) that Arctype was most criticized for lacking.

**This PRD is the "what and why."** The "when and in what order" lives in `ROADMAP-GUI.md`; every functional section below cites the epic that implements it, and §12 maps releases to roadmap milestones.

## 2. Goals & non-goals

### Goals

1. **G1 — Restore Arctype's core experience** on modern foundations: palette-driven navigation, fast query editor, spreadsheet grid, query variables, dashboards.
2. **G2 — Beat Arctype where it failed**: native-feeling performance and memory (Tauri vs Electron), staged writes with SQL preview, FK navigation, admin capabilities, no telemetry-before-first-paint, direct download.
3. **G3 — Four engines, one UX**: PostgreSQL (reference), MySQL/MariaDB, SQLite, SQL Server behind one engine-agnostic command API. (Arctype never shipped SQL Server; we do.)
4. **G4 — Local-first**: credentials in the macOS Keychain, queries executed locally, no account required, cloud features deferred.

### Non-goals (v1)

- Team collaboration/cloud sync (shared workspaces, public links, SSO, scheduled emailed queries) — Arctype's paid tier; architecture must not preclude it, but it is out of scope. *(ROADMAP-GUI.md "Non-goals")*
- Windows/Linux builds, web app.
- Engines beyond the four (ClickHouse, Oracle, MongoDB); plugin system; AI/NL-to-SQL; embedding/REST API.
- Code sharing with the TUI — the two apps are independent by explicit decision (see `PRD-TUI.md`).

## 3. Target users & personas

1. **Priya — product engineer (primary).** Queries app databases daily (Postgres in prod, SQLite locally). Wants Cmd+K, fast grid, safe edits on prod data. Currently juggles TablePlus + psql. Success: she stops opening TablePlus.
2. **Marco — data-inclined founder/analyst (secondary).** Lives in the dashboards half: builds a chart from a query in two clicks, pins it, checks it every morning. Arctype refugee. Success: he builds an internal ops dashboard without Metabase.
3. **Sam — accidental DBA (secondary).** The engineer on the team who kills stuck queries, adds indexes, and runs backups. pgAdmin annoys them; Arctype couldn't do the job at all. Success: kill query / roles / backup without leaving GreenBerry.

## 4. Competitive positioning

| Product | What it owns | Why GreenBerry wins |
|---|---|---|
| **TablePlus** | Native speed, staged edits, minimal UI | No dashboards/variables; per-seat license; conservative feature velocity |
| **pgAdmin 4** | Full Postgres admin depth | Dated web-app UX, Postgres-only, no spreadsheet feel |
| **Beekeeper Studio** | Open-source, cross-platform | Electron; weaker polish/keyboard model than Arctype's |
| **Arctype (dead)** | The whole playbook this PRD follows | It no longer exists; Electron + telemetry + no admin were its flaws |

Positioning statement: *"The Arctype you remember, native-fast, with the admin features it never had."*

## 5. Product principles

1. **Palette-first.** Anything reachable in ≤2 Cmd+K keystrokes. Every action has a shortcut (§11).
2. **Preview before mutate.** No SQL executes from a GUI affordance without the user being able to see it first. Data edits stage into a reviewed commit; DDL forms end in Review → Apply.
3. **Streaming, never spinning.** First rows in under a second; progress is shown as data, not spinners.
4. **Prod is visually loud.** Environment badges tint the chrome; destructive actions on prod-tagged connections escalate confirmation.
5. **Local-first, silent by default.** No network calls before first paint; telemetry (if ever) opt-in.

---

## 6. Functional requirements — foundation

Requirement IDs are `FR-G<section>.<n>`. Priority: **P0** = MVP-blocking, **P1** = v1.0, **P2** = post-1.0.

### 6.1 Application shell & architecture *(→ ROADMAP-GUI.md Epic E1, stories S1.1–S1.6)*

- **FR-G1.1 (P0)** Tauri 2.x shell with React 18 + TypeScript + Vite; native macOS window chrome, traffic lights, full-size content view.
- **FR-G1.2 (P0)** Engine-agnostic **IPC command API**: `connect`, `disconnect`, `query`, `stream`, `cancel`, `introspect`, `testConnection` — typed end-to-end (TS types generated from or checked against the Rust command signatures), structured error envelope (code, engine message, hint, failing SQL), cancellation tokens. *(E1/S1.3)*
- **FR-G1.3 (P0)** **DB access layer** per the E1/S1.2 ADR: default Rust-side drivers — `sqlx` (Postgres, MySQL, SQLite) + `tiberius` (SQL Server) — streaming rows to the webview in batches; Node-sidecar fallback documented in the ADR if the spike disqualifies sqlx.
- **FR-G1.4 (P0)** **Workspace persistence**: connections (metadata only — secrets go to Keychain), saved queries in folders, query history, dashboards, window state, and settings persist locally and survive restart. *(E1/S1.5)*
- **FR-G1.5 (P0)** **Design system** implementing §10, with light + dark themes and app-wide zoom (Cmd+= / Cmd+−). *(E1/S1.4)*
- **FR-G1.6 (P1)** Component gallery route (Storybook-equivalent) rendering every core component in both themes for design QA. *(E1/S1.4 AC)*

### 6.2 Connection management *(→ ROADMAP-GUI.md Epic E2, stories S2.1–S2.7)*

- **FR-G2.1 (P0)** Connection modal with engine picker (PostgreSQL, MySQL/MariaDB, SQLite, SQL Server); fields per engine (host, port with correct defaults 5432/3306/1433, user, password, database; file picker for SQLite); **Test → Save** flow with inline driver errors.
- **FR-G2.2 (P0)** Secrets stored in the **macOS Keychain**; the workspace store never contains plaintext credentials.
- **FR-G2.3 (P0)** **Environment tags** (Local / Dev / Staging / Prod) with colors; prod tints the window chrome and participates in the confirmation escalation of FR-G7.4.
- **FR-G2.4 (P0)** Paste-import from connection URL (`postgresql://…`, `mysql://…`, including query params like `sslmode`).
- **FR-G2.5 (P1)** SSL modes + certificate upload; SSH tunnels with key-file auth (with `~` expansion — an Arctype paper cut we fix).
- **FR-G2.6 (P1)** Multiple simultaneous live connections; upper-right status indicator with per-database green/gray lights; a database-selector dropdown on every query/table view (Arctype 0.9.35 behavior).
- **FR-G2.7 (P1)** MySQL and SQL Server wired end-to-end through the same command API with engine quirks handled (quoting, types, pagination). *(E2/S2.7)*

### 6.3 Workspace, navigation & command palette *(→ ROADMAP-GUI.md Epic E3, stories S3.1–S3.5)*

- **FR-G3.1 (P0)** **Left sidebar**: icon rail (SQL client / Queries / Dashboards / Settings / Search) expanding into panels — table list with disclosure arrows revealing columns + types inline, saved-queries tree with folders, history section, dashboards list. Filter box on the table list.
- **FR-G3.2 (P0)** **Tabs** for queries, tables, and dashboards: Cmd+1–9 jump, Cmd+0 home, Ctrl+Tab cycle (tab bar auto-scrolls to keep the active tab visible), Cmd+W close, right-click → close others; confirm-close only when a query is running.
- **FR-G3.3 (P0)** **Cmd+K Quick Find**: fuzzy search across tables, saved queries, dashboards, and app commands; results grouped by type; Enter opens in a tab. Sub-50ms result rendering from cached catalog + workspace index.
- **FR-G3.4 (P0)** **Async query indicators**: queries keep running when the user switches tabs; a finished tab shows a **green dot**; results are never discarded on tab switch.
- **FR-G3.5 (P1)** **Home view** (Cmd+0): recent items, connection wizard, bundled SQLite sample database ("open sample" path). No account, no email gate. New-user time-to-first-grid target: < 2 minutes.

---

## 7. Functional requirements — data workflows

### 7.1 Table grid (spreadsheet) *(→ ROADMAP-GUI.md Epic E4, stories S4.1–S4.9)*

- **FR-G4.1 (P0)** **Virtualized grid**: frozen header, drag-resize columns (double-click boundary = snap-to-fit), 60fps scrolling with no flicker over ≥100k buffered rows, `NULL` rendered distinctly from empty string.
- **FR-G4.2 (P0)** **Pagination**: page buttons + jump-to-page + configurable rows-per-page (default 300; persisted per table). Explicit paging, not infinite scroll (Arctype's deliberate performance choice).
- **FR-G4.3 (P0)** **Filter & sort pills**: stackable filters (column / operator / value; case-insensitive match uses ILIKE on PG and engine equivalents elsewhere) and multi-column sort with drag re-ordering; sorted columns get highlighted headers.
- **FR-G4.4 (P0)** **Generate SQL**: one click converts the current pills into an editable query in a new editor tab that reproduces the grid exactly.
- **FR-G4.5 (P0)** **Staged editing** ★ (fixes Arctype's immediate-commit weakness): inline cell edits, row insert/duplicate/delete accumulate in a **pending-changes buffer**; dirty cells highlighted; **SQL preview** panel shows exact generated statements; **Commit** applies in a single transaction, **Discard** reverts; a failed commit rolls back entirely and surfaces the failing statement. Editing is disabled (read-only badge) when the table lacks a usable primary key.
- **FR-G4.6 (P0)** **Cell Inspector** (right panel): view/edit long text; JSON auto-pretty-printed, editable with validation, copy button. Target: "best JSON support in a SQL client."
- **FR-G4.7 (P1)** Multi-cell click-drag selection; copy/paste rectangular ranges to/from Excel/Google Sheets; pasted data lands as staged edits.
- **FR-G4.8 (P1)** **FK click-through** (gap Arctype lacked): FK cells are affordanced; click jumps to the referenced row with a back stack.
- **FR-G4.9 (P1)** Export table or filtered result to CSV/Excel; **CSV import** with column-mapping UI; **Workspace DB** — imported CSVs become locally queryable tables (Arctype signature enabling "CSV → query → chart" offline).

### 7.2 SQL editor *(→ ROADMAP-GUI.md Epic E5, stories S5.1–S5.9)*

- **FR-G5.1 (P0)** **Monaco** editor: syntax highlighting per engine dialect, auto-indent, Cmd+/ comment toggle, multi-cursor (Cmd+Alt+Up/Down), find-in-query (Cmd+F). Responsive with 5k-line scripts.
- **FR-G5.2 (P0)** Execute: run all / run selection; Run button swaps to **Cancel** while executing; semicolon-separated multi-statement scripts; rows-affected + timing per statement.
- **FR-G5.3 (P0)** **Streaming results**: batches of 1,000 rows; first rows paint immediately; row count ticks up live. 1M-row query paints within 1s.
- **FR-G5.4 (P0)** History: every executed statement logged with timestamp, duration, status, and **the query-variable values used**; searchable; one-click reopen into a tab; per-item delete + clear all.
- **FR-G5.5 (P0)** Saved queries: Cmd+S with folder organization; version history in the right sidebar.
- **FR-G5.6 (P1)** **Autocomplete**: keywords, tables, columns; **alias-aware** (`SELECT u.` completes the aliased table's columns); fed by the cached introspection catalog, never blocking keystrokes.
- **FR-G5.7 (P1)** Format SQL (Cmd+Alt+F) preserving cursor position; idempotent.
- **FR-G5.8 (P1)** **Query variables `{{name}}`** ★: detected variables render as auto-typed inputs (string/number/date/boolean) in the right sidebar; values persist across runs and are recorded in history; variables are the binding mechanism for dashboards (§7.4).
- **FR-G5.9 (P1)** Results pane tools: search-filter across the result set with highlighting; ••• menu → Download CSV/Excel, **Add to Dashboard**, Chart tab (§7.4).
- **FR-G5.10 (P2)** **EXPLAIN view** (beyond Arctype): plan tree with per-node cost/rows/time and heat coloring; engine-specific formats (PG `EXPLAIN (FORMAT JSON)`, MySQL `EXPLAIN FORMAT=JSON`, MSSQL showplan).

### 7.3 Schema management *(→ ROADMAP-GUI.md Epic E6, stories S6.1–S6.4)*

- **FR-G6.1 (P1)** **Create Table form**: name, columns (engine-complete type lists — Arctype shipped MySQL with missing types; we must not), defaults, nullability, PK, checks, FKs — ending in **Review → Apply**: the generated DDL is shown, editable as SQL, then executed.
- **FR-G6.2 (P1)** **Edit Table**: add/rename/drop columns, change types/defaults/constraints/FKs; multiple changes batch into one reviewed DDL script.
- **FR-G6.3 (P1)** Index & constraint management: create/drop indexes; PK/FK/unique/check editors with referential-action pickers; engine-correct syntax on all four engines.
- **FR-G6.4 (P2)** **ERD view** (stretch; gap Arctype never filled): auto-layout diagram from introspection, click-to-open tables, legible at 50 tables.

### 7.4 Dashboards & charts ★ Arctype's signature *(→ ROADMAP-GUI.md Epic E7, stories S7.1–S7.6)*

- **FR-G7.1 (P1)** **Chart tab** on any result set: bar, line, pie, heatmap, multi-axis; configure by **dragging result columns onto X/Y axis wells**; chart ↔ table toggle in place. "Chart in 2 clicks."
- **FR-G7.2 (P1)** **Dashboard canvas**: snap-grid drag-and-drop; Edit Mode toggle; copy/duplicate/paste/delete components; blue selection outlines; layout persisted in the workspace.
- **FR-G7.3 (P1)** Component library: charts, result tables, **text inputs, date pickers, buttons, progress indicators** — the "lightweight internal tools" pitch.
- **FR-G7.4 (P1)** **Linking via query variables**: a component whose query uses `{{var}}` exposes a link button (gray → pink when bound) connectable to a dashboard input or to **another table's selected row** — master-detail without code.
- **FR-G7.5 (P2)** Auto-refresh per dashboard (default 10 min, min 1 min) without flicker or selection loss.
- **FR-G7.6 (P2)** Saved queries as chart sources; editing the query updates dependent charts, and the dependency is surfaced on the query.
- Charting must follow the repo's dataviz conventions (consistent palette, light/dark correctness) — see the `dataviz` skill guidance when implementing.

### 7.5 Admin features (beyond Arctype) *(→ ROADMAP-GUI.md Epic E8, stories S8.1–S8.4)*

- **FR-G8.1 (P1)** **Sessions & kill**: live activity view per engine (PID/user/state/query/duration, filterable) with cancel-query and terminate-session actions.
- **FR-G8.2 (P2)** **Roles & permissions**: role list, create/alter forms, GRANT/REVOKE editor — all emitting a single reviewable SQL script before execution.
- **FR-G8.3 (P2)** Maintenance & backup: VACUUM/ANALYZE/OPTIMIZE forms; orchestrate `pg_dump`/`mysqldump`/SQLite backup with progress and logs; dump + restore must round-trip.
- **FR-G8.4 (P2)** **Server metrics panel**: sessions, TPS, database sizes, slow queries — from system catalogs, no extensions required, local-only (the "database health" story Arctype paywalled).

---

## 8. Safety model

*(implemented across E4/S4.5, E2/S2.4, E6 Review→Apply, E8)*

1. **Staged writes everywhere.** Grid edits (FR-G4.5) and schema forms (FR-G6.1/6.2) never execute directly; both funnel through an SQL preview.
2. **Environment escalation.** On prod-tagged connections: destructive statements (DELETE/DROP/TRUNCATE/UPDATE without WHERE) require an explicit typed confirmation; window chrome is tinted.
3. **Read-only awareness.** Tables without usable PKs are read-only in the grid with a visible badge; editable-vs-locked state is always displayed.
4. **Transaction integrity.** A staged commit is one transaction; partial failure = full rollback + failing statement surfaced.

## 9. Technical architecture requirements

*(→ ROADMAP-GUI.md E1/S1.2 ADR + E1/S1.3)*

- **TA-1** Tauri 2.x, React 18+, TypeScript strict, Vite.
- **TA-2** Rust core: `sqlx` (PG/MySQL/SQLite) + `tiberius` (MSSQL) unless the S1.2 spike ADR concludes otherwise; row streaming over Tauri events in 1,000-row batches; per-query cancellation tokens.
- **TA-3** Introspection cached per connection (tables, columns, PKs/FKs, types) with incremental refresh; powers sidebar, palette, autocomplete, FK-follow.
- **TA-4** Workspace store: local (SQLite app-db or JSON) at the platform app-data path; schema versioned for migrations.
- **TA-5** No network requests before first paint (no update check, no telemetry, no Intercom-style widget). Updater runs only after UI is interactive (FR in §12/E9).
- **TA-6** Editor: Monaco. Grid: custom virtualized (TanStack Virtual or equivalent) — no AG Grid (Arctype removed it for performance).

## 10. Design & UX specification

*(→ ROADMAP-GUI.md E1/S1.4; source: Arctype design-language research)*

- **Layout**: icon rail + expandable sidebar panels; tab bar; contextual **right sidebar** that changes by context (query variables, cell inspector, chart config, version history).
- **Accent language**: pink accent for active/link states (Arctype's signature), blue selection outlines on canvas components; medium density — roomier than TablePlus, far cleaner than pgAdmin.
- **Themes**: light + dark, switchable and OS-synced; every component ships in both (gallery FR-G1.6 is the enforcement mechanism).
- **Micro-interactions**: toasts with short hang-time; a pink "Update Available" chip that never forces restart; green dot on tabs with finished queries.
- **Onboarding**: first-run → connection wizard or bundled sample database; zero account; "fun to use" tone in empty states.
- Keyboard shortcut defaults (remappable in Settings → Shortcuts, persisted via FR-G1.4):

| Action | Default |
|---|---|
| Command palette / Quick Find | Cmd+K |
| Run query / selection | Cmd+Enter |
| Save query | Cmd+S |
| Format SQL | Cmd+Alt+F |
| Comment toggle | Cmd+/ |
| Find in editor | Cmd+F |
| Multi-cursor | Cmd+Alt+Up/Down |
| Go to tab / home | Cmd+1–9 / Cmd+0 |
| Close tab | Cmd+W |
| Settings | Cmd+, |
| App zoom | Cmd+= / Cmd+− |

## 11. Performance & quality budgets

*(→ ROADMAP-GUI.md E9/S9.1; measured in CI)*

| Metric | Budget |
|---|---|
| Cold start to interactive | < 2s |
| Idle memory (1 connection) | < 250MB (vs Electron-Arctype's reputation) |
| First rows of any query | < 1s (streamed) |
| Grid scroll | 60fps, no flicker, 100k buffered rows |
| Cmd+K result render | < 50ms |
| Installer size | A fraction of Arctype's 240MB |

## 12. Release plan (traceability to roadmap milestones)

| Release | Roadmap milestone | Contents (FR sections) |
|---|---|---|
| 0.1 internal | **M0** (E1) | §6.1 shell, IPC, persistence, design system, shortcuts |
| 0.2 MVP | **M1** (E2–E5 partial) | §6.2 connections (PG+SQLite), §6.3 navigation, §7.1 grid (browse), §7.2 editor (run/stream/history) |
| 0.3 | **M2** (E2 complete, E4 complete, E5 more) | MySQL + MSSQL, §7.1 staged editing + inspector + FK follow + import, autocomplete + variables |
| 0.4 | **M3** (E6, E5 complete) | §7.3 schema editing, EXPLAIN |
| 0.5 | **M4** (E7) | §7.4 dashboards & charts |
| 1.0 | **M5** (E8, E9) | §7.5 admin, signed/notarized distribution, budgets green |

## 13. Success metrics

- Activation: ≥60% of first-time opens reach a rendered data grid (target < 2 min).
- Retention proxy: ≥3 sessions/week for active users by 1.0.
- Safety: zero data-loss reports attributable to GUI edit flows (staged-commit model).
- Performance: all §11 budgets green in CI at every release.
- Qualitative: "Arctype replacement" appears organically in user feedback.

## 14. Risks & open questions

| Risk | Mitigation |
|---|---|
| `sqlx` lacks a MSSQL driver — `tiberius` has a different API shape | S1.2 spike covers both; adapter trait isolates per-engine differences |
| Monaco inside Tauri webview perf | Spike in M0; fallback CodeMirror 6 |
| Dashboards scope creep (Retool gravity) | E7 gated to M4; component library capped at the Arctype set |
| Keychain access in dev vs signed builds | Test unsigned-dev keychain flow early in M0 |
| Grid + streaming complexity underestimated | It's the product; budgeted as two epics (E4, E5) and benchmarked from M1 |

**Open questions** (to resolve by end of M1): exact workspace-store format (SQLite vs JSON); whether Workspace DB (CSV import target) uses the app-db or a per-workspace SQLite file; minimum supported macOS version.
