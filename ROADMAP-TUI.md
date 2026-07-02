# ROADMAP-TUI — GreenBerry Terminal Database Client

**App:** `greenberry-frontend-tui/greenberrytui/` (Ink 4 + React 18 + TypeScript)
**Vision:** A terminal database admin & table editor — pgAdmin's admin depth and Arctype's polish, delivered with k9s/lazygit ergonomics. The unclaimed lane in the current TUI landscape (pgcli/rainfrog/lazysql/harlequin) is the **admin lane**: safe staged editing with SQL preview, schema editing as forms that emit reviewable DDL, role management, backup orchestration, and live server ops. GreenBerry TUI claims it.
**Engines (day one architecture):** PostgreSQL, MySQL/MariaDB, SQLite, SQL Server — behind a driver adapter interface. Postgres is the reference implementation and always lands features first.

---

## Guiding principles

1. **Safety before speed of destruction.** Every write is staged, previewed as SQL, and committed explicitly (the TablePlus "pending changes" model — the #1 gap in existing TUIs). Read-only mode, environment badges (prod = red), and safe-mode confirmation levels are first-class.
2. **k9s/lazygit conventions.** Focusable panes cycled with Tab/number keys, vim keys everywhere (hjkl, `/` filter, `gg`/`G`), context-sensitive `?` help overlay, colon-commands plus a fuzzy Ctrl+P/Cmd+K-style palette, `$EDITOR` escape hatch.
3. **Respect existing config.** `.pgpass`, `PG*` env vars, service files, MySQL option files; never require passwords on argv; OS keychain for stored secrets.
4. **Feels instant.** Streamed results, virtualized rendering, async queries with completion indicators, cached catalog introspection (never pgcli-style keystroke catalog scans).
5. **Terminal citizenship.** Works over SSH and inside tmux; mouse optional; respects terminal theme; fast startup.

## Architecture overview

- **Driver adapter layer** (`src/db/`): one interface (`connect`, `query`, `stream`, `cancel`, `introspect`, `quoteIdent`, `buildDDL`…) with engine implementations: `pg`/`pg-cursor` (installed already), `mysql2`, `better-sqlite3`, `mssql`. Engine capability flags gate UI features (e.g., EXPLAIN formats, RLS, roles).
- **Introspection catalog** (`src/db/catalog/`): async, cached, per-engine queries against `pg_catalog` / `information_schema` / `sqlite_master` / `sys.*`; feeds tree, autocomplete, and object search.
- **Staged-changes engine** (`src/sql/`): builds parameterized UPDATE/INSERT/DELETE and DDL from grid/form edits; renders SQL preview; applies in a transaction.
- **UI kit** (`src/ui/`): fills the existing empty stubs — `DataTable`, `SelectableList`, `LineEditor` — plus `Tree`, `Palette`, `StatusBar`, `HelpOverlay`, `Tabs`.
- **Existing assets:** `app.tsx` three-pane focus layout is the seed of the shell; `greenberry-deprecated-terminal/` (prediction-markets app) is a styling/pattern reference only.

---

## Epics & Stories

Status: `[ ]` todo · `[~]` in progress · `[x]` done

### E1 — Foundation & App Shell

- [ ] **S1.1 Layout system** — Resizable/focusable pane grid (sidebar / main / detail / status bar) replacing the demo panes in `app.tsx`; panes register titles and keymaps. *AC: Tab and number keys move focus; layout adapts to terminal resize.*
- [ ] **S1.2 Keybinding registry + `?` help overlay** — Central keymap (global + per-pane), user-remappable via config file. *AC: `?` shows context-sensitive bindings for the focused pane.*
- [ ] **S1.3 Command palette & colon-commands** — Fuzzy palette (Arctype Cmd+K analog) over commands, tables, saved queries; k9s-style `:` prompt; psql `\d`/`\dt`/`\l` aliases as palette synonyms. *AC: `:tables users` and `\dt` both open the table list.*
- [ ] **S1.4 Config & theming** — `~/.config/greenberry/config.toml` (or JSON): keymaps, theme, defaults (row limit, safe-mode level). *AC: config round-trips; sane defaults with no file present.*
- [ ] **S1.5 Status bar & notifications** — Connection name + env badge, transaction state, async-job indicators, transient toasts. *AC: running query shows spinner; finished background query shows a green-dot style marker.*
- [ ] **S1.6 Testing harness** — Fix broken `test.tsx` (imports non-existent `source/app.js`); establish ava + ink-testing-library patterns; CI-runnable `npm test`. *AC: suite passes and covers the shell.*
- [ ] **S1.7 Error & logging framework** — Central error surface (no silent failures), debug log file. *AC: driver errors render in a dismissible panel with the failing SQL.*

### E2 — Connections & Drivers

- [ ] **S2.1 Driver adapter interface** — The engine-agnostic contract + capability flags. *AC: adapters compile against one interface; UI reads capabilities, not engine names.*
- [ ] **S2.2 Postgres adapter** — `pg` + `pg-cursor`: query, streaming, cancel (`pg_cancel_backend`/native), error mapping. *AC: SELECT/DML/DDL round-trip; large results stream.*
- [ ] **S2.3 SQLite adapter** — `better-sqlite3`; file-open flow. *AC: open a `.db` file and browse it.*
- [ ] **S2.4 MySQL/MariaDB adapter** — `mysql2`. *AC: parity with S2.2 acceptance on MySQL 8.*
- [ ] **S2.5 SQL Server adapter** — `mssql`/tedious. *AC: parity on SQL Server 2019+.*
- [ ] **S2.6 Connection profiles** — Named profiles with engine, host, port, db, user, groups, **environment tag + color** (local/dev/staging/prod). *AC: prod-tagged connection renders a red badge everywhere.*
- [ ] **S2.7 Credential handling** — OS keychain storage; respect `.pgpass`, `PG*` env, pg service files, MySQL option files; passwords never on argv. *AC: connecting with only `.pgpass` present works; nothing secret in shell history.*
- [ ] **S2.8 URL paste-import** — Paste `postgresql://…`/`mysql://…` to fill a profile. *AC: URL with SSL params imports correctly.*
- [ ] **S2.9 SSH tunnel & SSL** — Tunnel via `~/.ssh/config` or explicit key; SSL modes per engine. *AC: connect through a tunnel to a remote PG with `verify-full`.*
- [ ] **S2.10 Connection lifecycle UI** — Connect/disconnect/switch; multiple simultaneous connections; per-connection status. *AC: two live connections, palette switches between them.*

### E3 — Schema Browser

- [ ] **S3.1 Introspection catalog service** — Async cached introspection per engine; incremental refresh. *AC: 1,000-table database loads the tree without blocking input.*
- [ ] **S3.2 Object tree** — databases → schemas → tables/views/materialized views/functions/sequences/indexes/triggers (per engine capability); `/` filter-in-place; system-objects toggle. *AC: hjkl navigation; expanding a table shows columns + types inline.*
- [ ] **S3.3 DDL pane** — Reverse-engineered CREATE statement for any selected object. *AC: table DDL includes constraints and indexes; yankable.*
- [ ] **S3.4 Object detail tabs** — pgAdmin's universal pattern: Properties / DDL / Statistics / Dependencies per object. *AC: tabs render for tables, views, functions.*
- [ ] **S3.5 Fuzzy object search** — Palette-integrated search across all object names with type filter; Enter jumps to object. *AC: sub-100ms results from the cached catalog.*
- [ ] **S3.6 Table utility actions** — Count rows, truncate (safe-mode gated), refresh, script-to-editor (SELECT/INSERT/UPDATE skeletons). *AC: "Script SELECT" opens a populated editor tab.*

### E4 — Data Grid (Browse)

- [ ] **S4.1 Virtualized DataTable component** — Fills the `src/ui/DataTable.tsx` stub: frozen header, column sizing, horizontal scroll, cell/row/block selection, distinct NULL rendering. *AC: smooth scrolling over 100k buffered rows.*
- [ ] **S4.2 LIMIT pagination** — Page controls + jump-to-page + configurable page size (default 300). *AC: page state shown in status bar.*
- [ ] **S4.3 Sort & filter pills** — Multi-column sort; stackable column/operator/value filters (AND/OR) — Arctype-style pills adapted to a filter bar. *AC: filters compose into correct WHERE per engine.*
- [ ] **S4.4 "Generate SQL" escape hatch** — Convert current filters/sorts into an editable query in the SQL editor. *AC: generated SQL reproduces the grid exactly.*
- [ ] **S4.5 Cell inspector** — Detail panel for long text; JSON/JSONB pretty-print with fold/unfold; row-as-form view. *AC: a jsonb cell opens as a navigable tree.*
- [ ] **S4.6 FK follow** — FK cells marked; keybinding jumps to the referenced row (and back). *AC: follow + return works across schemas.*
- [ ] **S4.7 Yank & export** — Yank cell/row/selection as CSV/TSV/JSON/INSERT; export result set to CSV/JSON file. *AC: copy-as-INSERT emits valid engine-quoted SQL.*

### E5 — Data Editing (Staged Writes) ★ differentiator

- [ ] **S5.1 Pending-changes buffer** — Edits staged, never immediate; dirty cells highlighted; changes survive scrolling/paging. *AC: no SQL executes until commit.*
- [ ] **S5.2 Inline cell editing** — Type-aware editors (text, number, bool, date, enum, JSON); explicit set-NULL vs empty string. *AC: editing respects column types; invalid input flagged pre-commit.*
- [ ] **S5.3 Row operations** — Insert, duplicate, delete (multi-select) into the staged buffer. *AC: deleted rows render struck-through until commit.*
- [ ] **S5.4 SQL preview + commit/discard** — Review panel showing exact generated statements; commit applies in one transaction; discard reverts. *AC: failed commit rolls back entirely and reports the failing statement.*
- [ ] **S5.5 Read-only & safe mode** — Session read-only toggle; escalating safe-mode levels (silent → confirm non-SELECT → typed confirmation on prod-tagged connections). *AC: prod + safe mode requires typing the table name to truncate.*
- [ ] **S5.6 Editable query results** — Stage edits on SELECT results when a single table + full PK is present; lock otherwise (pgAdmin's updatable-results rule). *AC: non-updatable results clearly marked read-only.*

### E6 — SQL Editor

- [ ] **S6.1 Multi-tab editor** — Tabs with rename/close; per-tab connection + database. *AC: two tabs on different engines run concurrently.*
- [ ] **S6.2 LineEditor / buffer component** — Fills `src/ui/LineEditor.tsx`: multi-line editing, syntax highlighting, vim-modal + emacs-style bindings. *AC: modal editing togglable in config.*
- [ ] **S6.3 Autocomplete** — Keywords, tables, columns, alias-aware, from the cached catalog (never blocking keystrokes). *AC: `SELECT u.` completes columns of the aliased table.*
- [ ] **S6.4 Execute & cancel** — Run all / run selection / cursor-statement; Run↔Cancel swap; rows-affected + timing; multiple result sets in tabs. *AC: cancel interrupts a `pg_sleep(60)` promptly.*
- [ ] **S6.5 Streaming results** — Batched rendering (first rows immediate, count ticking up) via cursors per engine. *AC: 1M-row query shows first page in <1s without exhausting memory.*
- [ ] **S6.6 Transaction control** — Auto-commit toggle, manual BEGIN/COMMIT/ROLLBACK, always-visible transaction state (harlequin's model). *AC: status bar shows `TXN` in manual mode with pending work.*
- [ ] **S6.7 History & saved queries** — Persistent history (query, timestamp, duration, status, variable values); saved queries in folders bound to palette keywords. *AC: history search + re-open into a tab.*
- [ ] **S6.8 Query variables `{{name}}`** — Arctype signature, TUI-adapted: variables detected, prompted/edited in a side panel, values remembered per query. *AC: re-running reuses last values; types auto-detected.*
- [ ] **S6.9 `$EDITOR` escape hatch** — Open the current buffer in `$EDITOR`, reload on save. *AC: round-trip preserves content exactly.*
- [ ] **S6.10 SQL formatting** — Format/beautify keeping cursor position. *AC: idempotent on already-formatted SQL.*
- [ ] **S6.11 EXPLAIN view** — EXPLAIN / EXPLAIN ANALYZE rendered as a collapsible tree with cost/rows/timing heat-coloring (depesz-style; per-engine formats). *AC: seq scans on large tables visually flagged.*
- [ ] **S6.12 Result search & export** — `/` search across the result set with highlight; export CSV/JSON. *AC: search jumps between matches.*

### E7 — Schema Editing (DDL as Forms)

- [ ] **S7.1 Create-table form** — Name/schema/columns (type, nullability, default, PK) with **Review → Apply** DDL confirmation (Arctype's flow). *AC: emitted DDL shown before execution; editable as SQL first.*
- [ ] **S7.2 Alter-table operations** — Add/rename/drop column, change type/default/nullability — staged as reviewable DDL. *AC: multiple alterations batch into one reviewed script.*
- [ ] **S7.3 Index management** — List/create/drop indexes (method, columns, unique, partial where supported). *AC: create-index emits engine-correct syntax.*
- [ ] **S7.4 Constraint management** — PK/FK/unique/check forms with referential-action pickers. *AC: FK form validates referenced columns from the catalog.*
- [ ] **S7.5 View / sequence / trigger dialogs** — Create/edit views and sequences; view + enable/disable triggers. *AC: per engine capability flags.*
- [ ] **S7.6 Drop with dependency awareness** — Drop object shows dependents (cascade option, safe-mode gated). *AC: dropping a table lists dependent views first.*

### E8 — Admin & DBA (pgAdmin depth — later)

- [ ] **S8.1 Sessions/activity view** — Live `pg_stat_activity` (and engine equivalents): PID, user, state, wait, query, duration; filter; **cancel query / terminate backend**. *AC: k9s-style live-refreshing list.*
- [ ] **S8.2 Locks view** — Current locks with blocking-chain rendering. *AC: blocker/blockee relationships visible.*
- [ ] **S8.3 Roles & privileges** — Role list, create/alter role forms (login, superuser, membership), GRANT/REVOKE editor emitting reviewable SQL; RLS policy viewing (PG). *AC: grant wizard batch-applies across selected objects.*
- [ ] **S8.4 Maintenance operations** — VACUUM/ANALYZE/REINDEX (PG), OPTIMIZE/ANALYZE (MySQL), VACUUM (SQLite) with streamed verbose output. *AC: long-running maintenance shows progress and is cancelable.*
- [ ] **S8.5 Backup & restore orchestration** — Wrap `pg_dump`/`pg_restore`/`mysqldump`/SQLite backup with option forms, background execution, progress, and logs. *AC: custom-format PG dump + selective restore round-trips.*
- [ ] **S8.6 Import/export data** — Engine-native bulk COPY/LOAD with CSV column mapping. *AC: 1M-row CSV imports with progress.*
- [ ] **S8.7 Server config & logs** — GUC/variables browser; tail server logs where accessible. *AC: searchable settings with non-default values highlighted.*
- [ ] **S8.8 Monitoring dashboard** — Sparkline/braille graphs: TPS, sessions, tuples in/out, block I/O; per-DB sizes; bloat estimates. *AC: refreshes on an interval without flicker.*

### E9 — Polish & Distribution

- [ ] **S9.1 Performance hardening** — Large-catalog and large-result benchmarks; input latency budget. *AC: no keystroke lag with 5k tables / 1M-row results.*
- [ ] **S9.2 Packaging** — npm/npx install path; evaluate single-binary bundling (bun/pkg) to match Go/Rust competitors. *AC: `npx greenberry` works cold.*
- [ ] **S9.3 Docs & demo** — README, keybinding reference, animated demo (VHS), sample SQLite demo database. *AC: new user reaches a data grid in <2 minutes.*
- [ ] **S9.4 Release cadence** — Versioning, changelog, CI release pipeline. *AC: tagged releases with changelogs (abandonment distrust is real — see gobang).*

---

## Milestones

### M0 — Shell (E1)
The app shell replaces the current demo: layout system, keybindings + help overlay, palette, config, status bar, testing harness. *Exit: navigable empty shell with passing tests.*
> S1.1–S1.7

### M1 — MVP: Connect, Browse, Query (E2 partial, E3 partial, E4 partial, E6 partial)
Per the interview decision, the MVP includes **both** table browsing and the SQL editor. Engines: **Postgres + SQLite** first (fastest path to real + local testing).
*Exit: connect to PG or a SQLite file → tree → read-only paginated grid with sort/filter → run SQL in a tab and see streamed results.*
> S2.1–S2.3, S2.6–S2.8, S2.10 · S3.1–S3.3, S3.5 · S4.1–S4.3, S4.7 · S6.1–S6.4, S6.7 (history only)

### M2 — Four Engines + Safe Editing (E2 complete, E5, E4 complete)
MySQL and SQL Server adapters land; the staged-writes differentiator ships with safe mode.
*Exit: edit a cell on any engine, review the SQL, commit in a transaction; prod-tagged connections demand confirmation.*
> S2.4–S2.5, S2.9 · S4.4–S4.6 · S5.1–S5.6

### M3 — Power SQL + Schema Editing (E6 complete, E7, E3 complete)
*Exit: autocomplete, EXPLAIN tree, query variables, `$EDITOR`, transactions; create/alter tables and indexes via reviewed DDL.*
> S6.5–S6.6, S6.8–S6.12 · S7.1–S7.6 · S3.4, S3.6

### M4 — Admin Lane (E8)
*Exit: sessions with kill, roles/grants, maintenance, backup/restore, monitoring — "pgAdmin in the terminal."*
> S8.1–S8.8

### M5 — Ship It (E9)
*Exit: packaged, documented, benchmarked, released.*
> S9.1–S9.4

---

## Non-goals / deferred

- Collaboration server, cloud sync, shared workspaces (GUI-roadmap territory, and even there deferred).
- Dashboards/charts in the terminal (Arctype's dashboards stay a GUI feature; the TUI gets EXPLAIN trees and monitoring sparklines only).
- Plugin system, AI/NL-to-SQL, PL/pgSQL debugger, pgAgent scheduling, cloud-provisioning wizards.
- Engines beyond the four (ClickHouse, Oracle, Mongo) — the adapter interface keeps the door open.
- No shared code with `greenberry-frontend-macos` (explicit decision: independent apps).
