import { useEffect, useState } from "react";

export function useInterviewClock({
  startedAt,
  disabled,
  hardCapMs
}: {
  startedAt: number | null;
  disabled: boolean;
  hardCapMs: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0);
      return;
    }
    if (disabled) return;

    const updateElapsed = () => setElapsed(Math.min(hardCapMs, Date.now() - startedAt));
    updateElapsed();
    // The UI only displays whole seconds. Updating twice per second needlessly
    // rerendered the complete live workspace, including transcript and editor.
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [disabled, hardCapMs, startedAt]);

  return elapsed;
}
