import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn((cmd: string, _args?: unknown) => {
  if (cmd === "os_username") return Promise.resolve("coder");
  if (cmd === "db_connect") return Promise.resolve("cid-1");
  if (cmd === "db_introspect") return Promise.resolve({ schemas: [] });
  if (cmd === "db_databases" || cmd === "db_roles") return Promise.resolve([]);
  return Promise.resolve(undefined);
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invoke(cmd, args as never),
}));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../ui/theme";
import { ToastProvider } from "../ui/Toast";
import { ConnectScreen } from "./ConnectScreen";
import { workspace, type StoredConnection } from "../lib/workspace";

const stored: StoredConnection = {
  id: "c1",
  name: "Staging PG",
  env: "staging",
  config: {
    engine: "postgres",
    host: "db.internal",
    port: 6543,
    user: "ada",
    password: "s3cret",
    database: "appdb",
  },
};

function renderScreen(onConnected = vi.fn()) {
  render(
    <ThemeProvider>
      <ToastProvider>
        <ConnectScreen onConnected={onConnected} />
      </ToastProvider>
    </ThemeProvider>,
  );
  return onConnected;
}

beforeEach(() => {
  invoke.mockClear();
  workspace.update((s) => ({ ...s, connections: [] }));
});

describe("ConnectScreen saved-connections panel (S10.5)", () => {
  it("lists persisted connections with a masked connection string", () => {
    workspace.addConnection(stored);
    renderScreen();
    expect(screen.getByLabelText("Saved connections")).toBeInTheDocument();
    expect(screen.getByText("postgres://ada:•••@db.internal:6543/appdb")).toBeInTheDocument();
    expect(screen.queryByText(/s3cret/)).toBeNull(); // never on screen
  });

  it("copies the full connection URL, password included", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    workspace.addConnection(stored);
    renderScreen();
    fireEvent.click(screen.getByLabelText("copy url Staging PG"));
    expect(writeText).toHaveBeenCalledWith("postgres://ada:s3cret@db.internal:6543/appdb");
  });

  it("deletes only after an explicit confirm", () => {
    workspace.addConnection(stored);
    renderScreen();
    fireEvent.click(screen.getByLabelText("delete Staging PG"));
    // first click arms the confirm — nothing removed yet
    expect(workspace.getState().connections).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("confirm delete Staging PG"));
    expect(workspace.getState().connections).toHaveLength(0);
    expect(screen.queryByText(/db.internal/)).toBeNull();
  });

  it("edit opens the modal prefilled and saves onto the same row", async () => {
    workspace.addConnection(stored);
    renderScreen();
    fireEvent.click(screen.getByLabelText("edit Staging PG"));
    const host = screen.getByLabelText("host") as HTMLInputElement;
    expect(host.value).toBe("db.internal"); // prefilled from the stored row
    fireEvent.change(host, { target: { value: "db2.internal" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => {
      expect(workspace.getState().connections).toHaveLength(1); // upsert, no dup
      expect(workspace.getState().connections[0].config.host).toBe("db2.internal");
    });
  });

  it("connects from a saved row", async () => {
    workspace.addConnection(stored);
    const onConnected = renderScreen();
    fireEvent.click(screen.getByLabelText("connect Staging PG"));
    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    expect(invoke).toHaveBeenCalledWith(
      "db_connect",
      expect.objectContaining({
        config: expect.objectContaining({ host: "db.internal", password: "s3cret" }),
      }),
    );
  });

  it("quick-connect persists its connection too", async () => {
    const onConnected = renderScreen();
    fireEvent.click(screen.getByText("Quick: Local Postgres"));
    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    const conns = workspace.getState().connections;
    expect(conns.map((c) => c.id)).toContain("local-pg");
  });
});
