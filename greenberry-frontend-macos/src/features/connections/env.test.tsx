import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ENV_META, isProtectedEnv, EnvBadge } from "./env";
import type { EnvTag } from "../../lib/workspace";

describe("env", () => {
  it("gates destructive actions on prod/staging", () => {
    expect(isProtectedEnv("prod")).toBe(true);
    expect(isProtectedEnv("staging")).toBe(true);
    expect(isProtectedEnv("dev")).toBe(false);
    expect(isProtectedEnv("local")).toBe(false);
  });

  it("has a color for every env", () => {
    (["local", "dev", "staging", "prod"] as EnvTag[]).forEach((e) => {
      expect(ENV_META[e].color).toBeTruthy();
      expect(ENV_META[e].label).toBeTruthy();
    });
  });

  it("renders a badge", () => {
    render(<EnvBadge env="prod" />);
    expect(screen.getByText("PROD")).toBeInTheDocument();
  });
});
