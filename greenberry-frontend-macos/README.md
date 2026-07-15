# GreenBerry Desktop (macOS)

A macOS-first SQL client — an Arctype-style database GUI rebuilt on **Tauri 2 +
React + TypeScript** with a **Rust `sqlx`** data layer, plus the safety and admin
features Arctype lacked (staged edits with SQL preview, sessions/roles, FK
click-through). Local-first; **no email gate, no telemetry.**

## Download

Direct download — no account, no email. (Signed `.dmg` published from CI; see
[Packaging](#packaging).)

## Develop

Prereqs: Node ≥ 18, Rust (stable), Xcode command-line tools.

```bash
npm install
npm run tauri dev      # dev app with hot reload
```

Other scripts:

```bash
npm run build          # typecheck + Vite build (frontend)
npm run tauri build    # bundle the macOS app
npm test               # frontend unit tests (Vitest)
npm run typecheck      # tsc --noEmit
(cd src-tauri && cargo test)   # Rust unit + (with GB_TEST_PG_USER) live-PG integration
```

The component gallery (design system) is reachable in the running app at
`#gallery`.

## Architecture

```
src/
  lib/            db client (typed IPC), workspace store, fuzzy, shortcuts
  ui/             design tokens + ThemeProvider(zoom) + Button/Tabs/IconRail/Toast
  features/
    connections/  connection modal, manager, keychain, env badges, URL import
    nav/          sidebar tree, tabs store, Cmd+K palette, home
    query/        async per-tab query runner
    editor/       statements, variables, autocomplete, format, EXPLAIN, SqlEditor
    grid/         SQL builder, staged-changes engine, DataGrid, inspector, export
    schema/       DDL builders (create/alter/index/constraint), ERD
    dashboard/    chart mapping, canvas model, linking, refresh
    admin/        sessions/kill, grants, maintenance, metrics
src-tauri/
  src/db.rs       sqlx Postgres adapter: connect/query/cancel/introspect/exec_batch
  src/lib.rs      Tauri commands + keychain (secret_*)
  docs/adr/       0001 — DB access layer decision (sqlx over Node sidecar)
  spike/          the S1.2 benchmark
```

**Data layer:** Rust `sqlx` in-process (decision + benchmark in
`docs/adr/0001-db-access-layer.md`). Typed rows via Postgres `to_jsonb`; edits
apply through `db_exec_batch` in **one transaction** (rollback on failure).

## Feature status

Tracked in the repo's `ROADMAP-GUI.md`. Engines: Postgres is fully wired;
MySQL/SQLite/SQL Server are architected behind the same adapter but not yet
enabled (need their servers).

## Testing

- **Frontend:** Vitest + Testing Library (`npm test`) — 130+ tests across the
  data client, stores, editor logic, grid/staged-editing, schema DDL, dashboard,
  and admin builders.
- **Rust:** `cargo test` — unit tests plus live-Postgres integration (set
  `GB_TEST_PG_USER`) covering query/introspection, the transaction commit/rollback,
  and FK introspection.

## Packaging

- Bundle: `npm run tauri build`.
- **Codesigning / notarization** and the **auto-updater** require an Apple
  Developer certificate and a release/update server — configured in CI, not in a
  local sandbox.
