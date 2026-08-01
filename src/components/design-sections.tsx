import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Code2,
  Database,
  Download,
  Folder,
  FolderTree,
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

interface FolderGroup {
  name: string;
  icon: LucideIcon;
  items: string[];
}

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

function uniqueSlugs(values: string[], fallback: string[]): string[] {
  const seen = new Set<string>();
  const slugs = values
    .map((value) => toKebabCase(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });

  return slugs.length > 0 ? slugs.slice(0, 5) : fallback;
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

function FlowchartPanel({ workspace }: { workspace: ProductWorkspace }) {
  const primaryUi = workspace.uiSurfaces[0]?.name ?? "Product UI";
  const secondaryUi = workspace.uiSurfaces[1]?.name ?? "Admin UI";
  const api = workspace.apiPlan[0];
  const apiLabel = api ? `${api.method} ${api.path}` : "Core API";
  const service = workspace.backendServices[0]?.name ?? "Application Service";
  const worker =
    workspace.backendServices.find((item) => /queue|worker|process|event/i.test(item.trigger))
      ?.name ??
    workspace.backendServices[1]?.name ??
    "Worker Service";
  const database = workspace.databasePlan[0]?.name ?? "Primary Database";

  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.26)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-ink">
            <GitBranch size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Flowchart
            </p>
            <h3 className="text-lg font-semibold text-ink">How the product is built</h3>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs text-muted">
          UI → API → Service → Data
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[900px] grid-cols-[1fr_3rem_1fr_3rem_1fr_3rem_1fr] items-center">
          <FlowStack icon={LayoutDashboard} label="Interface" nodes={[primaryUi, secondaryUi]} />
          <FlowArrow />
          <FlowStack icon={Code2} label="Contract" nodes={[apiLabel, "Auth + validation"]} />
          <FlowArrow />
          <FlowStack icon={Server} label="Logic" nodes={[service, worker]} />
          <FlowArrow />
          <FlowStack icon={Database} label="State" nodes={[database, "Cache / events"]} />
        </div>
      </div>
    </section>
  );
}

function FlowStack({
  icon: Icon,
  label,
  nodes
}: {
  icon: LucideIcon;
  label: string;
  nodes: string[];
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <Icon size={15} aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <div className="space-y-2">
        {nodes.map((node, index) => (
          <div
            key={`${label}-${node}-${index}`}
            className={[
              "rounded-md border px-3 py-3 text-sm font-semibold",
              index === 0
                ? "border-white/18 bg-white text-slate-950"
                : "border-white/10 bg-white/[0.045] text-slate-300"
            ].join(" ")}
          >
            {shortText(node, 44)}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center text-white/35">
      <ArrowRight size={22} aria-hidden="true" />
    </div>
  );
}

function FolderStructure({ workspace }: { workspace: ProductWorkspace }) {
  const groups: FolderGroup[] = [
    {
      name: "apps",
      icon: LayoutDashboard,
      items: uniqueSlugs(
        workspace.uiSurfaces.map((surface) => surface.name),
        ["web-app", "admin-console"]
      )
    },
    {
      name: "services",
      icon: Server,
      items: uniqueSlugs(
        workspace.backendServices.map((service) => service.name),
        ["api-service", "worker-service"]
      )
    },
    {
      name: "data",
      icon: Database,
      items: uniqueSlugs(
        workspace.databasePlan.map((database) => database.name),
        ["primary-db", "cache", "event-log"]
      )
    },
    {
      name: "contracts",
      icon: Braces,
      items: uniqueSlugs(
        workspace.apiPlan.map((api) => `${api.method}-${api.path}`),
        ["rest-api", "webhooks"]
      )
    }
  ];

  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-ink">
          <FolderTree size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Folder structure
          </p>
          <h3 className="text-lg font-semibold text-ink">Suggested implementation layout</h3>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/24 p-4 font-mono text-sm">
        <div className="flex items-center gap-2 text-ink">
          <Folder size={15} aria-hidden="true" />
          <span>product/</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <div
                key={group.name}
                className="rounded-md border border-white/10 bg-white/[0.035] p-3"
              >
                <div className="flex items-center gap-2 text-slate-100">
                  <Icon size={14} aria-hidden="true" />
                  <span>{group.name}/</span>
                </div>
                <div className="mt-3 space-y-2 pl-3 text-xs text-muted">
                  {group.items.slice(0, 4).map((item) => (
                    <div key={`${group.name}-${item}`} className="flex items-center gap-2">
                      <span className="h-px w-3 bg-white/18" />
                      <span>{item}/</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
      <FlowchartPanel workspace={workspace} />
      <FolderStructure workspace={workspace} />
      <ExportStrip workspace={workspace} />
    </div>
  );
}
