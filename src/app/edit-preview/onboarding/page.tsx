import { notFound } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { privatePageMetadata } from "@/lib/seo";
import type { ResumeExtractionResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Onboarding Preview",
  "Internal Trailgrad onboarding preview for design review."
);

const steps = ["role", "level", "resume", "identity", "evidence", "readiness"] as const;
type PreviewStep = (typeof steps)[number];

/** Stand-in extraction, so the post-upload steps can be reviewed without one. */
const sampleResult: ResumeExtractionResponse = {
  profile: {
    targetRole: "frontend",
    level: "3-5",
    targetCompany: "",
    targetDate: null,
    headline: "Senior Frontend Engineer",
    context: "",
    focusAreas: ["Performance", "Design systems", "Ownership"],
    stories: [],
    updatedAt: Date.now(),
    completeness: 82,
    onboardingCompletedAt: null,
    resume: null
  },
  frontendRoadmap: null,
  extraction: {
    fullName: "Nikhil Verma",
    headline:
      "Frontend engineer with five years building dashboards, design systems and data-heavy interfaces.",
    skills: ["React", "TypeScript", "Next.js", "GraphQL", "Testing Library"],
    focusAreas: ["Performance", "Design systems", "Ownership"],
    stories: [],
    experience: [
      {
        organization: "FlashAid",
        role: "Senior Frontend Engineer",
        period: "2022 — Present",
        location: "Remote",
        summary: "Owned the analytics dashboard and its data-fetching layer.",
        achievements: ["Cut dashboard p95 render from 400ms to 120ms."],
        skills: ["React", "TypeScript"]
      }
    ],
    education: [
      {
        institution: "Delhi University",
        credential: "B.Sc.",
        field: "Computer Science",
        period: "2016 — 2019"
      }
    ],
    projects: [
      {
        name: "SmartCollect",
        summary: "Payments console handling 2,000+ monthly transactions.",
        outcome: "Reduced manual reconciliation by 60%.",
        skills: ["React", "Node.js"]
      }
    ],
    achievements: ["Emerging Star Award, 2023"],
    practiceQuestions: [],
    roadmap: [],
    confidence: 92,
    // Non-empty so the readiness step's warnings panel is reviewable.
    warnings: [
      "No measurable outcome was detected in the experience bullets.",
      "No LinkedIn, GitHub, or portfolio profile was detected."
    ],
    document: {
      format: "pdf",
      pageCount: 2,
      pageCountEstimated: false,
      sections: ["summary", "experience", "projects", "education", "skills"]
    },
    evidence: {
      dateRanges: 4,
      achievementLines: 11,
      quantifiedAchievements: 6,
      experienceEntries: 3,
      projectEntries: 2,
      educationEntries: 1
    }
  }
};

/** Dev-only harness. `?step=identity` opens a later step without clicking through. */
export default async function OnboardingPreview({
  searchParams
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const requested = (await searchParams).step;
  const step = (steps.find((value) => value === requested) ?? "role") as PreviewStep;

  return <OnboardingFlow initialStep={step} initialResult={sampleResult} />;
}
