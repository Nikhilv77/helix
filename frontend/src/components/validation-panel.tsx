import type { DesignValidation, ValidationFinding } from "@/lib/types";

interface ValidationPanelProps {
  validation: DesignValidation | null;
}

function FindingList({ items, emptyLabel }: { items: ValidationFinding[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{emptyLabel}</p>;

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={`${index}-${item.category}`}
          className="rounded-md border border-line bg-white/5 p-3"
        >
          <p className="text-sm font-semibold text-ink">{item.category}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{item.message}</p>
          {item.recommendation ? (
            <p className="mt-2 text-xs leading-5 text-muted">{item.recommendation}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ValidationPanel({ validation }: ValidationPanelProps) {
  if (!validation) {
    return (
      <p className="text-sm text-muted">
        Validate the generated design to see scores and review notes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <div className="rounded-md border border-line bg-white/5 p-4 text-center">
          <p className="text-xs font-medium uppercase text-muted">Overall score</p>
          <p className="mt-2 text-5xl font-semibold text-ink">{validation.overallScore}</p>
          <p className="mt-1 text-xs text-muted">out of 100</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {validation.categoryScores.map((category, index) => (
            <div
              key={`${index}-${category.category}`}
              className="rounded-md border border-line bg-white/5 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{category.category}</p>
                <span className="text-sm font-semibold text-brand">{category.score}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-brand transition-all duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, category.score))}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{category.summary}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Critical issues</h3>
          <FindingList
            items={validation.criticalIssues}
            emptyLabel="No critical issues reported."
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Warnings</h3>
          <FindingList items={validation.warnings} emptyLabel="No warnings reported." />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Missing areas</h3>
          <FindingList items={validation.missingAreas} emptyLabel="No missing areas reported." />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Improvements</h3>
          <FindingList
            items={validation.improvementSuggestions}
            emptyLabel="No improvement suggestions reported."
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Strengths</h3>
          <FindingList items={validation.strengths} emptyLabel="No strengths reported." />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Unresolved assumptions</h3>
          {validation.unresolvedAssumptions.length === 0 ? (
            <p className="text-sm text-muted">No unresolved assumptions reported.</p>
          ) : (
            <ul className="space-y-2">
              {validation.unresolvedAssumptions.map((assumption, index) => (
                <li
                  key={`${index}-${assumption}`}
                  className="rounded-md border border-line bg-white/6 px-3 py-2 text-sm text-slate-300"
                >
                  {assumption}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
