"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";

/**
 * A styled numeric field for the configuration questions: − / + steppers, the
 * unit inside the box, and a slider for quick adjustment. Typing is free while
 * focused and is snapped to the range and step on blur, so the stored answer
 * is always a valid value.
 */
export function NumberField({
  label,
  unit,
  min,
  max,
  step,
  value,
  disabled = false,
  onChange
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number | undefined;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const labelId = useId();
  const [draft, setDraft] = useState(value === undefined ? "" : formatValue(value, step));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value === undefined ? "" : formatValue(value, step));
  }, [editing, step, value]);

  const commit = (next: number) => onChange(snap(next, min, max, step));
  const nudge = (direction: 1 | -1) =>
    commit(value === undefined ? (direction > 0 ? min : max) : value + direction * step);
  const fill = value === undefined ? 0 : ((value - min) / (max - min || 1)) * 100;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <span id={labelId} className="block text-sm font-semibold text-cream/85">
        {label}
      </span>
      <span className="mt-1 block text-xs text-cream/45">
        {formatValue(min, step)}–{formatValue(max, step)} {unit} · steps of{" "}
        {formatValue(step, step)}
      </span>

      <div className="mt-3 flex h-12 items-stretch overflow-hidden rounded-xl border border-cream/10 bg-cream/[0.045] transition focus-within:border-[var(--workspace-accent-border)] focus-within:ring-2 focus-within:ring-[var(--workspace-accent-soft)]">
        <StepButton
          label={`Decrease ${label}`}
          disabled={disabled || (value !== undefined && value <= min)}
          onClick={() => nudge(-1)}
        >
          <Minus size={15} aria-hidden="true" />
        </StepButton>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <input
            role="spinbutton"
            aria-labelledby={labelId}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            inputMode="decimal"
            disabled={disabled}
            value={draft}
            placeholder="—"
            onFocus={() => setEditing(true)}
            onChange={(event) => {
              const text = event.target.value.replace(",", ".");
              if (!/^-?\d*\.?\d*$/.test(text)) return;
              setDraft(text);
              const parsed = Number(text);
              if (text === "" || text === "-" || text === ".") onChange(undefined);
              else if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
            }}
            onBlur={() => {
              setEditing(false);
              const parsed = Number(draft);
              if (draft.trim() === "" || !Number.isFinite(parsed)) onChange(undefined);
              else commit(parsed);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                nudge(event.key === "ArrowUp" ? 1 : -1);
              }
            }}
            className="w-full min-w-0 bg-transparent text-center font-mono text-lg tabular-nums text-cream outline-none placeholder:text-cream/25 disabled:opacity-60"
          />
          <span className="shrink-0 text-xs text-cream/45">{unit}</span>
        </div>
        <StepButton
          label={`Increase ${label}`}
          disabled={disabled || (value !== undefined && value >= max)}
          onClick={() => nudge(1)}
        >
          <Plus size={15} aria-hidden="true" />
        </StepButton>
      </div>

      <input
        type="range"
        aria-hidden="true"
        tabIndex={-1}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value ?? min}
        onChange={(event) => commit(Number(event.target.value))}
        className="practice-range mt-3 w-full"
        style={{ "--range-fill": `${fill}%` } as React.CSSProperties}
      />
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid w-11 shrink-0 place-items-center text-cream/55 transition hover:bg-cream/[0.07] hover:text-cream focus-visible:bg-cream/[0.08] focus-visible:text-cream focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function decimalsOf(step: number): number {
  const text = String(step);
  return text.includes(".") ? text.split(".")[1]!.length : 0;
}

function formatValue(value: number, step: number): string {
  return value.toFixed(decimalsOf(step));
}

/** Clamp to the range and round to the nearest step, without float noise. */
export function snap(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const stepped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.min(max, stepped).toFixed(decimalsOf(step)));
}
