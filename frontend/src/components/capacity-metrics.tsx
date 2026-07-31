import type { CapacityCalculation, MetricValue } from "@/lib/types";

interface CapacityMetricsProps {
  calculation: CapacityCalculation | null;
}

const metricLabels: Array<[keyof CapacityCalculation["results"], string]> = [
  ["dailyActiveUsers", "Daily active users"],
  ["averageRequestsPerSecond", "Average RPS"],
  ["peakRequestsPerSecond", "Peak RPS"],
  ["readQps", "Read QPS"],
  ["writeQps", "Write QPS"],
  ["dailyBandwidth", "Daily bandwidth"],
  ["monthlyBandwidth", "Monthly bandwidth"],
  ["monthlyStorageGrowth", "Monthly storage growth"],
  ["retainedStorageEstimate", "Retained storage"]
];

function MetricCard({ label, metric }: { label: string; metric: MetricValue }) {
  return (
    <div className="rounded-md border border-line bg-white/5 p-4 transition hover:border-cyan-300/35 hover:bg-white/8">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{metric.display}</p>
      <p className="mt-1 text-xs text-muted">{metric.unit}</p>
    </div>
  );
}

export function CapacityMetrics({ calculation }: CapacityMetricsProps) {
  if (!calculation) {
    return (
      <p className="text-sm text-muted">
        Run the capacity calculator after requirements are ready.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metricLabels.map(([key, label]) => (
          <MetricCard key={key} label={label} metric={calculation.results[key]} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Assumptions</h3>
          <ul className="space-y-2">
            {calculation.assumptions.map((assumption, index) => (
              <li
                key={`${index}-${assumption}`}
                className="rounded-md border border-line bg-white/6 px-3 py-2 text-sm text-slate-300"
              >
                {assumption}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Warnings</h3>
          {calculation.warnings.length === 0 ? (
            <p className="text-sm text-muted">No warnings returned.</p>
          ) : (
            <ul className="space-y-2">
              {calculation.warnings.map((warning, index) => (
                <li
                  key={`${index}-${warning}`}
                  className="rounded-md border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
                >
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
