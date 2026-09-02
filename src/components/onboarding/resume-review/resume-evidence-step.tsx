"use client";

import { ArrowRight, Blocks, BriefcaseBusiness, GraduationCap } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../flow/onboarding-data";
import { BackButton } from "../shared/onboarding-ui";
import type { ResumeExtractionResponse } from "@/lib/shared/types";
import { AUTO_SCROLL_IDLE_MS } from "./shared";

export function ResumeEvidenceStep({
  result,
  teacherName,
  onBack,
  onReplace,
  onContinue
}: {
  result: ResumeExtractionResponse;
  teacherName: string;
  onBack: () => void;
  onReplace: () => void;
  onContinue: () => void;
}) {
  const { extraction } = result;
  const firstRole = extraction.experience[0];
  const firstProject = extraction.projects[0];
  const firstEducation = extraction.education[0];
  const detailCards = [
    {
      label: "Work",
      count: `${extraction.experience.length} ${
        extraction.experience.length === 1 ? "role" : "roles"
      }`,
      title: firstRole?.role || "Work timeline",
      detail: firstRole?.organization
        ? `${firstRole.organization}${firstRole.period ? ` · ${firstRole.period}` : ""}`
        : `No role listed yet. ${teacherName} will lean more on projects.`,
      note: firstRole?.summary || "Roles and responsibilities pulled from the resume.",
      icon: BriefcaseBusiness
    },
    {
      label: "Projects",
      count: `${extraction.projects.length} ${
        extraction.projects.length === 1 ? "project" : "projects"
      }`,
      title: firstProject?.name || "Project details",
      detail: firstProject
        ? `Practical work ${teacherName} can ask about.`
        : "No named projects found.",
      note:
        firstProject?.outcome ||
        firstProject?.summary ||
        "Project work gives the round concrete systems and decisions to explore.",
      icon: Blocks
    },
    {
      label: "Education",
      count: `${extraction.education.length} ${
        extraction.education.length === 1 ? "entry" : "entries"
      }`,
      title: firstEducation?.credential || "Education",
      detail: firstEducation?.institution || "No education entry found.",
      note: firstEducation?.period
        ? `Timeline noted: ${firstEducation.period}.`
        : "Schools, programs, and credentials from your resume.",
      icon: GraduationCap
    }
  ];

  useEffect(() => {
    let cancelled = false;
    function cancelScroll() {
      cancelled = true;
    }

    window.addEventListener("wheel", cancelScroll, { passive: true });
    window.addEventListener("touchstart", cancelScroll, { passive: true });
    window.addEventListener("keydown", cancelScroll);

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const root = document.scrollingElement ?? document.documentElement;
      window.scrollTo({ top: root.scrollHeight - root.clientHeight, behavior: "smooth" });
    }, AUTO_SCROLL_IDLE_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("wheel", cancelScroll);
      window.removeEventListener("touchstart", cancelScroll);
      window.removeEventListener("keydown", cancelScroll);
    };
  }, []);

  return (
    <div className="relative w-full">
      <div className="absolute left-0 top-0 z-10">
        <BackButton onClick={onBack} />
      </div>

      <section className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-6xl flex-col items-center justify-center pb-10 pt-16 text-center sm:mt-8 sm:min-h-[34rem] sm:py-0">
        <div className="identity-stage-in w-full">
          <p className="blueprint-label text-cream/45">{teacherName} found your anchors</p>
          <h1
            className="identity-text-shine display-heading mx-auto mt-5 max-w-4xl text-cream"
            style={{ fontSize: "clamp(2.35rem, 4.7vw, 4.35rem)" }}
          >
            Three resume anchors.
          </h1>
        </div>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
          {detailCards.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="onboarding-card-reveal group flex min-h-[17.5rem] flex-col rounded-[1.35rem] bg-cream/[0.035] p-5 text-left text-cream backdrop-blur-[2px] transition duration-300 hover:-translate-y-1 hover:bg-cream/[0.05] sm:p-6"
                style={
                  {
                    "--card-delay": `${260 + index * 170}ms`
                  } as CSSProperties
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <Icon
                    size={38}
                    strokeWidth={1.35}
                    className="text-cream/72 transition duration-300 group-hover:text-cream/88"
                    aria-hidden="true"
                  />
                  <span className="blueprint-label rounded-full border border-cream/18 px-3 py-1 text-cream/44">
                    {item.count}
                  </span>
                </div>

                <p className="blueprint-label mt-8 text-cream/42">{item.label}</p>
                <h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.025em] text-cream sm:text-[1.7rem]">
                  {item.title}
                </h2>
                <p className="onboarding-lede mt-3 font-semibold text-cream/66">{item.detail}</p>
                <p className="onboarding-lede mt-auto pt-7 text-cream/54">{item.note}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            className={`browse-nudge onboarding-review-nudge ${PRIMARY_BUTTON}`}
          >
            Continue <ArrowRight size={15} />
          </button>
          <button type="button" onClick={onReplace} className={SECONDARY_BUTTON}>
            Choose a different resume
          </button>
        </div>
      </section>
    </div>
  );
}
