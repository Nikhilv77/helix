import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InteractiveAnswerInput } from "./interactive-answer-input";
import { emptyInteractiveResponse, type PracticeInteraction } from "../domain/interactive-response";

function Harness({
  interaction,
  disabled = false
}: {
  interaction: PracticeInteraction;
  disabled?: boolean;
}) {
  const [response, setResponse] = useState(() => emptyInteractiveResponse(interaction));
  return (
    <InteractiveAnswerInput
      interaction={interaction}
      response={response}
      onChange={setResponse}
      disabled={disabled}
    />
  );
}

describe("shared interactive answer controls", () => {
  it("adds, reorders and removes steps with ordinary accessible buttons", () => {
    render(
      <Harness
        interaction={{
          type: "sequence",
          instruction: "Choose an order",
          items: [
            { id: "verify", label: "Verify recovery" },
            { id: "contain", label: "Contain harm" }
          ]
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Verify recovery" }));
    fireEvent.click(screen.getByRole("button", { name: "Contain harm" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Contain harm earlier" }));
    const steps = within(screen.getByRole("list", { name: "Your response sequence" })).getAllByRole(
      "listitem"
    );
    expect(steps[0]).toHaveTextContent("Contain harm");
    expect(steps[1]).toHaveTextContent("Verify recovery");
    expect(screen.getByRole("button", { name: "Move Contain harm earlier" })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    fireEvent.click(screen.getByRole("button", { name: "Remove Verify recovery" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("button", { name: "Verify recovery" })).toBeInTheDocument();
  });

  it("supports independently assigning evidence and clearing an assignment", () => {
    render(
      <Harness
        interaction={{
          type: "classification",
          instruction: "Connect signals",
          items: [
            { id: "a", label: "Missing source" },
            { id: "b", label: "Stale result" }
          ],
          categories: [
            { id: "index", label: "Index" },
            { id: "cache", label: "Cache" }
          ]
        }}
      />
    );
    fireEvent.change(screen.getByRole("combobox", { name: /Missing source/ }), {
      target: { value: "index" }
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Stale result/ }), {
      target: { value: "cache" }
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    fireEvent.change(screen.getByRole("combobox", { name: /Stale result/ }), {
      target: { value: "" }
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("locks controls when an answer is terminal", () => {
    render(
      <Harness
        disabled
        interaction={{
          type: "configuration",
          instruction: "Choose a limit",
          fields: [{ id: "limit", label: "Batch limit", unit: "requests", min: 1, max: 8, step: 1 }]
        }}
      />
    );
    expect(screen.getByRole("spinbutton", { name: /Batch limit/ })).toBeDisabled();
  });
});
