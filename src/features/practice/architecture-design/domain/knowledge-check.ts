import type { ArchitectureDesignQuestion } from "./question-contracts";

export type ArchitectureDesignKnowledgeCheck = {
  prompt: string;
  choices: [string, string, string, string];
  correctChoiceIndex: number;
  rationale: string;
};

/** Builds a short retrieval check from the same reviewed evidence as the main question. */
export function architectureDesignKnowledgeCheck(
  question: ArchitectureDesignQuestion
): ArchitectureDesignKnowledgeCheck {
  const correct = concise(question.referenceAnswer.summary, 460);
  const distractors = [
    ...fallbackDistractors(question.order),
    ...question.commonMistakes.map((mistake) => concise(mistake, 460))
  ]
    .filter((choice, index, choices) => choice !== correct && choices.indexOf(choice) === index)
    .slice(0, 3) as [string, string, string];
  const correctChoiceIndex = stableChoiceIndex(question.key);
  const choices = [...distractors] as string[];
  choices.splice(correctChoiceIndex, 0, correct);

  return {
    prompt: knowledgeCheckPrompt(question.order),
    choices: choices as ArchitectureDesignKnowledgeCheck["choices"],
    correctChoiceIndex,
    rationale: `${question.referenceAnswer.summary} ${question.transferConnection}`
  };
}

export function publicArchitectureDesignKnowledgeCheck(question: ArchitectureDesignQuestion) {
  const { prompt, choices } = architectureDesignKnowledgeCheck(question);
  return { prompt, choices };
}

function knowledgeCheckPrompt(order: number): string {
  if (order === 1) return "Which response best frames this system before choosing components?";
  if (order === 2)
    return "Which decision best protects the system's contracts and data correctness?";
  if (order === 3) return "Which response best addresses the architecture's dominant failure mode?";
  return "Which production plan is the strongest and most reversible?";
}

function fallbackDistractors(order: number): [string, string, string] {
  if (order === 1)
    return [
      "Start drawing services immediately and leave scale, non-goals, and reliability targets for implementation.",
      "Assume peak traffic equals average traffic and use an unqualified goal such as fast and highly available.",
      "Promise every desirable feature in the first release without establishing a correctness or ownership boundary."
    ];
  if (order === 2)
    return [
      "Put mutable operational details in messages and let every service infer identity and consistency independently.",
      "Use newly generated identifiers on every retry and overwrite history with the latest observed state.",
      "Choose the database first, then derive APIs and access patterns from whichever operations it makes convenient."
    ];
  if (order === 3)
    return [
      "Add more workers to the shared path without changing admission control, partitioning, or failure isolation.",
      "Retry every failure immediately in shared capacity so transient downstream problems recover as quickly as possible.",
      "Use one global partition and cache namespace to keep the topology simple regardless of tenant or workload skew."
    ];
  return [
    "Replace the old design globally, observe aggregate success rate, and rely on application rollback if state has changed.",
    "Log complete payloads and credentials indefinitely so every production incident has maximum debugging context.",
    "Claim regional recovery from the existence of backups without testing ownership fencing, restore time, or data loss."
  ];
}

function stableChoiceIndex(key: string): number {
  return [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % 4;
}

function concise(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
