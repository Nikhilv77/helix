import type { NextRequest } from "next/server";

import * as account from "../account/handler";
import * as accountAccent from "../account/accent/handler";
import * as accountDsaLanguage from "../account/dsa-language/handler";
import * as accountTeacher from "../account/teacher/handler";
import * as clearSession from "../auth/clear-session/handler";
import * as codeRun from "../code/run/handler";
import * as teacherNotifications from "../cron/teacher-notifications/handler";
import * as curriculum from "../curriculum/handler";
import * as dsaInterviewEvaluate from "../dsa/interview/evaluate/handler";
import * as dsaNotes from "../dsa/notes/[slug]/handler";
import * as dsaPracticeFeedback from "../dsa/practice-feedback/handler";
import * as help from "../help/[...path]/handler";
import * as interviewPlan from "../interview-plan/handler";
import * as interviewSession from "../interview/[sessionId]/handler";
import * as interviewDecide from "../interview/decide/handler";
import * as interviewBlockSkip from "../interview/dsa/block-assessment/skip/handler";
import * as interviewBlockStart from "../interview/dsa/block-assessment/start/handler";
import * as interviewDsaStart from "../interview/dsa/start/handler";
import * as interviewFundamentalsStart from "../interview/fundamentals/start/handler";
import * as interviewQuota from "../interview/quota/handler";
import * as interviewReconcileOwner from "../interview/reconcile-owner/handler";
import * as interviewResumeStart from "../interview/resume/start/handler";
import * as interviewStart from "../interview/start/handler";
import * as livekitToken from "../livekit/token/handler";
import * as notifications from "../notifications/handler";
import * as notificationPreferences from "../notifications/preferences/handler";
import * as notificationStatus from "../notifications/status/handler";
import * as onboardingComplete from "../onboarding/complete/handler";
import * as onboardingResume from "../onboarding/resume/handler";
import * as practice from "../practice/[track]/[...action]/handler";
import * as appliedEngineering from "../practice/applied-engineering/handler";
import * as architectureDesign from "../practice/architecture-design/handler";
import * as coreTechnical from "../practice/core-technical/handler";
import * as preparationOnboarding from "../preparation-onboarding/handler";
import * as profile from "../profile/handler";
import * as profileResume from "../profile/resume/handler";
import * as resumeRoast from "../resume-roast/handler";
import * as roadmapQuestionAttempt from "../roadmap/question-attempt/handler";
import * as search from "../search/handler";
import * as v1 from "../v1/[...path]/handler";
import * as voiceSpeak from "../voice/speak/handler";

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
type HandlerContext = { params: Promise<Record<string, string | string[]>> };
type HandlerModule = Partial<Record<HttpMethod, unknown>>;
export type RouteContext = { params: Promise<{ path: string[] }> };

const exactRoutes: Record<string, HandlerModule> = {
  account,
  "account/accent": accountAccent,
  "account/dsa-language": accountDsaLanguage,
  "account/teacher": accountTeacher,
  "auth/clear-session": clearSession,
  "code/run": codeRun,
  "cron/teacher-notifications": teacherNotifications,
  curriculum,
  "dsa/interview/evaluate": dsaInterviewEvaluate,
  "dsa/practice-feedback": dsaPracticeFeedback,
  "interview-plan": interviewPlan,
  "interview/decide": interviewDecide,
  "interview/dsa/block-assessment/skip": interviewBlockSkip,
  "interview/dsa/block-assessment/start": interviewBlockStart,
  "interview/dsa/start": interviewDsaStart,
  "interview/fundamentals/start": interviewFundamentalsStart,
  "interview/quota": interviewQuota,
  "interview/reconcile-owner": interviewReconcileOwner,
  "interview/resume/start": interviewResumeStart,
  "interview/start": interviewStart,
  "livekit/token": livekitToken,
  notifications,
  "notifications/preferences": notificationPreferences,
  "notifications/status": notificationStatus,
  "onboarding/complete": onboardingComplete,
  "onboarding/resume": onboardingResume,
  "practice/applied-engineering": appliedEngineering,
  "practice/architecture-design": architectureDesign,
  "practice/core-technical": coreTechnical,
  "preparation-onboarding": preparationOnboarding,
  profile,
  "profile/resume": profileResume,
  "resume-roast": resumeRoast,
  "roadmap/question-attempt": roadmapQuestionAttempt,
  search,
  "voice/speak": voiceSpeak,
};

export function resolveRoute(path: string[]): {
  context: HandlerContext;
  handlers: HandlerModule;
} | null {
  const exact = exactRoutes[path.join("/")];
  if (exact) {
    return { handlers: exact, context: { params: Promise.resolve({}) } };
  }

  if (path.length === 3 && path[0] === "dsa" && path[1] === "notes") {
    return {
      handlers: dsaNotes,
      context: { params: Promise.resolve({ slug: path[2] ?? "" }) },
    };
  }

  if (path[0] === "help" && path.length > 1) {
    return {
      handlers: help,
      context: { params: Promise.resolve({ path: path.slice(1) }) },
    };
  }

  if (path.length === 2 && path[0] === "interview") {
    return {
      handlers: interviewSession,
      context: { params: Promise.resolve({ sessionId: path[1] ?? "" }) },
    };
  }

  if (path[0] === "practice" && path.length > 2) {
    return {
      handlers: practice,
      context: {
        params: Promise.resolve({
          action: path.slice(2),
          track: path[1] ?? "",
        }),
      },
    };
  }

  if (path[0] === "v1" && path.length > 1) {
    return {
      handlers: v1,
      context: { params: Promise.resolve({ path: path.slice(1) }) },
    };
  }

  return null;
}

export async function dispatch(
  request: NextRequest,
  routeContext: RouteContext,
  method: HttpMethod,
) {
  const { path } = await routeContext.params;
  const route = resolveRoute(path);

  if (!route) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const handler = route.handlers[method];
  if (typeof handler !== "function") {
    const allow = Object.keys(route.handlers)
      .filter((key): key is HttpMethod =>
        ["DELETE", "GET", "PATCH", "POST", "PUT"].includes(key),
      )
      .join(", ");
    return new Response(null, {
      status: 405,
      headers: allow ? { Allow: allow } : undefined,
    });
  }

  return handler(request, route.context);
}
