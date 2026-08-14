import type { ReactNode } from "react";
import { DocumentTitle } from "@/components/document-title";
import {
  ReportBriefingStage,
  ReportEmptyStage,
  type ReportCandidate
} from "@/components/workspace/report-briefing-stage";
import type { ReportsOverview } from "@/lib/reports";

/**
 * Phase 1 report experience.
 *
 * This is intentionally a briefing, not a dashboard: the first screen should
 * feel like Maya has reviewed the user's rounds and is handing over the useful
 * interpretation.
 */
export function ReportsView({
  overview,
  quota,
  firstName,
  candidate
}: {
  overview: ReportsOverview;
  quota: { used: number; limit: number };
  firstName: string;
  /** Named on the downloadable report's cover page. */
  candidate: ReportCandidate;
}) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const hasReport = overview.scoredRounds > 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[95rem] flex-col px-5 pb-12 pt-4 text-cream sm:px-8 lg:px-10 lg:pt-6">
      <DocumentTitle title="Reports" />
      {/*
        Phase 1 note:
        Reports is being rebuilt as a premium briefing experience, not a
        dashboard. For now the "report ready" path still uses the current
        overview data with a designed briefing layer; the empty path is real
        and appears whenever there are no scored rounds yet.
      */}
      {!hasReport ? (
        <ReportShell>
          <ReportEmptyStage firstName={firstName} exhausted={remaining === 0} />
        </ReportShell>
      ) : (
        <ReportBriefing overview={overview} candidate={candidate} />
      )}
    </div>
  );
}

function ReportShell({ children }: { children: ReactNode }) {
  return (
    <section className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col items-center justify-center overflow-hidden py-6 text-center text-cream">
      <ReportBackdrop />
      {children}
    </section>
  );
}

function ReportBriefing({
  overview,
  candidate
}: {
  overview: ReportsOverview;
  candidate: ReportCandidate;
}) {
  return (
    <ReportShell>
      <ReportBriefingStage overview={overview} candidate={candidate} />
    </ReportShell>
  );
}

function ReportBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden overflow-hidden text-cream sm:block"
    >
      <svg
        className="absolute left-8 top-20 h-36 w-56 opacity-[0.085]"
        viewBox="0 0 230 150"
        fill="none"
      >
        <rect x="18" y="24" width="160" height="68" rx="14" stroke="currentColor" />
        <circle cx="42" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <path d="M61 45h78M61 64h104" stroke="currentColor" strokeLinecap="round" />
        <path d="M28 116h178" stroke="currentColor" strokeLinecap="round" strokeDasharray="7 12" />
      </svg>
      <svg
        className="absolute left-14 top-72 h-44 w-64 opacity-[0.07]"
        viewBox="0 0 260 180"
        fill="none"
      >
        <rect x="22" y="22" width="176" height="62" rx="15" stroke="currentColor" />
        <rect x="58" y="106" width="172" height="52" rx="13" stroke="currentColor" />
        <circle cx="48" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <circle cx="84" cy="130" r="5" fill="#9be8c1" fillOpacity="0.46" />
        <path d="M68 45h88M68 61h112M104 128h78M104 143h52" stroke="currentColor" />
        <path d="M198 53h28v78H230" stroke="currentColor" strokeDasharray="5 9" />
      </svg>
      <svg
        className="absolute left-[5%] top-[31rem] h-28 w-72 opacity-[0.055]"
        viewBox="0 0 300 120"
        fill="none"
      >
        <path d="M18 86h50m178 0h36" stroke="currentColor" strokeLinecap="round" />
        {Array.from({ length: 14 }, (_, item) => (
          <line
            key={item}
            x1={84 + item * 10}
            x2={84 + item * 10}
            y1={86 - ((item % 6) + 2) * 5}
            y2={86 + ((item % 6) + 2) * 5}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
        ))}
        <path d="M72 24h150M72 42h96M72 60h122" stroke="currentColor" strokeOpacity="0.72" />
        <rect x="50" y="8" width="190" height="64" rx="14" stroke="currentColor" />
      </svg>
      <svg
        className="absolute right-8 top-[7.5rem] h-40 w-64 opacity-[0.09]"
        viewBox="0 0 280 180"
        fill="none"
      >
        <path d="M18 92h24m196 0h24" stroke="currentColor" />
        {Array.from({ length: 12 }, (_, item) => (
          <line
            key={item}
            x1={52 + item * 15}
            x2={52 + item * 15}
            y1={92 - ((item % 5) + 2) * 7}
            y2={92 + ((item % 5) + 2) * 7}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
        ))}
        <circle cx="140" cy="92" r="74" stroke="currentColor" />
      </svg>
      <svg
        className="absolute right-14 top-80 h-48 w-72 opacity-[0.07]"
        viewBox="0 0 300 200"
        fill="none"
      >
        <rect x="56" y="18" width="176" height="58" rx="14" stroke="currentColor" />
        <rect x="32" y="112" width="142" height="54" rx="14" stroke="currentColor" />
        <circle cx="82" cy="47" r="5" fill="#9be8c1" fillOpacity="0.5" />
        <circle cx="58" cy="138" r="5" fill="currentColor" fillOpacity="0.4" />
        <path d="M104 44h76M104 58h96M80 136h68M80 151h42" stroke="currentColor" />
        <path d="M146 76v36M146 94h92" stroke="currentColor" strokeDasharray="5 9" />
        <path d="M236 94l12-10M236 94l12 10" stroke="currentColor" strokeLinecap="round" />
      </svg>
      <svg
        className="absolute right-[5%] top-[32rem] h-36 w-72 opacity-[0.055]"
        viewBox="0 0 300 150"
        fill="none"
      >
        <path d="M72 32h156M72 52h104M72 72h132" stroke="currentColor" />
        <rect x="48" y="14" width="204" height="78" rx="16" stroke="currentColor" />
        <path
          d="M34 124 C 74 88, 108 88, 148 116 S 218 146, 266 92"
          stroke="#9be8c1"
          strokeOpacity="0.55"
          strokeDasharray="5 9"
        />
        <circle cx="148" cy="116" r="6" fill="currentColor" fillOpacity="0.35" />
        <circle cx="218" cy="122" r="6" fill="currentColor" fillOpacity="0.26" />
      </svg>
      <svg
        className="absolute left-[13%] top-[41rem] h-24 w-44 opacity-[0.055]"
        viewBox="0 0 180 120"
        fill="none"
      >
        {Array.from({ length: 18 }, (_, item) => (
          <circle
            key={item}
            cx={24 + (item % 6) * 24}
            cy={26 + Math.floor(item / 6) * 28}
            r="3"
            fill="currentColor"
            fillOpacity={item % 4 === 0 ? "0.48" : "0.24"}
          />
        ))}
        <path d="M28 96h124" stroke="currentColor" strokeDasharray="6 10" />
      </svg>
      <svg
        className="absolute right-[15%] top-[42rem] h-24 w-52 opacity-[0.055]"
        viewBox="0 0 210 110"
        fill="none"
      >
        <path d="M28 34h154M28 56h112M28 78h132" stroke="currentColor" />
        <path d="M16 20h178v76H16z" stroke="currentColor" />
        <path d="M54 20v76M118 20v76" stroke="currentColor" strokeOpacity="0.55" />
      </svg>
      <svg
        className="absolute bottom-8 right-[10%] h-24 w-44 opacity-[0.075]"
        viewBox="0 0 180 120"
        fill="none"
      >
        <path d="M24 28h132v64H24z" stroke="currentColor" />
        <path d="M56 28v64M100 28v64M24 58h132" stroke="currentColor" strokeOpacity="0.58" />
        <circle cx="42" cy="44" r="5" fill="currentColor" fillOpacity="0.46" />
        <circle cx="80" cy="76" r="5" fill="#9be8c1" fillOpacity="0.52" />
        <circle cx="124" cy="44" r="5" fill="currentColor" fillOpacity="0.34" />
      </svg>
    </div>
  );
}
