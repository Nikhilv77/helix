"use client";

import { Eraser, Highlighter, PenLine, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  MAX_DSA_NOTE_POINTS,
  MAX_DSA_NOTE_POINTS_PER_STROKE,
  MAX_DSA_NOTE_STROKES,
  type DsaNotePoint,
  type DsaNoteStroke
} from "@/lib/dsa/dsa-note-drawing";

const ERASER_CURSOR = 'url("/cursors/eraser.svg") 8 25, crosshair';

const BRUSHES = {
  fine: { label: "Fine", width: 1.5, opacity: 1 },
  pen: { label: "Pen", width: 3.5, opacity: 1 },
  marker: { label: "Marker", width: 11, opacity: 0.28 }
} as const;

const COLORS = ["#f4eedf", "#f26e01", "#41d6a3", "#60a5fa", "#c084fc", "#fb7185"];

type Brush = keyof typeof BRUSHES;
type Tool = Brush | "eraser";

export function DsaNoteDrawingCanvas({
  strokes,
  onChange,
  disabled = false,
  maxStrokes = MAX_DSA_NOTE_STROKES,
  maxPoints = MAX_DSA_NOTE_POINTS
}: {
  strokes: DsaNoteStroke[];
  onChange: (strokes: DsaNoteStroke[]) => void;
  disabled?: boolean;
  maxStrokes?: number;
  maxPoints?: number;
}) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[1]!);
  const [drawing, setDrawing] = useState<DsaNoteStroke | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const drawingRef = useRef<DsaNoteStroke | null>(null);
  const undoStack = useRef<DsaNoteStroke[][]>([]);
  const eraserStart = useRef<DsaNoteStroke[] | null>(null);
  const eraserChanged = useRef(false);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const replaceStrokes = useCallback(
    (next: DsaNoteStroke[]) => {
      strokesRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  const remember = useCallback((snapshot: DsaNoteStroke[]) => {
    undoStack.current = [...undoStack.current.slice(-39), snapshot];
    setUndoDepth(undoStack.current.length);
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (const stroke of drawing ? [...strokes, drawing] : strokes) {
      paintStroke(context, stroke, width, height, ratio);
    }
  }, [drawing, strokes]);

  useEffect(() => {
    drawCanvas();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(drawCanvas);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [drawCanvas]);

  const pointFor = (
    element: HTMLCanvasElement,
    clientX: number,
    clientY: number,
    pressure: number,
    pointerType: string
  ): DsaNotePoint => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1))),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(rect.height, 1))),
      pressure: pointerType === "pen" ? Math.min(1, Math.max(0.05, pressure || 0.5)) : 0.65
    };
  };

  const eraseAt = (point: DsaNotePoint) => {
    const current = strokesRef.current;
    const index = nearestStrokeIndex(current, point);
    if (index < 0) return;
    eraserChanged.current = true;
    replaceStrokes(current.filter((_, strokeIndex) => strokeIndex !== index));
  };

  const beginStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || isLikelyPalm(event)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFor(
      event.currentTarget,
      event.clientX,
      event.clientY,
      event.pressure,
      event.pointerType
    );

    if (tool === "eraser") {
      eraserStart.current = strokesRef.current;
      eraserChanged.current = false;
      eraseAt(point);
      return;
    }

    if (strokesRef.current.length >= maxStrokes || totalPoints(strokesRef.current) >= maxPoints) {
      return;
    }
    const brush = BRUSHES[tool];
    const next: DsaNoteStroke = {
      id: crypto.randomUUID(),
      color,
      width: brush.width,
      opacity: brush.opacity,
      points: [point]
    };
    drawingRef.current = next;
    setDrawing(next);
  };

  const extendStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || !(event.buttons & 1) || isLikelyPalm(event)) return;
    if (tool === "eraser") {
      eraseAt(
        pointFor(
          event.currentTarget,
          event.clientX,
          event.clientY,
          event.pressure,
          event.pointerType
        )
      );
      return;
    }

    const current = drawingRef.current;
    const maximumPoints = Math.min(
      MAX_DSA_NOTE_POINTS_PER_STROKE,
      maxPoints - totalPoints(strokesRef.current)
    );
    if (!current || current.points.length >= maximumPoints) return;
    const nativeEvent = event.nativeEvent;
    const samples =
      typeof nativeEvent.getCoalescedEvents === "function"
        ? nativeEvent.getCoalescedEvents()
        : [nativeEvent];
    const additions: DsaNotePoint[] = [];
    let previous = current.points.at(-1)!;
    for (const sample of samples) {
      const point = pointFor(
        event.currentTarget,
        sample.clientX,
        sample.clientY,
        sample.pressure,
        sample.pointerType
      );
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0008) continue;
      additions.push(point);
      previous = point;
      if (current.points.length + additions.length >= maximumPoints) break;
    }
    if (additions.length === 0) return;
    const next = { ...current, points: [...current.points, ...additions] };
    drawingRef.current = next;
    setDrawing(next);
  };

  const finishStroke = () => {
    if (tool === "eraser") {
      if (eraserChanged.current && eraserStart.current) remember(eraserStart.current);
      eraserStart.current = null;
      eraserChanged.current = false;
      return;
    }

    const completed = drawingRef.current;
    if (!completed) return;
    remember(strokesRef.current);
    replaceStrokes([...strokesRef.current, completed]);
    drawingRef.current = null;
    setDrawing(null);
  };

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    replaceStrokes(previous);
    setUndoDepth(undoStack.current.length);
    setConfirmClear(false);
  };

  const clear = () => {
    if (strokesRef.current.length === 0) return;
    remember(strokesRef.current);
    replaceStrokes([]);
    setConfirmClear(false);
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl bg-[#0b0d10] ring-1 ring-inset ring-white/[0.065]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.065] bg-white/[0.018] px-2.5 py-2">
        <DrawingTool active={tool === "fine"} label="Fine" onClick={() => setTool("fine")}>
          <Pencil size={13} aria-hidden="true" />
        </DrawingTool>
        <DrawingTool active={tool === "pen"} label="Pen" onClick={() => setTool("pen")}>
          <PenLine size={13} aria-hidden="true" />
        </DrawingTool>
        <DrawingTool active={tool === "marker"} label="Marker" onClick={() => setTool("marker")}>
          <Highlighter size={13} aria-hidden="true" />
        </DrawingTool>
        <DrawingTool active={tool === "eraser"} label="Eraser" onClick={() => setTool("eraser")}>
          <Eraser size={13} aria-hidden="true" />
        </DrawingTool>

        <div className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:block" />
        <div className="flex items-center gap-1" aria-label="Pen colors" role="group">
          {COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setColor(option);
                if (tool === "eraser") setTool("pen");
              }}
              aria-label={`Use ${colorName(option)} ink`}
              aria-pressed={color === option}
              className={`grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/[0.06] ${
                color === option ? "bg-white/[0.08]" : ""
              }`}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full ${
                  color === option ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[#111316]" : ""
                }`}
                style={{ backgroundColor: option }}
              />
            </button>
          ))}
        </div>

        <span className="min-w-1 flex-1" />
        <button
          type="button"
          onClick={undo}
          disabled={disabled || undoDepth === 0}
          aria-label="Undo last drawing action"
          title="Undo"
          className="grid h-8 w-8 place-items-center rounded-lg text-cream/44 transition hover:bg-white/[0.055] hover:text-cream disabled:pointer-events-none disabled:opacity-25"
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>

        {confirmClear ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-cream/48 transition hover:bg-white/[0.055] hover:text-cream"
            >
              <X size={12} aria-hidden="true" /> Cancel
            </button>
            <button
              type="button"
              onClick={clear}
              className="h-8 rounded-lg bg-[#eb6a64]/12 px-2.5 text-[11.5px] font-semibold text-[#f29a95] transition hover:bg-[#eb6a64]/20"
            >
              Clear all
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={disabled || strokes.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium text-cream/42 transition hover:bg-white/[0.055] hover:text-cream disabled:pointer-events-none disabled:opacity-25"
          >
            <Trash2 size={13} aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      <div className="relative min-h-[38rem] bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:24px_24px] sm:min-h-[44rem]">
        {strokes.length === 0 && !drawing ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <PenLine
                size={19}
                aria-hidden="true"
                className="mx-auto text-[var(--workspace-accent)] opacity-65"
              />
              <p className="mt-2 text-[12.5px] font-medium text-cream/34">
                Sketch the approach, pointers, trees, or graphs.
              </p>
              <p className="mt-1 text-[11px] text-cream/22">Stylus pressure is supported.</p>
            </div>
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          aria-label="Drawing notes canvas"
          onPointerDown={beginStroke}
          onPointerMove={extendStroke}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          style={{ cursor: tool === "eraser" ? ERASER_CURSOR : undefined }}
          className={`block h-[38rem] w-full touch-none sm:h-[44rem] ${
            disabled
              ? "pointer-events-none opacity-50"
              : tool === "eraser"
                ? ""
                : "cursor-crosshair"
          }`}
        />
      </div>
    </div>
  );
}

function DrawingTool({
  active,
  label,
  onClick,
  children
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium transition ${
        active
          ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
          : "text-cream/44 hover:bg-white/[0.05] hover:text-cream"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function paintStroke(
  context: CanvasRenderingContext2D,
  stroke: DsaNoteStroke,
  width: number,
  height: number,
  ratio: number
): void {
  const first = stroke.points[0];
  if (!first) return;
  context.save();
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.globalAlpha = stroke.opacity;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(
      first.x * width,
      first.y * height,
      (stroke.width * pressureScale(first.pressure) * ratio) / 2,
      0,
      Math.PI * 2
    );
    context.fill();
    context.restore();
    return;
  }

  if (stroke.opacity < 1) {
    context.beginPath();
    context.lineWidth = stroke.width * ratio;
    context.moveTo(first.x * width, first.y * height);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    context.stroke();
    context.restore();
    return;
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    const previous = stroke.points[index - 1]!;
    const point = stroke.points[index]!;
    context.beginPath();
    context.lineWidth =
      stroke.width * pressureScale((previous.pressure + point.pressure) / 2) * ratio;
    context.moveTo(previous.x * width, previous.y * height);
    context.lineTo(point.x * width, point.y * height);
    context.stroke();
  }
  context.restore();
}

function pressureScale(pressure: number): number {
  return 0.55 + pressure * 0.65;
}

function isLikelyPalm(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
  return event.pointerType === "touch" && (event.width > 28 || event.height > 28);
}

function nearestStrokeIndex(strokes: DsaNoteStroke[], point: DsaNotePoint): number {
  let best = -1;
  let bestDistance = 0.035;
  strokes.forEach((stroke, index) => {
    if (stroke.points.length === 1) {
      const candidate = stroke.points[0]!;
      const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
      return;
    }
    for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
      const distance = distanceToSegment(
        point,
        stroke.points[pointIndex - 1]!,
        stroke.points[pointIndex]!
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
  });
  return best;
}

function distanceToSegment(point: DsaNotePoint, start: DsaNotePoint, end: DsaNotePoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return Math.hypot(point.x - (start.x + progress * dx), point.y - (start.y + progress * dy));
}

function totalPoints(strokes: DsaNoteStroke[]): number {
  return strokes.reduce((total, stroke) => total + stroke.points.length, 0);
}

function colorName(color: string): string {
  return (
    {
      "#f4eedf": "cream",
      "#f26e01": "orange",
      "#41d6a3": "green",
      "#60a5fa": "blue",
      "#c084fc": "purple",
      "#fb7185": "rose"
    }[color] ?? color
  );
}
