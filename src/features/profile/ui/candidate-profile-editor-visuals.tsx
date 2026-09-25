import { Quote, Target } from "lucide-react";
import type { CandidateStory } from "@/lib/shared/types";

export function ProfileHeroSidePatterns() {
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
        className="absolute right-8 top-[52rem] h-36 w-64 opacity-[0.055]"
        viewBox="0 0 270 150"
        fill="none"
      >
        <rect x="42" y="18" width="176" height="58" rx="14" stroke="currentColor" />
        <path d="M68 44h96M68 58h124" stroke="currentColor" />
        <path
          d="M30 120 C 70 82, 110 86, 146 110 S 214 144, 246 78"
          stroke="#9be8c1"
          strokeOpacity="0.48"
          strokeDasharray="5 9"
        />
        <circle cx="146" cy="110" r="6" fill="currentColor" fillOpacity="0.32" />
        <circle cx="214" cy="116" r="6" fill="currentColor" fillOpacity="0.24" />
      </svg>
      <svg
        className="absolute right-[6%] top-[66rem] h-40 w-64 opacity-[0.052]"
        viewBox="0 0 270 170"
        fill="none"
      >
        <path d="M30 76h38m166 0h22" stroke="currentColor" />
        <circle cx="136" cy="76" r="56" stroke="currentColor" />
        <circle cx="136" cy="76" r="30" stroke="currentColor" strokeOpacity="0.58" />
        <circle cx="136" cy="76" r="8" fill="currentColor" fillOpacity="0.38" />
        <path d="M136 18v28M136 106v28M78 76h28M166 76h28" stroke="currentColor" />
      </svg>
      <svg
        className="absolute right-[13%] top-[80rem] h-32 w-56 opacity-[0.05]"
        viewBox="0 0 230 140"
        fill="none"
      >
        <path d="M28 34h160M28 54h122M28 74h142" stroke="currentColor" />
        <rect x="16" y="16" width="194" height="80" rx="15" stroke="currentColor" />
        <path d="M60 116h98" stroke="currentColor" strokeDasharray="6 10" />
        <circle cx="174" cy="116" r="6" fill="#9be8c1" fillOpacity="0.4" />
      </svg>
      <svg
        className="absolute right-[4%] top-[96rem] h-36 w-80 opacity-[0.05]"
        viewBox="0 0 330 150"
        fill="none"
      >
        <path d="M24 76h52m178 0h54" stroke="currentColor" strokeLinecap="round" />
        {Array.from({ length: 16 }, (_, item) => (
          <line
            key={item}
            x1={92 + item * 10}
            x2={92 + item * 10}
            y1={76 - ((item % 6) + 2) * 5}
            y2={76 + ((item % 6) + 2) * 5}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        ))}
        <path d="M72 28h140M72 46h98" stroke="currentColor" strokeOpacity="0.62" />
        <rect x="54" y="12" width="180" height="60" rx="14" stroke="currentColor" />
      </svg>
      <svg
        className="absolute right-[16%] top-[114rem] h-40 w-64 opacity-[0.047]"
        viewBox="0 0 270 170"
        fill="none"
      >
        <path d="M32 84h34m162 0h24" stroke="currentColor" />
        <circle cx="136" cy="84" r="58" stroke="currentColor" />
        <circle cx="136" cy="84" r="34" stroke="currentColor" strokeOpacity="0.54" />
        <circle cx="136" cy="84" r="10" fill="currentColor" fillOpacity="0.32" />
        <path d="M136 20v30M136 118v30M72 84h30M170 84h30" stroke="currentColor" />
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

export function SignatureStoryCard({ story }: { story?: CandidateStory }) {
  if (!story?.title) return null;

  return (
    <section className="profile-glass profile-motion relative z-10 mt-6 rounded-2xl px-6 py-6 sm:px-8 sm:py-7">
      <div className="flex items-start gap-4 sm:gap-5">
        <Quote size={24} strokeWidth={1.5} className="mt-0.5 shrink-0 text-cream/48" aria-hidden />
        <div className="min-w-0">
          <p className="max-w-5xl text-base leading-7 text-cream/82 sm:text-[17px] sm:leading-8">
            {story.outcome || story.situation}
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/42">
            {story.title}
          </p>
        </div>
      </div>
    </section>
  );
}

export function HeroChip({
  icon: Icon,
  label,
  muted = false,
  tone
}: {
  icon: typeof Target;
  label: string;
  muted?: boolean;
  tone?: "mint";
}) {
  return (
    <span
      className={[
        "pill inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium",
        tone === "mint"
          ? "!bg-[#71d6a5]/16 text-[#b5efd2]"
          : muted
            ? "text-cream/40"
            : "text-cream/78"
      ].join(" ")}
    >
      <Icon size={13} className="shrink-0 opacity-70" />
      {label}
    </span>
  );
}
