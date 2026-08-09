import type { SVGProps } from "react";

/**
 * The Trailgrad mark as inline SVG so it can inherit `currentColor`.
 * The shapes match the original white PNG waveform bars, but marketing can
 * now render them in cream on the blue chrome and dark on light surfaces.
 */
export function TrailgradMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <g transform="translate(5.8 6.32) scale(0.06577)" fill="currentColor">
        <rect x="72" y="295" width="83" height="194" rx="41.5" />
        <rect x="210" y="201" width="86" height="378" rx="43" />
        <rect x="353" y="56" width="93" height="669" rx="46.5" />
        <rect x="503" y="233" width="86" height="339" rx="43" />
        <rect x="642" y="305" width="83" height="181" rx="41.5" />
      </g>
    </svg>
  );
}
