/**
 * Some authored and generated code (starter code, reference answers, evidence
 * snippets) is stored on a single line. Shown as-is it scrolls sideways in one
 * long row, so brace-language code is laid out one statement per line before
 * it reaches an editor or viewer. Code that already has line breaks, or that is
 * too short to need it, is returned unchanged.
 */
export function readableCode(source: string): string {
  if (!source || source.includes("\n")) return source;
  if (source.length < 60 || !/[{;]/.test(source)) return source;
  return expandCompactCode(source);
}

/**
 * Breaks after `{`, `;` and `}` (outside strings and parentheses, so a `for`
 * header stays on one line), puts each member of an object literal on its own
 * line, keeps `{}` together, and indents by brace depth.
 */
export function expandCompactCode(source: string): string {
  const lines: string[] = [];
  let current = "";
  let parens = 0;
  let quote: "'" | '"' | "`" | null = null;
  let escaped = false;
  // One entry per open brace: does it open an object literal or a code block?
  const braces: Array<"object" | "block"> = [];

  const pushLine = () => {
    const content = current.trim();
    if (content) lines.push(`${"  ".repeat(braces.length)}${content}`);
    current = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quote) {
      current += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") parens += 1;
    if (character === ")") parens = Math.max(0, parens - 1);
    if (character === "{") {
      const rest = source.slice(index + 1).trimStart();
      if (rest.startsWith("}")) {
        // An empty body or object stays as `{}`.
        current = `${current.trimEnd()} {}`;
        index = source.indexOf("}", index);
        continue;
      }
      const before = current.trimEnd();
      const opensObject = before === "" || /(=|return|\(|,|:|\[)$/.test(before);
      current = `${before} {`;
      pushLine();
      braces.push(opensObject ? "object" : "block");
      continue;
    }
    if (character === "}") {
      pushLine();
      braces.pop();
      current = "}";
      const next = source.slice(index + 1).trimStart()[0];
      if (next !== ";" && next !== "," && next !== ")" && next !== "]") pushLine();
      continue;
    }
    if (character === ";" && parens === 0) {
      current += character;
      pushLine();
      continue;
    }
    if (character === "," && parens === 0 && braces.at(-1) === "object") {
      current += character;
      pushLine();
      continue;
    }
    current += character;
  }
  pushLine();
  return lines.join("\n");
}
