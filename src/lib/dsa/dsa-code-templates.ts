import type { DsaExample, DsaQuestion } from "./dsa";

export type DsaTemplateLanguage = "python" | "javascript" | "cpp" | "java";

const ALL_DSA_LANGUAGES: DsaTemplateLanguage[] = ["javascript", "python", "cpp", "java"];
const OPERATION_DSA_LANGUAGES: DsaTemplateLanguage[] = ["javascript", "python"];

// These need typed node/serialization adapters before Java and C++ can safely
// represent the nested nulls in their authored examples.
const DYNAMIC_STRUCTURE_DSA_SLUGS = new Set([
  "copy-list-with-random-pointer",
  "flatten-a-multilevel-doubly-linked-list",
  "serialize-and-deserialize-binary-tree"
]);

const MUTATED_FIRST_ARGUMENT_SLUGS = new Set([
  "move-zeroes",
  "remove-duplicates-from-sorted-array",
  "rotate-array",
  "sort-colors",
  "next-permutation",
  "set-matrix-zeroes",
  "rotate-image",
  "game-of-life",
  "string-compression",
  "surrounded-regions"
]);

type TemplateKind =
  "list" | "list-mutated" | "tree" | "tree-mutated" | "tree-value" | "tree-target" | "operation";

/**
 * Design problems: the candidate implements a class with several operations
 * rather than a single function. They need their own starter template, and a
 * DSA interview leaves them out because they do not fit a spoken round.
 */
export const OPERATION_DSA_SLUGS = new Set([
  "design-browser-history",
  "lru-cache",
  "min-stack",
  "implement-queue-using-stacks",
  "implement-stack-using-queues",
  "design-circular-queue",
  "online-stock-span",
  "time-based-key-value-store",
  "find-median-from-data-stream",
  "implement-trie-prefix-tree",
  "design-add-and-search-words-data-structure"
]);

/** Languages the current harness can actually execute for this question. */
export function supportedDsaCodeLanguages(slug: string): DsaTemplateLanguage[] {
  return [
    ...(OPERATION_DSA_SLUGS.has(slug) || DYNAMIC_STRUCTURE_DSA_SLUGS.has(slug)
      ? OPERATION_DSA_LANGUAGES
      : ALL_DSA_LANGUAGES)
  ];
}

const listQuestions = new Set([
  "reverse-linked-list",
  "merge-two-sorted-lists",
  "remove-nth-node-from-end-of-list",
  "swap-nodes-in-pairs",
  "odd-even-linked-list",
  "reverse-linked-list-ii",
  "rotate-list",
  "sort-list",
  "reverse-nodes-in-k-group"
]);

const treeQuestions = new Set([
  "maximum-depth-of-binary-tree",
  "minimum-depth-of-binary-tree",
  "same-tree",
  "symmetric-tree",
  "subtree-of-another-tree",
  "balanced-binary-tree",
  "diameter-of-binary-tree",
  "path-sum",
  "sum-root-to-leaf-numbers",
  "path-sum-ii",
  "binary-tree-level-order-traversal",
  "binary-tree-zigzag-level-order-traversal",
  "binary-tree-right-side-view",
  "populating-next-right-pointers-in-each-node",
  "validate-binary-search-tree",
  "kth-smallest-element-in-a-bst",
  "path-sum-iii",
  "house-robber-iii",
  "binary-tree-maximum-path-sum",
  "binary-tree-cameras",
  "count-complete-tree-nodes",
  "vertical-order-traversal-of-a-binary-tree"
]);

function templateKind(slug: string): TemplateKind | null {
  if (OPERATION_DSA_SLUGS.has(slug)) return "operation";
  if (slug === "reorder-list") return "list-mutated";
  if (slug === "flatten-binary-tree-to-linked-list" || slug === "recover-binary-search-tree")
    return "tree-mutated";
  if (slug === "lowest-common-ancestor-of-a-binary-tree") return "tree-value";
  if (slug === "all-nodes-distance-k-in-binary-tree") return "tree-target";
  if (listQuestions.has(slug)) return "list";
  if (treeQuestions.has(slug) || slug === "invert-binary-tree") return "tree";
  return null;
}

export function dsaFunctionName(slug: string): string {
  const safeSlug = slug === "3sum" ? "three-sum" : slug === "4sum" ? "four-sum" : slug;
  const [first = "solve", ...rest] = safeSlug.split("-").filter(Boolean);
  return first + rest.map((part) => part[0]?.toUpperCase() + part.slice(1)).join("");
}

interface InferredParameter {
  name: string;
  value: unknown;
}

type StarterQuestion = Pick<DsaQuestion, "slug" | "examples">;

export function dsaStarterCode(
  questionOrSlug: StarterQuestion | string,
  language: DsaTemplateLanguage
): string {
  const question =
    typeof questionOrSlug === "string"
      ? { slug: questionOrSlug, examples: undefined }
      : questionOrSlug;
  const slug = question.slug;
  const name = dsaFunctionName(slug);
  const kind = templateKind(slug);
  if (kind === "operation") return operationStarter(slug, language);
  const parameters = inferParameters(question.examples ?? []);
  const returnValue = mergeValueShapes(
    (question.examples ?? []).map((example) => parseExampleValue(example.output))
  );
  const returnsVoid =
    kind === "list-mutated" || kind === "tree-mutated" || MUTATED_FIRST_ARGUMENT_SLUGS.has(slug);

  if (language === "python") {
    return `def ${name}(${parameters.map((parameter) => parameter.name).join(", ")}):\n    pass\n`;
  }
  if (language === "javascript") {
    return `function ${name}(${parameters.map((parameter) => parameter.name).join(", ")}) {\n  \n}\n`;
  }
  if (language === "java") {
    return javaStarter(slug, name, parameters, returnValue, kind, returnsVoid);
  }
  return cppStarter(slug, name, parameters, returnValue, kind, returnsVoid);
}

function operationClassName(slug: string): string {
  return (
    {
      "design-browser-history": "BrowserHistory",
      "lru-cache": "LRUCache",
      "min-stack": "MinStack",
      "implement-queue-using-stacks": "MyQueue",
      "implement-stack-using-queues": "MyStack",
      "design-circular-queue": "MyCircularQueue",
      "online-stock-span": "StockSpanner",
      "time-based-key-value-store": "TimeMap",
      "find-median-from-data-stream": "MedianFinder",
      "implement-trie-prefix-tree": "Trie",
      "design-add-and-search-words-data-structure": "WordDictionary"
    }[slug] ?? "Solution"
  );
}

function operationStarter(slug: string, language: DsaTemplateLanguage): string {
  const className = operationClassName(slug);
  if (language === "javascript") return `class ${className} {\n  constructor() {}\n}\n`;
  if (language === "python")
    return `class ${className}:\n    def __init__(self, *args):\n        pass\n`;
  if (language === "java")
    return `import java.util.*;\n\nclass Main {\n    static class ${className} {\n        ${className}() {}\n    }\n}\n`;
  return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass ${className} {};\n\nint main() { return 0; }\n`;
}

function inferParameters(examples: DsaExample[]): InferredParameter[] {
  const parsed = examples.map((example) =>
    splitTopLevel(example.input).flatMap((assignment, index) => {
      const equals = assignment.indexOf("=");
      if (equals === -1) return [];
      const rawName = assignment.slice(0, equals).trim();
      const name = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rawName) ? rawName : `input${index + 1}`;
      return [{ name, value: parseExampleValue(assignment.slice(equals + 1)) }];
    })
  );
  const first = parsed.find((parameters) => parameters.length > 0);
  if (!first) return [{ name: "input", value: [] }];

  return first.map((parameter, index) => ({
    name: parameter.name,
    value: mergeValueShapes(parsed.map((parameters) => parameters[index]?.value))
  }));
}

function javaStarter(
  slug: string,
  name: string,
  parameters: InferredParameter[],
  returnValue: unknown,
  kind: TemplateKind | null,
  returnsVoid: boolean
): string {
  const javaReturn = returnsVoid ? "void" : adaptedJavaReturnType(slug, kind, returnValue);
  const javaParameters = parameters
    .map(
      (parameter, index) => `${adaptedJavaParameterType(kind, parameter, index)} ${parameter.name}`
    )
    .join(", ");
  const emptyReturn =
    javaReturn === "void"
      ? "return;"
      : javaReturn === "boolean"
        ? "return false;"
        : javaReturn === "int"
          ? "return 0;"
          : javaReturn === "double"
            ? "return 0.0;"
            : javaReturn === "int[]" ||
                javaReturn === "int[][]" ||
                javaReturn === "ListNode" ||
                javaReturn === "TreeNode" ||
                javaReturn === "Object"
              ? "return null;"
              : "return null;";
  return `import java.util.*;\n\nclass Main {\n    static ${javaReturn} ${name}(${javaParameters}) {\n        ${emptyReturn}\n    }\n}\n`;
}

function cppStarter(
  slug: string,
  name: string,
  parameters: InferredParameter[],
  returnValue: unknown,
  kind: TemplateKind | null,
  returnsVoid: boolean
): string {
  const cppReturn = returnsVoid ? "void" : adaptedCppReturnType(slug, kind, returnValue);
  const cppParameters = parameters
    .map((parameter, index) => {
      const type = adaptedCppParameterType(kind, parameter, index);
      const reference = type.startsWith("vector<") ? "&" : "";
      return `${type}${reference} ${parameter.name}`;
    })
    .join(", ");
  const emptyReturn =
    cppReturn === "void"
      ? "return;"
      : cppReturn === "bool"
        ? "return false;"
        : cppReturn === "int"
          ? "return 0;"
          : cppReturn.endsWith("*")
            ? "return nullptr;"
            : "return {};";
  return `#include <bits/stdc++.h>\nusing namespace std;\n\n${cppReturn} ${name}(${cppParameters}) {\n    ${emptyReturn}\n}\n\nint main() { return 0; }\n`;
}

function adaptedJavaParameterType(
  kind: TemplateKind | null,
  parameter: InferredParameter,
  index: number
): string {
  if ((kind === "list" || kind === "list-mutated") && Array.isArray(parameter.value)) {
    return "ListNode";
  }
  if (
    kind === "tree-value" ||
    (kind === "tree-target" && index < 2) ||
    ((kind === "tree" || kind === "tree-mutated") && Array.isArray(parameter.value))
  ) {
    return "TreeNode";
  }
  return javaValueType(parameter.value);
}

function adaptedCppParameterType(
  kind: TemplateKind | null,
  parameter: InferredParameter,
  index: number
): string {
  const javaType = adaptedJavaParameterType(kind, parameter, index);
  if (javaType === "ListNode" || javaType === "TreeNode") return `${javaType}*`;
  return cppValueType(parameter.value);
}

function adaptedJavaReturnType(slug: string, kind: TemplateKind | null, value: unknown): string {
  if (kind === "list") return "ListNode";
  if (kind === "tree-value" || slug === "invert-binary-tree") return "TreeNode";
  if (kind === "tree-target") return "int[]";
  return javaValueType(value);
}

function adaptedCppReturnType(slug: string, kind: TemplateKind | null, value: unknown): string {
  const javaType = adaptedJavaReturnType(slug, kind, value);
  if (javaType === "ListNode" || javaType === "TreeNode") return `${javaType}*`;
  return cppValueType(value);
}

function javaValueType(value: unknown): string {
  if (Array.isArray(value)) return `${javaValueType(value.find((item) => item !== null))}[]`;
  if (typeof value === "string") return "String";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "double";
  return "Object";
}

function cppValueType(value: unknown): string {
  if (Array.isArray(value)) return `vector<${cppValueType(value.find((item) => item !== null))}>`;
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "double";
  return "int";
}

function parseExampleValue(raw: string): unknown {
  const value = raw.trim();
  try {
    return JSON.parse(value);
  } catch {
    if (value === "True") return true;
    if (value === "False") return false;
    if (value === "None") return null;
    return undefined;
  }
}

function mergeValueShapes(values: unknown[]): unknown {
  const defined = values.filter((value) => value !== undefined && value !== null);
  if (!defined.length) return undefined;
  if (defined.every(Array.isArray)) {
    return [mergeValueShapes(defined.flatMap((value) => value as unknown[])) ?? 0];
  }
  if (defined.every((value) => typeof value === "number")) {
    return defined.some((value) => !Number.isInteger(value as number)) ? 0.5 : 0;
  }
  return defined[0];
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? "";
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[" || character === "{" || character === "(") depth += 1;
    else if (character === "]" || character === "}" || character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}
