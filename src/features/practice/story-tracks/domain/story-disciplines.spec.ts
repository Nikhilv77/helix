import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";
import {
  STORY_DISCIPLINES,
  storyDisciplineForRole,
  storyDisciplinePaths,
  storyTrackHref,
  storyTrackQuestionTotal
} from "./story-disciplines";

const TRACKS = ["core-technical", "applied-engineering"] as const;
const profile = { resume: null, level: "0-2" } as unknown as CandidateProfile;

describe("story practice disciplines", () => {
  it("maps only story-practice roles to a discipline", () => {
    expect(storyDisciplineForRole("ai-ml")).toBe("ai-ml");
    expect(storyDisciplineForRole("frontend")).toBe("frontend");
    expect(storyDisciplineForRole("data")).toBe("data");
    expect(storyDisciplineForRole("backend")).toBeNull();
    expect(storyDisciplineForRole("fullstack")).toBeNull();
    expect(storyDisciplineForRole(null)).toBeNull();
  });

  it("links each discipline's tracks under its own practice URL", () => {
    expect(storyTrackHref("frontend", "core-technical")).toBe("/practice/frontend/core-technical");
    expect(storyTrackHref("data", "applied-engineering")).toBe(
      "/practice/data/applied-engineering"
    );
  });

  it("counts the questions a new cohort receives", () => {
    for (const discipline of ["frontend", "data"] as const) {
      for (const track of TRACKS) {
        const authored = storyDisciplinePaths(discipline, track).flatMap((path) => path.questions);
        expect(storyTrackQuestionTotal(profile, discipline, track)).toBe(authored.length);
        expect(storyTrackQuestionTotal(profile, discipline, track, 99)).toBe(99);
      }
    }
  });

  describe.each(STORY_DISCIPLINES.filter((discipline) => discipline !== "ai-ml"))(
    "%s catalog",
    (discipline) => {
      it.each(TRACKS)("provides complete, distinct %s paths", (track) => {
        const paths = storyDisciplinePaths(discipline, track);
        const questions = paths.flatMap((path) => path.questions);

        expect(paths.length).toBeGreaterThanOrEqual(2);
        expect(new Set(paths.map((path) => path.key)).size).toBe(paths.length);
        expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
        expect(questions.every((question) => question.id.startsWith(`${discipline}-`))).toBe(true);
        expect(questions.some((question) => question.format === "mcq")).toBe(true);
        expect(questions.some((question) => question.format !== "mcq")).toBe(true);

        for (const path of paths) {
          expect(path.questions.length).toBeGreaterThanOrEqual(4);
          for (const question of path.questions) {
            expect(question.pathKey).toBe(path.key);
            expect(question.artifact.content.length).toBeGreaterThan(20);
            expect(question.hints).toHaveLength(3);
            expect(question.answer.concise.length).toBeGreaterThan(15);
            expect(question.answer.explanation.length).toBeGreaterThan(20);
            expect(question.rubric.reduce((total, item) => total + item.points, 0)).toBe(10);
            expect(question.interviewerFollowUps.length).toBeGreaterThan(0);
            expect(question.commonMistakes.length).toBeGreaterThan(0);
            if (question.format === "mcq") {
              expect(question.choices?.length).toBeGreaterThanOrEqual(2);
              expect(question.correctChoiceIndex).toBeGreaterThanOrEqual(0);
              expect(question.correctChoiceIndex).toBeLessThan(question.choices!.length);
            }
          }
        }
      });

      it("never reuses a question id across tracks or disciplines", () => {
        const ids = STORY_DISCIPLINES.flatMap((other) =>
          TRACKS.flatMap((track) =>
            storyDisciplinePaths(other, track).flatMap((path) =>
              path.questions.map((question) => question.id)
            )
          )
        );
        expect(new Set(ids).size).toBe(ids.length);
      });
    }
  );
});
