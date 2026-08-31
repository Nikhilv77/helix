"use client";

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquareText,
  NotebookPen,
  Plus,
  Save
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyDsaNoteDrawing,
  MAX_DSA_NOTE_PAGES,
  MAX_DSA_NOTE_POINTS,
  MAX_DSA_NOTE_STROKES,
  normalizeDsaNoteDrawing,
  type DsaNoteDrawing,
  type DsaNoteStroke
} from "@/lib/dsa/dsa-note-drawing";
import { DsaNoteDrawingCanvas } from "./dsa-note-drawing-canvas";
import { ResizableTextarea } from "./resizable-textarea";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";
const AUTO_SAVE_DELAY_MS = 900;

export function DsaQuestionNotes({ slug }: { slug: string }) {
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [loadedContent, setLoadedContent] = useState("");
  const [drawing, setDrawing] = useState<DsaNoteDrawing>(emptyDsaNoteDrawing);
  const [loadedDrawing, setLoadedDrawing] = useState<DsaNoteDrawing>(emptyDsaNoteDrawing);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setContent("");
    setLoadedContent("");
    setDrawing(emptyDsaNoteDrawing());
    setLoadedDrawing(emptyDsaNoteDrawing());
    setActivePageIndex(0);
    setSaveState("loading");

    void fetch(`/api/dsa/notes/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          success?: boolean;
          data?: { content?: string; drawing?: unknown };
        };
        if (!response.ok || !payload.success) throw new Error("Could not load notes");
        const nextContent = payload.data?.content ?? "";
        const nextDrawing = normalizeDsaNoteDrawing(payload.data?.drawing);
        setContent(nextContent);
        setLoadedContent(nextContent);
        setDrawing(nextDrawing);
        setLoadedDrawing(nextDrawing);
        setSaveState("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveState("error");
      });

    return () => controller.abort();
  }, [slug]);

  const save = useCallback(async () => {
    setSaveState("saving");
    const contentToSave = content;
    const drawingToSave = drawing;
    try {
      const response = await fetch(`/api/dsa/notes/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: contentToSave, drawing: drawingToSave })
      });
      if (!response.ok) throw new Error("Could not save notes");
      setLoadedContent(contentToSave);
      setLoadedDrawing(drawingToSave);
      setSaveState("saved");
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1600);
    } catch {
      setSaveState("error");
    }
  }, [content, drawing, slug]);

  function addPage() {
    if (drawing.pages.length >= MAX_DSA_NOTE_PAGES) return;
    const nextIndex = drawing.pages.length;
    setDrawing((current) => ({
      ...current,
      pages: [...current.pages, { id: crypto.randomUUID(), strokes: [] }]
    }));
    setActivePageIndex(nextIndex);
    setSaveState("idle");
  }

  function updateActivePage(strokes: DsaNoteStroke[]) {
    setDrawing((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === activePageIndex ? { ...page, strokes } : page
      )
    }));
    setSaveState("idle");
  }

  const activePage = drawing.pages[activePageIndex] ?? drawing.pages[0]!;
  const totalStrokeCount = drawing.pages.reduce((total, page) => total + page.strokes.length, 0);
  const totalPointCount = drawing.pages.reduce(
    (pageTotal, page) =>
      pageTotal +
      page.strokes.reduce((strokeTotal, stroke) => strokeTotal + stroke.points.length, 0),
    0
  );
  const otherStrokeCount = totalStrokeCount - activePage.strokes.length;
  const otherPointCount =
    totalPointCount - activePage.strokes.reduce((total, stroke) => total + stroke.points.length, 0);
  const dirty =
    content !== loadedContent || JSON.stringify(drawing) !== JSON.stringify(loadedDrawing);
  const busy = saveState === "loading" || saveState === "saving";
  const statusLabel =
    saveState === "loading"
      ? "Loading"
      : saveState === "saving"
        ? "Saving"
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Couldn't save"
            : dirty
              ? "Unsaved"
              : "";

  useEffect(() => {
    if (!dirty || saveState !== "idle") return;
    const timer = window.setTimeout(() => void save(), AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, save, saveState]);

  useEffect(
    () => () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    },
    []
  );

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-cream/86">
          <NotebookPen size={15} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          Sketchbook
        </div>
        <span aria-live="polite" className="text-sm text-cream/38">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg bg-black/25 p-1">
          <button
            type="button"
            onClick={() => setActivePageIndex((index) => Math.max(0, index - 1))}
            disabled={activePageIndex === 0}
            aria-label="Previous drawing page"
            className="grid h-8 w-8 place-items-center rounded-md text-cream/48 transition hover:bg-white/[0.055] hover:text-cream disabled:pointer-events-none disabled:opacity-20"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span className="min-w-[5.5rem] px-2 text-center text-[11.5px] font-semibold tabular-nums text-cream/58">
            Page {activePageIndex + 1} of {drawing.pages.length}
          </span>
          <button
            type="button"
            onClick={() =>
              setActivePageIndex((index) => Math.min(drawing.pages.length - 1, index + 1))
            }
            disabled={activePageIndex >= drawing.pages.length - 1}
            aria-label="Next drawing page"
            className="grid h-8 w-8 place-items-center rounded-md text-cream/48 transition hover:bg-white/[0.055] hover:text-cream disabled:pointer-events-none disabled:opacity-20"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={addPage}
          disabled={busy || drawing.pages.length >= MAX_DSA_NOTE_PAGES}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 text-[11.5px] font-semibold text-cream/54 transition hover:bg-white/[0.075] hover:text-cream disabled:pointer-events-none disabled:opacity-30"
        >
          <Plus size={13} aria-hidden="true" /> New page
        </button>
      </div>

      <DsaNoteDrawingCanvas
        key={`${slug}-${activePage.id}`}
        strokes={activePage.strokes}
        onChange={updateActivePage}
        disabled={busy}
        maxStrokes={Math.max(0, MAX_DSA_NOTE_STROKES - otherStrokeCount)}
        maxPoints={Math.max(0, MAX_DSA_NOTE_POINTS - otherPointCount)}
      />

      <section className="mt-5 rounded-xl bg-white/[0.025] p-3.5 ring-1 ring-inset ring-white/[0.055]">
        <label
          htmlFor={`dsa-note-comment-${slug}`}
          className="flex items-center gap-2 text-[12.5px] font-semibold text-cream/66"
        >
          <MessageSquareText
            size={14}
            aria-hidden="true"
            className="text-[var(--workspace-accent)]"
          />
          Notes
        </label>
        <ResizableTextarea
          id={`dsa-note-comment-${slug}`}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setSaveState("idle");
          }}
          disabled={busy}
          maxLength={20_000}
          placeholder="Add context, an edge case, or a reminder about your sketch…"
          aria-label="Notes for this question"
          minHeight={88}
          maxHeight={260}
          containerClassName="mt-2.5 w-full rounded-lg bg-black/20 px-3 py-2.5"
          textareaClassName="text-[14px] leading-6 text-cream/74 outline-none placeholder:text-cream/25 disabled:opacity-50"
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="font-mono text-[11.5px] tabular-nums text-cream/28">
            {content.length}/20,000
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || busy}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/[0.045] px-3 text-[12.5px] font-semibold text-cream/66 transition hover:bg-white/[0.08] hover:text-cream disabled:opacity-30"
          >
            {saveState === "saving" ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={14} aria-hidden="true" />
            )}
            Save now
          </button>
        </div>
      </section>
    </section>
  );
}
