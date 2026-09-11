import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh })
}));

import { CoreTechnicalPreparation } from "./core-technical-preparation";

describe("CoreTechnicalPreparation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    window.sessionStorage.clear();
  });

  it("blocks a replayed click while confirmation and preparation are pending", async () => {
    let resolveConfirm!: (response: Response) => void;
    const confirmation = new Promise<Response>((resolve) => {
      resolveConfirm = resolve;
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => confirmation)
      .mockResolvedValueOnce(success({ block: { id: "block-one" } }));

    renderPreparation();
    const launch = screen.getByRole("button", { name: /Build my first practice path/i });
    fireEvent.click(launch);
    fireEvent.click(launch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Personalising/i })).toBeDisabled();

    resolveConfirm(success({ focus: { id: "11111111-1111-4111-8111-111111111111" } }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/practice/core-technical"));
  });

  it("reuses the same preparation request ID after a recoverable failure", async () => {
    const prepareBodies: Array<{ requestId: string }> = [];
    let prepareCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/confirm")) {
        return success({ focus: { id: "11111111-1111-4111-8111-111111111111" } });
      }
      if (url.endsWith("/prepare")) {
        prepareBodies.push(JSON.parse(String(init?.body)) as { requestId: string });
        prepareCount += 1;
        if (prepareCount === 1) {
          return failure(
            "We could not prepare the complete practice path. Nothing partial was saved; try again."
          );
        }
        return success({ block: { id: "block-one" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderPreparation();
    fireEvent.click(screen.getByRole("button", { name: /Build my first practice path/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing partial was saved");

    fireEvent.click(screen.getByRole("button", { name: /Build my first practice path/i }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/practice/core-technical"));
    expect(prepareBodies).toHaveLength(2);
    expect(prepareBodies[0]?.requestId).toBe(prepareBodies[1]?.requestId);
  });

  it("shows one supported technology choice and sends only that explicit selection", async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return bodies.length === 1
        ? success({ focus: { id: "11111111-1111-4111-8111-111111111111" } })
        : success({ block: { id: "block-one" } });
    });

    renderPreparation();
    const dialog = screen.getByRole("dialog", { name: /what technology/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(/We’ll use your saved resume/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Your choice is saved/i)).not.toBeInTheDocument();
    const selector = screen.getByRole("button", { name: /Practice technology JavaScript/i });
    fireEvent.click(selector);
    expect(screen.getByRole("option", { name: "JavaScript" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: /Build my first practice path/i }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0]).toEqual({ technology: "javascript" });
    expect(bodies[1]).toMatchObject({ personalized: true });
  });
});

function renderPreparation() {
  return render(<CoreTechnicalPreparation />);
}

function success(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function failure(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: { message } }), {
    status: 503,
    headers: { "content-type": "application/json" }
  });
}
