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

  it("reveal toggle flips the password field type both ways (S2.8)", () => {
    render(<ConnectionModal onSave={noop} onClose={noop} testConnection={async () => {}} />);
    const field = screen.getByLabelText("password") as HTMLInputElement;
    expect(field.type).toBe("password"); // hidden by default
    fireEvent.click(screen.getByLabelText("show password"));
    expect(field.type).toBe("text");
    fireEvent.click(screen.getByLabelText("hide password"));
    expect(field.type).toBe("password");
  });

  it("edit mode reveals the stored password on demand", () => {
    render(
      <ConnectionModal
        initial={{
          id: "c1",
          name: "Staging",
          env: "staging",
          config: {
            engine: "postgres",
            host: "db.internal",
            port: 5432,
            user: "ada",
            password: "s3cret",
            database: "appdb",
          },
        }}
        onSave={noop}
        onClose={noop}
        testConnection={async () => {}}
      />,
    );
    const field = screen.getByLabelText("password") as HTMLInputElement;
    expect(field.value).toBe("s3cret"); // prefilled from the stored row
    expect(field.type).toBe("password"); // but hidden until revealed
    fireEvent.click(screen.getByLabelText("show password"));
    expect(field.type).toBe("text");
  });

  const editInitial = {
    id: "c1",
    name: "Staging",
    env: "staging" as const,
    config: {
      engine: "postgres" as const,
      host: "db.internal",
      port: 5432,
      user: "ada",
      password: "s3cret",
      database: "appdb",
    },
  };

  it("prefills the connection string when editing, password masked (S2.9)", () => {
    render(
      <ConnectionModal initial={editInitial} onSave={noop} onClose={noop} testConnection={async () => {}} />,
    );
    expect(screen.getByLabelText("connection url")).toHaveValue(
      "postgres://ada:•••@db.internal:5432/appdb?sslmode=prefer",
    );
  });

  it("rebuilds the connection string live as parameter fields change (S2.9)", () => {
    render(<ConnectionModal onSave={noop} onClose={noop} testConnection={async () => {}} />);
    fireEvent.change(screen.getByLabelText("host"), { target: { value: "h2" } });
    fireEvent.change(screen.getByLabelText("database"), { target: { value: "mydb" } });
    const url = (screen.getByLabelText("connection url") as HTMLInputElement).value;
    expect(url).toContain("h2:5432/mydb");
  });

  it("connection-string password follows the reveal toggle (S2.9/S2.8)", () => {
    render(
      <ConnectionModal initial={editInitial} onSave={noop} onClose={noop} testConnection={async () => {}} />,
    );
    const url = () => (screen.getByLabelText("connection url") as HTMLInputElement).value;
    expect(url()).toContain(":•••@");
    fireEvent.click(screen.getByLabelText("show password"));
    expect(url()).toContain(":s3cret@");
    fireEvent.click(screen.getByLabelText("hide password"));
    expect(url()).toContain(":•••@");
  });

  it("importing a masked ••• password never overwrites the real one (S2.9)", () => {
    render(
      <ConnectionModal initial={editInitial} onSave={noop} onClose={noop} testConnection={async () => {}} />,
    );
    fireEvent.change(screen.getByLabelText("connection url"), {
      target: { value: "postgres://ada:•••@db2.internal:5432/appdb" },
    });
    fireEvent.click(screen.getByText("Import"));
    expect((screen.getByLabelText("host") as HTMLInputElement).value).toBe("db2.internal");
    expect((screen.getByLabelText("password") as HTMLInputElement).value).toBe("s3cret");
    // field re-normalizes to the canonical constructed (masked) string
    expect((screen.getByLabelText("connection url") as HTMLInputElement).value).toContain(
      "postgres://ada:•••@db2.internal:5432/appdb",
    );
  });

  it("disables macOS autocorrect on free-text fields", () => {
    render(<ConnectionModal onSave={noop} onClose={noop} testConnection={async () => {}} />);
    for (const label of ["connection url", "name", "host", "user", "database"]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute("autocorrect", "off");
      expect(field).toHaveAttribute("autocapitalize", "off");
      expect(field).toHaveAttribute("spellcheck", "false");
    }
  });
});
