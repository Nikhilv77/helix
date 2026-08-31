import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DsaNoteStroke } from "@/lib/dsa/dsa-note-drawing";
import { DsaNoteDrawingCanvas } from "./dsa-note-drawing-canvas";

const existingStroke: DsaNoteStroke = {
  id: "existing-stroke",
  color: "#f26e01",
  width: 3.5,
  opacity: 1,
  points: [
    { x: 0.2, y: 0.5, pressure: 0.5 },
    { x: 0.8, y: 0.5, pressure: 0.8 }
  ]
};

describe("DsaNoteDrawingCanvas", () => {
  beforeEach(() => {
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.stubGlobal("crypto", { randomUUID: () => "new-stroke" });
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
      restore: vi.fn(),
      lineCap: "round",
      lineJoin: "round",
      strokeStyle: "#000000",
      fillStyle: "#000000",
      globalAlpha: 1,
      lineWidth: 1
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("draws with the selected pen preset and color", () => {
    const onChange = vi.fn();
    render(<DsaNoteDrawingCanvas strokes={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Marker" }));
    fireEvent.click(screen.getByRole("button", { name: "Use purple ink" }));
    drawLine(screen.getByLabelText("Drawing notes canvas"));

    const strokes = onChange.mock.calls.at(-1)?.[0] as DsaNoteStroke[];
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toEqual(
      expect.objectContaining({
        id: "new-stroke",
        color: "#c084fc",
        width: 11,
        opacity: 0.28
      })
    );
    expect(strokes[0]!.points.length).toBeGreaterThan(1);
  });

  it("erases a stroke and restores it with undo", () => {
    const onChange = vi.fn();
    render(<DsaNoteDrawingCanvas strokes={[existingStroke]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
    const canvas = screen.getByLabelText("Drawing notes canvas");
    expect((canvas as HTMLCanvasElement).style.cursor).toContain("/cursors/eraser.svg");
    fireEvent.pointerDown(canvas, pointerAt(300, 200, 1));
    fireEvent.pointerUp(canvas, pointerAt(300, 200, 0));

    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Undo last drawing action" }));
    expect(onChange).toHaveBeenLastCalledWith([existingStroke]);
  });

  it("requires confirmation before clearing and makes clear undoable", () => {
    const onChange = vi.fn();
    render(<DsaNoteDrawingCanvas strokes={[existingStroke]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Undo last drawing action" }));
    expect(onChange).toHaveBeenLastCalledWith([existingStroke]);
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
