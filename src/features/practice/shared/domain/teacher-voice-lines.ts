/**
 * Fixed lines teachers speak in Practice. They never interpolate user data, so
 * each teacher's audio is pre-generated (`pnpm voice:lines`) and served from
 * the CDN. Editing a line falls back to live speech until it is regenerated.
 */
export const TEACHER_VOICE_LINES = {
  coreTechnicalIntro:
    "I’ve prepared this path around practical interview questions. Start with the concrete problem, explain what is happening, then show how you would fix it.",
  appliedEngineeringIntro:
    "Here is your next incident. Follow the evidence, isolate the root cause, then ship the repair safely.",
  architectureDesignIntro:
    "Here is your next design scenario. Frame the requirements, trace the system, then defend the trade-offs.",
  storyTrackIntro:
    "Let's work through this path. Read the evidence, explain your decision, and check what would change it.",
  coreTechnicalWelcome:
    "I’m using your resume, target role, level, and assessment history to choose the right technical focus.",
  coreTechnicalPreparing:
    "I’m preparing a focused set of recurring interview questions, code evidence, and learning guides for your level.",
  appliedEngineeringWelcome:
    "Welcome to Applied Engineering practice. Which technology should we use for your production incidents?",
  appliedEngineeringConfirming: "Great choice. I’ll prepare a focused production engineering path.",
  appliedEngineeringPreparing:
    "I’m preparing a reviewed incident with practical diagnosis, repair, testing, and rollout questions.",
  architectureDesignWelcome:
    "Welcome to Architecture and Design practice. Let’s build the system-design path aligned to your role.",
  architectureDesignConfirming:
    "Great—let’s work through a role-aligned system design. I’ll use your interview context to choose the best starting scenario.",
  architectureDesignPreparing:
    "I’m preparing a reviewed scenario with requirements, data, architecture, reliability, and evolution questions."
} as const;

/** Every distinct fixed line, in the order audio should be generated. */
export const FIXED_TEACHER_LINES: readonly string[] = [
  ...new Set(Object.values(TEACHER_VOICE_LINES))
];
