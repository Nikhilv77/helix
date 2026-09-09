import {
  createAnonymousOwnerCookie,
  createInterviewAgentCapability,
  verifyAnonymousOwnerCookie,
  verifyInterviewAgentCapability
} from "./interview-auth";

const SECRET = "test-secret-with-at-least-thirty-two-characters";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("interview authorization credentials", () => {
  it("round-trips a signed anonymous owner and rejects tampering", () => {
    const created = createAnonymousOwnerCookie(SECRET);

    expect(verifyAnonymousOwnerCookie(created.value, SECRET)).toBe(created.ownerId);
    expect(verifyAnonymousOwnerCookie(`${created.value}x`, SECRET)).toBeNull();
    expect(verifyAnonymousOwnerCookie(created.value, `${SECRET}-wrong`)).toBeNull();
  });

  it("creates a session-scoped voice-worker capability", () => {
    const now = Date.parse("2026-08-25T12:00:00Z");
    const token = createInterviewAgentCapability(SESSION_ID, now + 60_000, SECRET);

    expect(verifyInterviewAgentCapability(token, SECRET, now)).toEqual({
      aud: "trailgrad-interview-agent",
      exp: Math.floor((now + 60_000) / 1000),
      scp: ["read", "answer"],
      sid: SESSION_ID
    });
  });

  it("rejects expired and tampered voice-worker capabilities", () => {
    const now = Date.parse("2026-08-25T12:00:00Z");
    const expired = createInterviewAgentCapability(SESSION_ID, now - 1, SECRET);
    const valid = createInterviewAgentCapability(SESSION_ID, now + 60_000, SECRET);

    expect(verifyInterviewAgentCapability(expired, SECRET, now)).toBeNull();
    expect(verifyInterviewAgentCapability(`${valid}x`, SECRET, now)).toBeNull();
  });
});
