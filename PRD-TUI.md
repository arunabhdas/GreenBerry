# PRD-TUI — GreenBerry Terminal Database Client

| | |
|---|---|
| **Product** | GreenBerry TUI — a terminal database admin & table editor |
| **Codebase** | `greenberry-frontend-tui/greenberrytui/` (Ink 4 + React 18 + TypeScript) |
| **Companion docs** | `ROADMAP-TUI.md` (epics E1–E9, milestones M0–M5) · `PRD-GUI.md` (sibling product) |
| **Status** | Draft v1 — July 2026 |
| **Owner** | GreenBerry / OffsideAI |

---

## 1. Overview

GreenBerry TUI is a full-screen terminal database client: **pgAdmin's admin depth and Arctype's product sensibility, delivered with k9s/lazygit ergonomics**, for engineers who live in the terminal, work over SSH, and distrust Electron.

The landscape research behind this product (pgcli, rainfrog, lazysql, harlequin, gobang, dblab, pspg, sabiql) found a crowded browse-lane and query-lane but an **unclaimed admin lane**: no terminal tool offers trustworthy staged editing with SQL preview, schema editing as forms that emit reviewable DDL, role management, backup orchestration, or live server ops. rainfrog literally warns users not to write to production; lazysql's staged edits are alpha-quality. The "k9s for Postgres" idea is constantly invoked in these communities and never built. GreenBerry TUI claims that lane — across **PostgreSQL, MySQL/MariaDB, SQLite, and SQL Server**.

**This PRD is the "what and why."** Sequencing lives in `ROADMAP-TUI.md`; every functional section cites its epic, and §12 maps releases to roadmap milestones.

## 2. Goals & non-goals

### Goals

1. **G1 — Own the terminal admin lane**: safe staged writes, DDL-as-forms, roles/grants, maintenance, backup/restore, session management — none of which exist in current TUIs.
2. **G2 — Table-stakes parity, done right**: connection profiles with secure credentials, schema tree, filterable data grid, SQL editor with history and non-blocking autocomplete, CSV export, vim keys, read-only mode — the features every surviving TUI has, without pgcli's catalog-scan lag or rainfrog's credential-on-argv leak.
3. **G3 — Four engines, one keyboard model**: Postgres (reference, always first), MySQL/MariaDB, SQLite, SQL Server behind a driver adapter interface with capability flags.
4. **G4 — Terminal citizenship**: instant over SSH, correct inside tmux, respects `$EDITOR`, `.pgpass`, `PG*` env vars, and terminal themes.

### Non-goals (v1)

- Dashboards/charts (GUI territory — see `PRD-GUI.md` §7.4); the TUI's visualization ceiling is EXPLAIN trees and monitoring sparklines. *(ROADMAP-TUI.md "Non-goals")*
- Collaboration/cloud sync; plugin system; AI/NL-to-SQL; PL/pgSQL debugger; pgAgent scheduling.
- Engines beyond the four; no code sharing with the GUI app (independent by explicit decision).

## 3. Target users & personas

1. **Devon — backend/infra engineer (primary).** SSH'd into environments all day; uses psql + k9s + lazygit. Wants `\dt` muscle memory to work, and wants to *safely* fix one bad row on prod without copy-pasting an UPDATE into psql. Success: GreenBerry replaces psql for everything except one-liners.
2. **Sam — accidental DBA (primary).** Same persona as the GUI's Sam, but terminal-native. Kills stuck queries, adds indexes, runs pg_dump by hand today. Success: sessions/kill, maintenance, and backups from inside the TUI.
3. **Ana — data engineer on a jump box (secondary).** No GUI allowed on the bastion host. Needs browse + query + export where only a terminal exists. Success: full workflow over SSH with zero installs beyond `npx`.

## 4. Competitive positioning

| Tool | What it owns | Why GreenBerry wins |
|---|---|---|
| **pgcli** | Smart-completion REPL | No tree/grid/editing; catalog-scan slowdowns; we cache introspection async |
| **rainfrog** | Postgres browse TUI, vim modal | Explicitly unsafe for writes; no admin; no staged edits |
| **lazysql** | Pending-changes editing (alpha) | Alpha stability; no schema editing, no admin, no SQL-preview review |
| **harlequin** | Terminal SQL IDE | Query-only; Python install friction; Postgres is an adapter not the focus |
| **psql/pspg** | Ubiquity; pager niceties | Zero discoverability; no persistent visual context |

Positioning statement: *"lazygit for your database — browse like rainfrog, edit like TablePlus, administer like pgAdmin."*

## 5. Product principles

1. **Keyboard-complete, discoverable.** Every action reachable by keys; `?` overlay always shows what the focused pane can do. Vim-dense but never vim-required.
2. **Preview before mutate.** Staged buffer + generated-SQL review for every write path — data and DDL alike.
3. **Never block a keystroke.** Introspection, queries, and completion are async against a cached catalog; slow networks degrade gracefully, input latency never does.
4. **Respect the environment.** `.pgpass`, `PG*`, service files, MySQL option files, OS keychain, `$EDITOR`, terminal palette, tmux. No secrets on argv, ever.
5. **Prod is visually loud.** Env-tagged connections color the frame; safe-mode escalates confirmations.

---

## 6. Functional requirements — foundation

Requirement IDs are `FR-T<section>.<n>`. Priority: **P0** = MVP-blocking, **P1** = v1.0, **P2** = post-1.0.

### 6.1 App shell *(→ ROADMAP-TUI.md Epic E1, stories S1.1–S1.7)*

- **FR-T1.1 (P0)** **Pane layout system**: sidebar (tree) / main (grid or editor) / detail / status bar; Tab and number keys cycle focus; panes zoomable (maximize/restore); adapts to terminal resize. Replaces the current demo layout in `app.tsx`.
- **FR-T1.2 (P0)** **Keybinding registry**: central keymap, global + per-pane scopes, user-remappable via config; `?` renders a context-sensitive help overlay for the focused pane.
- **FR-T1.3 (P0)** **Command palette + colon-commands**: fuzzy palette over commands, tables, saved queries (Arctype Cmd+K analog); k9s-style `:` prompt (`:tables`, `:sessions`, `:sql`); **psql aliases** (`\d`, `\dt`, `\l`, `\c`) accepted as palette synonyms.
- **FR-T1.4 (P0)** **Config file** at `~/.config/greenberry/config.toml`: keymaps, theme, row-limit default, safe-mode level; sane defaults with no file present.
- **FR-T1.5 (P0)** **Status bar**: connection name + env badge, database, transaction state, async-job spinners, toast-style notices; running background query surfaces a completion marker (Arctype's green-dot pattern, terminal-adapted).
- **FR-T1.6 (P0)** Testing harness: replace the broken `test.tsx` (imports non-existent `source/app.js`); ava + ink-testing-library patterns; `npm test` green in CI.
- **FR-T1.7 (P1)** Error framework: driver errors render in a dismissible panel with the failing SQL; debug log file; no silent failures.

### 6.2 Connections & drivers *(→ ROADMAP-TUI.md Epic E2, stories S2.1–S2.10)*

- **FR-T2.1 (P0)** **Driver adapter interface** (`src/db/`): `connect/disconnect/query/stream/cancel/introspect/quoteIdent/buildDDL` + **capability flags** (has schemas, has roles, EXPLAIN format, RLS…). UI logic branches on capabilities, never on engine names.
- **FR-T2.2 (P0)** **Postgres adapter** (`pg` + `pg-cursor` — already installed): full query/stream/cancel; reference implementation.
- **FR-T2.3 (P0)** **SQLite adapter** (`better-sqlite3`) with a file-open flow.
- **FR-T2.4 (P1)** **MySQL/MariaDB adapter** (`mysql2`); **FR-T2.5 (P1)** **SQL Server adapter** (`mssql`/tedious). Parity with the Postgres acceptance bar.
- **FR-T2.6 (P0)** **Connection profiles**: named, grouped, engine-typed, with **environment tag + color**; prod renders a red badge in the frame and status bar.
- **FR-T2.7 (P0)** **Credentials**: OS keychain for stored secrets; honor `.pgpass`, `PG*` env, pg service files, MySQL option files; **no passwords on argv** (the #1 rainfrog complaint).
- **FR-T2.8 (P1)** URL paste-import into a profile; **FR-T2.9 (P1)** SSH tunnels (leaning on `~/.ssh/config`) and SSL modes per engine.
- **FR-T2.10 (P1)** Multiple simultaneous connections with palette switching.

### 6.3 Schema browser *(→ ROADMAP-TUI.md Epic E3, stories S3.1–S3.6)*

- **FR-T3.1 (P0)** **Async cached introspection** per engine; incremental refresh; a 1,000-table catalog loads without blocking input (pgcli's failure mode is the anti-goal).
- **FR-T3.2 (P0)** **Object tree**: databases → schemas → tables/views/matviews/functions/sequences/indexes/triggers per capability flags; hjkl + `/` filter-in-place; expanding a table shows columns + types inline; system-objects toggle.
- **FR-T3.3 (P0)** **DDL pane**: reverse-engineered CREATE for any object, including constraints and indexes; yankable.
- **FR-T3.4 (P1)** **Object detail tabs** (pgAdmin's universal pattern): Properties / DDL / Statistics / Dependencies.
- **FR-T3.5 (P0)** **Fuzzy object search** in the palette, type-filterable, <100ms from cache.
- **FR-T3.6 (P1)** Table utilities: count rows, truncate (safe-mode gated), refresh, script-to-editor (SELECT/INSERT/UPDATE skeletons).

---

## 7. Functional requirements — data workflows

### 7.1 Data grid (browse) *(→ ROADMAP-TUI.md Epic E4, stories S4.1–S4.7)*

- **FR-T4.1 (P0)** **Virtualized DataTable** (fills the `src/ui/DataTable.tsx` stub): frozen header, horizontal scroll with column sizing, cell/row/block selection, distinct `NULL` rendering; smooth over 100k buffered rows.
- **FR-T4.2 (P0)** **LIMIT pagination**: page controls, jump-to-page, configurable page size (default 300), state in the status bar.
- **FR-T4.3 (P0)** **Sort & filter**: multi-column sort; stackable column/operator/value filters composing correct per-engine WHERE (ILIKE on PG).
- **FR-T4.4 (P1)** **Generate SQL**: convert current filters/sorts into an editable query in the SQL editor (Arctype's learn-and-escalate pattern).
- **FR-T4.5 (P1)** **Cell inspector**: detail panel for long values; JSON tree view with fold/unfold; row-as-form view.
- **FR-T4.6 (P1)** **FK follow**: FK cells marked; keybinding jumps to the referenced row with a back stack.
- **FR-T4.7 (P0)** **Yank & export**: yank cell/row/selection as CSV/TSV/JSON/INSERT (pspg's checklist); export result set to CSV/JSON file.

### 7.2 Data editing — staged writes ★ the differentiator *(→ ROADMAP-TUI.md Epic E5, stories S5.1–S5.6)*

- **FR-T5.1 (P0 for M2)** **Pending-changes buffer**: all edits stage; dirty cells highlighted; buffer survives scrolling/paging; nothing executes until commit.
- **FR-T5.2** Inline cell editing with type-aware editors (text/number/bool/date/enum/JSON); explicit set-NULL distinct from empty string; pre-commit validation.
- **FR-T5.3** Row operations: insert, duplicate, delete (multi-select); deleted rows struck-through until commit.
- **FR-T5.4** **SQL preview → commit/discard**: review panel shows exact generated statements; commit = one transaction; failure = full rollback + failing statement surfaced.
- **FR-T5.5** **Read-only & safe mode**: session read-only toggle; escalating levels (silent → confirm non-SELECT → typed confirmation on prod tags), configurable default in config.toml.
- **FR-T5.6** Editable query results when a single table + full PK is present (pgAdmin's updatable rule); otherwise a visible read-only lock.

### 7.3 SQL editor *(→ ROADMAP-TUI.md Epic E6, stories S6.1–S6.12)*

- **FR-T6.1 (P0)** Multi-tab editor; per-tab connection + database; concurrent execution across tabs.
- **FR-T6.2 (P0)** **Editor buffer** (fills `src/ui/LineEditor.tsx`): multi-line editing, syntax highlighting, vim-modal (normal/insert/visual) with non-modal fallback, configurable.
- **FR-T6.3 (P1)** **Autocomplete**: keywords/tables/columns, alias-aware, from the cached catalog, never blocking keystrokes.
- **FR-T6.4 (P0)** Execute & cancel: run all/selection/cursor-statement; Run↔Cancel; rows-affected + timing; multiple result sets in tabs. Cancel interrupts `pg_sleep(60)` promptly.
- **FR-T6.5 (P1)** **Streaming results** via cursors; 1M rows → first page < 1s, bounded memory.
- **FR-T6.6 (P1)** **Transaction control**: auto-commit toggle, manual BEGIN/COMMIT/ROLLBACK, always-visible `TXN` state (harlequin's model).
- **FR-T6.7 (P0)** History (persistent, searchable, with timing/status) and saved queries in folders bound to palette keywords.
- **FR-T6.8 (P1)** **Query variables `{{name}}`** (Arctype signature, TUI-adapted): detected variables prompt in a side panel; last values remembered per query and recorded in history.
- **FR-T6.9 (P0)** **`$EDITOR` escape hatch**: round-trip the buffer to the user's editor losslessly.
- **FR-T6.10 (P1)** SQL formatting, idempotent.
- **FR-T6.11 (P1)** **EXPLAIN tree**: collapsible plan tree with cost/rows/timing heat-coloring (depesz-style); per-engine formats; seq scans flagged.
- **FR-T6.12 (P1)** Result-set `/` search with match jumping; export CSV/JSON.

### 7.4 Schema editing — DDL as forms *(→ ROADMAP-TUI.md Epic E7, stories S7.1–S7.6)*

- **FR-T7.1 (P1)** Create-table form (columns, types, nullability, defaults, PK) ending in **Review → Apply** — generated DDL shown and editable as SQL before execution.
- **FR-T7.2 (P1)** Alter-table operations (add/rename/drop column, type/default/nullability changes) batched into one reviewed script.
- **FR-T7.3 (P1)** Index management (method, columns, unique, partial where supported).
- **FR-T7.4 (P1)** Constraint management: PK/FK/unique/check with referential-action pickers; FK form validates against the catalog.
- **FR-T7.5 (P2)** View/sequence/trigger dialogs per capability flags.
- **FR-T7.6 (P1)** Drop-with-dependency-awareness: dependents listed before drop; cascade behind safe mode.

### 7.5 Admin & DBA — the claimed lane *(→ ROADMAP-TUI.md Epic E8, stories S8.1–S8.8)*

- **FR-T8.1 (P1)** **Sessions view**: live `pg_stat_activity` / engine equivalents (PID, user, state, wait, query, duration), filterable, auto-refreshing, with **cancel query** and **terminate backend** — k9s-style.
- **FR-T8.2 (P2)** Locks view with blocking-chain rendering.
- **FR-T8.3 (P2)** **Roles & privileges**: role list, create/alter forms, GRANT/REVOKE editor emitting reviewable SQL; RLS policy viewing on PG.
- **FR-T8.4 (P2)** Maintenance: VACUUM/ANALYZE/REINDEX (PG), OPTIMIZE/ANALYZE (MySQL), VACUUM (SQLite) with streamed verbose output, cancelable.
- **FR-T8.5 (P2)** **Backup/restore orchestration**: wrap `pg_dump`/`pg_restore`/`mysqldump`/SQLite backup with option forms, background execution, progress, logs; PG custom-format dump + selective restore round-trips.
- **FR-T8.6 (P2)** Bulk import/export: engine-native COPY/LOAD with CSV column mapping and progress.
- **FR-T8.7 (P2)** Server config browser (GUCs/variables, non-defaults highlighted) and log tailing where accessible.
- **FR-T8.8 (P2)** **Monitoring**: braille/block sparklines for TPS, sessions, tuples, block I/O; per-DB sizes; bloat estimates; interval refresh without flicker.

---

## 8. Safety model

*(implemented across E5, E2/S2.6, E7 Review→Apply, E1 config)*

Identical philosophy to the GUI (`PRD-GUI.md` §8), adapted to the terminal:

1. Staged writes + SQL preview for data (FR-T5.x) and DDL (FR-T7.x).
2. Environment escalation: prod tags color the frame; safe-mode levels from config; typed confirmation (e.g., type the table name) for destructive ops on prod.
3. Read-only session toggle and no-PK read-only badges.
4. One transaction per commit; full rollback on partial failure.
5. `--read-only` CLI flag for auditors/jump-box use.

## 9. Technical architecture requirements

- **TA-1** Ink 4 + React 18 + TypeScript strict; Node ≥ 20; `tsx` dev loop, `tsc` build (existing scaffold).
- **TA-2** Drivers: `pg`/`pg-cursor` (installed), `mysql2`, `better-sqlite3`, `mssql` — behind the adapter interface (FR-T2.1). Native-module implications (better-sqlite3) accounted for in packaging (E9).
- **TA-3** Async cached introspection catalog (FR-T3.1) shared by tree, palette, and autocomplete.
- **TA-4** Staged-changes engine in `src/sql/` (fills the `analyzeSql.ts` stub's role): builds parameterized DML + DDL, renders previews, applies transactionally.
- **TA-5** No secrets on argv; keychain via native helper; config/`.pgpass` parsing.
- **TA-6** Rendering discipline: virtualized lists everywhere; no full-screen re-render on tick; input latency budget enforced (§11).

## 10. UX specification (terminal)

*(→ ROADMAP-TUI.md E1; conventions from the TUI landscape survey)*

- **Pane model**: `[1] Tree · [2] Main · [3] Detail` + status bar; Tab/1-2-3 focus; `z` zoom pane; k9s/lazygit muscle memory.
- **Keys**: hjkl + arrows everywhere; `/` filters any list or grid in place; `gg`/`G`; `y` yank family (`yy` row, `yc` cell, `yi` as INSERT); `Enter` drill-in, `Esc` back/cancel; `q` quit (guarded when work is pending); `?` help; `:` commands; `Ctrl+P` palette.
- **psql compatibility**: `\d`, `\dt`, `\l`, `\c`, `\e` behave as expected (cheap goodwill — explicitly requested of rainfrog by users).
- **Color**: respect terminal palette; green = brand/primary accent (GreenBerry), red reserved for prod badges and errors; NULLs dim italic; selected row inverse.
- **Help discoverability**: every pane footer shows its top 3–4 bindings; `?` shows all.
- **Config-first personalization**: keymaps, theme, safe-mode defaults in `config.toml` (FR-T1.4).

## 11. Performance & quality budgets

*(→ ROADMAP-TUI.md E9/S9.1)*

| Metric | Budget |
|---|---|
| Cold start (`npx greenberry` warm cache) | < 1.5s to interactive |
| Keystroke → render | < 16ms perceived (no lag with 5k-table catalog or 1M-row result) |
| First rows of any query | < 1s (streamed) |
| Introspection of 1,000-table DB | Non-blocking; tree usable immediately, fills in async |
| Memory with 1M-row streamed result | Bounded (cursor windowing), < 500MB |

## 12. Release plan (traceability to roadmap milestones)

| Release | Roadmap milestone | Contents (FR sections) |
|---|---|---|
| 0.1 internal | **M0** (E1) | §6.1 shell, palette, config, status bar, test harness |
| 0.2 MVP | **M1** (E2–E4, E6 partial) | §6.2 connections (PG+SQLite), §6.3 tree + DDL pane + search, §7.1 grid (browse), §7.3 editor (run/cancel/history) |
| 0.3 | **M2** (E2 complete, E5) | MySQL + MSSQL, §7.2 staged editing + safe mode, grid completion (§7.1 P1s) |
| 0.4 | **M3** (E6 complete, E7) | autocomplete, streaming, variables, EXPLAIN, `$EDITOR`; §7.4 schema editing |
| 0.5 | **M4** (E8) | §7.5 admin lane: sessions/kill, roles, maintenance, backup/restore, monitoring |
| 1.0 | **M5** (E9) | packaging (`npx` + binary evaluation), docs/demo, budgets green, release cadence |

## 13. Success metrics

- Activation: `npx greenberry` → rendered data grid in < 2 minutes for a new user.
- The admin lane gets used: ≥30% of weekly-active users touch sessions/kill, maintenance, or backup by 1.0.
- Safety: zero data-loss reports attributable to edit flows; 100% of writes pass through SQL preview.
- Performance: §11 budgets green in CI each release.
- Community signal: "k9s for Postgres" / "lazygit for databases" appears organically in feedback; release cadence never exceeds 6 weeks (gobang's abandonment lesson).

## 14. Risks & open questions

| Risk | Mitigation |
|---|---|
| Ink rendering perf at data-grid density | Virtualize aggressively (E4/S4.1); benchmark from M1; `greenberry-deprecated-terminal/` proved dense Ink layouts feasible |
| Native modules (better-sqlite3) complicate `npx` install | E9/S9.2 evaluates prebuilds + single-binary bundling |
| Four engines × admin features = test surface explosion | Capability flags keep non-PG engines honest; docker-compose test matrix; PG always first |
| Node/npm distribution vs Rust/Go single binaries | `npx` path first; binary bundling explicitly on the roadmap (E9) |
| Vim-modal editor complexity | Non-modal default with modal opt-in (FR-T6.2), shipped incrementally |

**Open questions** (resolve by end of M1): keychain helper approach on macOS/Linux; whether query history is per-connection or per-workspace; minimum terminal size supported (target 80×24 degraded, 120×30 optimal).
