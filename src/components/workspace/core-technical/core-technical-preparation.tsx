"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Code2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Language = "javascript";

const LANGUAGE_OPTIONS: ReadonlyArray<{
  value: Language;
  label: string;
  detail: string;
}> = [{ value: "javascript", label: "JavaScript", detail: "Node.js interview stories" }];

/** First-entry gate. The browser confirms only language; every other focus signal is server-derived. */
export function CoreTechnicalPreparation() {
  const router = useRouter();
  const pending = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("javascript");
  const [phase, setPhase] = useState<"idle" | "confirming" | "preparing">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    const focusTimer = window.setTimeout(() => triggerRef.current?.focus(), 120);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", trapFocus);
    return () => window.removeEventListener("keydown", trapFocus);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const prepare = async () => {
    if (pending.current) return;
    pending.current = true;
    setError(null);
    setOpen(false);
    setPhase("confirming");
    try {
      const confirm = await post("/api/practice/core-technical/confirm", { language });
      const focusId = readFocusId(confirm);
      if (!focusId) throw new Error("The confirmed practice focus was not returned.");

      setPhase("preparing");
      const storageKey = `core-technical-prepare:${focusId}`;
      const requestId = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, requestId);
      await post("/api/practice/core-technical/prepare", { requestId, focusRevisionId: focusId });
      sessionStorage.removeItem(storageKey);
      router.replace("/practice/core-technical");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The complete story could not be prepared. Your saved progress is safe; try again."
      );
      pending.current = false;
      setPhase("idle");
    }
  };

  const selected = LANGUAGE_OPTIONS.find((option) => option.value === language)!;

  return (
    <div
      className={`fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-md transition-opacity duration-500 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="core-technical-confirm-heading"
        aria-describedby="core-technical-confirm-description"
        className={`relative w-full max-w-[29rem] overflow-visible rounded-[1.65rem] border border-white/[0.1] bg-[#17181b] px-5 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-500 ease-out motion-reduce:transition-none sm:px-7 sm:py-7 ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"}`}
      >
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)] transition duration-500 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ transitionDelay: "80ms" }}
        >
          <Sparkles size={19} aria-hidden="true" />
        </div>

        <p
          className={`mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)] transition duration-500 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ transitionDelay: "140ms" }}
        >
          One quick choice
        </p>
        <h1
          id="core-technical-confirm-heading"
          className={`mt-2 font-display text-[1.85rem] font-semibold leading-[1.08] tracking-[-0.035em] text-cream transition duration-500 motion-reduce:transition-none sm:text-[2rem] ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ transitionDelay: "200ms" }}
        >
          What language do you want to practise in?
        </h1>
        <p
          id="core-technical-confirm-description"
          className={`mt-3 text-[13.5px] leading-6 text-cream/52 transition duration-500 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ transitionDelay: "260ms" }}
        >
          We’ll use your saved resume and profile for your role, level, stack, framework, experience
          and story focus. You only need to choose the language.
        </p>

        <div
          ref={selectRef}
          className={`relative mt-6 transition duration-500 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ transitionDelay: "320ms" }}
        >
          <label id="core-language-label" className="text-[11px] font-semibold text-cream/62">
            Practice language
          </label>
          <button
            ref={triggerRef}
            type="button"
            aria-labelledby="core-language-label core-language-value"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
              }
              if (event.key === "Escape") setOpen(false);
            }}
            className="mt-2 flex min-h-[3.65rem] w-full items-center gap-3 rounded-xl border border-white/[0.09] bg-[#101214] px-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition hover:border-white/[0.16] hover:bg-[#121416] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.055] text-cream/68">
              <Code2 size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                id="core-language-value"
                className="block text-[13.5px] font-semibold text-cream"
              >
                {selected.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-cream/38">{selected.detail}</span>
            </span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`shrink-0 text-cream/36 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open ? (
            <ul
              role="listbox"
              aria-labelledby="core-language-label"
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-xl border border-white/[0.1] bg-[#111315] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === language}
                  tabIndex={0}
                  onClick={() => {
                    setLanguage(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setLanguage(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className="flex min-h-12 cursor-pointer items-center justify-between rounded-lg px-3 text-[13px] font-semibold text-cream/78 outline-none transition hover:bg-white/[0.055] focus-visible:bg-white/[0.055]"
                >
                  <span>{option.label}</span>
                  {option.value === language ? (
                    <Check
                      size={14}
                      className="text-[var(--workspace-accent)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[#e3a15b]/20 bg-[#e3a15b]/10 px-4 py-3 text-[12.5px] leading-5 text-[#e7bd83]"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void prepare()}
          disabled={phase !== "idle"}
          className={`group mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cream px-5 text-[13.5px] font-semibold text-[#17181a] transition duration-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-65 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ transitionDelay: "380ms" }}
        >
          {phase === "idle" ? null : (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          )}
          {phase === "confirming"
            ? "Personalising your focus…"
            : phase === "preparing"
              ? "Preparing all 8 questions…"
              : "Build my first story"}
          {phase === "idle" ? (
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          ) : null}
        </button>

        <p className="mt-3 text-center text-[10.5px] leading-4 text-cream/30">
          Your choice is saved for this Core Technical path.
        </p>
      </section>
    </div>
  );
}

async function post(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readError(payload));
  return payload;
}

function readFocusId(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.focus)) return null;
  return typeof payload.data.focus.id === "string" ? payload.data.focus.id : null;
}

function readError(payload: unknown): string {
  if (!isRecord(payload) || !isRecord(payload.error) || typeof payload.error.message !== "string") {
    return "The complete story could not be prepared. Your saved progress is safe; try again.";
  }
  return payload.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
