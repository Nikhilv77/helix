import { notFound } from "next/navigation";
import { CandidateProfileEditor } from "@/components/workspace/candidate-profile-editor";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { privatePageMetadata } from "@/lib/seo";
import type { CandidateProfile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Profile Preview",
  "Internal Trailgrad profile preview for design review."
);

const profile: CandidateProfile = {
  targetRole: "fullstack",
  level: "3-5",
  targetCompany: "",
  targetDate: null,
  headline: "Software Developer at FlashAid | Full-Stack & AI Engineer",
  context:
    "Software Developer with full-stack and founding engineering experience across fintech, health-tech, and AI products. Proven track record of scaling high-impact platforms using React, TypeScript, Node.js, and PostgreSQL, processing thousands of monthly payments, contributing to ₹2Cr+ in annual revenue, and winning the Emerging Star Award.",
  coverImage: null,
  profileImage: null,
  focusAreas: ["Technical depth", "System design", "Ownership", "Impact", "Behavioral stories"],
  stories: [
    {
      id: "s1",
      title: "SmartCollect Platform Delivery",
      situation: "Flashaid needed a platform.",
      action: "Delivered SmartCollect.",
      outcome: "Processed 2,000+ monthly payments.",
      skills: ["React", "TypeScript"]
    },
    {
      id: "s2",
      title: "DUMPIT App Performance",
      situation: "App needed tuning.",
      action: "Optimised the app.",
      outcome: "Reduced load times by 30%.",
      skills: ["React Native"]
    }
  ],
  updatedAt: Date.now(),
  completeness: 100,
  onboardingCompletedAt: Date.now(),
  resume: {
    fileName: "Nikhil Resume.pdf",
    uploadedAt: Date.now(),
    confidence: 93,
    fullName: "Nikhil Verma",
    skills: ["TypeScript"],
    warnings: [],
    experience: [
      {
        organization: "FLASHAID",
        role: "Software Developer",
        period: "Aug 2024 – Present",
        location: "",
        summary: "",
        achievements: [],
        skills: []
      }
    ],
    education: [],
    projects: [],
    achievements: [],
    practiceQuestions: [{ id: "q1", competency: "Ownership", prompt: "…", evidenceAnchor: "x" }],
    roadmap: [],
    document: { format: "pdf", pageCount: 1, pageCountEstimated: false, sections: [] },
    evidence: {
      dateRanges: 1,
      achievementLines: 1,
      quantifiedAchievements: 1,
      experienceEntries: 1,
      projectEntries: 0,
      educationEntries: 0
    }
  }
};

export default function EditPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <WorkspaceShell>
      <CandidateProfileEditor initialProfile={profile} />
    </WorkspaceShell>
  );
}
