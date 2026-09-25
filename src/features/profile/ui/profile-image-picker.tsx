"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Check, X } from "lucide-react";
import type { CandidateProfileInput } from "@/lib/shared/types";
import { profileAvatars, profileCovers } from "./candidate-profile-editor-data";

export function ProfileImagePicker({
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
        "image-picker-backdrop image-picker-backdrop-slow",
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
          "image-picker-panel image-picker-panel-slow",
          "relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-[1.25rem] border border-white/[0.1] bg-[#17181b] text-cream shadow-[0_28px_90px_-48px_rgba(0,0,0,0.9)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl",
          choosingCover ? "max-w-6xl" : "max-w-4xl"
        ].join(" ")}
      >
        <div className="image-picker-header sticky top-0 z-20 flex shrink-0 items-center justify-center bg-[#17181b] px-4 pb-3 pt-4 sm:px-6 sm:pb-2 sm:pt-6">
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
                    <span className="image-picker-preview relative block aspect-[3.2/1] overflow-hidden rounded-xl bg-[#1a1b1f] sm:aspect-[4/1]">
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
