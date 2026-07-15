import { Button } from "../../ui/Button";

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
}

export interface HomeProps {
  steps: OnboardingStep[];
  recent?: { id: string; name: string }[];
  onNewQuery?: () => void;
  onAddConnection?: () => void;
  onOpenRecent?: (id: string) => void;
}

export function Home({
  steps,
  recent = [],
  onNewQuery,
  onAddConnection,
  onOpenRecent,
}: HomeProps) {
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="gb-home" style={{ padding: "var(--space-4)", maxWidth: 720 }}>
      <div className="gb-home__actions" style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={onNewQuery}>
          New Query
        </Button>
        <Button onClick={onAddConnection}>Add Connection</Button>
      </div>

      <h3>Getting started</h3>
      <div
        className="gb-home__progress"
        aria-label="onboarding progress"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemax={steps.length}
      >
        {done}/{steps.length}
      </div>
      <ul className="gb-home__steps">
        {steps.map((s) => (
          <li key={s.id} data-done={s.done}>
            {s.done ? "✓" : "○"} {s.label}
          </li>
        ))}
      </ul>

      {recent.length > 0 && (
        <>
          <h3>Recent connections</h3>
          <ul className="gb-home__recent">
            {recent.map((r) => (
              <li key={r.id}>
                <button onClick={() => onOpenRecent?.(r.id)}>{r.name}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
