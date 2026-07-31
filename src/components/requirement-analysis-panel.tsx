import type { RequirementAnalysis } from "@/lib/types";

interface RequirementAnalysisPanelProps {
  analysis: RequirementAnalysis | null;
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No entries yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${index}-${item}`}
          className="rounded-md border border-line bg-white/6 px-3 py-2 text-sm text-slate-300"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function RequirementAnalysisPanel({ analysis }: RequirementAnalysisPanelProps) {
  if (!analysis) {
    return <p className="text-sm text-muted">Run requirement analysis to populate this section.</p>;
  }

  const scaleItems = [
    ["Expected users", analysis.scaleInputs.expectedUsers],
    ["Request rate", analysis.scaleInputs.requestRate],
    ["Storage", analysis.scaleInputs.storage],
    ["Regions", analysis.scaleInputs.regions],
    ["Availability", analysis.scaleInputs.availabilityTarget],
    ["Latency", analysis.scaleInputs.latencyTarget]
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className="space-y-5">
      <p className="rounded-md border border-line bg-white/6 p-4 text-sm leading-6 text-slate-300">
        {analysis.productSummary}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Functional requirements</h3>
          <div className="space-y-2">
            {analysis.functionalRequirements.map((item, index) => (
              <div
                key={`${index}-${item.id}`}
                className="rounded-md border border-line bg-white/5 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">{item.id}</p>
                  {item.priority ? (
                    <span className="rounded-full border border-line bg-white/8 px-2 py-1 text-xs text-muted">
                      {item.priority}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.requirement}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Non-functional requirements</h3>
          <div className="space-y-2">
            {analysis.nonFunctionalRequirements.map((item, index) => (
              <div
                key={`${index}-${item.id}`}
                className="rounded-md border border-line bg-white/5 p-3"
              >
                <p className="text-sm font-medium text-ink">{item.category}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.requirement}</p>
                {item.target ? (
                  <p className="mt-2 text-xs text-muted">Target: {item.target}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Assumptions</h3>
          <BulletList items={analysis.assumptions} />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Constraints</h3>
          <BulletList items={analysis.constraints} />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Missing information</h3>
          <BulletList items={analysis.missingInformation} />
        </div>
      </div>

      {scaleItems.length > 0 || analysis.scaleInputs.notes.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Scale inputs</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scaleItems.map(([label, value]) => (
              <div key={label} className="rounded-md border border-line bg-white/5 p-3">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 text-sm font-medium text-ink">{value}</p>
              </div>
            ))}
          </div>
          {analysis.scaleInputs.notes.length > 0 ? (
            <div className="mt-3">
              <BulletList items={analysis.scaleInputs.notes} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
