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
  Shield,
  Server,
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
      .slice(0, 38) || "module"
  );
}

function shortText(value: string, maxLength = 80): string {
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

  return slugs.length > 0 ? slugs.slice(0, 4) : fallback;
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

function buildFolderGroups(workspace: ProductWorkspace): FolderGroup[] {
  return [
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
}

function ProductBoard({ workspace }: { workspace: ProductWorkspace }) {
  const primaryRequirement = workspace.requirements[0];
  const firstApi = workspace.apiPlan[0];
  const firstService = workspace.backendServices[0];
  const secondService = workspace.backendServices[1];
  const firstDatabase = workspace.databasePlan[0];
  const firstRoadmap = workspace.roadmap[0];
  const exportArtifact = workspace.exportArtifacts[0];

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-white/[0.045] shadow-[0_32px_120px_rgba(0,0,0,0.34)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
                <Sparkles size={13} aria-hidden="true" />
                Product blueprint
              </p>
              <h3 className="mt-4 text-3xl font-semibold tracking-normal text-ink sm:text-4xl">
                {workspace.idea.name}
              </h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[34rem]">
              <InfoTile icon={Users} label="Users" value={workspace.idea.targetUsers} />
              <InfoTile icon={CheckCircle2} label="Value" value={workspace.idea.primaryValue} />
              <InfoTile
                icon={ListChecks}
                label="Must ship"
                value={primaryRequirement?.detail ?? "Core workflow"}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <ExperienceMap workspace={workspace} />
            <ProductFlow
              api={firstApi ? `${firstApi.method} ${firstApi.path}` : "Core API"}
              service={firstService?.name ?? "Application Service"}
              worker={secondService?.name ?? "Worker Service"}
              database={firstDatabase?.name ?? "Primary Database"}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.52fr)]">
            <ScreenStrip workspace={workspace} />
            <ShipPlan
              phase={firstRoadmap?.phase ?? "MVP"}
              deliverables={firstRoadmap?.deliverables ?? ["UI", "API", "Database", "Auth"]}
              exportLabel={
                exportArtifact ? `${exportArtifact.name} · ${exportArtifact.format}` : "Build pack"
              }
            />
          </div>
        </div>

        <ImplementationTree workspace={workspace} />
      </div>
    </section>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-h-24 rounded-lg border border-white/10 bg-black/18 p-3">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={14} aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-ink">{shortText(value, 64)}</p>
    </div>
  );
}

function ExperienceMap({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <div className="rounded-lg border border-line bg-black/18 p-4">
      <SectionHeader icon={Route} title="User flow" />
      <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-1">
        {workspace.userFlow.slice(0, 3).map((step, index) => (
          <div
            key={`${step.step}-${index}`}
            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-md border border-white/10 bg-white/[0.045] p-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-950">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{step.step}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{shortText(step.action, 72)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductFlow({
  api,
  service,
  worker,
  database
}: {
  api: string;
  service: string;
  worker: string;
  database: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-black/18 p-4">
      <SectionHeader icon={GitBranch} title="Product flowchart" />
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="grid min-w-[700px] grid-cols-[1fr_2.5rem_1fr_2.5rem_1fr_2.5rem_1fr] items-center">
          <FlowNode icon={LayoutDashboard} label="UI" title="Product screens" />
          <FlowArrow />
          <FlowNode icon={Code2} label="API" title={api} />
          <FlowArrow />
          <FlowNode icon={Server} label="Services" title={service} subTitle={worker} />
          <FlowArrow />
          <FlowNode icon={Database} label="Data" title={database} />
        </div>
      </div>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  label,
  title,
  subTitle
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  subTitle?: string;
}) {
  return (
    <div className="min-h-36 rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white text-slate-950">
        <Icon size={16} aria-hidden="true" />
      </span>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-5 text-ink">{shortText(title, 46)}</p>
      {subTitle ? (
        <p className="mt-2 rounded-md border border-white/10 bg-black/18 px-2 py-1.5 text-xs text-muted">
          {shortText(subTitle, 42)}
        </p>
      ) : null}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center text-white/35">
      <ArrowRight size={20} aria-hidden="true" />
    </div>
  );
}

function ScreenStrip({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <div className="rounded-lg border border-line bg-black/18 p-4">
      <SectionHeader icon={LayoutDashboard} title="Product screens" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {workspace.uiSurfaces.slice(0, 3).map((surface, index) => (
          <div
            key={surface.name}
            className="rounded-md border border-white/10 bg-white/[0.045] p-3"
          >
            <div className="h-24 rounded-md border border-white/10 bg-black/24 p-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/12" />
              </div>
              <div className="mt-3 grid grid-cols-[0.35fr_1fr] gap-2">
                <span className="h-14 rounded bg-white/10" />
                <span className="h-14 rounded bg-white/20" />
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">{surface.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {surface.keyElements.slice(0, 3).map((item) => (
                <span
                  key={`${surface.name}-${item}`}
                  className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted"
                >
                  {item}
                </span>
              ))}
            </div>
            {index === 0 ? <div className="mt-3 h-1 rounded-full bg-white/70" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShipPlan({
  phase,
  deliverables,
  exportLabel
}: {
  phase: string;
  deliverables: string[];
  exportLabel: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.045] p-4">
      <SectionHeader icon={Shield} title="Ship first" />
      <p className="mt-4 text-2xl font-semibold text-ink">{phase}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {deliverables.slice(0, 4).map((item) => (
          <span
            key={item}
            className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-white/10 bg-black/18 p-3">
        <div className="flex items-center gap-2 text-muted">
          <Download size={14} aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">Export</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-ink">{shortText(exportLabel, 54)}</p>
      </div>
    </div>
  );
}

function ImplementationTree({ workspace }: { workspace: ProductWorkspace }) {
  const groups = buildFolderGroups(workspace);

  return (
    <aside className="border-t border-white/10 bg-black/18 p-5 2xl:border-l 2xl:border-t-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white text-slate-950">
          <FolderTree size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Folder structure
          </p>
          <p className="text-sm font-semibold text-ink">Implementation layout</p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-black/24 p-4 font-mono text-sm">
        <div className="flex items-center gap-2 text-ink">
          <Folder size={15} aria-hidden="true" />
          <span>product/</span>
        </div>
        <div className="mt-4 space-y-3">
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
                <div className="mt-2 space-y-1.5 pl-4 text-xs text-muted">
                  {group.items.map((item) => (
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
    </aside>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-ink">
        <Icon size={16} aria-hidden="true" />
      </span>
      <h4 className="text-base font-semibold text-ink">{title}</h4>
    </div>
  );
}

export function DesignSections({ design }: DesignSectionsProps) {
  if (!design) {
    return <p className="text-sm text-muted">Generate a product workspace to see the build map.</p>;
  }

  const workspace = buildWorkspaceFromDesign(design);

  return <ProductBoard workspace={workspace} />;
}
