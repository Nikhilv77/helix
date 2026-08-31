import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DsaQuestionNotes } from "./dsa-question-notes";

describe("DsaQuestionNotes", () => {
  beforeEach(() => {
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.stubGlobal("crypto", { randomUUID: () => "saved-stroke" });
    Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 600,
      height: 400,
      left: 0,
      top: 0,
      right: 600,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn()
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows one sketchbook surface and saves strokes across pages with the bottom note", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { content: "Hash set idea", drawing: null }
        })
      })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<DsaQuestionNotes slug="contains-duplicate" />);
    expect(await screen.findByDisplayValue("Hash set idea")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();

    drawLine(screen.getByLabelText("Drawing notes canvas"));
    fireEvent.click(screen.getByRole("button", { name: "New page" }));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    drawLine(screen.getByLabelText("Drawing notes canvas"));
    fireEvent.click(screen.getByRole("button", { name: "Previous drawing page" }));
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save now" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.content).toBe("Hash set idea");
    expect(body.drawing).toEqual(
      expect.objectContaining({
        version: 2,
        pages: [
          expect.objectContaining({
            strokes: [expect.objectContaining({ id: "saved-stroke", points: expect.any(Array) })]
          }),
          expect.objectContaining({
            strokes: [expect.objectContaining({ id: "saved-stroke", points: expect.any(Array) })]
          })
        ]
      })
    );
  });

  it("automatically saves after drawing stops", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: { content: "", drawing: null } })
      })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<DsaQuestionNotes slug="contains-duplicate" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      drawLine(screen.getByLabelText("Drawing notes canvas"));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "PUT" }));
  });
});

function drawLine(canvas: HTMLElement): void {
  fireEvent.pointerDown(canvas, pointerAt(120, 100, 1));
  fireEvent.pointerMove(canvas, pointerAt(240, 180, 1));
  fireEvent.pointerUp(canvas, pointerAt(240, 180, 0));
}

function pointerAt(clientX: number, clientY: number, buttons: number) {
  return {
    pointerId: 1,
    pointerType: "pen",
    button: 0,
    buttons,
    clientX,
    clientY,
    pressure: 0.7,
    width: 2,
    height: 2
  };
}

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly pressure: number;
  readonly width: number;
  readonly height: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
    this.pressure = init.pressure ?? 0;
    this.width = init.width ?? 1;
    this.height = init.height ?? 1;
  }

  getCoalescedEvents(): PointerEvent[] {
    return [this as unknown as PointerEvent];
  }
}
