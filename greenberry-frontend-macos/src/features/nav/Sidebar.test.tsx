import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar, type DbNodeInfo } from "./Sidebar";
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

describe("Sidebar (pgAdmin-style tree)", () => {
  it("lists every server database as a root node", () => {
    render(<Sidebar databases={[ready, closed]} />);
    expect(screen.getByText(/postgres/)).toBeInTheDocument();
    expect(screen.getByText(/blueberry_demo/)).toBeInTheDocument();
  });

  it("auto-expands the connected database and opens tables on click", () => {
    const onOpenTable = vi.fn();
    render(
      <Sidebar databases={[ready, closed]} currentDatabase="postgres" onOpenTable={onOpenTable} />,
    );
    fireEvent.click(screen.getByText("users")); // visible without extra clicks
    expect(onOpenTable).toHaveBeenCalledWith("postgres", "public", "users");
  });

  it("expanding a closed database requests a lazy connect", () => {
    const onExpandDatabase = vi.fn();
    render(<Sidebar databases={[closed]} onExpandDatabase={onExpandDatabase} />);
    fireEvent.click(screen.getByText(/blueberry_demo/));
    expect(onExpandDatabase).toHaveBeenCalledWith("blueberry_demo");
  });

  it("shows a connecting indicator while a database loads", () => {
    render(
      <Sidebar
        databases={[{ name: "blueberry_demo", state: "loading" }]}
        currentDatabase="blueberry_demo"
      />,
    );
    expect(screen.getByText("connecting…")).toBeInTheDocument();
  });

  it("shows the error and retries on click", () => {
    const onExpandDatabase = vi.fn();
    render(
      <Sidebar
        databases={[{ name: "locked", state: "error", error: "no CONNECT" }]}
        currentDatabase="locked"
        onExpandDatabase={onExpandDatabase}
      />,
    );
    fireEvent.click(screen.getByText(/no CONNECT/));
    expect(onExpandDatabase).toHaveBeenCalledWith("locked");
  });

  it("filters tables within loaded databases and dbs by name", () => {
    render(<Sidebar databases={[ready, closed]} currentDatabase="postgres" />);
    fireEvent.change(screen.getByLabelText("filter tables"), { target: { value: "ord" } });
    expect(screen.queryByText("users")).toBeNull();
    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.queryByText(/blueberry_demo/)).toBeNull(); // unloaded, name mismatch
    fireEvent.change(screen.getByLabelText("filter tables"), { target: { value: "blue" } });
    expect(screen.getByText(/blueberry_demo/)).toBeInTheDocument();
  });

  it("shows roles as a collapsible root node", () => {
    render(<Sidebar databases={[ready]} roles={["coder", "blueberry"]} />);
    expect(screen.queryByText("coder")).toBeNull(); // collapsed by default
    fireEvent.click(screen.getByText(/Roles/));
    expect(screen.getByText("coder")).toBeInTheDocument();
    expect(screen.getByText("blueberry")).toBeInTheDocument();
  });

  it("collapses and expands the whole sidebar", () => {
    render(<Sidebar databases={[ready]} />);
    fireEvent.click(screen.getByLabelText("collapse sidebar"));
    expect(screen.getByLabelText("expand sidebar")).toBeInTheDocument();
    expect(screen.queryByLabelText("filter tables")).toBeNull();
    fireEvent.click(screen.getByLabelText("expand sidebar"));
    expect(screen.getByLabelText("filter tables")).toBeInTheDocument();
  });
});
