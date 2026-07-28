# Performance budgets (S9.1)

Targets the app is expected to meet; enforced in CI once the release pipeline
exists (a local sandbox can't run the CI gate).

| Budget | Target | Evidence / how measured |
| --- | --- | --- |
| Cold start (window visible) | < 2s | `npm run tauri build` app launch timing |
| Idle memory (RSS) | a small fraction of Electron-Arctype (~50–100 MB, vs 300–500 MB) | Tauri baseline; `/usr/bin/time -l` |
| 1M-row stream (Postgres) | < 0.5s, < 15 MB working set | measured: ~0.35s / 8.5 MB — `spike/db-access/results.md` |
| Query time-to-first-row | < 10 ms local | measured: ~0.9 ms — spike |
| Telemetry before first paint | **none** | no analytics; no phone-home |
| Input latency (grid scroll) | 60fps windowed | `DataGrid` virtualization (`visibleRange`) |

The DB-layer numbers are already validated by the S1.2 spike
(`docs/adr/0001-db-access-layer.md`). The app-launch and memory budgets are
checked against a packaged build; wiring them as a CI gate is the remaining
work for this story.
