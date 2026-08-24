export type DsaTemplateLanguage = "python" | "javascript" | "cpp" | "java";

type TemplateKind = "list" | "list-mutated" | "tree" | "tree-mutated" | "tree-value" | "tree-target" | "operation";

/**
 * Design problems: the candidate implements a class with several operations
 * rather than a single function. They need their own starter template, and a
 * DSA interview leaves them out because they do not fit a spoken round.
 */
export const OPERATION_DSA_SLUGS = new Set([
  "design-browser-history", "lru-cache", "min-stack", "implement-queue-using-stacks",
  "implement-stack-using-queues", "design-circular-queue", "online-stock-span",
  "time-based-key-value-store", "find-median-from-data-stream", "implement-trie-prefix-tree",
  "design-add-and-search-words-data-structure"
]);

const listQuestions = new Set([
  "reverse-linked-list", "merge-two-sorted-lists", "remove-nth-node-from-end-of-list",
  "swap-nodes-in-pairs", "odd-even-linked-list", "reverse-linked-list-ii", "rotate-list",
  "sort-list", "reverse-nodes-in-k-group"
]);

const treeQuestions = new Set([
  "maximum-depth-of-binary-tree", "minimum-depth-of-binary-tree", "same-tree", "symmetric-tree",
  "subtree-of-another-tree", "balanced-binary-tree", "diameter-of-binary-tree", "path-sum",
  "sum-root-to-leaf-numbers", "path-sum-ii", "binary-tree-level-order-traversal",
  "binary-tree-zigzag-level-order-traversal", "binary-tree-right-side-view",
  "populating-next-right-pointers-in-each-node", "validate-binary-search-tree",
  "kth-smallest-element-in-a-bst", "path-sum-iii", "house-robber-iii", "binary-tree-maximum-path-sum",
  "binary-tree-cameras", "count-complete-tree-nodes", "vertical-order-traversal-of-a-binary-tree"
]);

function templateKind(slug: string): TemplateKind | null {
  if (OPERATION_DSA_SLUGS.has(slug)) return "operation";
  if (slug === "reorder-list") return "list-mutated";
  if (slug === "flatten-binary-tree-to-linked-list" || slug === "recover-binary-search-tree") return "tree-mutated";
  if (slug === "lowest-common-ancestor-of-a-binary-tree") return "tree-value";
  if (slug === "all-nodes-distance-k-in-binary-tree") return "tree-target";
  if (listQuestions.has(slug)) return "list";
  if (treeQuestions.has(slug) || slug === "invert-binary-tree") return "tree";
  return null;
}

function functionName(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function signature(slug: string): { parameters: string; returnType: string } {
  const kind = templateKind(slug);
  if (kind === "list" || kind === "list-mutated") return { parameters: "head", returnType: kind === "list-mutated" ? "void" : "ListNode" };
  if (kind === "tree-value") return { parameters: "root, p, q", returnType: "TreeNode" };
  if (kind === "tree-target") return { parameters: "root, target, k", returnType: "int[]" };
  if (kind === "tree-mutated") return { parameters: "root", returnType: "TreeNode" };
  if (slug === "same-tree" || slug === "symmetric-tree" || slug === "subtree-of-another-tree" || slug === "path-sum" || slug === "balanced-binary-tree" || slug === "validate-binary-search-tree") return { parameters: slug === "same-tree" ? "p, q" : slug === "subtree-of-another-tree" ? "root, subRoot" : slug === "path-sum" ? "root, targetSum" : "root", returnType: "boolean" };
  if (slug === "path-sum-ii") return { parameters: "root, targetSum", returnType: "int[][]" };
  if (slug === "path-sum-iii") return { parameters: "root, targetSum", returnType: "int" };
  if (slug === "kth-smallest-element-in-a-bst") return { parameters: "root, k", returnType: "int" };
  if (["binary-tree-level-order-traversal", "binary-tree-zigzag-level-order-traversal", "vertical-order-traversal-of-a-binary-tree"].includes(slug)) return { parameters: "root", returnType: "int[][]" };
  if (["binary-tree-right-side-view"].includes(slug)) return { parameters: "root", returnType: "int[]" };
  return { parameters: "root", returnType: "int" };
}

export function dsaStarterCode(slug: string, language: DsaTemplateLanguage): string {
  const name = functionName(slug);
  const kind = templateKind(slug);
  if (!kind) return genericStarter(name, language);
  if (kind === "operation") return operationStarter(slug, language);
  const { parameters, returnType } = signature(slug);
  if (language === "python") return `def ${name}(${parameters}):\n    pass\n`;
  if (language === "javascript") return `function ${name}(${parameters}) {\n  \n}\n`;
  if (language === "java") return javaStarter(name, parameters, returnType);
  return cppStarter(name, parameters, returnType);
}

function operationClassName(slug: string): string {
  return {
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
  }[slug] ?? "Solution";
}

function operationStarter(slug: string, language: DsaTemplateLanguage): string {
  const className = operationClassName(slug);
  if (language === "javascript") return `class ${className} {\n  constructor() {}\n}\n`;
  if (language === "python") return `class ${className}:\n    def __init__(self, *args):\n        pass\n`;
  if (language === "java") return `import java.util.*;\n\nclass Main {\n    static class ${className} {\n        ${className}() {}\n    }\n}\n`;
  return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass ${className} {};\n\nint main() { return 0; }\n`;
}

function genericStarter(name: string, language: DsaTemplateLanguage): string {
  if (language === "python") return `def ${name}(input):\n    pass\n`;
  if (language === "javascript") return `function ${name}(input) {\n  \n}\n`;
  if (language === "java") return `import java.util.*;\n\nclass Main {\n    static int ${name}(int[] input) {\n        return 0;\n    }\n}\n`;
  return `#include <bits/stdc++.h>\nusing namespace std;\n\nint ${name}(vector<int>& input) {\n    return 0;\n}\n\nint main() { return 0; }\n`;
}

function javaStarter(name: string, parameters: string, returnType: string): string {
  const javaReturn = returnType === "ListNode" || returnType === "TreeNode" || returnType === "int[]" || returnType === "int[][]" || returnType === "boolean" || returnType === "int" || returnType === "void" ? (returnType === "int[]" ? "int[]" : returnType === "int[][]" ? "int[][]" : returnType) : "Object";
  const javaParameters = parameters.split(", ").map((parameter) => `${parameter === "head" ? "ListNode" : parameter === "root" || parameter === "p" || parameter === "q" || parameter === "target" ? "TreeNode" : "int"} ${parameter}`).join(", ");
  const emptyReturn = javaReturn === "void" ? "return;" : javaReturn === "boolean" ? "return false;" : javaReturn === "int" ? "return 0;" : javaReturn === "int[]" || javaReturn === "int[][]" || javaReturn === "ListNode" || javaReturn === "TreeNode" || javaReturn === "Object" ? "return null;" : "return null;";
  return `import java.util.*;\n\nclass Main {\n    static ${javaReturn} ${name}(${javaParameters}) {\n        ${emptyReturn}\n    }\n}\n`;
}

function cppStarter(name: string, parameters: string, returnType: string): string {
  const cppReturn = returnType === "ListNode" || returnType === "TreeNode" ? `${returnType}*` : returnType === "int[]" ? "vector<int>" : returnType === "int[][]" ? "vector<vector<int>>" : returnType === "boolean" ? "bool" : returnType === "void" ? "void" : "int";
  const cppParameters = parameters.split(", ").map((parameter) => `${parameter === "head" ? "ListNode" : parameter === "root" || parameter === "p" || parameter === "q" || parameter === "target" ? "TreeNode" : "int"}${parameter === "head" || parameter === "root" || parameter === "p" || parameter === "q" || parameter === "target" ? "*" : ""} ${parameter}`).join(", ");
  const emptyReturn = cppReturn === "void" ? "return;" : cppReturn === "bool" ? "return false;" : cppReturn === "int" ? "return 0;" : cppReturn.endsWith("*") ? "return nullptr;" : "return {};";
  return `#include <bits/stdc++.h>\nusing namespace std;\n\n${cppReturn} ${name}(${cppParameters}) {\n    ${emptyReturn}\n}\n\nint main() { return 0; }\n`;
}
