"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { ResumeStep } from "@/components/onboarding/steps/resume-upload-step";
import {
  analysisStages,
  MAX_FILE_BYTES,
  MIN_FILE_BYTES,
  UPLOAD_TIMEOUT_MS
} from "@/components/onboarding/flow/onboarding-data";
import { ApiClientError, confirmResumeUpdate, uploadResume } from "@/lib/api/api-client";
import type { CandidateProfile } from "@/lib/shared/types";

type UpdateState = "idle" | "uploading" | "saving";

export function ResumeUpdateModal({
  open,
  profile,
  onClose,
  onUpdated
}: {
  open: boolean;
  profile: CandidateProfile;
  onClose: () => void;
  onUpdated: (profile: CandidateProfile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<UpdateState>("idle");
  const [progressStage, setProgressStage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (state === "saving") return;
    runRef.current += 1;
    abortRef.current?.abort("modal-closed");
    abortRef.current = null;
    onClose();
  }, [onClose, state]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      runRef.current += 1;
      abortRef.current?.abort("modal-closed");
      abortRef.current = null;
      setState("idle");
      setProgressStage(0);
      setDragging(false);
      setError(null);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && state !== "saving") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [close, open, state]);

  useEffect(
    () => () => {
      runRef.current += 1;
      abortRef.current?.abort("unmount");
    },
    []
  );

  useEffect(() => {
    if (state !== "uploading") return;
    const timer = window.setInterval(
      () => setProgressStage((current) => Math.min(current + 1, analysisStages.length - 1)),
      1900
    );
    return () => window.clearInterval(timer);
  }, [state]);

  async function updateResume(file: File | null) {
    setError(null);
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Upload a PDF or DOCX resume.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("The resume must be smaller than 6 MB.");
      return;
    }
    if (file.size < MIN_FILE_BYTES) {
      setError("That file is too small to be a resume. Upload the original PDF or DOCX export.");
      return;
    }
    if (!profile.targetRole || !profile.level) {
      setError("Set your target role and experience level before updating your resume.");
      return;
    }

    const runId = runRef.current + 1;
    runRef.current = runId;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), UPLOAD_TIMEOUT_MS);
    setProgressStage(0);
    setState("uploading");

    try {
      const preview = await uploadResume({
        file,
        targetRole: profile.targetRole,
        level: profile.level,
        mode: "replace",
        signal: controller.signal
      });
      if (runRef.current !== runId || controller.signal.aborted) return;

      setState("saving");
      const response = await confirmResumeUpdate(preview);
      if (runRef.current !== runId) return;
      onUpdated(response.profile);
    } catch (caught) {
      if (
        runRef.current !== runId ||
        (controller.signal.aborted && controller.signal.reason !== "timeout")
      ) {
        return;
      }
      setState("idle");
      setError(
        controller.signal.reason === "timeout"
          ? "Updating this resume took too long. Try again."
          : caught instanceof ApiClientError
            ? caught.message
            : "Trailgrad could not update this resume. Your current resume is unchanged."
      );
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/45 p-2.5 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={profile.resume ? "Update resume" : "Upload resume"}
        className="blueprint onboarding-theme relative max-h-[calc(100dvh-1.25rem)] w-full max-w-2xl overflow-hidden rounded-[1.25rem] bg-[#141517] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[1.5rem]"
        style={{ background: "#141517" }}
      >
        <button
          type="button"
          aria-label="Close resume update"
          onClick={close}
          disabled={state === "saving"}
          className="absolute right-2.5 top-2.5 z-30 grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-cream/60 transition hover:bg-white/[0.12] hover:text-cream disabled:cursor-wait disabled:opacity-40 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
        >
          <X size={18} />
        </button>

        {state === "idle" ? (
          <ResumeStep
            file={null}
            dragging={dragging}
            error={error}
            inputRef={inputRef}
            uploading={false}
            retryingAnalysis={false}
            activeStage={0}
            replacingResume
            showBack={false}
            compact
            onFile={(file) => void updateResume(file)}
            onChooseAnother={() => inputRef.current?.click()}
            onDragging={setDragging}
            onBack={close}
          />
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[18rem] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[21rem] sm:px-10"
          >
            <Loader2
              size={42}
              strokeWidth={1.5}
              className="animate-spin text-cream/80"
              aria-hidden="true"
            />
            <h2 className="mt-6 text-balance text-2xl font-bold tracking-[-0.025em] text-cream sm:text-3xl">
              Your profile is being updated
            </h2>
            <p className="mt-3 text-sm leading-6 text-cream/55 sm:text-base">
              <span
                key={state === "saving" ? "saving" : progressStage}
                className="thinking-shimmer step-in inline-block"
              >
                {state === "saving"
                  ? "Applying the verified resume to your profile..."
                  : (analysisStages[progressStage]?.label ?? "Reading resume details...")}
              </span>
            </p>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}
