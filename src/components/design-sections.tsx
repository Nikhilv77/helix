import {
  Activity,
  ArrowRight,
  Braces,
  CheckCircle2,
  Code2,
  Database,
  Download,
  FolderTree,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Map,
  Route,
  Server,
  Shield,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DescriptionItem, GeneratedDesign } from "@/lib/types";

interface DesignSectionsProps {
  design: GeneratedDesign | null;
}

type ProductWorkspace = NonNullable<GeneratedDesign["productWorkspace"]>;

interface BlueprintFolder {
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

function uniqueValues(values: string[], fallback: string[]): string[] {
  const seen = new Set<string>();
  const next = values
    .map((value) => toKebabCase(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });

  return next.length > 0 ? next.slice(0, 7) : fallback;
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
      },
      {
        phase: "Launch",
        goal: "Prepare for teams and operations.",
        deliverables: ["Audit logs", "Exports", "Runbooks", "Roadmap"]
      }
    ],
    exportArtifacts: [
      {
        name: "Product brief",
        format: "Markdown",
        contents: ["Idea", "Requirements", "User flow"]
      },
      {
        name: "Build pack",
        format: "Workspace",
        contents: ["UI", "Backend", "Database", "API"]
      }
    ]
  };
}

function buildBlueprintFolders(workspace: ProductWorkspace): BlueprintFolder[] {
  return [
    {
      name: "apps",
      icon: LayoutDashboard,
      items: uniqueValues(
        workspace.uiSurfaces.map((surface) => surface.name),
        ["web-app", "admin-console"]
      )
    },
    {
      name: "services",
      icon: Server,
      items: uniqueValues(
        workspace.backendServices.map((service) => service.name),
        ["api-service", "worker-service"]
      )
    },
    {
      name: "data",
      icon: Database,
      items: uniqueValues(
        workspace.databasePlan.map((database) => database.name),
        ["primary-db", "cache", "event-log"]
      )
    },
    {
      name: "contracts",
      icon: Braces,
      items: uniqueValues(
        workspace.apiPlan.map((api) => `${api.method}-${api.path}`),
        ["rest-api", "webhooks"]
      )
    }
  ];
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-ink">
        <Icon size={17} aria-hidden="true" />
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
    </div>
  );
}

function WorkspaceHero({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
      <div className="rounded-lg border border-line bg-white/[0.055] p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/12 bg-black/22 text-ink">
            <Map size={21} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Product idea
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">{workspace.idea.name}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {workspace.idea.summary}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MetricCard icon={Users} label="Audience" value={workspace.idea.targetUsers} />
        <MetricCard icon={CheckCircle2} label="Value" value={workspace.idea.primaryValue} />
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.045] p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={15} aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}

function ProductPipeline({ workspace }: { workspace: ProductWorkspace }) {
  const stages = [
    { label: "Idea", icon: Map, count: 1 },
    { label: "Requirements", icon: ListChecks, count: workspace.requirements.length },
    { label: "User flow", icon: Route, count: workspace.userFlow.length },
    { label: "UI", icon: LayoutDashboard, count: workspace.uiSurfaces.length },
    { label: "Backend", icon: Server, count: workspace.backendServices.length },
    { label: "Database", icon: Database, count: workspace.databasePlan.length },
    { label: "API", icon: Code2, count: workspace.apiPlan.length },
    { label: "Architecture", icon: GitBranch, count: workspace.architectureHighlights.length },
    { label: "Roadmap", icon: Activity, count: workspace.roadmap.length },
    { label: "Export", icon: Download, count: workspace.exportArtifacts.length }
  ];

  return (
    <section className="rounded-lg border border-line bg-white/[0.045] p-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.label}
              className="relative min-h-24 rounded-md border border-white/10 bg-black/18 p-3"
            >
              {index < stages.length - 1 ? (
                <ArrowRight
                  className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-white/25 lg:block"
                  size={16}
                  aria-hidden="true"
                />
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-ink">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-muted">
                  {stage.count}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-ink">{stage.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UserFlow({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section>
      <SectionTitle icon={Route} title="User flow" />
      <div className="grid gap-3 lg:grid-cols-4">
        {workspace.userFlow.map((step, index) => (
          <div
            key={`${step.step}-${index}`}
            className="rounded-lg border border-line bg-white/5 p-4"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white text-sm font-semibold text-slate-950">
              {index + 1}
            </span>
            <p className="mt-4 text-sm font-semibold text-ink">{step.step}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              {step.actor}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{step.action}</p>
            <p className="mt-3 rounded-md border border-white/10 bg-black/18 p-3 text-xs leading-5 text-muted">
              {step.systemResponse}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SurfaceGrid({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section>
      <SectionTitle icon={LayoutDashboard} title="UI surfaces" />
      <div className="grid gap-3 md:grid-cols-3">
        {workspace.uiSurfaces.map((surface) => (
          <div key={surface.name} className="rounded-lg border border-line bg-white/5 p-4">
            <p className="text-sm font-semibold text-ink">{surface.name}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{surface.purpose}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {surface.keyElements.map((item) => (
                <span
                  key={`${surface.name}-${item}`}
                  className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImplementationMap({ workspace }: { workspace: ProductWorkspace }) {
  const folders = buildBlueprintFolders(workspace);

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <SectionTitle icon={Server} title="Backend and services" />
        <div className="grid gap-3 md:grid-cols-2">
          {workspace.backendServices.map((service) => (
            <div key={service.name} className="rounded-lg border border-line bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{service.name}</p>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-muted">
                  {service.trigger}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{service.responsibility}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle icon={FolderTree} title="Build shape" />
        <div className="rounded-lg border border-line bg-black/32 p-4 font-mono text-xs text-slate-200">
          <div className="text-slate-400">product-builder/</div>
          <div className="mt-3 space-y-3">
            {folders.map((folder) => {
              const Icon = folder.icon;
              return (
                <div key={folder.name} className="pl-3">
                  <div className="flex items-center gap-2 text-white">
                    <Icon size={14} aria-hidden="true" />
                    <span>{folder.name}/</span>
                  </div>
                  <div className="mt-2 space-y-1 pl-6 text-slate-400">
                    {folder.items.map((item) => (
                      <div key={`${folder.name}-${item}`}>{item}/</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function DataAndApi({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div>
        <SectionTitle icon={Database} title="Database plan" />
        <div className="space-y-3">
          {workspace.databasePlan.map((database) => (
            <div key={database.name} className="rounded-lg border border-line bg-white/5 p-4">
              <p className="text-sm font-semibold text-ink">{database.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{database.stores}</p>
              <p className="mt-3 text-xs leading-5 text-muted">{database.accessPattern}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle icon={Code2} title="API contracts" />
        <div className="space-y-3">
          {workspace.apiPlan.map((api) => (
            <div
              key={`${api.method}-${api.path}`}
              className="rounded-lg border border-line bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-950">
                  {api.method}
                </span>
                <code className="text-sm text-ink">{api.path}</code>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{api.purpose}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoadmapAndExport({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <SectionTitle icon={Activity} title="Roadmap" />
        <div className="grid gap-3 md:grid-cols-3">
          {workspace.roadmap.map((phase) => (
            <div key={phase.phase} className="rounded-lg border border-line bg-white/5 p-4">
              <p className="text-sm font-semibold text-ink">{phase.phase}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{phase.goal}</p>
              <div className="mt-4 space-y-2">
                {phase.deliverables.map((item) => (
                  <div
                    key={`${phase.phase}-${item}`}
                    className="flex items-center gap-2 text-xs text-muted"
                  >
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle icon={Download} title="Export pack" />
        <div className="space-y-3">
          {workspace.exportArtifacts.map((artifact) => (
            <div key={artifact.name} className="rounded-lg border border-line bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{artifact.name}</p>
                <span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-xs text-muted">
                  {artifact.format}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">{artifact.contents.join(" / ")}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureNotes({
  highlights,
  risks
}: {
  highlights: DescriptionItem[];
  risks: DescriptionItem[];
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div>
        <SectionTitle icon={GitBranch} title="Architecture choices" />
        <div className="space-y-3">
          {highlights.slice(0, 4).map((item) => (
            <div key={item.name} className="rounded-lg border border-line bg-white/5 p-4">
              <p className="text-sm font-semibold text-ink">{item.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle icon={Shield} title="Risks to watch" />
        <div className="space-y-3">
          {risks.slice(0, 4).map((item) => (
            <div key={item.name} className="rounded-lg border border-line bg-white/5 p-4">
              <p className="text-sm font-semibold text-ink">{item.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DesignSections({ design }: DesignSectionsProps) {
  if (!design) {
    return <p className="text-sm text-muted">Generate a product workspace to see the build map.</p>;
  }

  const workspace = buildWorkspaceFromDesign(design);

  return (
    <div className="space-y-6">
      <WorkspaceHero workspace={workspace} />
      <ProductPipeline workspace={workspace} />
      <UserFlow workspace={workspace} />
      <SurfaceGrid workspace={workspace} />
      <ImplementationMap workspace={workspace} />
      <DataAndApi workspace={workspace} />
      <ArchitectureNotes
        highlights={workspace.architectureHighlights}
        risks={design.risks.length > 0 ? design.risks : design.tradeOffs}
      />
      <RoadmapAndExport workspace={workspace} />
    </div>
  );
}
