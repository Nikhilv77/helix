import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_SYSTEM_DESIGN_CANVAS } from "@/features/interviews/domain/system-design-canvas";
import { SystemDesignCanvas } from "./system-design-canvas";

describe("SystemDesignCanvas", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("lets the candidate add, label, connect, and remove architecture nodes", () => {
    render(<SystemDesignCanvas />);

    fireEvent.click(screen.getByRole("button", { name: "Service" }));
    fireEvent.change(screen.getByLabelText("service label"), {
      target: { value: "Upload API" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    fireEvent.click(screen.getByLabelText("queue label").parentElement!);

    expect(screen.getByLabelText("service label")).toHaveValue("Upload API");
    expect(screen.getByLabelText("queue label")).toHaveValue("Queue / stream");
    expect(
      screen.getByRole("button", { name: "Connection Upload API to Queue / stream" })
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    expect(screen.getByLabelText("service label")).toHaveValue("Upload API");
    expect(screen.queryByLabelText("queue label")).toBeNull();
  });

  it("provides a scratchpad for discovered requirements and estimates", () => {
    render(<SystemDesignCanvas />);
    const notes = screen.getByPlaceholderText(/record clarified requirements/i);
    fireEvent.change(notes, { target: { value: "25M uploads/day; resumable up to 20 GiB" } });
    expect(notes).toHaveValue("25M uploads/day; resumable up to 20 GiB");
  });

  it("supports richer components, labeled flows, undo, and redo", () => {
    render(<SystemDesignCanvas />);

    fireEvent.click(screen.getByRole("button", { name: "Client" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Add component" }), {
      target: { value: "cache" }
    });
    expect(screen.getByLabelText("cache label")).toHaveValue("Cache");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByLabelText("cache label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByLabelText("cache label")).toHaveValue("Cache");
  });

  it("restores the diagram and interview notes for the same session", async () => {
    const first = render(<SystemDesignCanvas storageKey="session-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Service" }));
    fireEvent.change(screen.getByLabelText("service label"), {
      target: { value: "Upload API" }
    });
    fireEvent.change(screen.getByPlaceholderText(/record clarified requirements/i), {
      target: { value: "99.9% availability" }
    });

    await waitFor(() =>
      expect(window.localStorage.getItem("trailgrad:system-design-canvas:session-123")).toContain(
        "Upload API"
      )
    );
    first.unmount();
    render(<SystemDesignCanvas storageKey="session-123" />);

    expect(await screen.findByLabelText("service label")).toHaveValue("Upload API");
    expect(screen.getByPlaceholderText(/record clarified requirements/i)).toHaveValue(
      "99.9% availability"
    );
  });

  it("loads the server revision and autosaves with optimistic concurrency", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const serverDocument = {
      ...EMPTY_SYSTEM_DESIGN_CANVAS,
      nodes: [
        {
          id: "design-node-8",
          kind: "service" as const,
          label: "Server API",
          detail: "stateless",
          x: 40,
          y: 40
        }
      ]
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { document: serverDocument, revision: 7, updatedAt: 1 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            success: true,
            data: { document: body.document, revision: 8, updatedAt: 2 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      });

    render(<SystemDesignCanvas storageKey={sessionId} sessionId={sessionId} />);
    expect(await screen.findByDisplayValue("Server API")).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText(/record clarified requirements/i), {
      target: { value: "Cross-region failover" }
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    const saveRequest = fetchMock.mock.calls[1]?.[1];
    expect(JSON.parse(String(saveRequest?.body))).toMatchObject({
      expectedRevision: 7,
      document: { notes: "Cross-region failover" }
    });
    expect(await screen.findByText("Saved")).toBeVisible();
  });
});
