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
  UserRoundSearch,
  X
} from "lucide-react";
import { HelixMark } from "@/components/helix-mark";
import { ApiClientError, uploadResume } from "@/lib/api-client";
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
      <div className="relative z-10 mx-auto flex min-h-screen min-h-[100svh] w-full max-w-[90rem] flex-col px-4 sm:px-7 lg:px-10 xl:px-12">
        <header className="flex min-h-20 items-center border-b border-cream/18">
          <div className="flex items-center gap-2.5 text-cream">
            <HelixMark className="h-7 w-7" />
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
                  "h-1 rounded-full transition-colors duration-500",
                  index <= stepIndex(step) ? "bg-cream" : "bg-cream/22"
                ].join(" ")}
              />
            ))}
          </div>
          <span className="ml-3 min-w-10 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-cream/48 sm:ml-5">
            {stepIndex(step) + 1} / {onboardingSteps.length}
          </span>
        </header>

        <div className="grid flex-1 content-start gap-10 pb-12 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-14 lg:pt-[clamp(3.5rem,8vh,6.5rem)] xl:gap-20">
          <section key={step} className="step-in w-full min-w-0 max-w-5xl">
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
      <Eyebrow icon={UserRoundSearch}>Your target</Eyebrow>
      <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.04] text-cream sm:text-4xl lg:text-5xl">
        Which role are you preparing for?
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-cream/52">
        This shapes the evidence Helix looks for, not just the question labels.
      </p>
      <div className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-9 sm:gap-3 lg:grid-cols-3">
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
                "group flex min-h-32 min-w-0 flex-col rounded-lg border p-4 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-cream/70 sm:min-h-36 sm:p-5",
                active
                  ? "border-cream bg-cream text-blueprint shadow-[0_18px_50px_rgba(10,27,79,0.22)]"
                  : "border-cream/20 bg-blueprint-deep/42 text-cream hover:-translate-y-0.5 hover:border-cream/48 hover:bg-cream/[0.06]"
              ].join(" ")}
            >
              <Icon size={20} className={active ? "text-blueprint" : "text-cream/50"} />
              <span className="mt-auto block pt-6 font-semibold sm:pt-7">{option.label}</span>
              <span
                className={
                  active
                    ? "mt-1 block text-xs leading-5 text-blueprint/62"
                    : "mt-1 block text-xs leading-5 text-cream/42"
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
      <Eyebrow icon={BarChart3}>Interview calibration</Eyebrow>
      <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.04] text-cream sm:text-4xl lg:text-5xl">
        How much experience should the interview expect?
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-cream/52">
        Helix changes depth, ownership expectations, and follow-up pressure at every level.
      </p>
      <div className="mt-9 divide-y divide-cream/10 overflow-hidden rounded-lg border border-cream/16 bg-blueprint-deep/52">
        {levels.map((option, index) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className="group grid min-h-20 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-4 px-5 text-left transition hover:bg-cream/[0.06]"
          >
            <span className="font-mono text-xs text-cream/28">0{index + 1}</span>
            <span>
              <span className="block font-semibold text-cream">{option.label}</span>
              <span className="mt-1 block text-sm text-cream/38">{option.detail}</span>
            </span>
            <span
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full border transition",
                selected === option.value
                  ? "border-cream bg-cream text-blueprint"
                  : "border-cream/18 text-cream/35 group-hover:border-cream/40"
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
      <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.04] text-cream sm:text-4xl lg:text-5xl">
        Bring the resume you actually use.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/52">
        Helix extracts only evidence it can find. Obvious templates, job descriptions, and mock
        resumes are rejected.
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
          "mt-9 min-h-64 rounded-lg border border-dashed p-6 transition",
          dragging
            ? "border-cream bg-cream/10"
            : file
              ? "border-cream/38 bg-cream/[0.06]"
              : "border-cream/22 bg-blueprint-deep/42"
        ].join(" ")}
      >
        <div className="flex min-h-52 flex-col items-center justify-center text-center">
          {file ? (
            <>
              <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#9be8c1]/30 bg-[#71d6a5]/10 text-[#9be8c1]">
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
              <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-cream/18 text-cream">
                <FileUp size={23} />
              </span>
              <p className="mt-5 font-semibold text-cream">Drop your resume here</p>
              <p className="mt-2 text-sm text-cream/38">PDF or DOCX · Maximum 6 MB</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-6 min-h-11 rounded-lg border border-cream/28 px-5 text-sm font-semibold text-cream transition hover:bg-cream/8"
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
          className="mt-4 rounded-lg border border-[#ff9898]/25 bg-[#ff9898]/[0.07] px-4 py-3 text-sm text-[#ffc2c2]"
        >
          {error}
        </div>
      ) : null}
      <div className="mt-6 flex items-start gap-3 text-xs leading-5 text-cream/38">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <p>
          The original file is processed in memory and is not retained. Helix stores the extracted
          interview profile and verification metadata.
        </p>
      </div>
      <button
        type="button"
        disabled={!file}
        onClick={onAnalyze}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-cream bg-cream px-6 text-sm font-semibold text-blueprint transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
      >
        Verify and build my profile <ArrowRight size={15} />
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
      <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.04] text-cream sm:text-4xl lg:text-5xl">
        Resume structure verified.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/52">
        Helix found a supported identity, contact structure, dated career timeline, and personal
        contribution evidence.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)]">
        <div className="rounded-lg border border-cream/20 bg-blueprint-deep/48 p-5 sm:p-6">
          <p className="blueprint-label text-cream/38">Candidate identity</p>
          <h2 className="mt-4 text-2xl font-semibold text-cream">
            {extraction.fullName || "Verified candidate"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/52">{extraction.headline}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {extraction.document.sections.slice(0, 7).map((section) => (
              <span
                key={section}
                className="rounded-full border border-cream/16 bg-cream/[0.04] px-3 py-1.5 text-xs capitalize text-cream/58"
              >
                {section}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-[#71d6a5]/28 bg-[#71d6a5]/[0.07] p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#9be8c1]/25 text-[#b5efd2]">
            <FileCheck2 size={19} />
          </div>
          <div className="mt-8">
            <p className="font-mono text-3xl text-[#c8f4dc]">{extraction.confidence}%</p>
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
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-cream bg-cream px-6 text-sm font-semibold text-blueprint"
        >
          Review extracted experience <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={onReplace}
          className="min-h-12 rounded-lg px-4 text-sm font-semibold text-cream/50 hover:bg-cream/[0.06] hover:text-cream"
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
      <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.04] text-cream sm:text-4xl lg:text-5xl">
        Here is what the interview can probe.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/52">
        These are evidence-backed entries from the resume, not generic questions inferred from a
        skill list.
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

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
        <div className="overflow-hidden rounded-lg border border-cream/18 bg-blueprint-deep/44">
          <div className="border-b border-cream/12 px-5 py-4">
            <p className="blueprint-label text-cream/38">Verified experience timeline</p>
          </div>
          <div className="divide-y divide-cream/10">
            {extraction.experience.slice(0, 4).map((entry, index) => (
              <article
                key={`${entry.organization}-${entry.role}-${entry.period}`}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
              >
                <span className="font-mono text-[10px] text-cream/28">
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
              <div className="px-5 py-7">
                <p className="text-sm font-semibold text-cream">Project-led profile</p>
                <p className="mt-2 text-xs leading-5 text-cream/42">
                  No professional role was listed. Maya will anchor the interview to the verified
                  projects and education below instead of inventing work experience.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-cream/18 bg-blueprint-deep/44 p-5">
            <p className="blueprint-label text-cream/38">Named projects</p>
            <div className="mt-4 space-y-4">
              {extraction.projects.slice(0, 3).map((project) => (
                <div key={project.name}>
                  <p className="text-sm font-semibold text-cream">{project.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-cream/42">
                    {project.outcome || project.summary}
                  </p>
                </div>
              ))}
              {!extraction.projects.length ? (
                <p className="text-xs leading-5 text-cream/38">
                  No separate named project section was verified.
                </p>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border border-cream/18 bg-blueprint-deep/44 p-5">
            <p className="blueprint-label text-cream/38">Education</p>
            {extraction.education.slice(0, 2).map((entry) => (
              <div key={`${entry.institution}-${entry.credential}`} className="mt-4">
                <p className="text-sm font-semibold text-cream">{entry.credential}</p>
                <p className="mt-1 text-xs text-cream/48">{entry.institution}</p>
                {entry.period ? (
                  <p className="mt-2 font-mono text-[10px] text-cream/30">{entry.period}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-cream bg-cream px-6 text-sm font-semibold text-blueprint sm:w-auto"
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
      <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.04] text-cream sm:text-4xl lg:text-5xl">
        Helix now knows where to push.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/52">
        Your interview memory combines the role you want with the evidence you can defend.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-cream/18 bg-blueprint-deep/44 p-5">
          <p className="blueprint-label text-cream/38">Supported skills</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {extraction.skills.slice(0, 14).map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-cream/16 bg-cream/[0.04] px-3 py-1.5 text-xs text-cream/62"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-cream/18 bg-blueprint-deep/44 p-5">
          <p className="blueprint-label text-cream/38">Interview focus</p>
          <div className="mt-4 space-y-2">
            {extraction.focusAreas.map((area, index) => (
              <div key={area} className="flex items-center gap-3 text-sm text-cream/62">
                <span className="font-mono text-[10px] text-cream/28">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {area}
              </div>
            ))}
          </div>
        </div>
      </div>

      {extraction.warnings.length ? (
        <div className="mt-3 rounded-lg border border-[#efcf84]/22 bg-[#efcf84]/[0.06] p-5">
          <p className="text-xs font-semibold text-[#f4dda6]">Evidence Helix will challenge</p>
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
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-cream bg-cream px-6 text-sm font-semibold text-blueprint sm:w-auto"
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
    <div className="min-w-0 rounded-lg border border-cream/16 bg-blueprint-deep/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[10px] uppercase tracking-[0.08em] text-cream/35">{label}</p>
        <Icon size={14} className="shrink-0 text-cream/34" />
      </div>
      <p className="mt-3 text-xl font-semibold text-cream">{value}</p>
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
      <div className="relative z-10 w-full max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-lg border border-cream/22 bg-cream/[0.06]">
          <Loader2 size={30} className="animate-spin text-cream" />
        </div>
        <p className="blueprint-label mt-7 text-cream/38">Resume intelligence</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
          Building your interview memory
        </h1>
        <p className="mx-auto mt-3 max-w-md truncate text-sm text-cream/42">{fileName}</p>
        <div
          role="status"
          aria-live="polite"
          className="mt-9 divide-y divide-cream/10 overflow-hidden rounded-lg border border-cream/16 bg-blueprint-deep/58 text-left"
        >
          {analysisStages.map((stage, index) => {
            const Icon = stage.icon;
            const complete = index < activeStage;
            const active = index === activeStage;
            return (
              <div key={stage.label} className="flex min-h-16 items-center gap-4 px-5">
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-lg border",
                    complete
                      ? "border-[#71d6a5]/30 bg-[#71d6a5]/10 text-[#9be8c1]"
                      : active
                        ? "border-cream/35 text-cream"
                        : "border-cream/12 text-cream/25"
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
          className="mt-5 min-h-11 rounded-lg px-4 text-sm font-medium text-cream/45 transition hover:bg-cream/[0.06] hover:text-cream"
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
      <div className="overflow-hidden rounded-lg border border-cream/20 bg-blueprint-deep/48 shadow-[0_24px_80px_rgba(10,27,79,0.18)] backdrop-blur-sm">
        <div className="border-b border-cream/12 px-5 py-4">
          <p className="blueprint-label text-cream/42">Your interview memory</p>
          <p className="mt-2 text-xs leading-5 text-cream/38">
            Context carried into every practice round.
          </p>
        </div>
        <div className="relative space-y-5 px-5 py-5 before:absolute before:bottom-8 before:left-[2rem] before:top-8 before:w-px before:bg-cream/12 before:content-['']">
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
        <div className="border-t border-cream/10 bg-cream/[0.025] px-5 py-4">
          <p className="text-xs leading-5 text-cream/36">
            Helix uses this context to ask questions that someone without your experience cannot
            answer generically.
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
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-blueprint-deep",
          complete
            ? "border-[#71d6a5]/30 bg-[#71d6a5]/10 text-[#9be8c1]"
            : "border-cream/14 text-cream/25"
        ].join(" ")}
      >
        {complete ? <Check size={11} /> : null}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.1em] text-cream/38">{label}</p>
        <p className="mt-1 truncate text-sm font-medium text-cream/72">{value}</p>
      </div>
    </div>
  );
}
function Eyebrow({ icon: Icon, children }: { icon: typeof Code2; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-cream/18 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/52">
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
      className="-ml-2 mb-6 flex min-h-9 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-cream/55 outline-none transition hover:bg-cream/[0.06] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/60"
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
