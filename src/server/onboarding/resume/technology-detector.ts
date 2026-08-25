import {
  SKILL_DEFINITIONS,
  normalizeSkill,
  type NormalizedSkill,
  type SkillDefinition
} from "../../interview/candidate-profile-compiler";

const TECHNOLOGY_SECTION =
  /^(?:technical\s+)?(?:skills?|technologies|tech(?:nology)?\s+stack|programming\s+languages?|frameworks?|databases?|tools?)(?:\s*:.*)?$/i;
const NON_TECHNOLOGY_SECTION =
  /^(?:professional\s+)?(?:summary|profile|experience|work\s+experience|employment|projects?|education|achievements?|certifications?|awards?|publications?|interests?)(?:\s*:.*)?$/i;

/** Aliases that are ordinary English words need an explicitly technical line. */
const CONTEXTUAL_ALIASES = new Set([
  "containers",
  "express",
  "flask",
  "node",
  "oracle",
  "pandas",
  "rails",
  "rest",
  "rust",
  "spark",
  "spring",
  "swift",
  "torch"
]);

const TECHNICAL_CONTEXT =
  /\b(?:api|application|backend|built|cloud|code|coded|database|deployed|developed|engineered|framework|frontend|implemented|language|library|microservice|model|pipeline|programmed|script|service|stack|system|tool|using|with|written)\b/i;

/**
 * Independent, deterministic recovery pass over the original document text.
 * It returns canonical labels only; excerpts and confidence never leave the server.
 */
export function detectExplicitResumeTechnologies(sourceText: string): string[] {
  const detected = new Map<string, NormalizedSkill>();
  let inTechnologySection = false;

  for (const rawLine of sourceText.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (TECHNOLOGY_SECTION.test(line)) inTechnologySection = true;
    else if (NON_TECHNOLOGY_SECTION.test(line)) inTechnologySection = false;

    for (const definition of SKILL_DEFINITIONS) {
      if (!definitionAppears(definition, line, inTechnologySection)) continue;
      detected.set(definition.key, {
        key: definition.key,
        label: definition.label,
        category: definition.category,
        roleFamilies: definition.roleFamilies
      });
    }
  }

  return [...detected.values()]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((skill) => skill.label);
}

/** Keeps model ordering while adding detector-only technologies canonically and once. */
export function mergeResumeTechnologies(
  extractedSkills: string[],
  detectedSkills: string[],
  limit = 24
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const value of [...extractedSkills, ...detectedSkills]) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const normalized = normalizeSkill(cleaned);
    const key = normalized?.key ?? cleaned.toLocaleLowerCase("en");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(cleaned.slice(0, 40));
    if (merged.length >= limit) break;
  }

  return merged;
}

function definitionAppears(
  definition: SkillDefinition,
  line: string,
  inTechnologySection: boolean
): boolean {
  return [...new Set([definition.label, ...definition.aliases])].some((alias) => {
    if (!containsAlias(line, alias)) return false;
    return aliasIsGrounded(definition.key, alias, line, inTechnologySection);
  });
}

function aliasIsGrounded(
  skillKey: string,
  alias: string,
  line: string,
  inTechnologySection: boolean
): boolean {
  const normalizedAlias = alias.toLocaleLowerCase("en");

  if (skillKey === "go" && normalizedAlias === "go") {
    return exactCaseAppears(line, "Go") && (inTechnologySection || TECHNICAL_CONTEXT.test(line));
  }
  if (skillKey === "r" && normalizedAlias === "r") {
    return exactCaseAppears(line, "R") && (inTechnologySection || rContext(line));
  }
  if (skillKey === "c" && normalizedAlias === "c") {
    return exactCaseAppears(line, "C") && (inTechnologySection || cContext(line));
  }
  if (alias.length <= 2) {
    return inTechnologySection && exactCaseAppears(line, alias);
  }
  if (CONTEXTUAL_ALIASES.has(normalizedAlias)) {
    return inTechnologySection || TECHNICAL_CONTEXT.test(line);
  }
  return true;
}

function rContext(line: string): boolean {
  return /\b(?:analysis|models?|programming|scripts?|statistics)\s+(?:using|with|in)\s+R\b|\bR\s+(?:language|packages?|programming|scripts?)\b/.test(
    line
  );
}

function cContext(line: string): boolean {
  return /\b(?:code|coded|programmed|programming|systems?|written)\s+(?:using|with|in)\s+C\b|\bC\s*(?:\/\s*C\+\+|language|programming)\b/.test(
    line
  );
}

function exactCaseAppears(line: string, alias: string): boolean {
  if (alias.length <= 2) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(^|[^\\p{L}\\p{N}+#.&-])${escaped}(?=$|[^\\p{L}\\p{N}+#.&-])`,
      "u"
    ).test(line);
  }
  return aliasPattern(alias, "u").test(line);
}

function containsAlias(line: string, alias: string): boolean {
  return aliasPattern(alias, "iu").test(line);
}

function aliasPattern(alias: string, flags: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, flags);
}
