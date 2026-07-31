import { BadRequestErrorException } from "../common/exceptions/bad-request-error.exception";

const UNSAFE_PATTERNS = [
  { pattern: /%%\s*\{/i, reason: "Mermaid directives are not allowed" },
  { pattern: /^\s*click\s+/im, reason: "Interactive click actions are not allowed" },
  { pattern: /^\s*href\s+/im, reason: "External href actions are not allowed" },
  { pattern: /javascript:/i, reason: "JavaScript URLs are not allowed" },
  { pattern: /<\s*script/i, reason: "Script tags are not allowed" },
  { pattern: /^\s*classDef\s+/im, reason: "Custom class definitions are not allowed" },
  { pattern: /^\s*style\s+/im, reason: "Custom style directives are not allowed" }
] as const;

const SUPPORTED_HEADER_PATTERN = /^flowchart\s+TD\s*;?\s*$/i;
const UNSUPPORTED_HEADER_PATTERN =
  /^(sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|graph\s+(?!TD\b)|flowchart\s+(?!TD\b))/i;
const LINE_PATTERN =
  /^\s*(?:[A-Za-z][A-Za-z0-9_-]*(?:\[\([^)()]{1,120}\)\]|\[[^\]]{1,120}\]|\([^)()]{1,120}\)|\{[^{}]{1,120}\})?\s*)?(?:-->|---|-.->|==>|--[^-\n]{1,80}-->|--[^-\n]{1,80}---)\s*[A-Za-z][A-Za-z0-9_-]*(?:\[\([^)()]{1,120}\)\]|\[[^\]]{1,120}\]|\([^)()]{1,120}\)|\{[^{}]{1,120}\})?\s*;?\s*$/;
const NODE_ONLY_PATTERN =
  /^\s*[A-Za-z][A-Za-z0-9_-]*(?:\[\([^)()]{1,120}\)\]|\[[^\]]{1,120}\]|\([^)()]{1,120}\)|\{[^{}]{1,120}\})\s*;?\s*$/;
const SUBGRAPH_PATTERN = /^\s*subgraph\s+[A-Za-z][A-Za-z0-9_-]*(?:\[[^\]]{1,120}\])?\s*;?\s*$/;
const END_PATTERN = /^\s*end\s*;?\s*$/;

export class MermaidFlowchartValidator {
  validate(mermaid: string): string {
    const normalized = this.normalize(mermaid);
    const lines = normalized
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("%%"));

    if (lines.length < 2) {
      throw this.invalid("Diagram must include a flowchart header and at least one node or edge");
    }

    for (const unsafe of UNSAFE_PATTERNS) {
      if (unsafe.pattern.test(normalized)) {
        throw this.invalid(unsafe.reason);
      }
    }

    const header = lines[0];

    if (!header || !SUPPORTED_HEADER_PATTERN.test(header)) {
      if (header && UNSUPPORTED_HEADER_PATTERN.test(header)) {
        throw this.invalid("Only Mermaid flowchart TD diagrams are supported");
      }

      throw this.invalid("Diagram must start with flowchart TD");
    }

    for (const [index, line] of lines.slice(1).entries()) {
      if (UNSUPPORTED_HEADER_PATTERN.test(line)) {
        throw this.invalid("Nested or unsupported Mermaid diagram types are not allowed", {
          line: index + 2
        });
      }

      if (
        !LINE_PATTERN.test(line) &&
        !NODE_ONLY_PATTERN.test(line) &&
        !SUBGRAPH_PATTERN.test(line) &&
        !END_PATTERN.test(line)
      ) {
        throw this.invalid("Diagram contains unsupported Mermaid syntax", {
          line: index + 2,
          value: line
        });
      }
    }

    return normalized;
  }

  private normalize(mermaid: string): string {
    return mermaid
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  }

  private invalid(
    message: string,
    details: Record<string, unknown> = {}
  ): BadRequestErrorException {
    return new BadRequestErrorException("MERMAID_DIAGRAM_INVALID", message, details);
  }
}
