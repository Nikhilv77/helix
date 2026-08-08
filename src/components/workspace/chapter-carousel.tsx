"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export interface CarouselChapter {
  id: string;
  title: string;
  whyItMatters: string;
  questions: number;
  minutes: number;
  counts: { easy: number; medium: number; hard: number };
  firstQuestionSlug: string | null;
  completedQuestions?: number;
  progressPercent?: number;
}

const AUTOPLAY_MS = 5200;

/**
 * The curated path, one pattern at a time.
 *
 * Everything on a slide is real: the chapter titles, question counts, time
 * estimates and difficulty split all come from the same curation that builds
 * Practice. Autoplay stops on hover, on focus, when the tab is hidden, and for
 * anyone who asked for reduced motion.
 */
export function ChapterCarousel({ chapters }: { chapters: CarouselChapter[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const total = chapters.length;
  const liveRef = useRef<HTMLParagraphElement>(null);

  const go = useCallback((next: number) => setIndex(((next % total) + total) % total), [total]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion || total < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % total), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, reducedMotion, total]);

  useEffect(() => {
    const onVisibility = () => setPlaying(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!total) return null;
  const chapter = chapters[index];
  if (!chapter) return null;

  const mixTotal = Math.max(chapter.counts.easy + chapter.counts.medium + chapter.counts.hard, 1);
  const hours = Math.max(Math.round(chapter.minutes / 60), 1);
  const progress = Math.round(chapter.progressPercent ?? 0);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Practice patterns"
      className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[#2a4aa0] p-5"
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onFocusCapture={() => setPlaying(false)}
      onBlurCapture={() => setPlaying(true)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(index + 1);
        if (event.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/50">
          Pattern {index + 1} of {total}
        </p>
        <div className="flex items-center gap-1">
          <CarouselButton label="Previous pattern" onClick={() => go(index - 1)}>
            <ChevronLeft size={15} aria-hidden="true" />
          </CarouselButton>
          <CarouselButton
            label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? (
              <Pause size={13} aria-hidden="true" />
            ) : (
              <Play size={13} aria-hidden="true" />
            )}
          </CarouselButton>
          <CarouselButton label="Next pattern" onClick={() => go(index + 1)}>
            <ChevronRight size={15} aria-hidden="true" />
          </CarouselButton>
        </div>
      </div>

      <div className="mt-4 min-h-[8.5rem]">
        <p ref={liveRef} aria-live="polite" className="sr-only">
          {chapter.title}, pattern {index + 1} of {total}
        </p>

        <h3
          key={`${chapter.id}-title`}
          className="fade-slide text-[1.35rem] font-semibold leading-7 tracking-tight text-cream"
        >
          {chapter.title}
        </h3>
        <p
          key={`${chapter.id}-why`}
          className="fade-slide mt-2 line-clamp-3 text-[13.5px] leading-6 text-cream/60"
        >
          {chapter.whyItMatters}
        </p>

        <div className="mt-4 flex items-center gap-3 text-[13px] font-medium text-cream/68">
          <span>
            {chapter.completedQuestions ?? 0}/{chapter.questions} questions
          </span>
          <span aria-hidden="true" className="text-cream/25">
            ·
          </span>
          <span>~{hours}h</span>
          <span aria-hidden="true" className="text-cream/25">
            ·
          </span>
          <span>{progress}%</span>
        </div>

        {/* Difficulty split, drawn straight from the chapter's own counts. */}
        <div
          className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#1e3c88]"
          role="img"
          aria-label={`${chapter.counts.easy} easy, ${chapter.counts.medium} medium, ${chapter.counts.hard} hard`}
        >
          <span
            className="h-full bg-[#8be6bd]"
            style={{ width: `${(chapter.counts.easy / mixTotal) * 100}%` }}
          />
          <span
            className="h-full bg-[#f4d58b]"
            style={{ width: `${(chapter.counts.medium / mixTotal) * 100}%` }}
          />
          <span
            className="h-full bg-[#f0a3a3]"
            style={{ width: `${(chapter.counts.hard / mixTotal) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {chapters.map((item, dot) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.title}
              aria-current={dot === index ? "true" : undefined}
              onClick={() => go(dot)}
              className={`h-1.5 rounded-full transition-all ${
                dot === index ? "w-5 bg-cream" : "w-1.5 bg-cream/25 hover:bg-cream/45"
              }`}
            />
          ))}
        </div>

        {chapter.firstQuestionSlug ? (
          <Link
            href={`/dsa-questions/${chapter.firstQuestionSlug}`}
            className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-cream/75 transition hover:text-cream"
          >
            Open
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function CarouselButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-cream/55 outline-none transition hover:bg-cream/[0.1] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40"
    >
      {children}
    </button>
  );
}
