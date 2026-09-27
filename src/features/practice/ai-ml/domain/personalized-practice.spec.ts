import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";
import { recommendAiMlPractice, type AiMlPracticePath } from "./personalized-practice";

const profile = {
  level: "3-5",
  focusAreas: [],
  resume: {
    skills: ["retrieval", "search", "RAG"],
    projects: [{ name: "Research Assistant", summary: "Retrieval and search", skills: ["RAG"] }],
    experience: []
  },
  preparationOnboarding: { skillProfile: null }
} as unknown as CandidateProfile;

function path(key: string, format: "production-decision" | "artifact-diagnosis"): AiMlPracticePath {
  return {
    key,
    title: key,
    description: key,
    expectedMinutes: 30,
    questions: [{ id: `${key}-1`, title: `${key} question`, format, topicKeys: ["retrieval"] }]
  };
}

describe("recommendAiMlPractice", () => {
  const core = path("foundations", "artifact-diagnosis");
  const project = path("resume-project-d81b", "production-decision");

  it("recommends a core path before the learner's own project path", () => {
    const recommendation = recommendAiMlPractice({
      profile,
      paths: [core, project],
      questions: [
        { id: "a", questionKey: "foundations-1", status: "ACTIVE", draft: null },
        { id: "b", questionKey: "resume-project-d81b-1", status: "ACTIVE", draft: null }
      ]
    });
    expect(recommendation?.blockId).toBe("foundations");
  });

  it("recommends the project path once the core paths are finished", () => {
    const recommendation = recommendAiMlPractice({
      profile,
      paths: [core, project],
      questions: [
        { id: "a", questionKey: "foundations-1", status: "COMPLETED", draft: null },
        { id: "b", questionKey: "resume-project-d81b-1", status: "ACTIVE", draft: null }
      ]
    });
    expect(recommendation?.blockId).toBe("resume-project-d81b");
  });
});
