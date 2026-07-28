// Saved-connections rows (S10.5/S3.8): shared by the welcome screen and the
// workspace ConnectionsPanel. Rows show name + env + masked connection
// string; actions: connect (click), copy URL (full, incl. password), edit,
// delete (two-step confirm). Copy + confirm state live here; connect/edit/
// delete effects belong to the host.
import { useState } from "react";
import type { StoredConnection } from "../../lib/workspace";
import { buildConnectionUrl } from "./connString";
import { EnvBadge } from "./env";
import { useToast } from "../../ui/Toast";

export function SavedConnectionList({
  connections,
  busy,
  activeIds,
  onConnect,
  onEdit,
  onDelete,
}: {
  connections: StoredConnection[];
  busy?: boolean;
  /** Connection ids currently open (shown with a live dot). */
  activeIds?: string[];
  onConnect: (c: StoredConnection) => void;
  onEdit: (c: StoredConnection) => void;
  onDelete: (c: StoredConnection) => void;
}) {
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function copyUrl(c: StoredConnection) {
    navigator.clipboard?.writeText(buildConnectionUrl(c.config)).catch(() => {});
    notify(
      c.config.password
        ? "Connection URL copied — includes the password"
        : "Connection URL copied",
      "success",
    );
  }

  return (
    <>
      {connections.map((c) => (
        <div key={c.id} className="gb-connrow">
          <button
            className="gb-connrow__main"
            onClick={() => onConnect(c)}
            disabled={busy}
            aria-label={`connect ${c.name}`}
          >
            <span className="gb-connrow__name">
              {activeIds?.includes(c.id) && <span className="gb-connrow__live">●</span>}
              {c.name} <EnvBadge env={c.env} />
            </span>
            <span className="gb-connrow__url">
              {buildConnectionUrl(c.config, { maskPassword: true })}
            </span>
          </button>
          <span className="gb-connrow__actions">
            <button aria-label={`copy url ${c.name}`} title="Copy URL" onClick={() => copyUrl(c)}>
              ⧉
            </button>
            <button aria-label={`edit ${c.name}`} title="Edit" onClick={() => onEdit(c)}>
              ✎
            </button>
            {confirmDelete === c.id ? (
              <button
                aria-label={`confirm delete ${c.name}`}
                className="is-danger"
                onClick={() => {
                  setConfirmDelete(null);
                  onDelete(c);
                }}
              >
                sure?
              </button>
            ) : (
              <button
                aria-label={`delete ${c.name}`}
                title="Delete"
                onClick={() => setConfirmDelete(c.id)}
              >
                ✕
              </button>
            )}
          </span>
        </div>
      ))}
    </>
  );
}
