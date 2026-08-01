"use client";

import { useState } from "react";
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Clipboard,
  Code2,
  Database,
  Download,
  FileJson,
  FileText,
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

type ExportStatus = "idle" | "copied" | "failed";

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

function listMarkdown(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatFolderTree(workspace: ProductWorkspace): string {
  const groups = buildFolderGroups(workspace);

  return [
    "product/",
    ...groups.flatMap((group) => [`  ${group.name}/`, ...group.items.map((item) => `    ${item}/`)])
  ].join("\n");
}

function formatWorkspaceMarkdown(workspace: ProductWorkspace): string {
  return [
    `# ${workspace.idea.name}`,
    "",
    workspace.idea.summary,
    "",
    "## Product",
    "",
    `- Users: ${workspace.idea.targetUsers}`,
    `- Value: ${workspace.idea.primaryValue}`,
    "",
    "## Requirements",
    "",
    workspace.requirements
      .map(
        (requirement) => `- ${requirement.label} (${requirement.priority}): ${requirement.detail}`
      )
      .join("\n"),
    "",
    "## User Flow",
    "",
    workspace.userFlow
      .map(
        (step, index) =>
          `${index + 1}. ${step.step} - ${step.actor}\n   - Action: ${step.action}\n   - System: ${
            step.systemResponse
          }`
      )
      .join("\n"),
    "",
    "## UI Surfaces",
    "",
    workspace.uiSurfaces
      .map(
        (surface) =>
          `### ${surface.name}\n${surface.purpose}\n\n${listMarkdown(surface.keyElements)}`
      )
      .join("\n\n"),
    "",
    "## Backend Services",
    "",
    workspace.backendServices
      .map((service) => `- ${service.name}: ${service.responsibility} Trigger: ${service.trigger}.`)
      .join("\n"),
    "",
    "## API Contracts",
    "",
    workspace.apiPlan.map((api) => `- ${api.method} ${api.path}: ${api.purpose}`).join("\n"),
    "",
    "## Data Model",
    "",
    workspace.databasePlan
      .map(
        (database) =>
          `- ${database.name}: stores ${database.stores}. Access pattern: ${database.accessPattern}`
      )
      .join("\n"),
    "",
    "## Folder Structure",
    "",
    "```text",
    formatFolderTree(workspace),
    "```",
    "",
    "## Roadmap",
    "",
    workspace.roadmap
      .map((phase) => `### ${phase.phase}\n${phase.goal}\n\n${listMarkdown(phase.deliverables)}`)
      .join("\n\n"),
    "",
    "## Architecture Guardrails",
    "",
    workspace.architectureHighlights
      .map((highlight) => `- ${highlight.name}: ${highlight.description}`)
      .join("\n"),
    ""
  ].join("\n");
}

function buildExportPayload(workspace: ProductWorkspace) {
  return {
    exportedAt: new Date().toISOString(),
    product: workspace.idea,
    requirements: workspace.requirements,
    userFlow: workspace.userFlow,
    uiSurfaces: workspace.uiSurfaces,
    backendServices: workspace.backendServices,
    databasePlan: workspace.databasePlan,
    apiPlan: workspace.apiPlan,
    folderTree: formatFolderTree(workspace),
    architectureHighlights: workspace.architectureHighlights,
    roadmap: workspace.roadmap,
    exportArtifacts: workspace.exportArtifacts
  };
}

function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-line bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.3)] sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(620px,1.1fr)] xl:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
              <Sparkles size={13} aria-hidden="true" />
              Product blueprint
            </p>
            <h3 className="mt-5 max-w-2xl text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
              {workspace.idea.name}
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {shortText(workspace.idea.summary, 170)}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <InfoTile icon={Users} label="Users" value={workspace.idea.targetUsers} />
            <InfoTile icon={CheckCircle2} label="Value" value={workspace.idea.primaryValue} />
            <InfoTile
              icon={ListChecks}
              label="Must ship"
              value={primaryRequirement?.detail ?? "Core workflow"}
            />
          </div>
        </div>
      </section>

      <ProductFlow
        api={firstApi ? `${firstApi.method} ${firstApi.path}` : "Core API"}
        service={firstService?.name ?? "Application Service"}
        worker={secondService?.name ?? "Worker Service"}
        database={firstDatabase?.name ?? "Primary Database"}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <ExperienceMap workspace={workspace} />
        <ScreenStrip workspace={workspace} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <ImplementationTree workspace={workspace} />
        <ShipPlan
          phase={firstRoadmap?.phase ?? "MVP"}
          deliverables={firstRoadmap?.deliverables ?? ["UI", "API", "Database", "Auth"]}
          exportLabel={
            exportArtifact ? `${exportArtifact.name} · ${exportArtifact.format}` : "Build pack"
          }
        />
      </div>

      <BuildContext workspace={workspace} />

      <ExportPanel workspace={workspace} />
    </div>
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
    <div className="min-h-32 rounded-lg border border-white/10 bg-black/18 p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={14} aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-4 text-base font-semibold leading-6 text-ink">{shortText(value, 82)}</p>
    </div>
  );
}

function ExperienceMap({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={Route} title="User journey" />
      <div className="mt-5 grid gap-3">
        {workspace.userFlow.slice(0, 3).map((step, index) => (
          <div
            key={`${step.step}-${index}`}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4 rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-950">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{step.step}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {step.actor}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">{shortText(step.action, 116)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
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
    <section className="relative overflow-hidden rounded-xl border border-line bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SectionHeader icon={GitBranch} title="Product flowchart" />
        <p className="max-w-xl text-sm leading-6 text-muted">
          Main product path separated by layer, so it reads like an implementation map.
        </p>
      </div>
      <div className="mt-6 overflow-x-auto pb-3">
        <div className="grid min-w-[1040px] grid-cols-[1.15fr_4rem_1fr_4rem_1.25fr_4rem_1.1fr] items-center">
          <FlowNode
            icon={LayoutDashboard}
            label="Experience"
            title="Product screens"
            subTitle="User creates, reviews, and operates the product"
          />
          <FlowArrow />
          <FlowNode icon={Code2} label="API" title={api} />
          <FlowArrow />
          <FlowNode icon={Server} label="Backend" title={service} subTitle={worker} emphasis />
          <FlowArrow />
          <FlowNode icon={Database} label="Data" title={database} />
        </div>
      </div>
    </section>
  );
}

function FlowNode({
  icon: Icon,
  label,
  title,
  subTitle,
  emphasis = false
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  subTitle?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`min-h-52 rounded-xl border p-5 ${
        emphasis
          ? "border-cyan-200/25 bg-cyan-200/[0.07] shadow-[0_0_60px_rgba(103,232,249,0.1)]"
          : "border-white/10 bg-black/22"
      }`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white text-slate-950">
        <Icon size={16} aria-hidden="true" />
      </span>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold leading-6 text-ink">{shortText(title, 72)}</p>
      {subTitle ? (
        <p className="mt-4 rounded-md border border-white/10 bg-black/18 px-3 py-2 text-sm leading-5 text-muted">
          {shortText(subTitle, 82)}
        </p>
      ) : null}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center text-white/35">
      <ArrowRight size={26} aria-hidden="true" />
    </div>
  );
}

function ScreenStrip({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={LayoutDashboard} title="Product screens" />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {workspace.uiSurfaces.slice(0, 3).map((surface, index) => (
          <div key={surface.name} className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="h-40 rounded-lg border border-white/10 bg-black/24 p-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-white/35" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/12" />
              </div>
              <div className="mt-4 grid grid-cols-[0.38fr_1fr] gap-3">
                <span className="h-24 rounded-md bg-white/10" />
                <div className="space-y-2">
                  <span className="block h-8 rounded-md bg-white/24" />
                  <span className="block h-4 w-3/4 rounded bg-white/12" />
                  <span className="block h-4 w-1/2 rounded bg-white/12" />
                  <span className="block h-8 rounded-md bg-white/16" />
                </div>
              </div>
            </div>
            <p className="mt-4 text-base font-semibold text-ink">{surface.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {surface.keyElements.slice(0, 3).map((item) => (
                <span
                  key={`${surface.name}-${item}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                >
                  {item}
                </span>
              ))}
            </div>
            {index === 0 ? <div className="mt-4 h-1 rounded-full bg-white/70" /> : null}
          </div>
        ))}
      </div>
    </section>
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
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={Shield} title="Ship first" />
      <p className="mt-5 text-3xl font-semibold text-ink">{phase}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {deliverables.slice(0, 4).map((item) => (
          <span
            key={item}
            className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-white/10 bg-black/18 p-4">
        <div className="flex items-center gap-2 text-muted">
          <Download size={14} aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">Export</p>
        </div>
        <p className="mt-3 text-base font-semibold text-ink">{shortText(exportLabel, 72)}</p>
      </div>
    </section>
  );
}

function ImplementationTree({ workspace }: { workspace: ProductWorkspace }) {
  const groups = buildFolderGroups(workspace);

  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
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

      <div className="mt-5 rounded-xl border border-white/10 bg-black/24 p-5 font-mono text-sm">
        <div className="flex items-center gap-2 text-ink">
          <Folder size={15} aria-hidden="true" />
          <span>product/</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
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
                <div className="mt-3 space-y-2 pl-4 text-xs text-muted">
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
    </section>
  );
}

function BuildContext({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Build context
          </p>
          <h4 className="mt-2 text-2xl font-semibold text-ink">Everything needed to start</h4>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          The product shape, contracts, data, milestones, and guardrails stay visible without
          turning the page into a long spec.
        </p>
      </div>

      <RequirementsBoard workspace={workspace} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ServiceBoard workspace={workspace} />
        <ApiBoard workspace={workspace} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DataBoard workspace={workspace} />
        <RoadmapBoard workspace={workspace} />
      </div>

      <GuardrailBoard workspace={workspace} />
    </section>
  );
}

function RequirementsBoard({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={ListChecks} title="Product requirements" />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workspace.requirements.slice(0, 6).map((requirement, index) => (
          <div
            key={`${requirement.label}-${index}`}
            className="rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {requirement.label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                {requirement.priority}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-ink">
              {shortText(requirement.detail, 110)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServiceBoard({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={Server} title="Backend services" />
      <div className="mt-5 space-y-3">
        {workspace.backendServices.slice(0, 5).map((service, index) => (
          <div
            key={`${service.name}-${index}`}
            className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_8rem] sm:items-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-sm font-semibold text-ink">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{service.name}</p>
              <p className="mt-1 text-sm leading-5 text-muted">
                {shortText(service.responsibility, 96)}
              </p>
            </div>
            <span className="w-fit rounded-full border border-cyan-200/20 bg-cyan-200/[0.06] px-3 py-1 text-xs font-semibold text-cyan-100">
              {service.trigger}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApiBoard({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={Braces} title="API contracts" />
      <div className="mt-5 space-y-3">
        {workspace.apiPlan.slice(0, 5).map((api, index) => (
          <div
            key={`${api.method}-${api.path}-${index}`}
            className="rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate-950">
                {api.method}
              </span>
              <code className="rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 font-mono text-sm text-slate-100">
                {api.path}
              </code>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{shortText(api.purpose, 116)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataBoard({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={Database} title="Data model" />
      <div className="mt-5 grid gap-3">
        {workspace.databasePlan.slice(0, 4).map((database, index) => (
          <div
            key={`${database.name}-${index}`}
            className="rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                <Database size={15} aria-hidden="true" />
              </span>
              <p className="font-semibold text-ink">{database.name}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoStrip label="Stores" value={database.stores} />
              <InfoStrip label="Reads" value={database.accessPattern} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RoadmapBoard({ workspace }: { workspace: ProductWorkspace }) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={GitBranch} title="Roadmap" />
      <div className="mt-5 space-y-4">
        {workspace.roadmap.slice(0, 4).map((phase, index) => (
          <div key={`${phase.phase}-${index}`} className="relative pl-8">
            <span className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white text-[11px] font-semibold text-slate-950">
              {index + 1}
            </span>
            {index < workspace.roadmap.slice(0, 4).length - 1 ? (
              <span className="absolute left-[9px] top-7 h-[calc(100%-0.5rem)] w-px bg-white/12" />
            ) : null}
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="font-semibold text-ink">{phase.phase}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{shortText(phase.goal, 110)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {phase.deliverables.slice(0, 5).map((item) => (
                  <span
                    key={`${phase.phase}-${item}`}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GuardrailBoard({ workspace }: { workspace: ProductWorkspace }) {
  const highlights = workspace.architectureHighlights.slice(0, 4);

  if (highlights.length === 0) return null;

  return (
    <section className="rounded-xl border border-line bg-white/[0.04] p-5 sm:p-6">
      <SectionHeader icon={Shield} title="Architecture guardrails" />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {highlights.map((highlight, index) => (
          <div
            key={`${highlight.name}-${index}`}
            className="rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/[0.08] text-sm font-semibold text-emerald-100">
              {index + 1}
            </span>
            <p className="mt-4 font-semibold text-ink">{highlight.name}</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {shortText(highlight.description, 118)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-sm leading-5 text-slate-200">{shortText(value, 86)}</p>
    </div>
  );
}

function ExportPanel({ workspace }: { workspace: ProductWorkspace }) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const filename = toKebabCase(workspace.idea.name);
  const markdown = formatWorkspaceMarkdown(workspace);

  function downloadMarkdown(): void {
    downloadText(`${filename}-product-blueprint.md`, markdown, "text/markdown;charset=utf-8");
  }

  function downloadJson(): void {
    downloadText(
      `${filename}-workspace.json`,
      JSON.stringify(buildExportPayload(workspace), null, 2),
      "application/json;charset=utf-8"
    );
  }

  function downloadTree(): void {
    downloadText(
      `${filename}-folder-structure.txt`,
      formatFolderTree(workspace),
      "text/plain;charset=utf-8"
    );
  }

  async function copyMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(560px,0.95fr)] xl:items-center">
        <div>
          <SectionHeader icon={Download} title="Export workspace" />
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
            Package the product blueprint for docs, engineering handoff, or another tool.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ExportButton icon={FileText} label="Markdown" onClick={downloadMarkdown} />
          <ExportButton icon={FileJson} label="JSON" onClick={downloadJson} />
          <ExportButton icon={FolderTree} label="Tree" onClick={downloadTree} />
          <ExportButton
            icon={Clipboard}
            label={status === "copied" ? "Copied" : status === "failed" ? "Try again" : "Copy"}
            onClick={() => void copyMarkdown()}
          />
        </div>
      </div>
    </section>
  );
}

function ExportButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-24 flex-col justify-between rounded-lg border border-white/12 bg-white px-4 py-3 text-left text-slate-950 shadow-[0_18px_50px_rgba(255,255,255,0.1)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <Icon size={18} aria-hidden="true" />
      <span className="text-sm font-semibold">{label}</span>
    </button>
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
