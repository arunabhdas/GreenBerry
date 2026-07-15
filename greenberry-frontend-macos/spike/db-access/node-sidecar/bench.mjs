// S1.2 spike — Node sidecar model.
// Streams the whole 1M-row table with a server-side cursor (pg-query-stream),
// materializing each row as a JS object (as a real sidecar would before
// serializing to the webview). Reports connect/first-row/stream timings,
// throughput, and in-process peak RSS. Wrap with `/usr/bin/time -l` for the
// process-wide max RSS that includes the Node runtime itself.
import pg from "pg";
import QueryStream from "pg-query-stream";

const URL =
  process.env.DATABASE_URL || "postgres://coder@localhost:5432/postgres";
const SQL = "SELECT id, name, active, created_at, hash FROM gb_bench_1m";

const t0 = performance.now();
const client = new pg.Client({ connectionString: URL });
await client.connect();
const tConn = performance.now();

let rows = 0;
let firstRowAt = null;
let peakRss = process.memoryUsage().rss;
const sampler = setInterval(() => {
  const rss = process.memoryUsage().rss;
  if (rss > peakRss) peakRss = rss;
}, 25);

const stream = client.query(new QueryStream(SQL, [], { batchSize: 10000 }));
await new Promise((resolve, reject) => {
  stream.on("data", () => {
    if (firstRowAt === null) firstRowAt = performance.now();
    rows++;
  });
  stream.on("end", resolve);
  stream.on("error", reject);
});
const tEnd = performance.now();
clearInterval(sampler);
peakRss = Math.max(peakRss, process.memoryUsage().rss);
await client.end();

const streamMs = tEnd - firstRowAt;
console.log(
  JSON.stringify(
    {
      runtime: "node-pg",
      rows,
      connect_ms: +(tConn - t0).toFixed(1),
      ttfr_ms: +(firstRowAt - tConn).toFixed(1),
      stream_ms: +streamMs.toFixed(1),
      total_ms: +(tEnd - t0).toFixed(1),
      rows_per_sec: Math.round(rows / (streamMs / 1000)),
      heap_peak_rss_mb: +(peakRss / 1048576).toFixed(1),
    },
    null,
    2,
  ),
);
