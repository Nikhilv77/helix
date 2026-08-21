import { Prisma } from "@prisma/client";

const FRONTEND_ROADMAP_ROLE = "fullstack";

export function buildPersonalization(profile: {
  level: string | null;
  focusAreas: Prisma.JsonValue;
  stories: Prisma.JsonValue;
  resumeAnalysis: Prisma.JsonValue | null;
  resumeFileName: string | null;
  resumeConfidence: number | null;
}) {
  const focusAreas = stringArray(profile.focusAreas, 8);
  const resumeTerms = collectResumeTerms(profile.resumeAnalysis);
  const matchedFrontendEvidence = matchFrontendEvidence([...focusAreas, ...resumeTerms]);

  return {
    targetRole: FRONTEND_ROADMAP_ROLE,
    level: profile.level,
    levelStrategy: levelStrategy(profile.level),
    resumeSignal:
      matchedFrontendEvidence.length > 0 ? "fullstack-evidence-found" : "evidence-building-needed",
    matchedFrontendEvidence,
    focusAreas,
    storyCount: Array.isArray(profile.stories) ? profile.stories.length : 0,
    resume: {
      fileName: profile.resumeFileName,
      confidence: profile.resumeConfidence
    }
  };
}

function levelStrategy(level: string | null): string {
  if (level === "fresher" || level === "0-2") {
    return "fundamentals-first-with-guided-warmups";
  }
  if (level === "3-5") {
    return "production-tradeoffs-debugging-and-feature-ownership";
  }
  if (level === "5-plus") {
    return "ambiguity-architecture-quality-strategy-and-leadership";
  }
  return "balanced-fullstack-interview-readiness";
}

function collectResumeTerms(value: Prisma.JsonValue | null): string[] {
  const terms: string[] = [];
  walkJson(value, terms);
  return terms;
}

function walkJson(value: Prisma.JsonValue | null | undefined, terms: string[]): void {
  if (typeof value === "string") {
    terms.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, terms);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) walkJson(nested, terms);
  }
}

function matchFrontendEvidence(values: string[]): string[] {
  const keywords = [
    "react",
    "next",
    "typescript",
    "javascript",
    "frontend",
    "front-end",
    "ui",
    "dashboard",
    "forms",
    "form",
    "design system",
    "accessibility",
    "performance",
    "web vitals",
    "responsive",
    "css",
    "tailwind"
  ];
  const text = values.join(" ").toLowerCase();
  return keywords.filter((keyword) => text.includes(keyword)).slice(0, 8);
}

function stringArray(value: Prisma.JsonValue, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, limit);
}
