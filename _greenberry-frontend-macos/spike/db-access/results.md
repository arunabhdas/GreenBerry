# S1.2 spike — raw benchmark results

**Machine:** Apple Silicon (aarch64), macOS 15, PostgreSQL 16.14 (local, TCP `localhost:5432`).
**Fixture:** `gb_bench_1m` — 1,000,000 rows, ~96 MB (int / text / bool / timestamptz / md5 text). See `setup.sql`.
**Query:** `SELECT id, name, active, created_at, hash FROM gb_bench_1m` — full scan, all columns decoded.
**Builds:** Rust `--release`; Node 22. Process RSS via `/usr/bin/time -l`.

## Rust `sqlx` (in-process)

| run | rows/s | stream ms | ttfr ms | connect ms | total ms | proc max RSS | wall |
| --- | ------ | --------- | ------- | ---------- | -------- | ------------ | ---- |
| cold | 2,963,172 | 337.5 | 0.9 | 11.5 | 349.0 | **8.5 MB** | 0.82s |
| warm | 2,873,586 | 348.0 | 0.9 | 5.5 | 353.5 | — | — |
| warm | 2,793,769 | 357.9 | 0.7 | 4.8 | 362.7 | — | — |

Release binary (bench, incl. tokio+sqlx+rustls): ~4.1 MB.

## Node sidecar (`pg` + `pg-query-stream`)

| run | rows/s | stream ms | ttfr ms | connect ms | total ms | proc max RSS | wall |
| --- | ------ | --------- | ------- | ---------- | -------- | ------------ | ---- |
| cold | 499,265 | 2002.9 | 20.1 | 93.3 | 2116.4 | **158 MB** | 2.23s |
| warm | 480,000 | 2083.3 | 38.7 | 19.1 | 2141.0 | ~149 MB | — |

## Summary

| metric | Rust sqlx | Node sidecar | ratio |
| --- | --- | --- | --- |
| throughput | ~2.9M rows/s | ~0.49M rows/s | ~6× |
| stream 1M rows | ~0.35s | ~2.0s | ~5.7× |
| time-to-first-row | ~0.9 ms | 20–39 ms | ~25× |
| peak process RSS | 8.5 MB | 158 MB | ~18× |
| cold wall time | 0.82s | 2.23s | ~2.7× |
| extra runtime to ship | none (in binary) | Node (~50–100 MB) or system Node | — |

Decision and rationale: see [`../../docs/adr/0001-db-access-layer.md`](../../docs/adr/0001-db-access-layer.md).

Reproduce:

```bash
psql postgres -f setup.sql
( cd node-sidecar && npm install && DATABASE_URL=postgres://coder@localhost:5432/postgres node bench.mjs )
( cd rust-sqlx && cargo build --release && DATABASE_URL=postgres://coder@localhost:5432/postgres ./target/release/gb-spike-rust-sqlx )
```
