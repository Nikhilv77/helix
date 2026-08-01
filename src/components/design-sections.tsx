import {
  Activity,
  ArrowRight,
  Braces,
  CheckCircle2,
  Code2,
  Database,
  Download,
  Eye,
  FolderTree,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Map,
  Route,
  Server,
  Shield,
  Sparkles,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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

function shortText(value: string, maxLength = 92): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
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

function CanvasSection({
  icon: Icon,
  title,
  children
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white/[0.04] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-ink">
          <Icon size={17} aria-hidden="true" />
        </span>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ProductSnapshot({ workspace }: { workspace: ProductWorkspace }) {
  const snapshot = [
    { label: "Audience", value: workspace.idea.targetUsers, icon: Users },
    { label: "Value", value: workspace.idea.primaryValue, icon: CheckCircle2 },
    {
      label: "Build scope",
      value: `${workspace.uiSurfaces.length} UI / ${workspace.backendServices.length} services`,
      icon: Sparkles
    }
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.65fr)]">
      <div className="relative overflow-hidden rounded-lg border border-line bg-white/[0.045] p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Product snapshot
        </p>
        <h3 className="mt-3 text-3xl font-semibold tracking-normal text-ink">
          {workspace.idea.name}
        </h3>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {["Idea", "Flow", "Build"].map((item, index) => (
            <div key={item} className="rounded-md border border-white/10 bg-black/18 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{item}</p>
              <div className="mt-3 space-y-1.5">
                <span className="block h-1.5 rounded-full bg-white/30" />
                <span className="block h-1.5 w-2/3 rounded-full bg-white/14" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {snapshot.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-line bg-white/[0.045] p-4">
              <div className="flex items-center gap-2 text-muted">
                <Icon size={15} aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">{item.label}</p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-ink">
                {shortText(item.value, 110)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PipelineRail({ workspace }: { workspace: ProductWorkspace }) {
  const stages = [
    { label: "Idea", icon: Map, count: 1 },
    { label: "Reqs", icon: ListChecks, count: workspace.requirements.length },
    { label: "Flow", icon: Route, count: workspace.userFlow.length },
    { label: "UI", icon: LayoutDashboard, count: workspace.uiSurfaces.length },
    { label: "Backend", icon: Server, count: workspace.backendServices.length },
    { label: "DB", icon: Database, count: workspace.databasePlan.length },
    { label: "API", icon: Code2, count: workspace.apiPlan.length },
    { label: "Arch", icon: GitBranch, count: workspace.architectureHighlights.length },
    { label: "Roadmap", icon: Activity, count: workspace.roadmap.length },
    { label: "Export", icon: Download, count: workspace.exportArtifacts.length }
  ];

  return (
    <CanvasSection icon={Route} title="Builder pipeline">
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[920px] grid-cols-10 items-center gap-2">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div key={stage.label} className="relative">
                {index < stages.length - 1 ? (
                  <span className="absolute left-[calc(50%+1.25rem)] top-6 h-px w-[calc(100%-1.5rem)] bg-white/14" />
                ) : null}
                <div className="relative flex flex-col items-center gap-2 rounded-md border border-white/10 bg-black/18 px-2 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white text-slate-950">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-ink">{stage.label}</span>
                  <span className="text-[11px] text-muted">{stage.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CanvasSection>
  );
}

function Storyboard({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <CanvasSection icon={Eye} title="Experience storyboard">
      <div className="grid gap-3 lg:grid-cols-3">
        {workspace.userFlow.slice(0, 3).map((step, index) => (
          <div
            key={`${step.step}-${index}`}
            className="rounded-lg border border-line bg-black/18 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-950">
                {index + 1}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-muted">
                {shortText(step.actor, 18)}
              </span>
            </div>
            <p className="mt-4 text-base font-semibold text-ink">{step.step}</p>
            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.045] p-3">
              <div className="mb-3 flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white/30" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
              </div>
              <div className="space-y-2">
                <span className="block h-2 rounded-full bg-white/30" />
                <span className="block h-2 w-4/5 rounded-full bg-white/18" />
                <span className="block h-8 rounded-md border border-white/10 bg-black/22" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{shortText(step.action, 88)}</p>
          </div>
        ))}
      </div>
    </CanvasSection>
  );
}

function UiWireframes({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <CanvasSection icon={LayoutDashboard} title="UI surface map">
      <div className="grid gap-3 md:grid-cols-3">
        {workspace.uiSurfaces.map((surface, index) => (
          <div
            key={surface.name}
            className="overflow-hidden rounded-lg border border-line bg-black/18"
          >
            <div className="border-b border-white/10 bg-white/[0.045] px-4 py-3">
              <p className="text-sm font-semibold text-ink">{surface.name}</p>
            </div>
            <div className="p-4">
              <div className="grid h-40 grid-cols-[0.34fr_1fr] gap-3 rounded-md border border-white/10 bg-black/20 p-3">
                <div className="space-y-2 border-r border-white/10 pr-3">
                  <span className="block h-4 rounded bg-white/20" />
                  <span className="block h-4 rounded bg-white/10" />
                  <span className="block h-4 rounded bg-white/10" />
                  <span className="block h-12 rounded bg-white/5" />
                </div>
                <div className="space-y-3">
                  <span className="block h-6 w-2/3 rounded bg-white/24" />
                  <div className="grid grid-cols-2 gap-2">
                    <span className="h-12 rounded border border-white/10 bg-white/[0.055]" />
                    <span className="h-12 rounded border border-white/10 bg-white/[0.055]" />
                  </div>
                  <span className="block h-12 rounded border border-white/10 bg-white/[0.055]" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {surface.keyElements.slice(0, 4).map((item) => (
                  <span
                    key={`${surface.name}-${item}`}
                    className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[11px] text-muted"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">{shortText(surface.purpose, 86)}</p>
              {index === 0 ? (
                <div className="mt-3 h-1 rounded-full bg-white/70" />
              ) : (
                <div className="mt-3 h-1 rounded-full bg-white/18" />
              )}
            </div>
          </div>
        ))}
      </div>
    </CanvasSection>
  );
}

function SystemTopology({ workspace }: { workspace: ProductWorkspace }) {
  const visibleServices = workspace.backendServices.slice(0, 6);
  const visibleData = workspace.databasePlan.slice(0, 3);
  const visibleApis = workspace.apiPlan.slice(0, 4);

  return (
    <CanvasSection icon={GitBranch} title="Build topology">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(280px,0.4fr)_minmax(0,0.8fr)]">
        <div className="grid gap-2 sm:grid-cols-2">
          {workspace.uiSurfaces.slice(0, 4).map((surface) => (
            <VisualNode key={surface.name} icon={LayoutDashboard} label="UI" title={surface.name} />
          ))}
        </div>

        <div className="flex items-center justify-center">
          <div className="relative flex min-h-52 w-full items-center justify-center rounded-lg border border-white/12 bg-white/[0.055] p-5">
            <div className="absolute inset-x-8 top-1/2 hidden h-px bg-white/12 xl:block" />
            <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/20 bg-white text-center text-slate-950 shadow-[0_0_80px_rgba(255,255,255,0.12)]">
              <Code2 size={22} aria-hidden="true" />
              <span className="mt-2 text-xs font-bold uppercase tracking-[0.14em]">API</span>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {visibleServices.map((service) => (
            <VisualNode
              key={service.name}
              icon={Server}
              label={service.trigger}
              title={service.name}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-line bg-black/18 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Data layer</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {visibleData.map((database) => (
              <VisualNode key={database.name} icon={Database} label="Store" title={database.name} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-black/18 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Contracts</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {visibleApis.map((api) => (
              <div
                key={`${api.method}-${api.path}`}
                className="rounded-md border border-white/10 bg-white/[0.045] p-3"
              >
                <span className="rounded bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-950">
                  {api.method}
                </span>
                <p className="mt-2 truncate font-mono text-xs text-ink">{api.path}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CanvasSection>
  );
}

function VisualNode({
  icon: Icon,
  label,
  title
}: {
  icon: LucideIcon;
  label: string;
  title: string;
}) {
  return (
    <div className="min-h-24 rounded-md border border-white/10 bg-white/[0.045] p-3 transition hover:border-white/24 hover:bg-white/[0.07]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-black/18 text-ink">
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className="max-w-[7rem] truncate rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
          {label}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-ink">{shortText(title, 46)}</p>
    </div>
  );
}

function BuildShape({ workspace }: { workspace: ProductWorkspace }) {
  const folders = buildBlueprintFolders(workspace);

  return (
    <CanvasSection icon={FolderTree} title="Implementation shape">
      <div className="grid gap-3 md:grid-cols-4">
        {folders.map((folder) => {
          const Icon = folder.icon;
          return (
            <div key={folder.name} className="rounded-lg border border-line bg-black/22 p-4">
              <div className="flex items-center gap-2 text-ink">
                <Icon size={16} aria-hidden="true" />
                <span className="font-mono text-sm">{folder.name}/</span>
              </div>
              <div className="mt-4 space-y-2">
                {folder.items.slice(0, 4).map((item) => (
                  <div
                    key={`${folder.name}-${item}`}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-muted"
                  >
                    {item}/
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CanvasSection>
  );
}

function RoadmapTimeline({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <CanvasSection icon={Activity} title="Build runway">
      <div className="grid gap-3 md:grid-cols-3">
        {workspace.roadmap.map((phase, index) => (
          <div key={phase.phase} className="relative rounded-lg border border-line bg-black/18 p-4">
            {index < workspace.roadmap.length - 1 ? (
              <ArrowRight
                className="absolute -right-3 top-8 hidden text-white/22 md:block"
                size={16}
                aria-hidden="true"
              />
            ) : null}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-950">
              {index + 1}
            </span>
            <p className="mt-4 text-base font-semibold text-ink">{phase.phase}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {phase.deliverables.slice(0, 4).map((item) => (
                <span
                  key={`${phase.phase}-${item}`}
                  className="rounded-md border border-white/10 bg-white/[0.045] px-2 py-2 text-xs text-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CanvasSection>
  );
}

function DetailDrawers({
  workspace,
  risks
}: {
  workspace: ProductWorkspace;
  risks: DescriptionItem[];
}) {
  const drawers = [
    {
      title: "Requirements",
      icon: ListChecks,
      content: workspace.requirements.map(
        (item) => `${item.label} · ${item.priority} · ${item.detail}`
      )
    },
    {
      title: "Architecture choices",
      icon: GitBranch,
      content: workspace.architectureHighlights.map((item) => `${item.name} · ${item.description}`)
    },
    {
      title: "Risks",
      icon: Shield,
      content: risks.slice(0, 5).map((item) => `${item.name} · ${item.description}`)
    },
    {
      title: "Exports",
      icon: Download,
      content: workspace.exportArtifacts.map(
        (item) => `${item.name} · ${item.format} · ${item.contents.join(", ")}`
      )
    }
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {drawers.map((drawer) => {
        const Icon = drawer.icon;
        return (
          <details
            key={drawer.title}
            className="group rounded-lg border border-line bg-white/[0.035] p-4"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-ink">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-ink">{drawer.title}</span>
              </span>
              <span className="text-xs text-muted group-open:hidden">Open</span>
              <span className="hidden text-xs text-muted group-open:inline">Close</span>
            </summary>
            <div className="mt-4 space-y-2">
              {drawer.content.map((item) => (
                <p
                  key={item}
                  className="rounded-md border border-white/10 bg-black/18 px-3 py-2 text-sm leading-6 text-slate-300"
                >
                  {item}
                </p>
              ))}
            </div>
          </details>
        );
      })}
    </section>
  );
}

export function DesignSections({ design }: DesignSectionsProps) {
  if (!design) {
    return <p className="text-sm text-muted">Generate a product workspace to see the build map.</p>;
  }

  const workspace = buildWorkspaceFromDesign(design);
  const risks = design.risks.length > 0 ? design.risks : design.tradeOffs;

  return (
    <div className="space-y-5">
      <ProductSnapshot workspace={workspace} />
      <PipelineRail workspace={workspace} />
      <Storyboard workspace={workspace} />
      <UiWireframes workspace={workspace} />
      <SystemTopology workspace={workspace} />
      <BuildShape workspace={workspace} />
      <RoadmapTimeline workspace={workspace} />
      <DetailDrawers workspace={workspace} risks={risks} />
    </div>
  );
}
