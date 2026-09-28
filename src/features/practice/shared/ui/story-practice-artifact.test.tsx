import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryPracticeArtifact, storyPracticeArtifactBlocks } from "./story-practice-artifact";

vi.mock("@/features/practice/shared/ui/practice-code-viewer", () => ({
  PracticeCodeViewer: ({ code, language }: { code: string; language: string }) => (
    <pre data-testid="code-viewer" data-language={language}>
      {code}
    </pre>
  )
}));

describe("storyPracticeArtifactBlocks", () => {
  it("splits prose and fenced code, keeping each block's language", () => {
    const blocks = storyPracticeArtifactBlocks(
      'Clients POST free-form JSON.\n\n```json\n{\n  "event": "add_to_cart"\n}\n```\n\nThere is no deduplication.'
    );

    expect(blocks).toEqual([
      { kind: "text", text: "Clients POST free-form JSON." },
      { kind: "code", language: "json", code: '{\n  "event": "add_to_cart"\n}' },
      { kind: "text", text: "There is no deduplication." }
    ]);
  });

  it("treats an unlabelled fence as plain text and leaves unfenced content alone", () => {
    expect(storyPracticeArtifactBlocks("```\n09:00 a\n09:05 b\n```")).toEqual([
      { kind: "code", language: "plaintext", code: "09:00 a\n09:05 b" }
    ]);
    expect(storyPracticeArtifactBlocks("Line one.\nLine two.")).toEqual([
      { kind: "text", text: "Line one.\nLine two." }
    ]);
  });

  it("keeps an unclosed fence as text instead of losing it", () => {
    expect(storyPracticeArtifactBlocks("Before\n```sql\nSELECT 1")).toEqual([
      { kind: "text", text: "Before\n```sql\nSELECT 1" }
    ]);
  });
});

describe("StoryPracticeArtifact", () => {
  it("renders each fenced block in the code viewer with its language", () => {
    render(
      <StoryPracticeArtifact
        artifact={{
          kind: "config",
          title: "Current daily revenue model",
          content:
            "```sql\nINSERT INTO daily_revenue SELECT 1;\n```\n\nRefunds are subtracted on the run day."
        }}
      />
    );

    const viewer = screen.getByTestId("code-viewer");
    expect(viewer).toHaveAttribute("data-language", "sql");
    expect(viewer).toHaveTextContent("INSERT INTO daily_revenue");
    expect(screen.getByText("Refunds are subtracted on the run day.")).toBeInTheDocument();
    expect(screen.getByText("current-daily-revenue-model.sql")).toBeInTheDocument();
  });

  it("keeps the line list for plain evidence", () => {
    render(
      <StoryPracticeArtifact
        artifact={{ kind: "metrics", title: "Brief", content: "First fact.\nSecond fact." }}
      />
    );

    expect(screen.queryByTestId("code-viewer")).toBeNull();
    expect(screen.getByText("Second fact.")).toBeInTheDocument();
  });
});
