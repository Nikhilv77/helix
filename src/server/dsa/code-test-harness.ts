import type { DsaExample } from "@/lib/dsa/dsa";
import { structuredCasesFor } from "../../data/dsa/test-cases-batch-1";

export type CodeRunnerLanguage = "python" | "javascript" | "cpp" | "java";

export interface CodeTestCase {
  input: string;
  expectedOutput: string;
  arguments: unknown[];
  expectedValue: unknown;
  mode?: "return" | "mutated-first-argument";
  comparison?: "exact" | "unordered" | "unordered-nested" | "one-of";
  adapter?: TestAdapter;
}

type TestAdapter = "linked-list" | "linked-list-mutated" | "tree-input" | "tree-output" | "tree-mutated-output" | "tree-right-chain" | "tree-node-value" | "tree-target-value" | `operations:${string}`;

export interface CodeTestResult {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error: string | null;
}

const RESULT_MARKER = "__TRAILGRAD_CASE__";

export function buildTestCases(examples: DsaExample[], slug?: string): CodeTestCase[] {
  const structured = slug ? structuredCasesFor(slug, examples) : null;
  const adapter = slug ? adapterForSlug(slug) : undefined;
  return examples.slice(0, 10).map((example, index) => {
    const structuredCase = structured?.[index];
    return {
      input: example.input,
      expectedOutput: example.output,
      arguments: structuredCase ? structuredCase.arguments : parseArguments(example.input),
      expectedValue: structuredCase ? structuredCase.expectedValue : parseValue(example.output),
      mode: structuredCase?.mode,
      comparison: structuredCase?.comparison,
      adapter
    };
  });
}

export function buildTestHarness(
  code: string,
  language: CodeRunnerLanguage,
  functionName: string,
  testCases: CodeTestCase[]
): string {
  if (testCases[0]?.adapter?.startsWith("operations:")) {
    if (language === "javascript") return javascriptOperationHarness(code, testCases);
    if (language === "python") return pythonOperationHarness(code, testCases);
    throw new Error("Class-operation questions currently support JavaScript and Python. Java and C++ class runners are next.");
  }
  if (language === "javascript") return javascriptHarness(code, functionName, testCases);
  if (language === "python") return pythonHarness(code, functionName, testCases);
  if (language === "java") return javaHarness(code, functionName, testCases);
  return cppHarness(code, functionName, testCases);
}

export function parseTestResults(stdout: string, testCases: CodeTestCase[]): CodeTestResult[] {
  const payloads = new Map<number, { ok?: boolean; value?: unknown; error?: string }>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith(RESULT_MARKER)) continue;
    const separator = line.indexOf(":", RESULT_MARKER.length);
    if (separator === -1) continue;
    const index = Number(line.slice(RESULT_MARKER.length, separator));
    try {
      payloads.set(index, JSON.parse(line.slice(separator + 1)) as { ok?: boolean; value?: unknown; error?: string });
    } catch {
      payloads.set(index, { ok: false, error: "The test runner returned invalid output." });
    }
  }

  return testCases.map((testCase, index) => {
    const payload = payloads.get(index);
    const error = payload?.ok === false ? payload.error || "Runtime error" : null;
    const actual = payload?.value;
    return {
      index,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: error ? "" : displayValue(actual),
      passed: Boolean(payload?.ok) && equivalent(actual, testCase.expectedValue, testCase.comparison),
      error: payload ? error : "No result was returned for this test case."
    };
  });
}

export function resultMarker(): string {
  return RESULT_MARKER;
}

function parseArguments(input: string): unknown[] {
  return splitTopLevel(input).map((part) => {
    const assignment = part.indexOf("=");
    return parseValue(assignment === -1 ? part : part.slice(assignment + 1));
  });
}

function parseValue(value: string): unknown {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    if (trimmed === "True") return true;
    if (trimmed === "False") return false;
    if (trimmed === "None") return null;
    throw new Error(`Unsupported test value: ${trimmed}`);
  }
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

function javascriptHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const runs = testCases
    .map(
      (testCase, index) => `try {
  const rawArguments = [${testCase.arguments.map(jsLiteral).join(", ")}];
  const argumentsList = trailgradAdaptArguments(rawArguments, "${testCase.adapter ?? "none"}");
  const value = ${functionName}(...argumentsList);
  const outputValue = ${testCase.mode === "mutated-first-argument" ? "argumentsList[0]" : "value"};
  const output = trailgradAdaptOutput(outputValue === undefined && ["linked-list-mutated", "tree-output", "tree-mutated-output", "tree-right-chain"].includes("${testCase.adapter ?? "none"}") ? argumentsList[0] : outputValue, "${testCase.adapter ?? "none"}");
  console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: output }));
} catch (error) {
  console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) }));
}`
    )
    .join("\n");
  return `${javascriptAdapterHelpers()}\n${code}\n\n${runs}\n`;
}

function pythonHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const runs = testCases
    .map(
      (testCase, index) => `try:
    raw_arguments = [${testCase.arguments.map(pythonLiteral).join(", ")}]
    arguments_list = trailgrad_adapt_arguments(raw_arguments, "${testCase.adapter ?? "none"}")
    value = ${functionName}(*arguments_list)
    output_value = ${testCase.mode === "mutated-first-argument" ? "arguments_list[0]" : "value"}
    output = trailgrad_adapt_output(arguments_list[0] if output_value is None and "${testCase.adapter ?? "none"}" in ("linked-list-mutated", "tree-output", "tree-mutated-output", "tree-right-chain") else output_value, "${testCase.adapter ?? "none"}")
    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": output}, separators=(",", ":")))
except Exception as error:
    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`
    )
    .join("\n");
  return `import json\n${pythonAdapterHelpers()}\n${code}\n\n${runs}\n`;
}

function operationKind(adapter: TestAdapter | undefined): string {
  return adapter?.startsWith("operations:") ? adapter.slice("operations:".length) : "";
}

function operationClassName(kind: string): string {
  return {
    "browser-history": "BrowserHistory",
    "lru-cache": "LRUCache",
    "min-stack": "MinStack",
    queue: "MyQueue",
    stack: "MyStack",
    "circular-queue": "MyCircularQueue",
    "stock-span": "StockSpanner",
    "time-map": "TimeMap",
    "median-finder": "MedianFinder",
    trie: "Trie",
    "word-dictionary": "WordDictionary"
  }[kind] ?? "Solution";
}

function javascriptOperationHarness(code: string, testCases: CodeTestCase[]): string {
  const runs = testCases.map((testCase, index) => javascriptOperationCase(operationKind(testCase.adapter), testCase.arguments, index)).join("\n");
  return `${code}\n\nfunction trailgradOperationValue(kind, operation, value) { if ((kind === "min-stack" && ["push", "pop"].includes(operation)) || (kind === "lru-cache" && operation === "put") || (["trie", "word-dictionary"].includes(kind) && ["insert", "addWord"].includes(operation)) || (kind === "time-map" && operation === "set")) return null; return value === undefined ? null : value; }\n\n${runs}\n`;
}

function javascriptOperationCase(kind: string, args: unknown[], index: number): string {
  const className = operationClassName(kind);
  const literal = JSON.stringify(args);
  if (kind === "browser-history") return `try { const input = ${literal}; const instance = new ${className}(input[0][0]); const results = [null]; for (const page of input[0].slice(1)) { instance.visit(page); results.push(null); } for (const operation of input.slice(1)) results.push(trailgradOperationValue("${kind}", operation[0], instance[operation[0]](...operation.slice(1)))); console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
  if (kind === "lru-cache" || kind === "circular-queue") return `try { const input = ${literal}; const instance = new ${className}(...input[0]); const results = []; for (const operation of input.slice(1)) results.push(trailgradOperationValue("${kind}", operation[0], instance[operation[0]](...operation.slice(1)))); console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
  if (kind === "stock-span" || kind === "median-finder") return `try { const input = ${literal}; const instance = new ${className}(); const results = []; for (const value of input[0]) ${kind === "stock-span" ? "results.push(instance.next(value))" : "instance.addNum(value)"}; ${kind === "median-finder" ? "results.push(instance.findMedian())" : ""} console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results.length === 1 && "${kind}" === "median-finder" ? results[0] : results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
  return `try { const input = ${literal}; const instance = new ${className}(); const results = []; for (const operation of input) results.push(trailgradOperationValue("${kind}", operation[0], instance[operation[0]](...operation.slice(1)))); console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
}

function pythonOperationHarness(code: string, testCases: CodeTestCase[]): string {
  const runs = testCases.map((testCase, index) => pythonOperationCase(operationKind(testCase.adapter), testCase.arguments, index)).join("\n");
  return `import json\n${code}\n\ndef trailgrad_operation_value(kind, operation, value):\n    if (kind == "min-stack" and operation in ("push", "pop")) or (kind == "lru-cache" and operation == "put") or (kind in ("trie", "word-dictionary") and operation in ("insert", "addWord")) or (kind == "time-map" and operation == "set"): return None\n    return value\n\n${runs}\n`;
}

function pythonOperationCase(kind: string, args: unknown[], index: number): string {
  const className = operationClassName(kind);
  const literal = pythonLiteral(args);
  if (kind === "browser-history") return `try:\n    input_data = ${literal}\n    instance = ${className}(input_data[0][0])\n    results = [None]\n    for page in input_data[0][1:]: instance.visit(page); results.append(None)\n    for operation in input_data[1:]: results.append(trailgrad_operation_value("${kind}", operation[0], getattr(instance, operation[0])(*operation[1:])))\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": results}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
  if (kind === "lru-cache" || kind === "circular-queue") return `try:\n    input_data = ${literal}\n    instance = ${className}(*input_data[0])\n    results = [trailgrad_operation_value("${kind}", operation[0], getattr(instance, operation[0])(*operation[1:])) for operation in input_data[1:]]\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": results}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
  if (kind === "stock-span" || kind === "median-finder") return `try:\n    input_data = ${literal}\n    instance = ${className}()\n    results = [instance.next(value) for value in input_data[0]] if "${kind}" == "stock-span" else [instance.addNum(value) for value in input_data[0]]\n    ${kind === "median-finder" ? "results.append(instance.findMedian())" : ""}\n    output = results[-1] if "${kind}" == "median-finder" else results\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": output}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
  return `try:\n    input_data = ${literal}\n    instance = ${className}()\n    results = [trailgrad_operation_value("${kind}", operation[0], getattr(instance, operation[0])(*operation[1:])) for operation in input_data]\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": results}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
}

function adapterForSlug(slug: string): TestAdapter | undefined {
  const operationAdapters: Record<string, TestAdapter> = {
    "design-browser-history": "operations:browser-history",
    "lru-cache": "operations:lru-cache",
    "min-stack": "operations:min-stack",
    "implement-queue-using-stacks": "operations:queue",
    "implement-stack-using-queues": "operations:stack",
    "design-circular-queue": "operations:circular-queue",
    "online-stock-span": "operations:stock-span",
    "time-based-key-value-store": "operations:time-map",
    "find-median-from-data-stream": "operations:median-finder",
    "implement-trie-prefix-tree": "operations:trie",
    "design-add-and-search-words-data-structure": "operations:word-dictionary"
  };
  if (operationAdapters[slug]) return operationAdapters[slug];
  const linkedListSlugs = new Set([
    "reverse-linked-list", "merge-two-sorted-lists", "remove-nth-node-from-end-of-list",
    "swap-nodes-in-pairs", "odd-even-linked-list", "reverse-linked-list-ii", "rotate-list",
    "sort-list", "reverse-nodes-in-k-group"
  ]);
  const treeOutputSlugs = new Set(["invert-binary-tree"]);
  const treeNodeValueSlugs = new Set(["lowest-common-ancestor-of-a-binary-tree"]);
  const treeTargetValueSlugs = new Set(["all-nodes-distance-k-in-binary-tree"]);
  const treeInputSlugs = new Set([
    "maximum-depth-of-binary-tree", "minimum-depth-of-binary-tree", "same-tree", "symmetric-tree",
    "subtree-of-another-tree", "balanced-binary-tree", "diameter-of-binary-tree", "path-sum",
    "sum-root-to-leaf-numbers", "path-sum-ii", "binary-tree-level-order-traversal",
    "binary-tree-zigzag-level-order-traversal", "binary-tree-right-side-view",
    "populating-next-right-pointers-in-each-node", "validate-binary-search-tree",
    "kth-smallest-element-in-a-bst", "path-sum-iii", "house-robber-iii", "binary-tree-maximum-path-sum",
    "binary-tree-cameras", "count-complete-tree-nodes", "vertical-order-traversal-of-a-binary-tree"
  ]);
  if (linkedListSlugs.has(slug)) return "linked-list";
  if (slug === "reorder-list") return "linked-list-mutated";
  if (slug === "recover-binary-search-tree") return "tree-mutated-output";
  if (slug === "flatten-binary-tree-to-linked-list") return "tree-right-chain";
  if (treeOutputSlugs.has(slug)) return "tree-output";
  if (treeNodeValueSlugs.has(slug)) return "tree-node-value";
  if (treeTargetValueSlugs.has(slug)) return "tree-target-value";
  if (treeInputSlugs.has(slug)) return "tree-input";
  return undefined;
}

function javascriptAdapterHelpers(): string {
  return `
class ListNode { constructor(val, next = null) { this.val = val; this.next = next; } }
class TreeNode { constructor(val, left = null, right = null) { this.val = val; this.left = left; this.right = right; } }
function trailgradBuildList(values) { let head = null; let tail = null; for (const value of values) { const node = new ListNode(value); if (!head) head = node; else tail.next = node; tail = node; } return head; }
function trailgradListToArray(head) { const values = []; const seen = new Set(); let node = head; while (node && !seen.has(node) && values.length < 10000) { seen.add(node); values.push(node.val); node = node.next; } return values; }
function trailgradBuildTree(values) { if (!values.length || values[0] === null) return null; const nodes = values.map(value => value === null ? null : new TreeNode(value)); let child = 1; for (const node of nodes) { if (!node) continue; node.left = nodes[child++] ?? null; node.right = nodes[child++] ?? null; } return nodes[0]; }
function trailgradTreeToArray(root) { if (!root) return []; const values = []; const queue = [root]; while (queue.length) { const node = queue.shift(); if (!node) { values.push(null); continue; } values.push(node.val); queue.push(node.left, node.right); } while (values[values.length - 1] === null) values.pop(); return values; }
function trailgradFindTreeNode(root, value) { if (!root) return null; const queue = [root]; while (queue.length) { const node = queue.shift(); if (node.val === value) return node; if (node.left) queue.push(node.left); if (node.right) queue.push(node.right); } return null; }
function trailgradTreeToRightChain(root) { const values = []; const seen = new Set(); let node = root; while (node && !seen.has(node) && values.length < 10000) { seen.add(node); values.push(node.val); if (node.right) values.push(null); node = node.right; } return values; }
function trailgradAdaptArguments(values, adapter) { if (adapter === "linked-list" || adapter === "linked-list-mutated") return values.map(value => Array.isArray(value) ? trailgradBuildList(value) : value); if (adapter === "tree-node-value" || adapter === "tree-target-value") { const root = trailgradBuildTree(values[0]); return [root, ...values.slice(1).map((value, index) => index === 0 || adapter === "tree-node-value" ? trailgradFindTreeNode(root, value) : value)]; } if (adapter === "tree-input" || adapter === "tree-output" || adapter === "tree-mutated-output" || adapter === "tree-right-chain") return values.map(value => Array.isArray(value) && (value.length === 0 || !Array.isArray(value[0])) ? trailgradBuildTree(value) : value); return values; }
function trailgradAdaptOutput(value, adapter) { if (adapter === "linked-list" || adapter === "linked-list-mutated") return trailgradListToArray(value); if (adapter === "tree-output" || adapter === "tree-mutated-output") return trailgradTreeToArray(value); if (adapter === "tree-right-chain") return trailgradTreeToRightChain(value); if (adapter === "tree-node-value") return value ? value.val : null; return value; }
`;
}

function pythonAdapterHelpers(): string {
  return `
class ListNode:
    def __init__(self, val=0, next=None): self.val, self.next = val, next
class TreeNode:
    def __init__(self, val=0, left=None, right=None): self.val, self.left, self.right = val, left, right
def trailgrad_build_list(values):
    head = tail = None
    for value in values:
        node = ListNode(value)
        if head is None: head = node
        else: tail.next = node
        tail = node
    return head
def trailgrad_list_to_array(head):
    values, seen, node = [], set(), head
    while node is not None and id(node) not in seen and len(values) < 10000:
        seen.add(id(node)); values.append(node.val); node = node.next
    return values
def trailgrad_build_tree(values):
    if not values or values[0] is None: return None
    nodes = [None if value is None else TreeNode(value) for value in values]
    child = 1
    for node in nodes:
        if node is None: continue
        node.left = nodes[child] if child < len(nodes) else None; child += 1
        node.right = nodes[child] if child < len(nodes) else None; child += 1
    return nodes[0]
def trailgrad_tree_to_array(root):
    if root is None: return []
    values, queue = [], [root]
    while queue:
        node = queue.pop(0)
        if node is None: values.append(None); continue
        values.append(node.val); queue.extend([node.left, node.right])
    while values and values[-1] is None: values.pop()
    return values
def trailgrad_tree_to_right_chain(root):
    values, seen, node = [], set(), root
    while node is not None and id(node) not in seen and len(values) < 10000:
        seen.add(id(node)); values.append(node.val)
        if node.right is not None: values.append(None)
        node = node.right
    return values
def trailgrad_find_tree_node(root, value):
    queue = [root] if root is not None else []
    while queue:
        node = queue.pop(0)
        if node.val == value: return node
        if node.left is not None: queue.append(node.left)
        if node.right is not None: queue.append(node.right)
    return None
def trailgrad_adapt_arguments(values, adapter):
    if adapter in ("linked-list", "linked-list-mutated"): return [trailgrad_build_list(value) if isinstance(value, list) else value for value in values]
    if adapter in ("tree-node-value", "tree-target-value"):
        root = trailgrad_build_tree(values[0])
        return [root] + [trailgrad_find_tree_node(root, value) if index == 0 or adapter == "tree-node-value" else value for index, value in enumerate(values[1:])]
    if adapter in ("tree-input", "tree-output", "tree-mutated-output", "tree-right-chain"): return [trailgrad_build_tree(value) if isinstance(value, list) and (not value or not isinstance(value[0], list)) else value for value in values]
    return values
def trailgrad_adapt_output(value, adapter):
    if adapter in ("linked-list", "linked-list-mutated"): return trailgrad_list_to_array(value)
    if adapter in ("tree-output", "tree-mutated-output"): return trailgrad_tree_to_array(value)
    if adapter == "tree-right-chain": return trailgrad_tree_to_right_chain(value)
    if adapter == "tree-node-value": return value.val if value is not None else None
    return value
`;
}

function javaHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const candidateCode = code.replace(/\b(?:public\s+)?class\s+Main\b/, "class CandidateSolution");
  if (candidateCode === code) throw new Error("Java code must contain class Main.");
  const runs = testCases
    .map((testCase, index) => {
      if (testCase.adapter === "tree-right-chain") {
        const root = javaAdapterDeclaration(testCase.arguments[0], index, 0, "tree");
        const argumentsList = testCase.arguments.map((argument, argumentIndex) => javaAdapterReference(testCase, argument, index, argumentIndex)).join(", ");
        return `${root}\n        runTreeMutation(${index}, argument${index}_0, () -> CandidateSolution.${functionName}(${argumentsList}), true);`;
      }
      if ((testCase.adapter === "linked-list-mutated" || testCase.adapter === "tree-mutated-output") && testCase.mode !== "mutated-first-argument") {
        const declarations = testCase.arguments.map((argument, argumentIndex) => javaAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")).filter(Boolean).join("\n        ");
        const argumentsList = testCase.arguments.map((argument, argumentIndex) => javaAdapterReference(testCase, argument, index, argumentIndex)).join(", ");
        return `${declarations}\n        runAdaptedMutation(${index}, argument${index}_0, () -> CandidateSolution.${functionName}(${argumentsList}), "${testCase.adapter}");`;
      }
      if (testCase.adapter && testCase.mode !== "mutated-first-argument") {
        const declarations = testCase.arguments.map((argument, argumentIndex) => javaAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")).filter(Boolean).join("\n        ");
        const argumentsList = testCase.arguments.map((argument, argumentIndex) => javaAdapterReference(testCase, argument, index, argumentIndex)).join(", ");
        const call = `CandidateSolution.${functionName}(${argumentsList})`;
        const output = testCase.adapter === "linked-list" ? `javaListToArray(${call})` : testCase.adapter === "tree-output" ? `javaTreeToArray(${call})` : testCase.adapter === "tree-node-value" ? `javaNodeValue(${call})` : call;
        return `${declarations}\n        runCase(${index}, () -> ${output});`;
      }
      const declarations = testCase.mode === "mutated-first-argument"
        ? testCase.arguments
            .map((argument, argumentIndex) => `${javaType(argument)} argument${index}_${argumentIndex} = ${javaLiteral(argument)};`)
            .join("\n        ")
        : "";
      const argumentsList = testCase.mode === "mutated-first-argument"
        ? testCase.arguments.map((_, argumentIndex) => `argument${index}_${argumentIndex}`).join(", ")
        : testCase.arguments.map(javaLiteral).join(", ");
      if (testCase.mode === "mutated-first-argument") {
        return `${declarations}\n        runMutatingCase(${index}, argument${index}_0, () -> CandidateSolution.${functionName}(${argumentsList}));`;
      }
      return `runCase(${index}, () -> CandidateSolution.${functionName}(${argumentsList}));`;
    })
    .join("\n        ");
  const imports = candidateCode.match(/^(?:import\s+[^;]+;\s*)*/)?.[0] ?? "";
  const candidateBody = candidateCode.slice(imports.length);
  return `${imports}${javaAdapterTypes()}
${candidateBody}

class Main {
    interface CaseRunner { Object run() throws Exception; }

    static void runCase(int index, CaseRunner runner) {
        try {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(runner.run())));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static void runMutatingCase(int index, Object value, Runnable runner) {
        try {
            runner.run();
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(value)));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static void runTreeMutation(int index, TreeNode root, Runnable runner, boolean rightChain) {
        try {
            runner.run();
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(rightChain ? javaTreeRightChain(root) : javaTreeToArray(root))));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static void runAdaptedMutation(int index, Object value, Runnable runner, String adapter) {
        try {
            runner.run(); Object output = adapter.equals("linked-list-mutated") ? javaListToArray((ListNode) value) : javaTreeToArray((TreeNode) value);
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(output)));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static ListNode javaBuildList(int[] values) {
        ListNode head = null, tail = null;
        for (int value : values) { ListNode node = new ListNode(value); if (head == null) head = node; else tail.next = node; tail = node; }
        return head;
    }

    static TreeNode javaBuildTree(Integer[] values) {
        if (values.length == 0 || values[0] == null) return null;
        TreeNode[] nodes = new TreeNode[values.length];
        for (int index = 0; index < values.length; index++) if (values[index] != null) nodes[index] = new TreeNode(values[index]);
        int child = 1;
        for (TreeNode node : nodes) { if (node == null) continue; if (child < nodes.length) node.left = nodes[child++]; if (child < nodes.length) node.right = nodes[child++]; }
        return nodes[0];
    }

    static TreeNode javaFindTreeNode(TreeNode root, int value) {
        if (root == null) return null;
        java.util.ArrayDeque<TreeNode> queue = new java.util.ArrayDeque<>(); queue.add(root);
        while (!queue.isEmpty()) { TreeNode node = queue.remove(); if (node.val == value) return node; if (node.left != null) queue.add(node.left); if (node.right != null) queue.add(node.right); }
        return null;
    }

    static int[] javaListToArray(ListNode head) {
        java.util.ArrayList<Integer> values = new java.util.ArrayList<>(); java.util.HashSet<ListNode> seen = new java.util.HashSet<>();
        while (head != null && !seen.contains(head) && values.size() < 10000) { seen.add(head); values.add(head.val); head = head.next; }
        int[] output = new int[values.size()]; for (int index = 0; index < output.length; index++) output[index] = values.get(index); return output;
    }

    static Object javaNodeValue(TreeNode node) { return node == null ? null : node.val; }

    static java.util.ArrayList<Object> javaTreeToArray(TreeNode root) {
        java.util.ArrayList<Object> values = new java.util.ArrayList<>(); if (root == null) return values;
        java.util.ArrayList<TreeNode> queue = new java.util.ArrayList<>(); queue.add(root); for (int index = 0; index < queue.size(); index++) { TreeNode node = queue.get(index); if (node == null) { values.add(null); continue; } values.add(node.val); queue.add(node.left); queue.add(node.right); }
        while (!values.isEmpty() && values.get(values.size() - 1) == null) values.remove(values.size() - 1); return values;
    }

    static java.util.ArrayList<Object> javaTreeRightChain(TreeNode root) {
        java.util.ArrayList<Object> values = new java.util.ArrayList<>(); java.util.HashSet<TreeNode> seen = new java.util.HashSet<>();
        while (root != null && !seen.contains(root) && values.size() < 10000) { seen.add(root); values.add(root.val); if (root.right != null) values.add(null); root = root.right; }
        return values;
    }

    static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Character || value instanceof String) {
            String slash = String.valueOf((char) 92);
            String quote = String.valueOf((char) 34);
            return quote + value.toString().replace(slash, slash + slash).replace(quote, slash + quote) + quote;
        }
        if (value.getClass().isArray()) {
            StringBuilder output = new StringBuilder("[");
            int length = java.lang.reflect.Array.getLength(value);
            for (int index = 0; index < length; index++) {
                if (index > 0) output.append(',');
                output.append(json(java.lang.reflect.Array.get(value, index)));
            }
            return output.append(']').toString();
        }
        if (value instanceof Iterable<?>) {
            StringBuilder output = new StringBuilder("[");
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) output.append(',');
                output.append(json(item));
                first = false;
            }
            return output.append(']').toString();
        }
        return json(value.toString());
    }

    public static void main(String[] args) {
        ${runs}
    }
}
`;
}

function javaAdapterTypes(): string {
  return `class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }
class TreeNode { int val; TreeNode left; TreeNode right; TreeNode(int val) { this.val = val; } }
`;
}

function javaAdapterDeclaration(value: unknown, caseIndex: number, argumentIndex: number, adapter: TestAdapter | "tree"): string {
  if (!Array.isArray(value)) return "";
  const name = `argument${caseIndex}_${argumentIndex}`;
  if (adapter === "linked-list" || adapter === "linked-list-mutated") return `ListNode ${name} = javaBuildList(${javaLiteral(value)});`;
  if (adapter === "tree" || adapter === "tree-input" || adapter === "tree-output" || adapter === "tree-right-chain" || adapter === "tree-node-value" || adapter === "tree-target-value") return `TreeNode ${name} = javaBuildTree(${javaTreeLiteral(value)});`;
  return `${javaType(value)} ${name} = ${javaLiteral(value)};`;
}

function javaAdapterReference(testCase: CodeTestCase, value: unknown, caseIndex: number, argumentIndex: number): string {
  if (testCase.adapter === "tree-node-value" && argumentIndex > 0) return `javaFindTreeNode(argument${caseIndex}_0, ${javaLiteral(value)})`;
  if (testCase.adapter === "tree-target-value" && argumentIndex === 1) return `javaFindTreeNode(argument${caseIndex}_0, ${javaLiteral(value)})`;
  if (Array.isArray(value) && testCase.adapter) return `argument${caseIndex}_${argumentIndex}`;
  return javaLiteral(value);
}

function javaTreeLiteral(value: unknown[]): string {
  return `new Integer[]{${value.map((item) => item === null ? "null" : javaLiteral(item)).join(", ")}}`;
}

function cppHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const candidateCode = code.replace(/\bint\s+main\s*\([^)]*\)/, "int trailgradCandidateMain()");
  const runs = testCases
    .map((testCase, index) => {
      if (testCase.adapter === "tree-right-chain") {
        const declaration = cppAdapterDeclaration(testCase.arguments[0], index, 0, "tree-right-chain");
        return `${declaration}\n    runTreeMutation(${index}, argument${index}_0, [&]() { ${functionName}(argument${index}_0); }, true);`;
      }
      if ((testCase.adapter === "linked-list-mutated" || testCase.adapter === "tree-mutated-output") && testCase.mode !== "mutated-first-argument") {
        const declarations = testCase.arguments.map((argument, argumentIndex) => cppAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")).filter(Boolean).join("\n    ");
        const argumentsList = testCase.arguments.map((argument, argumentIndex) => cppAdapterReference(testCase, argument, index, argumentIndex)).join(", ");
        return `${declarations}\n    runAdaptedMutation(${index}, argument${index}_0, [&]() { ${functionName}(${argumentsList}); }, "${testCase.adapter}");`;
      }
      if (testCase.adapter && testCase.mode !== "mutated-first-argument") {
        const declarations = testCase.arguments.map((argument, argumentIndex) => cppAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")).filter(Boolean).join("\n    ");
        const argumentsList = testCase.arguments.map((argument, argumentIndex) => cppAdapterReference(testCase, argument, index, argumentIndex)).join(", ");
        const call = `${functionName}(${argumentsList})`;
        const output = testCase.adapter === "linked-list" ? `cppListToVector(${call})` : testCase.adapter === "tree-output" ? `cppTreeToVector(${call})` : testCase.adapter === "tree-node-value" ? `cppNodeValue(${call})` : call;
        return `${declarations}\n    runCase(${index}, [&]() { return ${output}; });`;
      }
      const declarations = testCase.arguments
        .map((argument, argumentIndex) => `${cppType(argument)} argument${index}_${argumentIndex} = ${cppLiteral(argument)};`)
        .join("\n    ");
      const argumentsList = testCase.arguments.map((_, argumentIndex) => `argument${index}_${argumentIndex}`).join(", ");
      const runner = testCase.mode === "mutated-first-argument"
        ? `runMutatingCase(${index}, argument${index}_0, [&]() { ${functionName}(${argumentsList}); });`
        : `runCase(${index}, [&]() { return ${functionName}(${argumentsList}); });`;
      return `${declarations}\n    ${runner}`;
    })
    .join("\n    ");
  const includes = candidateCode.match(/^(?:#include\s+[^\n]+\n|using\s+namespace\s+[^;]+;\s*)*/)?.[0] ?? "";
  const candidateBody = candidateCode.slice(includes.length);
  return `${includes}${cppAdapterTypes()}
${candidateBody}

ListNode* cppBuildList(const vector<int>& values) { ListNode* head = nullptr; ListNode* tail = nullptr; for (int value : values) { auto* node = new ListNode(value); if (!head) head = node; else tail->next = node; tail = node; } return head; }
TreeNode* cppBuildTree(const vector<optional<int>>& values) { if (values.empty() || !values[0].has_value()) return nullptr; vector<TreeNode*> nodes(values.size(), nullptr); for (size_t index = 0; index < values.size(); index++) if (values[index].has_value()) nodes[index] = new TreeNode(*values[index]); size_t child = 1; for (auto* node : nodes) { if (!node) continue; if (child < nodes.size()) node->left = nodes[child++]; if (child < nodes.size()) node->right = nodes[child++]; } return nodes[0]; }
TreeNode* cppFindTreeNode(TreeNode* root, int value) { if (!root) return nullptr; queue<TreeNode*> nodes; nodes.push(root); while (!nodes.empty()) { auto* node = nodes.front(); nodes.pop(); if (node->val == value) return node; if (node->left) nodes.push(node->left); if (node->right) nodes.push(node->right); } return nullptr; }
vector<int> cppListToVector(ListNode* head) { vector<int> values; set<ListNode*> seen; while (head && !seen.count(head) && values.size() < 10000) { seen.insert(head); values.push_back(head->val); head = head->next; } return values; }
vector<optional<int>> cppTreeToVector(TreeNode* root) { vector<optional<int>> values; if (!root) return values; queue<TreeNode*> nodes; nodes.push(root); while (!nodes.empty()) { auto* node = nodes.front(); nodes.pop(); if (!node) { values.push_back(nullopt); continue; } values.push_back(node->val); nodes.push(node->left); nodes.push(node->right); } while (!values.empty() && !values.back().has_value()) values.pop_back(); return values; }
vector<optional<int>> cppTreeRightChain(TreeNode* root) { vector<optional<int>> values; set<TreeNode*> seen; while (root && !seen.count(root) && values.size() < 10000) { seen.insert(root); values.push_back(root->val); if (root->right) values.push_back(nullopt); root = root->right; } return values; }
int cppNodeValue(TreeNode* node) { return node ? node->val : 0; }

string trailgradJson(const string& value) {
    string output(1, char(34));
    for (char character : value) {
        if (character == char(92) || character == char(34)) output += char(92);
        output += character;
    }
    return output + char(34);
}
string trailgradJson(const char* value) { return trailgradJson(string(value)); }
string trailgradJson(bool value) { return value ? "true" : "false"; }
template <typename T, enable_if_t<is_arithmetic<T>::value && !is_same<T, bool>::value, int> = 0>
string trailgradJson(T value) { return to_string(value); }
string trailgradJson(const optional<int>& value);
template <typename T>
string trailgradJson(const vector<T>& values) {
    string output = "[";
    for (size_t index = 0; index < values.size(); index++) {
        if (index > 0) output += ',';
        output += trailgradJson(values[index]);
    }
    return output + "]";
}
string trailgradJson(const optional<int>& value) { return value.has_value() ? to_string(*value) : "null"; }
template <typename Runner>
void runCase(int index, Runner runner) {
    try {
        auto value = runner();
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":" << trailgradJson(value) << "}" << endl;
    } catch (const exception& error) {
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl;
    }
}
template <typename Value, typename Runner>
void runMutatingCase(int index, Value& value, Runner runner) {
    try {
        runner();
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":" << trailgradJson(value) << "}" << endl;
    } catch (const exception& error) {
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl;
    }
}
template <typename Runner>
void runTreeMutation(int index, TreeNode* root, Runner runner, bool rightChain) {
    try { runner(); auto value = rightChain ? cppTreeRightChain(root) : cppTreeToVector(root); cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":" << trailgradJson(value) << "}" << endl; }
    catch (const exception& error) { cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl; }
}
template <typename Value, typename Runner>
void runAdaptedMutation(int index, Value* value, Runner runner, const string& adapter) {
    try { runner(); cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":"; if (adapter == "linked-list-mutated") cout << trailgradJson(cppListToVector(reinterpret_cast<ListNode*>(value))); else cout << trailgradJson(cppTreeToVector(reinterpret_cast<TreeNode*>(value))); cout << "}" << endl; }
    catch (const exception& error) { cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl; }
}
int main() {
    ${runs}
    return 0;
}
`;
}

function cppAdapterTypes(): string {
  return `struct ListNode { int val; ListNode* next; ListNode(int value) : val(value), next(nullptr) {} };
struct TreeNode { int val; TreeNode* left; TreeNode* right; TreeNode(int value) : val(value), left(nullptr), right(nullptr) {} };
`;
}

function cppAdapterDeclaration(value: unknown, caseIndex: number, argumentIndex: number, adapter: TestAdapter): string {
  if (!Array.isArray(value)) return "";
  const name = `argument${caseIndex}_${argumentIndex}`;
  if (adapter === "linked-list" || adapter === "linked-list-mutated") return `ListNode* ${name} = cppBuildList(${cppVectorLiteral(value)});`;
  return `TreeNode* ${name} = cppBuildTree(${cppOptionalVectorLiteral(value)});`;
}

function cppAdapterReference(testCase: CodeTestCase, value: unknown, caseIndex: number, argumentIndex: number): string {
  if (testCase.adapter === "tree-node-value" && argumentIndex > 0) return `cppFindTreeNode(argument${caseIndex}_0, ${cppLiteral(value)})`;
  if (testCase.adapter === "tree-target-value" && argumentIndex === 1) return `cppFindTreeNode(argument${caseIndex}_0, ${cppLiteral(value)})`;
  if (Array.isArray(value) && testCase.adapter) return `argument${caseIndex}_${argumentIndex}`;
  return cppLiteral(value);
}

function cppVectorLiteral(value: unknown[]): string {
  return `{${value.map((item) => cppLiteral(item)).join(", ")}}`;
}

function cppOptionalVectorLiteral(value: unknown[]): string {
  return `{${value.map((item) => item === null ? "nullopt" : `optional<int>(${cppLiteral(item)})`).join(", ")}}`;
}

function jsLiteral(value: unknown): string {
  return JSON.stringify(value);
}

function pythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(", ")}]`;
  return String(value);
}

function javaLiteral(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : `${value}d`;
  if (Array.isArray(value)) {
    const type = javaArrayType(value);
    return `new ${type}{${value.map(javaLiteral).join(", ")}}`;
  }
  throw new Error("Unsupported Java test value.");
}

function javaArrayType(value: unknown[]): string {
  const sample = value.find((item) => item !== null);
  if (Array.isArray(sample)) return `${javaArrayType(sample)}[]`;
  if (typeof sample === "string") return "String[]";
  if (typeof sample === "boolean") return "boolean[]";
  if (typeof sample === "number" && !Number.isInteger(sample)) return "double[]";
  return "int[]";
}

function javaType(value: unknown): string {
  if (Array.isArray(value)) return javaArrayType(value).replace(/\[\]$/, "") + "[]";
  if (typeof value === "string") return "String";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "double";
  return "Object";
}

function cppLiteral(value: unknown): string {
  if (value === null) throw new Error("Null test values are not supported in C++ yet.");
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `{${value.map(cppLiteral).join(", ")}}`;
  throw new Error("Unsupported C++ test value.");
}

function cppType(value: unknown): string {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "double";
  if (Array.isArray(value)) {
    const sample = value.find((item) => item !== null);
    return `vector<${sample === undefined ? "int" : cppType(sample)}>`;
  }
  throw new Error("Unsupported C++ test value.");
}

function equivalent(
  actual: unknown,
  expected: unknown,
  comparison: "exact" | "unordered" | "unordered-nested" | "one-of" = "exact"
): boolean {
  if (comparison === "one-of" && Array.isArray(expected)) {
    return expected.some((candidate) => JSON.stringify(actual) === JSON.stringify(candidate));
  }
  if (comparison === "unordered" && Array.isArray(actual) && Array.isArray(expected)) {
    return JSON.stringify(actual.map((item) => JSON.stringify(item)).sort()) === JSON.stringify(expected.map((item) => JSON.stringify(item)).sort());
  }
  if (comparison === "unordered-nested" && Array.isArray(actual) && Array.isArray(expected)) {
    return canonicalNested(actual) === canonicalNested(expected);
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function canonicalNested(value: unknown[]): string {
  return JSON.stringify(value.map((item) => JSON.stringify(item)).sort());
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "undefined" : serialized;
}
