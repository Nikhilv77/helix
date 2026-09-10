import { z } from "zod";

export const CORE_TECHNICAL_TECHNOLOGIES = [
  "nodejs",
  "typescript",
  "javascript",
  "nestjs",
  "express",
  "fastify",
  "koa",
  "nextjs"
] as const;

export const coreTechnicalTechnologySchema = z.enum(CORE_TECHNICAL_TECHNOLOGIES);
export type CoreTechnicalTechnology = z.infer<typeof coreTechnicalTechnologySchema>;

export type CoreTechnicalTechnologyOption = {
  value: CoreTechnicalTechnology;
  label: string;
  detail: string;
  resumeMatched: boolean;
};

const TECHNOLOGIES: ReadonlyArray<
  Omit<CoreTechnicalTechnologyOption, "resumeMatched"> & { matchers: readonly RegExp[] }
> = [
  {
    value: "nodejs",
    label: "Node.js",
    detail: "APIs, async work, runtime behaviour, and debugging",
    matchers: [/\bnode(?:\.js|js)?\b/i]
  },
  {
    value: "typescript",
    label: "TypeScript",
    detail: "Practical TypeScript reasoning on the Node.js runtime",
    matchers: [/\btypescript\b/i]
  },
  {
    value: "javascript",
    label: "JavaScript",
    detail: "Core language behaviour interviewers expect you to explain",
    matchers: [/\bjavascript\b/i, /\becmascript\b/i]
  },
  {
    value: "nestjs",
    label: "NestJS",
    detail: "Backend service decisions grounded in Node.js fundamentals",
    matchers: [/\bnest(?:\.js|js)?\b/i]
  },
  {
    value: "express",
    label: "Express",
    detail: "Requests, middleware, failures, and production behaviour",
    matchers: [/\bexpress(?:\.js|js)?\b/i]
  },
  {
    value: "fastify",
    label: "Fastify",
    detail: "Backend request lifecycles and runtime trade-offs",
    matchers: [/\bfastify\b/i]
  },
  {
    value: "koa",
    label: "Koa",
    detail: "Middleware flow, async errors, and request ownership",
    matchers: [/\bkoa(?:\.js|js)?\b/i]
  },
  {
    value: "nextjs",
    label: "Next.js",
    detail: "Server-side JavaScript and practical request boundaries",
    matchers: [/\bnext(?:\.js|js)?\b/i]
  }
];

/**
 * Suggest only ecosystems the current Node.js Core Technical engine can test
 * truthfully. Resume matches lead; Node.js remains a clear fallback.
 */
export function coreTechnicalTechnologyOptions(
  resumeSkills: readonly string[]
): CoreTechnicalTechnologyOption[] {
  const resumeText = resumeSkills.join(" ");
  const matched = TECHNOLOGIES.filter((technology) =>
    technology.matchers.some((matcher) => matcher.test(resumeText))
  );
  const fallback = TECHNOLOGIES.find((technology) => technology.value === "nodejs")!;
  const ordered = [...matched, fallback].filter(
    (technology, index, values) =>
      values.findIndex((candidate) => candidate.value === technology.value) === index
  );

  return ordered.slice(0, 4).map((technology) => ({
    value: technology.value,
    label: technology.label,
    detail: technology.detail,
    resumeMatched: matched.some((candidate) => candidate.value === technology.value)
  }));
}

export function coreTechnicalTechnologyLabel(value: CoreTechnicalTechnology): string {
  return TECHNOLOGIES.find((technology) => technology.value === value)?.label ?? "Node.js";
}

export function coreTechnicalFrameworkFor(value: CoreTechnicalTechnology): string | null {
  return ["nestjs", "express", "fastify", "koa", "nextjs"].includes(value) ? value : null;
}
