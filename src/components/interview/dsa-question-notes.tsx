"use client";

import { Loader2, NotebookPen, Save } from "lucide-react";
import { useEffect, useState } from "react";

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
              : "Saved locally to your account";

  return (
    <section className="mt-8 border-t border-cream/10 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-cream">
          <NotebookPen size={15} aria-hidden="true" className="text-cream/55" />
          Notes
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-cream/35">
          {statusLabel}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setSaveState("idle");
        }}
        disabled={saveState === "loading" || saveState === "saving"}
        maxLength={20_000}
        placeholder="Jot down an idea, edge case, or hint..."
        aria-label="Notes for this question"
        className="mt-3 min-h-32 w-full resize-y bg-transparent text-sm leading-6 text-cream outline-none placeholder:text-cream/25 disabled:opacity-50"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] tabular-nums text-cream/25">{content.length}/20,000</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saveState === "loading" || saveState === "saving"}
          className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-cream/70 transition hover:text-cream disabled:opacity-30"
        >
          {saveState === "saving" ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={13} aria-hidden="true" />
          )}
          Save notes
        </button>
      </div>
    </section>
  );
}
