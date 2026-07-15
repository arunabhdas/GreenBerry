# TECH-SPEC-GUI — GreenBerry Desktop (macOS)

**Purpose.** A single reference for the technical and architectural decisions behind **GreenBerry Desktop**, the macOS GUI, extracted from `PRD-GUI.md` / `ROADMAP-GUI.md` / the DB-layer ADR and reconciled against what is actually built in the code.

**Product.** `greenberry-frontend-macos/` — Tauri 2 + React + TypeScript with a Rust core. A macOS-first clone of **Arctype** (the SQL client acquired by ClickHouse in 2022 and discontinued), rebuilt on Tauri and extended with staged-write safety and an admin surface Arctype lacked.

**Status.** Built through most of E1–E9. Outstanding: SQL Server (`tiberius`) enablement, live SSH-tunnel `verify-full`, codesigning/notarization (needs an Apple Developer cert).

**Sibling.** The terminal product is documented separately in `TECH-SPEC-TUI.md`. The two apps are independent (see D1).

Companion docs: `PRD-GUI.md` (what & why), `ROADMAP-GUI.md` (epics E1–E9, milestones M0–M5), `greenberry-frontend-macos/docs/adr/0001-db-access-layer.md`, `greenberry-frontend-macos/docs/PERF-BUDGETS.md`.

---

## 1. Foundational decisions

Cross-cutting decisions shared with the TUI product but stated here for the GUI. Both apps converge on these principles while sharing no code.

- **D1 — Two independent apps, no shared code.** GUI and TUI are separate products with **no shared packages** by explicit decision. Different runtimes (Rust/webview vs Node/terminal) and rendering constraints; avoiding a shared abstraction that fits neither. *(ROADMAP-GUI.md line 6; PRD-GUI.md §2 non-goals)*
- **D2 — Four engines behind one adapter, Postgres is the reference.** PostgreSQL, MySQL/MariaDB, SQLite, SQL Server behind an engine-agnostic command API. Postgres always lands first; UI branches on **capability flags**, never engine names. SQL Server is a deliberate extension beyond Arctype parity. *(PRD-GUI.md §2 G3)*
- **D3 — Local-first, no telemetry before first paint.** Credentials in the macOS Keychain, queries executed locally, no account required, cloud sync deferred but not precluded. **No network calls before the UI is interactive.** Future telemetry is opt-in. *(PRD-GUI.md §5.5, §9 TA-5)*
- **D4 — Preview before mutate (the safety model).** No SQL executes from a GUI affordance without the user seeing it first. Data edits stage into a pending-changes buffer and commit through an SQL preview; DDL forms end in **Review → Apply**. A commit is **one transaction**; partial failure rolls back entirely and surfaces the failing statement. Tables without a usable PK are read-only with a visible badge. Prod-tagged connections escalate confirmation and tint the chrome. *(PRD-GUI.md §8)*
- **D5 — Query variables `{{name}}` are the connective tissue.** The same `{{name}}` syntax works in the editor, is remembered by history with its values, and binds dashboard inputs and row-clicks to charts — a first-class primitive, not a convenience. *(ROADMAP-GUI.md guiding principle 3)*
- **D6 — Cached, async introspection.** A per-connection catalog (tables, columns, PK/FK, types) is introspected asynchronously and cached with incremental refresh; it powers the sidebar tree, command palette, autocomplete, and FK-follow. Must never block input. *(PRD-GUI.md §9 TA-3)*

---

## 2. Architecture

### 2.1 Shell & runtime

- **Tauri 2.x, not Electron.** The premise is Arctype's feel without Electron's tax (240MB download, memory leaks, telemetry). Tauri keeps the bundle to a few MB and idle memory to a fraction of Electron's. *(PRD-GUI.md §1, §9 TA-1)*
- **React + TypeScript (strict) + Vite** for the webview. *(The PRD specifies React 18; the code actually ships **React 19** — `react@^19.1.0`. Treat 19 as the real target.)*
- **Rust core** compiled into the Tauri binary is the backend language; there is no second runtime.

### 2.2 DB access layer — ADR 0001 (the decision spike)

**Decision: Rust `sqlx` in-process drivers over Tauri IPC, not a Node sidecar.** Accepted 2026-07-03. The spike streamed the same 1M-row Postgres table through both, decoding every column, release builds:

| metric | Rust `sqlx` | Node sidecar | advantage |
|---|---|---|---|
| throughput | ~2.9M rows/s | ~0.49M rows/s | ~6× |
| stream 1M rows | ~0.35s | ~2.0s | ~5.7× |
| time-to-first-row | ~0.9 ms | 20–39 ms | ~25× |
| peak process RSS | 8.5 MB | 158 MB | ~18× |
| cold wall time | 0.82s | 2.23s | ~2.7× |

Rationale beyond the numbers: no second runtime to bundle (a Node sidecar would undo Tauri's footprint win), one serialization hop instead of two, one backend language, and native streaming/cancellation from `sqlx`'s `Stream`. *(docs/adr/0001-db-access-layer.md; spike in `spike/db-access/`)*

**Consequences that constrain the code:**
- **Runtime queries, not macros.** A DB client runs arbitrary user SQL unknown at compile time, so we use `sqlx`'s runtime `query()`/`query_as()` API — **not** the compile-time-checked `query!` macros.
- **`sqlx` covers PG/MySQL/SQLite; SQL Server uses `tiberius`.** The adapter trait hides the difference. *Current state: `Cargo.toml` enables `sqlx` with `postgres` + `mysql` features; `tiberius` is not yet a dependency — SQL Server is the outstanding engine (roadmap S2.7).*
- Streaming to the webview is batched (1,000-row batches) with backpressure.

### 2.3 IPC command API

One typed, engine-agnostic command layer: `connect`, `disconnect`, `query`, `stream`, `cancel`, `introspect`, `testConnection`. Structured error envelope (code, engine message, hint, failing SQL) and per-query cancellation tokens. TS types are shared with / checked against the Rust command signatures. *Implemented in `src-tauri/src/db.rs` (a `DbClient` engine-dispatch enum) and mirrored in `src/lib/db.ts`.* *(PRD-GUI.md FR-G1.2; ROADMAP-GUI.md S1.3)*

- Postgres: connect/query/cancel (`pg_cancel_backend`)/introspect (PK+FK), `to_jsonb` typed rows, `db_exec_batch` for one-transaction staged commits with rollback.
- MySQL: query via `JSON_OBJECT`, cancel via `KILL QUERY`, introspect with PK+FK, transactional `exec_batch`. Integration-tested against live MySQL.
- Cancellation maps to dropping the stream / engine-native cancel.

### 2.4 Frontend layers

- **Editor: Monaco** — chosen for responsiveness, what Arctype used. (Fallback noted as CodeMirror 6 if webview perf disappoints.) *The current SqlEditor is a textarea surface that Monaco drops into.*
- **Grid: custom virtualized grid — no AG Grid.** Arctype ripped out AG Grid for performance; GreenBerry starts virtualized (TanStack Virtual or equivalent). `DataGrid` uses `visibleRange` windowing, frozen header, distinct NULL styling. *(PRD-GUI.md §9 TA-6)*
- **Charts: lightweight lib behind a thin adapter** (ECharts/visx class), following the repo's `dataviz` conventions for palette and light/dark correctness. *(PRD-GUI.md §7.4)*
- **State & persistence:** a reactive **workspace store** (`src/lib/workspace.ts`) backing connections (metadata only), saved queries/folders, history, dashboards, settings — localStorage-backed via `useSyncExternalStore`, with corrupt-data fallback and a restart round-trip test. Schema versioned for migration. *Open question: SQLite app-db vs JSON as the eventual format — currently JSON/localStorage.* *(PRD-GUI.md §9 TA-4)*

### 2.5 Security & credentials

- **macOS Keychain** via the `keyring` crate (`secret_*` Rust commands); the frontend sanitizes secrets out before persisting. The workspace store contains **no plaintext credentials**. *(ROADMAP-GUI.md S2.2)*
- **Environment badges** (Local/Dev/Staging/Prod) gate destructive actions and tint window chrome on prod.
- **SSL modes + SSH tunnels** with key-file auth and `~` expansion (an Arctype paper cut fixed). *Implemented and unit-tested; live `verify-full` over a real tunnel is the only externally-gated piece.*

### 2.6 Distribution

- Signed, notarized `.dmg`/`.app` configured in `tauri.conf.json` (bundle.macOS, `createUpdaterArtifacts`); needs an Apple Developer cert to execute. *(ROADMAP-GUI.md S9.2)*
- **Tauri auto-updater** integrated (plugin + generated signing keypair + updater endpoints + capabilities); no network check before first paint. Delivery needs a release server. *(S9.3)*
- **Direct download, no email gate** — a deliberate anti-Arctype stance. *(S9.4)*
- **CI** (`.github/workflows/greenberry-gui-ci.yml`): frontend typecheck/test/build + Rust `cargo test` against a Postgres service, plus a tagged signed-release job. Perf budgets documented in `docs/PERF-BUDGETS.md`.

### 2.7 Performance budgets

Cold start < 2s · idle RSS a small fraction of Electron-Arctype (~50–100 MB vs 300–500 MB) · first rows < 1s streamed · grid scroll 60fps windowed over 100k buffered rows · Cmd+K render < 50ms · zero telemetry before first paint. DB-layer numbers already validated by the S1.2 spike. *(PRD-GUI.md §11; docs/PERF-BUDGETS.md)*

---

## 3. Product positioning driver

**"The Arctype you remember, native-fast, with the admin it never had."** Arctype was acquired by ClickHouse in 2022 and discontinued. GreenBerry Desktop restores its palette/editor/grid/variables/dashboards on Tauri and adds staged writes, FK navigation, and an admin surface (sessions/kill, roles, backup, metrics). *(PRD-GUI.md §1, §4)*

---

## 4. Non-goals (architectural boundaries)

Deferred so the architecture stays honest, but not precluded:

- Team collaboration / cloud sync / shared workspaces / SSO / scheduled emailed queries (Arctype's paid tier). Local-first now; a sync layer stays possible later.
- Windows/Linux/web builds — macOS first; Tauri keeps cross-platform open.
- Plugin system, AI/NL-to-SQL, embedding/REST API.
- Engines beyond the four (ClickHouse, Oracle, MongoDB) — the adapter interface keeps the door open.
- No shared code with the TUI app.

---

## 5. Open questions (from the PRD, still to resolve)

- Exact workspace-store format (SQLite app-db vs JSON — currently JSON).
- Whether the Workspace DB / CSV-import target uses the app-db or a per-workspace SQLite file.
- Minimum supported macOS version.

---

## Revision R1 — Local SQLite persistence, macOS Keychain removed (2026-07-09)

This **supersedes** the credential/persistence decisions in §1 (D3), §2.4, and §2.5 where they conflict. The originals are left in place for history; this section wins.

**Decision.** All local persistence — connection strings **and** metadata, saved queries, history, dashboards, settings, and **credentials** — moves into a single **local SQLite application database**, accessed through the existing Rust `sqlx` layer (SQLite). The macOS Keychain is removed entirely.

**What changes:**
- **Removed:** the `keyring` crate, the Rust `secret_set` / `secret_get` / `secret_delete` commands, and the frontend `secrets.ts` helpers (`sanitizeForStore` / `withSecret`). No Keychain dependency remains.
- **Absorbed:** the `localStorage` workspace store (`greenberry.workspace.v1`) is replaced by the SQLite app-db as the single source of truth. *(This resolves the prior open question "SQLite app-db vs JSON" in favour of SQLite — see §5.)*
- **Connections table** holds the full connection descriptor — host / port / user / database / sslMode **and** the password/secret. There is no longer a metadata-vs-secret split, because there is no separate secret store.

**Location.** One `.db` file at the macOS app-data path (e.g. `~/Library/Application Support/com.greenberry.desktop/greenberry.db`), schema-versioned with migrations (carrying forward the versioning intent of the old workspace store).

**Reuse.** No new data stack is introduced: the app-db is another `sqlx` SQLite connection the app owns, using the same connect/exec primitives as user connections.

**Security trade-off (tracked, not silently accepted).** The Keychain provided OS-level, user-authenticated, encrypted secret storage; a plaintext SQLite file does not. Storing credentials in the app-db therefore lowers at-rest protection unless the secret column is encrypted. The **storage location (SQLite) is the settled requirement**; the **encryption posture is an open decision** — SQLCipher, an app-managed key, or explicitly-accepted local-plaintext with rationale — captured as a roadmap story + ADR (`ROADMAP-GUI.md` Addendum R4). Flagged here so it is not lost.

**Roadmap:** `ROADMAP-GUI.md` Addendum (stories R1–R4) and the E10 integration epic implement this.

---

*Sources: `PRD-GUI.md`, `ROADMAP-GUI.md`, `greenberry-frontend-macos/docs/adr/0001-db-access-layer.md`, `greenberry-frontend-macos/docs/PERF-BUDGETS.md`, and the `greenberry-frontend-macos/` source tree. Where this document and the PRD disagree on a detail (e.g. React 18 vs the shipped React 19), the code is authoritative and the discrepancy is flagged inline.*
