// Connection modal (S2.1). Engine picker + fields, URL paste-import (S2.6),
// env tag (S2.4), and a test-then-save flow with inline driver errors.
import { useState } from "react";
import { db, type ConnectionConfig, type Engine } from "../../lib/db";
import type { EnvTag, StoredConnection } from "../../lib/workspace";
import { Button } from "../../ui/Button";
import { noAutocorrect } from "../../ui/inputProps";
import { buildConnectionUrl, PASSWORD_MASK } from "./connString";
import { parseConnectionUrl } from "./parseUrl";

const ENGINES: { value: Engine; label: string }[] = [
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL / MariaDB" },
  { value: "sqlite", label: "SQLite" },
  { value: "mssql", label: "SQL Server" },
];
const ENVS: EnvTag[] = ["local", "dev", "staging", "prod"];
const DEFAULT_PORT: Record<Engine, number> = {
  postgres: 5432,
  mysql: 3306,
  mssql: 1433,
  sqlite: 0,
};

async function defaultTest(config: ConnectionConfig): Promise<void> {
  const id = await db.connect(config);
  await db.disconnect(id);
}

export interface ConnectionModalProps {
  initial?: Partial<StoredConnection>;
  onSave: (stored: StoredConnection, password?: string) => void;
  onClose: () => void;
  testConnection?: (config: ConnectionConfig) => Promise<void>;
}

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function ConnectionModal({
  initial,
  onSave,
  onClose,
  testConnection = defaultTest,
}: ConnectionModalProps) {
  const c0 = initial?.config;
  const [name, setName] = useState(initial?.name ?? "");
  const [env, setEnv] = useState<EnvTag>(initial?.env ?? "local");
  const [engine, setEngine] = useState<Engine>(c0?.engine ?? "postgres");
  const [host, setHost] = useState(c0?.host ?? "localhost");
  const [port, setPort] = useState<number>(c0?.port ?? 5432);
  const [user, setUser] = useState(c0?.user ?? "");
  const [password, setPassword] = useState(c0?.password ?? "");
  const [database, setDatabase] = useState(c0?.database ?? "");
  const [sslMode, setSslMode] = useState(c0?.sslMode ?? "prefer");
  // S2.9: null = mirror the constructed URL; a string = the user is pasting
  const [urlOverride, setUrlOverride] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  const isSqlite = engine === "sqlite";

  function buildConfig(): ConnectionConfig {
    return isSqlite
      ? { engine, host: "", port: 0, user: "", database }
      : { engine, host, port, user, password: password || undefined, database, sslMode };
  }

  // The URL field is live (FR-G2.10): rebuilt from the fields on every render,
  // password masked unless revealed (S2.8).
  const builtUrl = buildConnectionUrl(buildConfig(), { maskPassword: !showPassword });
  const urlText = urlOverride ?? builtUrl;

  /** Wrap a field setter so editing a parameter re-derives the URL field. */
  function synced<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setUrlOverride(null);
    };
  }

  function applyUrl() {
    try {
      const parsed = parseConnectionUrl(urlText);
      if (parsed.engine) {
        setEngine(parsed.engine);
        if (parsed.port == null) setPort(DEFAULT_PORT[parsed.engine]);
      }
      if (parsed.host !== undefined) setHost(parsed.host);
      if (parsed.port !== undefined) setPort(parsed.port);
      if (parsed.user !== undefined) setUser(parsed.user);
      // a masked ••• (from a copied display string) never overwrites the real one
      if (parsed.password !== undefined && parsed.password !== PASSWORD_MASK)
        setPassword(parsed.password);
      if (parsed.database !== undefined) setDatabase(parsed.database);
      if (parsed.sslMode !== undefined) setSslMode(parsed.sslMode);
      setUrlOverride(null); // re-normalize to the canonical constructed string
      setTest({ kind: "idle" });
    } catch (e) {
      setTest({ kind: "error", message: (e as Error).message });
    }
  }

  async function runTest() {
    setTest({ kind: "testing" });
    try {
      await testConnection(buildConfig());
      setTest({ kind: "ok" });
    } catch (e) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
      setTest({ kind: "error", message });
    }
  }

  function save() {
    const config = buildConfig();
    const stored: StoredConnection = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name || `${engine} @ ${isSqlite ? database : host}`,
      env,
      config,
    };
    onSave(stored, isSqlite ? undefined : password || undefined);
  }

  return (
    <div className="gb-modal" role="dialog" aria-label="Connect to a database">
      <div className="gb-modal__body">
        <h2>{initial?.id ? "Edit connection" : "New connection"}</h2>

        <label>
          Connection string
          <div style={{ display: "flex", gap: 6 }}>
            <input
              aria-label="connection url"
              {...noAutocorrect}
              value={urlText}
              onChange={(e) => setUrlOverride(e.target.value)}
              placeholder="postgres://user:pass@host:5432/db"
            />
            <Button onClick={applyUrl}>Import</Button>
          </div>
        </label>

        <label>
          Name
          <input aria-label="name" {...noAutocorrect} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Engine
          <select
            aria-label="engine"
            value={engine}
            onChange={(e) => {
              const next = e.target.value as Engine;
              setEngine(next);
              setPort(DEFAULT_PORT[next]);
              setUrlOverride(null);
            }}
          >
            {ENGINES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>

        {isSqlite ? (
          <label>
            File path
            <input
              aria-label="database"
              {...noAutocorrect}
              value={database}
              onChange={(e) => synced(setDatabase)(e.target.value)}
              placeholder="/path/to/file.db"
            />
          </label>
        ) : (
          <>
            <label>
              Host
              <input aria-label="host" {...noAutocorrect} value={host} onChange={(e) => synced(setHost)(e.target.value)} />
            </label>
            <label>
              Port
              <input
                aria-label="port"
                type="number"
                value={port}
                onChange={(e) => synced(setPort)(Number(e.target.value))}
              />
            </label>
            <label>
              User
              <input aria-label="user" {...noAutocorrect} value={user} onChange={(e) => synced(setUser)(e.target.value)} />
            </label>
            <label>
              Password
              <div className="gb-reveal">
                <input
                  aria-label="password"
                  type={showPassword ? "text" : "password"}
                  {...noAutocorrect}
                  value={password}
                  onChange={(e) => synced(setPassword)(e.target.value)}
                />
                <button
                  type="button"
                  className="gb-reveal__btn"
                  aria-label={showPassword ? "hide password" : "show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>
            <label>
              Database
              <input
                aria-label="database"
                {...noAutocorrect}
                value={database}
                onChange={(e) => synced(setDatabase)(e.target.value)}
              />
            </label>
            <label>
              SSL mode
              <select aria-label="ssl mode" value={sslMode} onChange={(e) => synced(setSslMode)(e.target.value)}>
                {["disable", "prefer", "require", "verify-ca", "verify-full"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label>
          Environment
          <select aria-label="environment" value={env} onChange={(e) => setEnv(e.target.value as EnvTag)}>
            {ENVS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        {test.kind === "ok" && (
          <p role="status" className="gb-conn-ok">
            ✓ Connection successful
          </p>
        )}
        {test.kind === "error" && (
          <p role="alert" className="gb-conn-error">
            {test.message}
          </p>
        )}

        <div className="gb-modal__actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={runTest} disabled={test.kind === "testing"}>
            {test.kind === "testing" ? "Testing…" : "Test Connection"}
          </Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
