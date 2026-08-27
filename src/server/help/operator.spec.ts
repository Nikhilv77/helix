import { isOperator } from "./operator";
import type { AppConfigService } from "../config/app-config.service";

function config(operatorUserIds: string[]): AppConfigService {
  return { operatorUserIds } as unknown as AppConfigService;
}

describe("operator allowlist", () => {
  it("is closed when nobody is named", () => {
    // A misconfigured environment must expose nothing. This is the case that
    // matters most: an empty variable is far more likely than a wrong one.
    expect(isOperator(config([]), "user:user_abc")).toBe(false);
  });

  it("recognises an operator listed by raw Clerk id", () => {
    expect(isOperator(config(["user_abc"]), "user:user_abc")).toBe(true);
  });

  it("recognises an operator listed by prefixed owner key", () => {
    expect(isOperator(config(["user:user_abc"]), "user:user_abc")).toBe(true);
  });

  it("rejects anyone not on the list", () => {
    expect(isOperator(config(["user_abc"]), "user:user_xyz")).toBe(false);
  });

  it("rejects an anonymous owner", () => {
    // Anonymous owners have no Clerk user behind them, so they can never be
    // named on the list and must never match by accident.
    expect(isOperator(config(["user_abc"]), "anon:abc123")).toBe(false);
    expect(isOperator(config(["anon:abc123"]), "anon:abc123")).toBe(false);
  });

  it("does not match on a prefix or substring", () => {
    expect(isOperator(config(["user_abc"]), "user:user_abcdef")).toBe(false);
    expect(isOperator(config(["user_abcdef"]), "user:user_abc")).toBe(false);
  });
});
