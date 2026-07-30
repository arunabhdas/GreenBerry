// Subtle indeterminate progress bar (2px sweep) shown while a read is in
// flight — table loads, query runs, lazy database connects.
export function ProgressBar({ label = "loading" }: { label?: string }) {
  return (
    <div className="gb-progress" role="progressbar" aria-label={label}>
      <div className="gb-progress__bar" />
    </div>
  );
}
