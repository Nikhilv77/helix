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
} from "@/components/onboarding/onboarding-data";
import { BlueprintBackdrop } from "@/components/onboarding/onboarding-ui";
import { LevelStep } from "@/components/onboarding/level-step";
import { ResumeStep } from "@/components/onboarding/resume-step";
import {
  ResumeEvidenceStep,
  ResumeIdentityStep,
  ResumeReadinessStep
} from "@/components/onboarding/resume-review-steps";
import { ApiClientError, completeOnboarding, uploadResume } from "@/lib/api-client";
import { pageTitle } from "@/lib/seo";
import type { Level, ResumeExtractionResponse, Role } from "@/lib/types";

export function OnboardingFlow({
  replacingResume = false,
  // Let the dev preview harness open a step directly, with a stand-in
  // extraction for the steps that only exist after an upload. Production
  // passes neither, so the flow still always begins at the experience picker with
  // no result.
  initialStep = "level",
  initialResult = null
}: {
  replacingResume?: boolean;
  initialStep?: Step;
  initialResult?: ResumeExtractionResponse | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadRunRef = useRef(0);
  const [step, setStep] = useState<Step>(initialStep);
  const [role] = useState<Role>("fullstack");
  const [level, setLevel] = useState<Level | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [result, setResult] = useState<ResumeExtractionResponse | null>(initialResult);
  const [error, setError] = useState<string | null>(null);

  const chooseAnotherResume = useCallback(() => {
    uploadRunRef.current += 1;
    uploadAbortRef.current?.abort("replace");
    uploadAbortRef.current = null;
    setUploading(false);
    setAnalysisStage(0);
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
    window.setTimeout(() => fileInput.current?.click(), 0);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    // Without this a stalled request leaves the progress screen spinning forever.
    const timeout = window.setTimeout(() => controller.abort("timeout"), UPLOAD_TIMEOUT_MS);
    setUploading(true);
    setAnalysisStage(0);
    setError(null);

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
    } catch (caught) {
      if (uploadRunRef.current !== runId) return;
      if (controller.signal.aborted) {
        // A manual cancel already wrote its own message.
        if (controller.signal.reason === "timeout") {
          setError(
            "Reading this resume took too long. Try again, or export a text-based PDF if this one is a scan."
          );
        }
      } else {
        setError(
          caught instanceof ApiClientError
            ? caught.message
            : "Trailgrad could not process this resume. Try the original PDF or DOCX file."
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      if (uploadRunRef.current === runId) setUploading(false);
    }
  }, [file, level, role, uploading]);

  const finishOnboarding = useCallback(async () => {
    if (!result || completing) return;

    setCompleting(true);
    setError(null);

    try {
      await completeOnboarding(result);
      router.push(replacingResume ? "/profile" : "/?welcome=maya");
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
  }, [completing, replacingResume, result, router]);

  useEffect(() => {
    if (step !== "resume" || !file || uploading || result || error) return;

    const timer = window.setTimeout(() => {
      void analyze();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [analyze, error, file, result, step, uploading]);

  return (
    <main className="blueprint relative min-h-screen min-h-[100svh] overflow-hidden">
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
            className="grid w-32 grid-cols-5 gap-1.5 sm:w-52 sm:gap-2"
            aria-label={`Onboarding step ${stepIndex(step) + 1} of ${onboardingSteps.length}: ${onboardingSteps[stepIndex(step)]?.label}`}
          >
            {onboardingSteps.map((item, index) => (
              <span
                key={item.value}
                className={[
                  "h-1.5 rounded-full transition-colors duration-500",
                  index <= stepIndex(step) ? "bg-cream" : "bg-cream/30"
                ].join(" ")}
              />
            ))}
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <section key={step} className="step-in w-full min-w-0">
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
                  if (fileInput.current) fileInput.current.value = "";
                  setStep("level");
                }}
              />
            ) : null}
            {step === "identity" && result ? (
              <ResumeIdentityStep
                result={result}
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
                onBack={() => {
                  setResult(null);
                  setFile(null);
                  setError(null);
                  setUploading(false);
                  setAnalysisStage(0);
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
