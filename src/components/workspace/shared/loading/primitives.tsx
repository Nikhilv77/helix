/**
 * Loading pieces shared across workspace features. Page-shaped skeletons live
 * beside the feature they represent.
 */
export function RouteProgress() {
  // Route skeletons already communicate loading. The old fixed cream line
  // flashed above the inset desktop sidebar during a hard refresh and looked
  // like a stray white rendering artifact.
  return null;
}

const waveHeights = Array.from(
  { length: 14 },
  (_, index) =>
    34 + Math.abs(Math.sin(index * 0.62 + 0.8)) * 44 + Math.abs(Math.cos(index * 0.29)) * 20
);

export function Waveform({ className }: { className?: string }) {
  return (
    <div
      className={["flex h-9 items-center justify-center gap-1", className ?? ""].join(" ").trim()}
      aria-hidden="true"
    >
      {waveHeights.map((height, index) => (
        <span
          key={index}
          className="wave-bar w-0.5 rounded-full bg-cream/55"
          style={{ height: `${height}%`, animationDelay: `${index * 62}ms` }}
        />
      ))}
    </div>
  );
}
