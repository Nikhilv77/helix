import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HelperReadyToast } from "./helper-ready-toast";

describe("HelperReadyToast", () => {
  afterEach(cleanup);

  it("portals the centered join action and invokes it explicitly", () => {
    const onJoin = vi.fn();
    render(
      <HelperReadyToast
        title="Contains Duplicate"
        helper={{ label: "Asha Verma", headline: null, profileImage: null }}
        onJoin={onJoin}
      />
    );

    const button = screen.getByRole("button", { name: /join help room/i });
    const toast = button.closest("aside");
    expect(toast?.parentElement).toBe(document.body);
    expect(toast?.className).toContain("top-1/2");
    expect(screen.getByText(/Contains Duplicate/)).toBeTruthy();
    expect(screen.getByText("Meet Asha Verma")).toBeTruthy();
    expect(toast?.className).not.toContain("ring-");
    const backdrop = screen.getByTestId("helper-ready-backdrop");
    expect(backdrop.className).toContain("backdrop-blur-[5px]");
    expect(backdrop.className).toContain("bg-black/25");

    fireEvent.click(button);
    expect(onJoin).toHaveBeenCalledOnce();
  });
});
