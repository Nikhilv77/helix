"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  analysisStages,
  MAX_FILE_BYTES,
  MIN_FILE_BYTES,
  onboardingSteps,
  stepIndex,
  stepTitles,
  type Step,
  UPLOAD_TIMEOUT_MS
} from "./onboarding-data";
import { BlueprintBackdrop } from "../shared/onboarding-ui";
import { LevelStep } from "../steps/level-step";
import { DEFAULT_TEACHER_ID, TeacherStep } from "../steps/teacher-step";
import { ResumeStep } from "../steps/resume-upload-step";
import { ResumeEvidenceStep } from "../resume-review/resume-evidence-step";
import { ResumeIdentityStep } from "../resume-review/resume-identity-step";
import { ResumeReadinessStep } from "../resume-review/resume-readiness-step";
import { ApiClientError, completeOnboarding, uploadResume } from "@/lib/api/api-client";
import { personaById } from "@/lib/avatars/personas";
import { pageTitle } from "@/lib/shared/seo";
import type { Level, ResumeExtractionResponse, Role } from "@/lib/shared/types";
import { shouldAutoRetryResumeAnalysis } from "./resume-analysis-retry";

const ANALYSIS_RETRY_NOTICE_MS = 700;

export function OnboardingFlow({
  replacingResume = false,
  // Let the dev preview harness open a step directly, with a stand-in
  // extraction for the steps that only exist after an upload. Production
  // passes neither, so the flow still always begins at the experience picker with
  // no result.
  initialStep = "teacher",
  initialResult = null,
  initialTeacherId = null
}: {
  replacingResume?: boolean;
  initialStep?: Step;
  initialResult?: ResumeExtractionResponse | null;
  /** A teacher already on the profile, so returning here does not re-ask. */
  initialTeacherId?: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadRunRef = useRef(0);
  const [step, setStep] = useState<Step>(initialStep);
  const [teacherId, setTeacherId] = useState<string | null>(initialTeacherId);
  const [role] = useState<Role>("fullstack");
  const [level, setLevel] = useState<Level | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);
  const [result, setResult] = useState<ResumeExtractionResponse | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const selectedTeacherName =
    personaById(teacherId ?? DEFAULT_TEACHER_ID)?.name ?? "Your teacher";

  const chooseAnotherResume = useCallback(() => {
    uploadRunRef.current += 1;
    uploadAbortRef.current?.abort("replace");
    uploadAbortRef.current = null;
    setUploading(false);
    setAnalysisStage(0);
    setRetryingAnalysis(false);
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
    window.setTimeout(() => fileInput.current?.click(), 0);
  }, []);

  useEffect(() => {
    const touchDevice = window.matchMedia("(pointer: coarse)").matches;
    window.scrollTo({ top: 0, behavior: touchDevice ? "auto" : "smooth" });
  }, [step]);

  useEffect(() => {
    document.title = pageTitle(
      replacingResume ? `Replace Resume - ${stepTitles[step]}` : `Onboarding - ${stepTitles[step]}`
    );
  }, [replacingResume, step]);

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(
      () => setAnalysisStage((current) => Math.min(current + 1, analysisStages.length - 1)),
      1900
    );
    return () => window.clearInterval(timer);
  }, [uploading]);

  function acceptFile(next: File | null) {
    setError(null);
    setRetryingAnalysis(false);
    if (!next) {
      setFile(null);
      setResult(null);
      return;
    }
    const validExtension = /\.(pdf|docx)$/i.test(next.name);
    if (!validExtension) {
      setFile(null);
      setError("Upload a PDF or DOCX resume.");
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setFile(null);
      setError("The resume must be smaller than 6 MB.");
      return;
    }
    if (next.size < MIN_FILE_BYTES) {
      setFile(null);
      setError("That file is too small to be a resume. Upload the original PDF or DOCX export.");
      return;
    }
    setFile(next);
  }

  const analyze = useCallback(async () => {
    if (!file || !role || !level || uploading) return;
    const runId = uploadRunRef.current + 1;
    uploadRunRef.current = runId;
    setUploading(true);
    setAnalysisStage(0);
    setRetryingAnalysis(false);
    setError(null);

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (uploadRunRef.current !== runId) return;

        const controller = new AbortController();
        uploadAbortRef.current = controller;
        // Each request gets its own ceiling so a failed first attempt cannot
        // consume the retry's timeout budget.
        const timeout = window.setTimeout(() => controller.abort("timeout"), UPLOAD_TIMEOUT_MS);

        try {
          const extracted = await uploadResume({
            file,
            targetRole: role,
            level,
            signal: controller.signal
          });
          if (uploadRunRef.current !== runId) return;
          setResult(extracted);
          setStep("identity");
          return;
        } catch (caught) {
          if (uploadRunRef.current !== runId) return;

          const browserTimedOut =
            controller.signal.aborted && controller.signal.reason === "timeout";
          const shouldRetry =
            attempt === 0 && (browserTimedOut || shouldAutoRetryResumeAnalysis(caught));

          if (shouldRetry) {
            setRetryingAnalysis(true);
            // Ensure a fast failure does not make the recovery message flash.
            await new Promise((resolve) => window.setTimeout(resolve, ANALYSIS_RETRY_NOTICE_MS));
            continue;
          }

          // A manual cancel already updated or left the current screen.
          if (controller.signal.aborted && !browserTimedOut) return;

          setError(
            browserTimedOut
              ? "Reading this resume took too long. Try again, or export a text-based PDF if this one is a scan."
              : caught instanceof ApiClientError
                ? caught.message
                : "Trailgrad could not process this resume. Try the original PDF or DOCX file."
          );
          return;
        } finally {
          window.clearTimeout(timeout);
          if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
        }
      }
    } finally {
      if (uploadRunRef.current === runId) {
        setUploading(false);
        setRetryingAnalysis(false);
      }
    }
  }, [file, level, role, uploading]);

  const finishOnboarding = useCallback(async () => {
    if (!result || completing) return;

    setCompleting(true);
    setError(null);

    try {
      await completeOnboarding(result, teacherId);
      router.push(
        replacingResume
          ? "/profile"
          : `/?welcome=${encodeURIComponent(teacherId ?? DEFAULT_TEACHER_ID)}`
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Trailgrad could not finish onboarding. Try to Enter again."
      );
    } finally {
      setCompleting(false);
    }
  }, [completing, replacingResume, result, router, teacherId]);

  useEffect(() => {
    if (step !== "resume" || !file || uploading || result || error) return;

    const timer = window.setTimeout(() => {
      void analyze();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [analyze, error, file, result, step, uploading]);

  return (
    <main className="blueprint onboarding-theme relative min-h-screen min-h-[100svh] overflow-x-hidden">
      <BlueprintBackdrop />
      <div className="relative z-10 mx-auto flex min-h-screen min-h-[100svh] w-full max-w-[78rem] flex-col px-4 sm:px-7 lg:px-10">
        <header className="relative mt-7 flex min-h-10 items-center justify-center">
          {replacingResume ? (
            <a
              href="/profile"
              className="absolute left-0 text-xs font-medium text-cream/55 transition hover:text-cream"
            >
              Keep my current resume
            </a>
          ) : null}
          <div
            className="grid w-36 grid-cols-6 gap-1.5 sm:w-60 sm:gap-2"
            aria-label={`Onboarding step ${stepIndex(step) + 1} of ${onboardingSteps.length}: ${onboardingSteps[stepIndex(step)]?.label}`}
          >
            {onboardingSteps.map((item, index) => (
              <span
                key={item.value}
                className={[
                  "h-1.5 rounded-full transition-colors duration-500",
                  index <= stepIndex(step) ? "onboarding-accent-fill" : "bg-white/15"
                ].join(" ")}
              />
            ))}
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <section key={step} className="step-in w-full min-w-0">
            {step === "teacher" ? (
              <TeacherStep
                selected={teacherId}
                onSelect={setTeacherId}
                onContinue={() => setStep("level")}
              />
            ) : null}
            {step === "level" ? (
              <LevelStep
                selected={level}
                onSelect={(selectedLevel) => {
                  setLevel(selectedLevel);
                  setStep("resume");
                }}
              />
            ) : null}
            {step === "resume" ? (
              <ResumeStep
                file={file}
                dragging={dragging}
                error={error}
                inputRef={fileInput}
                uploading={uploading}
                retryingAnalysis={retryingAnalysis}
                activeStage={analysisStage}
                onFile={acceptFile}
                onChooseAnother={chooseAnotherResume}
                onDragging={setDragging}
                onBack={() => {
                  uploadRunRef.current += 1;
                  uploadAbortRef.current?.abort("back");
                  uploadAbortRef.current = null;
                  setFile(null);
                  setResult(null);
                  setError(null);
                  setUploading(false);
                  setAnalysisStage(0);
                  setRetryingAnalysis(false);
                  if (fileInput.current) fileInput.current.value = "";
                  setStep("level");
                }}
              />
            ) : null}
            {step === "identity" && result ? (
              <ResumeIdentityStep
                result={result}
                teacherName={selectedTeacherName}
                onReplace={() => {
                  chooseAnotherResume();
                  setStep("resume");
                }}
                onContinue={() => setStep("evidence")}
              />
            ) : null}
            {step === "evidence" && result ? (
              <ResumeEvidenceStep
                result={result}
                teacherName={selectedTeacherName}
                onBack={() => {
                  setResult(null);
                  setFile(null);
                  setError(null);
                  setUploading(false);
                  setAnalysisStage(0);
                  setRetryingAnalysis(false);
                  if (fileInput.current) fileInput.current.value = "";
                  setStep("resume");
                }}
                onReplace={() => {
                  chooseAnotherResume();
                  setStep("resume");
                }}
                onContinue={() => setStep("readiness")}
              />
            ) : null}
            {step === "readiness" && result ? (
              <ResumeReadinessStep
                result={result}
                teacherName={selectedTeacherName}
                onBack={() => setStep("evidence")}
                replacingResume={replacingResume}
                continuing={completing}
                error={error}
                onContinue={finishOnboarding}
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
