// Environment tags (S2.4). Colors + a destructive-action gate; prod/staging
// require confirmation and tint chrome.
import type { EnvTag } from "../../lib/workspace";

export const ENV_META: Record<EnvTag, { label: string; color: string }> = {
  local: { label: "LOCAL", color: "var(--dim)" },
  dev: { label: "DEV", color: "var(--indigo)" },
  staging: { label: "STAGING", color: "var(--warn)" },
  prod: { label: "PROD", color: "var(--danger)" },
};

/** Whether destructive actions on this env require an extra confirmation. */
export function isProtectedEnv(env: EnvTag): boolean {
  return env === "prod" || env === "staging";
}

export function EnvBadge({ env }: { env: EnvTag }) {
  const meta = ENV_META[env];
  return (
    <span
      className="gb-env-badge"
      data-env={env}
      style={{
        color: "var(--on-accent)",
        background: meta.color,
        fontSize: "0.62rem",
        fontWeight: 700,
        letterSpacing: "0.4px",
        padding: "1px 6px",
        borderRadius: "4px",
      }}
    >
      {meta.label}
    </span>
  );
}
