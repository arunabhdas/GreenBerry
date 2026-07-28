// S1.2 spike — Rust in-process model (drivers compiled into the Tauri binary).
// Streams the whole 1M-row table with sqlx `.fetch()` and decodes every column
// (fair vs the Node object materialization). Reports connect/first-row/stream
// timings and throughput. Wrap with `/usr/bin/time -l` for process max RSS.
use futures::TryStreamExt;
use sqlx::{postgres::PgPoolOptions, Row};
use std::time::Instant;

const SQL: &str = "SELECT id, name, active, created_at, hash FROM gb_bench_1m";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://coder@localhost:5432/postgres".into());

    let t0 = Instant::now();
    let pool = PgPoolOptions::new().max_connections(1).connect(&url).await?;
    let connect_ms = t0.elapsed().as_secs_f64() * 1000.0;

    let mut rows: u64 = 0;
    let mut ttfr_ms: Option<f64> = None;
    let stream_start = Instant::now();
    let mut cur = sqlx::query(SQL).fetch(&pool);
    while let Some(row) = cur.try_next().await? {
        if ttfr_ms.is_none() {
            ttfr_ms = Some(stream_start.elapsed().as_secs_f64() * 1000.0);
        }
        // Decode all columns so the comparison mirrors the Node row objects.
        let _id: i32 = row.get(0);
        let _name: String = row.get(1);
        let _active: bool = row.get(2);
        let _created: chrono::DateTime<chrono::Utc> = row.get(3);
        let _hash: String = row.get(4);
        rows += 1;
    }

    let stream_ms = stream_start.elapsed().as_secs_f64() * 1000.0;
    let total_ms = t0.elapsed().as_secs_f64() * 1000.0;
    let rps = (rows as f64 / (stream_ms / 1000.0)) as u64;

    println!(
        "{{\"runtime\":\"rust-sqlx\",\"rows\":{},\"connect_ms\":{:.1},\"ttfr_ms\":{:.1},\"stream_ms\":{:.1},\"total_ms\":{:.1},\"rows_per_sec\":{}}}",
        rows,
        connect_ms,
        ttfr_ms.unwrap_or(0.0),
        stream_ms,
        total_ms,
        rps
    );
    Ok(())
}
