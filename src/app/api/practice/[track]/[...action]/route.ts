import type { NextRequest } from "next/server";

import { ApiRouteError } from "@/server/http/api-error";
import { apiError } from "@/server/http/api-response";
import { POST as coreAssessmentFinalize } from "../../core-technical/assessment/finalize/handler";
import { POST as coreAssessmentStart } from "../../core-technical/assessment/start/handler";
import { POST as coreAttempt } from "../../core-technical/attempt/handler";
import { POST as coreConfirm } from "../../core-technical/confirm/handler";
import { POST as coreContinue } from "../../core-technical/continue/handler";
import { POST as coreDraft } from "../../core-technical/draft/handler";
import { POST as coreHint } from "../../core-technical/hint/handler";
import { POST as coreLearn } from "../../core-technical/learn/handler";
import { POST as corePrepare } from "../../core-technical/prepare/handler";
import { POST as coreRun } from "../../core-technical/run/handler";
import { POST as coreStartPath } from "../../core-technical/start-path/handler";
import { POST as appliedAssessmentFinalize } from "../../applied-engineering/assessment/finalize/handler";
import { POST as appliedAssessmentStart } from "../../applied-engineering/assessment/start/handler";
import { POST as appliedAttempt } from "../../applied-engineering/attempt/handler";
import { POST as appliedConfirm } from "../../applied-engineering/confirm/handler";
import { POST as appliedContinue } from "../../applied-engineering/continue/handler";
import { POST as appliedDraft } from "../../applied-engineering/draft/handler";
import { POST as appliedHint } from "../../applied-engineering/hint/handler";
import { POST as appliedLearn } from "../../applied-engineering/learn/handler";
import { POST as appliedPrepare } from "../../applied-engineering/prepare/handler";
import { POST as appliedRun } from "../../applied-engineering/run/handler";
import { POST as appliedStartPath } from "../../applied-engineering/start-path/handler";
import { POST as architectureAssessmentFinalize } from "../../architecture-design/assessment/finalize/handler";
import { POST as architectureAssessmentStart } from "../../architecture-design/assessment/start/handler";
import { POST as architectureAttempt } from "../../architecture-design/attempt/handler";
import { POST as architectureConfirm } from "../../architecture-design/confirm/handler";
import { POST as architectureContinue } from "../../architecture-design/continue/handler";
import { POST as architectureDraft } from "../../architecture-design/draft/handler";
import { POST as architectureHint } from "../../architecture-design/hint/handler";
import { POST as architectureLearn } from "../../architecture-design/learn/handler";
import { POST as architecturePrepare } from "../../architecture-design/prepare/handler";
import { POST as architectureStartPath } from "../../architecture-design/start-path/handler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type PracticeHandler = (request: NextRequest) => Promise<Response>;

type RouteContext = {
  params: Promise<{ track: string; action: string[] }>;
};

const handlers: Readonly<Record<string, PracticeHandler>> = {
  "core-technical/assessment/finalize": coreAssessmentFinalize,
  "core-technical/assessment/start": coreAssessmentStart,
  "core-technical/attempt": coreAttempt,
  "core-technical/confirm": coreConfirm,
  "core-technical/continue": coreContinue,
  "core-technical/draft": coreDraft,
  "core-technical/hint": coreHint,
  "core-technical/learn": coreLearn,
  "core-technical/prepare": corePrepare,
  "core-technical/run": coreRun,
  "core-technical/start-path": coreStartPath,
  "applied-engineering/assessment/finalize": appliedAssessmentFinalize,
  "applied-engineering/assessment/start": appliedAssessmentStart,
  "applied-engineering/attempt": appliedAttempt,
  "applied-engineering/confirm": appliedConfirm,
  "applied-engineering/continue": appliedContinue,
  "applied-engineering/draft": appliedDraft,
  "applied-engineering/hint": appliedHint,
  "applied-engineering/learn": appliedLearn,
  "applied-engineering/prepare": appliedPrepare,
  "applied-engineering/run": appliedRun,
  "applied-engineering/start-path": appliedStartPath,
  "architecture-design/assessment/finalize": architectureAssessmentFinalize,
  "architecture-design/assessment/start": architectureAssessmentStart,
  "architecture-design/attempt": architectureAttempt,
  "architecture-design/confirm": architectureConfirm,
  "architecture-design/continue": architectureContinue,
  "architecture-design/draft": architectureDraft,
  "architecture-design/hint": architectureHint,
  "architecture-design/learn": architectureLearn,
  "architecture-design/prepare": architecturePrepare,
  "architecture-design/start-path": architectureStartPath
};

/**
 * One physical Vercel Function serves the practice action URLs. Keeping the
 * public paths stable avoids any client migration while staying within Hobby's
 * bundled-function limit.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { track, action } = await context.params;
  const path = `${track}/${action.join("/")}`;
  const handler = handlers[path];

  if (!handler) {
    return apiError(
      new ApiRouteError(404, "NOT_FOUND", "Practice route not found", {
        method: "POST",
        path: `/${path}`
      }),
      request.nextUrl.pathname
    );
  }

  return handler(request);
}
