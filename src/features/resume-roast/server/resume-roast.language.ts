/**
 * Words and constructions that make feedback read like a model wrote it. The
 * prompts forbid them and the quality eval counts them; generation does not
 * reject on them, because a retry costs the user more than one stray word.
 */
export const RESUME_ROAST_AI_PHRASES = [
  "leverage",
  "leveraging",
  "showcase",
  "showcasing",
  "demonstrate",
  "demonstrates",
  "robust",
  "delve",
  "tapestry",
  "testament",
  "seamless",
  "seamlessly",
  "elevate",
  "impactful",
  "holistic",
  "synergy",
  "stakeholders",
  "furthermore",
  "additionally",
  "moreover",
  "in today's",
  "it's worth noting",
  "overall,",
  "a strong foundation",
  "solid foundation",
  "key takeaway",
  "actionable insights",
  "navigate the",
  "journey",
  "dive into",
  "unlock",
  "game-changer",
  "cutting-edge",
  "evidence indicates",
  "the candidate"
] as const;

/** Stock roast lines that stopped being funny years ago. */
export const RESUME_ROAST_CLICHES = [
  "grocery list",
  "laundry list",
  "shopping list",
  "wall of text",
  "buzzword bingo",
  "swiss army knife",
  "jack of all trades",
  "ghost",
  "echo chamber",
  "beige",
  "mystery novel",
  "word salad",
  "copy-paste",
  "linkedin",
  "watching paint dry",
  "center a div"
] as const;

export function findAiSoundingPhrases(text: string): string[] {
  const lower = text.toLocaleLowerCase("en");
  const found: string[] = RESUME_ROAST_AI_PHRASES.filter((phrase) =>
    new RegExp(`(?:^|[^a-z])${escapeRegExp(phrase)}(?:$|[^a-z])`).test(lower)
  );
  // "It's not just X, it's Y" and friends: the most recognisable model tic.
  if (/\bnot (?:just|only|merely)\b[^.!?]{1,60}\b(?:but|it'?s|it is)\b/i.test(text)) {
    found.push("not just X but Y");
  }
  if ((text.match(/—/g)?.length ?? 0) > 1) found.push("em dashes");
  return found;
}

export function findRoastCliches(text: string): string[] {
  const lower = text.toLocaleLowerCase("en");
  return RESUME_ROAST_CLICHES.filter((cliche) => lower.includes(cliche));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
