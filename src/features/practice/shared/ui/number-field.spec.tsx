import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NumberField, snap } from "./number-field";

function Harness({
  initial,
  min = 0,
  max = 1,
  step = 0.1
}: {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <>
      <NumberField
        label="Decision threshold"
        unit="score"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={setValue}
      />
      <output data-testid="value">{value === undefined ? "empty" : String(value)}</output>
    </>
  );
}

const stored = () => screen.getByTestId("value").textContent;

describe("NumberField", () => {
  it("steps in exact increments without float noise and stops at the range", () => {
    render(<Harness initial={0.1} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase Decision threshold" }));
    expect(stored()).toBe("0.2");

    fireEvent.click(screen.getByRole("button", { name: "Decrease Decision threshold" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease Decision threshold" }));
    expect(stored()).toBe("0");
    expect(screen.getByRole("button", { name: "Decrease Decision threshold" })).toBeDisabled();
  });

  it("lets the learner type freely, then snaps to the range and step on blur", () => {
    render(<Harness min={0} max={1000} step={1} />);
    const field = screen.getByRole("spinbutton", { name: /Decision threshold/ });

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "1450.6" } });
    fireEvent.blur(field);

    expect(stored()).toBe("1000");
    expect(field).toHaveValue("1000");
  });

  it("supports arrow keys, the slider, and clearing", () => {
    render(<Harness initial={0.5} />);
    const field = screen.getByRole("spinbutton", { name: /Decision threshold/ });

    fireEvent.keyDown(field, { key: "ArrowUp" });
    expect(stored()).toBe("0.6");

    fireEvent.change(document.querySelector('input[type="range"]')!, { target: { value: "0.3" } });
    expect(stored()).toBe("0.3");

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(stored()).toBe("empty");
  });
});

describe("snap", () => {
  it("clamps and rounds to the step's precision", () => {
    expect(snap(0.1 + 0.2, 0, 1, 0.1)).toBe(0.3);
    expect(snap(-5, 0, 100, 1)).toBe(0);
    expect(snap(47.6, 0, 100, 5)).toBe(50);
  });
});
