import {
  Activity,
  Box,
  Cloud,
  Database,
  FileText,
  Folder,
  FolderTree,
  GitBranch,
  Server,
  Shield
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DescriptionItem, GeneratedDesign, NamedRecommendation } from "@/lib/types";

interface DesignSectionsProps {
  design: GeneratedDesign | null;
}

interface BlueprintFolder {
  name: string;
  icon: LucideIcon;
  items: string[];
}

interface FlowStage {
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

function itemsMatching(values: string[], keywords: string[], fallback: string[]): string[] {
  const matches = values.filter((value) => {
    const normalized = value.toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword));
  });

  return uniqueValues(matches, fallback);
}

function buildBlueprintFolders(design: GeneratedDesign): BlueprintFolder[] {
  const components = design.majorComponents.map((component) => component.name);
  const infrastructure = [
    ...design.databaseChoices.map((item) => item.name),
    ...design.cachingStrategy.map((item) => item.name),
    ...design.messagingAndAsyncProcessing.map((item) => item.name),
    ...design.storageStrategy.map((item) => item.name)
  ];
  const operations = [
    ...design.observability.map((item) => item.name),
    ...design.deploymentApproach.map((item) => item.name),
    ...design.reliabilityAndFailureHandling.map((item) => item.name)
  ];

  return [
    {
      name: "apps",
      icon: Folder,
      items: uniqueValues(["web-dashboard", "admin-console", "api-gateway"], [])
    },
    {
      name: "services",
      icon: Server,
      items: uniqueValues(components, ["application-service", "worker-service", "query-service"])
    },
    {
      name: "packages",
      icon: Box,
      items: ["shared-contracts", "telemetry-sdk", "domain-events"]
    },
    {
      name: "infra",
      icon: Cloud,
      items: uniqueValues(infrastructure, ["database", "cache", "message-queue", "object-storage"])
    },
    {
      name: "ops",
      icon: Shield,
      items: uniqueValues(operations, ["dashboards", "alerts", "runbooks"])
    }
  ];
}

function buildFlowStages(design: GeneratedDesign): FlowStage[] {
  const componentNames = design.majorComponents.map((component) => component.name);

  return [
    {
      name: "Ingress",
      icon: GitBranch,
      items: itemsMatching(
        componentNames,
        ["gateway", "ingest", "scraper", "api"],
        ["api-gateway", "ingestion-service"]
      )
    },
    {
      name: "Processing",
      icon: Activity,
      items: itemsMatching(
        componentNames,
        ["stream", "worker", "process", "engine", "aggregate"],
        ["stream-processor", "worker-pool"]
      )
    },
    {
      name: "Data",
      icon: Database,
      items: uniqueValues(
        [
          ...design.databaseChoices.map((item) => item.name),
          ...design.storageStrategy.map((item) => item.name),
          ...design.cachingStrategy.map((item) => item.name)
        ],
        ["primary-store", "cache", "object-storage"]
      )
    },
    {
      name: "Experience",
      icon: FileText,
      items: itemsMatching(
        componentNames,
        ["query", "visual", "dashboard", "alert", "notification"],
        ["query-api", "dashboards", "notifications"]
      )
    }
  ];
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-brand">
        <Icon size={15} aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
    </div>
  );
}

function RecommendationList({ items }: { items: NamedRecommendation[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">No entries yet.</p>;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${index}-${item.name}`} className="rounded-md border border-line bg-white/5 p-3">
          <p className="text-sm font-semibold text-ink">{item.name}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.recommendation}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{item.reasoning}</p>
        </div>
      ))}
    </div>
  );
}

function DescriptionList({ items }: { items: DescriptionItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">No entries yet.</p>;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${index}-${item.name}`} className="rounded-md border border-line bg-white/5 p-3">
          <p className="text-sm font-semibold text-ink">{item.name}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function BlueprintTree({ design }: { design: GeneratedDesign }) {
  const folders = buildBlueprintFolders(design);

  return (
    <div>
      <SectionTitle icon={FolderTree} title="Implementation blueprint" />
      <div className="rounded-md border border-cyan-300/20 bg-black/45 p-4 font-mono text-xs text-slate-100 shadow-glow">
        <div className="flex items-center gap-2 text-slate-300">
          <Folder size={14} aria-hidden="true" />
          <span>system-design/</span>
        </div>
        <div className="mt-3 space-y-3">
          {folders.map((folder) => {
            const Icon = folder.icon;
            return (
              <div key={folder.name} className="pl-4">
                <div className="flex items-center gap-2 text-cyan-200">
                  <Icon size={14} aria-hidden="true" />
                  <span>{folder.name}/</span>
                </div>
                <div className="mt-2 space-y-1 pl-6 text-slate-300">
                  {folder.items.map((item) => (
                    <div key={`${folder.name}-${item}`} className="flex items-center gap-2">
                      <FileText size={13} aria-hidden="true" />
                      <span>{item}/</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComponentFlow({ design }: { design: GeneratedDesign }) {
  const stages = buildFlowStages(design);

  return (
    <div>
      <SectionTitle icon={GitBranch} title="Component flow" />
      <div className="grid gap-3 lg:grid-cols-4">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.name}
              className="relative rounded-md border border-line bg-white/5 p-3 transition hover:border-cyan-300/35 hover:bg-white/8"
            >
              {index > 0 ? (
                <span
                  className="absolute -left-3 top-7 hidden h-px w-3 bg-line lg:block"
                  aria-hidden="true"
                />
              ) : null}
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white/8 text-brand">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-ink">{stage.name}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {stage.items.map((item) => (
                  <span
                    key={`${stage.name}-${item}`}
                    className="rounded-md border border-line bg-black/25 px-2 py-1 text-xs text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DesignSections({ design }: DesignSectionsProps) {
  if (!design) {
    return (
      <p className="text-sm text-muted">Generate a system design after capacity is calculated.</p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-line bg-white/6 p-4 text-sm leading-6 text-slate-300">
        {design.architectureSummary}
      </p>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <BlueprintTree design={design} />
        <ComponentFlow design={design} />
      </div>

      <div>
        <SectionTitle icon={Server} title="Major components" />
        <div className="grid gap-3 md:grid-cols-2">
          {design.majorComponents.map((component, componentIndex) => (
            <div
              key={`${componentIndex}-${component.name}`}
              className="rounded-md border border-line bg-white/5 p-3"
            >
              <p className="text-sm font-semibold text-ink">{component.name}</p>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-300">
                {component.responsibilities.map((responsibility, responsibilityIndex) => (
                  <li key={`${responsibilityIndex}-${responsibility}`}>{responsibility}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <SectionTitle icon={GitBranch} title="APIs" />
          <RecommendationList items={design.apiRecommendations} />
        </div>
        <div>
          <SectionTitle icon={Database} title="Databases" />
          <RecommendationList items={design.databaseChoices} />
        </div>
        <div>
          <SectionTitle icon={Activity} title="Caching" />
          <RecommendationList items={design.cachingStrategy} />
        </div>
        <div>
          <SectionTitle icon={GitBranch} title="Messaging" />
          <RecommendationList items={design.messagingAndAsyncProcessing} />
        </div>
        <div>
          <SectionTitle icon={Cloud} title="Storage" />
          <RecommendationList items={design.storageStrategy} />
        </div>
        <div>
          <SectionTitle icon={Box} title="Technology choices" />
          <div className="space-y-3">
            {design.technologyChoices.map((choice, index) => (
              <div
                key={`${index}-${choice.category}-${choice.choice}`}
                className="rounded-md border border-line bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-ink">
                  {choice.category}: {choice.choice}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{choice.reasoning}</p>
                {choice.alternativesConsidered.length > 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    Alternatives: {choice.alternativesConsidered.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <SectionTitle icon={Activity} title="Scalability" />
          <DescriptionList items={design.scalabilityApproach} />
        </div>
        <div>
          <SectionTitle icon={Shield} title="Reliability" />
          <DescriptionList items={design.reliabilityAndFailureHandling} />
        </div>
        <div>
          <SectionTitle icon={Shield} title="Security" />
          <DescriptionList items={design.security} />
        </div>
        <div>
          <SectionTitle icon={Activity} title="Observability" />
          <DescriptionList items={design.observability} />
        </div>
        <div>
          <SectionTitle icon={Cloud} title="Deployment" />
          <DescriptionList items={design.deploymentApproach} />
        </div>
        <div>
          <SectionTitle icon={GitBranch} title="Trade-offs" />
          <DescriptionList items={design.tradeOffs} />
        </div>
      </div>

      <div>
        <SectionTitle icon={FileText} title="Retrieved source references" />
        {design.retrievedSourceReferences.length === 0 ? (
          <p className="text-sm text-muted">No source references were attached.</p>
        ) : (
          <div className="space-y-2">
            {design.retrievedSourceReferences.map((reference, index) => (
              <div
                key={`${index}-${reference.chunkId}`}
                className="rounded-md border border-line bg-white/5 p-3 text-sm"
              >
                <p className="font-medium text-ink">{reference.documentTitle}</p>
                <p className="mt-1 text-muted">
                  Similarity {(reference.similarity * 100).toFixed(0)}% · {reference.usedFor}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
