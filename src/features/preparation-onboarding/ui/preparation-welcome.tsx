"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Blocks,
  Building2,
  Braces,
  Check,
  Code2,
  Cpu,
  Loader2,
  Target,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  advancePreparationTarget,
  ApiClientError,
  startPreparationBaseline,
  submitPreparationBaseline
} from "@/lib/api/api-client";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import {
  BASELINE_DURATION_LABEL,
  baselineQuestionTeacherCue
} from "@/features/preparation-onboarding/domain/preparation-onboarding-flow";
import { suggestedPreparationRole } from "@/features/preparation-onboarding/domain/preparation-target";
import type { CandidateProfile, Role } from "@/lib/shared/types";
import {
  BaselineIntro,
  BaselineQuestionCard,
  baselineStageFor,
  welcomeProgressIndex
} from "./baseline-assessment";
import { InitialSkillProfile } from "./skill-profile-summary";
import {
  PreparationAreaGrid,
  TARGET_LEVEL_OPTIONS,
  TARGET_ROLE_OPTIONS,
  TARGET_SETUP_COPY,
  TARGET_TIMELINE_OPTIONS,
  TargetChoiceGrid,
  dateForTimeline,
  levelTarget,
  nextTargetStage,
  storedLevel,
  targetRoleLabel,
  targetStageFor,
  timelineTarget,
  type TargetLevel,
  type TargetTimeline
} from "./target-setup";
import {
  readWelcomePerformanceProfile,
  useWordReveal,
  WordRevealLine,
  WELCOME_BODY_STAGGER_MS
} from "./welcome-presentation";
import { useWelcomeVoice, voiceLabel } from "./welcome-voice";

const AvatarStage = dynamic(
  () => import("@/features/interviews/ui/voice/avatar-stage").then((module) => module.AvatarStage),
  { ssr: false }
);

const FALLBACK_WELCOME_SLIDE = {
  eyebrow: "Roadmap ready",
  title: "Your roadmap is ready.",
  body: "I prepared your interview roadmap and I am ready to walk you through the first step.",
  icon: Check
};

interface PreparationWelcomeProps {
  profile: CandidateProfile;
  /** Mandatory onboarding has no dismiss affordance or escape hatch. */
  blocking?: boolean;
}

export function PreparationWelcome({ profile, blocking = true }: PreparationWelcomeProps) {
  const teacher = useWorkspaceTeacher();
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const userControlledScroll = useRef(false);
  const [step, setStep] = useState(0);
  const [onboarding, setOnboarding] = useState(profile.preparationOnboarding);
  const [targetStage, setTargetStage] = useState(() =>
    targetStageFor(profile.preparationOnboarding.stage)
  );
  const [resumeSuggestedRole] = useState<Role>(() =>
    suggestedPreparationRole({
      stage: profile.preparationOnboarding.stage,
      savedRole: profile.targetRole,
      resume: profile.resume
    })
  );
  const [targetRole, setTargetRole] = useState<Role>(resumeSuggestedRole);
  const [targetLevel, setTargetLevel] = useState<TargetLevel>(() => levelTarget(profile.level));
  const [targetTimeline, setTargetTimeline] = useState<TargetTimeline>(() =>
    timelineTarget(profile.targetDate)
  );
  const [targetCompany, setTargetCompany] = useState(profile.targetCompany);
  const [baselineStage, setBaselineStage] = useState(() =>
    baselineStageFor(profile.preparationOnboarding.stage)
  );
  const [baselineChoice, setBaselineChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [touchPresentation, setTouchPresentation] = useState(false);
  const [lightweightAvatar, setLightweightAvatar] = useState(false);
  const visible = mounted;
  const resume = profile.resume;
  const alreadyOnboarded = profile.preparationOnboarding.completedAt !== null;
  const firstName = resume?.fullName.trim().split(/\s+/)[0] || "there";
  const topEvidence = resume?.experience[0]
    ? `${resume.experience[0].role || "your work"} at ${resume.experience[0].organization}`
    : resume?.projects[0]?.name || profile.headline || "your resume evidence";

  const slides = useMemo(() => {
    const baseTargetCopy = TARGET_SETUP_COPY[targetStage] ?? TARGET_SETUP_COPY[0];
    const targetCopy =
      targetStage === 0
        ? {
            ...baseTargetCopy,
            body:
              profile.preparationOnboarding.stage === "target_role"
                ? `${targetRoleLabel(resumeSuggestedRole)} is our best guess from your resume. You can change it before the assessment.`
                : `${targetRoleLabel(targetRole)} is your saved preparation track. You can change it before the assessment.`
          }
        : baseTargetCopy;
    return [
      {
        eyebrow: "Background understood",
        title: `Hi ${firstName}, I’m ${teacher.name}.`,
        body: `I’ve looked through your background, including ${topEvidence} and ${resume?.skills.length ?? 0} supported skills. Now let’s make sure I’m preparing you for the right job.`,
        icon: Check
      },
      { ...targetCopy, icon: Target }
    ];
  }, [
    firstName,
    profile.preparationOnboarding.stage,
    resume?.skills.length,
    resumeSuggestedRole,
    targetRole,
    targetStage,
    teacher.name,
    topEvidence
  ]);

  const activeBaselineSection =
    baselineStage && baselineStage !== "intro" && baselineStage !== "completed"
      ? baselineStage
      : null;
  const activeBaselineQuestion = useMemo(
    () => (activeBaselineSection ? (onboarding.questions[activeBaselineSection] ?? null) : null),
    [activeBaselineSection, onboarding.questions]
  );
  const baselineSlide = useMemo(() => {
    if (baselineStage === "intro") {
      return {
        eyebrow: `Short baseline · ${BASELINE_DURATION_LABEL}`,
        title: "Let’s find your starting point.",
        body:
          targetRole === "ai-ml"
            ? "This is not about measuring everything today. A stack-aware technical pulse, an engineering scenario, and one architecture decision are enough for a useful starting picture."
            : "This is not about measuring everything today. A short DSA pulse, a stack-aware technical pulse, an engineering scenario, and one architecture decision are enough for a useful starting picture.",
        icon: Target
      };
    }
    if (baselineStage === "completed") {
      if (alreadyOnboarded) {
        return {
          eyebrow: "Welcome back",
          title: "You’re already onboarded.",
          body: "Your learning path is ready and waiting for you. Enjoy learning, keep building momentum, and take the next step whenever you’re ready.",
          icon: Check
        };
      }
      return {
        eyebrow: "First Skill Profile",
        title: "We have your first evidence.",
        body: "This is a starting picture, not a readiness verdict. Trailgrad will earn real scores from your future practice and interviews—not invent them today.",
        icon: Check
      };
    }
    if (activeBaselineQuestion) {
      return {
        eyebrow: "",
        title: activeBaselineQuestion.title,
        body: "",
        voiceText: `${baselineQuestionTeacherCue(activeBaselineQuestion.section, onboarding.questionIds[activeBaselineQuestion.section])} ${activeBaselineQuestion.prompt}`,
        icon: activeBaselineQuestion.section.startsWith("dsa-")
          ? Braces
          : activeBaselineQuestion.section.startsWith("technical-")
            ? Code2
            : activeBaselineQuestion.section === "architecture"
              ? Blocks
              : Cpu
      };
    }
    return null;
  }, [activeBaselineQuestion, alreadyOnboarded, baselineStage, onboarding.questionIds, targetRole]);
  const current = baselineSlide ?? slides[step] ?? slides[0] ?? FALLBACK_WELCOME_SLIDE;
  const titleReveal = useWordReveal(current.title, visible, 160);
  const bodyReveal = useWordReveal(
    current.body,
    visible,
    640,
    touchPresentation ? 0 : WELCOME_BODY_STAGGER_MS
  );
  const { voiceState, speaking, awaitingGesture, stopVoice, toggleVoice } = useWelcomeVoice({
    teacherId: teacher.id,
    current,
    slides,
    visible,
    touchPresentation,
    step,
    targetStage,
    baselineStage,
    activeBaselineSection,
    onboarding,
    targetRole
  });

  const dismiss = useCallback(
    (destination = "/") => {
      if (blocking) return;
      stopVoice();
      window.location.replace(destination);
    },
    [blocking, stopVoice]
  );

  useEffect(() => {
    if (!activeBaselineSection) return;
    const answer = onboarding.answers[activeBaselineSection];
    setBaselineChoice(answer?.choiceId ?? "");
  }, [activeBaselineSection, onboarding.answers]);

  useEffect(() => {
    const profile = readWelcomePerformanceProfile();
    setTouchPresentation(profile.touchPresentation);
    setLightweightAvatar(profile.lightweightAvatar);
    setMounted(true);
  }, []);

  useEffect(() => {
    // The workspace scrolls the document, and locking <body> alone left the
    // page drifting behind the dialog, taking the app header with it.
    const root = document.documentElement;
    const previous = { root: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !blocking) dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previous.root;
      document.body.style.overflow = previous.body;
      stopVoice();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss, stopVoice]);

  useEffect(() => {
    const node = contentScrollRef.current;
    if (!node) return;

    userControlledScroll.current = false;
    node.scrollTo({ top: 0 });

    const timer = window.setTimeout(() => {
      if (userControlledScroll.current) return;
      const hiddenContent = node.scrollHeight - node.clientHeight;
      if (hiddenContent <= 24) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollTo({
        top: hiddenContent,
        behavior: reducedMotion ? "auto" : "smooth"
      });
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [baselineStage, step, targetStage, visible]);

  async function advanceTargetSetup() {
    const nextStage = nextTargetStage(targetStage);
    if (!nextStage) return;

    setSaving(true);
    setTargetError(null);
    try {
      const result = await advancePreparationTarget({
        targetRole,
        level: storedLevel(targetLevel, profile.level),
        targetCompany: targetCompany.trim(),
        targetDate: dateForTimeline(targetTimeline),
        nextStage
      });
      setOnboarding(result.state);
      if (nextStage === "baseline_intro") {
        setBaselineStage("intro");
      } else {
        setTargetStage(targetStageFor(result.state.stage));
      }
    } catch (error) {
      setTargetError(
        error instanceof ApiClientError
          ? error.message
          : "Your target could not be saved. Nothing else changed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function beginBaseline() {
    setSaving(true);
    setTargetError(null);
    try {
      const result = await startPreparationBaseline();
      setOnboarding(result.state);
      setBaselineStage(baselineStageFor(result.state.stage));
    } catch (error) {
      setTargetError(
        error instanceof ApiClientError
          ? error.message
          : "The baseline could not start. Your target setup is still saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveBaselineAnswer() {
    if (!activeBaselineSection || !baselineChoice) return;

    setSaving(true);
    setTargetError(null);
    try {
      const result = await submitPreparationBaseline({
        section: activeBaselineSection,
        choiceId: baselineChoice
      });
      setOnboarding(result.state);
      setBaselineStage(baselineStageFor(result.state.stage));
    } catch (error) {
      setTargetError(
        error instanceof ApiClientError
          ? error.message
          : "That answer could not be saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function finishPreparationOnboarding() {
    stopVoice();
    window.location.replace("/");
  }

  if (!visible || !mounted || !current) return null;
  const Icon = current.icon;
  const baselineResponseReady = Boolean(baselineChoice);

  // Rendered into <body>: the workspace wraps pages in `relative z-10`, which
  // traps any z-index inside it underneath the app header.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maya-welcome-title"
      data-workspace-accent={profile.workspaceAccent}
      className="maya-welcome-backdrop workspace-black fixed inset-0 z-[90] grid place-items-center overflow-x-clip bg-black p-3 sm:p-6"
    >
      <span
        aria-hidden
        className="maya-welcome-ambient pointer-events-none absolute left-[18%] top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] opacity-15 blur-[140px]"
      />
      <span
        aria-hidden
        className="maya-welcome-ambient pointer-events-none absolute right-[15%] top-[38%] h-[22rem] w-[22rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-15 blur-[150px]"
      />
      {/* Rows on small screens: the avatar takes a capped share and the copy
          scrolls, so a short phone never clips the slide or its buttons. */}
      <section className="maya-welcome-panel route-enter relative grid min-w-0 h-[min(46rem,calc(100svh-1.5rem))] w-[min(100%,72rem)] max-w-full grid-rows-[minmax(12rem,30svh)_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[rgba(27,28,32,0.62)] shadow-[0_32px_90px_-54px_rgba(0,0,0,0.92)] backdrop-blur-2xl sm:grid-rows-[minmax(16rem,34svh)_minmax(0,1fr)] md:h-[min(43rem,calc(100svh-2rem))] md:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)] md:grid-rows-1">
        {!blocking ? (
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label={`Close ${teacher.name} welcome`}
            className="absolute right-3 top-3 z-20 flex h-12 w-12 items-center justify-center rounded-full text-cream/65 transition hover:bg-white/[0.07] hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--workspace-accent)] sm:right-5 sm:top-5"
          >
            <X size={25} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}

        <div className="relative z-10 min-h-0 overflow-hidden bg-white/[0.012]">
          {lightweightAvatar ? (
            <Image
              src={teacher.portrait}
              alt={`${teacher.name}, your Trailgrad teacher`}
              fill
              priority
              sizes="(max-width: 767px) 100vw, 36rem"
              className="object-cover object-top"
            />
          ) : (
            <AvatarStage
              agentTrack={null}
              state={speaking ? "speaking" : "listening"}
              url={teacher.model}
              rig={teacher.rig}
              performanceProfile="welcome"
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(17,18,20,0.7)] to-transparent" />
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceLabel(voiceState, teacher.name)}
            aria-pressed={speaking}
            title={voiceLabel(voiceState, teacher.name)}
            className={[
              "absolute bottom-3 left-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_12px_32px_rgba(0,0,0,0.34)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--workspace-accent)] sm:bottom-5 sm:left-5",
              awaitingGesture
                ? "animate-pulse border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-white"
                : "border-white/15 bg-black/65 text-cream/78 hover:bg-black/80 hover:text-cream"
            ].join(" ")}
          >
            {voiceState === "loading" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : speaking ? (
              <VolumeX size={17} />
            ) : (
              <Volume2 size={17} />
            )}
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden bg-transparent px-5 pb-5 pt-5 sm:px-10 sm:pb-8 sm:pt-8 lg:px-14 lg:pb-9 lg:pt-10">
          <div className="relative z-10 flex shrink-0 items-center gap-2.5 pr-12">
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  index === welcomeProgressIndex(step, targetStage, baselineStage)
                    ? "workspace-accent-dot w-12"
                    : "w-6 bg-cream/25"
                ].join(" ")}
              />
            ))}
          </div>

          <div
            ref={contentScrollRef}
            onTouchStart={() => {
              userControlledScroll.current = true;
            }}
            onWheel={() => {
              userControlledScroll.current = true;
            }}
            className="no-scrollbar relative z-10 -mx-1 min-h-0 min-w-0 max-w-full flex-1 overflow-x-clip overflow-y-auto px-1"
          >
            <div
              key={`${step}-${targetStage}`}
              className="step-in flex min-h-full min-w-0 max-w-full flex-col justify-center py-4 sm:py-8 lg:py-12"
            >
              <Icon
                size={64}
                strokeWidth={1.25}
                className="hidden text-[var(--workspace-accent)] min-[360px]:block sm:size-16"
                aria-hidden="true"
              />
              {current.eyebrow ? (
                <p className="blueprint-label text-cream/45 min-[360px]:mt-4 sm:mt-5 lg:mt-7">
                  {current.eyebrow}
                </p>
              ) : null}
              <h1
                id="maya-welcome-title"
                className={`display-heading ${current.eyebrow ? "mt-3 sm:mt-4" : "mt-5 sm:mt-6"} max-w-2xl text-[2.15rem] leading-[1.03] text-cream sm:text-[3rem]`}
              >
                <WordRevealLine words={titleReveal.words} visibleCount={titleReveal.visibleCount} />
              </h1>
              {current.body ? (
                <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-cream/78 sm:text-lg sm:leading-8">
                  <WordRevealLine
                    words={bodyReveal.words}
                    visibleCount={bodyReveal.visibleCount}
                    wordClassName="maya-welcome-copy-word"
                  />
                </p>
              ) : null}
              {step === 1 && baselineStage === null ? (
                <div className="mt-7 max-w-2xl">
                  {targetStage === 0 ? (
                    <TargetChoiceGrid
                      options={TARGET_ROLE_OPTIONS}
                      value={targetRole}
                      onChange={setTargetRole}
                    />
                  ) : null}
                  {targetStage === 1 ? (
                    <TargetChoiceGrid
                      options={TARGET_LEVEL_OPTIONS}
                      value={targetLevel}
                      onChange={setTargetLevel}
                      columns="three"
                    />
                  ) : null}
                  {targetStage === 2 ? (
                    <TargetChoiceGrid
                      options={TARGET_TIMELINE_OPTIONS}
                      value={targetTimeline}
                      onChange={setTargetTimeline}
                    />
                  ) : null}
                  {targetStage === 3 ? <PreparationAreaGrid role={targetRole} /> : null}
                  {targetStage === 4 ? (
                    <div>
                      <label
                        htmlFor="target-company"
                        className="flex items-center gap-2 text-base font-semibold text-cream"
                      >
                        <Building2
                          size={17}
                          className="text-[var(--workspace-accent)]"
                          aria-hidden="true"
                        />
                        Company name <span className="font-normal text-cream/45">Optional</span>
                      </label>
                      <input
                        id="target-company"
                        value={targetCompany}
                        onChange={(event) => setTargetCompany(event.target.value)}
                        maxLength={100}
                        placeholder="e.g. Stripe, Google, or your dream team"
                        className="mt-4 h-12 w-full rounded-lg border border-cream/15 bg-black/25 px-3.5 text-base text-cream outline-none transition placeholder:text-cream/35 focus:border-[var(--workspace-accent)] focus:ring-2 focus:ring-[var(--workspace-accent-soft)]"
                      />
                      <p className="mt-3 text-sm leading-6 text-cream/55">
                        No company in mind is completely fine. Your preparation will still be
                        tailored to your role and level.
                      </p>
                    </div>
                  ) : null}
                  {targetError ? (
                    <p role="alert" className="mt-4 text-sm font-medium text-[#ffb8c3]">
                      {targetError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {baselineStage === "intro" ? <BaselineIntro role={targetRole} /> : null}
              {activeBaselineQuestion ? (
                <BaselineQuestionCard
                  question={activeBaselineQuestion}
                  choiceId={baselineChoice}
                  onChoice={setBaselineChoice}
                />
              ) : null}
              {baselineStage === "completed" && !alreadyOnboarded ? (
                <InitialSkillProfile state={onboarding} role={targetRole} />
              ) : null}
              {baselineStage !== null && targetError ? (
                <p role="alert" className="mt-4 text-sm font-medium text-[#ffb8c3]">
                  {targetError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 border-t border-cream/[0.1] pt-4 sm:items-center sm:pt-5">
            <div className="flex w-full gap-3 sm:ml-auto sm:w-auto">
              {step === 1 && baselineStage === null ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setTargetError(null);
                    if (targetStage === 0) setStep(0);
                    else setTargetStage((stage) => stage - 1);
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-cream/15 px-5 text-sm font-semibold text-cream/80 transition hover:border-cream/35 hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving || Boolean(activeBaselineQuestion && !baselineResponseReady)}
                onClick={() => {
                  if (step === 0) {
                    setStep(1);
                    return;
                  }
                  if (baselineStage === "intro") {
                    void beginBaseline();
                    return;
                  }
                  if (activeBaselineQuestion) {
                    void saveBaselineAnswer();
                    return;
                  }
                  if (baselineStage === "completed") {
                    finishPreparationOnboarding();
                    return;
                  }
                  void advanceTargetSetup();
                }}
                className="browse-nudge inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[#f5f3ef] px-5 text-sm font-semibold text-[#17181b] shadow-[0_18px_44px_-26px_rgba(245,243,239,0.22)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Saving your progress
                  </>
                ) : step === 0 ? (
                  <>
                    Set my target <ArrowRight size={15} />
                  </>
                ) : baselineStage === "intro" ? (
                  <>
                    Start baseline <ArrowRight size={15} />
                  </>
                ) : activeBaselineQuestion ? (
                  <>
                    Save and continue <ArrowRight size={15} />
                  </>
                ) : baselineStage === "completed" ? (
                  <>
                    {alreadyOnboarded ? "Continue learning" : "Build my preparation"}{" "}
                    <ArrowRight size={15} />
                  </>
                ) : targetStage === TARGET_SETUP_COPY.length - 1 ? (
                  <>
                    Continue to baseline <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
