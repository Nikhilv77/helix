"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { InteractiveResponse, PracticeInteraction } from "../domain/interactive-response";
import { CategoryPicker } from "./category-picker";
import { NumberField } from "./number-field";

const buttonClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-2.5 text-cream/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] disabled:opacity-30";

/** Keyboard and touch accessible: ordering never depends on drag-and-drop. */
export function InteractiveAnswerInput({
  interaction,
  response,
  disabled,
  onChange
}: {
  interaction: PracticeInteraction;
  response: InteractiveResponse;
  disabled: boolean;
  onChange: (response: InteractiveResponse) => void;
}) {
  const sequenceOrder = response.type === "sequence" ? response.order : [];
  const flipRef = useFlipList(sequenceOrder);
  const availableKeys =
    interaction.type === "sequence"
      ? interaction.items.filter((item) => !sequenceOrder.includes(item.id)).map((item) => item.id)
      : [];
  const availableFlipRef = useFlipList(availableKeys);
  let filled = 0;
  const total =
    interaction.type === "configuration" ? interaction.fields.length : interaction.items.length;
  if (response.type === "sequence") filled = response.order.length;
  if (response.type === "classification") filled = Object.keys(response.assignments).length;
  if (response.type === "configuration") filled = Object.keys(response.values).length;
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <legend className="text-base font-semibold text-cream/90">
        {interaction.type === "sequence"
          ? "Build your response sequence"
          : interaction.type === "classification"
            ? "Map the evidence"
            : "Configure the production decision"}
      </legend>
      <p className="text-sm leading-6 text-cream/60">{interaction.instruction}</p>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Answer completeness"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={filled}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full bg-[var(--workspace-accent)] transition-all"
            style={{ width: `${(filled / total) * 100}%` }}
          />
        </div>
        <span role="status" className="text-xs tabular-nums text-cream/50">
          {filled} / {total} ready
        </span>
      </div>
      {interaction.type === "sequence" && response.type === "sequence" ? (
        <div className="space-y-4">
          <ol aria-label="Your response sequence" className="space-y-2">
            {response.order.map((id, index) => {
              const item = interaction.items.find((entry) => entry.id === id);
              if (!item) return null;
              const move = (offset: number) => {
                const order = [...response.order];
                [order[index], order[index + offset]] = [order[index + offset]!, order[index]!];
                onChange({ type: "sequence", order });
              };
              return (
                <li
                  key={id}
                  ref={flipRef(id)}
                  className="rounded-xl border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] p-3"
                >
                  <div className="flex gap-3">
                    <span className="text-sm font-semibold text-[var(--workspace-accent)]">
                      {index + 1}.
                    </span>
                    <p className="flex-1 text-sm leading-6 text-cream/85">{item.label}</p>
                  </div>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={disabled || index === 0}
                      aria-label={`Move ${item.label} earlier`}
                      onClick={() => move(-1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={disabled || index === response.order.length - 1}
                      aria-label={`Move ${item.label} later`}
                      onClick={() => move(1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      aria-label={`Remove ${item.label}`}
                      onClick={() =>
                        onChange({
                          type: "sequence",
                          order: response.order.filter((key) => key !== id)
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {!response.order.length ? (
            <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-cream/45">
              Add your first action below, then arrange the remaining steps.
            </p>
          ) : null}
          <div className="space-y-2" aria-label="Available steps">
            {interaction.items
              .filter((item) => !response.order.includes(item.id))
              .map((item) => (
                <button
                  key={item.id}
                  ref={availableFlipRef(item.id)}
                  type="button"
                  onClick={() =>
                    onChange({ type: "sequence", order: [...response.order, item.id] })
                  }
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left text-sm leading-6 text-cream/65 hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
                >
                  <Plus
                    size={16}
                    className="shrink-0 text-[var(--workspace-accent)]"
                    aria-hidden="true"
                  />
                  {item.label}
                </button>
              ))}
          </div>
        </div>
      ) : null}
      {interaction.type === "classification" && response.type === "classification" ? (
        <div className="space-y-3">
          {interaction.items.map((item, index) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--workspace-accent)]">
                Evidence {index + 1}
              </span>
              <span
                id={`evidence-${item.id}`}
                className="mb-3 mt-2 block text-sm leading-6 text-cream/80"
              >
                {item.label}
              </span>
              <CategoryPicker
                value={response.assignments[item.id] ?? null}
                options={interaction.categories}
                placeholder="Choose a category…"
                ariaLabelledBy={`evidence-${item.id}`}
                disabled={disabled}
                onChange={(categoryId) => {
                  const assignments = { ...response.assignments };
                  if (categoryId) assignments[item.id] = categoryId;
                  else delete assignments[item.id];
                  onChange({ type: "classification", assignments });
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {interaction.type === "configuration" && response.type === "configuration" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {interaction.fields.map((field) => (
            <NumberField
              key={field.id}
              label={field.label}
              unit={field.unit}
              min={field.min}
              max={field.max}
              step={field.step}
              value={response.values[field.id]}
              disabled={disabled}
              onChange={(value) => {
                const values = { ...response.values };
                if (value === undefined) delete values[field.id];
                else values[field.id] = value;
                onChange({ type: "configuration", values });
              }}
            />
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}

const MOVE_EASING = "cubic-bezier(0.2, 0, 0, 1)";

/**
 * Smooth reordering (FLIP): after React reorders the list, each moved item
 * starts at its previous position and glides to the new one; newly added
 * items fade in. Skipped on first render and when reduced motion is requested.
 */
function useFlipList(keys: readonly string[]) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const mounted = useRef(false);
  const signature = keys.join("|");

  useLayoutEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    nodes.current.forEach((node, key) => {
      const top = node.getBoundingClientRect().top;
      next.set(key, top);
      if (!mounted.current || reduced || typeof node.animate !== "function") return;
      const previous = tops.current.get(key);
      if (previous === undefined) {
        node.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "none" }
          ],
          { duration: 220, easing: MOVE_EASING }
        );
      } else if (previous !== top) {
        node.animate([{ transform: `translateY(${previous - top}px)` }, { transform: "none" }], {
          duration: 260,
          easing: MOVE_EASING
        });
      }
    });
    tops.current = next;
    mounted.current = true;
  }, [signature]);

  return useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) nodes.current.set(key, node);
      else nodes.current.delete(key);
    },
    []
  );
}
