import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchitectureDesignTechnologyWelcome } from "./architecture-design-technology-welcome";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: () => <div data-testid="teacher" />
}));
vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: vi.fn(),
    stop: vi.fn(),
    awaitingGesture: true,
    setAwaitingGesture: vi.fn()
  })
}));

describe("ArchitectureDesignTechnologyWelcome", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("prepares the only role-aligned path without asking the user to select it", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { focus: { id: "focus-1" } } })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", fetch);

    render(<ArchitectureDesignTechnologyWelcome />);

    expect(screen.getByRole("heading")).toHaveTextContent("Preparing your personalised practice path.");
    expect(screen.queryByRole("button", { name: /Role-aligned system design/i })).toBeNull();

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/practice/architecture-design");
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/practice/architecture-design/confirm",
      expect.objectContaining({ body: JSON.stringify({ path: "role-aligned" }) })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/practice/architecture-design/prepare",
      expect.objectContaining({
        body: expect.stringContaining('"focusRevisionId":"focus-1"')
      })
    );
  });
});
