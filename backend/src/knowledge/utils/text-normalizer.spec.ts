import { normalizeKnowledgeText } from "./text-normalizer";

describe("normalizeKnowledgeText", () => {
  it("normalizes line endings, spacing, and excessive blank lines", () => {
    expect(normalizeKnowledgeText("  # Title\r\n\r\n\r\nParagraph\t with   spaces.  \r\n")).toBe(
      "# Title\n\nParagraph with spaces."
    );
  });
});
