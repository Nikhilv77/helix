import { notFound } from "next/navigation";
import { Dashboard } from "@/components/workspace/dashboard";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { CandidateProfile, InterviewHistoryItem, WorkspaceInsights } from "@/lib/types";

export const dynamic = "force-dynamic";

const profile: CandidateProfile = {
  targetRole: "fullstack",
  level: "3-5",
  targetCompany: "",
  targetDate: null,
  headline: "Software Developer with full-stack fintech experience",
  context: "Full-stack products across fintech, health-tech, and insurtech.",
  focusAreas: ["Technical depth", "System design", "Ownership"],
  stories: [
    {
      id: "s1",
      title: "SmartCollect Platform Delivery",
      situation: "Flashaid needed a fintech platform.",
      action: "Delivered SmartCollect.",
      outcome: "Processed 2,000+ monthly payments.",
      skills: ["React", "Node.js"]
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
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    warnings: [],
    experience: [
      {
        organization: "FLASHAID",
        role: "Software Developer",
        period: "Aug 2024 – Present",
        location: "",
        summary: "Full-stack fintech products.",
        achievements: [],
        skills: []
      }
    ],
    education: [],
    projects: [],
    achievements: [],
    practiceQuestions: [
      { id: "q1", competency: "Ownership", prompt: "Walk me through SmartCollect.", evidenceAnchor: "SmartCollect" },
      { id: "q2", competency: "Impact", prompt: "How did you measure the 30%?", evidenceAnchor: "DUMPIT" }
    ],
    roadmap: [
      {
        id: "r1",
        title: "Rebuild your ownership narrative",
        rationale: "Your bullets describe team outcomes more than personal decisions.",
        actions: ["Rewrite two bullets around a decision only you made."]
      },
      {
        id: "r2",
        title: "Quantify the SmartCollect impact",
        rationale: "The payment volume is there, the baseline is not.",
        actions: ["Find the pre-launch number."]
      },
      {
        id: "r3",
        title: "Pressure-test system design",
        rationale: "Full-stack rounds at this level go deep on failure modes.",
        actions: ["Practice the retry pipeline end to end."]
      }
    ],
    document: { format: "pdf", pageCount: 1, pageCountEstimated: false, sections: [] },
    evidence: {
      dateRanges: 2,
      achievementLines: 4,
      quantifiedAchievements: 2,
      experienceEntries: 1,
      projectEntries: 0,
      educationEntries: 1
    }
  }
};

const sessions: InterviewHistoryItem[] = [
  {
    sessionId: "11111111-1111-1111-1111-111111111111",
    status: "completed",
    setup: {
      role: "fullstack",
      level: "3-5",
      roundType: "technical",
      intensity: "realistic",
      context: "SmartCollect payments platform, mandate automation, UPI integrations.",
      templateTitle: "Defend your projects"
    },
    startedAt: Date.now() - 86_400_000,
    updatedAt: Date.now() - 86_000_000,
    durationMs: 725_000,
    questionCount: 4,
    questionsCovered: 4
  }
];

const insights: WorkspaceInsights = {
  readinessScore: 68,
  completedSessions: 3,
  sessionsThisWeek: 2,
  answeredQuestions: 11,
  competencyMap: [
    { label: "Ownership", score: 74, attempts: 4, trend: 6 },
    { label: "Technical judgement", score: 61, attempts: 3, trend: -2 },
    { label: "Impact", score: 52, attempts: 2, trend: 0 }
  ],
  strongest: { label: "Ownership", score: 74, attempts: 4, trend: 6 },
  recommendedFocus: { label: "Impact", score: 52, attempts: 2, trend: 0 }
};

/** Temporary harness for reviewing the home page without signing in. */
export default function HomePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <WorkspaceShell>
      <Dashboard
        quota={{ used: 1, limit: 5 }}
        sessions={sessions}
        profile={profile}
        insights={insights}
      />
    </WorkspaceShell>
  );
}
