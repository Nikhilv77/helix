import { Check } from "lucide-react";
import { flowSteps, getSessionProgressIndex } from "@/lib/session-flow";
import type { DesignSession } from "@/lib/types";

interface ProgressStepperProps {
  session: DesignSession;
}

export function ProgressStepper({ session }: ProgressStepperProps) {
  const currentIndex = getSessionProgressIndex(session);

  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {flowSteps.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <li
            key={step.id}
            className={`flex min-h-12 items-center gap-3 rounded-md border px-3 transition ${
              complete
                ? "border-cyan-300/45 bg-cyan-300/10 text-brand shadow-glow"
                : "border-line bg-white/5 text-muted"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                complete ? "bg-brand text-slate-950" : "border border-line bg-white/8 text-muted"
              }`}
            >
              {complete ? <Check size={14} /> : index + 1}
            </span>
            <span className="text-sm font-medium">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
