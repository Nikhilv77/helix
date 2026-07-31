import { formatStatus } from "@/lib/format";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color =
    status === "ACTIVE" || status === "READY_FOR_DESIGN" || status === "COMPLETED"
      ? "border-emerald-300/35 bg-emerald-400/12 text-emerald-200"
      : status === "FAILED" || status === "ARCHIVED"
        ? "border-red-300/35 bg-red-500/12 text-red-200"
        : status === "GENERATING"
          ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-200"
          : "border-amber-300/35 bg-amber-400/12 text-amber-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm ${color}`}
    >
      {formatStatus(status)}
    </span>
  );
}
