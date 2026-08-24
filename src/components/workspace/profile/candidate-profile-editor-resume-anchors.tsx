import { type CSSProperties } from "react";
import { Blocks, BriefcaseBusiness, GraduationCap, Sparkles } from "lucide-react";
import type { CandidateProfile } from "@/lib/shared/types";

type ProfileResumeAnchor = {
  id: string;
  badge: string;
  title: string;
  meta?: string;
  body?: string;
  bullets?: string[];
  tags?: string[];
  icon: typeof BriefcaseBusiness;
};

export function ProfileResumeAnchors({ resume }: { resume: CandidateProfile["resume"] }) {
  if (!resume) return null;

  const workCount = resume.experience.length;
  const projectCount = resume.projects.length;
  const educationCount = resume.education.length;

  const workCards: ProfileResumeAnchor[] = resume.experience.map((entry, index) => ({
    id: `work-${index}`,
    badge: cleanText(entry.period) || "Experience",
    icon: BriefcaseBusiness,
    title: cleanText(entry.role) || cleanText(entry.organization) || "Work experience",
    meta: joinResumeMeta([entry.organization, entry.period, entry.location]),
    body: cleanText(entry.summary),
    bullets: entry.achievements.map(cleanText).filter(Boolean).slice(0, 3),
    tags: entry.skills.map(cleanText).filter(Boolean).slice(0, 5)
  }));
  const projectCards: ProfileResumeAnchor[] = resume.projects.map((entry, index) => ({
    id: `project-${index}`,
    badge: cleanText(entry.skills[0]) || "Project proof",
    icon: Blocks,
    title: cleanText(entry.name) || "Project",
    meta: cleanText(entry.outcome),
    body: cleanText(entry.summary),
    tags: entry.skills.map(cleanText).filter(Boolean).slice(0, 5)
  }));
  const educationCards: ProfileResumeAnchor[] = resume.education.map((entry, index) => ({
    id: `education-${index}`,
    badge: getEducationBadge(entry.credential),
    icon: GraduationCap,
    title: cleanText(entry.credential) || cleanText(entry.field) || "Education",
    meta: joinResumeMeta([entry.institution, entry.period]),
    body: cleanText(entry.field)
  }));
  const proofCards: ProfileResumeAnchor[] = resume.achievements.length
    ? [
        {
          id: "achievements",
          badge: "Evidence",
          icon: Sparkles,
          title: "Resume highlights",
          body: "Evidence Maya can turn into follow-up questions.",
          bullets: resume.achievements.map(cleanText).filter(Boolean).slice(0, 5)
        }
      ]
    : [];
  const totalCards = [...workCards, ...projectCards, ...educationCards, ...proofCards];

  if (!totalCards.length) return null;

  const summaryCards = [
    {
      label: "Work",
      count: `${workCount} ${workCount === 1 ? "role" : "roles"}`,
      icon: BriefcaseBusiness
    },
    {
      label: "Projects",
      count: `${projectCount} ${projectCount === 1 ? "project" : "projects"}`,
      icon: Blocks
    },
    {
      label: "Education",
      count: `${educationCount} ${educationCount === 1 ? "entry" : "entries"}`,
      icon: GraduationCap
    },
    {
      label: "Proof",
      count: `${resume.achievements.length} ${resume.achievements.length === 1 ? "highlight" : "highlights"}`,
      icon: Sparkles
    }
  ];

  return (
    <section
      className="profile-soft-reveal mt-14 w-full max-w-6xl text-left"
      style={{ "--profile-reveal-delay": "2580ms" } as CSSProperties}
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/38">
          Interview evidence
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-cream">Resume anchors</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/58 sm:text-[15px]">
          Maya found the parts of your resume that can become interview questions.
        </p>
      </div>

      <div className="mx-auto mt-6 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card, index) => (
          <ResumeSummaryTile
            key={card.label}
            label={card.label}
            count={card.count}
            icon={card.icon}
            index={index}
          />
        ))}
      </div>

      <div className="mt-8 space-y-8">
        <ResumeWorkTimeline cards={workCards} />
        <div className="grid gap-5 lg:grid-cols-3">
          <ResumeAnchorGroup title="Projects" cards={projectCards} />
          <ResumeAnchorGroup title="Education" cards={educationCards} />
          <ResumeAnchorGroup title="Proof" cards={proofCards} />
        </div>
      </div>
    </section>
  );
}

function ResumeSummaryTile({
  label,
  count,
  icon: Icon,
  index
}: {
  label: string;
  count: string;
  icon: typeof BriefcaseBusiness;
  index: number;
}) {
  return (
    <article
      className="profile-glass profile-soft-reveal flex items-center gap-3 rounded-xl px-4 py-4 text-left"
      style={{ "--profile-reveal-delay": `${2700 + index * 70}ms` } as CSSProperties}
    >
      <Icon size={23} strokeWidth={1.55} className="shrink-0 text-[var(--workspace-accent)]" />
      <div className="min-w-0">
        <h3 className="text-sm font-medium leading-none text-cream sm:text-base">{label}</h3>
        <p className="mt-2 text-xs text-cream/48 sm:text-[13px]">{count}</p>
      </div>
    </article>
  );
}

function ResumeAnchorGroup({ title, cards }: { title: string; cards: ProfileResumeAnchor[] }) {
  if (!cards.length) return null;
  const groupDelay = 2860 + ["Work", "Projects", "Education", "Proof"].indexOf(title) * 130;

  return (
    <section
      className="profile-soft-reveal relative"
      style={{ "--profile-reveal-delay": `${groupDelay}ms` } as CSSProperties}
    >
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/42">
        {title}
      </h3>

      <div className="grid gap-3">
        {cards.map((card, index) => (
          <ProfileResumeAnchorCard
            key={card.id}
            card={card}
            index={index}
            groupDelay={groupDelay}
          />
        ))}
      </div>
    </section>
  );
}

function ResumeWorkTimeline({ cards }: { cards: ProfileResumeAnchor[] }) {
  if (!cards.length) return null;
  return (
    <section
      className="profile-soft-reveal"
      style={{ "--profile-reveal-delay": "2860ms" } as CSSProperties}
    >
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/42">
        Work experience
      </h3>
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map((card, index) => (
          <ProfileResumeAnchorCard key={card.id} card={card} index={index} groupDelay={2860} />
        ))}
      </div>
    </section>
  );
}

function ProfileResumeAnchorCard({
  card,
  index,
  groupDelay
}: {
  card: ProfileResumeAnchor;
  index: number;
  groupDelay: number;
}) {
  const Icon = card.icon;

  return (
    <article
      className="profile-glass profile-soft-reveal relative flex flex-col overflow-hidden rounded-2xl p-5 text-left transition-colors hover:bg-white/[0.035]"
      style={
        {
          "--profile-reveal-delay": `${groupDelay + 90 + Math.min(index, 4) * 65}ms`
        } as CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-4">
        <Icon size={25} strokeWidth={1.6} className="shrink-0 text-[var(--workspace-accent)]" />
        <span className="rounded-full border border-white/[0.1] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-cream/52">
          {card.badge}
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-medium leading-tight text-cream sm:text-xl">{card.title}</h3>
        {card.meta ? (
          <p className="mt-2.5 text-sm font-medium leading-6 text-cream/68">{card.meta}</p>
        ) : null}
      </div>

      {card.body ? (
        <p className="mt-4 text-sm leading-6 text-cream/62 sm:text-[15px]">{card.body}</p>
      ) : null}

      {card.bullets?.length ? (
        <ul className="mt-4 space-y-2.5 text-sm leading-6 text-cream/58">
          {card.bullets.map((bullet) => (
            <li key={bullet} className="grid grid-cols-[0.375rem_minmax(0,1fr)] gap-2.5">
              <span className="mt-[0.68em] h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)] opacity-80" />
              <span className="min-w-0">{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {card.tags?.length ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-medium text-cream/58"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function cleanText(value?: string | null) {
  return value?.trim() ?? "";
}

function joinResumeMeta(parts: Array<string | null | undefined>) {
  return parts.map(cleanText).filter(Boolean).join(" · ");
}

function getEducationBadge(credential?: string | null) {
  const value = cleanText(credential);
  if (!value) return "Credential";

  const parenthesized = value.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (parenthesized && parenthesized.length <= 12) return parenthesized;

  const classMatch = value.match(/class\s*\d+/i)?.[0];
  if (classMatch) return classMatch;

  const firstWord = value.split(/\s+/)[0];
  return firstWord || "Credential";
}

export function SectionUiTexture({ variant = 0 }: { variant?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-cream opacity-80"
    >
      <svg
        className={[
          "absolute h-24 w-44 opacity-[0.06]",
          variant % 3 === 0
            ? "-left-8 top-4"
            : variant % 3 === 1
              ? "right-5 top-4"
              : "left-1/2 top-2 -translate-x-1/2"
        ].join(" ")}
        viewBox="0 0 180 120"
        fill="none"
      >
        <rect x="18" y="18" width="132" height="52" rx="13" stroke="currentColor" />
        <circle cx="40" cy="42" r="4" fill="currentColor" fillOpacity="0.38" />
        <path d="M58 40h72M58 54h88" stroke="currentColor" strokeLinecap="round" />
        <path d="M36 94h112" stroke="currentColor" strokeDasharray="6 10" />
      </svg>

      <svg
        className={[
          "absolute h-24 w-56 opacity-[0.055]",
          variant % 3 === 0
            ? "right-2 bottom-2"
            : variant % 3 === 1
              ? "-left-8 bottom-1"
              : "right-8 bottom-3"
        ].join(" ")}
        viewBox="0 0 240 100"
        fill="none"
      >
        <path d="M12 58h40m148 0h28" stroke="currentColor" strokeLinecap="round" />
        {Array.from({ length: 12 }, (_, item) => (
          <line
            key={item}
            x1={66 + item * 10}
            x2={66 + item * 10}
            y1={58 - ((item % 5) + 2) * 4}
            y2={58 + ((item % 5) + 2) * 4}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        ))}
      </svg>

      <svg
        className={[
          "absolute h-24 w-40 opacity-[0.05]",
          variant % 2 === 0 ? "right-8 top-1/2 -translate-y-1/2" : "left-8 top-1/2 -translate-y-1/2"
        ].join(" ")}
        viewBox="0 0 160 110"
        fill="none"
      >
        <path d="M22 30h116M22 52h84M22 74h102" stroke="currentColor" />
        <rect x="12" y="14" width="136" height="78" rx="14" stroke="currentColor" />
      </svg>

      <svg
        className={[
          "absolute h-20 w-32 opacity-[0.05]",
          variant % 2 === 0 ? "left-6 bottom-5" : "right-10 bottom-7"
        ].join(" ")}
        viewBox="0 0 130 90"
        fill="none"
      >
        <path d="M18 18h92v54H18z" stroke="currentColor" />
        <path d="M48 18v54M80 18v54M18 45h92" stroke="currentColor" strokeOpacity="0.56" />
        <circle cx="32" cy="32" r="4" fill="currentColor" fillOpacity="0.36" />
        <circle cx="64" cy="60" r="4" fill="#9be8c1" fillOpacity="0.42" />
        <circle cx="96" cy="32" r="4" fill="currentColor" fillOpacity="0.3" />
      </svg>

      <svg
        className={[
          "absolute h-20 w-52 opacity-[0.045]",
          variant % 3 === 0
            ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            : variant % 3 === 1
              ? "right-1/4 top-12"
              : "left-1/4 bottom-10"
        ].join(" ")}
        viewBox="0 0 220 90"
        fill="none"
      >
        <path
          d="M14 56 C 46 22, 78 26, 108 50 S 168 84, 206 30"
          stroke="#9be8c1"
          strokeOpacity="0.48"
          strokeDasharray="5 9"
        />
        <circle cx="108" cy="50" r="5" fill="currentColor" fillOpacity="0.28" />
        <circle cx="168" cy="56" r="5" fill="currentColor" fillOpacity="0.22" />
      </svg>

      <svg
        className={[
          "absolute h-16 w-48 opacity-[0.04]",
          variant % 2 === 0 ? "right-2 top-1/3" : "left-2 top-1/3"
        ].join(" ")}
        viewBox="0 0 190 70"
        fill="none"
      >
        {Array.from({ length: 24 }, (_, item) => (
          <circle
            key={item}
            cx={16 + (item % 8) * 20}
            cy={14 + Math.floor(item / 8) * 18}
            r="2.4"
            fill="currentColor"
            fillOpacity={item % 5 === 0 ? "0.42" : "0.2"}
          />
        ))}
      </svg>
    </div>
  );
}
