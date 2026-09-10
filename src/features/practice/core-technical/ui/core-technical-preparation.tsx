"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Code2, Loader2, Network } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { StoryPracticePreparationExperience } from "@/features/practice/shared/ui/contracts";

export const CORE_TECHNICAL_PREPARATION_EXPERIENCE: StoryPracticePreparationExperience = {
  slug: "core-technical",
  apiBase: "/api/practice/core-technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "story",
  heading: "What language do you want to practise in?",
  optionLabel: "Practice language",
  optionIcon: "code",
  options: [{ value: "javascript", label: "JavaScript", detail: "Node.js interview stories" }],
  defaultOption: "javascript",
  buildConfirmation: (language) => ({ language })
};

/** First-entry gate. The browser confirms one choice; every focus signal is server-derived. */
export function CoreTechnicalPreparation({
  experience = CORE_TECHNICAL_PREPARATION_EXPERIENCE
}: {
  experience?: StoryPracticePreparationExperience;
} = {}) {
  const router = useRouter();
  const pending = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [optionValue, setOptionValue] = useState(experience.defaultOption);
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
      const confirm = await post(
        `${experience.apiBase}/confirm`,
        experience.buildConfirmation(optionValue),
        experience.subjectNoun
      );
      const focusId = readFocusId(confirm);
      if (!focusId) throw new Error("The confirmed practice focus was not returned.");

      setPhase("preparing");
      const storageKey = `${experience.slug}-prepare:${focusId}`;
      const requestId = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, requestId);
      await post(
        `${experience.apiBase}/prepare`,
        { requestId, focusRevisionId: focusId },
        experience.subjectNoun
      );
      sessionStorage.removeItem(storageKey);
      router.replace(experience.routeBase);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `The complete ${experience.subjectNoun} could not be prepared. Your saved progress is safe; try again.`
      );
      pending.current = false;
      setPhase("idle");
    }
  };

  const selected =
    experience.options.find((option) => option.value === optionValue) ?? experience.options[0];
  if (!selected) throw new Error("Story Practice requires at least one preparation option.");
  const headingWords = experience.heading.split(/\s+/);

  return (
    <div
      className={`practice-mobile-overlay fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#050607]/72 px-4 py-8 backdrop-blur-[7px] transition-opacity duration-500 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${experience.slug}-confirm-heading`}
        className={`relative w-full max-w-[36rem] overflow-visible rounded-[1.85rem] border border-white/[0.09] bg-[linear-gradient(145deg,#1b1c20,#151619)] px-5 py-7 shadow-[0_36px_120px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.045)] transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:px-9 sm:py-9 ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.975] opacity-0"}`}
      >
        <h1
          id={`${experience.slug}-confirm-heading`}
          aria-label={experience.heading}
          className="mx-auto mt-4 flex max-w-[31rem] flex-wrap justify-center gap-x-2.5 gap-y-0.5 text-center font-display text-[2.25rem] font-semibold leading-[1.03] tracking-[-0.045em] text-cream sm:text-[2.75rem]"
        >
          {headingWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              aria-hidden="true"
              className="onboarding-word"
              style={{ "--word-delay": `${150 + index * 70}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h1>

        <div
          ref={selectRef}
          className={`onboarding-card-reveal relative z-20 mt-8 ${error ? "mb-4" : "mb-7"} ${open ? "is-open" : ""}`}
          style={{ "--card-delay": "680ms" } as CSSProperties}
        >
          <label id={`${experience.slug}-option-label`} className="sr-only">
            {experience.optionLabel}
          </label>
          <button
            ref={triggerRef}
            type="button"
            aria-labelledby={`${experience.slug}-option-label ${experience.slug}-option-value`}
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
            className="group relative flex min-h-[6.4rem] w-full items-center gap-4 overflow-hidden rounded-[1.45rem] bg-[#1b1c20] px-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-[background-color,transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-[#24252a] hover:shadow-[0_18px_42px_-32px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.055)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)] sm:px-6"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--workspace-accent)]/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <span className="shrink-0 text-[var(--workspace-accent)] transition-transform duration-300 group-hover:scale-110">
              {experience.optionIcon === "design" ? (
                <Network size={23} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Code2 size={23} strokeWidth={1.8} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                id={`${experience.slug}-option-value`}
                className="block text-[1.35rem] font-semibold tracking-[-0.025em] text-cream"
              >
                {selected.label}
              </span>
              <span className="mt-1 block text-[12.5px] text-cream/48">{selected.detail}</span>
            </span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`shrink-0 text-cream/44 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"}`}
          >
            <div className="min-h-0 overflow-hidden rounded-[1.15rem] bg-[#101214] shadow-[0_18px_44px_rgba(0,0,0,0.45)]">
              <ul
                role="listbox"
                aria-labelledby={`${experience.slug}-option-label`}
                className="overflow-hidden"
              >
                {experience.options.map((option) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={option.value === optionValue}
                    tabIndex={open ? 0 : -1}
                    onClick={() => {
                      setOptionValue(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setOptionValue(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className="flex min-h-16 w-full cursor-pointer items-center justify-between px-5 text-[13px] font-semibold text-cream/78 outline-none transition-colors duration-200 hover:bg-[#202226] focus-visible:bg-[#202226]"
                  >
                    <span>{option.label}</span>
                    {option.value === optionValue ? (
                      <Check
                        size={15}
                        className="text-[var(--workspace-accent)]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-[#e3a15b]/20 bg-[#e3a15b]/10 px-4 py-3 text-[12.5px] leading-5 text-[#e7bd83]"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void prepare()}
          disabled={phase !== "idle"}
          className={`group relative z-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1.1rem] bg-cream px-5 text-[13.5px] font-semibold text-[#17181a] transition duration-500 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-65 motion-reduce:transition-none ${error ? "mt-5" : "mt-0"} ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          style={{ transitionDelay: "760ms" }}
        >
          {phase === "idle" ? null : (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          )}
          {phase === "confirming"
            ? "Personalising your focus…"
            : phase === "preparing"
              ? "Preparing all 8 questions…"
              : `Build my first ${experience.subjectNoun}`}
          {phase === "idle" ? (
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          ) : null}
        </button>
      </section>
    </div>
  );
}

async function post(url: string, body: unknown, subjectNoun: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readError(payload, subjectNoun));
  return payload;
}

function readFocusId(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.focus)) return null;
  return typeof payload.data.focus.id === "string" ? payload.data.focus.id : null;
}

function readError(payload: unknown, subjectNoun: string): string {
  if (!isRecord(payload) || !isRecord(payload.error) || typeof payload.error.message !== "string") {
    return `The complete ${subjectNoun} could not be prepared. Your saved progress is safe; try again.`;
  }
  return payload.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
