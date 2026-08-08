"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Blocks,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CalendarRange,
  CircleDashed,
  Code2,
  FileCheck2,
  FileText,
  FileType2,
  Files,
  FileUp,
  GraduationCap,
  Info,
  Loader2,
  ScanSearch,
  ShieldCheck,
  Sprout,
  Tags,
  Target,
  TriangleAlert,
  Sparkles,
  Trophy,
  X
} from "lucide-react";
import { ApiClientError, uploadResume } from "@/lib/api-client";
import { pageTitle } from "@/lib/seo";
import type { Level, ResumeExtractionResponse, Role } from "@/lib/types";

/** Shared across every role card; only the glyph and the copy change. */
const ROLE_ACCENT = "#5b9dff";

const roles: Array<{
  value: Role;
  label: string;
  detail: string;
  badge: string;
  image: string;
}> = [
  {
    value: "frontend",
    label: "Frontend",
    detail: "Build interfaces that stay fast, accessible and predictable.",
    badge: "Front-End",
    image: "/images/domain-images/frontend-domain.png"
  },
  {
    value: "backend",
    label: "Backend",
    detail: "Design APIs and data layers that hold up under load.",
    badge: "Back-End",
    image: "/images/domain-images/backend-domain.png"
  },
  {
    value: "fullstack",
    label: "Full-stack",
    detail: "Own the product end to end, browser to database.",
    badge: "Full Stack",
    image: "/images/domain-images/fullstack-domain.png"
  },
  {
    value: "data",
    label: "Data",
    detail: "Build pipelines and turn messy data into decisions.",
    badge: "Data",
    image: "/images/domain-images/data-domain.png"
  },
  {
    value: "ai-ml",
    label: "AI / ML",
    detail: "Train, evaluate and ship models that survive production.",
    badge: "AI / ML",
    image: "/images/domain-images/ai-ml-domain.png"
  },
  {
    value: "pm",
    label: "Product",
    detail: "Turn strategy and discovery into shipped outcomes.",
    badge: "Product",
    image: "/images/domain-images/pm-domain.png"
  }
];

const levels: Array<{
  value: Level;
  label: string;
  detail: string;
  icon: typeof Code2;
}> = [
  {
    value: "fresher",
    label: "Starting out",
    detail: "Student, intern, or first full-time role",
    icon: GraduationCap
  },
  {
    value: "0-2",
    label: "Early career",
    detail: "Up to 2 years of professional experience",
    icon: Sprout
  },
  {
    value: "3-5",
    label: "Mid-level",
    detail: "3–5 years with meaningful ownership",
    icon: BriefcaseBusiness
  },
  {
    value: "5-plus",
    label: "Senior+",
    detail: "5+ years leading systems or outcomes",
    icon: Trophy
  }
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

export function OnboardingFlow({
  replacingResume = false,
  // Let the dev preview harness open a step directly, with a stand-in
  // extraction for the steps that only exist after an upload. Production
  // passes neither, so the flow still always begins at the role picker with
  // no result.
  initialStep = "role",
  initialResult = null
}: {
  replacingResume?: boolean;
  initialStep?: Step;
  initialResult?: ResumeExtractionResponse | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useRef<AbortController | null>(null);
  const [step, setStep] = useState<Step>(initialStep);
  const [role, setRole] = useState<Role | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [result, setResult] = useState<ResumeExtractionResponse | null>(initialResult);
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
            : "Trailgrad could not process this resume. Try the original PDF or DOCX file."
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
        {/*
         * Just the stepper, centred, with no surface behind it. The bar used to
         * carry the wordmark and sit in its own panel, which made a six-step
         * progress indicator look like site chrome. The escape hatch is
         * absolutely positioned so it cannot pull the stepper off centre.
         */}
        <header className="relative mt-7 flex min-h-10 items-center justify-center">
          {replacingResume ? (
            <a
              href="/profile"
              className="absolute right-0 text-xs font-medium text-cream/45 transition hover:text-cream"
            >
              Keep my current resume
            </a>
          ) : null}
          <div className="flex items-center gap-3.5">
            <div
              className="grid w-32 grid-cols-6 gap-1.5 sm:w-52 sm:gap-2"
              aria-label={`Onboarding step ${stepIndex(step) + 1} of ${onboardingSteps.length}: ${onboardingSteps[stepIndex(step)]?.label}`}
            >
              {onboardingSteps.map((item, index) => (
                <span
                  key={item.value}
                  className={[
                    "h-1.5 rounded-full transition-colors duration-500",
                    index <= stepIndex(step) ? "bg-cream" : "bg-cream/25"
                  ].join(" ")}
                />
              ))}
            </div>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/48">
              {stepIndex(step) + 1} / {onboardingSteps.length}
            </span>
          </div>
        </header>

        <div className="grid flex-1 content-start gap-7 pb-12 pt-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
          {/* No surface: the step content sits straight on the blueprint, so
              the role cards are the only panels on the page. */}
          <section key={step} className="step-in w-full min-w-0">
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
        Pick the lane Trailgrad should prepare.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={[
                "group relative flex min-h-[17rem] min-w-0 flex-col overflow-hidden rounded-[1.5rem] p-6 text-left outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-cream/70 sm:p-7",
                // The dark ground is what lets the accent glow read at all — on
                // the blue panel these cards were three shades of the same hue.
                "bg-[#0d1424] hover:-translate-y-1 hover:bg-[#111a2e]",
                active
                  ? "shadow-[0_26px_60px_-30px_rgba(4,10,32,0.95)]"
                  : "shadow-[0_18px_44px_-28px_rgba(4,10,32,0.85)]"
              ].join(" ")}
              style={{
                boxShadow: active
                  ? `inset 0 0 0 1.5px ${ROLE_ACCENT}, 0 26px 60px -30px rgba(4,10,32,0.95)`
                  : undefined
              }}
            >
              {/* Soft bloom behind the glyph, the way the reference lights its
                  illustrations. */}
              <span
                aria-hidden
                className={[
                  "pointer-events-none absolute inset-0 rounded-[1.5rem] transition-opacity duration-300",
                  active ? "opacity-0" : "opacity-100"
                ].join(" ")}
                style={{ boxShadow: "inset 0 0 0 1px rgba(239,232,214,0.08)" }}
              />

              <div className="relative flex items-start justify-between gap-3">
                {/* The supplied artwork is transparent PNG, so it sits
                    directly on the card and over the bloom rather than inside
                    a tinted tile. next/image resizes and re-encodes it — the
                    sources are ~800px and 700-900KB each. */}
                <span className="relative block h-28 w-28 shrink-0 transition-transform duration-300 group-hover:scale-[1.06] sm:h-32 sm:w-32">
                  <Image
                    src={option.image}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(min-width: 1024px) 8rem, (min-width: 640px) 7rem, 7rem"
                    className="object-contain drop-shadow-[0_16px_28px_rgba(4,10,32,0.55)]"
                  />
                </span>

                {/* Neutral pill, blue dot — the badge itself is not tinted in
                    the reference, only the marker inside it. */}
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11.5px] font-medium text-cream/75 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.1)]">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: ROLE_ACCENT }}
                  />
                  {option.badge}
                </span>
              </div>

              <span className="relative mt-auto block pt-8 text-[1.6rem] font-semibold tracking-tight text-cream">
                {option.label}
              </span>
              <span className="relative mt-2 block text-[13.5px] leading-6 text-cream/50">
                {option.detail}
              </span>

              {active ? (
                <span
                  aria-hidden
                  className="absolute right-7 top-[4.5rem] grid h-6 w-6 place-items-center rounded-full sm:top-[5rem]"
                  style={{ backgroundColor: ROLE_ACCENT, color: "#0d1424" }}
                >
                  <Check size={13} strokeWidth={3} />
                </span>
              ) : null}
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
        Trailgrad adjusts depth and ownership expectations.
      </p>
      <div className="mt-8 grid gap-3">
        {levels.map((option, index) => {
          const Icon = option.icon;
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={[
                "group relative flex w-full items-center gap-4 overflow-hidden rounded-[1.35rem] bg-[#0d1424] p-4 text-left outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-[#111a2e] focus-visible:ring-2 focus-visible:ring-cream/70 sm:gap-5 sm:p-5",
                active ? "" : "shadow-[inset_0_0_0_1px_rgba(239,232,214,0.08)]"
              ].join(" ")}
              style={
                active
                  ? {
                      boxShadow: `inset 0 0 0 1.5px ${ROLE_ACCENT}, 0 20px 46px -26px rgba(4,10,32,0.95)`
                    }
                  : undefined
              }
            >
              <span
                className="relative grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: `linear-gradient(145deg, ${ROLE_ACCENT}2e, ${ROLE_ACCENT}0d)`,
                  boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}33`,
                  color: ROLE_ACCENT
                }}
              >
                <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
              </span>

              <span className="relative min-w-0 flex-1">
                <span className="block text-[1.05rem] font-semibold leading-tight text-cream sm:text-[1.15rem]">
                  {option.label}
                </span>
                <span className="mt-1 block text-[13px] leading-6 text-cream/45">
                  {option.detail}
                </span>
              </span>

              {/* Four ticks filling with seniority — the row used to show an
                  ordinal, which said nothing about where the level sits. */}
              <span aria-hidden className="relative hidden shrink-0 items-center gap-1 sm:flex">
                {levels.map((_, tick) => (
                  <span
                    key={tick}
                    className="h-6 w-[3px] rounded-full transition-colors duration-300"
                    style={{
                      backgroundColor: tick <= index ? ROLE_ACCENT : "rgba(239,232,214,0.12)",
                      opacity: tick <= index ? 1 - tick * 0.12 : 1
                    }}
                  />
                ))}
              </span>

              <span
                aria-hidden
                className="relative hidden h-9 w-px shrink-0 bg-cream/10 sm:block"
              />

              <span
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition"
                style={
                  active
                    ? { backgroundColor: ROLE_ACCENT, color: "#0d1424" }
                    : {
                        boxShadow: "inset 0 0 0 1px rgba(239,232,214,0.12)",
                        color: "rgba(239,232,214,0.35)"
                      }
                }
              >
                {active ? (
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                ) : (
                  <ArrowRight size={14} aria-hidden="true" />
                )}
              </span>
            </button>
          );
        })}
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
        Trailgrad only uses evidence it can verify from your PDF or DOCX.
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
        className="relative mt-8 min-h-72 overflow-hidden rounded-[1.5rem] bg-[#0d1424] p-6 transition duration-300 sm:p-8"
        style={{
          boxShadow: dragging
            ? `inset 0 0 0 2px ${ROLE_ACCENT}, 0 24px 56px -30px rgba(4,10,32,0.95)`
            : file
              ? `inset 0 0 0 1.5px ${ROLE_ACCENT}, 0 20px 46px -28px rgba(4,10,32,0.9)`
              : "inset 0 0 0 1px rgba(239,232,214,0.08)"
        }}
      >
        {/* A dashed inner edge, so the drop target reads as one even before
            anything is dragged over it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-3 rounded-[1.15rem] border border-dashed transition-colors duration-300"
          style={{ borderColor: dragging || file ? `${ROLE_ACCENT}59` : "rgba(239,232,214,0.1)" }}
        />

        <div className="relative flex min-h-52 flex-col items-center justify-center text-center">
          {file ? (
            <>
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl"
                style={{
                  background: `linear-gradient(145deg, ${ROLE_ACCENT}33, ${ROLE_ACCENT}0f)`,
                  boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}3d`,
                  color: ROLE_ACCENT
                }}
              >
                <FileCheck2 size={27} strokeWidth={1.8} />
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
                className="mt-5 inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm text-cream/45 transition hover:bg-white/[0.05] hover:text-cream"
              >
                <X size={14} /> Choose another
              </button>
            </>
          ) : (
            <>
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl"
                style={{
                  background: `linear-gradient(145deg, ${ROLE_ACCENT}33, ${ROLE_ACCENT}0f)`,
                  boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}3d`,
                  color: ROLE_ACCENT
                }}
              >
                <FileUp size={26} strokeWidth={1.8} />
              </span>
              <p className="mt-5 text-xl font-semibold text-cream">Drop your resume here</p>
              <p className="mt-2 text-sm text-cream/42">PDF or DOCX · Maximum 6 MB</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-6 min-h-11 rounded-xl bg-white/[0.05] px-5 text-sm font-semibold text-cream shadow-[inset_0_0_0_1px_rgba(239,232,214,0.12)] transition hover:bg-white/[0.1]"
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
          className="mt-4 rounded-xl bg-[#ff9898]/[0.08] px-4 py-3 text-sm text-[#ffc2c2] shadow-[inset_0_0_0_1px_rgba(255,152,152,0.2)]"
        >
          {error}
        </div>
      ) : null}
      <div className="mt-5 flex items-start gap-3 rounded-[1.15rem] bg-[#0d1424] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)]">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}4d`, color: ROLE_ACCENT }}
        >
          <ShieldCheck size={15} strokeWidth={1.9} />
        </span>
        <p className="pt-1 text-[13px] leading-6 text-cream/45">
          Processed in memory. Trailgrad saves only the interview profile and verification metadata.
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
        Trailgrad found your identity and enough evidence to build practice rounds.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.6fr)] sm:items-stretch">
        <div className="rounded-[1.5rem] bg-[#0d1424] p-5 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.08)] sm:p-6">
          <div className="flex items-start gap-4">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
              style={{
                background: `linear-gradient(145deg, ${ROLE_ACCENT}33, ${ROLE_ACCENT}0f)`,
                boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}3d`,
                color: ROLE_ACCENT
              }}
            >
              <BadgeCheck size={26} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="blueprint-label text-cream/38">Candidate identity</p>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
                {extraction.fullName || "Verified candidate"}
              </h2>
            </div>
          </div>
          <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-6 text-cream/56 sm:line-clamp-none sm:text-base sm:leading-7">
            {extraction.headline}
          </p>
          <p className="mt-6 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-cream/30">
            Sections found
          </p>
          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
            {extraction.document.sections.slice(0, 7).map((section) => (
              <span
                key={section}
                className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs capitalize text-cream/62 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.1)]"
              >
                {section}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-[1.5rem] bg-[#0d1424] p-5 text-center shadow-[inset_0_0_0_1px_rgba(239,232,214,0.08)]">
          {/* A ring reads as a score; the bare number read as a stat label. */}
          <div className="relative h-28 w-28">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img">
              <title>{`Verification confidence ${extraction.confidence} percent`}</title>
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(239,232,214,0.09)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={ROLE_ACCENT}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - extraction.confidence / 100)}
              />
            </svg>
            <div className="absolute inset-0 grid place-content-center">
              <span
                className="text-[1.75rem] font-semibold leading-none tabular-nums"
                style={{ color: ROLE_ACCENT }}
              >
                {extraction.confidence}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-cream">Verification confidence</p>
            <p className="mt-1 text-xs leading-5 text-cream/40">
              How much of this resume Trailgrad could confirm.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <AnalysisMetric
          label="Format"
          value={extraction.document.format.toUpperCase()}
          icon={FileType2}
        />
        <AnalysisMetric
          label={extraction.document.pageCountEstimated ? "Est. pages" : "Pages"}
          value={String(extraction.document.pageCount)}
          icon={Files}
        />
        <AnalysisMetric
          label="Sections"
          value={String(extraction.document.sections.length)}
          icon={Blocks}
        />
        <AnalysisMetric
          label="Date ranges"
          value={String(extraction.evidence.dateRanges)}
          icon={CalendarRange}
        />
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] transition hover:bg-white"
        >
          Review evidence <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={onReplace}
          className="min-h-12 rounded-2xl px-4 text-sm font-semibold text-cream/50 hover:bg-cream/[0.10] hover:text-cream"
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
        Evidence Trailgrad can use.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-cream/54">
        Verified projects, education, and wins become the source for practice.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      {/* items-start: without it the shorter panel stretches to match the
          taller column and ends in a block of dead space. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(21rem,1fr)] lg:items-start">
        <EvidencePanel
          icon={BriefcaseBusiness}
          title="Experience timeline"
          caption="Only entries traced to the resume."
          count={extraction.experience.length}
        >
          {extraction.experience.length ? (
            /* A rail down the left with a node per role, so the entries read as
               a chronology rather than four unrelated cards. */
            <ol className="relative grid gap-3 before:absolute before:bottom-6 before:left-[1.3rem] before:top-6 before:w-px before:bg-cream/10 before:content-['']">
              {extraction.experience.slice(0, 4).map((entry) => (
                <li
                  key={`${entry.organization}-${entry.role}-${entry.period}`}
                  className="relative grid gap-x-4 gap-y-3 rounded-[1.15rem] bg-white/[0.03] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)] sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:items-start sm:p-5"
                >
                  <span
                    className="relative z-10 grid h-[2.75rem] w-[2.75rem] shrink-0 place-items-center rounded-full"
                    style={{
                      background: `linear-gradient(145deg, ${ROLE_ACCENT}2e, ${ROLE_ACCENT}0d)`,
                      boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}33, 0 0 0 5px #0d1424`,
                      color: ROLE_ACCENT
                    }}
                  >
                    <BriefcaseBusiness size={16} strokeWidth={1.9} aria-hidden="true" />
                  </span>

                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold leading-6 text-cream">
                      {entry.role || "Role not listed"}
                    </h2>
                    <p className="mt-1 truncate text-[14.5px] text-cream/60">
                      {entry.organization}
                    </p>
                    {entry.summary ? (
                      <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-6 text-cream/45">
                        {entry.summary}
                      </p>
                    ) : null}
                    {entry.skills.length ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {entry.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                            style={{
                              backgroundColor: `${ROLE_ACCENT}14`,
                              color: `${ROLE_ACCENT}d9`
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-left sm:pt-0.5 sm:text-right">
                    <p className="whitespace-nowrap font-mono text-[11.5px] text-cream/50">
                      {entry.period}
                    </p>
                    {entry.location ? (
                      <p className="mt-1 whitespace-nowrap text-[11.5px] text-cream/32">
                        {entry.location}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EvidenceEmpty
              icon={Blocks}
              title="Project-led profile"
              body="No work role was listed. Trailgrad will use verified projects and education."
            />
          )}
        </EvidencePanel>

        <div className="grid content-start gap-4">
          <EvidencePanel icon={Blocks} title="Projects" count={extraction.projects.length}>
            {extraction.projects.length ? (
              <div className="grid gap-2.5">
                {extraction.projects.slice(0, 3).map((project) => (
                  <div
                    key={project.name}
                    className="rounded-[1.15rem] bg-white/[0.03] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]"
                  >
                    <p className="text-[16px] font-semibold leading-6 text-cream">{project.name}</p>
                    <p className="mt-2 line-clamp-3 text-[13.5px] leading-6 text-cream/50">
                      {project.outcome || project.summary}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EvidenceEmpty
                icon={Blocks}
                title="No named projects"
                body="No separate project section was verified."
              />
            )}
          </EvidencePanel>

          <EvidencePanel icon={GraduationCap} title="Education" count={extraction.education.length}>
            {extraction.education.length ? (
              <div className="grid gap-2.5">
                {extraction.education.slice(0, 3).map((entry) => (
                  <div
                    key={`${entry.institution}-${entry.credential}`}
                    className="rounded-[1.15rem] bg-white/[0.03] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]"
                  >
                    <p className="text-[16px] font-semibold leading-6 text-cream">
                      {entry.credential}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-6 text-cream/55">
                      {entry.institution}
                    </p>
                    {entry.period ? (
                      <p className="mt-3 font-mono text-[11.5px] text-cream/38">{entry.period}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EvidenceEmpty
                icon={GraduationCap}
                title="No education listed"
                body="No education entries were verified."
              />
            )}
          </EvidencePanel>
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

/** Section shell for the evidence step: header glyph, title, and a count. */
function EvidencePanel({
  icon: Icon,
  title,
  caption,
  count,
  children
}: {
  icon: typeof Blocks;
  title: string;
  caption?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] bg-[#0d1424] shadow-[inset_0_0_0_1px_rgba(239,232,214,0.08)]">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{
            background: `linear-gradient(145deg, ${ROLE_ACCENT}2e, ${ROLE_ACCENT}0d)`,
            boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}33`,
            color: ROLE_ACCENT
          }}
        >
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-cream">{title}</p>
          {caption ? <p className="mt-0.5 text-[12.5px] text-cream/42">{caption}</p> : null}
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums"
          style={{ backgroundColor: `${ROLE_ACCENT}14`, color: ROLE_ACCENT }}
        >
          {count}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Shared empty state, so a thin resume still looks deliberate. */
function EvidenceEmpty({
  icon: Icon,
  title,
  body
}: {
  icon: typeof Blocks;
  title: string;
  body: string;
}) {
  return (
    <div className="grid place-items-center rounded-[1.15rem] bg-white/[0.03] px-6 py-10 text-center shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]">
      <div className="max-w-sm">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full"
          style={{ boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}40`, color: ROLE_ACCENT }}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <p className="mt-4 text-lg font-semibold tracking-tight text-cream">{title}</p>
        <p className="mt-2 text-[13px] leading-6 text-cream/45">{body}</p>
      </div>
    </div>
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
        Trailgrad now knows where to push.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-cream/58">
        Your interview memory combines the role you want with the evidence you can defend.
      </p>

      {/*
       * Stacked full width rather than side by side. A wrapping chip cloud and
       * a five-row list have unrelated heights: stretching them left dead space
       * inside the short panel, and top-aligning them left an L-shaped void
       * beside it. Full width lets each one size to its own content, and the
       * focus list spreads across columns instead of running down the page.
       */}
      <div className="mt-8 grid gap-4">
        <EvidencePanel icon={Tags} title="Supported skills" count={extraction.skills.length}>
          <div className="flex flex-wrap gap-2">
            {extraction.skills.slice(0, 14).map((skill) => (
              <span
                key={skill}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium"
                style={{ backgroundColor: `${ROLE_ACCENT}14`, color: `${ROLE_ACCENT}d9` }}
              >
                {skill}
              </span>
            ))}
          </div>
        </EvidencePanel>

        <EvidencePanel icon={Target} title="Interview focus" count={extraction.focusAreas.length}>
          <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {extraction.focusAreas.map((area, index) => (
              <li
                key={area}
                className="flex items-center gap-3.5 rounded-[1.15rem] bg-white/[0.03] px-4 py-3.5 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold tabular-nums"
                  style={{ backgroundColor: `${ROLE_ACCENT}14`, color: ROLE_ACCENT }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 truncate text-[15px] font-medium text-cream/85">
                  {area}
                </span>
              </li>
            ))}
          </ol>
        </EvidencePanel>
      </div>

      {extraction.warnings.length ? (
        <div className="mt-4 overflow-hidden rounded-[1.5rem] bg-[#0d1424] shadow-[inset_0_0_0_1px_rgba(239,232,214,0.08)]">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
              style={{
                background: "linear-gradient(145deg, #f4c65a2e, #f4c65a0d)",
                boxShadow: "inset 0 0 0 1px #f4c65a33",
                color: "#f4c65a"
              }}
            >
              <TriangleAlert size={19} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold tracking-tight text-cream">
                Evidence Trailgrad will challenge
              </p>
              <p className="mt-0.5 text-[12.5px] text-cream/42">
                Expect these to come up in a round.
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums"
              style={{ backgroundColor: "#f4c65a14", color: "#f4c65a" }}
            >
              {extraction.warnings.length}
            </span>
          </div>
          <ul className="grid gap-2.5 p-4 sm:grid-cols-2">
            {extraction.warnings.map((warning) => (
              <li
                key={warning}
                className="flex gap-3 rounded-[1.15rem] bg-white/[0.03] p-4 text-[13.5px] leading-6 text-cream/55 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]"
              >
                <span
                  aria-hidden
                  className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "#f4c65a" }}
                />
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
    <div className="flex min-w-0 items-center gap-3.5 rounded-[1.15rem] bg-[#0d1424] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)] sm:p-4">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
        style={{
          background: `linear-gradient(145deg, ${ROLE_ACCENT}2e, ${ROLE_ACCENT}0d)`,
          boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}33`,
          color: ROLE_ACCENT
        }}
      >
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p
          className="truncate text-[10.5px] font-semibold uppercase tracking-[0.11em]"
          style={{ color: `${ROLE_ACCENT}c7` }}
        >
          {label}
        </p>
        <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-cream">{value}</p>
      </div>
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
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-[#0d1424] p-6 text-center shadow-[inset_0_0_0_1px_rgba(239,232,214,0.08),0_30px_80px_-40px_rgba(4,10,32,0.9)] sm:p-8">
        <div
          className="relative mx-auto grid h-20 w-20 place-items-center rounded-2xl"
          style={{
            background: `linear-gradient(145deg, ${ROLE_ACCENT}33, ${ROLE_ACCENT}0f)`,
            boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}3d`,
            color: ROLE_ACCENT
          }}
        >
          <Loader2 size={32} strokeWidth={1.9} className="animate-spin" />
        </div>
        <p className="blueprint-label relative mt-7 text-cream/38">Resume intelligence</p>
        <h1 className="relative mt-3 text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
          Building your interview memory
        </h1>
        <p className="relative mx-auto mt-3 max-w-md truncate text-sm text-cream/42">{fileName}</p>
        <div role="status" aria-live="polite" className="relative mt-9 grid gap-2.5 text-left">
          {analysisStages.map((stage, index) => {
            const Icon = stage.icon;
            const complete = index < activeStage;
            const active = index === activeStage;
            return (
              <div
                key={stage.label}
                className="flex min-h-16 items-center gap-4 rounded-[1.15rem] bg-white/[0.03] px-5 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-300"
                  style={
                    complete || active
                      ? {
                          background: `linear-gradient(145deg, ${ROLE_ACCENT}2e, ${ROLE_ACCENT}0d)`,
                          boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}33`,
                          color: ROLE_ACCENT
                        }
                      : {
                          boxShadow: "inset 0 0 0 1px rgba(239,232,214,0.1)",
                          color: "rgba(239,232,214,0.25)"
                        }
                  }
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
                  <span
                    className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em]"
                    style={{ color: `${ROLE_ACCENT}b3` }}
                  >
                    Done
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="relative mt-6 text-xs text-cream/32">
          Keep this tab open. The original file is not stored.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 min-h-11 rounded-2xl px-4 text-sm font-medium text-cream/45 transition hover:bg-cream/[0.10] hover:text-cream"
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
      {/* Same ground and accent as the role cards, so the running summary reads
          as part of the same set rather than a separate widget. */}
      <div className="overflow-hidden rounded-[1.5rem] bg-[#0d1424] shadow-[inset_0_0_0_1px_rgba(239,232,214,0.08),0_30px_80px_-40px_rgba(4,10,32,0.9)]">
        <div className="relative overflow-hidden px-6 pb-6 pt-6">
          <div className="relative flex items-start gap-3.5">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
              style={{
                background: `linear-gradient(145deg, ${ROLE_ACCENT}33, ${ROLE_ACCENT}10)`,
                boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}3d`,
                color: ROLE_ACCENT
              }}
            >
              <BrainCircuit size={22} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-lg font-semibold tracking-tight text-cream">Interview memory</p>
              <p className="mt-1 text-[13px] leading-6 text-cream/45">
                Carried into each practice round.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 px-4 pb-4">
          <MemoryLine
            icon={Target}
            label="Target role"
            value={roles.find((item) => item.value === role)?.label ?? "Not selected"}
            complete={Boolean(role)}
          />
          <MemoryLine
            icon={BriefcaseBusiness}
            label="Experience"
            value={levels.find((item) => item.value === level)?.label ?? "Not selected"}
            complete={Boolean(level)}
          />
          <MemoryLine
            icon={FileText}
            label="Resume evidence"
            value={file?.name ?? (resumeVerified ? "Verified resume" : "Not uploaded")}
            complete={resumeVerified}
          />

          <div className="flex items-start gap-3 rounded-[1.15rem] bg-white/[0.03] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}4d`, color: ROLE_ACCENT }}
            >
              <Info size={15} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <p className="pt-1 text-[13px] leading-6 text-cream/45">
              Trailgrad uses this context to ask questions anchored to your resume.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MemoryLine({
  icon: Icon,
  label,
  value,
  complete
}: {
  icon: typeof Target;
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[1.15rem] bg-white/[0.03] p-3.5 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.06)]">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
        style={{
          background: `linear-gradient(145deg, ${ROLE_ACCENT}2e, ${ROLE_ACCENT}0d)`,
          boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}33`,
          color: ROLE_ACCENT
        }}
      >
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.11em]"
          style={{ color: `${ROLE_ACCENT}c7` }}
        >
          {label}
        </p>
        <p className="mt-0.5 truncate text-[15px] font-semibold text-cream">{value}</p>
      </div>

      {/* Divider then status, so the state reads as a separate column rather
          than trailing text. */}
      <span aria-hidden className="h-9 w-px shrink-0 bg-cream/10" />

      <span
        className={[
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium",
          complete ? "" : "text-cream/40"
        ].join(" ")}
        style={
          complete
            ? {
                backgroundColor: `${ROLE_ACCENT}1a`,
                boxShadow: `inset 0 0 0 1px ${ROLE_ACCENT}3d`,
                color: ROLE_ACCENT
              }
            : { boxShadow: "inset 0 0 0 1px rgba(239,232,214,0.1)" }
        }
      >
        {complete ? (
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        ) : (
          <CircleDashed size={12} aria-hidden="true" />
        )}
        {complete ? "Added" : "Missing"}
      </span>
    </div>
  );
}

function Eyebrow({ icon: Icon, children }: { icon: typeof Code2; children: React.ReactNode }) {
  return (
    // Neutral fill rather than a panel colour: this pill sits on the blueprint on
    // some steps and on a dark panel on others.
    <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/58 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.1)]">
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
      className="-ml-2 mb-6 flex min-h-10 w-fit items-center gap-2 rounded-2xl px-3 text-sm font-medium text-cream/55 outline-none transition hover:bg-cream/[0.10] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/60"
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
