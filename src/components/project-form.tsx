"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  Gauge,
  Globe2,
  Layers,
  Loader2,
  MessageSquare,
  Pencil,
  RadioTower,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap
} from "lucide-react";
import {
  analyzeRequirements,
  calculateCapacity,
  createDesignSession,
  createProject,
  generateDesign,
  generateDiagram,
  setAuthTokenProvider,
  submitClarifications
} from "@/lib/api-client";
import { Button } from "./ui/button";
import { ErrorState } from "./ui/error-state";

type StepId = "template" | "basics" | "profile" | "review";
type ProjectTemplateId =
  | "notification-platform"
  | "monitoring-system"
  | "url-shortener"
  | "chat-messaging"
  | "payments"
  | "feed-ranking"
  | "custom";
type ScaleId = "small" | "medium" | "large" | "global";
type PriorityId = "speed" | "reliability" | "cost" | "simplicity";
type DomainId = "consumer" | "enterprise" | "internal" | "infra";

interface Choice<TValue extends string> {
  id: TValue;
  label: string;
  description: string;
  icon: typeof Rocket;
  tags?: string[];
}

const steps: Array<{ id: StepId; label: string }> = [
  { id: "template", label: "Idea" },
  { id: "basics", label: "Brief" },
  { id: "profile", label: "Shape" },
  { id: "review", label: "Build" }
];

const projectTemplates: Array<Choice<ProjectTemplateId> & { suggestedName: string }> = [
  {
    id: "notification-platform",
    label: "Notification platform",
    suggestedName: "Notification platform",
    description: "Fanout, queues, retries, delivery tracking, rate limits, and preferences.",
    icon: BellRing,
    tags: ["queues", "fanout", "retries"]
  },
  {
    id: "monitoring-system",
    label: "Monitoring system",
    suggestedName: "Monitoring system",
    description: "Metrics ingestion, time-series storage, alerting, dashboards, and retention.",
    icon: RadioTower,
    tags: ["metrics", "alerts", "storage"]
  },
  {
    id: "url-shortener",
    label: "URL shortener",
    suggestedName: "URL shortener",
    description: "Short links, redirects, analytics, caching, abuse controls, and availability.",
    icon: Search,
    tags: ["cache", "redirects", "analytics"]
  },
  {
    id: "chat-messaging",
    label: "Chat and messaging",
    suggestedName: "Chat messaging system",
    description: "Realtime delivery, conversations, presence, notifications, and history.",
    icon: MessageSquare,
    tags: ["realtime", "delivery", "presence"]
  },
  {
    id: "payments",
    label: "Payment system",
    suggestedName: "Payment system",
    description: "Checkout, ledgers, idempotency, provider failures, reconciliation, and risk.",
    icon: WalletCards,
    tags: ["ledger", "risk", "idempotency"]
  },
  {
    id: "feed-ranking",
    label: "Feed and ranking",
    suggestedName: "Feed ranking system",
    description: "Content ingestion, ranking, fanout, personalization, freshness, and abuse.",
    icon: Layers,
    tags: ["ranking", "fanout", "freshness"]
  },
  {
    id: "custom",
    label: "Custom product",
    suggestedName: "",
    description: "Start with a blank workspace and let Helix infer the product and build plan.",
    icon: Pencil,
    tags: ["blank", "flexible"]
  }
];

const scales: Choice<ScaleId>[] = [
  {
    id: "small",
    label: "Small",
    description: "Prototype, internal team, or early product traffic.",
    icon: Rocket
  },
  {
    id: "medium",
    label: "Medium",
    description: "Growing product with meaningful traffic and reliability needs.",
    icon: Gauge
  },
  {
    id: "large",
    label: "Large",
    description: "High throughput, many users, and multi-service operations.",
    icon: RadioTower
  },
  {
    id: "global",
    label: "Global",
    description: "Multi-region expectations, resilience, and strict latency targets.",
    icon: Globe2
  }
];

const priorities: Choice<PriorityId>[] = [
  {
    id: "reliability",
    label: "Reliability",
    description: "Favor correctness, resilience, and graceful degradation.",
    icon: ShieldCheck
  },
  {
    id: "speed",
    label: "Speed",
    description: "Favor low latency, fast delivery, and developer velocity.",
    icon: Zap
  },
  {
    id: "cost",
    label: "Cost",
    description: "Favor efficient storage, compute, and operational spend.",
    icon: Gauge
  },
  {
    id: "simplicity",
    label: "Simplicity",
    description: "Favor fewer moving parts and easier operational ownership.",
    icon: Layers
  }
];

const domains: Choice<DomainId>[] = [
  {
    id: "consumer",
    label: "Consumer",
    description: "User-facing traffic, engagement, privacy, and growth.",
    icon: Globe2
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description: "Tenancy, permissions, auditability, and integrations.",
    icon: ShieldCheck
  },
  {
    id: "internal",
    label: "Internal tool",
    description: "Operational workflows, admin surfaces, and team productivity.",
    icon: Gauge
  },
  {
    id: "infra",
    label: "Infrastructure",
    description: "Platforms, pipelines, observability, and reliability operations.",
    icon: RadioTower
  }
];

const generationSteps = [
  "Creating workspace",
  "Starting product build",
  "Shaping requirements",
  "Resolving default decisions",
  "Estimating capacity",
  "Generating product workspace",
  "Rendering architecture diagram",
  "Opening results"
];

function getChoice<TValue extends string>(choices: Choice<TValue>[], id: TValue): Choice<TValue> {
  return choices.find((choice) => choice.id === id) ?? choices[0]!;
}

export function ProjectForm() {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [templateId, setTemplateId] = useState<ProjectTemplateId>("custom");
  const [scale, setScale] = useState<ScaleId>("medium");
  const [priority, setPriority] = useState<PriorityId>("reliability");
  const [domain, setDomain] = useState<DomainId>("enterprise");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generationStage, setGenerationStage] = useState<string | null>(null);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);

  const currentStep = steps[stepIndex]!;
  const selectedTemplate = projectTemplates.find((template) => template.id === templateId);
  const selectedScale = getChoice(scales, scale);
  const selectedPriority = getChoice(priorities, priority);
  const selectedDomain = getChoice(domains, domain);
  const canContinue = currentStep.id !== "basics" || name.trim().length >= 2;

  const generatedBrief = useMemo(() => {
    const baseDescription =
      description.trim() || selectedTemplate?.description || "AI product builder workspace.";

    return [
      baseDescription,
      "",
      "Helix quick product-builder setup:",
      `- Starting point: ${selectedTemplate?.label ?? "Custom product"}`,
      `- Expected scale: ${selectedScale.label}`,
      `- Product priority: ${selectedPriority.label}`,
      `- Product domain: ${selectedDomain.label}`,
      "- Workflow preference: generate a practical product workspace immediately using sensible assumptions.",
      "- Output preference: return idea, requirements, user flow, UI, backend, database, API, architecture, roadmap, and export pack.",
      "- Requirement behavior: do not ask clarification questions in this quick-create path; choose reasonable defaults and list them as assumptions."
    ].join("\n");
  }, [
    description,
    selectedDomain.label,
    selectedPriority.label,
    selectedScale.label,
    selectedTemplate
  ]);

  useEffect(() => {
    const requestedTemplate = new URLSearchParams(window.location.search).get("template");
    const template = projectTemplates.find((item) => item.id === requestedTemplate);

    if (!template) return;

    setTemplateId(template.id);
    setName(template.suggestedName);
    setDescription(template.description);
  }, []);

  useEffect(() => {
    if (!saving) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saving]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    window.requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [stepIndex]);

  function applyTemplate(nextTemplateId: ProjectTemplateId) {
    const template = projectTemplates.find((item) => item.id === nextTemplateId);
    setTemplateId(nextTemplateId);

    if (!template || nextTemplateId === "custom") return;

    if (!nameTouched) {
      setName(template.suggestedName);
    }

    if (!descriptionTouched) {
      setDescription(template.description);
    }
  }

  function goNext() {
    if (!canContinue) return;
    setError(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function submit() {
    setSaving(true);
    setError(null);

    try {
      if (!isLoaded || !isSignedIn) {
        setError("Authentication is still getting ready. Try again in a moment.");
        return;
      }

      const token = await getToken();
      if (!token) {
        setError("Authentication is not ready. Refresh and try again.");
        return;
      }

      setAuthTokenProvider(() => getToken());
      setGenerationStage("Creating workspace");
      const project = await createProject({
        name: name.trim(),
        description: generatedBrief
      });

      setGenerationStage("Starting product build");
      const session = await createDesignSession(project.id, {
        title: `${name.trim()} product build`,
        problemStatement: generatedBrief
      });

      setGenerationStage("Shaping requirements");
      let requirements = await analyzeRequirements(session.id);

      for (
        let attempt = 0;
        requirements.status === "REQUIREMENTS_PENDING" && attempt < 5;
        attempt += 1
      ) {
        const questions = requirements.analysis?.clarificationQuestions ?? [];

        if (questions.length === 0) {
          break;
        }

        setGenerationStage("Resolving default decisions");
        requirements = await submitClarifications(
          session.id,
          questions.map((question) => ({
            questionId: question.id,
            answer: question.options?.[0] ?? "Use Helix recommended default"
          }))
        );
      }

      if (requirements.status !== "READY_FOR_DESIGN") {
        throw new Error(
          "Helix could not infer enough defaults to generate the design automatically. Add a little more context in the brief and try again."
        );
      }

      setGenerationStage("Estimating capacity");
      await calculateCapacity(session.id, {});

      setGenerationStage("Generating product workspace");
      await generateDesign(session.id);

      setGenerationStage("Rendering architecture diagram");
      await generateDiagram(session.id);

      setGenerationStage("Opening results");
      router.push(`/design-sessions/${session.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Product workspace could not be generated."
      );
    } finally {
      setGenerationStage(null);
      setSaving(false);
    }
  }

  return (
    <>
      <GenerationOverlay
        visible={saving}
        stage={generationStage ?? "Preparing generation"}
        projectName={name.trim() || "Untitled project"}
      />
      <div
        ref={formCardRef}
        className="scroll-mt-24 overflow-hidden rounded-lg border border-line bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)]"
      >
        <div className="border-b border-white/10 bg-black/18 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Quick product builder
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{currentStep.label}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {steps.map((step, index) => {
                const active = index === stepIndex;
                const completed = index < stepIndex;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (!saving && (index <= stepIndex || name.trim().length >= 2)) {
                        setStepIndex(index);
                      }
                    }}
                    className={[
                      "h-2.5 rounded-full transition-all",
                      active
                        ? "w-10 bg-white"
                        : completed
                          ? "w-5 bg-white/55"
                          : "w-5 bg-white/14 hover:bg-white/24"
                    ].join(" ")}
                    aria-label={`Go to ${step.label}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {error ? <ErrorState message={error} /> : null}

          {currentStep.id === "template" ? (
            <ChoiceSection
              eyebrow="Step 1"
              title="Pick the closest product type."
              choices={projectTemplates}
              value={templateId}
              onChange={applyTemplate}
              columns="lg:grid-cols-3"
            />
          ) : null}

          {currentStep.id === "basics" ? (
            <section className="mx-auto max-w-2xl py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.06]">
                <Sparkles size={18} aria-hidden="true" />
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Step 2
              </p>
              <h3 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
                Name it and give a short brief.
              </h3>
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => {
                  setNameTouched(true);
                  setName(event.target.value);
                }}
                className="field mt-6 min-h-14 w-full rounded-md px-4 text-base outline-none"
                placeholder="Notification platform"
                autoFocus
              />
              <textarea
                value={description}
                onChange={(event) => {
                  setDescriptionTouched(true);
                  setDescription(event.target.value);
                }}
                className="field mt-3 min-h-32 w-full rounded-md px-4 py-3 text-sm leading-6 outline-none"
                placeholder="Optional: describe users, workflow, business rules, integrations, or scale."
              />
            </section>
          ) : null}

          {currentStep.id === "profile" ? (
            <div className="mx-auto max-w-4xl space-y-6">
              <ChoiceSection
                eyebrow="Step 3"
                title="Choose the design profile."
                choices={scales}
                value={scale}
                onChange={setScale}
              />
              <CompactChoice
                label="Priority"
                choices={priorities}
                value={priority}
                onChange={setPriority}
              />
              <CompactChoice label="Domain" choices={domains} value={domain} onChange={setDomain} />
            </div>
          ) : null}

          {currentStep.id === "review" ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="rounded-lg border border-white/10 bg-black/18 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Ready to generate
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-ink">
                  {name.trim() || "Untitled project"}
                </h3>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted">
                  {generatedBrief}
                </p>
                {generationStage ? (
                  <div className="mt-5 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.055] px-3 py-3 text-sm text-ink">
                    <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                    {generationStage}
                  </div>
                ) : null}
              </div>
              <aside className="space-y-3">
                <SummaryPill label="Template" value={selectedTemplate?.label ?? "Custom system"} />
                <SummaryPill label="Scale" value={selectedScale.label} />
                <SummaryPill label="Priority" value={selectedPriority.label} />
                <SummaryPill label="Domain" value={selectedDomain.label} />
              </aside>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/14 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button
            type="button"
            variant="secondary"
            icon={<ArrowLeft size={16} />}
            onClick={goBack}
            disabled={stepIndex === 0 || saving}
          >
            Back
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-muted">
              {stepIndex + 1} / {steps.length}
            </p>
            {currentStep.id === "review" ? (
              <Button
                type="button"
                icon={
                  saving ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />
                }
                onClick={() => void submit()}
                disabled={!isLoaded || !isSignedIn || saving || name.trim().length < 2}
              >
                {saving ? "Building" : "Build product workspace"}
              </Button>
            ) : (
              <Button
                type="button"
                icon={<ArrowRight size={16} />}
                onClick={goNext}
                disabled={!canContinue || saving}
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function GenerationOverlay({
  visible,
  stage,
  projectName
}: {
  visible: boolean;
  stage: string;
  projectName: string;
}) {
  if (!visible) return null;

  const stageIndex = Math.max(
    0,
    generationSteps.findIndex((item) => item === stage)
  );
  const normalizedIndex = stageIndex === -1 ? 0 : stageIndex;
  const progress = Math.round(((normalizedIndex + 1) / generationSteps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 backdrop-blur-lg">
      <div className="page-enter relative w-full max-w-2xl overflow-hidden rounded-lg border border-white/14 bg-[#17191f] shadow-[0_40px_140px_rgba(0,0,0,0.72)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        <div className="p-6 sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-black/24">
              <div className="absolute h-20 w-20 animate-spin rounded-full border border-transparent border-t-white/70 border-r-white/20" />
              <div className="absolute h-14 w-14 rounded-full border border-white/10 bg-white/[0.045]" />
              <Sparkles className="relative text-white" size={24} aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
                <Loader2 className="animate-spin" size={13} aria-hidden="true" />
                Helix is generating
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-ink">
                Building "{projectName}"
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Keep this tab open while Helix shapes the product, maps the UI and backend,
                estimates capacity, and renders the architecture.
              </p>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{stage}</p>
                  <p className="text-sm text-muted">{progress}%</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {generationSteps.map((item, index) => {
              const done = index < normalizedIndex;
              const active = index === normalizedIndex;

              return (
                <div
                  key={item}
                  className={[
                    "flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition",
                    active
                      ? "border-white/28 bg-white/[0.085] text-ink"
                      : done
                        ? "border-emerald-300/18 bg-emerald-300/8 text-slate-200"
                        : "border-white/8 bg-black/16 text-muted"
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                      active
                        ? "border-white/30 bg-white text-slate-950"
                        : done
                          ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
                          : "border-white/10 bg-white/[0.035] text-muted"
                    ].join(" ")}
                  >
                    {done ? <Check size={13} aria-hidden="true" /> : index + 1}
                  </span>
                  <span>{item}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-md border border-white/10 bg-black/18 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              What is happening
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Some AI steps can take a bit. The workspace is still alive, and the result page will
              open automatically when the product build is ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChoiceSection<TValue extends string>({
  eyebrow,
  title,
  choices,
  value,
  onChange,
  columns = "lg:grid-cols-2"
}: {
  eyebrow: string;
  title: string;
  choices: Choice<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  columns?: string;
}) {
  return (
    <section className="mx-auto max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
      <h3 className="mt-2 max-w-2xl text-2xl font-semibold text-ink">{title}</h3>
      <div className={`mt-6 grid gap-3 ${columns}`}>
        {choices.map((choice) => (
          <ChoiceButton
            key={choice.id}
            choice={choice}
            selected={choice.id === value}
            onClick={() => onChange(choice.id)}
          />
        ))}
      </div>
    </section>
  );
}

function CompactChoice<TValue extends string>({
  label,
  choices,
  value,
  onChange
}: {
  label: string;
  choices: Choice<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {choices.map((choice) => (
          <ChoiceButton
            key={choice.id}
            choice={choice}
            selected={choice.id === value}
            compact
            onClick={() => onChange(choice.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ChoiceButton<TValue extends string>({
  choice,
  selected,
  compact = false,
  onClick
}: {
  choice: Choice<TValue>;
  selected: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = choice.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group rounded-lg border text-left transition duration-200 hover:-translate-y-0.5",
        compact ? "min-h-24 p-3" : "min-h-28 p-4",
        selected
          ? "border-white bg-white text-slate-950 shadow-[0_20px_70px_rgba(255,255,255,0.08)]"
          : "border-white/10 bg-white/[0.04] text-ink hover:border-white/20 hover:bg-white/[0.07]"
      ].join(" ")}
    >
      <span className="flex items-start gap-3">
        <span
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition",
            selected
              ? "border-slate-950/10 bg-slate-950 text-white"
              : "border-white/10 bg-black/18 text-muted group-hover:text-ink"
          ].join(" ")}
        >
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{choice.label}</span>
            {selected ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                <Check size={13} aria-hidden="true" />
              </span>
            ) : null}
          </span>
          <span
            className={[
              "mt-1 block text-sm leading-5",
              selected ? "text-slate-700" : "text-muted"
            ].join(" ")}
          >
            {choice.description}
          </span>
          {!compact && choice.tags ? (
            <span className="mt-3 flex flex-wrap gap-1.5">
              {choice.tags.map((tag) => (
                <span
                  key={tag}
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    selected
                      ? "border-slate-950/12 bg-slate-950/5 text-slate-700"
                      : "border-white/10 bg-black/18 text-muted"
                  ].join(" ")}
                >
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
