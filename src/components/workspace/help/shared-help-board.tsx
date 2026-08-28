"use client";

import { Eraser, Pencil, RotateCcw, StickyNote } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import * as Y from "yjs";

import type { HelpDataChannel } from "./help-call";
import { HELP_ROOM_PANEL_RULE, HELP_ROOM_PANEL_SHELL } from "./help-room-surface";

export const COLLABORATION_UPDATE_TOPIC = "help.collaboration.update.v1";
export const COLLABORATION_SYNC_TOPIC = "help.collaboration.sync.v1";

const REMOTE_ORIGIN = Symbol("remote-help-collaboration");
const SAVE_DELAY_MS = 1_500;
const ERASER_CURSOR = 'url("/cursors/eraser.svg") 8 25, crosshair';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  color: string;
  width: number;
  points: Point[];
}

export interface CollaborationMessage {
  payload: Uint8Array;
  topic: string;
  nonce: number;
}

export function SharedHelpBoard({
  requestId,
  channel,
  message,
  initialState
}: {
  requestId: string;
  channel: HelpDataChannel | null;
  message: CollaborationMessage | null;
  initialState: string | null;
}) {
  const [doc] = useState(() => new Y.Doc());
  const [notes, setNotes] = useState("");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [color, setColor] = useState("#f26e01");
  const canvas = useRef<HTMLCanvasElement>(null);
  const saveTimer = useRef<number | null>(null);
  const notesType = doc.getText("notes");
  const strokesType = doc.getArray<Stroke>("strokes");

  useEffect(() => {
    if (!initialState) return;
    try {
      Y.applyUpdate(doc, base64ToBytes(initialState), REMOTE_ORIGIN);
    } catch {
      // A corrupt persisted board is ignored; peer sync can still repair it.
    }
  }, [doc, initialState]);

  useEffect(() => {
    const refreshNotes = () => setNotes(notesType.toString());
    const refreshStrokes = () => setStrokes(strokesType.toArray());
    refreshNotes();
    refreshStrokes();
    notesType.observe(refreshNotes);
    strokesType.observe(refreshStrokes);
    return () => {
      notesType.unobserve(refreshNotes);
      strokesType.unobserve(refreshStrokes);
    };
  }, [notesType, strokesType]);

  useEffect(() => {
    if (!message) return;
    if (message.topic === COLLABORATION_UPDATE_TOPIC) {
      Y.applyUpdate(doc, message.payload, REMOTE_ORIGIN);
      return;
    }
    if (message.topic === COLLABORATION_SYNC_TOPIC && channel) {
      void channel.publish(Y.encodeStateAsUpdate(doc), COLLABORATION_UPDATE_TOPIC);
    }
  }, [channel, doc, message]);

  useEffect(() => {
    if (!channel) return;
    const sendUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      void channel.publish(update, COLLABORATION_UPDATE_TOPIC);
    };
    doc.on("update", sendUpdate);
    void channel.publish(new Uint8Array([1]), COLLABORATION_SYNC_TOPIC);
    void channel.publish(Y.encodeStateAsUpdate(doc), COLLABORATION_UPDATE_TOPIC);
    return () => doc.off("update", sendUpdate);
  }, [channel, doc]);

  useEffect(() => {
    const save = () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const state = bytesToBase64(Y.encodeStateAsUpdate(doc));
        void fetch(`/api/help/room/${encodeURIComponent(requestId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state })
        }).catch(() => undefined);
      }, SAVE_DELAY_MS);
    };
    doc.on("update", save);
    return () => {
      doc.off("update", save);
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [doc, requestId]);

  const drawCanvas = useCallback(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (element.width !== width || element.height !== height) {
      element.width = width;
      element.height = height;
    }
    const context = element.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of drawing ? [...strokes, drawing] : strokes) {
      if (stroke.points.length < 2) continue;
      context.beginPath();
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width * ratio;
      context.moveTo(stroke.points[0]!.x * width, stroke.points[0]!.y * height);
      for (const point of stroke.points.slice(1)) {
        context.lineTo(point.x * width, point.y * height);
      }
      context.stroke();
    }
  }, [drawing, strokes]);

  useEffect(() => {
    drawCanvas();
    const observer = new ResizeObserver(drawCanvas);
    if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [drawCanvas]);

  const updateNotes = (next: string) => {
    const previous = notesType.toString();
    let prefix = 0;
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) {
      prefix += 1;
    }
    let suffix = 0;
    while (
      suffix < previous.length - prefix &&
      suffix < next.length - prefix &&
      previous[previous.length - suffix - 1] === next[next.length - suffix - 1]
    ) {
      suffix += 1;
    }
    doc.transact(() => {
      const deleteCount = previous.length - prefix - suffix;
      if (deleteCount > 0) notesType.delete(prefix, deleteCount);
      const insertion = next.slice(prefix, next.length - suffix);
      if (insertion) notesType.insert(prefix, insertion);
    });
  };

  const pointFor = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(rect.width, 1))),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(rect.height, 1)))
    };
  };

  const beginStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "erase") {
      const point = pointFor(event);
      const index = nearestStrokeIndex(strokes, point);
      if (index >= 0) doc.transact(() => strokesType.delete(index, 1));
      return;
    }
    setDrawing({
      id: crypto.randomUUID(),
      color,
      width: 2.5,
      points: [pointFor(event)]
    });
  };

  const extendStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !(event.buttons & 1)) return;
    const point = pointFor(event);
    const previous = drawing.points.at(-1)!;
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.002) return;
    setDrawing((current) => (current ? { ...current, points: [...current.points, point] } : null));
  };

  const finishStroke = () => {
    if (!drawing) return;
    if (drawing.points.length > 1) strokesType.push([drawing]);
    setDrawing(null);
  };

  return (
    <aside
      className={`${HELP_ROOM_PANEL_SHELL} flex min-h-[42rem] min-w-0 flex-col overflow-hidden xl:h-full xl:min-h-0`}
    >
      <header className={`min-h-16 shrink-0 border-b ${HELP_ROOM_PANEL_RULE} px-4 py-3.5 sm:px-5`}>
        <p className="flex items-center gap-2.5 text-sm font-semibold text-cream">
          <StickyNote size={16} className="text-[var(--workspace-accent)]" aria-hidden="true" />
          Shared board
        </p>
        <p className="mt-1 text-xs text-cream/36">Both people can type and draw live.</p>
      </header>

      <section
        className={`shrink-0 border-b ${HELP_ROOM_PANEL_RULE} bg-black/10 px-3 py-3 sm:px-4`}
      >
        <label htmlFor="shared-help-notes" className="text-xs font-semibold text-cream/58">
          Notes
        </label>
        <textarea
          id="shared-help-notes"
          value={notes}
          onChange={(event) => updateNotes(event.target.value)}
          aria-label="Shared help notes"
          placeholder="Write an edge case or next step…"
          className="thin-scroll mt-2 h-24 w-full resize-none overflow-y-auto rounded-xl border-0 bg-black/20 px-3 py-2.5 text-xs leading-5 text-cream/74 outline-none ring-1 ring-inset ring-white/[0.045] transition placeholder:text-cream/24 focus:bg-black/30 focus:ring-white/[0.1]"
        />
      </section>

      <div
        className={`flex shrink-0 flex-wrap items-center gap-1.5 border-b ${HELP_ROOM_PANEL_RULE} px-3 py-2`}
      >
        <BoardTool active={tool === "draw"} label="Draw" onClick={() => setTool("draw")}>
          <Pencil size={13} />
        </BoardTool>
        <BoardTool active={tool === "erase"} label="Erase" onClick={() => setTool("erase")}>
          <Eraser size={13} />
        </BoardTool>
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          aria-label="Drawing color"
          className="ml-1 h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (strokesType.length > 0) strokesType.delete(strokesType.length - 1, 1);
          }}
          aria-label="Undo last stroke"
          className="grid h-8 w-8 place-items-center rounded-lg text-cream/38 transition hover:bg-cream/[0.06] hover:text-cream"
        >
          <RotateCcw size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (strokesType.length > 0) strokesType.delete(0, strokesType.length);
          }}
          className="h-8 rounded-lg px-2 text-[11px] text-cream/38 transition hover:bg-cream/[0.06] hover:text-cream"
        >
          Clear
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto bg-[#0a0c0f]">
        <canvas
          ref={canvas}
          aria-label="Shared drawing canvas"
          style={{ cursor: tool === "erase" ? ERASER_CURSOR : undefined }}
          onPointerDown={beginStroke}
          onPointerMove={extendStroke}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className={`block h-[44rem] min-h-full w-[42rem] min-w-full touch-none bg-[#0a0c0f] ${tool === "draw" ? "cursor-crosshair" : ""}`}
        />
      </div>
    </aside>
  );
}

function BoardTool({
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
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] transition ${
        active
          ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
          : "text-cream/40 hover:bg-cream/[0.05] hover:text-cream"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function nearestStrokeIndex(strokes: Stroke[], point: Point): number {
  let best = -1;
  let distance = 0.035;
  strokes.forEach((stroke, index) => {
    for (const candidate of stroke.points) {
      const next = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (next < distance) {
        distance = next;
        best = index;
      }
    }
  });
  return best;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return window.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
