import { describe, it, expect, vi } from "vitest";

const invoke = vi.fn((cmd: string, _args?: unknown) => {
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

import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../ui/theme";
import { ToastProvider } from "../ui/Toast";
import { Workspace } from "./Workspace";
import type { Catalog, ConnectionConfig } from "../lib/db";
import type { StoredConnection } from "../lib/workspace";

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

describe("Workspace shell (multi-db tree)", () => {
  it("renders the shell: db nodes, auto-expanded tables, roles, status bar", () => {
    renderWs();
    expect(screen.getByText("users")).toBeInTheDocument(); // initial db auto-expanded
    expect(screen.getByText(/blueberry_demo/)).toBeInTheDocument(); // sibling db node
    expect(screen.getByText(/Roles/)).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
    expect(screen.getByText(/1 tables/)).toBeInTheDocument();
    expect(screen.getByText("Local PG")).toBeInTheDocument();
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
});
