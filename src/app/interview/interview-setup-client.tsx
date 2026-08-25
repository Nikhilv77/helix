"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import {
  ApiClientError,
  getPersonalizedInterviewPlan,
  getProfile,
  startInterview
} from "@/lib/api/api-client";
import type { Curriculum, CurriculumSession } from "@/lib/curriculum/curriculum";
import type { SessionBlueprint } from "@/lib/interviews/personalized-plan";
import { FRONTEND_SESSIONS, type FrontendSession } from "@/lib/roadmap/frontend-plan";
import { findTemplate, type InterviewTemplate } from "@/lib/interviews/interview-templates";
import { pageTitle } from "@/lib/shared/seo";
import type { Intensity, InterviewSetup, Level, Role, RoundType } from "@/lib/shared/types";
import { type WorkspaceAccent, workspaceAccentCssVariables } from "@/lib/workspace/accent";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "fullstack", label: "Full-stack" },
  { value: "data", label: "Data" },
  { value: "ai-ml", label: "AI / ML" },
  { value: "pm", label: "Product" }
];

const levelOptions: Array<{ value: Level; label: string }> = [
  { value: "fresher", label: "Fresher" },
  { value: "0-2", label: "0–2 yrs" },
  { value: "3-5", label: "3–5 yrs" },
  { value: "5-plus", label: "5+ yrs" }
];

const roundOptions: Array<{ value: RoundType; label: string; hint: string }> = [
  { value: "behavioral", label: "Behavioral", hint: "Ownership, conflict, judgement" },
  { value: "technical", label: "Technical deep-dive", hint: "How you built it, and why" },
  { value: "hiring-manager", label: "Hiring manager", hint: "Impact, scope, trade-offs" }
];

const intensityOptions: Array<{ value: Intensity; label: string; hint: string }> = [
  { value: "friendly", label: "Friendly", hint: "Warm, but still follows up" },
  { value: "realistic", label: "Realistic", hint: "Neutral and direct" },
  { value: "brutal", label: "Brutal", hint: "Names the gap, no softening" }
];

const MIN_CONTEXT = 10;

const startingLabels = ["Reading your resume", "Writing your questions", "Setting the room"];
const setupStepTitles = ["Role", "Experience", "Round", "Intensity", "Context"];
const RESUME_SESSION_ID = "resume-behavioral-defense";

type PlannedSessionSelection = Pick<CurriculumSession, "id" | "title"> & {
  planId?: string;
  blueprintId?: string;
};

export default function InterviewSetupClient({
  workspaceAccent
}: {
  workspaceAccent: WorkspaceAccent;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [roundType, setRoundType] = useState<RoundType | null>(null);
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [context, setContext] = useState("");
  const [starting, setStarting] = useState(false);
  const [startingLabel, setStartingLabel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<InterviewTemplate | null>(null);
  const [plannedSession, setPlannedSession] = useState<PlannedSessionSelection | null>(null);
  const [plannedSessionTitle, setPlannedSessionTitle] = useState<string | null>(null);
  const [scope, setScope] = useState<"session" | "overall" | null>(null);
  const [planAgenda, setPlanAgenda] = useState<string[] | null>(null);
  const [autoStart, setAutoStart] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [launchPlanReady, setLaunchPlanReady] = useState(true);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    document.title = pageTitle(
      starting || autoStart
        ? "Starting Interview"
        : `Interview Setup - ${setupStepTitles[step] ?? "Context"}`
    );
  }, [autoStart, starting, step]);

  // Signed-in candidates should not have to retype their role and project
  // context for every round. Query params win so dashboard drills can narrow
  // the next interview to a specific competency.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    const levelParam = params.get("level");
    const focus = params.get("focus")?.trim();
    const resumeLaunch = params.get("resume") === "1";
    const requestedRoadmapSession = findRoadmapSession(params.get("roadmapSession"));
    const roadmapSession =
      requestedRoadmapSession ?? (resumeLaunch ? findRoadmapSession(RESUME_SESSION_ID) : null);
    const sessionId = params.get("session");
    const blueprintId = params.get("blueprint");
    const expectedPlanId = params.get("plan");
    const overall = params.get("scope") === "overall";
    const chosenTemplate = findTemplate(params.get("template"));
    const shouldAutoStart =
      params.get("autostart") === "1" ||
      resumeLaunch ||
      Boolean(roadmapSession) ||
      Boolean(blueprintId) ||
      Boolean(sessionId) ||
      overall ||
      Boolean(params.get("focus")) ||
      Boolean(chosenTemplate);

    if (!shouldAutoStart) {
      router.replace("/interviews");
      return () => {
        cancelled = true;
      };
    }

    const queryRole = roleOptions.find((option) => option.value === roleParam)?.value ?? null;
    const queryLevel = levelOptions.find((option) => option.value === levelParam)?.value ?? null;

    setProfileReady(false);
    setAutoStart(shouldAutoStart);
    if (queryRole) setRole(queryRole);
    if (queryLevel) setLevel(queryLevel);
    if (params.get("session") || params.get("scope") === "overall" || roadmapSession || blueprintId)
      setStep(4);

    // A template picked on the interviews page fixes the round and its agenda.
    const chosen = chosenTemplate;
    if (chosen) {
      setTemplate(chosen);
      setRoundType(chosen.roundType);
      setIntensity(chosen.intensity);
    } else if (!roadmapSession && !blueprintId && !sessionId && !overall) {
      setRoundType("behavioral");
      setIntensity("realistic");
    }

    if (roadmapSession) {
      setScope("session");
      setIntensity("realistic");
      setRoundType(roundTypeForRoadmapSession(roadmapSession.id));
      setPlannedSessionTitle(roadmapSession.title);
      setPlanAgenda(agendaForRoadmapSession(roadmapSession));
    }

    if (blueprintId && !roadmapSession) {
      setScope("session");
      setIntensity("realistic");
      setRoundType("technical");
      setLaunchPlanReady(false);
      void getPersonalizedInterviewPlan()
        .then((plan) => {
          if (cancelled) return;
          if (expectedPlanId && plan.id !== expectedPlanId) {
            throw new Error("The personalized plan changed");
          }
          const blueprint = plan.sessions.find((session) => session.id === blueprintId);
          if (!blueprint) throw new Error("The personalized session was not found");

          setPlannedSession({
            id: blueprint.id,
            title: blueprint.title,
            planId: plan.id,
            blueprintId: blueprint.id
          });
          setPlanAgenda(agendaForPersonalizedBlueprint(blueprint));
        })
        .catch(() => {
          if (cancelled) return;
          setAutoStart(false);
          setScope(null);
          setError("This personalized session changed. Return to Interviews and choose it again.");
        })
        .finally(() => {
          if (!cancelled) setLaunchPlanReady(true);
        });
    }

    // Rounds launched from the plan already know their subject. Onboarding
    // captured the role and level, so nothing is asked again here.
    if ((sessionId || overall) && !roadmapSession && !blueprintId) {
      setScope(overall ? "overall" : "session");
      setIntensity("realistic");
      setLaunchPlanReady(false);
      void fetch("/api/curriculum", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
        .then((payload: { data: Curriculum }) => {
          if (cancelled) return;
          const sessions = payload.data.sessions;
          const match = sessionId ? sessions.find((item) => item.id === sessionId) : undefined;
          if (match) {
            setPlannedSession(match);
            setRoundType(match.roundType);
            setPlanAgenda(match.agenda);
          } else if (overall) {
            setRoundType("behavioral");
            // One objective per session, so the round spans the plan the
            // candidate has actually been taught.
            setPlanAgenda(
              sessions
                .slice(0, 4)
                .map((item) => `${item.title}: ${item.agenda[0] ?? item.objective}`)
            );
          }
        })
        .catch(() => {
          if (!cancelled) setScope(null);
        })
        .finally(() => {
          if (!cancelled) setLaunchPlanReady(true);
        });
    }

    void getProfile()
      .then((profile) => {
        if (cancelled) return;
        if (!queryRole && (profile.targetRole || shouldAutoStart)) {
          setRole(profile.targetRole ?? "frontend");
        }
        if (!queryLevel && (profile.level || shouldAutoStart)) setLevel(profile.level ?? "0-2");

        const strongestStory = profile.stories[0];
        const resumeEvidence = [
          ...(profile.resume?.experience
            .slice(0, 2)
            .map(
              (experience) =>
                `Experience — ${experience.role} at ${experience.organization}${experience.period ? ` (${experience.period})` : ""}: ${experience.summary} ${experience.achievements.join(" ")}`
            ) ?? []),
          ...(profile.resume?.projects
            .slice(0, 2)
            .map(
              (project) =>
                `Project — ${project.name}: ${project.summary} Outcome: ${project.outcome}. Skills: ${project.skills.join(", ")}`
            ) ?? []),
          ...(profile.resume?.achievements
            .slice(0, 3)
            .map((achievement) => `Achievement — ${achievement}`) ?? [])
        ].join("\n");
        const preparedQuestion = findPreparedQuestion(
          profile.resume?.practiceQuestions ?? [],
          roadmapSession?.title ?? focus
        );
        const memory = [
          profile.context,
          roadmapSession
            ? `Roadmap interview session — ${roadmapSession.title}: ${roadmapSession.purpose} Cover this agenda: ${roadmapSession.covers.join("; ")}. Ask from my real profile and resume evidence, not generic domain trivia.`
            : "",
          resumeEvidence ? `Verified resume evidence:\n${resumeEvidence}` : "",
          strongestStory
            ? `Project story — ${strongestStory.title}: ${strongestStory.situation} ${strongestStory.action} ${strongestStory.outcome}`
            : "",
          preparedQuestion
            ? `Prepared question — ${preparedQuestion.prompt} Evidence anchor: ${preparedQuestion.evidenceAnchor}. Use this as a starting point, then ask natural follow-ups based on the answer.`
            : "",
          focus ? `Practice focus: ${focus}. Probe this competency using the experience above.` : ""
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 1200);

        if (memory || shouldAutoStart) {
          setContext(
            (current) =>
              current ||
              memory ||
              "Resume interview based on my saved Trailgrad profile, resume evidence, projects, and impact."
          );
        }
      })
      .catch(() => {
        if (focus) {
          setContext(
            (current) =>
              current || `Practice focus: ${focus}. Ask for concrete evidence from my experience.`
          );
        }
        if (shouldAutoStart) {
          setRole((current) => current ?? "frontend");
          setLevel((current) => current ?? "0-2");
          setRoundType((current) => current ?? "behavioral");
          setIntensity((current) => current ?? "realistic");
          setContext(
            (current) =>
              current ||
              "Resume interview based on my saved Trailgrad profile, resume evidence, projects, and impact."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setProfileReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const answered = useMemo(
    () =>
      [
        { label: "Role", value: roleOptions.find((o) => o.value === role)?.label },
        { label: "Level", value: levelOptions.find((o) => o.value === level)?.label },
        { label: "Round", value: roundOptions.find((o) => o.value === roundType)?.label },
        { label: "Intensity", value: intensityOptions.find((o) => o.value === intensity)?.label }
      ].filter((item): item is { label: string; value: string } => Boolean(item.value)),
    [intensity, level, role, roundType]
  );

  const canContinue =
    step === 0
      ? role !== null
      : step === 1
        ? level !== null
        : step === 2
          ? roundType !== null
          : step === 3
            ? intensity !== null
            : context.trim().length >= MIN_CONTEXT;

  const begin = useCallback(async () => {
    if (!role || !level || !roundType || !intensity) return;

    const setup: InterviewSetup = {
      role,
      level,
      roundType,
      intensity,
      context: context.trim(),
      ...(planAgenda
        ? {
            agenda: planAgenda,
            ...(plannedSession
              ? {
                  templateId: plannedSession.id,
                  templateTitle: plannedSession.title,
                  ...(plannedSession.blueprintId
                    ? {
                        planId: plannedSession.planId,
                        blueprintId: plannedSession.blueprintId
                      }
                    : {})
                }
              : { templateTitle: plannedSessionTitle ?? "Full interview across your sessions" })
          }
        : template
          ? { agenda: template.agenda, templateId: template.id, templateTitle: template.title }
          : {})
    };

    setStarting(true);
    setError(null);

    try {
      const session = await startInterview(setup);
      router.push(`/interview/voice?session=${session.sessionId}`);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "The interview could not be started. Try again."
      );
      setAutoStart(false);
      autoStartedRef.current = false;
      setStarting(false);
    }
  }, [
    context,
    intensity,
    level,
    planAgenda,
    plannedSession,
    plannedSessionTitle,
    role,
    roundType,
    router,
    template
  ]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || starting || !profileReady || !launchPlanReady)
      return;
    if (!role || !level || !roundType || !intensity) return;

    if (context.trim().length < MIN_CONTEXT) {
      setContext(
        "Resume interview based on my saved Trailgrad profile, resume evidence, projects, and impact."
      );
      return;
    }

    autoStartedRef.current = true;
    void begin();
  }, [
    autoStart,
    begin,
    context,
    intensity,
    launchPlanReady,
    level,
    profileReady,
    role,
    roundType,
    starting
  ]);

  // A template already fixes the round and the intensity, so those two steps
  // drop out of the wizard rather than asking a question with one answer.
  const activeSteps = useMemo(
    () => (scope ? [4] : template ? [0, 1, 4] : [0, 1, 2, 3, 4]),
    [scope, template]
  );
  const position = Math.max(0, activeSteps.indexOf(step));
  const onLastStep = position === activeSteps.length - 1;
  const isPreparing = !profileReady || !launchPlanReady || starting || autoStart;

  const goTo = useCallback(
    (offset: number) => {
      const target = activeSteps[Math.min(Math.max(position + offset, 0), activeSteps.length - 1)];
      if (target !== undefined) setStep(target);
    },
    [activeSteps, position]
  );

  const next = useCallback(() => {
    if (!canContinue) return;
    if (!onLastStep) {
      goTo(1);
      return;
    }
    void begin();
  }, [begin, canContinue, goTo, onLastStep]);

  /** Selecting advances on a short beat so the choice visibly registers. */
  const choose = useCallback(
    (apply: () => void) => {
      apply();
      window.setTimeout(() => goTo(1), 220);
    },
    [goTo]
  );

  // Cycle the label while the planner writes the questions.
  useEffect(() => {
    if (!starting) return;
    const timer = window.setInterval(
      () => setStartingLabel((current) => (current + 1) % startingLabels.length),
      1400
    );
    return () => window.clearInterval(timer);
  }, [starting]);

  // Number keys pick an option; Enter continues. Disabled on the text step.
  useEffect(() => {
    if (starting) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && (event.metaKey || step < 4)) {
        event.preventDefault();
        next();
        return;
      }

      if (step >= 4 || event.metaKey || event.ctrlKey) return;

      const index = Number(event.key) - 1;
      if (Number.isNaN(index) || index < 0) return;

      const role = roleOptions[index];
      const level = levelOptions[index];
      const round = roundOptions[index];
      const intensityOption = intensityOptions[index];

      if (step === 0 && role) choose(() => setRole(role.value));
      if (step === 1 && level) choose(() => setLevel(level.value));
      if (step === 2 && round) choose(() => setRoundType(round.value));
      if (step === 3 && intensityOption) choose(() => setIntensity(intensityOption.value));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choose, next, starting, step]);

  return (
    <main
      data-workspace-accent={workspaceAccent}
      style={workspaceAccentCssVariables(workspaceAccent) as CSSProperties}
      className="workspace-black relative flex min-h-screen flex-col overflow-hidden bg-black text-cream"
    >
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[32rem] w-[44rem] max-w-[92vw] -translate-x-1/2 rounded-full bg-[var(--workspace-accent)] opacity-[0.055] blur-[160px]" />

      {!isPreparing ? (
        <header className="relative z-10 mx-auto flex w-full max-w-3xl justify-center px-6 pt-7">
          <div className="inline-flex items-center rounded-2xl border border-white/[0.08] bg-[rgba(25,26,29,0.58)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            {activeSteps.map((value, index) => (
              <div key={value} className="flex items-center">
                {index > 0 ? (
                  <span
                    className={`mx-2 h-px w-5 transition-colors duration-500 sm:w-7 ${
                      index <= position
                        ? "bg-[color-mix(in_srgb,var(--workspace-accent)_55%,transparent)]"
                        : "bg-white/10"
                    }`}
                  />
                ) : null}
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-500 ${
                    index < position
                      ? "bg-[var(--workspace-accent)] text-black shadow-[0_0_18px_color-mix(in_srgb,var(--workspace-accent)_25%,transparent)]"
                      : index === position
                        ? "border border-[color-mix(in_srgb,var(--workspace-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_14%,transparent)] text-[var(--workspace-accent)] shadow-[0_0_20px_color-mix(in_srgb,var(--workspace-accent)_16%,transparent)]"
                        : "border border-white/10 bg-white/[0.025] text-cream/35"
                  }`}
                >
                  {index < position ? <Check size={13} aria-hidden="true" /> : index + 1}
                </span>
              </div>
            ))}
          </div>
        </header>
      ) : null}

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-3xl">
          {isPreparing ? (
            <StartingState label={startingLabels[startingLabel] ?? startingLabels[0] ?? ""} />
          ) : (
            <div key={step} className="step-in">
              <div className="flex flex-wrap items-center gap-3">
                <p className="blueprint-label text-cream/40">
                  {String(position + 1).padStart(2, "0")} /{" "}
                  {String(activeSteps.length).padStart(2, "0")}
                </p>
                {plannedSession || plannedSessionTitle || template || scope === "overall" ? (
                  <span className="pill inline-flex items-center gap-2 px-3 py-1 text-[11px] font-medium text-cream/75">
                    <Check size={12} />{" "}
                    {plannedSession?.title ??
                      plannedSessionTitle ??
                      template?.title ??
                      "Full interview across all sessions"}
                  </span>
                ) : null}
              </div>

              <h1
                className="display-heading mt-4 max-w-2xl text-cream"
                style={{ fontSize: "clamp(2rem, 4.6vw, 3.25rem)" }}
              >
                {step === 0 ? "What role are you interviewing for?" : null}
                {step === 1 ? "How much experience do you have?" : null}
                {step === 2 ? "Which round is this?" : null}
                {step === 3 ? "How hard should it be?" : null}
                {step === 4 ? "What have you actually worked on?" : null}
              </h1>

              {step === 4 ? (
                <p className="mt-4 max-w-xl text-[15px] leading-7 text-cream/55">
                  One or two lines. Every question is written from this, so name the real systems
                  and the real numbers.
                </p>
              ) : null}

              <div className="mt-9">
                {step === 0 ? (
                  <OptionGrid
                    options={roleOptions}
                    selected={role}
                    columns={3}
                    onSelect={(value) => choose(() => setRole(value))}
                  />
                ) : null}

                {step === 1 ? (
                  <OptionGrid
                    options={levelOptions}
                    selected={level}
                    columns={4}
                    onSelect={(value) => choose(() => setLevel(value))}
                  />
                ) : null}

                {step === 2 ? (
                  <OptionGrid
                    options={roundOptions}
                    selected={roundType}
                    columns={1}
                    onSelect={(value) => choose(() => setRoundType(value))}
                  />
                ) : null}

                {step === 3 ? (
                  <OptionGrid
                    options={intensityOptions}
                    selected={intensity}
                    columns={1}
                    onSelect={(value) => choose(() => setIntensity(value))}
                  />
                ) : null}

                {step === 4 ? (
                  <div>
                    <textarea
                      value={context}
                      onChange={(event) => setContext(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          next();
                        }
                      }}
                      rows={4}
                      autoFocus
                      maxLength={1200}
                      placeholder="Rebuilt the payments retry pipeline at a fintech — idempotency keys, dead-letter queues, cut p99 by 40%."
                      className="w-full resize-none rounded-2xl border border-cream/25 bg-white/[0.06] p-5 text-[17px] leading-8 text-cream outline-none transition placeholder:text-cream/25 focus:border-cream/60 focus:bg-white/[0.09]"
                    />
                    <div className="mt-2.5 flex items-center justify-between">
                      <p className="font-mono text-[11px] text-cream/35">
                        {context.trim().length < MIN_CONTEXT
                          ? `${MIN_CONTEXT - context.trim().length} more characters`
                          : "Looks good"}
                      </p>
                      <p className="font-mono text-[11px] text-cream/30">
                        {context.trim().length} / 1200
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="mt-6 rounded-xl border border-[#dd5f5f]/45 bg-[#dd5f5f]/10 px-4 py-3 text-sm text-cream">
                  {error}
                </p>
              ) : null}

              <div className="mt-10 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => goTo(-1)}
                  disabled={position === 0}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-cream/55 transition hover:text-cream disabled:pointer-events-none disabled:opacity-0"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={next}
                  disabled={!canContinue}
                  className="ml-auto inline-flex min-h-12 items-center gap-2.5 rounded-xl border border-cream bg-cream px-6 text-sm font-semibold text-blueprint transition hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-30"
                >
                  {onLastStep ? "Start interview" : "Continue"}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-6 pb-8">
        {answered.length > 0 && !isPreparing ? (
          <div className="flex flex-wrap items-center gap-2">
            {answered.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-cream/20 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream/60"
              >
                <Check size={11} aria-hidden="true" />
                {item.value}
              </span>
            ))}
          </div>
        ) : null}

        <p className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-cream/25">
          {isPreparing
            ? ""
            : step < 4
              ? "Press 1–6 to choose · Enter to continue"
              : "⌘ + Enter to start"}
        </p>
      </footer>
    </main>
  );
}

function findPreparedQuestion(
  questions: Array<{ competency: string; prompt: string; evidenceAnchor: string }>,
  focus?: string
) {
  if (!questions.length) return null;
  if (!focus) return questions[0] ?? null;
  const normalizedFocus = focus.toLowerCase();
  return (
    questions.find((question) => question.competency.toLowerCase().includes(normalizedFocus)) ??
    questions[0] ??
    null
  );
}

function findRoadmapSession(id: string | null): FrontendSession | null {
  if (!id) return null;
  return FRONTEND_SESSIONS.find((session) => session.id === id) ?? null;
}

function agendaForRoadmapSession(session: FrontendSession): string[] {
  return [
    `${session.title}: ${session.purpose}`,
    ...session.covers.map((item) => `${session.title}: ${item}`)
  ];
}

function agendaForPersonalizedBlueprint(blueprint: SessionBlueprint): string[] {
  return [
    `Session goal: ${blueprint.rationale}`,
    ...blueprint.topics.map(
      (topic) => `${topic.label}: ${topic.objectives[0] ?? "Test practical depth and trade-offs"}`
    )
  ].map((item) => item.slice(0, 200));
}

function roundTypeForRoadmapSession(id: string): RoundType {
  if (id === "resume-behavioral-defense") return "behavioral";
  if (id === "final-frontend-mock") return "hiring-manager";
  return "technical";
}

function StartingState({ label }: { label: string }) {
  return (
    <div className="step-in flex flex-col items-center py-12 text-center">
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--workspace-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_9%,rgba(18,19,22,0.72))] text-[var(--workspace-accent)] shadow-[0_0_48px_color-mix(in_srgb,var(--workspace-accent)_16%,transparent)] backdrop-blur-xl">
        <span className="absolute inset-0 animate-ping rounded-2xl border border-[color-mix(in_srgb,var(--workspace-accent)_24%,transparent)] opacity-30" />
        <Loader2 size={23} className="animate-spin" aria-hidden="true" />
      </span>

      <p className="mt-7 text-xl font-semibold tracking-tight text-cream">{label}</p>
      <p className="mt-2 text-sm text-cream/48">
        Building a focused round from your saved profile.
      </p>
    </div>
  );
}

function OptionGrid<TValue extends string>({
  options,
  selected,
  onSelect,
  columns
}: {
  options: Array<{ value: TValue; label: string; hint?: string }>;
  selected: TValue | null;
  onSelect: (value: TValue) => void;
  columns: 1 | 3 | 4;
}) {
  const grid =
    columns === 1
      ? "grid gap-3"
      : columns === 4
        ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={grid}>
      {options.map((option, index) => {
        const active = option.value === selected;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={active}
            className={[
              "step-in group flex items-center gap-3.5 rounded-2xl border px-5 py-4 text-left transition duration-200",
              active
                ? "border-cream bg-cream text-blueprint"
                : "border-cream/20 bg-white/[0.04] text-cream hover:-translate-y-0.5 hover:border-cream/55 hover:bg-white/[0.08]"
            ].join(" ")}
            style={{ "--step-delay": `${60 + index * 45}ms` } as React.CSSProperties}
          >
            <span
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] transition",
                active
                  ? "border-blueprint/25 bg-blueprint/10 text-blueprint"
                  : "border-cream/20 text-cream/45 group-hover:border-cream/40 group-hover:text-cream/80"
              ].join(" ")}
            >
              {active ? <Check size={13} aria-hidden="true" /> : index + 1}
            </span>

            <span className="min-w-0">
              <span className="block text-base font-semibold tracking-tight">{option.label}</span>
              {option.hint ? (
                <span
                  className={`mt-0.5 block text-sm leading-5 ${active ? "text-blueprint/65" : "text-cream/45"}`}
                >
                  {option.hint}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
