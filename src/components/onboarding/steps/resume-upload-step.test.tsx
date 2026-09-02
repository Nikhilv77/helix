import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ResumeStep } from "./resume-upload-step";

describe("ResumeStep analysis recovery status", () => {
  it("shows the automatic retry message only during an analysis retry", () => {
    const { rerender } = renderStep(false);

    expect(screen.queryByText("TRYING RESUME ANALYSIS AGAIN...")).not.toBeInTheDocument();
    expect(screen.getByText("CHECKING DOCUMENT INTEGRITY...")).toBeInTheDocument();

    rerender(step(true));

    expect(screen.getByText("TRYING RESUME ANALYSIS AGAIN...")).toBeInTheDocument();
  });
});

function renderStep(retryingAnalysis: boolean) {
  return render(step(retryingAnalysis));
}

function step(retryingAnalysis: boolean) {
  return (
    <ResumeStep
      file={new File(["resume"], "candidate.pdf", { type: "application/pdf" })}
      dragging={false}
      error={null}
      inputRef={createRef<HTMLInputElement>()}
      uploading
      retryingAnalysis={retryingAnalysis}
      activeStage={0}
      onFile={() => undefined}
      onChooseAnother={() => undefined}
      onDragging={() => undefined}
      onBack={() => undefined}
    />
  );
}
