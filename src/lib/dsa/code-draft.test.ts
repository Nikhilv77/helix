import { describe, expect, it } from "vitest";
import { dsaCodeDraftKey, readDsaCodeDraft, writeDsaCodeDraft } from "./code-draft";

function storageFixture() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

describe("DSA code drafts", () => {
  it("keeps drafts separate by question and language", () => {
    const storage = storageFixture();
    expect(writeDsaCodeDraft(storage, "two-sum", "javascript", "js solution")).toBe(true);
    expect(writeDsaCodeDraft(storage, "two-sum", "python", "py solution")).toBe(true);

    expect(readDsaCodeDraft(storage, "two-sum", "javascript")).toBe("js solution");
    expect(readDsaCodeDraft(storage, "two-sum", "python")).toBe("py solution");
    expect(readDsaCodeDraft(storage, "three-sum", "javascript")).toBeNull();
  });

  it("uses a stable encoded key and rejects oversized drafts", () => {
    const storage = storageFixture();
    expect(dsaCodeDraftKey("a question", "cpp")).toBe("trailgrad.dsa-draft.v1:a%20question:cpp");
    expect(writeDsaCodeDraft(storage, "two-sum", "java", "x".repeat(20_001))).toBe(false);
    expect(readDsaCodeDraft(storage, "two-sum", "java")).toBeNull();
  });

  it("does not break the workspace when browser storage is unavailable", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      }
    };
    expect(readDsaCodeDraft(storage, "two-sum", "javascript")).toBeNull();
    expect(writeDsaCodeDraft(storage, "two-sum", "javascript", "code")).toBe(false);
  });
});
