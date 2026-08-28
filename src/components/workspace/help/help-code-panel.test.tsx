import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/interview/dsa/dsa-code-editor", () => ({
  DsaCodeEditor: ({
    language,
    value,
    readOnly,
    ariaLabel
  }: {
    language: string;
    value: string;
    readOnly?: boolean;
    ariaLabel?: string;
  }) => (
    <pre aria-label={ariaLabel} data-language={language} data-read-only={String(readOnly)}>
      {value}
    </pre>
  )
}));

import { HelpCodePanel } from "./help-code-panel";

describe("HelpCodePanel", () => {
  it("renders the candidate code through the themed editor in read-only mode", () => {
    render(
      <HelpCodePanel
        seat="helper"
        language="javascript"
        code=""
        onCodeChange={vi.fn()}
        onSelectionChange={vi.fn()}
        onRun={vi.fn()}
        running={false}
        snapshot={null}
        captured={{
          code: "class Main { return true; }",
          language: "java",
          testOutput: null,
          failingTests: null,
          selection: null
        }}
      />
    );

    const editor = screen.getByLabelText("Candidate code, read only");
    expect(editor).toHaveAttribute("data-read-only", "true");
    expect(editor).toHaveAttribute("data-language", "java");
    expect(editor).toHaveTextContent("class Main { return true; }");
  });
});
