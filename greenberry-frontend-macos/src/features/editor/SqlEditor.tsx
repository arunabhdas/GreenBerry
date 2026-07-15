import { extractVariables } from "./variables";
import { formatSql } from "./format";

export interface SqlEditorProps {
  value: string;
  onChange: (v: string) => void;
  onRun: (sql: string) => void;
  running?: boolean;
}

/**
 * SQL editor surface (S5.1). Uses a textarea as the editable surface with the
 * editor logic wired (Run / Cmd+Enter, Format, detected {{variables}}). The
 * surface is a drop-in for Monaco in production; keeping it a textarea keeps the
 * component unit-testable in jsdom.
 */
export function SqlEditor({ value, onChange, onRun, running }: SqlEditorProps) {
  const vars = extractVariables(value);
  return (
    <div className="gb-editor">
      <div className="gb-editor__toolbar" style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="gb-btn gb-btn--primary gb-btn--sm"
          aria-label="run"
          onClick={() => onRun(value)}
        >
          {running ? "Cancel" : "Run"}
        </button>
        <button
          type="button"
          className="gb-btn gb-btn--sm"
          aria-label="format"
          onClick={() => onChange(formatSql(value))}
        >
          Format
        </button>
      </div>
      <textarea
        aria-label="sql editor"
        className="gb-editor__surface"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onRun(value);
          }
        }}
      />
      {vars.length > 0 && (
        <div className="gb-editor__vars" aria-label="query variables">
          {vars.map((v) => (
            <span key={v} className="gb-editor__var">
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
