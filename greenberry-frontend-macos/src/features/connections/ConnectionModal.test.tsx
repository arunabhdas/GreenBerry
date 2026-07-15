import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectionModal } from "./ConnectionModal";

const noop = () => {};

describe("ConnectionModal", () => {
  it("imports a URL into the fields", () => {
    render(<ConnectionModal onSave={noop} onClose={noop} testConnection={async () => {}} />);
    fireEvent.change(screen.getByLabelText("connection url"), {
      target: { value: "postgres://ada:pw@db:6543/appdb" },
    });
    fireEvent.click(screen.getByText("Import"));
    expect((screen.getByLabelText("host") as HTMLInputElement).value).toBe("db");
    expect((screen.getByLabelText("port") as HTMLInputElement).value).toBe("6543");
    expect((screen.getByLabelText("user") as HTMLInputElement).value).toBe("ada");
    expect((screen.getByLabelText("database") as HTMLInputElement).value).toBe("appdb");
  });

  it("shows a driver error inline when Test fails", async () => {
    const testConnection = vi.fn().mockRejectedValue({
      message: "password authentication failed",
    });
    render(<ConnectionModal onSave={noop} onClose={noop} testConnection={testConnection} />);
    fireEvent.click(screen.getByText("Test Connection"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "password authentication failed",
    );
  });

  it("shows success then saves a StoredConnection", async () => {
    const onSave = vi.fn();
    render(
      <ConnectionModal
        onSave={onSave}
        onClose={noop}
        testConnection={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.change(screen.getByLabelText("database"), {
      target: { value: "postgres" },
    });
    fireEvent.click(screen.getByText("Test Connection"));
    expect(await screen.findByRole("status")).toHaveTextContent("successful");

    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledOnce();
    const stored = onSave.mock.calls[0][0];
    expect(stored.config.engine).toBe("postgres");
    expect(stored.config.database).toBe("postgres");
  });

  it("switches to sqlite fields", () => {
    render(<ConnectionModal onSave={noop} onClose={noop} testConnection={async () => {}} />);
    fireEvent.change(screen.getByLabelText("engine"), {
      target: { value: "sqlite" },
    });
    expect(screen.getByLabelText("database")).toBeInTheDocument();
    expect(screen.queryByLabelText("host")).toBeNull();
  });
});
