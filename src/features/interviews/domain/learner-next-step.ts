/**
 * The semantic evaluator writes gaps as assessor notes about the candidate
 * ("Failed to provide a career story"). Reports show them to the learner as
 * the next thing to practise, so they are rewritten as advice addressed to
 * them ("Next time, provide a career story."). Deterministic on purpose: the
 * same gap always reads the same way, and saved reports can be fixed on read.
 */

/** Legacy prefix saved inside older report snapshots. */
const LEGACY_PREFIX = /^work on this next:\s*/i;

/** Terse rubric keys the evaluator sometimes returns on their own. */
const KEY_STEPS: Record<string, string> = {
  ownership: "Make your personal contribution explicit.",
  decision: "Explain why you chose this approach over an alternative.",
  outcome: "Close with a measurable result or what you learned.",
  specificity: "Add a concrete constraint, number, or technical detail.",
  "personal scope": "Say what you personally owned and how big it was.",
  "problem and constraints": "Restate the problem and its constraints before you start.",
  "success condition": "Say how you would know the solution works."
};

/** "No discussion of X" and friends map to the verb the learner should use. */
const NO_NOUN_VERBS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^no discussion (?:of|about)\s+/i, "discuss "],
  [/^no explanation (?:of|for)\s+/i, "explain "],
  [/^no mention of\s+/i, "mention "],
  [/^no identification of\s+/i, "identify "],
  [/^no handling of\s+/i, "handle "],
  [/^no use of\s+/i, "use "]
];

/** Verbs that already start an instruction; such gaps are kept as written. */
const IMPERATIVE_START =
  /^(?:add|explain|describe|state|name|say|show|review|use|include|mention|discuss|identify|walk|give|provide|close|open|practise|practice|clarify|compare|define|handle|trace|test)\b/i;

const TRAILING_PARTICIPLE =
  /\s+(?:provided|given|defined|described|discussed|outlined|presented|identified|stated|mentioned|shown)\.?$/i;

export function learnerNextStep(gap: string): string {
  const text = gap.replace(LEGACY_PREFIX, "").replace(/\s+/g, " ").trim();
  if (!text) return "Pick one example from your own work and walk through what you did, why, and the result.";

  const keyText = text
    .toLowerCase()
    .replace(/[.\s]+$/, "")
    .replace(/\s+missing$/, "");
  const key = KEY_STEPS[keyText];
  if (key) return key;
  if (IMPERATIVE_START.test(text)) return sentence(text);

  // "Candidate fails to…" reads as a verdict; the subject adds nothing. Only
  // the first clause becomes the step: later clauses ("; lacks …", ", does
  // not …") are further assessor notes, not part of one instruction.
  const body = firstClause(text.replace(/^(?:the\s+)?candidate\s+/i, ""));

  if (/\birrelevant\b|\boff-topic\b/i.test(body)) {
    return "Next time, answer the question that was asked.";
  }
  const submitted = body.match(/^no\s+(.+?)\s+(?:was|were)\s+submitted\b/i);
  if (submitted) return nextTime(`submit ${submitted[1]!.replace(/^solution evidence$/i, "a solution")}`);

  const missingSuffix = body.match(/^(.+?)\s+(?:is\s+)?missing$/i);
  if (missingSuffix) return nextTime(`add ${missingSuffix[1]!}`);

  const negated = body.match(
    /^(?:did not|didn['’]t|does not|doesn['’]t|do not|don['’]t|failed to|fails to|fail to|never)\s+(.+)$/i
  );
  if (negated) return nextTime(negated[1]!);

  const provided = body.match(/^provided no\s+(.+)$/i);
  if (provided) return nextTime(`provide ${provided[1]!}`);

  const ignored = body.match(/^(?:ignores|ignored)\s+(.+?)(?:\s+entirely)?\.?$/i);
  if (ignored) return nextTime(`address ${ignored[1]!}`);

  const lacking = body.match(/^(?:missing|lacks|lacked|lacking)\s+(.+)$/i);
  if (lacking) return nextTime(`add ${lacking[1]!}`);

  for (const [pattern, verb] of NO_NOUN_VERBS) {
    if (pattern.test(body)) return nextTime(verb + body.replace(pattern, ""));
  }
  const none = body.match(/^no\s+(.+)$/i);
  if (none) return nextTime(`include ${none[1]!.replace(TRAILING_PARTICIPLE, "")}`);

  // Anything else (a factual note such as "Implementation is in Java") is
  // still useful context; frame it as something to revisit, not a verdict.
  return `Next time, go back over this: ${lowerFirst(stripEnd(body))}.`;
}

function firstClause(text: string): string {
  const cut = text.search(/;|,\s+(?:and\s+)?(?:does not|did not|doesn['’]t|didn['’]t|lacks|lacked|no)\b/i);
  return cut > 0 ? text.slice(0, cut).trim() : text;
}

function nextTime(rest: string): string {
  return `Next time, ${lowerFirst(stripEnd(rest))}.`;
}

function sentence(text: string): string {
  const trimmed = stripEnd(text);
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}

function stripEnd(text: string): string {
  // Keep a truncation ellipsis; drop a final full stop so one is added once.
  return text.trim().replace(/\.+$/, "");
}

function lowerFirst(text: string): string {
  // Leave acronyms and proper nouns ("CDN", "JavaScript") alone.
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}
