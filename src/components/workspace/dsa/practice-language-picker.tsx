"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { DsaEditorLanguage } from "@/components/interview/dsa/dsa-code-editor";

export interface PracticeLanguageOption {
  value: DsaEditorLanguage;
  label: string;
}

export function PracticeLanguagePicker({
  value,
  options,
  onChange
}: {
  value: DsaEditorLanguage;
  options: PracticeLanguageOption[];
  onChange: (language: DsaEditorLanguage) => void;
}) {
  const listboxId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOnOpen = useRef<number | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

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

  const openAt = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), Math.max(options.length - 1, 0));
    setActiveIndex(nextIndex);
    focusOnOpen.current = nextIndex;
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`Programming language: ${selected?.label ?? value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openAt(
            event.key === "ArrowDown"
              ? Math.min(selectedIndex + 1, options.length - 1)
              : Math.max(selectedIndex - 1, 0)
          );
        }}
        className="group inline-flex h-10 min-w-[8.75rem] items-center justify-between gap-3 rounded-xl border border-cream/10 bg-cream/[0.055] px-3.5 text-[13px] font-medium text-cream/80 outline-none transition hover:border-cream/20 hover:bg-cream/[0.08] focus-visible:border-[var(--workspace-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-soft)]"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-cream/38 transition-transform duration-200 group-hover:text-cream/65 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Programming languages"
          className="absolute right-0 top-[calc(100%+0.45rem)] z-50 min-w-full overflow-hidden rounded-xl border border-white/[0.11] bg-[#17191d]/[0.98] p-1.5 shadow-[0_22px_55px_-24px_rgba(0,0,0,0.98)] backdrop-blur-xl"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value}
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
                    const next =
                      event.key === "ArrowDown"
                        ? (index + 1) % options.length
                        : (index - 1 + options.length) % options.length;
                    setActiveIndex(next);
                    optionRefs.current[next]?.focus();
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    const next = event.key === "Home" ? 0 : options.length - 1;
                    setActiveIndex(next);
                    optionRefs.current[next]?.focus();
                  } else if (event.key === "Tab") {
                    setOpen(false);
                  }
                }}
                className={`flex h-9 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-[12.5px] outline-none transition ${
                  isActive
                    ? "bg-white/[0.075] text-cream"
                    : "text-cream/55 hover:bg-white/[0.055] hover:text-cream"
                }`}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <Check size={13} className="text-[var(--workspace-accent)]" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
