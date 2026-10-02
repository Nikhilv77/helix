import type { ReactNode } from "react";

/**
 * Scenario evidence that is written as prose, not as a log. It reads in the
 * normal typeface, one sentence per line, with code-like fragments
 * (`chunk { text, vector }`, `tenantName`, `GET /orders`) set as inline code.
 */
export function EvidenceProse({ text, className = "" }: { text: string; className?: string }) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {evidenceSentences(text).map((sentence, index) => (
        <li key={`${index}:${sentence}`} className="text-[15px] leading-7 text-cream/72">
          {withInlineCode(sentence)}
        </li>
      ))}
    </ul>
  );
}

/** Prose evidence is a single paragraph; anything with line breaks is a log or trace. */
export function isProseEvidence(text: string): boolean {
  const trimmed = text.trim();
  return Boolean(trimmed) && !trimmed.includes("\n") && /[.!?]\s+[A-Z]/.test(trimmed);
}

/** Splits at sentence ends, but never inside `{ … }` or `( … )`. */
function evidenceSentences(text: string): string[] {
  const sentences: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === "{" || character === "(" || character === "[") depth += 1;
    if (character === "}" || character === ")" || character === "]") depth = Math.max(0, depth - 1);
    if (depth > 0 || (character !== "." && character !== "!" && character !== "?")) continue;
    const rest = text.slice(index + 1);
    if (!/^\s+[A-Z`"']/.test(rest)) continue;
    sentences.push(text.slice(start, index + 1).trim());
    start = index + 1;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

// Object shapes, HTTP calls, camelCase or snake_case identifiers, and
// backtick-quoted spans.
const INLINE_CODE =
  /`[^`]+`|\b[A-Za-z_][\w.]*\s*\{[^{}]*\}|\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/\S*|\b[a-z]+(?:[A-Z][a-z0-9]*)+\b|\b[a-z]+(?:_[a-z0-9]+)+\b/g;

function withInlineCode(sentence: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of sentence.matchAll(INLINE_CODE)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(sentence.slice(cursor, index));
    const code = match[0].replace(/^`|`$/g, "");
    parts.push(
      <code
        key={`${index}:${code}`}
        className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.88em] text-cream/88"
      >
        {code}
      </code>
    );
    cursor = index + match[0].length;
  }
  if (cursor < sentence.length) parts.push(sentence.slice(cursor));
  return parts;
}
