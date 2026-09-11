export const STORY_PRACTICE_KEYS = [
  "core-technical",
  "applied-engineering",
  "architecture-design"
] as const;

export type StoryPracticeKey = (typeof STORY_PRACTICE_KEYS)[number];
export type StoryPracticeQuestionCapability = "choice" | "text" | "code";
export type StoryPracticeAssessmentMode = "inline-form" | "shared-voice-room";

type StoryPracticeRouteIdentity = {
  slug: StoryPracticeKey;
  apiBase: `/api/practice/${string}`;
  routeBase: `/practice/${string}`;
  subjectNoun: string;
};

export type StoryPracticePreparationOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  detail: string;
};

export type StoryPracticeTechnologyOption<TValue extends string = string> =
  StoryPracticePreparationOption<TValue> & {
    resumeMatched?: boolean;
  };

/**
 * Domain-neutral configuration for the polished teacher-led first-entry
 * screen. The server still derives every trusted focus field; the browser
 * contributes only the selected option through `buildConfirmation`.
 */
export type StoryPracticeTechnologyWelcomeExperience<TValue extends string = string> = Pick<
  StoryPracticeRouteIdentity,
  "slug" | "apiBase" | "routeBase"
> & {
  label: string;
  heading: string;
  choosingScript: string;
  confirmingScript: (selectedLabel: string | null) => string;
  generatingScript: string;
  options: readonly StoryPracticeTechnologyOption<TValue>[];
  buildConfirmation: (value: TValue) => unknown;
  buildPreparation: (focusRevisionId: string, requestId: string) => unknown;
};

export type StoryPracticePreparationExperience<TValue extends string = string> =
  StoryPracticeRouteIdentity & {
    heading: string;
    optionLabel: string;
    optionIcon: "code" | "design";
    options: readonly StoryPracticePreparationOption<TValue>[];
    defaultOption: TValue;
    buildConfirmation: (value: TValue) => unknown;
  };

export type StoryPracticeIntroExperience = Pick<
  StoryPracticeRouteIdentity,
  "routeBase" | "subjectNoun"
> & {
  label: string;
  description: string;
  script: (title: string) => string;
};

export type StoryPracticeAssessmentExperience<
  TAssessment = unknown,
  TReport = unknown
> = StoryPracticeRouteIdentity & {
  label: string;
  mode: StoryPracticeAssessmentMode;
  evidenceAnchorLabel: string;
  measures: readonly string[];
  defenceDescription: string;
  answerPlaceholder: string;
  evidenceSummary: (report: TReport) => string;
  scoreRows: (report: TReport | null) => ReadonlyArray<readonly [string, number]>;
  adaptAssessment: (assessment: unknown) => TAssessment;
};

export type StoryPracticeOverviewExperience<TAssessment = unknown, TReport = unknown> = Pick<
  StoryPracticeRouteIdentity,
  "slug" | "routeBase" | "subjectNoun"
> & {
  label: string;
  environmentLabel: string | null;
  libraryDescription: string;
  startUnstartedPath?: {
    endpoint: `/api/practice/${string}`;
  };
  coachSteps: readonly [string, string, string];
  intro: StoryPracticeIntroExperience;
  assessment: StoryPracticeAssessmentExperience<TAssessment, TReport>;
};

export type StoryPracticeWorkspaceExperience<TQuestion = unknown> = StoryPracticeRouteIdentity & {
  label: string;
  environmentLabel: string | null;
  capabilities: {
    runCode: boolean;
  };
  textAnswerPlaceholder: string;
  feedbackReasoningLabel: string;
  responseLabel: (format: string) => string | null;
  responseGuidance: (format: string) => string | null;
  adaptQuestion: (question: unknown) => TQuestion;
};

/**
 * One presentation-only configuration assembled from the slices consumed by
 * the shared client components. Domain persistence remains behind adapters.
 */
export type StoryPracticeExperience<
  TValue extends string = string,
  TQuestion = unknown,
  TAssessment = unknown,
  TReport = unknown
> = {
  key: StoryPracticeKey;
  preparation: StoryPracticePreparationExperience<TValue>;
  technologyWelcome?: StoryPracticeTechnologyWelcomeExperience<TValue>;
  intro: StoryPracticeIntroExperience;
  overview: StoryPracticeOverviewExperience<TAssessment, TReport>;
  workspace: StoryPracticeWorkspaceExperience<TQuestion>;
  assessment: StoryPracticeAssessmentExperience<TAssessment, TReport>;
};

export function defineStoryPracticeExperience<
  TValue extends string,
  TQuestion,
  TAssessment,
  TReport
>(
  experience: StoryPracticeExperience<TValue, TQuestion, TAssessment, TReport>
): StoryPracticeExperience<TValue, TQuestion, TAssessment, TReport> {
  return experience;
}
