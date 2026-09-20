import { describe, expect, it } from "vitest";
import { privacyPolicy, termsOfService } from "./legal";

describe("legal documents content", () => {
  it("defines complete privacy policy document", () => {
    expect(privacyPolicy.title).toBe("Privacy Policy");
    expect(privacyPolicy.introduction).toBeTruthy();
    expect(privacyPolicy.updatedAt).toBeTruthy();
    expect(privacyPolicy.sections.length).toBeGreaterThan(0);

    for (const section of privacyPolicy.sections) {
      expect(section.title).toBeTruthy();
      expect(section.body).toBeTruthy();
    }
  });

  it("defines complete terms of service document", () => {
    expect(termsOfService.title).toBe("Terms of Service");
    expect(termsOfService.introduction).toBeTruthy();
    expect(termsOfService.updatedAt).toBeTruthy();
    expect(termsOfService.sections.length).toBeGreaterThan(0);

    for (const section of termsOfService.sections) {
      expect(section.title).toBeTruthy();
      expect(section.body).toBeTruthy();
    }
  });
});
