# ROADMAP-GUI — GreenBerry Desktop (macOS)

**App:** `greenberry-frontend-macos/` (new — Tauri 2 + React + TypeScript)
**Vision:** A macOS-first clone of **Arctype** — the SQL client that "felt like Linear/VS Code": Cmd+K everywhere, Monaco editor, streaming results, spreadsheet table editing, query variables, and charts/dashboards built from queries — rebuilt on Tauri to delete Arctype's Electron weaknesses (240MB download, memory leaks, phone-home telemetry) and extended with the safety and admin features Arctype was criticized for lacking.
**Engines:** PostgreSQL, MySQL/MariaDB, SQLite, SQL Server. (Arctype never supported SQL Server — this is a deliberate extension beyond parity.)
**Relationship to the TUI:** Independent app by explicit decision — no shared packages. The TUI roadmap (`ROADMAP-TUI.md`) proceeds in parallel.

---

> Status legend: ⬜ not started · 🟡 in progress · ✅ done · ⏸️ blocked/deferred · 🟢 verified on-device

---

## Guiding principles

1. **Arctype's feel, not Electron's weight.** Time-to-first-chart in clicks; streaming results; no redraw flicker; instant Cmd+K; light+dark mode; app-wide zoom. Tauri keeps the bundle small and memory low — the polish without the tax.
2. **Fix what Arctype got wrong.** Staged edits with SQL preview instead of immediate-commit cells; FK click-through in the grid; an admin surface (sessions/kill/roles); no telemetry phoning home before the window loads; direct download, no email-gate.
3. **Query variables are the connective tissue.** `{{name}}` works in the editor, is remembered by history, and binds dashboard inputs and row-clicks to charts — Arctype's most clone-worthy interaction model.
4. **Local-first.** Credentials in the macOS keychain; queries execute locally; accounts and cloud sync are optional and deferred.

## Architecture overview

- **Shell:** Tauri 2.x, React 18+, TypeScript, Vite.
- **DB access layer (decision story S1.2):** default plan is **Rust-side drivers** invoked over Tauri IPC — `sqlx` (Postgres/MySQL/SQLite) + `tiberius` (SQL Server) — streaming rows to the webview in batches. Fallback option: Node sidecar reusing npm drivers. One engine-agnostic command API either way (`connect`, `query`, `stream`, `cancel`, `introspect`).
- **Editor:** Monaco (what Arctype used, chosen for responsiveness).
- **Grid:** virtualized custom grid (Arctype ripped out AG Grid for performance — start virtualized, e.g. TanStack Virtual).
- **Charts:** lightweight charting lib (e.g. ECharts/visx) behind a thin adapter.
- **State:** workspace store (connections, tabs, saved queries, dashboards) persisted locally (SQLite app-db or JSON), Zustand/Redux for runtime state.

---

## Epics & Stories

### E1 — Scaffold & Architecture

- ⬜ **S1.1 Tauri + React scaffold** — Project at `greenberry-frontend-macos/`, dev/build scripts, hot reload, macOS window chrome. *AC: `npm run tauri dev` opens a themed window.*
- ⬜ **S1.2 DB access layer decision spike** — Prototype Rust `sqlx` streaming vs Node sidecar; measure memory, cold start, streaming throughput; pick and document. *AC: ADR committed; 1M-row stream benchmarked.*
- ⬜ **S1.3 IPC command API** — Typed command layer (`connect/query/stream/cancel/introspect`) with error mapping and cancellation tokens. *AC: TS types generated/shared for all commands.*
- ⬜ **S1.4 Design system** — Arctype-inspired tokens: icon-rail sidebar, tab bar, pink accent for active/link states, blue selection outlines, light+dark themes, app-wide zoom (Cmd+/−), toasts with short hang-time. *AC: Storybook (or equivalent) showing core components in both themes.*
- ⬜ **S1.5 Workspace persistence** — Local store for connections, saved queries (folders), history, dashboards, settings. *AC: full state survives app restart.*
- ⬜ **S1.6 Keyboard shortcut system** — Arctype's documented set as defaults: Cmd+Enter run, Cmd+S save, Cmd+Alt+F format, Cmd+/ comment, Cmd+1–9 tabs, Cmd+0 home, Cmd+W close, Cmd+, settings, Cmd+K palette. *AC: shortcuts remappable in settings.*

### E2 — Connections

- ⬜ **S2.1 Connection modal** — Engine picker (PG/MySQL/SQLite/MSSQL), name/host/port/user/password/database, **test-then-save** flow; SQLite file picker. *AC: failed test shows driver error inline.*
- ⬜ **S2.2 Keychain credential storage** — Secrets in macOS Keychain via Tauri plugin; nothing sensitive in the workspace store. *AC: workspace file contains no plaintext secrets.*
- ⬜ **S2.3 SSL & SSH tunnels** — SSL modes + cert upload; SSH tunnel with key file (support `~` expansion — an Arctype paper cut). *AC: tunnel to remote PG with `verify-full` works.*
- ⬜ **S2.4 Environment badges** — Local/dev/staging/prod tags with colors; prod tints window chrome and gates destructive actions. *AC: prod connection is unmistakable at a glance.*
- ⬜ **S2.5 Multi-connection & status** — Several live connections; upper-right status indicator with per-database green/gray lights; database-selector dropdown on every view (Arctype 0.9.35 behavior). *AC: switching databases doesn't drop other tabs.*
- ⬜ **S2.6 URL paste-import** — Paste a connection URL to fill the modal. *AC: `postgresql://…?sslmode=require` imports fully.*
- ⬜ **S2.7 MySQL & SQL Server enablement** — Wire the MySQL and SQL Server drivers through the IPC layer end-to-end (query/stream/cancel/introspect), including engine quirks in quoting, types, and pagination. *AC: full browse + query parity with Postgres on MySQL 8 and SQL Server 2019+.*

### E3 — Workspace, Navigation & Palette

- ⬜ **S3.1 Sidebar** — Icon rail (SQL client / queries / dashboards / settings / search) expanding into panels: table list with disclosure arrows revealing columns+types, saved-queries tree with folders, history section, dashboards list. *AC: sidebar collapses; tables filterable.*
- ⬜ **S3.2 Tabbed interface** — Tabs for queries/tables/dashboards; Cmd+1–9 jump, Ctrl+Tab cycle with auto-scrolling tab bar, close-others, confirm-close only when a query is running. *AC: tab state (scroll, results) survives switching.*
- ⬜ **S3.3 Cmd+K quick find** — Fuzzy palette across tables, saved queries, dashboards, commands. *AC: results grouped by type; Enter opens in a tab.*
- ⬜ **S3.4 Async query indicators** — Queries keep running across tab switches; finished tabs show a **green dot**; results never lost. *AC: run, switch away, come back to rendered results.*
- ⬜ **S3.5 Home view & onboarding** — Cmd+0 home: recent items, connection wizard, sample-database path (bundled SQLite demo). *AC: new user reaches a grid in under 2 minutes, no account required.*

### E4 — Table Grid (Spreadsheet)

- ⬜ **S4.1 Virtualized grid** — Custom virtualized grid: frozen header, drag-resize columns (double-click boundary = snap-to-fit), smooth streaming render, distinct NULL display. *AC: no flicker at 60fps scrolling 100k buffered rows.*
- ⬜ **S4.2 Pagination** — Page buttons + jump-to-page + configurable rows-per-page (Arctype's "fast and snappy" choice over infinite scroll). *AC: page size persists per table.*
- ⬜ **S4.3 Filter & sort pills** — "Add Filter" (column/rule/value, stackable) and multi-column "Add Sort" with re-ordering; sorted columns highlighted. *AC: pills compose correct engine-specific WHERE/ORDER BY (ILIKE on PG).*
- ⬜ **S4.4 Generate SQL** — Convert applied pills into an editable query in a new editor tab. *AC: generated SQL reproduces the grid view.*
- ⬜ **S4.5 Staged editing ★** — Improvement over Arctype: inline cell edits, row insert/duplicate/delete accumulate in a **pending-changes buffer** with dirty highlighting; **SQL preview → commit (one transaction) / discard**. *AC: nothing executes until commit; failed commit rolls back with the failing statement shown.*
- ⬜ **S4.6 Cell inspector** — Right-panel inspector for long text; **JSON auto-pretty-printed, editable, with copy** ("best JSON support in a SQL client"). *AC: nested JSON editable with validation.*
- ⬜ **S4.7 Multi-cell selection & clipboard** — Click-drag selection; copy/paste to and from Excel/Sheets. *AC: rectangular paste from Sheets creates staged edits.*
- ⬜ **S4.8 FK click-through** — Gap Arctype lacked: FK cells clickable, jump to referenced row with a back stack. *AC: follow + return across schemas.*
- ⬜ **S4.9 Import/export** — Table/result export to CSV/Excel; CSV import with column mapping; **Workspace DB** (imported CSVs become queryable local tables — Arctype signature). *AC: CSV → query → chart works offline.*

### E5 — SQL Editor

- ⬜ **S5.1 Monaco integration** — Highlighting, auto-indent, Cmd+/ comment, multi-cursor (Cmd+Alt+Up/Down), find-in-query. *AC: editor stays responsive with 5k-line scripts.*
- ⬜ **S5.2 Autocomplete** — Keywords, tables, columns, alias-aware, from cached introspection. *AC: `SELECT u.` completes the aliased table's columns.*
- ⬜ **S5.3 Format SQL** — Cmd+Alt+F, cursor position preserved (Arctype fixed this deliberately). *AC: idempotent formatting.*
- ⬜ **S5.4 Execute, cancel, multi-statement** — Run/run-selection; Run button swaps to Cancel while executing; semicolon-separated scripts; rows-affected + timing. *AC: cancel interrupts promptly on all engines.*
- ⬜ **S5.5 Streaming results** — Results render in 1,000-row batches, first rows immediate, count ticking up. *AC: 1M-row query paints within 1s.*
- ⬜ **S5.6 Query variables `{{name}}` ★** — Detected variables appear as auto-typed inputs (string/number/date/boolean) in the right sidebar; values reused across runs and recorded in history. *AC: changing a variable and re-running takes one click.*
- ⬜ **S5.7 Saved queries & history** — Cmd+S save into folders; full history with timestamp/status/variable values, one-click reopen, per-item delete; version history in the right sidebar. *AC: history searchable.*
- ⬜ **S5.8 Results pane tools** — Search-filter across the result set with highlighting; ••• menu: download CSV/Excel, "Add to Dashboard", Chart tab. *AC: search matches any field.*
- ⬜ **S5.9 EXPLAIN view** — Beyond Arctype: plan tree with cost/row heat coloring per engine. *AC: seq scans flagged visually.*

### E6 — Schema Editing

- ⬜ **S6.1 Create Table form** — Name, columns (type/default/nullability), constraints, checks, FKs — no SQL required, with **Review → Apply** DDL confirmation. *AC: emitted DDL editable before apply.*
- ⬜ **S6.2 Edit Table** — Add/rename/drop columns, edit defaults/constraints/FKs; complete engine type lists (Arctype shipped with MySQL types missing — don't). *AC: multiple changes batch into one reviewed script.*
- ⬜ **S6.3 Index & constraint management** — Create/drop indexes; PK/FK/unique/check editors with referential actions. *AC: engine-correct syntax on all four engines.*
- ⬜ **S6.4 ERD view (stretch)** — Gap Arctype lacked (they shipped a Figma template instead): auto-layout diagram from introspection, click-to-open tables. *AC: renders a 50-table schema legibly.*

### E7 — Dashboards & Charts ★ Arctype's signature (later)

- ⬜ **S7.1 Chart tab on results** — Chart types (bar, line, pie, heatmap, multi-axis); **drag result columns onto X/Y axes**; chart ↔ table toggle. *AC: "chart in 2 clicks" from any result set.*
- ⬜ **S7.2 Dashboard canvas** — Snap-grid drag-and-drop; Edit Mode toggle; copy/duplicate/paste/delete components; blue selection outlines. *AC: layout persists in the workspace.*
- ⬜ **S7.3 Component library** — Charts, tables, text inputs, date pickers, buttons, progress indicators — the lightweight internal-tools pitch. *AC: input components render and hold state.*
- ⬜ **S7.4 Linking via query variables** — Bind a component's `{{variable}}` to a dashboard input or to **another table's selected row** (master-detail without code); link button gray → pink when bound. *AC: clicking a row re-drives a linked chart.*
- ⬜ **S7.5 Auto-refresh** — Per-dashboard refresh interval (default 10 min, min 1 min). *AC: refresh doesn't flicker or lose selections.*
- ⬜ **S7.6 Saved queries as chart sources** — Charts fed by saved queries; editing the query updates dependent charts. *AC: dependency surfaced in the query's sidebar.*

### E8 — Admin Features (beyond Arctype — later)

- ⬜ **S8.1 Sessions & kill** — Activity view per engine (PID/user/state/query/duration) with cancel query / terminate session. *AC: live-refreshing with filters.*
- ⬜ **S8.2 Roles & permissions** — Role list, create/alter forms, GRANT/REVOKE editor emitting reviewable SQL. *AC: applies as one reviewed script.*
- ⬜ **S8.3 Maintenance & backup** — VACUUM/ANALYZE/OPTIMIZE forms; wrap `pg_dump`/`mysqldump`/SQLite backup with progress and logs. *AC: dump + restore round-trips.*
- ⬜ **S8.4 Server metrics panel** — Sessions, TPS, sizes, slow queries — the "database health" story Arctype paywalled, local-only here. *AC: renders from system catalogs without extensions.*

### E9 — macOS Packaging & Polish

- ⬜ **S9.1 Performance budgets** — Cold start < 2s, idle memory a fraction of Electron-Arctype's, no phone-home before first paint; telemetry (if ever) opt-in. *AC: budgets measured in CI.*
- ⬜ **S9.2 Codesigning & notarization** — Signed, notarized `.dmg`/`.app`; correct /Applications behavior (no false "move to Applications" nag — an Arctype paper cut). *AC: clean install on a fresh macOS.*
- ⬜ **S9.3 Auto-updater** — Tauri updater with the pink "Update Available" affordance, restart deferrable. *AC: delta update applies on relaunch.*
- ⬜ **S9.4 Docs & direct download** — Landing/README with a **direct download link** (no email gate), keyboard-shortcut reference, changelog cadence. *AC: download → connected in under 5 minutes.*

---

## Milestones

### M0 — Scaffold (E1)
*Exit: themed Tauri window, DB-layer ADR decided and benchmarked, IPC API, design system, persistence, shortcuts.*
> S1.1–S1.6

### M1 — MVP: Connect, Browse, Query (E2 partial, E3, E4 partial, E5 partial)
Both browsing and the SQL editor, per the interview decision. Engines: **Postgres + SQLite** first.
*Exit: connect → sidebar tree → paginated grid with filter/sort pills → Monaco tab running streamed queries with history.*
> S2.1–S2.2, S2.5–S2.6 · S3.1–S3.5 · S4.1–S4.3 · S5.1, S5.4–S5.5, S5.7 (history), S5.8 (export)

### M2 — Four Engines + Safe Editing (E2 complete, E4 complete, E5 more)
*Exit: MySQL + SQL Server land; staged spreadsheet editing with SQL preview; cell inspector, FK click-through, CSV import/Workspace DB.*
> S2.3–S2.4, S2.7 · S4.4–S4.9 · S5.2–S5.3, S5.6

### M3 — Schema Editing + Power Editor (E6, E5 complete)
*Exit: create/edit tables with Review → Apply, indexes/constraints; EXPLAIN view; full saved-query/variable workflow.*
> S6.1–S6.3 (S6.4 stretch) · S5.9

### M4 — Dashboards (E7)
*Exit: charts from queries, dashboard canvas, linked inputs and master-detail, auto-refresh — Arctype's signature restored.*
> S7.1–S7.6

### M5 — Admin + Ship (E8, E9)
*Exit: sessions/kill, roles, maintenance/backup, metrics; signed, notarized, updatable release with performance budgets met.*
> S8.1–S8.4 · S9.1–S9.4

---

## Non-goals / deferred

- **Collaboration & cloud** — team workspaces, shared connections, public share links, roles/SSO, scheduled emailed queries (Arctype's paid tier). Local-first for now; the architecture keeps a sync layer possible later.
- **Web app / Windows / Linux builds** — macOS first; Tauri keeps cross-platform open.
- Plugin system, AI/NL-to-SQL, embedding/REST API.
- Engines beyond the four (ClickHouse/PlanetScale-specific integrations, Oracle).
- No code sharing with the TUI (explicit decision: independent apps — see `ROADMAP-TUI.md`).
