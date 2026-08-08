import Image from "next/image";

/**
 * The Trailgrad mark — the supplied brand icon at /brand/trailgrad-icon.png. Every
 * surface renders it through this component, so replacing that file swaps the
 * logo everywhere in one go.
 *
 * The artwork is white on transparency, which suits the blueprint blue and the
 * rest of the dark chrome. The favicon points at /brand/trailgrad-favicon.svg
 * instead: the same mark on a blue tile, so it survives a light browser tab.
 */
export function TrailgradMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/trailgrad-icon.png"
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      className={className}
    />
  );
}
