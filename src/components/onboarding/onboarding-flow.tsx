"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Blocks,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Code2,
  Database,
  FileCheck2,
  FileText,
  FileUp,
  GraduationCap,
  Loader2,
  PackageCheck,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trophy,
  X
} from "lucide-react";
import { HelixMark } from "@/components/helix-mark";
import { ApiClientError, uploadResume } from "@/lib/api-client";
import { pageTitle } from "@/lib/seo";
import type { Level, ResumeExtractionResponse, Role } from "@/lib/types";

const roles: Array<{
  value: Role;
  label: string;
  detail: string;
  icon: typeof Code2;
}> = [
  { value: "frontend", label: "Frontend", detail: "UI systems, state, performance", icon: Code2 },
  { value: "backend", label: "Backend", detail: "APIs, data, reliability", icon: Database },
  { value: "fullstack", label: "Full-stack", detail: "Product systems end to end", icon: Blocks },
  { value: "data", label: "Data", detail: "Pipelines, analytics, platforms", icon: BarChart3 },
  {
    value: "ai-ml",
    label: "AI / ML",
    detail: "Models, evaluation, production AI",
    icon: BrainCircuit
  },
  { value: "pm", label: "Product", detail: "Strategy, discovery, execution", icon: PackageCheck }
];

const levels: Array<{ value: Level; label: string; detail: string }> = [
  { value: "fresher", label: "Starting out", detail: "Student, intern, or first full-time role" },
  { value: "0-2", label: "Early career", detail: "Up to 2 years of professional experience" },
  { value: "3-5", label: "Mid-level", detail: "3–5 years with meaningful ownership" },
  { value: "5-plus", label: "Senior+", detail: "5+ years leading systems or outcomes" }
];

const analysisStages = [
  { label: "Checking document integrity", icon: ShieldCheck },
  { label: "Verifying identity and chronology", icon: ScanSearch },
  { label: "Extracting career evidence", icon: FileText },
  { label: "Building your interview memory", icon: Sparkles }
];

type Step = "role" | "level" | "resume" | "identity" | "evidence" | "readiness";

const onboardingSteps: Array<{ value: Step; label: string }> = [
  { value: "role", label: "Role" },
  { value: "level", label: "Experience" },
  { value: "resume", label: "Resume" },
  { value: "identity", label: "Verification" },
  { value: "evidence", label: "Evidence" },
  { value: "readiness", label: "Ready" }
];

const stepTitles: Record<Step, string> = {
  role: "Choose Role",
  level: "Experience Level",
  resume: "Upload Resume",
  identity: "Resume Verified",
  evidence: "Resume Evidence",
  readiness: "Profile Ready"
};

/** The server budget is 60s; give the network a little room beyond it. */
const UPLOAD_TIMEOUT_MS = 75_000;
const MIN_FILE_BYTES = 1_000;
const MAX_FILE_BYTES = 6 * 1024 * 1024;

export function OnboardingFlow({ replacingResume = false }: { replacingResume?: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useRef<AbortController | null>(null);
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [result, setResult] = useState<ResumeExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  function chooseRole(next: Role) {
    setRole(next);
    window.setTimeout(() => setStep("level"), 180);
  }

  function chooseLevel(next: Level) {
    setLevel(next);
    window.setTimeout(() => setStep("resume"), 180);
  }

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

  function cancelAnalysis() {
    upload.current?.abort();
    upload.current = null;
    setUploading(false);
    setError("Resume analysis cancelled. Nothing was saved.");
  }

  async function analyze() {
    if (!file || !role || !level) return;
    const controller = new AbortController();
    // Without this a stalled request leaves the progress screen spinning forever.
    const timeout = window.setTimeout(() => controller.abort("timeout"), UPLOAD_TIMEOUT_MS);
    upload.current = controller;
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
      setResult(extracted);
      setStep("identity");
    } catch (caught) {
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
            : "Helix could not process this resume. Try the original PDF or DOCX file."
        );
      }
    } finally {
      window.clearTimeout(timeout);
      upload.current = null;
      setUploading(false);
    }
  }

  if (uploading) {
    return (
      <AnalysisState
        fileName={file?.name ?? "Resume"}
        activeStage={analysisStage}
        onCancel={cancelAnalysis}
      />
    );
  }

  return (
    <main className="blueprint relative min-h-screen min-h-[100svh] overflow-hidden">
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex min-h-screen min-h-[100svh] w-full max-w-[110rem] flex-col px-4 sm:px-7 lg:px-10 xl:px-12">
        <header className="mt-5 flex min-h-20 items-center rounded-[1.65rem] bg-white/[0.045] px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl">
          <div className="flex items-center gap-2.5 text-cream">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.82),rgba(239,232,214,0.56)_38%,rgba(255,255,255,0.12)_100%)] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-18px_30px_rgba(35,69,158,0.16),0_18px_34px_-26px_rgba(239,232,214,0.8)]">
              <span
                aria-hidden
                className="absolute inset-1.5 rounded-xl bg-[#274ca9]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              />
              <HelixMark className="relative h-5 w-5 drop-shadow-[0_2px_8px_rgba(20,42,109,0.28)]" />
            </span>
            <span className="text-base font-semibold">Helix</span>
          </div>
          {replacingResume ? (
            <a
              href="/profile"
              className="ml-auto mr-4 text-xs font-medium text-cream/45 transition hover:text-cream"
            >
              Keep my current resume
            </a>
          ) : null}
          <div
            className={[
              "grid w-28 grid-cols-6 gap-1.5 sm:w-48 sm:gap-2",
              replacingResume ? "" : "ml-auto"
            ].join(" ")}
            aria-label={`Onboarding step ${stepIndex(step) + 1} of ${onboardingSteps.length}: ${onboardingSteps[stepIndex(step)]?.label}`}
          >
            {onboardingSteps.map((item, index) => (
              <span
                key={item.value}
                className={[
                  "h-1.5 rounded-full transition-colors duration-500",
                  index <= stepIndex(step) ? "bg-cream" : "bg-white/[0.16]"
                ].join(" ")}
              />
            ))}
          </div>
          <span className="ml-3 min-w-10 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-cream/48 sm:ml-5">
            {stepIndex(step) + 1} / {onboardingSteps.length}
          </span>
        </header>

        <div className="grid flex-1 content-start gap-7 pb-12 pt-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <section
            key={step}
            className="step-in surface-raised w-full min-w-0 overflow-hidden p-6 sm:p-8 lg:p-10"
          >
            {step === "role" ? <RoleStep selected={role} onSelect={chooseRole} /> : null}
            {step === "level" ? (
              <LevelStep selected={level} onSelect={chooseLevel} onBack={() => setStep("role")} />
            ) : null}
            {step === "resume" ? (
              <ResumeStep
                file={file}
                dragging={dragging}
                error={error}
                inputRef={fileInput}
                onFile={acceptFile}
                onDragging={setDragging}
                onBack={() => setStep("level")}
                onAnalyze={() => void analyze()}
              />
            ) : null}
            {step === "identity" && result ? (
              <ResumeIdentityStep
                result={result}
                onReplace={() => {
                  setResult(null);
                  setFile(null);
                  setStep("resume");
                }}
                onContinue={() => setStep("evidence")}
              />
            ) : null}
            {step === "evidence" && result ? (
              <ResumeEvidenceStep
                result={result}
                onBack={() => setStep("identity")}
                onContinue={() => setStep("readiness")}
              />
            ) : null}
            {step === "readiness" && result ? (
              <ResumeReadinessStep
                result={result}
                onBack={() => setStep("evidence")}
                replacingResume={replacingResume}
                onContinue={() => {
                  router.push(replacingResume ? "/profile" : "/?welcome=maya");
                  router.refresh();
                }}
              />
            ) : null}
          </section>

          <OnboardingAside step={step} role={role} level={level} file={file} />
        </div>
      </div>
    </main>
  );
}

function RoleStep({
  selected,
  onSelect
}: {
  selected: Role | null;
  onSelect: (role: Role) => void;
}) {
  return (
    <>
      <h1 className="max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
        Which role are you preparing for?
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/54">
        Pick the lane Helix should prepare.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((option) => {
          const Icon = option.icon;
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={[
                "group flex min-h-40 min-w-0 flex-col rounded-3xl p-5 text-left outline-none shadow-soft-inset transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/70 sm:p-6",
                active
                  ? "bg-cream text-blueprint shadow-[0_22px_54px_-28px_rgba(239,232,214,0.75)]"
                  : "bg-white/[0.045] text-cream hover:-translate-y-0.5 hover:bg-white/[0.075]"
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-12 w-12 place-items-center rounded-2xl",
                  active ? "bg-blueprint/10 text-blueprint" : "bg-white/[0.07] text-cream/58"
                ].join(" ")}
              >
                <Icon size={20} />
              </span>
              <span className="mt-auto block pt-8 text-xl font-semibold tracking-tight">
                {option.label}
              </span>
              <span
                className={
                  active
                    ? "mt-1.5 block text-sm leading-6 text-blueprint/62"
                    : "mt-1.5 block text-sm leading-6 text-cream/42"
                }
              >
                {option.detail}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function LevelStep({
  selected,
  onSelect,
  onBack
}: {
  selected: Level | null;
  onSelect: (level: Level) => void;
  onBack: () => void;
}) {
  return (
    <>
      <BackButton onClick={onBack} />
      <h1 className="max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
        Choose your experience level.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/54">
        Helix adjusts depth and ownership expectations.
      </p>
      <div className="mt-7 grid gap-2.5 sm:gap-3">
        {levels.map((option, index) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={[
              "group grid min-h-20 w-full grid-cols-[3rem_minmax(0,1fr)_2.35rem] items-center gap-3 rounded-3xl px-4 text-left shadow-soft-inset transition hover:-translate-y-0.5 hover:bg-white/[0.075] sm:min-h-24 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-6",
              selected === option.value ? "bg-cream text-blueprint" : "bg-white/[0.045] text-cream"
            ].join(" ")}
          >
            <span
              className={[
                "grid h-11 w-11 place-items-center rounded-2xl font-mono text-xs font-semibold",
                selected === option.value
                  ? "bg-blueprint/10 text-blueprint"
                  : "bg-white/[0.06] text-cream/45"
              ].join(" ")}
            >
              0{index + 1}
            </span>
            <span>
              <span className="block text-lg font-semibold leading-tight">{option.label}</span>
              <span
                className={[
                  "mt-1 hidden text-sm sm:block",
                  selected === option.value ? "text-blueprint/62" : "text-cream/42"
                ].join(" ")}
              >
                {option.detail}
              </span>
            </span>
            <span
              className={[
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                selected === option.value
                  ? "bg-blueprint text-cream"
                  : "bg-white/[0.06] text-cream/35 group-hover:text-cream"
              ].join(" ")}
            >
              {selected === option.value ? <Check size={13} /> : <ArrowRight size={13} />}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function ResumeStep({
  file,
  dragging,
  error,
  inputRef,
  onFile,
  onDragging,
  onBack,
  onAnalyze
}: {
  file: File | null;
  dragging: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
  onDragging: (dragging: boolean) => void;
  onBack: () => void;
  onAnalyze: () => void;
}) {
  return (
    <>
      <BackButton onClick={onBack} />
      <Eyebrow icon={FileUp}>Interview source</Eyebrow>
      <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
        Upload your resume.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-cream/58">
        Helix only uses evidence it can verify from your PDF or DOCX.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          onDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragging(false);
          onFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className={[
          "mt-8 min-h-72 rounded-[2rem] p-6 shadow-soft-inset transition sm:p-8",
          dragging ? "bg-cream/12" : file ? "bg-[#71d6a5]/[0.08]" : "bg-white/[0.045]"
        ].join(" ")}
      >
        <div className="flex min-h-52 flex-col items-center justify-center text-center">
          {file ? (
            <>
              <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#71d6a5]/14 text-[#9be8c1] shadow-soft-inset">
                <FileCheck2 size={24} />
              </span>
              <p className="mt-5 max-w-md truncate font-semibold text-cream">{file.name}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/35">
                {formatBytes(file.size)} · Awaiting resume verification
              </p>
              <button
                type="button"
                onClick={() => {
                  onFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                  inputRef.current?.click();
                }}
                className="mt-5 inline-flex items-center gap-2 text-sm text-cream/45 hover:text-cream"
              >
                <X size={14} /> Choose another
              </button>
            </>
          ) : (
            <>
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cream text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]">
                <FileUp size={23} />
              </span>
              <p className="mt-5 text-xl font-semibold text-cream">Drop your resume here</p>
              <p className="mt-2 text-sm text-cream/42">PDF or DOCX · Maximum 6 MB</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-6 min-h-11 rounded-2xl bg-white/[0.065] px-5 text-sm font-semibold text-cream shadow-soft-inset transition hover:bg-white/[0.11]"
              >
                Browse files
              </button>
            </>
          )}
        </div>
      </div>
      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl bg-[#ff9898]/[0.08] px-4 py-3 text-sm text-[#ffc2c2] shadow-soft-inset"
        >
          {error}
        </div>
      ) : null}
      <div className="mt-6 flex items-start gap-3 text-xs leading-5 text-cream/38">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <p>
          Processed in memory. Helix saves only the interview profile and verification metadata.
        </p>
      </div>
      <button
        type="button"
        disabled={!file}
        onClick={onAnalyze}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
      >
        Verify resume <ArrowRight size={15} />
      </button>
    </>
  );
}

function ResumeIdentityStep({
  result,
  onReplace,
  onContinue
}: {
  result: ResumeExtractionResponse;
  onReplace: () => void;
  onContinue: () => void;
}) {
  const { extraction } = result;
  return (
    <>
      <BackButton onClick={onReplace} />
      <Eyebrow icon={ShieldCheck}>Resume verified</Eyebrow>
      <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
        Resume verified.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-cream/54">
        Helix found your identity and enough evidence to build practice rounds.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)]">
        <div className="rounded-[2rem] bg-white/[0.045] p-5 shadow-soft-inset sm:p-6">
          <p className="blueprint-label text-cream/38">Candidate identity</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
            {extraction.fullName || "Verified candidate"}
          </h2>
          <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-6 text-cream/56 sm:line-clamp-none sm:text-base sm:leading-7">
            {extraction.headline}
          </p>
          <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
            {extraction.document.sections.slice(0, 7).map((section) => (
              <span
                key={section}
                className="rounded-full bg-white/[0.065] px-3 py-1.5 text-xs capitalize text-cream/62 shadow-soft-inset"
              >
                {section}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-[2rem] bg-[#71d6a5]/[0.08] p-5 shadow-soft-inset">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#71d6a5]/14 text-[#b5efd2]">
            <FileCheck2 size={19} />
          </div>
          <div className="mt-8">
            <p className="text-4xl font-semibold text-[#c8f4dc]">{extraction.confidence}%</p>
            <p className="mt-1 text-xs font-medium text-[#b5efd2]/75">Verification confidence</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalysisMetric
          label="Format"
          value={extraction.document.format.toUpperCase()}
          icon={FileText}
        />
        <AnalysisMetric
          label={extraction.document.pageCountEstimated ? "Est. pages" : "Pages"}
          value={String(extraction.document.pageCount)}
          icon={FileText}
        />
        <AnalysisMetric
          label="Sections"
          value={String(extraction.document.sections.length)}
          icon={Blocks}
        />
        <AnalysisMetric
          label="Date ranges"
          value={String(extraction.evidence.dateRanges)}
          icon={BarChart3}
        />
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]"
        >
          Review evidence <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={onReplace}
          className="min-h-12 rounded-2xl px-4 text-sm font-semibold text-cream/50 hover:bg-white/[0.07] hover:text-cream"
        >
          Choose a different file
        </button>
      </div>
    </>
  );
}

function ResumeEvidenceStep({
  result,
  onBack,
  onContinue
}: {
  result: ResumeExtractionResponse;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { extraction } = result;
  return (
    <>
      <BackButton onClick={onBack} />
      <Eyebrow icon={BriefcaseBusiness}>Career evidence</Eyebrow>
      <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
        Evidence Helix can use.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/54">
        Verified projects, education, and wins become the source for practice.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalysisMetric
          label="Experience"
          value={String(extraction.experience.length)}
          icon={BriefcaseBusiness}
        />
        <AnalysisMetric label="Projects" value={String(extraction.projects.length)} icon={Blocks} />
        <AnalysisMetric
          label="Education"
          value={String(extraction.education.length)}
          icon={GraduationCap}
        />
        <AnalysisMetric
          label="Measured wins"
          value={String(extraction.evidence.quantifiedAchievements)}
          icon={Trophy}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
        <div className="surface overflow-hidden p-0">
          <div className="px-6 py-5 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-[#b5efd2] shadow-soft-inset">
                <BriefcaseBusiness size={17} />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight text-cream">
                  Experience timeline
                </p>
                <p className="mt-1 text-sm text-cream/42">Only entries traced to the resume.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4">
            {extraction.experience.slice(0, 4).map((entry, index) => (
              <article
                key={`${entry.organization}-${entry.role}-${entry.period}`}
                className="grid gap-3 rounded-3xl bg-white/[0.04] px-5 py-4 shadow-soft-inset sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#71d6a5]/14 font-mono text-[11px] font-semibold text-[#b5efd2]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-cream">{entry.role || "Role not listed"}</h2>
                  <p className="mt-1 text-sm text-cream/52">{entry.organization}</p>
                  {entry.summary ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-cream/40">
                      {entry.summary}
                    </p>
                  ) : null}
                  {entry.skills.length ? (
                    <p className="mt-2 truncate font-mono text-[10px] text-[#b5efd2]/62">
                      {entry.skills.slice(0, 5).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-mono text-[10px] text-cream/45">{entry.period}</p>
                  {entry.location ? (
                    <p className="mt-1 text-[10px] text-cream/28">{entry.location}</p>
                  ) : null}
                </div>
              </article>
            ))}
            {!extraction.experience.length ? (
              <div className="grid min-h-64 place-items-center rounded-3xl bg-white/[0.035] px-6 py-10 text-center shadow-soft-inset">
                <div className="max-w-md">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-cream text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]">
                    <Blocks size={22} />
                  </span>
                  <p className="mt-5 text-2xl font-semibold tracking-tight text-cream">
                    Project-led profile
                  </p>
                  <p className="mt-3 text-sm leading-6 text-cream/50">
                    No work role was listed. Helix will use verified projects and education.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="surface p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-cream/70 shadow-soft-inset">
                <Blocks size={17} />
              </span>
              <p className="text-lg font-semibold tracking-tight text-cream">Projects</p>
            </div>
            <div className="mt-5 grid gap-4">
              {extraction.projects.slice(0, 3).map((project) => (
                <div
                  key={project.name}
                  className="rounded-3xl bg-white/[0.04] p-4 shadow-soft-inset"
                >
                  <p className="text-base font-semibold text-cream">{project.name}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-cream/50">
                    {project.outcome || project.summary}
                  </p>
                </div>
              ))}
              {!extraction.projects.length ? (
                <p className="rounded-3xl bg-white/[0.035] p-4 text-sm leading-6 text-cream/42 shadow-soft-inset">
                  No separate named project section was verified.
                </p>
              ) : null}
            </div>
          </div>
          <div className="surface p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-cream/70 shadow-soft-inset">
                <GraduationCap size={17} />
              </span>
              <p className="text-lg font-semibold tracking-tight text-cream">Education</p>
            </div>
            <div className="mt-5 grid gap-3">
              {extraction.education.slice(0, 3).map((entry) => (
                <div
                  key={`${entry.institution}-${entry.credential}`}
                  className="rounded-3xl bg-white/[0.04] p-4 shadow-soft-inset"
                >
                  <p className="text-base font-semibold leading-6 text-cream">{entry.credential}</p>
                  <p className="mt-1.5 text-sm leading-5 text-cream/52">{entry.institution}</p>
                  {entry.period ? (
                    <p className="mt-3 font-mono text-[11px] text-cream/34">{entry.period}</p>
                  ) : null}
                </div>
              ))}
              {!extraction.education.length ? (
                <p className="rounded-3xl bg-white/[0.035] p-4 text-sm leading-6 text-cream/42 shadow-soft-inset">
                  No education entries were verified.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] sm:w-auto"
      >
        Build my interview profile <ArrowRight size={15} />
      </button>
    </>
  );
}

function ResumeReadinessStep({
  result,
  replacingResume,
  onBack,
  onContinue
}: {
  result: ResumeExtractionResponse;
  replacingResume: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { extraction } = result;
  return (
    <>
      <BackButton onClick={onBack} />
      <Eyebrow icon={CheckCircle2}>Interview profile ready</Eyebrow>
      <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-cream sm:text-5xl lg:text-6xl">
        Helix now knows where to push.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-cream/58">
        Your interview memory combines the role you want with the evidence you can defend.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="surface p-6">
          <p className="blueprint-label text-cream/38">Supported skills</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {extraction.skills.slice(0, 14).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-white/[0.065] px-3 py-1.5 text-xs text-cream/66 shadow-soft-inset"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="surface p-6">
          <p className="blueprint-label text-cream/38">Interview focus</p>
          <div className="mt-5 grid gap-3">
            {extraction.focusAreas.map((area, index) => (
              <div
                key={area}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-cream/66 shadow-soft-inset"
              >
                <span className="font-mono text-[10px] text-cream/34">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {area}
              </div>
            ))}
          </div>
        </div>
      </div>

      {extraction.warnings.length ? (
        <div className="mt-4 rounded-[2rem] bg-[#efcf84]/[0.07] p-5 shadow-soft-inset">
          <p className="text-sm font-semibold text-[#f4dda6]">Evidence Helix will challenge</p>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-cream/48 sm:grid-cols-2">
            {extraction.warnings.map((warning) => (
              <li key={warning} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#efcf84]" />
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] sm:w-auto"
      >
        {replacingResume ? "Back to my profile" : "Enter my workspace"} <ArrowRight size={15} />
      </button>
    </>
  );
}

function AnalysisMetric({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof FileText;
}) {
  return (
    <div className="min-w-0 rounded-3xl bg-white/[0.045] p-4 shadow-soft-inset sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs font-semibold text-cream/48">{label}</p>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-white/[0.055] text-cream/50 shadow-soft-inset">
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-cream">{value}</p>
    </div>
  );
}

function AnalysisState({
  fileName,
  activeStage,
  onCancel
}: {
  fileName: string;
  activeStage: number;
  onCancel: () => void;
}) {
  return (
    <main className="blueprint relative grid min-h-screen place-items-center overflow-hidden px-5">
      <div className="blueprint-glow" />
      <div className="surface-raised relative z-10 w-full max-w-2xl overflow-hidden p-6 text-center sm:p-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-cream text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]">
          <Loader2 size={30} className="animate-spin text-blueprint" />
        </div>
        <p className="blueprint-label mt-7 text-cream/38">Resume intelligence</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
          Building your interview memory
        </h1>
        <p className="mx-auto mt-3 max-w-md truncate text-sm text-cream/42">{fileName}</p>
        <div role="status" aria-live="polite" className="mt-9 grid gap-3 text-left">
          {analysisStages.map((stage, index) => {
            const Icon = stage.icon;
            const complete = index < activeStage;
            const active = index === activeStage;
            return (
              <div
                key={stage.label}
                className="flex min-h-16 items-center gap-4 rounded-3xl bg-white/[0.045] px-5 shadow-soft-inset"
              >
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-2xl",
                    complete
                      ? "bg-[#71d6a5]/14 text-[#9be8c1]"
                      : active
                        ? "bg-cream/[0.12] text-cream"
                        : "bg-white/[0.05] text-cream/25"
                  ].join(" ")}
                >
                  {complete ? (
                    <Check size={14} />
                  ) : active ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Icon size={14} />
                  )}
                </span>
                <span
                  className={
                    active || complete ? "text-sm font-medium text-cream" : "text-sm text-cream/30"
                  }
                >
                  {stage.label}
                </span>
                {complete ? (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-[#9be8c1]/70">
                    Done
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-cream/32">
          Keep this tab open. The original file is not stored.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 min-h-11 rounded-2xl px-4 text-sm font-medium text-cream/45 transition hover:bg-white/[0.07] hover:text-cream"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}

function OnboardingAside({
  step,
  role,
  level,
  file
}: {
  step: Step;
  role: Role | null;
  level: Level | null;
  file: File | null;
}) {
  const resumeVerified = step === "identity" || step === "evidence" || step === "readiness";

  return (
    <aside className="sticky top-8 hidden self-start lg:block">
      <div className="surface-raised overflow-hidden p-0">
        <div className="px-6 py-5 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-lg font-semibold tracking-tight text-cream">Interview memory</p>
          <p className="mt-2 text-sm leading-6 text-cream/42">Carried into each practice round.</p>
        </div>
        <div className="relative space-y-5 px-6 py-6 before:absolute before:bottom-8 before:left-[2.35rem] before:top-8 before:w-px before:bg-cream/12 before:content-['']">
          <MemoryLine
            label="Target role"
            value={roles.find((item) => item.value === role)?.label ?? "Not selected"}
            complete={Boolean(role)}
          />
          <MemoryLine
            label="Experience"
            value={levels.find((item) => item.value === level)?.label ?? "Not selected"}
            complete={Boolean(level)}
          />
          <MemoryLine
            label="Resume evidence"
            value={file?.name ?? (resumeVerified ? "Verified resume" : "Not uploaded")}
            complete={resumeVerified}
          />
        </div>
        <div className="bg-white/[0.035] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-sm leading-6 text-cream/42">
            Helix uses this context to ask questions anchored to your resume.
          </p>
        </div>
      </div>
    </aside>
  );
}

function MemoryLine({
  label,
  value,
  complete
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="relative z-10 flex min-h-11 items-start gap-3">
      <span
        className={[
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-soft-inset",
          complete ? "bg-[#71d6a5]/14 text-[#9be8c1]" : "bg-white/[0.055] text-cream/25"
        ].join(" ")}
      >
        {complete ? <Check size={11} /> : null}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-cream/42">{label}</p>
        <p className="mt-1 truncate text-base font-semibold text-cream/78">{value}</p>
      </div>
    </div>
  );
}
function Eyebrow({ icon: Icon, children }: { icon: typeof Code2; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/58 shadow-soft-inset">
      <Icon size={13} />
      {children}
    </div>
  );
}
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 mb-6 flex min-h-10 w-fit items-center gap-2 rounded-2xl px-3 text-sm font-medium text-cream/55 outline-none transition hover:bg-white/[0.07] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/60"
    >
      <ArrowLeft size={15} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}
function stepIndex(step: Step): number {
  return { role: 0, level: 1, resume: 2, identity: 3, evidence: 4, readiness: 5 }[step];
}
function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}
