import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    const choose = (evidence: RegExp, option: string) => {
      fireEvent.click(screen.getByRole("button", { name: evidence }));
      fireEvent.click(screen.getByRole("option", { name: option }));
    };
    choose(/Missing source/, "Index");
    choose(/Stale result/, "Cache");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    // The trigger shows the choice and the evidence it belongs to.
    expect(screen.getByRole("button", { name: /Stale result.*Cache/ })).toHaveAttribute(
      "aria-haspopup",
      "listbox"
    );
    choose(/Stale result/, "Clear choice");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(
      screen.getByRole("button", { name: /Stale result.*Choose a category/ })
    ).toBeInTheDocument();
  });

  it("opens the category menu from the keyboard and closes it with Escape", () => {
    render(
      <Harness
        interaction={{
          type: "classification",
          instruction: "Connect signals",
          items: [{ id: "a", label: "Missing source" }],
          categories: [
            { id: "index", label: "Index" },
            { id: "cache", label: "Cache" }
          ]
        }}
      />
    );
    const trigger = screen.getByRole("button", { name: /Missing source/ });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
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

  describe("smooth reordering", () => {
    const sequence: PracticeInteraction = {
      type: "sequence",
      instruction: "Choose an order",
      items: [
        { id: "verify", label: "Verify recovery" },
        { id: "contain", label: "Contain harm" }
      ]
    };
    const originalRect = Element.prototype.getBoundingClientRect;

    afterEach(() => {
      Element.prototype.getBoundingClientRect = originalRect;
      delete (Element.prototype as { animate?: unknown }).animate;
      vi.unstubAllGlobals();
    });

    function withLayout(reducedMotion: boolean) {
      // jsdom has no layout: place each element by its position in its list.
      Element.prototype.getBoundingClientRect = function (this: Element) {
        const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0;
        return { top: index * 100 } as DOMRect;
      };
      const animate = vi.fn();
      (Element.prototype as { animate?: unknown }).animate = animate;
      vi.stubGlobal("matchMedia", () => ({ matches: reducedMotion }));
      return animate;
    }

    it("glides both swapped steps from their old positions", () => {
      const animate = withLayout(false);
      render(<Harness interaction={sequence} />);
      fireEvent.click(screen.getByRole("button", { name: "Verify recovery" }));
      fireEvent.click(screen.getByRole("button", { name: "Contain harm" }));
      animate.mockClear();

      fireEvent.click(screen.getByRole("button", { name: "Move Contain harm earlier" }));

      const offsets = animate.mock.calls.map(
        ([frames]) => (frames as Array<{ transform?: string }>)[0]!.transform
      );
      expect(offsets).toEqual(expect.arrayContaining(["translateY(100px)", "translateY(-100px)"]));
    });

    it("moves instantly when the learner prefers reduced motion", () => {
      const animate = withLayout(true);
      render(<Harness interaction={sequence} />);
      fireEvent.click(screen.getByRole("button", { name: "Verify recovery" }));
      fireEvent.click(screen.getByRole("button", { name: "Contain harm" }));
      fireEvent.click(screen.getByRole("button", { name: "Move Contain harm earlier" }));

      expect(animate).not.toHaveBeenCalled();
    });
  });
});
