import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";
import {
  STORY_DISCIPLINES,
  offersStoryTrack,
  storyDiscipline,
  storyDisciplineForRole,
  storyDisciplinePaths,
  storyTrackHref,
  storyTrackQuestionTotal,
  usesNodePracticeTracks
} from "./story-disciplines";

const TRACKS = ["core-technical", "applied-engineering"] as const;
const profile = { resume: null, level: "0-2" } as unknown as CandidateProfile;

describe("story practice disciplines", () => {
  it("maps each role to its story discipline", () => {
    expect(storyDisciplineForRole("ai-ml")).toBe("ai-ml");
    expect(storyDisciplineForRole("frontend")).toBe("frontend");
    expect(storyDisciplineForRole("data")).toBe("data");
    expect(storyDisciplineForRole("backend")).toBe("backend");
    expect(storyDisciplineForRole("fullstack")).toBe("backend");
    expect(storyDisciplineForRole("pm")).toBeNull();
    expect(storyDisciplineForRole(null)).toBeNull();
  });

  it("keeps the Node.js tracks for backend, full-stack, and unset roles", () => {
    expect(usesNodePracticeTracks("backend")).toBe(true);
    expect(usesNodePracticeTracks("fullstack")).toBe(true);
    expect(usesNodePracticeTracks(null)).toBe(true);
    expect(usesNodePracticeTracks("frontend")).toBe(false);
    expect(usesNodePracticeTracks("data")).toBe(false);
    expect(usesNodePracticeTracks("ai-ml")).toBe(false);
  });

  it("serves backend fundamentals as a single Core Technical track", () => {
    expect(offersStoryTrack("backend", "core-technical")).toBe(true);
    expect(offersStoryTrack("backend", "applied-engineering")).toBe(false);
    expect(storyDiscipline("backend").architecture).toBeNull();
    expect(storyTrackHref("backend", "core-technical")).toBe("/practice/backend/core-technical");
  });

  it("links each discipline's tracks under its own practice URL", () => {
    expect(storyTrackHref("frontend", "core-technical")).toBe("/practice/frontend/core-technical");
    expect(storyTrackHref("data", "applied-engineering")).toBe(
      "/practice/data/applied-engineering"
    );
  });

  it("counts the questions a new cohort receives", () => {
    for (const discipline of ["frontend", "data", "backend"] as const) {
      for (const track of storyDiscipline(discipline).offeredTracks) {
        const authored = storyDisciplinePaths(discipline, track).flatMap((path) => path.questions);
        expect(storyTrackQuestionTotal(profile, discipline, track)).toBe(authored.length);
        expect(storyTrackQuestionTotal(profile, discipline, track, 99)).toBe(99);
      }
    }
  });

  describe.each(STORY_DISCIPLINES.filter((discipline) => discipline !== "ai-ml"))(
    "%s catalog",
    (discipline) => {
      it.each(TRACKS.filter((track) => offersStoryTrack(discipline, track)))(
        "provides complete, distinct %s paths",
        (track) => {
          const paths = storyDisciplinePaths(discipline, track);
          const questions = paths.flatMap((path) => path.questions);

          expect(paths.length).toBeGreaterThanOrEqual(2);
          expect(new Set(paths.map((path) => path.key)).size).toBe(paths.length);
          expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
          expect(questions.every((question) => question.id.startsWith(`${discipline}-`))).toBe(
            true
          );
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
        }
      );

      it("never lists an ordering question's steps already in a passing order", () => {
        const questions = storyDiscipline(discipline).offeredTracks.flatMap((track) =>
          storyDisciplinePaths(discipline, track).flatMap((path) => path.questions)
        );
        for (const question of questions) {
          if (question.interaction?.type !== "sequence") continue;
          const position = new Map(
            question.interaction.items.map((item, index) => [item.id, index])
          );
          const rules = (question.interactionRubric ?? []).filter((rule) => rule.type === "before");
          const authoredOrderPasses = rules.every(
            (rule) =>
              rule.type === "before" &&
              (position.get(rule.first) ?? 0) < (position.get(rule.second) ?? 0)
          );
          expect(authoredOrderPasses, question.id).toBe(false);
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

  it("spreads backend MCQ answers across positions", () => {
    const positions = storyDisciplinePaths("backend", "core-technical")
      .flatMap((path) => path.questions)
      .filter((question) => question.format === "mcq")
      .map((question) => question.correctChoiceIndex);
    expect(new Set(positions).size).toBeGreaterThan(2);
  });
});
