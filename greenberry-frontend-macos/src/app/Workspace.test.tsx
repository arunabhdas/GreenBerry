import { describe, it, expect, vi, beforeEach } from "vitest";

// rows the fake app-db returns for store_list_open_queries (S3.7)
let persistedQueries: Array<{ id: string; connId: string; db: string; sql: string }> = [];

const invoke = vi.fn((cmd: string, _args?: unknown) => {
  if (cmd === "store_list_open_queries") return Promise.resolve(persistedQueries);
  if (cmd.startsWith("store_")) return Promise.resolve(undefined);
  if (cmd === "db_databases" || cmd === "db_roles") return Promise.resolve([]);
  if (cmd === "db_connect") return Promise.resolve("cid-2");
  if (cmd === "db_introspect")
    return Promise.resolve({
      schemas: [
        {
          name: "public",
          tables: [
            {
              name: "pets",
              kind: "table",
              columns: [{ name: "id", dataType: "int4", nullable: false, primaryKey: true }],
            },
          ],
        },
      ],
    });
  if (cmd === "db_disconnect") return Promise.resolve(undefined);
  return Promise.resolve({
    columns: [{ name: "id", dataType: "int4" }],
    rows: [[1]],
    rowCount: 1,
    rowsAffected: 0,
    elapsedMs: 1,
    truncated: false,
  });
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invoke(cmd, args as never),
}));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../ui/theme";
import { ToastProvider } from "../ui/Toast";
import { Workspace } from "./Workspace";
import type { Catalog, ConnectionConfig } from "../lib/db";
import { workspace, type StoredConnection } from "../lib/workspace";

const catalog: Catalog = {
  schemas: [
    {
      name: "public",
      tables: [
        {
          name: "users",
          kind: "table",
          columns: [{ name: "id", dataType: "int4", nullable: false, primaryKey: true }],
        },
      ],
    },
  ],
};

const config: ConnectionConfig = {
  engine: "postgres",
  host: "h",
  port: 5432,
  user: "u",
  database: "d",
};

const conn: StoredConnection = {
  id: "c",
  name: "Local PG",
  env: "local",
  config,
};

function renderWs() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <Workspace
          conn={conn}
          config={config}
          initialConnectionId="c1"
          initialCatalog={catalog}
          databases={["d", "blueberry_demo"]}
          roles={["coder"]}
          onDisconnect={() => {}}
        />
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  persistedQueries = [];
  invoke.mockClear();
  workspace.update((s) => ({ ...s, connections: [] }));
});

describe("Workspace shell (multi-db tree)", () => {
  it("renders the shell: server group, db nodes, auto-expanded tables, roles, status bar", () => {
    renderWs();
    expect(screen.getByText("users")).toBeInTheDocument(); // initial db auto-expanded
    expect(screen.getByText(/blueberry_demo/)).toBeInTheDocument(); // sibling db node
    expect(screen.getByText(/Roles/)).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
    expect(screen.getByText(/1 tables/)).toBeInTheDocument();
    // titlebar + server group row + status bar all name the server
    expect(screen.getAllByText(/Local PG/).length).toBeGreaterThanOrEqual(2);
  });

  it("opens a table tab when a sidebar table is clicked", () => {
    renderWs();
    fireEvent.click(screen.getByText("users"));
    expect(screen.getByText("public.users")).toBeInTheDocument();
    expect(screen.getByText("↻ Refresh")).toBeInTheDocument();
  });

  it("lazily connects an unopened database and shows its tables", async () => {
    renderWs();
    fireEvent.click(screen.getByText(/blueberry_demo/));
    expect(await screen.findByText("pets")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith(
      "db_connect",
      expect.objectContaining({
        config: expect.objectContaining({ database: "blueberry_demo" }),
      }),
    );
    // both dbs are now loaded → table count spans the tree
    expect(screen.getByText(/2 tables/)).toBeInTheDocument();
  });

  it("opens the Cmd+K palette", () => {
    renderWs();
    fireEvent.click(screen.getByRole("button", { name: "⌘K" }));
    expect(screen.getByLabelText("quick find")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "table" })).toBeInTheDocument();
  });

  it("opens a query tab with a per-tab database dropdown", () => {
    renderWs();
    fireEvent.click(screen.getByRole("button", { name: "+ Query" }));
    expect(screen.getByLabelText("sql editor")).toBeInTheDocument();
    const select = screen.getByLabelText("query database") as HTMLSelectElement;
    expect(select.value).toBe("d"); // defaults to last-browsed database
    expect(screen.getByRole("option", { name: "blueberry_demo" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "blueberry_demo" } });
    expect(select.value).toBe("blueberry_demo");
  });

  it("query tab SQL survives switching away and back (S3.7)", async () => {
    renderWs();
    fireEvent.click(screen.getByRole("button", { name: "+ Query" }));
    fireEvent.change(screen.getByLabelText("sql editor"), {
      target: { value: "SELECT 42 FROM users" },
    });
    // navigate away (opens the users table tab) — pane stays mounted, hidden
    fireEvent.click(screen.getByText("users"));
    expect(screen.getByLabelText("sql editor")).not.toBeVisible();
    // … and back
    fireEvent.click(screen.getByText("Query"));
    expect(screen.getByLabelText("sql editor")).toBeVisible();
    expect(screen.getByLabelText("sql editor")).toHaveValue("SELECT 42 FROM users");
    // the debounced app-db upsert also lands
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "store_save_open_query",
        expect.objectContaining({
          query: expect.objectContaining({ connId: "c", db: "d", sql: "SELECT 42 FROM users" }),
        }),
      ),
    );
  });

  it("closing a query tab deletes its persisted SQL (S3.7)", () => {
    renderWs();
    fireEvent.click(screen.getByRole("button", { name: "+ Query" }));
    fireEvent.change(screen.getByLabelText("sql editor"), {
      target: { value: "SELECT 1" },
    });
    fireEvent.click(screen.getByLabelText("close Query"));
    expect(invoke).toHaveBeenCalledWith(
      "store_delete_open_query",
      expect.objectContaining({ id: expect.stringMatching(/^q:/) }),
    );
    expect(screen.queryByLabelText("sql editor")).toBeNull();
  });

  it("restores persisted query tabs on mount (S3.7)", async () => {
    persistedQueries = [{ id: "q:old", connId: "c", db: "d", sql: "SELECT 99" }];
    renderWs();
    const tab = await screen.findByText("Query"); // restored tab appears
    fireEvent.click(tab);
    expect(screen.getByLabelText("sql editor")).toHaveValue("SELECT 99");
    expect((screen.getByLabelText("query database") as HTMLSelectElement).value).toBe("d");
  });

  it("query results survive switching tabs without re-running (S3.8)", async () => {
    renderWs();
    fireEvent.click(screen.getByRole("button", { name: "+ Query" }));
    fireEvent.click(screen.getByLabelText("run"));
    await waitFor(() =>
      expect(invoke.mock.calls.filter((c) => c[0] === "db_query").length).toBe(1),
    );
    expect(screen.getAllByText("1").length).toBeGreaterThan(0); // result cell rendered

    fireEvent.click(screen.getByText("users")); // away (table tab)…
    fireEvent.click(screen.getByText("Query")); // …and back
    // results still rendered, and the query did not re-run
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    const queryRuns = invoke.mock.calls.filter(
      (c) => c[0] === "db_query" && (c[1] as { sql: string }).sql === "SELECT 1;",
    );
    expect(queryRuns.length).toBe(1);
  });

  it("opens a second server from the connections panel and closes it (S3.8)", async () => {
    workspace.addConnection({
      id: "c2",
      name: "Blue PG",
      env: "local",
      config: { engine: "postgres", host: "blue", port: 5432, user: "u", database: "bluedb" },
    });
    renderWs();
    fireEvent.click(screen.getByLabelText("connect Blue PG"));
    // ⛁-prefixed = tree db node + status bar (panel row URL also has "bluedb")
    expect((await screen.findAllByText(/⛁ bluedb/)).length).toBeGreaterThan(0);
    expect(invoke).toHaveBeenCalledWith(
      "db_connect",
      expect.objectContaining({
        config: expect.objectContaining({ host: "blue", database: "bluedb" }),
      }),
    );
    // both servers now count their tables (1 + 1 from the shared introspect mock)
    expect(screen.getByText(/2 tables/)).toBeInTheDocument();
    // close the second server: its group disappears, the first is untouched
    fireEvent.click(screen.getByLabelText("close server Blue PG"));
    await waitFor(() => expect(screen.queryAllByText(/⛁ bluedb/)).toHaveLength(0));
    expect(screen.getByText("users")).toBeInTheDocument();
  });
});
