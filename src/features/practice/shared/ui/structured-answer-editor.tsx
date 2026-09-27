"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type StructuredAnswerPrompt = {
  label: string;
  suggestion: string;
};

/**
 * A written-answer box with optional prompt chips. A chip inserts its label as
 * a heading at the cursor and types a faint suggestion after it, so learners
 * can structure an answer without a fixed template.
 */
export function StructuredAnswerEditor({
  value,
  prompts,
  disabled = false,
  placeholder,
  ariaLabel,
  maxLength,
  hint,
  fill = false,
  onChange
}: {
  value: string;
  prompts: readonly StructuredAnswerPrompt[];
  disabled?: boolean;
  placeholder: string;
  ariaLabel: string;
  maxLength: number;
  /** Footer text when there are no prompts. */
  hint: string;
  /** Grow to fill a flex column instead of sizing to the text. */
  fill?: boolean;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [ghost, setGhost] = useState<{ prompt: string; anchor: number; suggestion: string } | null>(
    null
  );
  const [ghostText, setGhostText] = useState("");
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || fill) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 224), 420)}px`;
  }, [fill, value]);

  useEffect(() => {
    if (!ghost) {
      setGhostText("");
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setGhostText(ghost.suggestion);
      return;
    }
    let length = 0;
    setGhostText("");
    const timer = window.setInterval(() => {
      length += 1;
      setGhostText(ghost.suggestion.slice(0, length));
      if (length >= ghost.suggestion.length) window.clearInterval(timer);
    }, 14);
    return () => window.clearInterval(timer);
  }, [ghost]);

  function addPrompt(prompt: StructuredAnswerPrompt) {
    const textarea = textareaRef.current;
    const heading = `${prompt.label}:\n`;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const separator = before.trimEnd() ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const after = value.slice(end);
    const trailingSeparator = after.trim() ? "\n" : "";
    const next = `${before}${separator}${heading}${trailingSeparator}${after}`;
    const cursor = start + separator.length + heading.length;
    setGhost({ prompt: prompt.label, anchor: cursor, suggestion: prompt.suggestion });
    onChange(next);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/[0.085] bg-[#0d0f10] shadow-[0_18px_48px_rgba(0,0,0,0.16)] ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}
    >
      {prompts.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cream/30">
            Add a prompt
          </span>
          {prompts.map((prompt) => {
            const alreadyAdded = hasStructuredPrompt(value, prompt.label);
            return (
              <button
                key={prompt.label}
                type="button"
                onClick={() => addPrompt(prompt)}
                disabled={disabled || alreadyAdded}
                aria-label={alreadyAdded ? `${prompt.label} prompt added` : undefined}
                className="rounded-md border border-white/[0.065] bg-white/[0.035] px-2 py-1 text-[10.5px] font-medium text-cream/48 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-cream/76 disabled:cursor-not-allowed disabled:border-white/[0.045] disabled:bg-white/[0.02] disabled:text-cream/28"
              >
                {alreadyAdded ? <Check size={10} aria-hidden="true" className="mr-1 inline" /> : "+ "}
                {prompt.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={fill ? "relative flex min-h-0 flex-1 flex-col" : "relative"}>
        <textarea
          ref={textareaRef}
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => {
            setGhost(null);
            onChange(event.target.value);
          }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          disabled={disabled}
          maxLength={maxLength}
          rows={8}
          className={`block w-full resize-none ${fill ? "min-h-[20rem] flex-1" : "min-h-56 max-h-[26.25rem]"} overflow-y-auto bg-transparent px-4 py-4 text-[14px] leading-7 caret-cream outline-none placeholder:text-cream/24 disabled:opacity-65 ${prompts.length && value ? "text-transparent" : "text-cream"}`}
          placeholder={placeholder}
        />
        {prompts.length && value ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden px-4 py-4 text-[14px] leading-7"
          >
            <div
              className="whitespace-pre-wrap break-words text-cream"
              style={{ transform: `translateY(-${scrollTop}px)` }}
            >
              {ghost ? (
                <>
                  <StyledAnswerText value={value.slice(0, ghost.anchor)} prompts={prompts} />
                  <span className="text-cream/25">{ghostText}</span>
                  <StyledAnswerText value={value.slice(ghost.anchor)} prompts={prompts} />
                </>
              ) : (
                <StyledAnswerText value={value} prompts={prompts} />
              )}
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-10 items-center justify-between border-t border-white/[0.055] px-3 sm:px-4">
        <p className="text-[11px] text-cream/30">
          {prompts.length ? "Use only the prompts that help your explanation." : hint}
        </p>
        <p className="font-mono text-[10px] tabular-nums text-cream/28">
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}

function StyledAnswerText({
  value,
  prompts
}: {
  value: string;
  prompts: readonly StructuredAnswerPrompt[];
}) {
  const lines = value.split("\n");
  return lines.map((line, index) => (
    <span key={`${index}:${line}`}>
      {isStructuredPromptLine(line, prompts) ? (
        <span className="font-semibold text-cream/90 underline decoration-[var(--workspace-accent)] decoration-1 underline-offset-[5px]">
          {line}
        </span>
      ) : (
        line
      )}
      {index < lines.length - 1 ? "\n" : null}
    </span>
  ));
}

function isStructuredPromptLine(line: string, prompts: readonly StructuredAnswerPrompt[]): boolean {
  return prompts.some(({ label }) => new RegExp(`^${escapeRegex(label)}:\\s*$`, "i").test(line));
}

function hasStructuredPrompt(value: string, prompt: string): boolean {
  return new RegExp(`^${escapeRegex(prompt)}:\\s*$`, "im").test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
