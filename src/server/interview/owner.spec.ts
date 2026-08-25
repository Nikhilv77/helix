import { NextResponse } from "next/server";
import type { AppConfigService } from "../config/app-config.service";
import { clearInterviewOwnerCookie } from "./owner";

describe("interview owner cookie", () => {
  it("clears the signed anonymous identity with its original security attributes", () => {
    const response = clearInterviewOwnerCookie(NextResponse.json({ ok: true }), {
      nodeEnv: "production"
    } as AppConfigService);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(cookie).toContain("trailgrad_interview_owner=");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
  });
});
