import {
  ArrowLeft,
  BriefcaseBusiness,
  CircleCheck,
  FileText,
  Quote,
  Sparkles,
  Target
} from "lucide-react";
import { ProfileAvatar } from "@/components/workspace/profile-avatar";
import type { CandidateProfile, CandidateProfileInput, CandidateStory } from "@/lib/types";
import { roleOptions, statTones } from "./candidate-profile-editor-data";
import { SectionUiTexture } from "./candidate-profile-editor-resume-anchors";
import { formatTimestamp } from "./candidate-profile-editor-utils";

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

export function EditMemoryPreview({
  profile,
  saved
}: {
  profile: CandidateProfileInput;
  saved: CandidateProfile;
}) {
  const name = saved.resume?.fullName?.trim() || "Candidate";
  const role = roleOptions.find((option) => option.value === profile.targetRole);
  const Icon = role?.icon ?? Target;
  const items = [
    { label: "Role", ready: Boolean(profile.targetRole), icon: Icon },
    { label: "Context", ready: profile.context.length > 120, icon: FileText },
    { label: "Focus", ready: profile.focusAreas.length >= 3, icon: Sparkles },
    { label: "Stories", ready: profile.stories.length >= 1, icon: BriefcaseBusiness }
  ];

  return (
    <section className="profile-motion surface relative mt-5 overflow-hidden p-5 sm:p-6">
      <CardPattern variant="grid" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div className="flex items-center gap-5">
          <div className="relative h-28 w-36 shrink-0" aria-hidden>
            <span className="absolute left-10 top-1/2 h-1 w-20 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#9be8c1]/65 via-cream/30 to-[#7ea0ff]/70" />
            <ProfileAvatar
              name={name}
              className="absolute left-0 top-3 h-20 w-20 rounded-full shadow-[0_18px_44px_-24px_rgba(5,14,45,0.95)]"
            />
            <span className="absolute right-0 top-5 grid h-20 w-20 place-items-center rounded-[1.6rem] bg-cream text-blueprint shadow-[0_22px_48px_-30px_rgba(239,232,214,0.75)]">
              <Icon size={28} />
            </span>
          </div>

          <div className="min-w-0">
            <p className="blueprint-label text-cream/32">Memory map</p>
            <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-cream">
              Clean inputs, sharper questions.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-cream/45">
              This strip simply shows which parts of your interview profile are ready.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className="rounded-3xl bg-white/[0.045] p-4 shadow-soft-inset">
                <span
                  className={[
                    "grid h-10 w-10 place-items-center rounded-2xl",
                    item.ready ? "bg-[#71d6a5]/18 text-[#b5efd2]" : "bg-white/[0.06] text-cream/35"
                  ].join(" ")}
                >
                  <ItemIcon size={17} />
                </span>
                <p className="mt-4 text-sm font-semibold text-cream">{item.label}</p>
                <p className="mt-1 text-xs text-cream/38">{item.ready ? "Ready" : "Needs input"}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SignatureStoryCard({ story }: { story?: CandidateStory }) {
  if (!story?.title) return null;

  return (
    <section className="relative z-10 mt-6 overflow-hidden rounded-[1.5rem] border border-[#F26E01]/30 bg-[linear-gradient(120deg,rgba(242,110,1,0.13),rgba(24,25,28,0.98)_42%)] p-6 shadow-[0_24px_64px_-38px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-8">
      <CardPattern variant="quote" />
      <SectionUiTexture variant={1} />
      <Quote size={20} className="absolute left-6 top-6 text-cream/42" aria-hidden />
      <div className="relative px-9 sm:px-11">
        <p className="max-w-5xl text-base leading-7 text-cream/84 sm:text-[17px] sm:leading-8">
          {story.outcome || story.situation}
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-cream/58">
          {story.title}
        </p>
      </div>
      <span className="absolute bottom-6 right-6 grid h-10 w-10 place-items-center rounded-full border border-cream/18 bg-cream/[0.035] text-cream/48">
        <Quote size={16} />
      </span>
    </section>
  );
}

type PatternVariant = "dots" | "grid" | "rings" | "waves" | "quote";

/**
 * Low-contrast texture so a card of body copy still reads as a designed
 * surface. Purely decorative, and always behind the content.
 */
export function CardPattern({ variant }: { variant: PatternVariant }) {
  if (variant === "quote") {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[11rem] leading-none text-white/[0.045]"
      >
        &rdquo;
      </span>
    );
  }

  if (variant === "rings") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -bottom-16 -right-14 h-52 w-52 opacity-[0.09]"
      >
        {[40, 62, 84].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#dce6ff" strokeWidth="1" />
        ))}
        <circle cx="100" cy="100" r="18" fill="#dce6ff" opacity="0.35" />
      </svg>
    );
  }

  if (variant === "waves") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 240 120"
        className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-60 opacity-[0.1]"
      >
        {[0, 14, 28].map((offset) => (
          <path
            key={offset}
            d={`M0 ${70 + offset} C 50 ${20 + offset}, 90 ${110 + offset}, 140 ${60 + offset} S 220 ${10 + offset}, 240 ${50 + offset}`}
            fill="none"
            stroke="#dce6ff"
            strokeWidth="1.2"
          />
        ))}
      </svg>
    );
  }

  const size = variant === "grid" ? "26px 26px" : "18px 18px";
  const image =
    variant === "grid"
      ? "linear-gradient(rgba(220,230,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(220,230,255,0.5) 1px, transparent 1px)"
      : "radial-gradient(rgba(220,230,255,0.6) 1px, transparent 1px)";

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 h-40 w-52 opacity-[0.09]"
      style={{
        backgroundImage: image,
        backgroundSize: size,
        maskImage: "radial-gradient(120% 100% at 100% 0%, #000 30%, transparent 72%)",
        WebkitMaskImage: "radial-gradient(120% 100% at 100% 0%, #000 30%, transparent 72%)"
      }}
    />
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

/* ------------------------------------------------------------------- tabs */

export function ResumeHero({
  resume,
  onBack
}: {
  resume: CandidateProfile["resume"];
  onBack: () => void;
}) {
  const confidence = resume?.confidence ?? 0;
  const evidenceCount = resume
    ? resume.experience.length + resume.projects.length + resume.education.length
    : 0;

  return (
    <header className="profile-motion surface-raised relative overflow-hidden p-6 sm:p-8 lg:p-10">
      <CardPattern variant="rings" />
      <div
        aria-hidden
        className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#9be8c1]/12 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="pill inline-flex h-10 items-center gap-2 !rounded-xl px-4 text-xs font-semibold text-cream/72 transition hover:bg-white/[0.12] hover:text-cream"
          >
            <ArrowLeft size={14} /> Back to profile
          </button>
          <p className="blueprint-label mt-8 text-cream/35">Resume evidence</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
            Verified proof Maya can question.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-cream/58">
            Every item here is read-only and grounded in the uploaded resume, so interviews stay
            anchored to real evidence.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:w-auto sm:min-w-[24rem] sm:grid-cols-3">
          <ResumeHeroStat label="Confidence" value={resume ? `${confidence}%` : "0%"} tone="mint" />
          <ResumeHeroStat label="Evidence" value={String(evidenceCount)} tone="sky" />
          <ResumeHeroStat
            label="Pages"
            value={resume ? String(resume.document.pageCount) : "0"}
            tone="amber"
          />
        </div>
      </div>

      {resume ? (
        <div className="relative mt-8 grid gap-3 rounded-3xl bg-white/[0.045] p-4 shadow-soft-inset sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cream text-blueprint">
            <FileText size={23} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-cream">{resume.fileName}</p>
            <p className="mt-1 text-xs text-cream/42">
              Verified {formatTimestamp(resume.uploadedAt)}
            </p>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function ResumeHeroStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: keyof typeof statTones;
}) {
  return (
    <div className="rounded-3xl bg-white/[0.055] p-4 shadow-soft-inset">
      <span className={`mb-5 grid h-9 w-9 place-items-center rounded-2xl ${statTones[tone]}`}>
        <CircleCheck size={15} />
      </span>
      <p className="text-3xl font-semibold tracking-tight text-cream">{value}</p>
      <p className="mt-1 text-xs font-semibold text-cream/40">{label}</p>
    </div>
  );
}
