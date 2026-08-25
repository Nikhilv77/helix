import { NextRequest } from "next/server";
import type { AppConfigService } from "../config/app-config.service";
import { createInterviewAgentCapability } from "./interview-auth";
import { authorizeInterviewSession } from "./session-access";

const SECRET = "test-secret-with-at-least-thirty-two-characters";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const config = { interviewAuthSecret: SECRET } as AppConfigService;

function agentRequest(token: string): NextRequest {
  return new NextRequest("http://localhost/api/interview/decide", {
    headers: { authorization: `Bearer ${token}` }
  });
}

describe("authorizeInterviewSession", () => {
  it("accepts a live capability only for its own session", async () => {
    const token = createInterviewAgentCapability(SESSION_ID, Date.now() + 60_000, SECRET);

    await expect(
      authorizeInterviewSession(agentRequest(token), config, SESSION_ID, "answer")
    ).resolves.toEqual({ kind: "agent" });
    await expect(
      authorizeInterviewSession(agentRequest(token), config, OTHER_SESSION_ID, "answer")
    ).rejects.toMatchObject({ statusCode: 403, code: "INTERVIEW_CAPABILITY_MISMATCH" });
  });

  it("does not allow the voice capability to end an interview", async () => {
    const token = createInterviewAgentCapability(SESSION_ID, Date.now() + 60_000, SECRET);

    await expect(
      authorizeInterviewSession(agentRequest(token), config, SESSION_ID, "end")
    ).rejects.toMatchObject({ statusCode: 403, code: "INTERVIEW_CAPABILITY_FORBIDDEN" });
  });
});
