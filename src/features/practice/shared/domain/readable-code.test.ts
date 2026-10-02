import { describe, expect, it } from "vitest";
import { readableCode } from "./readable-code";

describe("readableCode", () => {
  it("lays out one-line code one statement per line", () => {
    expect(
      readableCode(
        "export function createCounter(limit) { const state = { value: 0 }; return { state, increment() { state.value += 1; return state.value; }, dispose() {} }; }"
      )
    ).toBe(
      [
        "export function createCounter(limit) {",
        "  const state = {",
        "    value: 0",
        "  };",
        "  return {",
        "    state,",
        "    increment() {",
        "      state.value += 1;",
        "      return state.value;",
        "    },",
        "    dispose() {}",
        "  };",
        "}"
      ].join("\n")
    );
  });

  it("keeps a for header and string contents intact", () => {
    expect(
      readableCode(
        'function sum(xs) { let t = 0; for (let i = 0; i < xs.length; i++) { t += xs[i]; } return "a;b{c}"; }'
      )
    ).toBe(
      [
        "function sum(xs) {",
        "  let t = 0;",
        "  for (let i = 0; i < xs.length; i++) {",
        "    t += xs[i];",
        "  }",
        '  return "a;b{c}";',
        "}"
      ].join("\n")
    );
  });

  it("leaves multi-line, short, and brace-free code unchanged", () => {
    const multiLine = "function a() {\n  return 1;\n}";
    expect(readableCode(multiLine)).toBe(multiLine);
    expect(readableCode("const a = { b: 1 };")).toBe("const a = { b: 1 };");
    const python = "def total(values): return sum(value for value in values if value is not None)";
    expect(readableCode(python)).toBe(python);
  });
});
