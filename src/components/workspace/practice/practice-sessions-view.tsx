import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Atom, BadgeCheck, CircleGauge, CodeXml, Cpu, FileCode2, Rocket } from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { RoadmapSessionCard } from "@/components/workspace/shared/roadmap-session-card";
import type { PracticeRoadmapHome } from "@/lib/practice/practice-roadmap";
import type { CandidateProfile } from "@/lib/shared/types";

const sessionIcons: Record<string, LucideIcon> = {
  "frontend-dsa": CodeXml,
  "resume-behavioral-defense": BadgeCheck,
  "core-technical": Atom,
  "applied-engineering": Cpu,
  "architecture-system-design": CircleGauge,
  "final-mock": Rocket
};

export function PracticeSessionsView({
  profile,
  practiceRoadmap,
  generationFailed = false
}: {
  profile: CandidateProfile;
  practiceRoadmap: PracticeRoadmapHome | null;
  generationFailed?: boolean;
}) {
  const firstName = profile.resume?.fullName?.trim().split(/\s+/)[0] ?? "";
  const introCopy = firstName
    ? `${firstName}, choose the practice session that feels most useful right now. Each session follows the same preparation path as your interviews, so what you learn here carries directly into the room.`
    : "Choose the practice session that feels most useful right now. Each session follows the same preparation path as your interviews, so what you learn here carries directly into the room.";
  const introWords = introCopy.split(" ");
  const sessions = practiceRoadmap?.sessions ?? [];

  return (
    <main className="relative isolate mx-auto w-full max-w-[92rem] overflow-x-clip px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
      <DocumentTitle title="Practice" />
      <span
        aria-hidden="true"
        className="interviews-accent-glow interviews-accent-glow-top pointer-events-none absolute -top-32 left-1/2 -z-10 h-[34rem] w-[48rem] -translate-x-1/2 rounded-full"
      />

      <section className="interviews-intro-in mx-auto max-w-3xl text-center">
        <p
          aria-label={introCopy}
          className="font-display text-[clamp(1.1rem,1.25vw,1.4rem)] font-medium leading-[1.55] tracking-normal text-cream"
        >
          {introWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              aria-hidden="true"
              className="interviews-intro-word"
              style={{ "--interview-word-delay": `${index * 22}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </p>
      </section>

      <section className="relative isolate mt-12 sm:mt-14" aria-label="Practice sessions">
        {sessions.length === 0 ? (
          <div
            className="mx-auto max-w-xl rounded-[1.5rem] border border-white/10 bg-graphite-900/65 px-6 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.22)]"
            role={generationFailed ? "alert" : "status"}
          >
            <p className="font-display text-lg font-semibold text-cream">
              {generationFailed
                ? "We couldn't prepare your Practice roadmap"
                : "Your Practice roadmap is being prepared"}
            </p>
            <p className="mt-2 text-sm leading-6 text-cream/60">
              {generationFailed
                ? "Your saved progress is safe. Refresh to try generating the roadmap again."
                : "Refresh this page in a moment."}
            </p>
          </div>
        ) : null}
        <div className="relative z-10 grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session, index) => {
            const completed = session.completedQuestions;
            const total = session.totalQuestions;
            const available = session.availability === "available" && Boolean(session.href);
            const progressLabel = available
              ? completed > 0
                ? `${completed}/${total} complete`
                : `${total} questions`
              : session.availability === "available"
                ? `${total} questions · workspace coming next`
                : "Question bank coming next";

            return (
              <RoadmapSessionCard
                key={session.key}
                href={available ? session.href : null}
                icon={sessionIcons[session.key] ?? FileCode2}
                title={session.title}
                purpose={session.purpose}
                covers={session.covers}
                statusLabel={progressLabel}
                actionLabel={
                  available ? (completed > 0 ? "Continue session" : "Start session") : "Coming soon"
                }
                disabled={!available}
                delay={index * 70}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
