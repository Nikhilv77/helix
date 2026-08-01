"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Calculator,
  FileCheck,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  analyzeRequirements,
  calculateCapacity,
  generateDesign,
  generateDiagram,
  getCapacity,
  getDesignSession,
  getDiagram,
  getGeneratedDesign,
  getProject,
  getRequirements,
  getValidation,
  validateDesign
} from "@/lib/api-client";
import {
  canAnalyzeRequirements,
  canCalculateCapacity,
  canGenerateDesign,
  canGenerateDiagram,
  canSubmitClarifications,
  canValidateDesign
} from "@/lib/session-flow";
import type {
  CapacityResponse,
  DesignSession,
  DiagramResponse,
  GeneratedDesignResponse,
  Project,
  RequirementsResponse,
  ValidationResponse
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressStepper } from "@/components/progress-stepper";
import { Section } from "@/components/section";
import { RequirementAnalysisPanel } from "@/components/requirement-analysis-panel";
import { ClarificationPanel } from "@/components/clarification-panel";
import { CapacityMetrics } from "@/components/capacity-metrics";
import { DesignSections } from "@/components/design-sections";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { ValidationPanel } from "@/components/validation-panel";
import { formatDate } from "@/lib/format";

interface SessionPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

type ActionName = "requirements" | "capacity" | "design" | "diagram" | "validation";

const actionCopy: Record<
  ActionName,
  {
    title: string;
    description: string;
    stages: string[];
    icon: LucideIcon;
  }
> = {
  requirements: {
    title: "Shaping requirements",
    description:
      "Extracting product intent, user goals, scale signals, and only the decisions that matter.",
    stages: ["Parsing product brief", "Inferring defaults", "Preparing focused decisions"],
    icon: Brain
  },
  capacity: {
    title: "Estimating capacity",
    description:
      "Turning requirement inputs into deterministic traffic, bandwidth, and storage estimates.",
    stages: ["Normalizing scale", "Estimating peak load", "Checking storage retention"],
    icon: Calculator
  },
  design: {
    title: "Building product workspace",
    description:
      "Composing user flows, UI surfaces, services, APIs, data paths, roadmap, and exports.",
    stages: ["Mapping product flow", "Choosing build surfaces", "Balancing trade-offs"],
    icon: FileCheck
  },
  diagram: {
    title: "Rendering diagram",
    description:
      "Building a safe layered Mermaid view with readable product and architecture boundaries.",
    stages: ["Grouping layers", "Routing flows", "Validating Mermaid"],
    icon: GitBranch
  },
  validation: {
    title: "Reviewing build plan",
    description:
      "Reviewing reliability, scalability, security, observability, cost, and launch readiness.",
    stages: ["Scoring categories", "Finding gaps", "Preparing recommendations"],
    icon: ShieldCheck
  }
};

function ActionConsole({ action }: { action: ActionName }) {
  const config = actionCopy[action];
  const Icon = config.icon;

  return (
    <Card className="overflow-hidden border-cyan-300/25 bg-cyan-300/8 p-0 shadow-glow">
      <div className="relative p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/12 text-brand">
              <Loader2
                className="absolute animate-spin text-cyan-200/70"
                size={30}
                aria-hidden="true"
              />
              <Icon size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-accent">
                <Sparkles size={13} aria-hidden="true" />
                Copilot in progress
              </p>
              <h2 className="mt-3 text-xl font-semibold text-ink">{config.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{config.description}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            {config.stages.map((stage, index) => (
              <div key={stage} className="rounded-md border border-line bg-black/25 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-slate-300">{stage}</p>
                  <span className="text-xs text-muted">0{index + 1}</span>
                </div>
                <div className="shimmer h-1.5 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function shortText(value: string, maxLength = 116): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function ArchitecturePill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function ArchitectureResultView({
  session,
  projectName,
  sessionId,
  action,
  runAction
}: {
  session: DesignSession;
  projectName: string;
  sessionId: string;
  action: ActionName | null;
  runAction: (name: ActionName, handler: () => Promise<unknown>) => void;
}) {
  const design = session.generatedDesign;
  if (!design) return null;

  const workspace = design.productWorkspace;

  return (
    <div className="page-enter mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            href={`/projects/${session.projectId}`}
            variant="ghost"
            icon={<ArrowLeft size={16} />}
          >
            Back to project
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-normal text-ink">{session.title}</h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {projectName} · Updated {formatDate(session.updatedAt)}
          </p>
        </div>
        <Button
          icon={session.architectureDiagram ? <RefreshCw size={16} /> : <GitBranch size={16} />}
          variant="secondary"
          disabled={!canGenerateDiagram(session) || action !== null}
          onClick={() => void runAction("diagram", () => generateDiagram(sessionId))}
        >
          {session.architectureDiagram ? "Refresh diagram" : "Generate diagram"}
        </Button>
      </div>

      {action ? <ActionConsole action={action} /> : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-sm font-medium text-slate-100">
                <Sparkles size={14} aria-hidden="true" />
                Product workspace ready
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-ink">
                Idea to build plan
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">
                {shortText(design.architectureSummary, 180)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
              <ArchitecturePill label="UI surfaces" value={workspace?.uiSurfaces.length ?? 0} />
              <ArchitecturePill label="Services" value={design.majorComponents.length} />
              <ArchitecturePill label="Roadmap" value={workspace?.roadmap.length ?? 0} />
            </div>
          </div>
        </div>
        <div className="bg-black/16 p-5">
          <MermaidDiagram diagram={session.architectureDiagram} compact />
        </div>
      </Card>

      <DesignSections design={design} />
    </div>
  );
}

export default function SessionPage({ params }: SessionPageProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<DesignSession | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<RequirementsResponse | null>(null);
  const [capacity, setCapacity] = useState<CapacityResponse | null>(null);
  const [design, setDesign] = useState<GeneratedDesignResponse | null>(null);
  const [diagram, setDiagram] = useState<DiagramResponse | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionName | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((resolved) => setSessionId(resolved.sessionId));
  }, [params]);

  async function loadSession(id: string) {
    setLoading(true);
    setError(null);

    try {
      const loadedSession = await getDesignSession(id);
      const [
        loadedProject,
        loadedRequirements,
        loadedCapacity,
        loadedDesign,
        loadedDiagram,
        loadedValidation
      ] = await Promise.all([
        getProject(loadedSession.projectId),
        getRequirements(id).catch(() => null),
        getCapacity(id).catch(() => null),
        getGeneratedDesign(id).catch(() => null),
        getDiagram(id).catch(() => null),
        getValidation(id).catch(() => null)
      ]);

      setSession(loadedSession);
      setProject(loadedProject);
      setRequirements(loadedRequirements);
      setCapacity(loadedCapacity);
      setDesign(loadedDesign);
      setDiagram(loadedDiagram);
      setValidation(loadedValidation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Design session could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionId) {
      void loadSession(sessionId);
    }
  }, [sessionId]);

  async function runAction(name: ActionName, handler: () => Promise<unknown>) {
    if (!sessionId) return;
    setAction(name);
    setError(null);

    try {
      await handler();
      await loadSession(sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setAction(null);
    }
  }

  const mergedSession = useMemo(() => {
    if (!session) return null;
    return {
      ...session,
      requirementAnalysis: requirements?.analysis ?? session.requirementAnalysis,
      clarificationAnswers: requirements?.clarificationAnswers ?? session.clarificationAnswers,
      capacityCalculation: capacity?.calculation ?? session.capacityCalculation,
      generatedDesign: design?.design ?? session.generatedDesign,
      architectureDiagram: diagram?.diagram ?? session.architectureDiagram,
      designValidation: validation?.validation ?? session.designValidation
    };
  }, [capacity, design, diagram, requirements, session, validation]);

  if (!sessionId || loading) return <LoadingState label="Loading design session" />;
  if (error && !mergedSession)
    return <ErrorState message={error} onRetry={() => loadSession(sessionId)} />;
  if (!mergedSession) {
    return <ErrorState message="The design session could not be found." />;
  }

  if (mergedSession.generatedDesign) {
    return (
      <ArchitectureResultView
        session={mergedSession}
        projectName={project?.name ?? "Project"}
        sessionId={sessionId}
        action={action}
        runAction={runAction}
      />
    );
  }

  const questions = mergedSession.requirementAnalysis?.clarificationQuestions ?? [];
  const answers = requirements?.clarificationAnswers ?? mergedSession.clarificationAnswers ?? [];

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            href={`/projects/${mergedSession.projectId}`}
            variant="ghost"
            icon={<ArrowLeft size={16} />}
          >
            Back to project
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-normal text-ink">
              {mergedSession.title}
            </h1>
            <StatusBadge status={mergedSession.status} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {project?.name ?? "Project"} · Updated {formatDate(mergedSession.updatedAt)}
          </p>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => loadSession(sessionId)} /> : null}

      <ProgressStepper session={mergedSession} />

      {action ? <ActionConsole action={action} /> : null}

      {mergedSession.failureMessage ? (
        <Card className="border-red-400/35 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-100">Last failure</p>
          <p className="mt-1 text-sm leading-6 text-red-200">{mergedSession.failureMessage}</p>
        </Card>
      ) : null}

      <Section title="Idea brief">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {mergedSession.problemStatement}
        </p>
      </Section>

      <Section
        title="Product requirements"
        description="Structured product requirements and build inputs produced from the idea brief."
        action={
          <Button
            icon={<Brain size={16} />}
            disabled={!canAnalyzeRequirements(mergedSession) || action !== null}
            onClick={() => void runAction("requirements", () => analyzeRequirements(sessionId))}
          >
            {action === "requirements" ? "Analyzing" : "Analyze"}
          </Button>
        }
      >
        <RequirementAnalysisPanel analysis={mergedSession.requirementAnalysis} />
      </Section>

      <Section
        title="Clarification questions"
        description="Pick answers for the few decisions that materially affect the product."
      >
        <ClarificationPanel
          sessionId={sessionId}
          questions={questions}
          answers={answers}
          disabled={!canSubmitClarifications(mergedSession) || action !== null}
          onSaved={() => loadSession(sessionId)}
        />
      </Section>

      <Section
        title="Capacity model"
        description="Deterministic traffic, bandwidth, and storage estimates."
        action={
          <Button
            icon={<Calculator size={16} />}
            disabled={!canCalculateCapacity(mergedSession) || action !== null}
            onClick={() => void runAction("capacity", () => calculateCapacity(sessionId, {}))}
          >
            {action === "capacity" ? "Estimating" : "Estimate"}
          </Button>
        }
      >
        <CapacityMetrics calculation={mergedSession.capacityCalculation} />
      </Section>

      <Section
        title="Product workspace"
        description="Visual build plan across idea, requirements, user flow, UI, backend, database, API, architecture, roadmap, and exports."
        action={
          <Button
            icon={<FileCheck size={16} />}
            disabled={!canGenerateDesign(mergedSession) || action !== null}
            onClick={() => void runAction("design", () => generateDesign(sessionId))}
          >
            {action === "design" ? "Building" : "Build workspace"}
          </Button>
        }
      >
        <DesignSections design={mergedSession.generatedDesign} />
      </Section>

      <Section
        title="Architecture map"
        description="A safe flowchart rendering of the generated product architecture."
        action={
          <Button
            icon={
              mergedSession.architectureDiagram ? <RefreshCw size={16} /> : <GitBranch size={16} />
            }
            disabled={!canGenerateDiagram(mergedSession) || action !== null}
            onClick={() => void runAction("diagram", () => generateDiagram(sessionId))}
          >
            {action === "diagram"
              ? "Generating"
              : mergedSession.architectureDiagram
                ? "Regenerate"
                : "Generate diagram"}
          </Button>
        }
      >
        <MermaidDiagram diagram={mergedSession.architectureDiagram} />
      </Section>

      <Section
        title="Launch review"
        description="Scored review across reliability, scalability, security, observability, cost, and operations."
        action={
          <Button
            icon={<ShieldCheck size={16} />}
            disabled={!canValidateDesign(mergedSession) || action !== null}
            onClick={() => void runAction("validation", () => validateDesign(sessionId))}
          >
            {action === "validation"
              ? "Validating"
              : mergedSession.designValidation
                ? "Validate again"
                : "Review build"}
          </Button>
        }
      >
        <ValidationPanel validation={mergedSession.designValidation} />
      </Section>
    </div>
  );
}
