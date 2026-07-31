interface LoadingStateProps {
  label: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="surface-card page-enter rounded-lg p-6 text-sm text-muted">
      <div className="flex items-center gap-3">
        <div className="relative h-5 w-5">
          <div className="absolute inset-0 rounded-full border border-cyan-300/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
          <div
            className="absolute inset-1 rounded-full bg-cyan-300/25"
            style={{ animation: "breathe 1.6s infinite" }}
          />
        </div>
        <span>{label}</span>
      </div>
      <div className="mt-5 grid gap-2">
        <div className="shimmer h-2 rounded-full bg-white/8" />
        <div className="shimmer h-2 w-2/3 rounded-full bg-white/8" />
      </div>
    </div>
  );
}
