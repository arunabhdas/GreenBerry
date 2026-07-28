// SSH tunnel configuration (S2.3). The Rust side spawns `ssh -L <args>` to
// forward a local port to the DB through the bastion; end-to-end verification
// needs a reachable SSH host. Tilde expansion fixes an Arctype paper cut.
export function expandTilde(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return home + path.slice(1);
  return path;
}

export interface SshConfig {
  host: string;
  port?: number;
  user: string;
  keyPath?: string;
}

/** Build `ssh -N -L <local>:<dbHost>:<dbPort> [-i key] [-p port] user@host`. */
export function buildSshTunnelArgs(
  ssh: SshConfig,
  home: string,
  localPort: number,
  dbHost: string,
  dbPort: number,
): string[] {
  const args = ["-N", "-L", `${localPort}:${dbHost}:${dbPort}`];
  if (ssh.keyPath) args.push("-i", expandTilde(ssh.keyPath, home));
  if (ssh.port) args.push("-p", String(ssh.port));
  args.push(`${ssh.user}@${ssh.host}`);
  return args;
}
