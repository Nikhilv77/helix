import Link from "next/link";
import {
  BadgeCheck,
  Blocks,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  Quote,
  Sparkles,
  TriangleAlert,
  Upload
} from "lucide-react";
import type { CandidateProfile } from "@/lib/types";
import { statTones } from "./candidate-profile-editor-data";
import { CardPattern } from "./candidate-profile-editor-visuals";
import { Card, EmptyState, Tag } from "./candidate-profile-editor-ui";
import { formatTimestamp } from "./candidate-profile-editor-utils";

export function ResumeTab({ resume }: { resume: CandidateProfile["resume"] }) {
  if (!resume) {
    return (
      <Card icon={BadgeCheck} title="No verified resume yet">
        <EmptyState
          icon={Upload}
          title="Nothing to show"
          body="Upload a resume and Trailgrad will extract the evidence it can trace back to the document."
          action={
            <Link
              href="/onboarding?replace=resume"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-cream px-4 text-xs font-semibold text-blueprint transition hover:bg-white"
            >
              <Upload size={14} /> Upload resume
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(24rem,0.8fr)] xl:items-start">
      <div className="grid gap-5">
        <Card
          icon={BriefcaseBusiness}
          title="Experience timeline"
          subtitle="Every entry was traced back to a line in your file."
          tone="mint"
          size="large"
        >
          {resume.experience.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="Project-led profile"
              body="No professional role was verified, so Trailgrad anchors rounds to your projects."
            />
          ) : (
            <ol className="grid gap-4">
              {resume.experience.map((entry, index) => (
                <li
                  key={`${entry.organization}-${entry.role}-${index}`}
                  className="relative overflow-hidden rounded-3xl bg-white/[0.04] p-5 shadow-soft-inset sm:p-6"
                >
                  <CardPattern variant="dots" />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-4">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#71d6a5]/16 font-mono text-sm font-semibold text-[#b5efd2] shadow-soft-inset">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold tracking-tight text-cream">
                          {entry.role || "Role not listed"}
                        </h3>
                        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-cream/42">
                          {entry.organization}
                        </p>
                      </div>
                    </div>
                    {entry.period ? (
                      <span className="pill px-3 py-1.5 font-mono text-[12px] text-cream/60">
                        {entry.period}
                      </span>
                    ) : null}
                  </div>
                  {entry.summary ? (
                    <p className="relative mt-5 max-w-3xl text-sm leading-7 text-cream/58">
                      {entry.summary}
                    </p>
                  ) : null}
                  {entry.achievements.length ? (
                    <ul className="relative mt-5 grid gap-2.5">
                      {entry.achievements.map((achievement) => (
                        <li
                          key={achievement}
                          className="flex gap-3 rounded-2xl bg-white/[0.035] px-4 py-3 text-sm leading-6 text-cream/66 shadow-soft-inset"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9be8c1]/70" />
                          {achievement}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.skills.length ? (
                    <div className="relative mt-5 flex flex-wrap gap-2">
                      {entry.skills.slice(0, 8).map((skill) => (
                        <Tag key={skill}>{skill}</Tag>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          icon={Sparkles}
          tone="sky"
          title="Supported skills"
          subtitle={`${resume.skills.length} found`}
          size="large"
        >
          <div className="flex flex-wrap gap-2.5">
            {resume.skills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
            {resume.skills.length === 0 ? (
              <p className="text-xs text-cream/38">None extracted.</p>
            ) : null}
          </div>
        </Card>

        {resume.projects.length ? (
          <Card icon={Blocks} title="Named projects" size="large">
            <div className="grid gap-3 sm:grid-cols-2">
              {resume.projects.map((project) => (
                <div
                  key={project.name}
                  className="rounded-3xl bg-white/[0.04] p-5 shadow-soft-inset"
                >
                  <p className="text-lg font-semibold text-cream">{project.name}</p>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-cream/50">
                    {project.outcome || project.summary}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {resume.achievements.length ? (
          <Card icon={Quote} title="Quoted from your resume" size="large">
            <ul className="grid gap-3">
              {resume.achievements.map((achievement) => (
                <li
                  key={achievement}
                  className="rounded-3xl bg-white/[0.04] px-5 py-4 text-base leading-7 text-cream/66 shadow-soft-inset"
                >
                  {achievement}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-5">
        <DocumentSummaryCard resume={resume} />

        {resume.education.length ? (
          <Card icon={GraduationCap} tone="mint" title="Education" size="large">
            <div className="grid gap-3">
              {resume.education.map((entry) => (
                <div
                  key={`${entry.institution}-${entry.credential}`}
                  className="rounded-3xl bg-white/[0.04] p-5 shadow-soft-inset"
                >
                  <p className="text-lg font-semibold text-cream">
                    {entry.credential || entry.field || "Programme"}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.08em] text-cream/42">
                    {entry.institution}
                  </p>
                  {entry.period ? (
                    <p className="mt-3 font-mono text-[12px] text-cream/48">{entry.period}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {resume.warnings.length ? (
          <div className="surface overflow-hidden p-6">
            <CardPattern variant="waves" />
            <p className="relative flex items-center gap-3 text-lg font-semibold text-[#f4dda6]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efcf84]/15 text-[#f4dda6]">
                <TriangleAlert size={18} />
              </span>
              Trailgrad will challenge these
            </p>
            <ul className="relative mt-5 grid gap-3">
              {resume.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex gap-3 rounded-2xl bg-[#efcf84]/[0.055] px-4 py-3 text-sm leading-6 text-cream/58 shadow-soft-inset"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#efcf84]" />
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DocumentSummaryCard({ resume }: { resume: NonNullable<CandidateProfile["resume"]> }) {
  const stats = [
    { label: "Experience", value: resume.experience.length, icon: BriefcaseBusiness, tone: "mint" },
    { label: "Projects", value: resume.projects.length, icon: Blocks, tone: "sky" },
    { label: "Education", value: resume.education.length, icon: GraduationCap, tone: "amber" }
  ] as const;

  return (
    <Card icon={FileText} title="Document" size="large">
      <div className="relative overflow-hidden rounded-3xl bg-white/[0.045] p-5 shadow-soft-inset">
        <CardPattern variant="grid" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-cream text-blueprint">
            <FileText size={25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold tracking-tight text-cream">
              {resume.fileName}
            </p>
            <p className="mt-1.5 text-sm text-cream/45">
              Verified {formatTimestamp(resume.uploadedAt)}
            </p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <ResumeMetric label="Confidence" value={`${resume.confidence}%`} />
          <ResumeMetric
            label={resume.document.pageCountEstimated ? "Pages est." : "Pages"}
            value={String(resume.document.pageCount)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-3xl bg-white/[0.04] p-4 shadow-soft-inset">
            <span
              className={`grid h-10 w-10 place-items-center rounded-2xl ${statTones[stat.tone]}`}
            >
              <stat.icon size={17} />
            </span>
            <p className="mt-4 text-2xl font-semibold text-cream">{stat.value}</p>
            <p className="mt-1 text-xs font-semibold text-cream/40">{stat.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ResumeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4 shadow-soft-inset">
      <p className="text-2xl font-semibold text-cream">{value}</p>
      <p className="mt-1 text-xs text-cream/38">{label}</p>
    </div>
  );
}

