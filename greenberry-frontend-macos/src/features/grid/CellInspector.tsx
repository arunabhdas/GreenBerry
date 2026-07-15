import { formatCell, isJsonLike, prettyJson } from "./inspect";

export interface CellInspectorProps {
  value: unknown;
  onCopy?: (text: string) => void;
}

/** Right-panel cell inspector (S4.6): pretty-prints JSON, copyable. */
export function CellInspector({ value, onCopy }: CellInspectorProps) {
  const json = isJsonLike(value);
  const text = json ? prettyJson(value) : formatCell(value);
  return (
    <div className="gb-inspector" role="region" aria-label="cell inspector">
      <div className="gb-inspector__head">
        <span className="gb-inspector__kind">{json ? "JSON" : "Value"}</span>
        <button
          type="button"
          className="gb-btn gb-btn--ghost gb-btn--sm"
          aria-label="copy value"
          onClick={() => onCopy?.(text)}
        >
          Copy
        </button>
      </div>
      <pre className="gb-inspector__body">{text}</pre>
    </div>
  );
}
