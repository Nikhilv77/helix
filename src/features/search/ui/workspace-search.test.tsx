import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSearchResult } from "@/features/search/contracts/workspace-search";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchWorkspace: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/practice",
  useRouter: () => ({ push: mocks.push })
}));

vi.mock("./workspace-search-client", () => ({
  searchWorkspace: mocks.searchWorkspace
}));

import { WorkspaceSearch } from "./workspace-search";

const results: WorkspaceSearchResult[] = [
  {
    id: "page:reports",
    kind: "page",
    group: "Pages",
    title: "Reports",
    description: "Review interview evidence.",
    href: "/reports",
    badge: null,
    score: 8
  },
  {
    id: "page:practice",
    kind: "practice",
    group: "Practice",
    title: "Practice",
    description: "Continue your practice plan.",
    href: "/practice",
    badge: "42% complete",
    score: 6
  }
];

describe("WorkspaceSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.push.mockReset();
    mocks.searchWorkspace.mockReset();
    mocks.searchWorkspace.mockResolvedValue({ query: "reports", results });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("debounces a normalized query and groups the returned results", async () => {
    render(<WorkspaceSearch />);

    fireEvent.change(screen.getByRole("combobox", { name: "Search workspace" }), {
      target: { value: "  RePoRtS  " }
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(179);
    });
    expect(mocks.searchWorkspace).not.toHaveBeenCalled();

    await settleSearch();

    expect(mocks.searchWorkspace).toHaveBeenCalledWith("reports", expect.any(AbortSignal));
    expect(screen.getByRole("listbox", { name: "Workspace search results" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Practice" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Pages" })).toBeVisible();
    expect(screen.getByRole("option", { name: /Reports/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("supports keyboard selection without changing the link contract", async () => {
    render(<WorkspaceSearch />);
    const input = screen.getByRole("combobox", { name: "Search workspace" });

    fireEvent.change(input, { target: { value: "practice" } });
    await settleSearch();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mocks.push).toHaveBeenCalledWith("/practice");
    expect(input).toHaveValue("");
  });

  it("keeps a failed search operable and explains the degraded state", async () => {
    mocks.searchWorkspace.mockRejectedValue(new Error("search unavailable"));
    render(<WorkspaceSearch mobile />);

    fireEvent.change(screen.getByRole("combobox", { name: "Search workspace" }), {
      target: { value: "arrays" }
    });
    await settleSearch();

    expect(screen.getByText("Search is unavailable right now.")).toBeVisible();
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-controls",
      "workspace-search-results-mobile"
    );
  });
});

async function settleSearch() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(180);
  });
}
