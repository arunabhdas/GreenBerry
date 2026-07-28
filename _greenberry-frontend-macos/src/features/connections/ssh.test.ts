import { describe, it, expect } from "vitest";
import { expandTilde, buildSshTunnelArgs } from "./ssh";

describe("ssh tunnel (S2.3)", () => {
  it("expands ~ paths (the Arctype paper cut)", () => {
    expect(expandTilde("~/.ssh/id_rsa", "/Users/me")).toBe("/Users/me/.ssh/id_rsa");
    expect(expandTilde("~", "/Users/me")).toBe("/Users/me");
    expect(expandTilde("/abs/key", "/Users/me")).toBe("/abs/key");
  });

  it("builds ssh -L forwarding args with key and port", () => {
    const args = buildSshTunnelArgs(
      { host: "bastion.example.com", port: 2222, user: "deploy", keyPath: "~/.ssh/id_ed25519" },
      "/Users/me",
      55432,
      "db.internal",
      5432,
    );
    expect(args).toEqual([
      "-N",
      "-L",
      "55432:db.internal:5432",
      "-i",
      "/Users/me/.ssh/id_ed25519",
      "-p",
      "2222",
      "deploy@bastion.example.com",
    ]);
  });

  it("omits key and port when not provided", () => {
    const args = buildSshTunnelArgs(
      { host: "h", user: "u" },
      "/home/u",
      55000,
      "127.0.0.1",
      5432,
    );
    expect(args).toEqual(["-N", "-L", "55000:127.0.0.1:5432", "u@h"]);
  });
});
