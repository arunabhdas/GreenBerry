# DEVELOPER-GUI — GreenBerry Desktop developer documentation

| | |
|---|---|
| **Codebase** | `greenberry-frontend-macos/` — Tauri 2 (Rust) + React 19 + TypeScript + Vite 7 |
| **Companion docs** | `PRD-GUI.md` (requirements) · `ROADMAP-GUI.md` (stories & status) · `TECH-SPEC-GUI.md` (design) |
| **ADRs** | [`docs/adr/0001-db-access-layer.md`](greenberry-frontend-macos/docs/adr/0001-db-access-layer.md) — Rust `sqlx` in-process (no Node sidecar) · [`docs/adr/0002-secrets-at-rest.md`](greenberry-frontend-macos/docs/adr/0002-secrets-at-rest.md) — plaintext app-db + 0600 (no Keychain) |
| **Audience** | Developers working on the app. For *what to build*, read the PRD; for *what's done*, the roadmap. |

---

## 1. Quick start

Prerequisites: **Rust** (stable, via rustup), **Node 20+**, and Xcode command-line tools. A local **PostgreSQL** (and optionally **MySQL**) is only needed for the gated integration tests and manual testing.

```sh
cd greenberry-frontend-macos
npm install

# run the desktop app (starts Vite on :1420 + the Tauri shell)
npm run tauri dev

# frontend checks
npm run typecheck        # tsc --noEmit
npm test                 # vitest run (jsdom, no databases needed)
npm run build            # tsc && vite build

# Rust checks (from src-tauri/)
cargo test                                   # unit + always-run app-db tests
GB_TEST_PG_USER=$USER cargo test             # + live-Postgres integration & E2E
GB_TEST_MYSQL_USER=root cargo test           # + live-MySQL integration

# packaged build
npm run tauri build
```

The UI gallery (component playground) is served at `http://localhost:1420/#gallery` while `npm run dev` / `tauri dev` is running.

---

## 2. Architecture

```
┌──────────────────────────── Tauri window (WKWebView) ────────────────────────────┐
│  React 19 + TypeScript (src/)                                                    │
│  App → ConnectScreen → Workspace                                                 │
│        (session)       ├─ ConnectionsPanel (saved connections, multi-server)     │
│                        ├─ Sidebar (server ⛃ → database ⛁ → schema → table tree)  │
│                        └─ Tabs → keep-alive panes → TableView / QueryView        │
└───────────────┬──────────────────────────────────────────────────────────────────┘
                │ Tauri IPC (invoke, serde camelCase)
┌───────────────▼──────────────────── Rust (src-tauri/) ───────────────────────────┐
│  lib.rs      command surface (db_* + store_*) + DbState + AppDb in setup()       │
│  db.rs       DbClient enum ── PgClient (sqlx Postgres) / MyClient (sqlx MySQL)   │
│  appdb.rs    AppDb ── sqlx SQLite at ~/Library/…/com.greenberry.desktop/…db      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Two decisions shape everything (see the ADRs for the full rationale):

1. **Database access is in-process Rust `sqlx`** (ADR 0001) — user queries never leave the binary; results cross the IPC boundary once, as typed JSON.
2. **All persistence is one SQLite "app-db"** (ADR 0002) — connections *including passwords*, saved queries, history, dashboards, settings, and open-tab SQL live in a single 0600 file. There is no Keychain and no localStorage.

### Multi-server model (S3.6/S3.8)

A **server** = one saved connection opened in the workspace. Each server gets its own `DbPool` (frontend, `src/app/dbPool.ts`): a lazy map of *database name → live connection*, because Postgres binds one connection per database. Expanding a database node in the tree calls `pool.open(db)` (connect + introspect, deduped in-flight, error-retryable); everything stays open until the server is closed. Tabs, palette entries, and query targets are scoped by `(connId, db)`.

---

## 3. Repository layout

```
greenberry-frontend-macos/
├─ index.html                  # body sets spellcheck/autocorrect/autocapitalize off
├─ vitest.config.ts            # jsdom, setupFiles: src/test/setup.ts
├─ docs/adr/                   # architecture decision records
├─ spike/db-access/            # ADR 0001 benchmark (Rust vs Node sidecar, 1M rows)
├─ src-tauri/
│  ├─ tauri.conf.json          # window (titleBarStyle Overlay), updater endpoints
│  ├─ capabilities/default.json# permissions — incl. core:window:allow-start-dragging
│  ├─ src/lib.rs               # ALL Tauri commands + state + app-db bootstrap
│  ├─ src/db.rs                # engine-agnostic DB layer (Postgres, MySQL)
│  ├─ src/appdb.rs             # SQLite app-db: schema, migrations, CRUD
│  └─ tests/                   # appdb.rs (always-run) · db_pg.rs · db_mysql.rs ·
│                              # e2e_persist_reconnect.rs (S11.3, PG-gated)
└─ src/
   ├─ App.tsx                  # session gate: ConnectScreen ⇄ Workspace; hydrate()
   ├─ app/                     # assembled shell (smart components)
   │  ├─ ConnectScreen.tsx     # welcome: quick-connect, modal, saved connections
   │  ├─ Workspace.tsx         # server sessions, tabs, panels, palette, status bar
   │  ├─ dbPool.ts             # per-server lazy database-connection pool
   │  ├─ TableView.tsx         # grid browse + staged edits + CSV export
   │  └─ QueryView.tsx         # SQL editor + per-tab db target + results
   ├─ features/<domain>/       # unit-tested building blocks (components + pure
   │                           # logic): connections, editor, grid, nav, dashboard,
   │                           # schema, admin, query, updater
   ├─ lib/                     # db.ts (typed IPC client) · workspace.ts (store)
   │                           # openQueries.ts · shortcuts.ts · fuzzy.ts
   ├─ ui/                      # primitives: Button, Tabs, Toast, theme, inputProps
   └─ test/setup.ts            # jest-dom matchers
```

**Where things go:** pure logic and reusable components belong in `src/features/<domain>/` with a colocated `*.test.ts(x)`; wiring them into the running app happens in `src/app/`. `src/lib/` is for cross-domain infrastructure only.

---

## 4. IPC command surface

All commands live in `src-tauri/src/lib.rs`. Arguments and results serialize with **serde camelCase**; errors arrive as `{ kind, message }` (`DbError`), where `kind ∈ connection | query | notConnected | unsupported`. The typed frontend client is `src/lib/db.ts` (`db.*`) plus `src/lib/openQueries.ts`.

### Live-database commands (`db.rs`)

| Command | Purpose |
|---|---|
| `db_connect(config) → connectionId` | Open a pooled connection (engine-dispatched) |
| `db_disconnect(connectionId)` | Drop it |
| `db_query(connectionId, sql, limit?, token)` | Run SQL → `QueryResult` (typed JSON rows, `truncated` flag); `token` registers the backend pid / connection id for cancel |
| `db_cancel(connectionId, token)` | `pg_cancel_backend` / `KILL QUERY` |
| `db_introspect(connectionId) → Catalog` | Schemas → tables → columns (PK + FK refs) |
| `db_exec_batch(connectionId, statements[]) → affected` | All statements in **one transaction**; any failure rolls back (staged-edit commit path) |
| `db_databases(connectionId) → string[]` | Server databases, like `\list` (templates excluded) |
| `db_roles(connectionId) → string[]` | Server roles, like `\du` (best-effort, may be empty) |

### App-db commands (`appdb.rs`)

| Command | Table | Notes |
|---|---|---|
| `store_list/save/delete_connection` | `connections` | Full descriptor incl. password (ADR 0002); upsert by id |
| `store_add/list_history` | `history` | Capped at newest 500 |
| `store_save/list/delete_query` | `saved_queries` | |
| `store_save/list_dashboards` | `dashboards` | JSON payload column |
| `store_save/list/delete_open_query` | `open_queries` | SQL text of open query tabs (S3.7), keyed `(id, connId, db)` |
| `store_get/set_kv` | `kv` | Settings blob under key `"settings"` |

### Adding a command (checklist)

1. Implement in `db.rs` (per-engine + `DbClient` dispatch arm) or `appdb.rs` (+ migration if a new table — see §5).
2. Add the `#[tauri::command]` wrapper in `lib.rs` **and register it in `generate_handler![]`** (forgetting the second is the classic silent failure).
3. Expose it in `src/lib/db.ts` (or a dedicated lib module) with types mirroring the serde shape.
4. Rust test in `src-tauri/tests/`; frontend consumers mock `@tauri-apps/api/core` (see §7).
5. Restart `tauri dev` — Rust changes are not hot-reloaded.

---

## 5. The app-db (SQLite)

- **Path:** `~/Library/Application Support/com.greenberry.desktop/greenberry.db`, opened in Tauri `setup()`; the file is `chmod 0600` at creation (asserted by a test).
- **Migrations:** `PRAGMA user_version` guards in `AppDb::migrate` — append a new `if version < N { … "PRAGMA user_version = N" }` block; never edit an existing block (shipped databases have already run it). Current version: **2** (v2 added `open_queries`).
- **Secrets:** passwords are plaintext columns by explicit decision — read ADR 0002 before "fixing" this. UI rules that follow from it: never render a stored password without the reveal toggle; the masked `•••` form must never round-trip into a real password (see `ConnectionModal.applyUrl`).
- Deleting the file resets the app to first-launch state (useful in manual testing).

---

## 6. Frontend state & key flows

### Stores

- **`lib/workspace.ts`** — the reactive workspace store (`useWorkspace(selector)`), backed by a `Persistence` interface: `appDbPersistence()` (IPC) inside Tauri, `memoryPersistence()` elsewhere (tests, plain browser). `workspace.hydrate()` runs once in `App` and loads connections/history/settings. Mutations update memory synchronously and persist fire-and-forget.
- **`app/dbPool.ts`** — per-server `DbPool` (see §2). Not a React hook; `Workspace` holds pools in a ref and mirrors `pool.snapshot()` into state via `pool.onChange`.
- **Tabs are the unit of UI state.** `Workspace` owns `WsTab[]`; each tab carries `(connId, db)`. Panes are **kept mounted** and hidden with `display:none` (S3.8) so results, scroll, pagination, and staged edits survive switching. Don't "optimize" this back to conditional rendering.

### Flows worth knowing before touching them

- **Connect:** `ConnectScreen.connect` → `db_connect` → `db_introspect` → best-effort `db_databases`/`db_roles` → `Session` (holds the *resolved* config, password included, in memory only) → `Workspace` seeds the first server session.
- **Query-tab SQL persistence (S3.7):** every editor keystroke lifts into tab state (`updateQueryTab`) and schedules a **400 ms debounced** `store_save_open_query`; closing the tab deletes the row; opening a server restores its rows as tabs. Results are deliberately *not* persisted.
- **Staged edits (S4.5):** `TableView` accumulates `StagedChanges` (`features/grid/staged.ts`) → preview SQL → `db_exec_batch` commits atomically.
- **Connection modal (S2.9):** the connection-string field mirrors `buildConnectionUrl(fields, { maskPassword: !showPassword })` unless the user is actively pasting (`urlOverride`); any field edit clears the override.

### UI conventions

- Spread `{...noAutocorrect}` (from `ui/inputProps.ts`) onto every new free-text input/textarea — macOS WKWebView autocorrect is disabled app-wide and per-field (`autocapitalize` doesn't inherit).
- `aria-label`s double as test handles (`getByLabelText`) — treat them as a public API; changing one breaks tests intentionally.
- Theme/design tokens are CSS variables (`--bg`, `--panel`, `--border`, `--dim`, `--indigo`, …) — no inline hex colors in components.

---

## 7. Testing

| Layer | Runner | Needs | Command |
|---|---|---|---|
| Frontend units + component smoke | vitest (jsdom) | nothing | `npm test` |
| Rust units + app-db integration | cargo | nothing | `cargo test` |
| Live Postgres integration | cargo | local PG, trust auth | `GB_TEST_PG_USER=$USER cargo test --test db_pg` |
| Live MySQL integration | cargo | local MySQL | `GB_TEST_MYSQL_USER=root cargo test --test db_mysql` |
| E2E persist→restart→reconnect→query→commit (S11.3) | cargo | local PG | `GB_TEST_PG_USER=$USER cargo test --test e2e_persist_reconnect` |

Notes:

- Live-DB suites **skip silently** when the `GB_TEST_*` env var is unset, so plain `cargo test` always passes in CI. Extra knobs: `GB_TEST_PG_HOST/PORT/PASSWORD/DB`, same pattern for MySQL.
- There is **no WebDriver E2E**: `tauri-driver` doesn't support macOS WKWebView. The E2E harness drives the Rust command layer instead (decision recorded in ROADMAP S11.3).
- Frontend tests mock the IPC boundary: `vi.mock("@tauri-apps/api/core", …)` with a `cmd`-dispatching fake (see `src/app/Workspace.test.tsx` for the canonical shape — remember to handle `store_*` commands, and return **arrays** for `db_databases`/`db_roles`).
- Outside Tauri (`__TAURI_INTERNALS__` absent) the workspace store uses in-memory persistence automatically — tests can seed it via `workspace.addConnection(...)` and must reset it in `beforeEach`.

---

## 8. Gotchas (hard-won)

- **MySQL `information_schema`** returns UPPERCASE column names — alias explicitly (`table_name AS t`); enum-ish columns (e.g. `table_type`) come back as BINARY — wrap in `CAST(… AS CHAR)`.
- **`generate_handler![]`**: a command that compiles but isn't registered fails only at runtime, as a frontend promise rejection.
- **Capabilities**: `core:default` does *not* include `core:window:allow-start-dragging`; it's granted explicitly in `capabilities/default.json` (custom titlebar dragging depends on it). Tauri validates capability identifiers at compile time.
- **Titlebar drag**: `data-tauri-drag-region` only fires when the mousedown target *is* the attributed element — titlebar children get `pointer-events:none` in CSS (buttons re-enabled) instead of sprinkling the attribute.
- **`sqlite:///path` URLs** are parsed from the raw string in `parseUrl.ts`; the generic URL normalization corrupts them.
- **Rust changes require restarting `tauri dev`** (only the web layer hot-reloads); app-db schema changes additionally need a fresh look at §5 migrations.
- **Query-tab ids** are `q:${Date.now()}` — two tabs created in the same millisecond collide; tests create tabs sequentially for this reason.

---

## 9. Release & signing (current state)

- `npm run tauri build` produces `.app`/`.dmg`; **ad-hoc signing** is verified working. Notarization needs an Apple Developer certificate (ROADMAP S9.2, blocked).
- The updater plugin is configured (`tauri.conf.json → plugins.updater`) with a generated signing keypair and `createUpdaterArtifacts: true`; endpoints point at `releases.greenberry.app` (placeholder until hosting exists).

---

*Keep this document honest: when a flow, command, or convention changes, update the section here in the same commit — the roadmap tracks* what *shipped; this file explains* how *it works.*
