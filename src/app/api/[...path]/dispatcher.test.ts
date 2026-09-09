import { describe, expect, it } from "vitest";

import { resolveRoute } from "./dispatcher";

const publicRoutes = [
  "account",
  "account/accent",
  "account/dsa-language",
  "account/teacher",
  "auth/clear-session",
  "code/run",
  "cron/teacher-notifications",
  "curriculum",
  "dsa/interview/evaluate",
  "dsa/notes/example-note",
  "dsa/practice-feedback",
  "help/active",
  "help/history",
  "help/inbox",
  "help/overview",
  "help/reports",
  "help/request",
  "help/request/example-request",
  "help/room/example-room",
  "help/safety",
  "help/session/example-session",
  "help/status",
  "interview-plan",
  "interview/example-session",
  "interview/decide",
  "interview/dsa/block-assessment/skip",
  "interview/dsa/block-assessment/start",
  "interview/dsa/start",
  "interview/fundamentals/start",
  "interview/quota",
  "interview/reconcile-owner",
  "interview/resume/start",
  "interview/start",
  "livekit/token",
  "notifications",
  "notifications/preferences",
  "notifications/status",
  "onboarding/complete",
  "onboarding/resume",
  "practice/applied-engineering",
  "practice/applied-engineering/attempt",
  "practice/architecture-design",
  "practice/architecture-design/attempt",
  "practice/core-technical",
  "practice/core-technical/attempt",
  "preparation-onboarding",
  "profile",
  "profile/resume",
  "resume-roast",
  "roadmap/question-attempt",
  "search",
  "v1/example-resource",
  "voice/speak",
];

describe("API dispatcher", () => {
  it.each(publicRoutes)("preserves /api/%s", (path) => {
    expect(resolveRoute(path.split("/"))).not.toBeNull();
  });

  it("does not route unknown paths", () => {
    expect(resolveRoute(["unknown"])).toBeNull();
  });
});
