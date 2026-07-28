import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar, type DbNodeInfo, type ServerNodeInfo } from "./Sidebar";
import type { Catalog } from "../../lib/db";

const catalog: Catalog = {
  schemas: [
    {
      name: "public",
      tables: [
        {
          name: "users",
          kind: "table",
          columns: [{ name: "id", dataType: "integer", nullable: false, primaryKey: true }],
        },
        {
          name: "orders",
          kind: "table",
          columns: [{ name: "total", dataType: "numeric", nullable: true, primaryKey: false }],
        },
      ],
    },
  ],
};

const ready: DbNodeInfo = { name: "postgres", state: "ready", catalog };
const closed: DbNodeInfo = { name: "blueberry_demo", state: "closed" };

function server(overrides: Partial<ServerNodeInfo> = {}): ServerNodeInfo {
  return {
    connId: "c1",
    name: "Local PG",
    env: "local",
    databases: [ready, closed],
    currentDatabase: "postgres",
    ...overrides,
  };
}

describe("Sidebar (multi-server tree)", () => {
  it("shows the server as a root group with its databases", () => {
    render(<Sidebar servers={[server()]} />);
    expect(screen.getByText(/Local PG/)).toBeInTheDocument();
    expect(screen.getByText(/postgres/)).toBeInTheDocument();
    expect(screen.getByText(/blueberry_demo/)).toBeInTheDocument();
  });

  it("auto-expands the connected database and opens tables with server context", () => {
    const onOpenTable = vi.fn();
    render(<Sidebar servers={[server()]} onOpenTable={onOpenTable} />);
    fireEvent.click(screen.getByText("users"));
    expect(onOpenTable).toHaveBeenCalledWith("c1", "postgres", "public", "users");
  });

  it("expanding a closed database requests a lazy connect with server context", () => {
    const onExpandDatabase = vi.fn();
    render(<Sidebar servers={[server()]} onExpandDatabase={onExpandDatabase} />);
    fireEvent.click(screen.getByText(/blueberry_demo/));
    expect(onExpandDatabase).toHaveBeenCalledWith("c1", "blueberry_demo");
  });

  it("shows loading and error states with retry", () => {
    const onExpandDatabase = vi.fn();
    render(
      <Sidebar
        servers={[
          server({
            databases: [
              { name: "slow", state: "loading" },
              { name: "locked", state: "error", error: "no CONNECT" },
            ],
            currentDatabase: "slow",
          }),
          server({
            connId: "c2",
            name: "Other",
            databases: [{ name: "locked2", state: "error", error: "x" }],
            currentDatabase: "locked2",
          }),
        ]}
        onExpandDatabase={onExpandDatabase}
      />,
    );
    expect(screen.getByText("connecting…")).toBeInTheDocument();
    // locked2 is c2's currentDatabase → already expanded, error row visible
    fireEvent.click(screen.getByText(/⚠ x — retry/));
    expect(onExpandDatabase).toHaveBeenCalledWith("c2", "locked2");
  });

  it("offers per-server close only when several servers are open", () => {
    const onCloseServer = vi.fn();
    const { rerender } = render(
      <Sidebar servers={[server()]} onCloseServer={onCloseServer} />,
    );
    expect(screen.queryByLabelText("close server Local PG")).toBeNull(); // lone server
    rerender(
      <Sidebar
        servers={[server(), server({ connId: "c2", name: "Blue PG", databases: [] })]}
        onCloseServer={onCloseServer}
      />,
    );
    fireEvent.click(screen.getByLabelText("close server Blue PG"));
    expect(onCloseServer).toHaveBeenCalledWith("c2");
  });

  it("filters tables within loaded databases and by name", () => {
    render(<Sidebar servers={[server()]} />);
    fireEvent.change(screen.getByLabelText("filter tables"), { target: { value: "ord" } });
    expect(screen.queryByText("users")).toBeNull();
    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.queryByText(/blueberry_demo/)).toBeNull(); // unloaded, name mismatch
    fireEvent.change(screen.getByLabelText("filter tables"), { target: { value: "blue" } });
    expect(screen.getByText(/blueberry_demo/)).toBeInTheDocument();
  });

  it("shows roles as a collapsible node inside the server group", () => {
    render(<Sidebar servers={[server({ roles: ["coder", "blueberry"] })]} />);
    expect(screen.queryByText("coder")).toBeNull(); // collapsed by default
    fireEvent.click(screen.getByText(/Roles/));
    expect(screen.getByText("coder")).toBeInTheDocument();
  });

  it("collapses and expands the whole sidebar", () => {
    render(<Sidebar servers={[server()]} />);
    fireEvent.click(screen.getByLabelText("collapse sidebar"));
    expect(screen.getByLabelText("expand sidebar")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("expand sidebar"));
    expect(screen.getByLabelText("filter tables")).toBeInTheDocument();
  });
});
