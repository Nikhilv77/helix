import type { InterviewSetup, PlannedQuestion } from "@/features/interviews/server/types";
import type { Level, Role } from "@/lib/shared/types";
import type { StoryAssessmentSnapshot } from "@/features/practice/story-tracks/domain/story-assessment";

export const STORY_ASSESSMENT_EVALUATOR_VERSION = "story-track-assessment-evaluator-v1";

/**
 * Interview setup for a story path's assessment, shaped like the Applied
 * Engineering one so the shared typed room, teacher speech, and dialogue apply.
 */
export function buildStoryAssessmentSetup(input: {
  assessmentId: string;
  scopeKey: string;
  snapshot: StoryAssessmentSnapshot;
  owner: { targetRole: string | null; level: string | null; context: string | null };
}): InterviewSetup {
  const { snapshot } = input;
  return {
    role: asRole(input.owner.targetRole),
    level: asLevel(input.owner.level),
    roundType: "technical",
    intensity: "realistic",
    context: [
      `This is the frozen assessment for the practice path “${snapshot.pathTitle}”.`,
      "Use only the prepared prompts and their server-only evaluation guides.",
      input.owner.context ?? ""
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1_200),
    templateId: "story-track-path-assessment",
    templateTitle: `${snapshot.pathTitle} assessment`,
    durationMinutes: 20,
    questionCount: snapshot.prompts.length as NonNullable<InterviewSetup["questionCount"]>,
    storyPracticeAssessment: {
      kind: "story-practice-assessment",
      practice: "story-track",
      blockId: input.scopeKey,
      assessmentId: input.assessmentId,
      snapshotVersion: snapshot.schemaVersion,
      evaluatorVersion: STORY_ASSESSMENT_EVALUATOR_VERSION
    },
    storyPracticeAssessmentPresentation: {
      evidenceAnchorLabel: "Practice evidence",
      stages: [
        { id: "rapid", label: "Quick check", caption: "A question from your path" },
        { id: "explain", label: "Explain", caption: "Short written answers" },
        { id: "scenario", label: "Spot the trap", caption: "Pick the common mistake" }
      ]
    }
  };
}

export function buildStoryAssessmentPlan(snapshot: StoryAssessmentSnapshot): PlannedQuestion[] {
  return snapshot.prompts.map((prompt) => {
    const code = prompt.artifact.kind === "code";
    const choice = Boolean(prompt.choices?.length);
    const guide = {
      storyPracticeInterviewerGuide: {
        practice: "story-track" as const,
        label: snapshot.pathTitle,
        expectedAnswer: `${prompt.reference.concise}\n${prompt.reference.explanation}`.slice(
          0,
          4_000
        ),
        rubric: prompt.rubric.map((item) => ({ ...item }))
      }
    };
    if (choice) {
      const trap = prompt.id === "trap";
      return {
        text: prompt.prompt,
        kind: "mcq" as const,
        stage: stageFor(prompt.id),
        answerFormat: "mcq" as const,
        options: [...prompt.choices!],
        answerIndex: prompt.correctIndex,
        ...(code ? { codeSnippet: prompt.artifact.content } : {}),
        // The multiple-choice view shows this as its reference panel: the
        // scenario and its evidence, so every option can be judged from it.
        dsaReviewContext: {
          title: trap ? prompt.sourceTitle : prompt.artifact.title,
          difficulty: "guided",
          problemStatement: [
            trap ? prompt.sourcePrompt : code ? `From “${prompt.sourceTitle}”.` : null,
            code ? null : prompt.artifact.content
          ]
            .filter(Boolean)
            .join("\n\n"),
          constraints: [],
          examples: []
        },
        competency: prompt.label,
        rubricKeys: ["story-track"],
        intent: `Check the learner's ${prompt.label.toLowerCase()} choice.`,
        mustHit: [],
        probeIfMissing: "Which option would you defend, and why?",
        maxFollowUps: 0,
        ...guide
      };
    }
    return {
      text: prompt.prompt,
      // Code evidence renders in the room's code viewer; everything else as text.
      evidenceAnchor: code
        ? `${prompt.artifact.title}: From “${prompt.sourceTitle}”.`
        : `${prompt.artifact.title}: ${prompt.artifact.content}`,
      ...(code ? { codeSnippet: prompt.artifact.content } : {}),
      kind: "conversation" as const,
      stage: stageFor(prompt.id),
      answerFormat: "spoken" as const,
      competency: prompt.label,
      rubricKeys: ["story-track"],
      intent: `Assess the learner's ${prompt.label.toLowerCase()} answer against the path's reference answer.`,
      mustHit: prompt.guide.map((label) => label.toLowerCase()),
      probeIfMissing: "Which part of your reasoning would you check first, and why?",
      maxFollowUps: 1,
      ...guide
    };
  });
}

function stageFor(id: StoryAssessmentSnapshot["prompts"][number]["id"]) {
  if (id === "quick-check" || id === "revisit") return "rapid" as const;
  if (id === "trap" || id === "mistake") return "scenario" as const;
  return "explain" as const;
}

function asRole(value: string | null): Role {
  return value === "backend" ||
    value === "frontend" ||
    value === "fullstack" ||
    value === "data" ||
    value === "ai-ml" ||
    value === "pm"
    ? value
    : "fullstack";
}

function asLevel(value: string | null): Level {
  return value === "fresher" || value === "0-2" || value === "3-5" || value === "5-plus"
    ? value
    : "0-2";
}
