import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Database,
  Download,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Route,
  Server,
  Shield,
  Sparkles,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GeneratedDesign } from "@/lib/types";

interface DesignSectionsProps {
  design: GeneratedDesign | null;
}

type ProductWorkspace = NonNullable<GeneratedDesign["productWorkspace"]>;

function toKebabCase(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 42) || "module"
  );
}

function shortText(value: string, maxLength = 86): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function buildWorkspaceFromDesign(design: GeneratedDesign): ProductWorkspace {
  if (design.productWorkspace) {
    return design.productWorkspace;
  }

  return {
    idea: {
      name: "Product workspace",
      summary: design.architectureSummary,
      targetUsers: "Product, engineering, and architecture teams",
      primaryValue: "Turn a rough idea into a shippable technical plan."
    },
    requirements: design.majorComponents.slice(0, 5).map((component, index) => ({
      label: `R-${index + 1}`,
      detail: component.responsibilities[0] ?? `Support ${component.name}.`,
      priority: index < 3 ? "MUST" : "SHOULD"
    })),
    userFlow: [
      {
        step: "Idea",
        actor: "Founder or PM",
        action: "Captures the product concept.",
        systemResponse: "Turns the brief into requirements and assumptions."
      },
      {
        step: "Plan",
        actor: "Team",
        action: "Reviews the generated product and technical shape.",
        systemResponse: "Shows user flows, implementation surfaces, and architecture."
      },
      {
        step: "Build",
        actor: "Engineer",
        action: "Uses the API, database, and service map.",
        systemResponse: "Provides a scoped blueprint for implementation."
      }
    ],
    uiSurfaces: [
      {
        name: "Primary workspace",
        purpose: "Run the main product workflow.",
        keyElements: ["Overview", "Create action", "Status timeline", "Activity"]
      },
      {
        name: "Admin console",
        purpose: "Operate and inspect the product.",
        keyElements: ["Health", "Users", "Events", "Controls"]
      }
    ],
    backendServices: design.majorComponents.slice(0, 6).map((component) => ({
      name: component.name,
      responsibility: component.responsibilities[0] ?? "Own a core capability.",
      trigger: /worker|queue|stream|process/i.test(component.name) ? "Queue event" : "API request"
    })),
    databasePlan: design.databaseChoices.slice(0, 3).map((item) => ({
      name: item.name,
      stores: item.recommendation,
      accessPattern: item.reasoning
    })),
    apiPlan: design.apiRecommendations.slice(0, 4).map((item, index) => ({
      method: index === 0 ? "POST" : "GET",
      path: `/api/v1/${toKebabCase(item.name)}`,
      purpose: item.recommendation
    })),
    architectureHighlights: [
      ...design.scalabilityApproach.slice(0, 2),
      ...design.reliabilityAndFailureHandling.slice(0, 1)
    ],
    roadmap: [
      {
        phase: "MVP",
        goal: "Ship the smallest useful product path.",
        deliverables: ["Core UI", "API", "Database", "Auth"]
      },
      {
        phase: "Scale",
        goal: "Harden the product for real usage.",
        deliverables: ["Workers", "Caching", "Observability", "Retries"]
      }
    ],
    exportArtifacts: [
      {
        name: "Build pack",
        format: "Workspace",
        contents: ["UI", "Backend", "Database", "API"]
      }
    ]
  };
}

function SignalPill({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={15} aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink">{shortText(value, 92)}</p>
    </div>
  );
}

function ProductBlueprint({ workspace }: { workspace: ProductWorkspace }) {
  const coreRequirement = workspace.requirements[0];
  const firstRoadmap = workspace.roadmap[0];

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.32)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="p-5 sm:p-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
            <Sparkles size={13} aria-hidden="true" />
            Product blueprint
          </p>
          <h3 className="mt-5 max-w-3xl text-3xl font-semibold tracking-normal text-ink sm:text-4xl">
            {workspace.idea.name}
          </h3>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
            {shortText(workspace.idea.summary, 190)}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <SignalPill icon={Users} label="For" value={workspace.idea.targetUsers} />
            <SignalPill icon={CheckCircle2} label="Value" value={workspace.idea.primaryValue} />
            <SignalPill
              icon={ListChecks}
              label="Core need"
              value={coreRequirement?.detail ?? "Ship the primary product workflow first."}
            />
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.58fr)]">
            <HowItWorks workspace={workspace} />
            <NextMove
              title={firstRoadmap?.phase ?? "MVP"}
              goal={firstRoadmap?.goal ?? "Ship the core product path."}
              deliverables={firstRoadmap?.deliverables ?? ["UI", "API", "Database", "Auth"]}
            />
          </div>
        </div>

        <BuildCard workspace={workspace} />
      </div>
    </section>
  );
}

function HowItWorks({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-ink">
          <Route size={17} aria-hidden="true" />
        </span>
        <h4 className="text-base font-semibold text-ink">How it works</h4>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {workspace.userFlow.slice(0, 3).map((step, index) => (
          <div
            key={`${step.step}-${index}`}
            className="relative rounded-md border border-white/10 bg-white/[0.045] p-3"
          >
            {index < 2 ? (
              <ArrowRight
                className="absolute -right-3 top-8 hidden text-white/25 md:block"
                size={16}
                aria-hidden="true"
              />
            ) : null}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950">
              {index + 1}
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{step.step}</p>
            <p className="mt-2 text-xs leading-5 text-muted">{shortText(step.action, 72)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NextMove({
  title,
  goal,
  deliverables
}: {
  title: string;
  goal: string;
  deliverables: string[];
}) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.045] p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-ink">
          <Shield size={17} aria-hidden="true" />
        </span>
        <h4 className="text-base font-semibold text-ink">Next move</h4>
      </div>
      <p className="text-xl font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{shortText(goal, 92)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {deliverables.slice(0, 4).map((item) => (
          <span
            key={item}
            className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function BuildCard({ workspace }: { workspace: ProductWorkspace }) {
  const primaryUi = workspace.uiSurfaces[0];
  const primaryService = workspace.backendServices[0];
  const primaryDatabase = workspace.databasePlan[0];
  const primaryApi = workspace.apiPlan[0];

  return (
    <aside className="border-t border-white/10 bg-black/18 p-5 xl:border-l xl:border-t-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white text-slate-950">
          <GitBranch size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Build map</p>
          <p className="text-sm font-semibold text-ink">Most important pieces</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <BuildNode
          icon={LayoutDashboard}
          label="UI"
          title={primaryUi?.name ?? "Product workspace"}
        />
        <BuildConnector />
        <BuildNode
          icon={Code2}
          label="API"
          title={primaryApi ? `${primaryApi.method} ${primaryApi.path}` : "Core API"}
        />
        <BuildConnector />
        <BuildNode
          icon={Server}
          label="Service"
          title={primaryService?.name ?? "Application service"}
        />
        <BuildConnector />
        <BuildNode
          icon={Database}
          label="Data"
          title={primaryDatabase?.name ?? "Primary database"}
        />
      </div>

      <details className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
          More build details
        </summary>
        <div className="mt-4 space-y-2">
          {workspace.backendServices.slice(0, 4).map((service) => (
            <p
              key={service.name}
              className="rounded-md border border-white/10 bg-black/18 px-3 py-2 text-xs leading-5 text-muted"
            >
              {service.name} · {shortText(service.responsibility, 70)}
            </p>
          ))}
        </div>
      </details>
    </aside>
  );
}

function BuildNode({
  icon: Icon,
  label,
  title
}: {
  icon: LucideIcon;
  label: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 text-ink">
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-ink">{title}</p>
        </div>
      </div>
    </div>
  );
}

function BuildConnector() {
  return <div className="ml-5 h-4 w-px bg-white/18" aria-hidden="true" />;
}

function ExportStrip({ workspace }: { workspace: ProductWorkspace }) {
  const artifact = workspace.exportArtifacts[0];

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <MiniPanel
        icon={Download}
        label="Export"
        value={artifact ? `${artifact.name} · ${artifact.format}` : "Build pack"}
      />
      <MiniPanel
        icon={LayoutDashboard}
        label="Screens"
        value={workspace.uiSurfaces
          .map((surface) => surface.name)
          .slice(0, 2)
          .join(" / ")}
      />
      <MiniPanel
        icon={Database}
        label="Data"
        value={workspace.databasePlan
          .map((database) => database.name)
          .slice(0, 2)
          .join(" / ")}
      />
    </section>
  );
}

function MiniPanel({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.035] p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={15} aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink">
        {shortText(value || "Ready", 88)}
      </p>
    </div>
  );
}

export function DesignSections({ design }: DesignSectionsProps) {
  if (!design) {
    return <p className="text-sm text-muted">Generate a product workspace to see the build map.</p>;
  }

  const workspace = buildWorkspaceFromDesign(design);

  return (
    <div className="space-y-4">
      <ProductBlueprint workspace={workspace} />
      <ExportStrip workspace={workspace} />
    </div>
  );
}
