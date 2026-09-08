import { createHash } from "node:crypto";
import { ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION } from "@/lib/practice/architecture-design/baseline-evidence-contracts";
import { type ArchitectureDesignDimension } from "@/lib/practice/architecture-design/contracts";
import {
  ARCHITECTURE_QUESTION_BANK,
  architectureQuestion,
  type ArchitectureQuestion
} from "@/lib/preparation/architecture-question-bank";
import type { BaselineQuestion } from "@/lib/preparation/preparation-onboarding";

export type ArchitectureDesignBaselineRegistryEntry = Readonly<{
  registryVersion: typeof ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION;
  questionId: `architecture-${number}`;
  questionFingerprint: string;
  dimensionKeys: readonly ArchitectureDesignDimension[];
}>;

const DIMENSIONS_BY_QUESTION = [
  ["caching-contention", "cost-efficiency"],
  ["caching-contention", "partitioning-hotspots"],
  ["async-work-backpressure", "component-boundaries"],
  ["storage-access-patterns", "cost-efficiency"],
  ["reliability-failure-isolation", "component-boundaries"],
  ["async-work-backpressure", "capacity-estimation"],
  ["storage-access-patterns", "cost-efficiency"],
  ["caching-contention", "cost-efficiency"],
  ["capacity-estimation", "observability-slos"],
  ["storage-access-patterns", "cost-efficiency"],
  ["consistency-transactions", "data-modeling"],
  ["partitioning-hotspots", "storage-access-patterns"],
  ["storage-access-patterns", "cost-efficiency"],
  ["api-event-contracts", "migration-evolution"],
  ["data-modeling", "storage-access-patterns"],
  ["data-modeling", "security-privacy"],
  ["component-boundaries", "storage-access-patterns"],
  ["caching-contention", "partitioning-hotspots"],
  ["observability-slos", "tradeoff-communication"],
  ["reliability-failure-isolation", "migration-evolution"],
  ["async-work-backpressure", "consistency-transactions"],
  ["consistency-transactions", "caching-contention"],
  ["api-event-contracts", "consistency-transactions"],
  ["consistency-transactions", "migration-evolution"],
  ["async-work-backpressure", "reliability-failure-isolation"],
  ["api-event-contracts", "consistency-transactions"],
  ["consistency-transactions", "reliability-failure-isolation"],
  ["consistency-transactions", "migration-evolution"],
  ["api-event-contracts", "consistency-transactions"],
  ["consistency-transactions", "tradeoff-communication"],
  ["api-event-contracts", "migration-evolution"],
  ["api-event-contracts", "reliability-failure-isolation", "security-privacy"],
  ["async-work-backpressure", "capacity-estimation"],
  ["async-work-backpressure", "reliability-failure-isolation"],
  ["security-privacy", "reliability-failure-isolation"],
  ["observability-slos", "component-boundaries"],
  ["api-event-contracts", "async-work-backpressure"],
  ["api-event-contracts", "caching-contention"],
  ["api-event-contracts", "capacity-estimation"],
  ["api-event-contracts", "security-privacy"],
  ["security-privacy", "component-boundaries"],
  ["security-privacy"],
  ["reliability-failure-isolation", "observability-slos"],
  ["reliability-failure-isolation", "component-boundaries"],
  ["security-privacy", "reliability-failure-isolation"],
  ["reliability-failure-isolation", "migration-evolution"],
  ["reliability-failure-isolation", "component-boundaries"],
  ["security-privacy", "observability-slos"],
  ["security-privacy", "reliability-failure-isolation"],
  ["observability-slos", "requirements-framing"]
] as const satisfies readonly (readonly ArchitectureDesignDimension[])[];

if (DIMENSIONS_BY_QUESTION.length !== ARCHITECTURE_QUESTION_BANK.length) {
  throw new Error("Every Architecture baseline question must have an evidence mapping.");
}

export const ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_REGISTRY = Object.freeze(
  DIMENSIONS_BY_QUESTION.map((dimensionKeys, index) => {
    const question = architectureQuestion(index);
    if (!question) throw new Error(`Architecture baseline question ${index} is missing.`);
    return Object.freeze({
      registryVersion: ARCHITECTURE_DESIGN_BASELINE_REGISTRY_VERSION,
      questionId: `architecture-${index}` as const,
      questionFingerprint: fingerprintArchitectureDesignBaselineQuestion({
        ...question,
        section: "architecture",
        eyebrow: ""
      }),
      dimensionKeys: Object.freeze([...dimensionKeys])
    });
  })
);

const registryByIdentity = new Map(
  ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_REGISTRY.map((entry) => [registryKey(entry), entry])
);

if (registryByIdentity.size !== ARCHITECTURE_DESIGN_BASELINE_EVIDENCE_REGISTRY.length) {
  throw new Error("Architecture baseline registry contains duplicate canonical identities.");
}

export function fingerprintArchitectureDesignBaselineQuestion(
  question: ArchitectureQuestion | BaselineQuestion
): string {
  const canonical = {
    title: normalize(question.title),
    prompt: normalize(question.prompt),
    options: question.options.map(({ label }) => normalize(label)).sort()
  };
  return sha256(JSON.stringify(canonical));
}

export function resolveArchitectureDesignBaselineRegistryEntry(input: {
  questionId: string;
  questionFingerprint: string;
}): ArchitectureDesignBaselineRegistryEntry | undefined {
  return registryByIdentity.get(registryKey(input));
}

export function hashArchitectureDesignBaselineSource(value: string): string {
  return sha256(value);
}

function registryKey(input: { questionId: string; questionFingerprint: string }): string {
  return `${input.questionId}\u0000${input.questionFingerprint}`;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
