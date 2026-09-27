"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export type CategoryOption = { id: string; label: string };

const CLEAR_ID = "__clear__";

/**
 * A styled, accessible replacement for `<select>` (same listbox pattern as the
 * DSA language picker): Enter/Space/arrows open it, arrows move, Home/End
 * jump, Escape and outside clicks close, and focus returns to the trigger.
 */
export function CategoryPicker({
  value,
  options,
  placeholder,
  ariaLabelledBy,
  disabled = false,
  onChange
}: {
  value: string | null;
  options: readonly CategoryOption[];
  placeholder: string;
  /** The text the choice belongs to, e.g. the evidence card. */
  ariaLabelledBy?: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const listboxId = useId();
  const valueId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOnOpen = useRef<number | null>(null);
  const selected = options.find((option) => option.id === value) ?? null;
  // Once something is chosen, the menu also offers to clear it (like a
  // select's empty option).
  const entries: readonly CategoryOption[] = selected
    ? [{ id: CLEAR_ID, label: "Clear choice" }, ...options]
    : options;
  const selectedIndex = entries.findIndex((option) => option.id === value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));

  useEffect(() => {
    if (!open) return;
    const focusIndex = focusOnOpen.current;
    const focusFrame =
      focusIndex === null
        ? null
        : window.requestAnimationFrame(() => {
            optionRefs.current[focusIndex]?.focus();
            focusOnOpen.current = null;
          });
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // A short fade-and-drop when the menu opens, unless reduced motion is on.
  useLayoutEffect(() => {
    const node = menu.current;
    if (!open || !node || typeof node.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    node.animate(
      [
        { opacity: 0, transform: "translateY(-4px) scale(0.985)" },
        { opacity: 1, transform: "none" }
      ],
      { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" }
    );
  }, [open]);

  const openAt = (index: number) => {
    const next = Math.min(Math.max(index, 0), Math.max(entries.length - 1, 0));
    setActiveIndex(next);
    focusOnOpen.current = next;
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = entries[index];
    if (!option) return;
    onChange(option.id === CLEAR_ID ? null : option.id);
    setOpen(false);
    trigger.current?.focus();
  };

  const moveFocus = (next: number) => {
    setActiveIndex(next);
    optionRefs.current[next]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${valueId}` : valueId}
        onClick={() => (open ? setOpen(false) : openAt(Math.max(selectedIndex, 0)))}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openAt(Math.max(selectedIndex, 0));
        }}
        className="practice-language-trigger group flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-cream/10 bg-cream/[0.045] px-3.5 py-2 text-left text-sm outline-none transition hover:border-cream/20 hover:bg-cream/[0.07] focus-visible:border-[var(--workspace-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-soft)] disabled:opacity-50"
      >
        <span id={valueId} className={selected ? "text-cream/90" : "text-cream/45"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`shrink-0 text-cream/40 transition-transform duration-200 group-hover:text-cream/70 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          ref={menu}
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabelledBy}
          className="practice-language-menu absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-white/[0.11] bg-[#17191d]/[0.98] p-1.5 shadow-[0_22px_55px_-24px_rgba(0,0,0,0.98)] backdrop-blur-xl"
        >
          {entries.map((option, index) => {
            const isSelected = option.id === value;
            const isClear = option.id === CLEAR_ID;
            return (
              <button
                key={option.id}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(
                      event.key === "ArrowDown"
                        ? (index + 1) % entries.length
                        : (index - 1 + entries.length) % entries.length
                    );
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    moveFocus(event.key === "Home" ? 0 : entries.length - 1);
                  } else if (event.key === "Tab") {
                    setOpen(false);
                  }
                }}
                className={`flex min-h-10 w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-[13px] leading-5 outline-none transition ${
                  isClear ? "italic" : ""
                } ${
                  index === activeIndex
                    ? "bg-white/[0.075] text-cream"
                    : isClear
                      ? "text-cream/40 hover:bg-white/[0.055] hover:text-cream/80"
                      : "text-cream/60 hover:bg-white/[0.055] hover:text-cream"
                }`}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <Check
                    size={14}
                    className="shrink-0 text-[var(--workspace-accent)]"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
