"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { CandidateResume } from "@/lib/shared/types";
import { INTERVIEW_PANEL_RULE, INTERVIEW_PANEL_SHELL } from "./panel-surface";

/**
 * A reading view of the candidate's own resume, laid out as document sheets.
 *
 * It is rendered from the structured resume that was extracted at onboarding
 * rather than from the uploaded file, so it costs nothing to show and stays
 * legible in the workspace's dark theme. Content is paginated by weight, which
 * gives a one or two page document depending on how much the resume holds.
 */
export function ResumeDocumentPreview({
  resume,
  highlightSkill
}: {
  resume: CandidateResume;
  /** The skill Maya is asking about, lit up in the skills block. */
  highlightSkill?: string | null;
}) {
  const pages = useMemo(() => paginate(resume), [resume]);
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[Math.min(pageIndex, pages.length - 1)] ?? [];
  const normalizedHighlight = highlightSkill?.trim().toLowerCase() ?? "";

  return (
    <section
      className={`${INTERVIEW_PANEL_SHELL} flex min-h-[24rem] min-w-0 flex-col overflow-hidden xl:min-h-0`}
    >
      <header className={`flex shrink-0 items-center justify-between gap-3 border-b ${INTERVIEW_PANEL_RULE} px-4 py-3`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText size={15} aria-hidden="true" className="shrink-0 text-cream/40" />
          <p className="truncate text-sm font-medium text-cream/72">{resume.fileName}</p>
        </div>
        {pages.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              disabled={pageIndex === 0}
              aria-label="Previous page"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-cream/50 transition hover:bg-white/[0.06] hover:text-cream disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <span className="min-w-[3.25rem] text-center text-sm tabular-nums text-cream/48">
              {pageIndex + 1} / {pages.length}
            </span>
            <button
              type="button"
              onClick={() => setPageIndex((current) => Math.min(pages.length - 1, current + 1))}
              disabled={pageIndex === pages.length - 1}
              aria-label="Next page"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-cream/50 transition hover:bg-white/[0.06] hover:text-cream disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto bg-black/[0.22] p-3.5">
        <article className="resume-sheet mx-auto flex min-h-full w-full max-w-[34rem] flex-col gap-6 rounded-xl bg-[#141518] px-6 py-7 shadow-[0_18px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-9">
          {pageIndex === 0 ? (
            <header className="border-b border-white/[0.07] pb-5">
              <h2 className="font-display text-xl font-semibold tracking-tight text-cream">
                {resume.fullName || "Candidate"}
              </h2>
              {resume.skills.length ? (
                <p className="mt-1.5 text-sm leading-6 text-cream/44">
                  {resume.skills.slice(0, 6).join(" · ")}
                </p>
              ) : null}
            </header>
          ) : null}

          {page.map((block) => (
            <SheetBlock key={block.key} block={block} highlight={normalizedHighlight} />
          ))}
        </article>
      </div>
    </section>
  );
}

function SheetBlock({ block, highlight }: { block: SheetSection; highlight: string }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
        {block.title}
      </h3>
      <div className="mt-3 space-y-4">
        {block.kind === "skills" ? (
          <ul className="flex flex-wrap gap-1.5">
            {block.skills.map((skill) => {
              const lit = highlight.length > 0 && skill.toLowerCase() === highlight;
              return (
                <li
                  key={skill}
                  className={`rounded-md px-2 py-1 text-sm transition ${
                    lit
                      ? "bg-[var(--workspace-accent)] font-medium text-[#101113]"
                      : "bg-white/[0.045] text-cream/68"
                  }`}
                >
                  {skill}
                </li>
              );
            })}
          </ul>
        ) : block.kind === "lines" ? (
          <ul className="space-y-2">
            {block.lines.map((line, index) => (
              <li key={`${block.key}-${index}`} className="flex gap-2.5 text-sm leading-6 text-cream/64">
                <span
                  aria-hidden="true"
                  className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--workspace-accent)]"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          block.entries.map((entry, index) => (
            <article key={`${block.key}-${index}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-semibold text-cream/88">{entry.title}</p>
                {entry.period ? (
                  <p className="text-sm tabular-nums text-cream/38">{entry.period}</p>
                ) : null}
              </div>
              {entry.subtitle ? (
                <p className="mt-0.5 text-sm text-cream/50">{entry.subtitle}</p>
              ) : null}
              {entry.summary ? (
                <p className="mt-2 text-sm leading-6 text-cream/62">{entry.summary}</p>
              ) : null}
              {entry.bullets.length ? (
                <ul className="mt-2 space-y-1.5">
                  {entry.bullets.map((bullet, bulletIndex) => (
                    <li
                      key={`${block.key}-${index}-${bulletIndex}`}
                      className="flex gap-2.5 text-sm leading-6 text-cream/62"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-cream/28"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

interface SheetEntry {
  title: string;
  subtitle: string;
  period: string;
  summary: string;
  bullets: string[];
}

type SheetSection =
  | { key: string; title: string; kind: "skills"; skills: string[]; weight: number }
  | { key: string; title: string; kind: "lines"; lines: string[]; weight: number }
  | { key: string; title: string; kind: "entries"; entries: SheetEntry[]; weight: number };

/** Roughly how many lines a section occupies, used only to decide page breaks. */
const PAGE_WEIGHT = 26;

function paginate(resume: CandidateResume): SheetSection[][] {
  const sections = buildSections(resume);
  const pages: SheetSection[][] = [];
  let current: SheetSection[] = [];
  let used = 0;

  for (const section of sections) {
    // A section that would overflow starts the next sheet, unless the current
    // sheet is still empty and the section is simply long on its own.
    if (current.length && used + section.weight > PAGE_WEIGHT) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(section);
    used += section.weight;
  }

  if (current.length) pages.push(current);
  return pages.length ? pages.slice(0, 3) : [[]];
}

function buildSections(resume: CandidateResume): SheetSection[] {
  const sections: SheetSection[] = [];

  if (resume.skills.length) {
    sections.push({
      key: "skills",
      title: "Skills",
      kind: "skills",
      skills: resume.skills,
      weight: 2 + Math.ceil(resume.skills.length / 4)
    });
  }

  if (resume.experience.length) {
    const entries = resume.experience.map((entry) => ({
      title: entry.role || entry.organization,
      subtitle: [entry.organization && entry.role ? entry.organization : "", entry.location]
        .filter(Boolean)
        .join(" · "),
      period: entry.period,
      summary: entry.summary,
      bullets: entry.achievements
    }));
    sections.push({
      key: "experience",
      title: "Experience",
      kind: "entries",
      entries,
      weight: 2 + entries.reduce((total, entry) => total + 3 + entry.bullets.length, 0)
    });
  }

  if (resume.projects.length) {
    const entries = resume.projects.map((project) => ({
      title: project.name,
      subtitle: project.skills.slice(0, 4).join(" · "),
      period: "",
      summary: project.summary,
      bullets: project.outcome ? [project.outcome] : []
    }));
    sections.push({
      key: "projects",
      title: "Projects",
      kind: "entries",
      entries,
      weight: 2 + entries.reduce((total, entry) => total + 3 + entry.bullets.length, 0)
    });
  }

  if (resume.achievements.length) {
    sections.push({
      key: "achievements",
      title: "Achievements",
      kind: "lines",
      lines: resume.achievements,
      weight: 2 + resume.achievements.length
    });
  }

  if (resume.education.length) {
    const entries = resume.education.map((entry) => ({
      title: entry.credential || entry.institution,
      subtitle: [entry.institution && entry.credential ? entry.institution : "", entry.field]
        .filter(Boolean)
        .join(" · "),
      period: entry.period,
      summary: "",
      bullets: []
    }));
    sections.push({
      key: "education",
      title: "Education",
      kind: "entries",
      entries,
      weight: 2 + entries.length * 2
    });
  }

  return sections;
}
