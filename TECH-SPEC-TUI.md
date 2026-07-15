# TECH-SPEC-TUI — GreenBerry Terminal Client

**Purpose.** A single reference for the technical and architectural decisions behind the **GreenBerry TUI**, extracted from `PRD-TUI.md` / `ROADMAP-TUI.md`.

**Product.** `_greenberry-frontend-tui/` — Ink 4 + React 18 + TypeScript on Node. A full-screen terminal database client: pgAdmin's admin depth and Arctype's product sensibility with k9s/lazygit ergonomics, claiming the terminal landscape's **unclaimed admin lane** (safe staged editing, DDL-as-forms, roles, backup, live ops).

**Status.** Roadmap only — **not started**. Every story in `ROADMAP-TUI.md` is ⬜. The decisions below are committed direction the implementation will build against; there is no code to reconcile against yet.

**Sibling.** The macOS GUI is documented separately in `TECH-SPEC-GUI.md`. The two apps are independent (see D1).

Companion docs: `PRD-TUI.md` (what & why), `ROADMAP-TUI.md` (epics E1–E9, milestones M0–M5).

---

## 1. Foundational decisions

Cross-cutting decisions shared with the GUI product but stated here for the TUI. Both apps converge on these principles while sharing no code.

- **D1 — Two independent apps, no shared code.** GUI and TUI are separate products with **no shared packages** by explicit decision. Different runtimes (Node/terminal vs Rust/webview) and rendering constraints; avoiding a shared abstraction that fits neither. *(PRD-TUI.md §2 non-goals)*
- **D2 — Four engines behind one adapter, Postgres is the reference.** PostgreSQL, MySQL/MariaDB, SQLite, SQL Server behind a driver adapter interface with capability flags. Postgres always lands first; UI branches on **capability flags**, never engine names. *(PRD-TUI.md §2 G3)*
- **D3 — Local-first, respect the environment.** OS keychain for stored secrets; honor `.pgpass`, `PG*` env, pg service files, MySQL option files. **No secrets on argv, ever** (the #1 rainfrog complaint). *(PRD-TUI.md §5.4)*
- **D4 — Preview before mutate (the safety model).** No SQL executes without the user seeing it first. Data edits stage into a pending-changes buffer and commit through an SQL preview; DDL forms end in **Review → Apply**. A commit is **one transaction**; partial failure rolls back entirely and surfaces the failing statement. No-PK results are read-only with a visible lock. Prod-tagged connections escalate confirmation (typed confirmation) and color the frame; a `--read-only` CLI flag exists for auditors/jump-box use. *(PRD-TUI.md §8)*
- **D5 — Query variables `{{name}}` are the connective tissue.** The same `{{name}}` syntax works in the editor and is remembered per query with its values (TUI-adapted: prompted/edited in a side panel). *(PRD-TUI.md §7.3 FR-T6.8)*
- **D6 — Cached, async introspection.** A per-connection catalog (tables, columns, PK/FK, types) is introspected asynchronously and cached with incremental refresh; it powers the object tree, palette, autocomplete, and FK-follow. Explicitly avoids pgcli's keystroke-time catalog scans — introspection must **never block input**. *(PRD-TUI.md §6.3 FR-T3.1)*

---

## 2. Architecture (planned)

### 2.1 Shell & runtime

- **Ink 4 + React 18 + TypeScript (strict), Node ≥ 20.** `tsx` dev loop, `tsc` build (existing scaffold). *(PRD-TUI.md §9 TA-1)*
- **Pane model** `[1] Tree · [2] Main · [3] Detail` + status bar; Tab/number-key focus; `z` zoom pane; adapts to terminal resize. `app.tsx`'s three-pane focus layout is the seed of the shell.
- **UI kit** (`src/ui/`) fills existing empty stubs — `DataTable`, `SelectableList`, `LineEditor` — plus `Tree`, `Palette`, `StatusBar`, `HelpOverlay`, `Tabs`.

### 2.2 Driver adapter layer

- **One interface** (`src/db/`): `connect/disconnect/query/stream/cancel/introspect/quoteIdent/buildDDL` + **capability flags** (has schemas, has roles, EXPLAIN format, RLS…). UI logic branches on capabilities, never engine names. *(PRD-TUI.md §6.2 FR-T2.1)*
- **Drivers:** `pg` + `pg-cursor` (installed, reference implementation), `mysql2`, `better-sqlite3`, `mssql`/tedious. Native-module implications of `better-sqlite3` are a packaging concern (single-binary bundling evaluated in E9). *(PRD-TUI.md §9 TA-2)*
- **Streaming** via per-engine cursors with bounded memory (1M rows → first page < 1s).

### 2.3 Introspection & staged writes

- **Async cached introspection catalog** (`src/db/catalog/`) shared by tree, palette, and autocomplete — the D6 principle, Node-side. Per-engine queries against `pg_catalog` / `information_schema` / `sqlite_master` / `sys.*`.
- **Staged-changes engine** in `src/sql/` builds parameterized DML + DDL, renders previews, applies transactionally (fills the existing `analyzeSql.ts` stub's role). *(PRD-TUI.md §9 TA-4)*

### 2.4 Terminal citizenship

- **k9s/lazygit conventions:** Tab/number-key panes, vim keys everywhere (hjkl, `/` filter, `gg`/`G`), `?` context-sensitive help overlay, `:` colon-commands, `Ctrl+P` palette, `$EDITOR` escape hatch.
- **psql compatibility:** `\d`, `\dt`, `\l`, `\c`, `\e` behave as expected (cheap goodwill explicitly requested of rainfrog by users).
- **Respects** `.pgpass`, `PG*`, service files, MySQL option files, OS keychain, terminal theme, tmux, SSH. Config at `~/.config/greenberry/config.toml` (keymaps, theme, row-limit default, safe-mode level). *(PRD-TUI.md §5, §10)*
- **Color:** respect terminal palette; green = brand/primary accent, red reserved for prod badges and errors; NULLs dim italic; selected row inverse.

### 2.5 Rendering discipline & performance budgets

Virtualized lists everywhere; no full-screen re-render on tick; input latency budget < 16ms perceived (no lag with 5k-table catalog or 1M-row result). Cold start (`npx greenberry`, warm cache) < 1.5s; first rows < 1s streamed; 1M-row streamed result bounded < 500MB via cursor windowing. *(PRD-TUI.md §9 TA-6, §11)*

### 2.6 Distribution

`npx greenberry` first; single-binary bundling (bun/pkg) evaluated to match Go/Rust competitors. Release cadence never to exceed 6 weeks (the gobang abandonment lesson). *(PRD-TUI.md §12; ROADMAP-TUI.md E9)*

### 2.7 Reference-only asset

`greenberry-deprecated-terminal/` (a prediction-markets Ink app) is a styling/pattern reference proving dense Ink layouts are feasible — **not** a code source.

---

## 3. Product positioning driver

**"lazygit for your database — browse like rainfrog, edit like TablePlus, administer like pgAdmin."** The terminal landscape (pgcli, rainfrog, lazysql, harlequin, gobang) has a crowded browse/query lane but an **unclaimed admin lane**: no tool offers trustworthy staged editing with SQL preview, DDL-as-forms, role management, backup orchestration, or live server ops. rainfrog literally warns against writing to prod; GreenBerry TUI makes safe writes the differentiator. *(PRD-TUI.md §1, §4)*

---

## 4. Non-goals (architectural boundaries)

Deferred so the architecture stays honest, but not precluded:

- Dashboards/charts (GUI territory — see `TECH-SPEC-GUI.md`); the TUI's visualization ceiling is EXPLAIN trees and monitoring sparklines.
- Collaboration/cloud sync; plugin system; AI/NL-to-SQL; PL/pgSQL debugger; pgAgent scheduling.
- Engines beyond the four — the adapter interface keeps the door open.
- No shared code with the macOS GUI app.

---

## 5. Open questions (from the PRD, still to resolve)

- Keychain helper approach on macOS/Linux.
- Whether query history is per-connection or per-workspace.
- Minimum terminal size supported (target 80×24 degraded, 120×30 optimal).

---

## Revision R1 — Local SQLite persistence, OS keychain removed (2026-07-09)

This **supersedes** the credential-storage half of §1 (D3) and §2.4 where they specify an OS keychain. The originals are left in place for history; this section wins.

**Decision.** The TUI's own persistence — connection profiles (connection strings + metadata), saved queries, history — and **stored credentials** move into a single **local SQLite application database**, via the `better-sqlite3` driver already in the adapter set. The OS keychain is removed as a storage mechanism.

**Unchanged — external credential sources are not "our" persistence.** GreenBerry TUI still *reads* the user's existing config — `.pgpass`, `PG*` env vars, pg service files, MySQL option files — and still **never puts secrets on argv**. Those belong to the user, not to us; only *our own* secret store (formerly the OS keychain) becomes the SQLite app-db. `config.toml` remains for keymaps / theme / safe-mode defaults and does **not** store secrets.

**Location.** One `.db` file under the app data dir (e.g. `~/.local/share/greenberry/greenberry.db`, alongside `~/.config/greenberry/`), schema-versioned.

**Security trade-off (tracked, not silently accepted).** Same as the GUI: a plaintext SQLite file is weaker at rest than an OS keychain. The **storage location (SQLite) is the settled requirement**; the **encryption posture is an open decision** — SQLCipher, an app-managed key, or explicitly-accepted local-plaintext with rationale — tracked in `ROADMAP-TUI.md` (Addendum R3).

**Roadmap:** `ROADMAP-TUI.md` Addendum (stories R1–R3) implements this; it supersedes the OS-keychain half of S2.7.

---

*Sources: `PRD-TUI.md`, `ROADMAP-TUI.md`, and the `_greenberry-frontend-tui/` scaffold. No implementation exists yet; every architectural statement here is committed direction, not reconciled-against-code.*
