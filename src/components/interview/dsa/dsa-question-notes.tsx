"use client";

import { Loader2, NotebookPen, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { ResizableTextarea } from "./resizable-textarea";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export function DsaQuestionNotes({ slug }: { slug: string }) {
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [loadedContent, setLoadedContent] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setContent("");
    setLoadedContent("");
    setSaveState("loading");

    void fetch(`/api/dsa/notes/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          success?: boolean;
          data?: { content?: string };
        };
        if (!response.ok || !payload.success) throw new Error("Could not load notes");
        const nextContent = payload.data?.content ?? "";
        setContent(nextContent);
        setLoadedContent(nextContent);
        setSaveState("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveState("error");
      });

    return () => controller.abort();
  }, [slug]);

  async function save() {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/dsa/notes/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error("Could not save notes");
      setLoadedContent(content);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1600);
    } catch {
      setSaveState("error");
    }
  }

  const dirty = content !== loadedContent;
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

  return (
    <section className="mt-9 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-base font-semibold text-cream/86">
          <NotebookPen size={17} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          Notes
        </div>
        <span aria-live="polite" className="text-sm text-cream/38">
          {statusLabel}
        </span>
      </div>
      <ResizableTextarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setSaveState("idle");
        }}
        disabled={saveState === "loading" || saveState === "saving"}
        maxLength={20_000}
        placeholder="Jot down an idea, edge case, or hint..."
        aria-label="Notes for this question"
        minHeight={112}
        maxHeight={360}
        containerClassName="mt-4 w-full"
        textareaClassName="bg-transparent text-[15px] leading-7 text-cream/76 outline-none placeholder:text-cream/28 disabled:opacity-50"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-mono text-sm tabular-nums text-cream/30">
          {content.length}/20,000
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saveState === "loading" || saveState === "saving"}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-cream/66 transition hover:bg-white/[0.035] hover:text-cream disabled:opacity-30"
        >
          {saveState === "saving" ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          Save notes
        </button>
      </div>
    </section>
  );
}
