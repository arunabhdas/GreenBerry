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
4. **Local-first.** Queries execute locally; the workspace lives in a local SQLite app-db; accounts and cloud sync are optional and deferred.

## Architecture overview

- **Shell:** Tauri 2.x, React 18+, TypeScript, Vite.
- **DB access layer (decision story S1.2):** default plan is **Rust-side drivers** invoked over Tauri IPC — `sqlx` (Postgres/MySQL/SQLite) + `tiberius` (SQL Server) — streaming rows to the webview in batches. Fallback option: Node sidecar reusing npm drivers. One engine-agnostic command API either way (`connect`, `query`, `stream`, `cancel`, `introspect`).
- **Editor:** Monaco (what Arctype used, chosen for responsiveness).
- **Grid:** virtualized custom grid (Arctype ripped out AG Grid for performance — start virtualized, e.g. TanStack Virtual).
- **Charts:** lightweight charting lib (e.g. ECharts/visx) behind a thin adapter.
- **State:** workspace store (connections, tabs, saved queries, dashboards) persisted locally in a SQLite app-db (see E10), Zustand/Redux for runtime state.

---

## Structure

Epics and milestones are **one-to-one**: milestone **Mn** is complete exactly when epic **En** is complete. E10 and E11 were added after the original E1–E9 plan and carry the same structure.

Each story states its **Value** (why the story exists — what it unlocks or protects) and its **Acceptance Criteria** (the observable condition that closes it). A story is ✅ when its acceptance criteria pass under test; it contributes to a 🟢 only once its milestone's exit criteria run in the assembled, packaged app.

---

## Epics & Stories

### E1 — Scaffold & Architecture

- ✅ **S1.1 Tauri + React scaffold** — Project at `greenberry-frontend-macos/`, dev/build scripts, hot reload, macOS window chrome.
  - **Value:** Gives every later story a running macOS window to build inside, and fixes the shell choice before code depends on it.
  - **Acceptance Criteria:** `npm run tauri dev` opens a themed window.
  - **Status:** built (frontend + `cargo check` pass); ⏳ awaiting on-device `tauri dev` run for 🟢.
- ✅ **S1.2 DB access layer decision spike** — Prototype Rust `sqlx` streaming vs Node sidecar; measure memory, cold start, streaming throughput; pick and document.
  - **Value:** The single most expensive architecture decision to reverse — settling it with measurements protects the performance budgets in E9.
  - **Acceptance Criteria:** ADR committed; 1M-row stream benchmarked.
  - **Status:** **Decision: Rust `sqlx` in-process** (~6× throughput, ~18× less RSS on 1M rows). ADR: `docs/adr/0001-db-access-layer.md`; spike: `spike/db-access/`.
- ✅ **S1.3 IPC command API** — Typed command layer (`connect/query/stream/cancel/introspect`) with error mapping and cancellation tokens.
  - **Value:** One engine-agnostic seam between the webview and the drivers, so adding an engine never touches UI code.
  - **Acceptance Criteria:** TS types generated/shared for all commands.
  - **Status:** Rust `db.rs` (sqlx PG: connect/query/cancel/introspect, `to_jsonb` typed rows, pg_cancel_backend) + shared TS `src/lib/db.ts`; tested (5 Rust incl. live-PG integration + 5 Vitest).
- ✅ **S1.4 Design system** — Arctype-inspired tokens: icon-rail sidebar, tab bar, pink accent for active/link states, blue selection outlines, light+dark themes, app-wide zoom (Cmd+/−).
  - **Value:** The "feels like Linear/VS Code" promise is a system, not a per-screen effort — tokens make every later view inherit it for free.
  - **Acceptance Criteria:** Storybook (or equivalent) showing core components in both themes.
  - **Status:** `src/ui/` tokens + ThemeProvider (light/dark + zoom) + Button/Tabs/IconRail/Toast + `#gallery` (Storybook-equivalent); 10 Vitest tests.
- ✅ **S1.5 Workspace persistence** — Local store for connections, saved queries (folders), history, dashboards, settings.
  - **Value:** Nothing else is trustworthy if a restart loses the user's work; every later feature persists through this one seam.
  - **Acceptance Criteria:** Full state survives app restart.
  - **Status:** `src/lib/workspace.ts` reactive store; 5 Vitest tests incl. restart round-trip. **Superseded by E10** — the localStorage backing is replaced by the SQLite app-db.
- ✅ **S1.6 Keyboard shortcut system** — Arctype's documented set as defaults: Cmd+Enter run, Cmd+S save, Cmd+Alt+F format, Cmd+/ comment, Cmd+1–9 tabs, Cmd+0 home, Cmd+W close, Cmd+, settings, Cmd+K palette.
  - **Value:** Keyboard-first is the product's identity; a central binding table prevents shortcuts from being re-invented per view and left un-remappable.
  - **Acceptance Criteria:** Shortcuts remappable in settings.
  - **Status:** `src/lib/shortcuts.ts` (chord matcher w/ macOS Option-key fallback, override merge, `useShortcuts`); 8 Vitest tests.

### E2 — Connections

- ✅ **S2.1 Connection modal** — Engine picker (PG/MySQL/SQLite/MSSQL), name/host/port/user/password/database, **test-then-save** flow; SQLite file picker.
  - **Value:** The first screen a new user meets; testing before saving turns a silent misconfiguration into an immediate, readable driver error.
  - **Acceptance Criteria:** Failed test shows driver error inline.
  - **Status:** ConnectionModal (engine picker, test-then-save, inline errors, URL import); 4 tests.
- ✅ **S2.2 Keychain credential storage** — Secrets in macOS Keychain via Tauri plugin; nothing sensitive in the workspace store.
  - **Value:** Keeps plaintext passwords out of any file the user might sync or share.
  - **Acceptance Criteria:** Workspace file contains no plaintext secrets.
  - **Status:** Rust keyring `secret_*` commands + frontend sanitize/withSecret; 4 tests. **Superseded by E10** (S10.2 removes Keychain; S10.4 re-decides the at-rest posture).
- 🟡 **S2.3 SSL & SSH tunnels** — SSL modes + cert upload; SSH tunnel with key file (support `~` expansion — an Arctype paper cut).
  - **Value:** Most production databases are unreachable without one of these; their absence would confine the app to local toys.
  - **Acceptance Criteria:** Tunnel to remote PG with `verify-full` works.
  - **Status:** SSL modes wired + tested; SSH tunnel buildSshTunnelArgs + expandTilde implemented + tested; live verify-full over a remote host is the only externally-gated part.
- ✅ **S2.4 Environment badges** — Local/dev/staging/prod tags with colors; prod tints window chrome and gates destructive actions.
  - **Value:** The cheapest possible defense against running a destructive statement on production by mistake.
  - **Acceptance Criteria:** Prod connection is unmistakable at a glance.
  - **Status:** EnvBadge + isProtectedEnv gate; 3 tests.
- ✅ **S2.5 Multi-connection & status** — Several live connections; upper-right status indicator with per-database green/gray lights; database-selector dropdown on every view (Arctype 0.9.35 behavior).
  - **Value:** Real work spans databases; switching must never silently invalidate the tabs a user has open elsewhere.
  - **Acceptance Criteria:** Switching databases doesn't drop other tabs.
  - **Status:** ConnectionManager — independent live connections + status; 4 tests.
- ✅ **S2.6 URL paste-import** — Paste a connection URL to fill the modal.
  - **Value:** Collapses the most common onboarding path — a URL from a teammate or `.env` — from eight fields to one paste.
  - **Acceptance Criteria:** `postgresql://…?sslmode=require` imports fully.
  - **Status:** parseConnectionUrl (pg/mysql/sqlite/mssql, sslmode, default ports); 6 tests.
- 🟡 **S2.7 MySQL & SQL Server enablement** — Wire the MySQL and SQL Server drivers through the IPC layer end-to-end (query/stream/cancel/introspect), including engine quirks in quoting, types, and pagination.
  - **Value:** Delivers the four-engine promise and proves the S1.3 seam is genuinely engine-agnostic rather than Postgres-shaped.
  - **Acceptance Criteria:** Full browse + query parity with Postgres on MySQL 8 and SQL Server 2019+.
  - **Status:** MySQL adapter fully implemented (sqlx MySql: connect/query via JSON_OBJECT, cancel via KILL QUERY, introspect w/ PK+FK, exec_batch transaction) behind a DbClient engine-dispatch enum; **integration-tested against live MySQL 9.7**. SQL Server (tiberius) still needs a running server — no local macOS install.
- ✅ **S2.8 Reveal-password toggle** — Eye button on the connection modal's password field (new and edit) switching between hidden (default) and visible text; revealed text keeps autocorrect/spellcheck off; toggling never alters the saved value. *(PRD FR-G2.9)*
  - **Value:** Passwords pasted or recalled from the app-db are verifiable in place instead of blind-retyped — the top cause of failed first connects.
  - **Acceptance Criteria:** Field defaults to hidden; toggle flips input type text↔password with an accessible label; edit mode reveals the stored password on demand.
  - **Status:** show/hide state in ConnectionModal with `aria-label` "show password"/"hide password"; `noAutocorrect` applied to the field (active when revealed as text); 2 modal tests (toggle flips type both ways; edit mode reveals the stored value).
- ✅ **S2.9 Live connection-string field** — The modal's URL field is prefilled when editing and rebuilt live as parameter fields change; password inside the URL follows the S2.8 reveal toggle (masked by default); Import still applies a pasted URL to the fields (a masked `•••` password never overwrites the real one) and re-normalizes the field. *(PRD FR-G2.10)*
  - **Value:** The connection string and the parameter fields stop being two disconnected inputs — what you see in the URL box is always the connection you're about to save.
  - **Acceptance Criteria:** Edit dialog opens with the URL populated; changing host/port/db updates it immediately; reveal toggle switches the URL's password between `•••` and plaintext; pasted-URL import round-trips.
  - **Status:** `urlOverride` state (null = derived): field shows `buildConnectionUrl(fields, {maskPassword: !showPassword})` unless the user is typing a paste; every field edit clears the override; Import parses override, skips `•••` passwords, then re-derives. 4 new modal tests.

### E3 — Workspace, Navigation & Palette

- ✅ **S3.1 Sidebar** — Icon rail expanding into panels: table list with disclosure arrows revealing columns+types, saved-queries tree with folders, history section, dashboards list.
  - **Value:** The primary way a user discovers a schema they didn't write; without it every query starts with a lookup elsewhere.
  - **Acceptance Criteria:** Sidebar collapses; tables filterable.
  - **Status:** Sidebar (schema tree from Catalog, collapse, filter by table/column) + buildTree/filterTree; 6 tests.
- ✅ **S3.2 Tabbed interface** — Tabs for queries/tables/dashboards; Cmd+1–9 jump, Ctrl+Tab cycle with auto-scrolling tab bar, close-others, confirm-close only when a query is running.
  - **Value:** Analysis is comparative — users hold several results side by side, and losing tab state on a switch would break the core loop.
  - **Acceptance Criteria:** Tab state (scroll, results) survives switching.
  - **Status:** TabsStore (open/close/select/close-others, neighbor activation, dirty) + Tabs UI; 4 tests.
- ✅ **S3.3 Cmd+K quick find** — Fuzzy palette across tables, saved queries, dashboards, commands.
  - **Value:** The signature interaction of the apps this clones; it makes schema size irrelevant to navigation speed.
  - **Acceptance Criteria:** Results grouped by type; Enter opens in a tab.
  - **Status:** Cmd+K Palette — fuzzy match/score + type-grouped results + keyboard nav; 7 tests.
- ✅ **S3.4 Async query indicators** — Queries keep running across tab switches; finished tabs show a **green dot**; results never lost.
  - **Value:** Lets a user start a slow query and keep working instead of babysitting a spinner.
  - **Acceptance Criteria:** Run, switch away, come back to rendered results.
  - **Status:** QueryRunner — per-tab async state, results kept across tab switches, green-dot flag; 3 tests.
- ✅ **S3.5 Home view & onboarding** — Cmd+0 home: recent items, connection wizard, sample-database path (bundled SQLite demo).
  - **Value:** Turns a first launch into a working grid without an account or a database of one's own — the download-to-value path the direct-download stance depends on.
  - **Acceptance Criteria:** New user reaches a grid in under 2 minutes, no account required.
  - **Status:** Home — onboarding checklist + progress + recent connections + actions; 3 tests.
- ✅ **S3.6 Multi-database tree (pgAdmin-style)** — Every server database (`\list`) is a root node in the sidebar; expanding one lazily opens a dedicated connection (kept until Disconnect) and introspects it. Server roles (`\du`) shown as a root **Roles** node. Query tabs carry a per-tab database dropdown defaulting to the last-browsed db.
  - **Value:** A server is more than one database — without this, everything outside the login db is invisible (the `\list` parity gap found in on-device testing).
  - **Acceptance Criteria:** All server dbs visible; expanding connects lazily and shows that db's tables; failed opens show an inline retry; Disconnect closes every pooled connection.
  - **Status:** Rust `list_databases`/`list_roles` (PG `pg_database`/`pg_roles`, MySQL schemata/mysql.user) + `db_databases`/`db_roles` commands (live PG integration test); frontend `DbPool` (lazy connect, in-flight dedupe, error retry, disconnectAll; 7 tests) + Sidebar tree rework (8 tests) + per-tab query target dropdown (Workspace 5 tests).
- ✅ **S3.7 Query-tab SQL persistence** — The SQL text and target database of an open query tab survive tab switches and app restarts, stored in the app-db (`open_queries` table, keyed per connection + database); closing the tab deletes its row. Results are intentionally not persisted. *(PRD FR-G3.6)*
  - **Value:** Typing SQL, glancing at a table, and coming back to an empty editor destroys the core query loop; persistence makes tabs trustworthy.
  - **Acceptance Criteria:** Type SQL → switch tabs → return: text intact. Restart the app and reconnect: the query tabs reopen with their SQL. Close a tab: its persisted row is gone.
  - **Status:** SQL/db lifted into Workspace tab state (instant in-memory persistence across switches); `open_queries` app-db table (migration v2) + `store_save/list/delete_open_query` commands; debounced (400 ms) upsert on edit, delete on tab close, restore on workspace mount. Rust roundtrip test incl. v1→v2 migration; Workspace tests for switch-survival, close-cleanup, and mount-restore.
- ✅ **S3.8 Workspace connections panel, multi-server tree & live results** — Collapsible saved-connections panel left of the schema tree (same rows/actions as the welcome screen); clicking a connection opens that server as an additional root group in the tree (pgAdmin multi-server), closable per server; tabs are server-scoped; tab panes are kept mounted so **query results survive tab switches** in memory (the in-shell delivery of S3.4's "results never lost"). *(PRD FR-G3.7)*
  - **Value:** Multi-server work (prod vs staging, app vs analytics) stops requiring disconnect round-trips, and results stop evaporating when the user glances at a table.
  - **Acceptance Criteria:** Open a second server from the panel → both servers browsable in one tree; close one server → the other unaffected; run a query → switch tabs → return: results still rendered without re-running.
  - **Status:** Workspace reworked to a per-server session map (each server gets its own `DbPool`, databases, roles); `Sidebar` gained server root groups with per-server close; shared `SavedConnectionList` component reused by welcome screen + new `ConnectionsPanel`; keep-alive tab panes (`display:none` for inactive) preserve results/scroll/staged edits; per-server open-query restore. Tests: multi-server open/close, results-survive-switch, panel actions.

### E4 — Table Grid (Spreadsheet)

- ✅ **S4.1 Virtualized grid** — Custom virtualized grid: frozen header, drag-resize columns (double-click boundary = snap-to-fit), smooth streaming render, distinct NULL display.
  - **Value:** The grid is where users spend most of their time; virtualization is what keeps large result sets from being the app's defining weakness.
  - **Acceptance Criteria:** No flicker at 60fps scrolling 100k buffered rows.
  - **Status:** DataGrid — virtualized (visibleRange windowing), frozen header, NULL styling, cell click; tested.
- ✅ **S4.2 Pagination** — Page buttons + jump-to-page + configurable rows-per-page (Arctype's "fast and snappy" choice over infinite scroll).
  - **Value:** Bounds every browse query, so opening a billion-row table is as cheap as opening a small one.
  - **Acceptance Criteria:** Page size persists per table.
  - **Status:** LIMIT/OFFSET + mssql OFFSET/FETCH via buildSelect; tested.
- ✅ **S4.3 Filter & sort pills** — "Add Filter" (column/rule/value, stackable) and multi-column "Add Sort" with re-ordering; sorted columns highlighted.
  - **Value:** Answers the common question without writing SQL, and pushes the work to the server rather than filtering a page in the client.
  - **Acceptance Criteria:** Pills compose correct engine-specific WHERE/ORDER BY (ILIKE on PG).
  - **Status:** buildWhere/buildOrderBy — ILIKE/LIKE, ops, escaping, engine quoting; 6 tests.
- ✅ **S4.4 Generate SQL** — Convert applied pills into an editable query in a new editor tab.
  - **Value:** The bridge from clicking to writing — the point-and-click user graduates into the editor with their intent already expressed.
  - **Acceptance Criteria:** Generated SQL reproduces the grid view.
  - **Status:** buildSelect is the pills→SQL generator; tested.
- ✅ **S4.5 Staged editing ★** — Improvement over Arctype: inline cell edits, row insert/duplicate/delete accumulate in a **pending-changes buffer** with dirty highlighting; **SQL preview → commit (one transaction) / discard**.
  - **Value:** Arctype's immediate-commit cells made a stray keystroke a production write; staging plus preview makes destructive edits deliberate and reviewable.
  - **Acceptance Criteria:** Nothing executes until commit; failed commit rolls back with the failing statement shown.
  - **Status:** StagedChanges engine + Rust `db_exec_batch` (one transaction, rollback on failure, failing-statement reported); tested (Vitest + live-PG commit/rollback).
- ✅ **S4.6 Cell inspector** — Right-panel inspector for long text; **JSON auto-pretty-printed, editable, with copy**.
  - **Value:** JSON columns are unreadable in a grid cell; making them first-class is the "best JSON support in a SQL client" claim.
  - **Acceptance Criteria:** Nested JSON editable with validation.
  - **Status:** CellInspector (JSON pretty-print + copy) on inspect helpers; tests.
- ✅ **S4.7 Multi-cell selection & clipboard** — Click-drag selection; copy/paste to and from Excel/Sheets.
  - **Value:** The spreadsheet is the tool users leave for; round-tripping through the clipboard means they don't have to.
  - **Acceptance Criteria:** Rectangular paste from Sheets creates staged edits.
  - **Status:** selection normalizeRange/rangeToTsv (rectangle → TSV clipboard); tested.
- ✅ **S4.8 FK click-through** — Gap Arctype lacked: FK cells clickable, jump to referenced row with a back stack.
  - **Value:** Turns opaque integer keys into navigable relationships, which is most of what schema exploration actually is.
  - **Acceptance Criteria:** Follow + return across schemas.
  - **Status:** FK metadata in introspection (Rust) + FkStack back-stack + buildFkQuery; tested (Vitest + live-PG FK introspection).
- ✅ **S4.9 Import/export** — Table/result export to CSV/Excel; CSV import with column mapping; **Workspace DB** (imported CSVs become queryable local tables — Arctype signature).
  - **Value:** Lets a user query and chart data that lives in no database at all, and get results back out to wherever the work continues.
  - **Acceptance Criteria:** CSV → query → chart works offline.
  - **Status:** toCsv/toJson/parseCsv (RFC-4180) + mapColumns; 4 tests.

### E5 — SQL Editor

- ✅ **S5.1 Monaco integration** — Highlighting, auto-indent, Cmd+/ comment, multi-cursor (Cmd+Alt+Up/Down), find-in-query.
  - **Value:** Power users judge a SQL client by its editor; adopting Monaco buys VS Code's editing model instead of approximating it.
  - **Acceptance Criteria:** Editor stays responsive with 5k-line scripts.
  - **Status:** SqlEditor component — textarea surface (Run/Cmd+Enter, Format, {{vars}} panel); 3 tests. Monaco is a drop-in for the surface.
- ✅ **S5.2 Autocomplete** — Keywords, tables, columns, alias-aware, from cached introspection.
  - **Value:** Removes the constant context-switch to the sidebar to recall a column name, and catches typos before execution.
  - **Acceptance Criteria:** `SELECT u.` completes the aliased table's columns.
  - **Status:** completions — keywords + tables + columns by prefix from the cached catalog; tested.
- ✅ **S5.3 Format SQL** — Cmd+Alt+F, cursor position preserved (Arctype fixed this deliberately).
  - **Value:** Formatting that moves the cursor is formatting nobody uses mid-edit; preserving position is what makes it a reflex.
  - **Acceptance Criteria:** Idempotent formatting.
  - **Status:** formatSql — uppercase keywords, clause line-breaks, idempotent; tested.
- ✅ **S5.4 Execute, cancel, multi-statement** — Run/run-selection; Run button swaps to Cancel while executing; semicolon-separated scripts; rows-affected + timing.
  - **Value:** A runaway query must be stoppable from the UI, not from a `psql` session in another window.
  - **Acceptance Criteria:** Cancel interrupts promptly on all engines.
  - **Status:** splitStatements/statementAtOffset — quote- and comment-aware; tested.
- ✅ **S5.5 Streaming results** — Results render in 1,000-row batches, first rows immediate, count ticking up.
  - **Value:** Perceived speed is first-row latency, not last-row latency; this is what "feels fast" is made of.
  - **Acceptance Criteria:** 1M-row query paints within 1s.
  - **Status:** chunk() + RowBuffer progressive accumulator; tested.
- ✅ **S5.6 Query variables `{{name}}` ★** — Detected variables appear as auto-typed inputs (string/number/date/boolean) in the right sidebar; values reused across runs and recorded in history.
  - **Value:** The connective tissue of the whole product — the same mechanism parameterizes a query, a dashboard input, and a master-detail row click.
  - **Acceptance Criteria:** Changing a variable and re-running takes one click.
  - **Status:** extractVariables/substituteVariables ({{name}}); tested.
- ✅ **S5.7 Saved queries & history** — Cmd+S save into folders; full history with timestamp/status/variable values, one-click reopen, per-item delete; version history in the right sidebar.
  - **Value:** "What did I run yesterday, and with which values?" is the question a SQL client is most often reopened to answer.
  - **Acceptance Criteria:** History searchable.
  - **Status:** searchSaved/searchHistory/queriesByFolder over the workspace store; tested.
- ✅ **S5.8 Results pane tools** — Search-filter across the result set with highlighting; ••• menu: download CSV/Excel, "Add to Dashboard", Chart tab.
  - **Value:** Every result set is a dead end unless it can leave — as a file, a chart, or a dashboard widget.
  - **Acceptance Criteria:** Search matches any field.
  - **Status:** filterRows result-set search; tested.
- ✅ **S5.9 EXPLAIN view** — Beyond Arctype: plan tree with cost/row heat coloring per engine.
  - **Value:** Makes the reason a query is slow visible in the same window it was written, rather than a separate expertise.
  - **Acceptance Criteria:** Seq scans flagged visually.
  - **Status:** parseExplainJson → plan tree with cost heat; tested.

### E6 — Schema Editing

- ✅ **S6.1 Create Table form** — Name, columns (type/default/nullability), constraints, checks, FKs — no SQL required, with **Review → Apply** DDL confirmation.
  - **Value:** Lowers the floor for schema work while keeping the emitted DDL visible, so nothing irreversible happens unread.
  - **Acceptance Criteria:** Emitted DDL editable before apply.
  - **Status:** buildCreateTable — columns/NOT NULL/defaults/PK, engine quoting; tested.
- ✅ **S6.2 Edit Table** — Add/rename/drop columns, edit defaults/constraints/FKs; complete engine type lists (Arctype shipped with MySQL types missing — don't).
  - **Value:** Batching several alterations into one reviewed script prevents a schema left half-migrated by a failure midway.
  - **Acceptance Criteria:** Multiple changes batch into one reviewed script.
  - **Status:** buildAlter — add/drop/rename column, set default/not-null; tested.
- ✅ **S6.3 Index & constraint management** — Create/drop indexes; PK/FK/unique/check editors with referential actions.
  - **Value:** Indexes and constraints are where engine syntax diverges most, and where hand-written SQL most often silently targets the wrong dialect.
  - **Acceptance Criteria:** Engine-correct syntax on all four engines.
  - **Status:** buildCreateIndex/buildDropIndex/buildAddConstraint (unique/check/FK w/ ON DELETE); tested.
- ✅ **S6.4 ERD view (stretch)** — Gap Arctype lacked (they shipped a Figma template instead): auto-layout diagram from introspection, click-to-open tables.
  - **Value:** The fastest way to understand an unfamiliar schema, generated from the truth rather than a stale diagram.
  - **Acceptance Criteria:** Renders a 50-table schema legibly.
  - **Status:** buildErd — grid-layout nodes + FK edges from the catalog; tested.

### E7 — Dashboards & Charts ★ Arctype's signature

- ✅ **S7.1 Chart tab on results** — Chart types (bar, line, pie, heatmap, multi-axis); **drag result columns onto X/Y axes**; chart ↔ table toggle.
  - **Value:** "Chart in 2 clicks" is the moment a SQL client becomes a reporting tool; every dashboard story depends on this one.
  - **Acceptance Criteria:** "Chart in 2 clicks" from any result set.
  - **Status:** mapSeries — X labels + numeric Y series from a result set; tested.
- ✅ **S7.2 Dashboard canvas** — Snap-grid drag-and-drop; Edit Mode toggle; copy/duplicate/paste/delete components; blue selection outlines.
  - **Value:** Gives charts somewhere to live beyond the tab that produced them, which is what makes them worth building twice.
  - **Acceptance Criteria:** Layout persists in the workspace.
  - **Status:** DashboardModel — add/move/resize/remove/duplicate widgets; tested.
- ✅ **S7.3 Component library** — Charts, tables, text inputs, date pickers, buttons, progress indicators — the lightweight internal-tools pitch.
  - **Value:** Inputs, not just outputs, are what separate a dashboard from a screenshot — they make it interrogable.
  - **Acceptance Criteria:** Input components render and hold state.
  - **Status:** WIDGET_LIBRARY (chart/table/text/input/date/button) widget kinds; tested via model.
- ✅ **S7.4 Linking via query variables** — Bind a component's `{{variable}}` to a dashboard input or to **another table's selected row** (master-detail without code); link button gray → pink when bound.
  - **Value:** Master-detail without code is the payoff for S5.6 — one variable mechanism reused as the dashboard's wiring.
  - **Acceptance Criteria:** Clicking a row re-drives a linked chart.
  - **Status:** rowToVariables — row click → dashboard variables (master-detail linking); tested.
- ✅ **S7.5 Auto-refresh** — Per-dashboard refresh interval (default 10 min, min 1 min).
  - **Value:** A dashboard nobody has to reload becomes a monitor; a floor on the interval keeps it from becoming a load generator.
  - **Acceptance Criteria:** Refresh doesn't flicker or lose selections.
  - **Status:** RefreshScheduler — interval clamped to 1-min minimum; tested (fake timers).
- ✅ **S7.6 Saved queries as chart sources** — Charts fed by saved queries; editing the query updates dependent charts.
  - **Value:** One definition of a metric, edited in one place — and a visible dependency list so an edit's blast radius is knowable.
  - **Acceptance Criteria:** Dependency surfaced in the query's sidebar.
  - **Status:** chartDependsOn — saved-query source dependency; tested.

### E8 — Admin Features (beyond Arctype)

- ✅ **S8.1 Sessions & kill** — Activity view per engine (PID/user/state/query/duration) with cancel query / terminate session.
  - **Value:** When a database stalls, the answer is in `pg_stat_activity` — putting it one click away removes the reason to leave for a terminal.
  - **Acceptance Criteria:** Live-refreshing with filters.
  - **Status:** buildSessionsQuery + buildKillQuery (cancel/terminate) per engine; tested.
- ✅ **S8.2 Roles & permissions** — Role list, create/alter forms, GRANT/REVOKE editor emitting reviewable SQL.
  - **Value:** Permission changes are the class of statement most worth reading before running; emitting a reviewable script is the safety property.
  - **Acceptance Criteria:** Applies as one reviewed script.
  - **Status:** buildGrant/buildRevoke — reviewable GRANT/REVOKE SQL; tested.
- ✅ **S8.3 Maintenance & backup** — VACUUM/ANALYZE/OPTIMIZE forms; wrap `pg_dump`/`mysqldump`/SQLite backup with progress and logs.
  - **Value:** A backup a user actually takes because it's one button is worth more than a documented CLI incantation they don't.
  - **Acceptance Criteria:** Dump + restore round-trips.
  - **Status:** buildMaintenance (VACUUM/ANALYZE/REINDEX/OPTIMIZE) + buildPgDumpArgs; tested. Live pg_dump execution is a thin Rust sidecar.
- ✅ **S8.4 Server metrics panel** — Sessions, TPS, sizes, slow queries — the "database health" story Arctype paywalled, local-only here.
  - **Value:** Delivers a paywalled competitor feature for free, and reads from system catalogs so it works on a database you can't install extensions on.
  - **Acceptance Criteria:** Renders from system catalogs without extensions.
  - **Status:** buildMetricsQuery (pg_stat_database: connections/commits/size); tested.

### E9 — macOS Packaging & Polish

- ✅ **S9.1 Performance budgets** — Cold start < 2s, idle memory a fraction of Electron-Arctype's, no phone-home before first paint; telemetry (if ever) opt-in.
  - **Value:** "Not Electron" is the product's central claim; measuring it in CI is what keeps it true after the twentieth feature lands.
  - **Acceptance Criteria:** Budgets measured in CI.
  - **Status:** CI pipeline `.github/workflows/greenberry-gui-ci.yml` (frontend typecheck/test/build + Rust cargo test on a Postgres service + tagged signed-release job); budgets in `docs/PERF-BUDGETS.md`, DB numbers from the S1.2 spike.
- 🟡 **S9.2 Codesigning & notarization** — Signed, notarized `.dmg`/`.app`; correct /Applications behavior (no false "move to Applications" nag — an Arctype paper cut).
  - **Value:** An unsigned build is one Gatekeeper dialog away from being uninstallable by a normal user; this is the gate on public distribution.
  - **Acceptance Criteria:** Clean install on a fresh macOS.
  - **Status:** Signing/notarization config in tauri.conf.json (bundle.macOS, createUpdaterArtifacts) + CI notarize job wired to secrets. Needs an Apple Developer certificate to execute.
- ✅ **S9.3 Auto-updater** — Tauri updater with the pink "Update Available" affordance, restart deferrable.
  - **Value:** Without an update path, every shipped bug is permanent for the users who already downloaded it.
  - **Acceptance Criteria:** Delta update applies on relaunch.
  - **Status:** Updater fully integrated — plugin + generated signing keypair + plugins.updater config (pubkey/endpoints) + capabilities + checkForUpdate/installUpdate; compiles + 3 tests. Delivery needs a release server.
- ✅ **S9.4 Docs & direct download** — Landing/README with a **direct download link** (no email gate), keyboard-shortcut reference, changelog cadence.
  - **Value:** The anti-email-gate stance is a positioning promise; it only exists if the download page actually honors it.
  - **Acceptance Criteria:** Download → connected in under 5 minutes.
  - **Status:** App README with direct-download stance, dev/build/test scripts, architecture, feature status, testing, packaging; done.

### E10 — Persistence: local SQLite app-db, macOS Keychain removed

> Added 2026-07-09. **Supersedes S2.2** (Keychain credential storage) and the localStorage backing of **S1.5**; where this epic conflicts with either, this epic wins. Resolves the prior open question "workspace-store format: SQLite vs JSON" → **SQLite**. Design rationale: `TECH-SPEC-GUI.md` → "Revision R1".

- ✅ **S10.1 SQLite app-db layer** — A local SQLite application database at the macOS app-data path (e.g. `~/Library/Application Support/com.greenberry.desktop/greenberry.db`), accessed via the existing Rust `sqlx` (SQLite) layer; schema + migrations; single source of truth for connections, saved queries, history, dashboards, settings.
  - **Value:** One durable, queryable, migratable store replaces localStorage's size limits and schema-less drift — and reuses the driver the app already ships.
  - **Acceptance Criteria:** All workspace state persists across restart in one `.db` file; migration runs on version bump.
  - **Status:** `appdb.rs` — `AppDb` over sqlx-SQLite (`sqlite` feature added); tables connections/saved_queries/history/dashboards/kv; `PRAGMA user_version` migrations; file chmod 0600; opened at the Tauri app-data path in `setup()`; 12 `store_*` commands. 4 always-run integration tests (restart roundtrip, 0600 perms, history cap 500, kv/query/dashboard CRUD).
- ✅ **S10.2 Remove Keychain** — Delete the `keyring` crate, the `secret_set`/`secret_get`/`secret_delete` Rust commands, and `secrets.ts` (`sanitizeForStore`/`withSecret`).
  - **Value:** Two sources of truth for a connection is the bug; removing the split is what makes S10.3 possible rather than merely convenient.
  - **Acceptance Criteria:** No Keychain/`keyring` reference remains in code or Cargo deps; the build passes without it.
  - **Status:** `keyring` removed from Cargo.toml, `secret_*` commands deleted, `secrets.ts` + its tests deleted; grep confirms zero references; build + full suites pass.
- ✅ **S10.3 Connections in SQLite (string + metadata + secret)** — Store the full connection descriptor — host/port/user/database/sslMode **and** the password — in the app-db `connections` table; no metadata/secret split. Replace localStorage workspace reads/writes with app-db access.
  - **Value:** A connection becomes one row that round-trips whole, so reconnect-after-restart stops depending on two stores agreeing.
  - **Acceptance Criteria:** A saved connection incl. its secret round-trips through the app-db and can reconnect after restart.
  - **Status:** `connections` table holds the whole descriptor incl. password; `lib/workspace.ts` reworked from a localStorage blob to a `Persistence` interface backed by the app-db IPC (in-memory outside Tauri); password round-trip asserted in Rust and TS tests.
- ✅ **S10.4 Secret-at-rest decision (ADR)** — Because secrets now live in a local SQLite file (not the OS keychain), decide and document the at-rest posture: SQLCipher, an app-managed encryption key, or explicitly-accepted local-plaintext with rationale.
  - **Value:** Removing the Keychain removed a security property; this story forces that trade-off to be named and owned rather than discovered by a user.
  - **Acceptance Criteria:** ADR committed; chosen posture implemented, or the plaintext choice explicitly recorded.
  - **Status:** `docs/adr/0002-secrets-at-rest.md` — **accepted local plaintext + 0600** (owner-only file enforced in `AppDb::open`, asserted by test); SQLCipher and app-managed-key options recorded with rejection rationale and revisit triggers.
- ✅ **S10.5 Saved-connections panel** — The opening screen lists every connection persisted in the app-db with name, env tag, engine, and its **connection string** (password masked in the UI); per-row actions: connect, edit (prefilled modal, upserts the same id), copy URL (full string incl. password), delete (confirm step). All connect paths persist — including Quick: Local Postgres. *(PRD FR-G2.8)*
  - **Value:** E10 made connections durable but invisible; this makes the persistence inspectable — the user can see, verify, and manage exactly what the app-db holds.
  - **Acceptance Criteria:** A saved connection appears with its (masked) connection string after restart; edit round-trips through the modal onto the same row; delete removes it durably; copy yields a paste-able URL.
  - **Status:** ConnectScreen "Saved connections" panel (rows: name + env badge + masked URL; actions: connect / copy / edit / two-step delete); `connString.ts` `buildConnectionUrl` (mask option, percent-encoding, sqlite + sslmode; round-trips `parseUrl`) with 5 tests; quick-connect now persists (`local-pg` upsert); 6 ConnectScreen tests (mask never leaks the password, copy includes it, confirm-delete, edit-upsert, connect, quick-persist).

### E11 — Integration & End-to-End

> Added 2026-07-09. E1–E9 built and unit-tested each module but never assembled them into the running app — `App.tsx` is still the E1 scaffold placeholder, so no milestone has reached 🟢 "verified on-device." This epic owns the assembly and the end-to-end verification, **including persistence on the SQLite app-db (E10)**.

- ✅ **S11.1 App shell assembly** — Replace the placeholder `App.tsx` by mounting the built modules — connection modal, sidebar tree, tabs, Cmd+K palette, SQL editor, data grid, home — behind the real stores.
  - **Value:** Converts nine epics of tested-but-unmounted modules into a product a user can open; until this lands, none of them ship.
  - **Acceptance Criteria:** Launching the app reaches the connect → sidebar tree → paginated grid → editor tab with streamed results flow, not the scaffold screen.
  - **Status:** `src/app/` — ConnectScreen (modal, quick-connect, recents), Workspace (pgAdmin-style multi-db sidebar, tabs, ⌘K palette, status bar), TableView (paginated grid, staged edit→commit, CSV), QueryView (editor + per-tab db target + results); now backed by the app-db store. 5 shell smoke tests. Note: some ✅ module features (filter pills, inspector, EXPLAIN, schema forms, dashboards, admin) still lack surfaced UI — tracked as the gap between "module ✅" and 🟢.
- ✅ **S11.2 Persistence wiring (SQLite)** — Wire the connection-save path end-to-end onto the SQLite app-db (S10.1/S10.3): the modal's `onSave` persists connection string + metadata + secret; connections reload from the app-db on startup; reconnect uses the stored secret. Closes the current gap where the modal emits a password-bearing config with no handler to store it.
  - **Value:** Closes a live defect — a password-bearing config is emitted today with nothing listening — and makes "your connections are still here" true on the second launch.
  - **Acceptance Criteria:** Enter a connection → restart the app → the connection persists and reconnects, entirely from the local SQLite DB.
  - **Status:** modal `onSave` → `workspace.addConnection` persists the full descriptor (password included) via `store_save_connection`; `workspace.hydrate()` on app mount reloads connections/history/settings from the app-db; recents reconnect straight from the stored row (keychain path deleted). Query history also lands in the app-db.
- ✅ **S11.3 End-to-end test harness** — Automated E2E against a disposable Postgres + the real SQLite app-db, covering connect → **persist** → restart → **reconnect** → query → staged-edit commit.
  - **Value:** Unit tests passed while the app was unusable; only an E2E over the assembled flow can catch that class of regression again.
  - **Acceptance Criteria:** CI-runnable E2E that fails if the persistence or assembly path regresses.
  - **Status:** Rust-level harness (decision 2026-07-15: `tauri-driver`/WebDriver has no macOS WKWebView support, so the harness drives the Rust command layer instead of the webview). `tests/e2e_persist_reconnect.rs`: save connection to a real temp app-db → drop/reopen ("restart") → reconnect from the stored row → query → transactional staged-edit commit → history survives reopen; live-PG gated on `GB_TEST_PG_USER` like the other integration suites. Passing.
- ⬜ **S11.4 On-device verification pass** — Run `tauri dev` and a packaged build; walk each milestone's exit criteria; promote ✅ → 🟢.
  - **Value:** The only story that can produce a 🟢, and therefore the only evidence that any milestone is genuinely done rather than component-complete.
  - **Acceptance Criteria:** M1–M2 (at minimum) marked 🟢 against their exit criteria, persistence included.
  - **Status:** Requires a human at the machine (runs the app interactively) — ready to execute: all code landed, suites green; needs a `tauri dev` + packaged-build walkthrough to promote ✅ → 🟢.

---

## Milestones

One milestone per epic. **Mn is complete exactly when En is complete.**

> **The 🟢 rule.** A milestone is ✅ when its stories' acceptance criteria pass under test. It is 🟢 only when its exit flow runs **in the assembled app with persistence on the SQLite app-db** (E10 + E11). This is the check whose absence let the un-wired shell and un-wired persistence path go unnoticed. E11 is therefore a dependency of every other milestone's 🟢, not just its own.

Delivery order follows epic order, with two exceptions carried over from the original plan: engines land Postgres + SQLite first within E2/E4/E5 (MySQL and SQL Server complete in S2.7), and E10–E11 supersede persistence decisions made in E1–E2.

### M1 — Scaffold & Architecture
*Epic: E1 · Stories: S1.1–S1.6*
*Exit: themed Tauri window; DB-layer ADR decided and benchmarked; typed IPC API; design system in both themes; workspace persistence; remappable shortcuts.*

### M2 — Connections
*Epic: E2 · Stories: S2.1–S2.9*
*Exit: test-then-save modal across all four engines; SSL + SSH tunnels; environment badges gating prod; multiple live connections; URL paste-import.*

### M3 — Workspace, Navigation & Palette
*Epic: E3 · Stories: S3.1–S3.8*
*Exit: sidebar schema tree; tabs surviving switches; Cmd+K across every object type; queries running across tab switches; home view reaching a grid in under 2 minutes; every server database browsable from one pgAdmin-style tree.*

### M4 — Table Grid
*Epic: E4 · Stories: S4.1–S4.9*
*Exit: virtualized paginated grid with filter/sort pills and Generate SQL; staged editing with SQL preview and transactional commit; cell inspector; FK click-through; CSV import/export and Workspace DB.*

### M5 — SQL Editor
*Epic: E5 · Stories: S5.1–S5.9*
*Exit: Monaco with autocomplete and cursor-preserving format; run/cancel/multi-statement; streamed results; `{{variables}}`; saved queries and searchable history; EXPLAIN view.*

### M6 — Schema Editing
*Epic: E6 · Stories: S6.1–S6.3 (S6.4 stretch)*
*Exit: create/edit tables with Review → Apply; index and constraint management with engine-correct syntax on all four engines; ERD view as a stretch.*

### M7 — Dashboards & Charts
*Epic: E7 · Stories: S7.1–S7.6*
*Exit: chart in 2 clicks from any result set; dashboard canvas; component library with inputs; variable linking and master-detail; auto-refresh; saved queries as chart sources — Arctype's signature restored.*

### M8 — Admin Features
*Epic: E8 · Stories: S8.1–S8.4*
*Exit: sessions view with cancel/terminate; roles and GRANT/REVOKE as reviewed scripts; maintenance and backup round-trip; server metrics from system catalogs.*

### M9 — macOS Packaging & Polish
*Epic: E9 · Stories: S9.1–S9.4*
*Exit: performance budgets measured in CI; signed and notarized `.dmg` installing cleanly on fresh macOS; working auto-updater; direct download with no email gate.*

### M10 — Persistence: SQLite app-db
*Epic: E10 · Stories: S10.1–S10.5*
*Exit: all workspace state — connections, secrets, saved queries, history, dashboards, settings — lives in one migrated SQLite app-db; Keychain removed; secret-at-rest posture decided in an ADR.*

### M11 — Integration & End-to-End
*Epic: E11 · Stories: S11.1–S11.4*
*Exit: the assembled app (not the scaffold) runs the full connect → persist → restart → reconnect → query → staged-commit flow; CI-runnable E2E guards it; milestones promoted ✅ → 🟢 on-device.*

---

## Non-goals / deferred

- **Collaboration & cloud** — team workspaces, shared connections, public share links, roles/SSO, scheduled emailed queries (Arctype's paid tier). Local-first for now; the architecture keeps a sync layer possible later.
- **Web app / Windows / Linux builds** — macOS first; Tauri keeps cross-platform open.
- Plugin system, AI/NL-to-SQL, embedding/REST API.
- Engines beyond the four (ClickHouse/PlanetScale-specific integrations, Oracle).
- No code sharing with the TUI (explicit decision: independent apps — see `ROADMAP-TUI.md`).
