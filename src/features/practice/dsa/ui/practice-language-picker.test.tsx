import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PracticeLanguagePicker, type PracticeLanguageOption } from "./practice-language-picker";

const options: PracticeLanguageOption[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" }
];

describe("PracticeLanguagePicker", () => {
  afterEach(cleanup);

  it("uses the themed listbox instead of a native select", () => {
    const onChange = vi.fn();
    render(<PracticeLanguagePicker value="javascript" options={options} onChange={onChange} />);

    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Programming language: JavaScript" }));

    expect(screen.getByRole("listbox", { name: "Programming languages" })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "Python" }));

    expect(onChange).toHaveBeenCalledWith("python");
    expect(screen.queryByRole("listbox", { name: "Programming languages" })).toBeNull();
  });

  it("opens and moves through options from the keyboard", async () => {
    render(<PracticeLanguagePicker value="javascript" options={options} onChange={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole("button", { name: "Programming language: JavaScript" }), {
      key: "ArrowDown"
    });

    await waitFor(() => expect(screen.getByRole("option", { name: "Python" })).toHaveFocus());
  });
});
