import type { AppConfigService } from "@/server/config/app-config.service";
import { canViewInterviewOperations } from "./interview-operations-access";

function config(interviewOperationsAdminUserId?: string) {
  return { interviewOperationsAdminUserId } as unknown as AppConfigService;
}

describe("interview operations access", () => {
  it("keeps local development closed without a signed-in admin", () => {
    expect(canViewInterviewOperations(config("admin-1"), null)).toBe(false);
  });

  it("keeps the dashboard closed when no admin is configured", () => {
    expect(canViewInterviewOperations(config(), "user:admin-1")).toBe(false);
  });

  it("rejects a different authenticated user", () => {
    expect(canViewInterviewOperations(config("admin-1"), "user:someone-else")).toBe(false);
  });

  it("allows only the configured Clerk user", () => {
    expect(canViewInterviewOperations(config("admin-1"), "user:admin-1")).toBe(true);
  });

  it("does not accept an owner-prefixed value in the admin setting", () => {
    expect(canViewInterviewOperations(config("user:admin-1"), "user:admin-1")).toBe(false);
  });
});
