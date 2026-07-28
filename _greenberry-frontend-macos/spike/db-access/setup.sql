-- Benchmark fixture: 1,000,000-row table (~96 MB) with a mix of types.
-- Run: psql postgres -f setup.sql
DROP TABLE IF EXISTS gb_bench_1m;
CREATE TABLE gb_bench_1m AS
SELECT g AS id,
       'user_' || g AS name,
       (g % 2 = 0) AS active,
       now() - (g || ' seconds')::interval AS created_at,
       md5(g::text) AS hash
FROM generate_series(1, 1000000) g;
