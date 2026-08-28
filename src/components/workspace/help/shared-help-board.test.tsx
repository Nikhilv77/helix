import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COLLABORATION_UPDATE_TOPIC, SharedHelpBoard } from "./shared-help-board";

describe("SharedHelpBoard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      lineCap: "round",
      lineJoin: "round",
      strokeStyle: "#000",
      lineWidth: 1
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("publishes collaborative typing and persists the Yjs document", async () => {
    vi.useFakeTimers();
    const publish = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SharedHelpBoard
        requestId="00000000-0000-4000-8000-000000000001"
        channel={{ publish }}
        message={null}
        initialState={null}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Shared help notes" }), {
      target: { value: "Try a hash set first." }
    });

    expect(publish).toHaveBeenCalledWith(expect.any(Uint8Array), COLLABORATION_UPDATE_TOPIC);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/help/room/00000000-0000-4000-8000-000000000001",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("uses an eraser-shaped cursor when the erase tool is selected", () => {
    render(
      <SharedHelpBoard
        requestId="00000000-0000-4000-8000-000000000001"
        channel={null}
        message={null}
        initialState={null}
      />
    );

    const canvas = screen.getByLabelText("Shared drawing canvas");
    expect(canvas.style.cursor).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Erase" }));

    expect(canvas.style.cursor).toContain("/cursors/eraser.svg");
    expect(canvas.style.cursor).not.toBe("cell");
  });
});
