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

  it("loads and saves practice diagrams through the block API without browser storage", async () => {
    const blockId = "11111111-1111-4111-8111-111111111111";
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (!init?.method) {
        return Response.json({
          success: true,
          data: { document: EMPTY_SYSTEM_DESIGN_CANVAS, revision: 0, updatedAt: 0 }
        });
      }
      const body = JSON.parse(String(init.body));
      return Response.json({
        success: true,
        data: { document: body.document, revision: 1, updatedAt: 1 }
      });
    });

    render(<SystemDesignCanvas practiceBlockId={blockId} embedded />);
    await screen.findByText("Saved");
    fireEvent.click(screen.getByRole("button", { name: "Service" }));
    fireEvent.change(screen.getByLabelText("service label"), {
      target: { value: "Authorized retriever" }
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/practice/architecture-design/canvas/${blockId}`
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      expectedRevision: 0,
      document: { nodes: [expect.objectContaining({ label: "Authorized retriever" })] }
    });
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it("does not overwrite a practice diagram when the initial database load fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    render(<SystemDesignCanvas practiceBlockId="11111111-1111-4111-8111-111111111111" embedded />);
    await screen.findByRole("button", { name: "Retry sync" });
    expect(screen.getByRole("status")).toHaveTextContent("Not saved");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
  });
});
