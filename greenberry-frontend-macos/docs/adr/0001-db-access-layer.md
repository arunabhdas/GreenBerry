# ADR 0001 — Database access layer: Rust `sqlx` (in-process) over a Node sidecar

- **Status:** Accepted
- **Date:** 2026-07-03
- **Story:** S1.2 (ROADMAP-GUI.md, Epic E1)
- **Spike code & raw numbers:** [`spike/db-access/`](../../spike/db-access/) · [`results.md`](../../spike/db-access/results.md)

## Context

GreenBerry Desktop is a **Tauri 2 (Rust) + React** app. Its data layer must:

- connect to **PostgreSQL, MySQL/MariaDB, SQLite, SQL Server**;
- run **arbitrary user SQL** (a DB client — queries aren't known at compile time);
- **stream large result sets** to the webview with low latency and bounded memory;
- support **cancellation** and **introspection**;
- expose one **engine-agnostic command API** (`connect / query / stream / cancel / introspect`).

Two candidate architectures:

- **A. Rust-side drivers**, compiled into the Tauri binary — `sqlx` (Postgres/MySQL/SQLite) + `tiberius` (SQL Server) — exposed over Tauri IPC.
- **B. Node sidecar** process spawned by the Tauri host, reusing mature npm drivers (`pg`, `mysql2`, `better-sqlite3`, `tedious`), talking to Rust over stdio/IPC.

## Spike

Both prototypes streamed the **same 1,000,000-row Postgres table** (~96 MB; int/text/bool/timestamptz/text), **decoding every column** (fair vs. Node materializing row objects), release builds, local PG 16.14. Full method and per-run numbers in [`results.md`](../../spike/db-access/results.md).

| metric | Rust `sqlx` (in-process) | Node sidecar (`pg`) | advantage |
| --- | --- | --- | --- |
| throughput | **~2.9M rows/s** | ~0.49M rows/s | ~6× |
| stream 1M rows | ~0.35s | ~2.0s | ~5.7× |
| time-to-first-row | ~0.9 ms | 20–39 ms | ~25× |
| connect | 5–12 ms | 19–93 ms | — |
| peak process RSS | **8.5 MB** | 158 MB | ~18× |
| cold wall time | 0.82s | 2.23s | ~2.7× |
| extra runtime to ship | none (in the binary) | Node (~50–100 MB) or a system-Node dependency | — |

## Decision

Adopt **Option A — Rust `sqlx` in-process drivers** (with **`tiberius`** for SQL Server), invoked over Tauri IPC, behind one engine-agnostic adapter trait.

The measured gap is decisive on every axis, and the qualitative factors compound it:

- **No second runtime.** The sidecar means bundling Node (~50–100 MB, undoing Tauri's small-footprint advantage) or depending on a system Node install. Rust drivers add ~a few MB to a binary that already exists.
- **One fewer hop.** Sidecar path is DB → Node objects → IPC serialize → Rust → webview. In-process is DB → Rust → webview — one serialization boundary, not two.
- **One backend language.** The Tauri host is already Rust; no cross-process lifecycle, health-checking, or version-skew between a bundled Node and the host.
- **Native streaming & cancellation.** `sqlx` `.fetch()` yields a `Stream`; cancellation maps to dropping the stream / `pg_cancel_backend`.

## Consequences

**Positive**

- Best-in-class latency, throughput, and memory (above).
- Small bundle; no runtime version management; simpler packaging/notarization (one binary).
- Backpressure-friendly streaming to the webview in batches (batch size to be tuned in S1.3).

**Costs / watch-items**

- **Compile time.** First `sqlx` + `tokio` + `rustls` build is ~1–3 min — a dev-experience cost, not a runtime one (incremental builds are fast).
- **Runtime queries, not macros.** Because the app runs arbitrary user SQL, we use `sqlx`'s **runtime** `query()`/`query_as()` API (as the spike did), *not* the compile-time-checked `query!` macros (which need a fixed schema).
- **SQL Server ≠ sqlx.** `sqlx` covers PG/MySQL/SQLite; SQL Server uses **`tiberius`**. The adapter trait hides this — SQL Server lands later (M2) per the roadmap.
- **IPC serialization is still to design (S1.3).** Row batches → the webview (JSON vs. MessagePack, chunk size, typed-column handling). This applies to both models; the sidecar merely pays it twice.

**Revisit if:** a required engine has no viable/maintained Rust driver, compile time becomes a real blocker, or webview IPC serialization turns out to dominate (in which case the transport, not the driver location, is the lever).

## Follow-ups

- S1.3 — define the IPC command API (`connect/query/stream/cancel/introspect`) and the batch streaming/serialization format on top of this decision.
- Keep the spike (`spike/db-access/`) as a regression benchmark when the real adapter lands.
