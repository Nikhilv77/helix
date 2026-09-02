import type { DsaExample, DsaQuestion } from "./dsa";

export type DsaTemplateLanguage = "python" | "javascript" | "cpp" | "java";

const ALL_DSA_LANGUAGES: DsaTemplateLanguage[] = ["javascript", "python", "cpp", "java"];
const OPERATION_DSA_LANGUAGES: DsaTemplateLanguage[] = ["javascript", "python"];
const RESIZABLE_FIRST_ARGUMENT_LANGUAGES: DsaTemplateLanguage[] = ["javascript", "python", "cpp"];

/**
 * Graded on a first argument the solution has to make *shorter*.
 *
 * Java's arrays are fixed-length, so a `static void f(int[] nums)` cannot hand
 * back a shorter array — the harness serializes the same length it passed in
 * and the case can never pass. JavaScript, Python and C++ all have a resizable
 * container (`length =`, `del nums[k:]`, `resize`), so the question is fine
 * there.
 *
 * Dropping Java is the honest fix. The alternative is grading on the returned
 * length instead, which the starter signature — void, because the mutation is
 * the answer — has no way to return.
 */
const RESIZABLE_FIRST_ARGUMENT_SLUGS = new Set([
  "string-compression",
  "remove-duplicates-from-sorted-array"
]);

// These need typed node/serialization adapters before Java and C++ can safely
// represent the nested nulls in their authored examples.
//
// `clone-graph` is here for a different reason and it is a deliberate trade.
// It used to advertise all four languages and grade nothing — `return adjList`
// passed every case, because the adjacency list went in and came straight back
// out. The `graph-clone` adapter now builds real nodes and rejects a result
// that hands the originals back, but only in JavaScript and Python; Java and
// C++ would still see the old array shape and still pass the shortcut. A
// question graded correctly in two languages beats one graded in none, so it
// waits here until the Java and C++ node builders land alongside the
// class-operation runners.
const DYNAMIC_STRUCTURE_DSA_SLUGS = new Set(["copy-list-with-random-pointer", "clone-graph"]);

/**
 * Trailing example parameters the harness adapter consumes before the
 * candidate's function is called.
 *
 * `linked-list-cycle` and `linked-list-cycle-ii` are written `head = [...],
 * pos = 1`, and the adapter uses `pos` to close the cycle before passing the
 * head alone. The intersection adapter reads all four — both value lists and
 * both skips — to build two lists sharing a tail, then passes the two heads.
 *
 * The starter has to match what is actually called. When it did not, the
 * candidate was handed the answer as a parameter: `return pos !== -1` passed
 * every case.
 */
const ADAPTER_CONSUMED_PARAMETERS: Record<string, number> = {
  "linked-list-cycle": 1,
  "linked-list-cycle-ii": 1,
  "intersection-of-two-linked-lists": 2
};

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
  | "list"
  | "list-mutated"
  | "tree"
  | "tree-mutated"
  | "tree-value"
  | "tree-target"
  | "tree-result"
  | "operation";

/**
 * Ordinary arguments in, a tree out.
 *
 * Without this the starter returned `int[]`, so the candidate had to emit the
 * level-order array by hand — and could not, in Java or C++, because the
 * expected arrays contain nulls that `int[]` and `vector<int>` cannot hold. The
 * `tree-result` harness adapter serializes the returned node instead.
 */
const TREE_RESULT_SLUGS = new Set([
  "convert-sorted-array-to-binary-search-tree",
  "construct-binary-tree-from-preorder-and-inorder-traversal"
]);

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
  if (DYNAMIC_STRUCTURE_DSA_SLUGS.has(slug)) return [...OPERATION_DSA_LANGUAGES];
  if (RESIZABLE_FIRST_ARGUMENT_SLUGS.has(slug)) return [...RESIZABLE_FIRST_ARGUMENT_LANGUAGES];
  return [...ALL_DSA_LANGUAGES];
}

const listQuestions = new Set([
  "partition-list",
  "linked-list-cycle",
  "linked-list-cycle-ii",
  "intersection-of-two-linked-lists",
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
  "vertical-order-traversal-of-a-binary-tree",
  "maximum-width-of-binary-tree"
]);

function templateKind(slug: string): TemplateKind | null {
  if (OPERATION_DSA_SLUGS.has(slug)) return "operation";
  if (slug === "reorder-list") return "list-mutated";
  if (slug === "flatten-binary-tree-to-linked-list" || slug === "recover-binary-search-tree")
    return "tree-mutated";
  if (slug === "lowest-common-ancestor-of-a-binary-tree") return "tree-value";
  if (slug === "all-nodes-distance-k-in-binary-tree") return "tree-target";
  if (TREE_RESULT_SLUGS.has(slug)) return "tree-result";
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
  const inferred = inferParameters(question.examples ?? []);
  const consumed = ADAPTER_CONSUMED_PARAMETERS[slug] ?? 0;
  const parameters = consumed ? inferred.slice(0, inferred.length - consumed) : inferred;
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

/**
 * The method signatures each design question expects, for the statically-typed
 * starters.
 *
 * A shell with a no-argument constructor is fine in JavaScript and Python, and
 * useless in Java and C++: the harness calls `new BrowserHistory("home")` and
 * the program does not compile. Declaring the real contract also tells the
 * candidate what they are being asked for, which the shell never did.
 *
 * Each entry is [constructor parameters, [return type, name, parameters]...],
 * written once in Java types and translated for C++.
 */
const OPERATION_SIGNATURES: Record<
  string,
  { constructor: string; methods: Array<[string, string, string]> }
> = {
  BrowserHistory: {
    constructor: "String homepage",
    methods: [
      ["void", "visit", "String url"],
      ["String", "back", "int steps"],
      ["String", "forward", "int steps"]
    ]
  },
  LRUCache: {
    constructor: "int capacity",
    methods: [
      ["int", "get", "int key"],
      ["void", "put", "int key, int value"]
    ]
  },
  MinStack: {
    constructor: "",
    methods: [
      ["void", "push", "int val"],
      ["void", "pop", ""],
      ["int", "top", ""],
      ["int", "getMin", ""]
    ]
  },
  MyQueue: {
    constructor: "",
    methods: [
      ["void", "push", "int x"],
      ["int", "pop", ""],
      ["int", "peek", ""],
      ["boolean", "empty", ""]
    ]
  },
  MyStack: {
    constructor: "",
    methods: [
      ["void", "push", "int x"],
      ["int", "pop", ""],
      ["int", "top", ""],
      ["boolean", "empty", ""]
    ]
  },
  MyCircularQueue: {
    constructor: "int k",
    methods: [
      ["boolean", "enQueue", "int value"],
      ["boolean", "deQueue", ""],
      ["int", "Front", ""],
      ["int", "Rear", ""],
      ["boolean", "isEmpty", ""],
      ["boolean", "isFull", ""]
    ]
  },
  StockSpanner: { constructor: "", methods: [["int", "next", "int price"]] },
  TimeMap: {
    constructor: "",
    methods: [
      ["void", "set", "String key, String value, int timestamp"],
      ["String", "get", "String key, int timestamp"]
    ]
  },
  MedianFinder: {
    constructor: "",
    methods: [
      ["void", "addNum", "int num"],
      ["double", "findMedian", ""]
    ]
  },
  Trie: {
    constructor: "",
    methods: [
      ["void", "insert", "String word"],
      ["boolean", "search", "String word"],
      ["boolean", "startsWith", "String prefix"]
    ]
  },
  WordDictionary: {
    constructor: "",
    methods: [
      ["void", "addWord", "String word"],
      ["boolean", "search", "String word"]
    ]
  }
};

const emptyBodyFor = (returnType: string): string =>
  returnType === "void"
    ? ""
    : returnType === "boolean"
      ? " return false;"
      : returnType === "int"
        ? " return 0;"
        : returnType === "double"
          ? " return 0.0;"
          : " return null;";

const toCppType = (javaType: string): string =>
  javaType === "boolean" ? "bool" : javaType === "String" ? "string" : javaType;

const toCppParameters = (parameters: string): string =>
  parameters
    .split(",")
    .filter((part) => part.trim().length > 0)
    .map((part) => {
      const [type, ...rest] = part.trim().split(/\s+/);
      return `${toCppType(type ?? "")} ${rest.join(" ")}`;
    })
    .join(", ");

function operationStarter(slug: string, language: DsaTemplateLanguage): string {
  const className = operationClassName(slug);
  if (language === "javascript") return `class ${className} {\n  constructor() {}\n}\n`;
  if (language === "python")
    return `class ${className}:\n    def __init__(self, *args):\n        pass\n`;

  const signature = OPERATION_SIGNATURES[className];
  if (!signature) throw new Error(`No operation signature for ${className}`);

  if (language === "java") {
    const methods = signature.methods
      .map(
        ([returnType, name, parameters]) =>
          `        ${returnType} ${name}(${parameters}) {${emptyBodyFor(returnType)} }`
      )
      .join("\n");
    return `import java.util.*;\n\nclass Main {\n    static class ${className} {\n        ${className}(${signature.constructor}) {}\n\n${methods}\n    }\n}\n`;
  }

  const methods = signature.methods
    .map(([returnType, name, parameters]) => {
      const cppReturn = toCppType(returnType);
      const body = cppReturn === "string" ? ' return ""; ' : `${emptyBodyFor(returnType)} `;
      return `    ${cppReturn} ${name}(${toCppParameters(parameters)}) {${body}}`;
    })
    .join("\n");
  return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass ${className} {\npublic:\n    ${className}(${toCppParameters(signature.constructor)}) {}\n\n${methods}\n};\n\nint main() { return 0; }\n`;
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
  // `linked-list-cycle` is the one list question answering yes/no rather than
  // handing back a node, and its examples say so.
  if (kind === "list") return typeof value === "boolean" ? "boolean" : "ListNode";
  if (kind === "tree-value" || kind === "tree-result" || slug === "invert-binary-tree")
    return "TreeNode";
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
