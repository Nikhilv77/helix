import { createHash } from "node:crypto";
import {
  CORE_TECHNICAL_BASELINE_REGISTRY_VERSION,
  CORE_TECHNICAL_BASELINE_SECTIONS
} from "@/lib/practice/core-technical/baseline-evidence-contracts";
import {
  baselineQuestion,
  type BaselineQuestion
} from "@/lib/preparation/preparation-onboarding";

type BaselineSection = (typeof CORE_TECHNICAL_BASELINE_SECTIONS)[number];

export type CoreTechnicalBaselineRegistryEntry = Readonly<{
  registryVersion: typeof CORE_TECHNICAL_BASELINE_REGISTRY_VERSION;
  section: BaselineSection;
  questionId: string;
  questionFingerprint: string;
  conceptKeys: readonly string[];
  mechanismKeys: readonly string[];
}>;

type RegistryDefinition = Readonly<{
  role: "backend" | "fullstack";
  questionId: `technical-${number}`;
  conceptKeys: readonly string[];
  mechanismKeys: readonly string[];
}>;

const definitions: readonly RegistryDefinition[] = [
  { role: "backend", questionId: "technical-0", conceptKeys: ["nodejs-testing-and-diagnostics"], mechanismKeys: ["runtime-diagnostics"] },
  { role: "backend", questionId: "technical-1", conceptKeys: ["errors-and-cancellation"], mechanismKeys: ["timeout-budget"] },
  { role: "backend", questionId: "technical-2", conceptKeys: ["javascript-values-and-mutation"], mechanismKeys: ["reference-identity"] },
  { role: "backend", questionId: "technical-3", conceptKeys: ["nodejs-work-isolation"], mechanismKeys: ["message-passing"] },
  { role: "backend", questionId: "technical-4", conceptKeys: ["nodejs-testing-and-diagnostics"], mechanismKeys: ["runtime-diagnostics"] },
  { role: "backend", questionId: "technical-5", conceptKeys: ["errors-and-cancellation"], mechanismKeys: ["promise-rejection"] },
  { role: "backend", questionId: "technical-6", conceptKeys: ["errors-and-cancellation"], mechanismKeys: ["timeout-budget"] },
  { role: "backend", questionId: "technical-7", conceptKeys: ["async-scheduling"], mechanismKeys: ["promise-concurrency"] },
  { role: "backend", questionId: "technical-8", conceptKeys: ["nodejs-streams-and-io"], mechanismKeys: ["backpressure"] },
  { role: "fullstack", questionId: "technical-0", conceptKeys: ["nodejs-event-loop-health"], mechanismKeys: ["event-loop-lag"] },
  { role: "fullstack", questionId: "technical-1", conceptKeys: ["javascript-values-and-mutation"], mechanismKeys: ["reference-identity"] },
  { role: "fullstack", questionId: "technical-2", conceptKeys: ["errors-and-cancellation"], mechanismKeys: ["timeout-budget"] },
  { role: "fullstack", questionId: "technical-3", conceptKeys: ["nodejs-testing-and-diagnostics"], mechanismKeys: ["runtime-diagnostics"] },
  { role: "fullstack", questionId: "technical-4", conceptKeys: ["javascript-values-and-mutation"], mechanismKeys: ["shallow-copy"] },
  { role: "fullstack", questionId: "technical-5", conceptKeys: ["javascript-values-and-mutation"], mechanismKeys: ["reference-identity"] },
  { role: "fullstack", questionId: "technical-6", conceptKeys: ["javascript-modules"], mechanismKeys: ["package-exports"] },
  { role: "fullstack", questionId: "technical-7", conceptKeys: ["async-scheduling"], mechanismKeys: ["promise-concurrency"] }
];

export function fingerprintCoreTechnicalBaselineQuestion(question: BaselineQuestion): string {
  // Deliberately exclude option IDs and the answer key. Persisted snapshots
  // randomize IDs, and an answer-derived public hash would make a small MCQ
  // answer enumerable by a browser client.
  const canonical = {
    section: question.section,
    title: normalize(question.title),
    prompt: normalize(question.prompt),
    options: question.options.map((option) => normalize(option.label)).sort(),
    code: question.code
      ? { language: normalize(question.code.language), value: normalize(question.code.value) }
      : null
  };
  return sha256(JSON.stringify(canonical));
}

export const CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY = Object.freeze(
  definitions.flatMap((definition) =>
    CORE_TECHNICAL_BASELINE_SECTIONS.map((section) => {
      const entry: CoreTechnicalBaselineRegistryEntry = {
        registryVersion: CORE_TECHNICAL_BASELINE_REGISTRY_VERSION,
        section,
        questionId: definition.questionId,
        questionFingerprint: fingerprintCoreTechnicalBaselineQuestion(
          baselineQuestion(section, definition.role, definition.questionId)
        ),
        conceptKeys: Object.freeze([...definition.conceptKeys]),
        mechanismKeys: Object.freeze([...definition.mechanismKeys])
      };
      return Object.freeze(entry);
    })
  )
);

const registryByIdentity = new Map(
  CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY.map((entry) => [registryKey(entry), entry])
);

if (registryByIdentity.size !== CORE_TECHNICAL_BASELINE_EVIDENCE_REGISTRY.length) {
  throw new Error("Core Technical baseline registry contains duplicate canonical identities.");
}

export function resolveCoreTechnicalBaselineRegistryEntry(input: {
  section: BaselineSection;
  questionId: string;
  questionFingerprint: string;
}): CoreTechnicalBaselineRegistryEntry | undefined {
  return registryByIdentity.get(registryKey(input));
}

export function hashCoreTechnicalBaselineSource(value: string): string {
  return sha256(value);
}

function registryKey(input: {
  section: BaselineSection;
  questionId: string;
  questionFingerprint: string;
}): string {
  return `${input.section}\u0000${input.questionId}\u0000${input.questionFingerprint}`;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
