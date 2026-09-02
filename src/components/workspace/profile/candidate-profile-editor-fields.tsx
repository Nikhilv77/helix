"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Eye,
  Sparkles,
  Target,
  Trash2,
  X
} from "lucide-react";
import type { CandidateProfileInput, CandidateStory } from "@/lib/shared/types";
import {
  fieldClass,
  levelOptions,
  profileAvatars,
  profileCovers,
  roleOptions,
  statTones
} from "./candidate-profile-editor-data";

export const EDIT_SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Eye },
  { id: "target", label: "Target", icon: Target },
  { id: "signal", label: "What you have done", icon: Sparkles },
  { id: "stories", label: "Story bank", icon: BriefcaseBusiness }
] as const;

function StoryField({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.09em] text-cream/55">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        maxLength={800}
        placeholder={placeholder}
        className={`${fieldClass} thin-scroll resize-y px-3.5 py-3 text-[14px] leading-6`}
      />
    </label>
  );
}

export function EditSection({
  id,
  icon: Icon,
  tone,
  title,
  hint,
  children
}: {
  id: string;
  icon: typeof Target;
  tone: keyof typeof statTones;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="profile-motion surface scroll-mt-6 p-5 sm:p-7 lg:p-8">
      <div className="flex items-center gap-4">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${statTones[tone]}`}
        >
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-cream sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-cream/45">{hint}</p>
        </div>
      </div>
      <div className="mt-8 grid gap-8">{children}</div>
    </section>
  );
}

export function FieldBlock({
  label,
  hint,
  counter,
  children
}: {
  label: string;
  hint?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="lg:pt-2">
        <span className="block text-base font-semibold text-cream/88">{label}</span>
        {hint ? <span className="mt-1 block text-xs leading-5 text-cream/38">{hint}</span> : null}
        {counter ? (
          <span className="mt-1.5 block font-mono text-[11px] text-cream/45">{counter}</span>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function CoverPicker({
  value,
  onChange
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {profileCovers.map((cover, index) => {
        const selected = value === cover.src;

        return (
          <button
            key={cover.src}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(cover.src)}
            className={[
              "group relative overflow-hidden rounded-2xl bg-white/[0.055] p-1.5 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/60",
              selected
                ? "ring-2 ring-cream/82"
                : "ring-1 ring-cream/10 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-cream/28"
            ].join(" ")}
          >
            <span
              className="relative block overflow-hidden rounded-xl bg-[#1a1b1f]"
              style={{ aspectRatio: `${cover.width} / ${cover.height}` }}
            >
              <Image
                src={cover.src}
                alt=""
                fill
                sizes="(max-width: 639px) calc(100vw - 3.75rem), (max-width: 1279px) calc(50vw - 11rem), 20rem"
                quality={72}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span
                aria-hidden
                className={[
                  "absolute inset-0 transition",
                  selected ? "bg-black/[0.04]" : "bg-black/[0.2] group-hover:bg-black/[0.06]"
                ].join(" ")}
              />
              {selected ? (
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-cream text-blueprint">
                  <Check size={14} />
                </span>
              ) : null}
            </span>
            <span
              className={[
                "mt-2 flex items-center justify-between px-1 text-xs font-semibold",
                selected ? "text-cream" : "text-cream/46"
              ].join(" ")}
            >
              <span>Cover {index + 1}</span>
              <span className="font-mono text-[10px] text-cream/35">
                {cover.width}x{cover.height}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {profileAvatars.map((avatar, index) => {
        const selected = value === avatar.src;

        return (
          <button
            key={avatar.src}
            type="button"
            aria-label={`Choose profile image ${index + 1}`}
            aria-pressed={selected}
            onClick={() => onChange(avatar.src)}
            className={[
              "group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-cream p-0.5 outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/60 sm:h-24 sm:w-24",
              selected
                ? "ring-2 ring-cream/82"
                : "ring-1 ring-cream/10 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-cream/28"
            ].join(" ")}
          >
            <Image
              src={avatar.src}
              alt=""
              width={avatar.width}
              height={avatar.height}
              sizes="(max-width: 639px) 80px, 96px"
              quality={72}
              className="h-full w-full rounded-full object-cover object-center"
            />
            {selected ? (
              <span className="absolute -right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-cream text-blueprint">
                <Check size={14} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ImagePickerOverlay({
  open,
  profile,
  error,
  requireAvatar = false,
  onClose,
  onCoverChange,
  onAvatarChange
}: {
  open: "cover" | "avatar" | null;
  profile: CandidateProfileInput;
  error: string | null;
  requireAvatar?: boolean;
  onClose: () => void;
  onCoverChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const choosingCover = open === "cover";

  return createPortal(
    <div
      className={[
        "image-picker-backdrop-slow",
        "fixed inset-0 z-[1000] flex min-h-dvh items-center justify-center bg-[#01030a]/64 p-2 backdrop-blur-sm sm:p-6"
      ].join(" ")}
    >
      {requireAvatar ? null : (
        <button
          type="button"
          aria-label="Close image picker"
          onClick={onClose}
          className="absolute inset-0 cursor-default"
        />
      )}
      <section
        className={[
          "image-picker-panel-slow",
          "relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-[1.25rem] border border-white/[0.1] bg-[#17181b] text-cream shadow-[0_28px_90px_-48px_rgba(0,0,0,0.9)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl",
          choosingCover ? "max-w-6xl" : "max-w-4xl"
        ].join(" ")}
      >
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-center bg-[#17181b] px-4 pb-3 pt-4 sm:px-6 sm:pb-2 sm:pt-6">
          <div className="max-w-xl text-center">
            <h2 className="text-2xl font-medium text-cream sm:text-3xl">
              {choosingCover ? "Pick your cover" : "Pick your avatar"}
            </h2>
            {requireAvatar ? (
              <p className="mt-2 text-sm leading-6 text-cream/58">
                Choose the profile image you want Trailgrad to use across your workspace.
              </p>
            ) : null}
          </div>
          {requireAvatar ? null : (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-9 w-9 shrink-0 place-items-center rounded-full text-cream/60 transition hover:bg-cream/[0.08] hover:text-cream"
              aria-label="Close image picker"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="thin-scroll min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
          {choosingCover ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {profileCovers.map((cover, index) => {
                const selected = profile.coverImage === cover.src;
                return (
                  <button
                    key={cover.src}
                    type="button"
                    aria-label={`Choose cover ${index + 1}`}
                    aria-pressed={selected}
                    onClick={() => onCoverChange(cover.src)}
                    style={{ "--choice-delay": `${70 + index * 34}ms` } as CSSProperties}
                    className={[
                      "image-picker-choice",
                      "group relative overflow-hidden rounded-2xl bg-cream/[0.035] p-1.5 outline-none transition duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cream/45",
                      selected ? "ring-1 ring-cream/42" : "ring-1 ring-cream/8 hover:ring-cream/20"
                    ].join(" ")}
                  >
                    <span className="relative block aspect-[3.2/1] overflow-hidden rounded-xl bg-[#1a1b1f] sm:aspect-[4/1]">
                      <Image
                        src={cover.src}
                        alt=""
                        fill
                        sizes="(max-width: 639px) calc(100vw - 3.75rem), (max-width: 1279px) calc(50vw - 3.5rem), 34rem"
                        quality={72}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-[#030712]/0 transition group-hover:bg-[#030712]/28"
                      />
                      {selected ? (
                        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-cream text-blueprint">
                          <Check size={14} />
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 sm:gap-4 md:grid-cols-6 lg:grid-cols-7">
              {profileAvatars.map((avatar, index) => {
                const selected = profile.profileImage === avatar.src;
                return (
                  <button
                    key={avatar.src}
                    type="button"
                    aria-label={`Choose avatar ${index + 1}`}
                    aria-pressed={selected}
                    onClick={() => onAvatarChange(avatar.src)}
                    style={{ "--choice-delay": `${90 + index * 38}ms` } as CSSProperties}
                    className={[
                      "image-picker-choice",
                      "group relative grid aspect-square w-full max-w-[6.5rem] place-self-center place-items-center overflow-hidden rounded-full bg-cream p-0.5 outline-none transition duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cream/45",
                      selected ? "ring-1 ring-cream/46" : "ring-1 ring-cream/10 hover:ring-cream/24"
                    ].join(" ")}
                  >
                    <Image
                      src={avatar.src}
                      alt=""
                      width={avatar.width}
                      height={avatar.height}
                      sizes="(max-width: 639px) 88px, 104px"
                      quality={72}
                      className="h-full w-full rounded-full object-cover object-center"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-[#030712]/0 transition group-hover:bg-[#030712]/26"
                    />
                    {selected ? (
                      <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-cream text-blueprint">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {error ? <p className="mt-4 text-sm text-[#ffb2b2]">{error}</p> : null}
        </div>
      </section>
    </div>,
    document.body
  );
}

export function RoleOption({
  option,
  selected,
  onClick
}: {
  option: (typeof roleOptions)[number];
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "group min-h-32 rounded-3xl p-4 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/55",
        selected
          ? "bg-cream text-blueprint shadow-[0_18px_45px_-22px_rgba(239,232,214,0.65)]"
          : "bg-white/[0.055] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:bg-white/[0.085]"
      ].join(" ")}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={[
            "grid h-11 w-11 place-items-center rounded-2xl transition",
            selected ? "bg-blueprint/10 text-blueprint" : "bg-white/[0.07] text-cream/68"
          ].join(" ")}
        >
          <Icon size={19} />
        </span>
        {selected ? <Check size={16} className="shrink-0" /> : null}
      </span>
      <span className="mt-5 block text-base font-semibold">{option.label}</span>
      <span
        className={[
          "mt-1.5 block text-xs leading-5",
          selected ? "text-blueprint/62" : "text-cream/42"
        ].join(" ")}
      >
        {option.detail}
      </span>
    </button>
  );
}

export function LevelOption({
  option,
  selected,
  onClick
}: {
  option: (typeof levelOptions)[number];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "min-h-28 rounded-3xl p-4 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/55",
        selected
          ? "bg-cream text-blueprint shadow-[0_18px_45px_-22px_rgba(239,232,214,0.65)]"
          : "bg-white/[0.055] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:bg-white/[0.085]"
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] opacity-70">Level</span>
        {selected ? <Check size={16} className="shrink-0" /> : null}
      </span>
      <span className="mt-4 block text-base font-semibold">{option.label}</span>
      <span
        className={[
          "mt-1.5 block text-xs leading-5",
          selected ? "text-blueprint/62" : "text-cream/42"
        ].join(" ")}
      >
        {option.detail}
      </span>
    </button>
  );
}

export function SelectChip({
  selected,
  onClick,
  children
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-cream/60",
        selected
          ? "bg-cream text-blueprint"
          : "pill text-cream/62 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-cream"
      ].join(" ")}
    >
      {children}
      {selected ? <Check size={13} /> : null}
    </button>
  );
}

/** Collapsed by default: eight expanded stories was a wall of textareas. */
export function StoryRow({
  story,
  index,
  open,
  onToggle,
  onChange,
  onRemove
}: {
  story: CandidateStory;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (id: string, patch: Partial<CandidateStory>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.075)] transition hover:bg-white/[0.065]">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.07] font-mono text-[11px] text-cream/56">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-cream">
              {story.title || "Untitled story"}
            </span>
            {!open ? (
              <span className="mt-1 block truncate text-xs text-cream/38">
                {story.outcome || story.situation || "Nothing captured yet"}
              </span>
            ) : null}
          </span>
          <ChevronRight
            size={15}
            className={`shrink-0 text-cream/30 transition ${open ? "rotate-90" : ""}`}
          />
        </button>
        <button
          type="button"
          aria-label={`Remove story ${index + 1}`}
          onClick={() => onRemove(story.id)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-cream/30 transition hover:bg-[#ff9898]/10 hover:text-[#ffc2c2]"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open ? (
        <div className="profile-motion grid gap-4 px-4 pb-5">
          <input
            value={story.title}
            onChange={(event) => onChange(story.id, { title: event.target.value })}
            placeholder="Project or accomplishment"
            maxLength={100}
            className={`${fieldClass} min-h-11 px-4 text-sm font-medium`}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <StoryField
              label="Situation"
              value={story.situation}
              placeholder="What was at stake?"
              onChange={(value) => onChange(story.id, { situation: value })}
            />
            <StoryField
              label="Your action"
              value={story.action}
              placeholder="What did you decide?"
              onChange={(value) => onChange(story.id, { action: value })}
            />
            <StoryField
              label="Outcome"
              value={story.outcome}
              placeholder="What changed?"
              onChange={(value) => onChange(story.id, { outcome: value })}
            />
          </div>
          <input
            value={story.skills.join(", ")}
            onChange={(event) =>
              onChange(story.id, {
                skills: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 6)
              })
            }
            placeholder="Skills: React, API design, leadership"
            className={`${fieldClass} min-h-11 px-4 text-[14px]`}
          />
        </div>
      ) : null}
    </article>
  );
}
