"use client";

import { FileCheck2, FileUp, Loader2, X } from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import { formatBytes } from "../flow/onboarding-data";
import { BackButton } from "../shared/onboarding-ui";

const headingWords = ["Upload", "your", "resume."];

function TypingText({
  text,
  delay,
  duration,
  className,
  title
}: {
  text: string;
  delay: number;
  duration: number;
  className?: string;
  title?: string;
}) {
  return (
    <span className={["grid", className ?? ""].join(" ").trim()} aria-label={text} title={title}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span
        aria-hidden="true"
        className="onboarding-type-visible col-start-1 row-start-1"
        style={
          {
            "--type-delay": `${delay}ms`,
            "--type-duration": `${duration}ms`
          } as CSSProperties
        }
      >
        {text}
      </span>
    </span>
  );
}

function compactFileName(name: string, maxLength = 23) {
  if (name.length <= maxLength) return name;

  const dotIndex = name.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < name.length - 1;
  const extension = hasExtension ? name.slice(dotIndex) : "";
  const base = hasExtension ? name.slice(0, dotIndex) : name;
  const available = Math.max(8, maxLength - extension.length - 3);

  return `${base.slice(0, available)}...${extension}`;
}

export function ResumeStep({
  file,
  dragging,
  error,
  inputRef,
  uploading,
  retryingAnalysis,
  activeStage,
  replacingResume = false,
  showBack = true,
  compact = false,
  onFile,
  onChooseAnother,
  onDragging,
  onBack
}: {
  file: File | null;
  dragging: boolean;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  retryingAnalysis: boolean;
  activeStage: number;
  replacingResume?: boolean;
  showBack?: boolean;
  compact?: boolean;
  onFile: (file: File | null) => void;
  onChooseAnother: () => void;
  onDragging: (dragging: boolean) => void;
  onBack: () => void;
}) {
  const selectedFileName = file ? compactFileName(file.name) : "";

  return (
    <>
      {showBack ? <BackButton onClick={onBack} /> : null}
      {!compact ? (
        <div className="text-center">
          <h1
            className="display-heading mx-auto flex max-w-4xl flex-wrap justify-center gap-x-3 gap-y-1 text-cream sm:gap-x-4"
            style={{ fontSize: "clamp(2.15rem, 4.8vw, 3.8rem)" }}
            aria-label="Upload your resume."
          >
            {headingWords.map((word, index) => (
              <span
                key={`${word}-${index}`}
                aria-hidden="true"
                className="onboarding-word"
                style={{ "--word-delay": `${index * 85}ms` } as CSSProperties}
              >
                {word}
              </span>
            ))}
          </h1>
          {replacingResume ? (
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-cream/62">
              Your resume evidence and Resume Roast will use the new file. Practice progress,
              Interview history, plans, reports, scores, and streaks will not change.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={["mx-auto w-full max-w-4xl", compact ? "" : "mt-10"].join(" ")}>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
        <div
          data-resume-drop-panel
          onDragEnter={(event) => {
            event.preventDefault();
            if (uploading) return;
            onDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (uploading) event.dataTransfer.dropEffect = "none";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            onDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            onDragging(false);
            if (uploading) return;
            onFile(event.dataTransfer.files?.[0] ?? null);
          }}
          className={[
            "onboarding-card-reveal group relative overflow-hidden text-left outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            compact
              ? "min-h-[18rem] rounded-[1.25rem] px-4 py-9 sm:min-h-[21rem] sm:rounded-[1.5rem] sm:p-7"
              : "min-h-[21rem] rounded-[1.5rem] p-5 sm:p-7",
            compact
              ? dragging
                ? "bg-[#191a1d]"
                : "bg-[#141517]"
              : dragging
                ? "bg-cream/[0.075] shadow-[0_22px_70px_rgba(0,0,0,0.22)]"
                : file
                  ? "bg-cream/[0.06]"
                  : "bg-cream/[0.032] hover:bg-cream/[0.052]",
            compact ? "" : "lg:hover:-translate-y-1 lg:backdrop-blur-sm",
            uploading && !compact ? "opacity-80" : ""
          ].join(" ")}
          style={
            {
              "--card-delay": "360ms"
            } as CSSProperties
          }
        >
          <span
            aria-hidden
            className="upload-scan-line pointer-events-none absolute left-0 top-0 h-full w-1/4 bg-[linear-gradient(90deg,transparent,rgba(241,234,216,0.045),transparent)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-7 top-7 h-2 w-2 rounded-full bg-cream/28"
          />
          {!compact ? (
            <span
              aria-hidden
              className="pointer-events-none absolute right-7 top-7 h-2 w-2 rounded-full bg-cream/18"
            />
          ) : null}

          <div
            className={[
              "relative flex flex-col items-center justify-center text-center",
              compact ? "min-h-[13.5rem] sm:min-h-[18rem]" : "min-h-[18rem]"
            ].join(" ")}
          >
            {file ? (
              <>
                <span className="upload-float text-cream/88 drop-shadow-[0_18px_32px_rgba(3,10,31,0.25)]">
                  <FileCheck2 size={54} strokeWidth={1.45} />
                </span>
                <TypingText
                  text={selectedFileName}
                  delay={120}
                  duration={760}
                  title={file.name}
                  className={[
                    "max-w-[18rem] font-bold text-cream sm:max-w-xl",
                    compact ? "mt-4 text-xl sm:mt-6 sm:text-[2rem]" : "mt-6 text-2xl sm:text-[2rem]"
                  ].join(" ")}
                />
                <p className="blueprint-label mt-2 text-cream/48">
                  {formatBytes(file.size)} · ready to verify
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onChooseAnother();
                  }}
                  className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-cream/20 px-3.5 text-[0.9375rem] font-medium text-cream/62 transition hover:bg-cream/[0.08] hover:text-cream disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <X size={14} /> Choose another
                </button>
              </>
            ) : (
              <>
                <span className="upload-float text-cream/88 drop-shadow-[0_18px_32px_rgba(3,10,31,0.25)]">
                  <FileUp
                    size={56}
                    strokeWidth={1.45}
                    className={compact ? "h-12 w-12 sm:h-14 sm:w-14" : undefined}
                  />
                </span>
                <TypingText
                  text="Drop your resume"
                  delay={620}
                  duration={880}
                  className={[
                    "font-bold leading-none tracking-[-0.035em] text-cream",
                    compact
                      ? "mt-4 text-[clamp(1.65rem,8vw,2.15rem)] sm:mt-6 sm:text-[2.35rem]"
                      : "mt-6 text-[2rem] sm:text-[2.45rem]"
                  ].join(" ")}
                />
                <p
                  className={[
                    "max-w-md tracking-[-0.008em] text-cream/68",
                    compact
                      ? "mt-3 text-sm leading-6 sm:mt-4 sm:text-lg sm:leading-[1.7]"
                      : "mt-4 text-[1.0625rem] leading-[1.7] sm:text-lg"
                  ].join(" ")}
                >
                  Drag it in, or choose a file from your computer.
                </p>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  className={[
                    "browse-nudge min-h-11 rounded-lg border border-cream/20 bg-cream/[0.035] px-5 text-sm font-bold text-cream transition hover:border-cream/35 hover:bg-cream/[0.09] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:min-h-12 sm:px-6 sm:text-base lg:hover:-translate-y-0.5",
                    compact ? "mt-5 sm:mt-7" : "mt-7"
                  ].join(" ")}
                >
                  Browse files
                </button>
              </>
            )}
          </div>

          {compact && uploading ? (
            <div className="absolute inset-x-4 bottom-4 flex justify-center sm:inset-x-6 sm:bottom-5">
              <div className="rounded-full bg-black/20 px-3 py-2">
                <ResumeVerificationProgress
                  activeStage={activeStage}
                  retryingAnalysis={retryingAnalysis}
                />
              </div>
            </div>
          ) : null}

          {compact && error ? (
            <div
              role="alert"
              className="absolute inset-x-4 bottom-4 rounded-xl border border-[#f6b0b0]/35 bg-[#4b1f36]/80 px-3 py-2 text-center text-sm font-medium leading-5 text-[#ffd3d3] sm:inset-x-6 sm:bottom-5"
            >
              {error}
            </div>
          ) : null}
        </div>

        {error && !compact ? (
          <div
            role="alert"
            className="onboarding-card-reveal mt-4 rounded-[1.15rem] border border-[#f6b0b0]/35 bg-[#4b1f36]/30 px-4 py-3 text-base font-medium leading-relaxed text-[#ffd3d3] lg:backdrop-blur-sm"
            style={
              {
                "--card-delay": "80ms"
              } as CSSProperties
            }
          >
            {error}
          </div>
        ) : null}

        {!compact ? (
          <div className="mt-5 min-h-5">
            {uploading ? (
              <ResumeVerificationProgress
                activeStage={activeStage}
                retryingAnalysis={retryingAnalysis}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function ResumeVerificationProgress({
  activeStage,
  retryingAnalysis
}: {
  activeStage: number;
  retryingAnalysis: boolean;
}) {
  const labels = [
    "CHECKING DOCUMENT INTEGRITY...",
    "VERIFYING RESUME DETAILS...",
    "READING RESUME DETAILS...",
    "FINALIZING VERIFICATION..."
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      className="blueprint-label flex items-center justify-center gap-2 text-cream/45"
    >
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      <span key={retryingAnalysis ? "retry" : activeStage} className="step-in">
        {retryingAnalysis
          ? "TRYING RESUME ANALYSIS AGAIN..."
          : (labels[activeStage] ?? "VERIFYING RESUME...")}
      </span>
    </div>
  );
}
