"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

// `monaco-editor` is not a direct dependency — @monaco-editor/react carries the
// types, so the instance is derived from OnMount the way dsa-code-editor does.
type MonacoEditor = Parameters<OnMount>[0];
type DecorationsCollection = ReturnType<MonacoEditor["createDecorationsCollection"]>;

/**
 * Read-only Monaco for the code a Practice question hands the candidate.
 *
 * The panels previously rendered a `<pre>` with a hand-built line-number
 * gutter. Monaco gives syntax highlighting, real line numbers and — the reason
 * it is worth the weight here — a decoration API, so revealing a planted defect
 * can highlight its line the way an editor would rather than tinting a table
 * row.
 *
 * Reuses `trailgrad-modern`, the theme the DSA editor already defines, so code
 * looks the same everywhere in the product.
 */

export interface PracticeCodeViewerProps {
  code: string;
  language: string;
  /** 1-indexed line to highlight, once an attempt has been submitted. */
  highlightLine?: number | null;
  /** Roughly how many lines to show before scrolling. */
  maxLines?: number;
  ariaLabel?: string;
  /** Removes duplicate chrome when the viewer already sits inside an editor panel. */
  embedded?: boolean;
}

const registerTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("trailgrad-practice", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "667080", fontStyle: "italic" },
      { token: "keyword", foreground: "B69BF8" },
      { token: "string", foreground: "A8C99B" },
      { token: "number", foreground: "E5B478" },
      { token: "type", foreground: "81B8D8" },
      { token: "function", foreground: "C8D4F0" },
      { token: "variable", foreground: "D7D9DE" },
      { token: "operator", foreground: "9DA8BA" },
      { token: "delimiter", foreground: "8D96A5" }
    ],
    colors: {
      // Matches the panel it sits in rather than the DSA editor's darker ground.
      "editor.background": "#0d0f10",
      "editor.foreground": "#D7D9DE",
      "editorLineNumber.foreground": "#3A404A",
      "editorLineNumber.activeForeground": "#8A93A0",
      "editorGutter.background": "#0d0f10",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editorOverviewRuler.border": "#00000000"
    }
  });
  monaco.editor.defineTheme("trailgrad-practice-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748B", fontStyle: "italic" },
      { token: "keyword", foreground: "7C3AED" },
      { token: "string", foreground: "15803D" },
      { token: "number", foreground: "B45309" },
      { token: "type", foreground: "0369A1" },
      { token: "function", foreground: "1D4ED8" },
      { token: "variable", foreground: "1F2937" },
      { token: "operator", foreground: "475569" },
      { token: "delimiter", foreground: "64748B" }
    ],
    colors: {
      "editor.background": "#F8FAFC",
      "editor.foreground": "#1F2937",
      "editorLineNumber.foreground": "#94A3B8",
      "editorLineNumber.activeForeground": "#475569",
      "editorGutter.background": "#F8FAFC",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editorOverviewRuler.border": "#00000000"
    }
  });
};

function currentThemeIsLight() {
  const root = document.documentElement;
  return root.classList.contains("light") || root.dataset.theme === "light";
}

/** Monaco's ids differ from the language names carried on an answer key. */
function monacoLanguage(language: string): string {
  switch (language.trim().toLowerCase()) {
    case "js":
    case "javascript":
      return "javascript";
    case "ts":
    case "typescript":
      return "typescript";
    case "py":
    case "python":
      return "python";
    case "cpp":
      return "cpp";
    case "java":
      return "java";
    case "go":
    case "golang":
      return "go";
    case "csharp":
    case "c#":
      return "csharp";
    case "ruby":
      return "ruby";
    case "php":
      return "php";
    case "sql":
      return "sql";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "shell":
    case "bash":
    case "sh":
      return "shell";
    default:
      return "plaintext";
  }
}

export function PracticeCodeViewer({
  code,
  language,
  highlightLine = null,
  maxLines = 18,
  ariaLabel = "Code example, read only",
  embedded = false
}: PracticeCodeViewerProps) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const decorationsRef = useRef<DecorationsCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [lightTheme, setLightTheme] = useState(
    () => typeof document !== "undefined" && currentThemeIsLight()
  );

  const lineCount = code.split("\n").length;
  // 21px per line plus a little breathing room; Monaco needs an explicit height.
  const height = Math.min(lineCount, maxLines) * 21 + 24;

  const onMount: OnMount = (instance) => {
    editorRef.current = instance;
    decorationsRef.current = instance.createDecorationsCollection();
    setReady(true);
  };

  useEffect(() => {
    const syncTheme = () => setLightTheme(currentThemeIsLight());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const collection = decorationsRef.current;
    if (!ready || !collection) return;

    if (highlightLine === null) {
      collection.clear();
      return;
    }

    collection.set([
      {
        range: {
          startLineNumber: highlightLine,
          startColumn: 1,
          endLineNumber: highlightLine,
          endColumn: 1
        },
        options: {
          isWholeLine: true,
          className: "practice-flaw-line",
          linesDecorationsClassName: "practice-flaw-gutter"
        }
      }
    ]);
    editorRef.current?.revealLineInCenterIfOutsideViewport(highlightLine);
  }, [highlightLine, ready]);

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-readonly="true"
      className={`practice-code-viewer overflow-hidden bg-[#0d0f10] py-2 ${embedded ? "" : "rounded-xl border border-white/[0.08]"}`}
    >
      <Editor
        height={`${height}px`}
        language={monacoLanguage(language)}
        value={code}
        theme={lightTheme ? "trailgrad-practice-light" : "trailgrad-practice"}
        beforeMount={registerTheme}
        onMount={onMount}
        loading={
          <span className="px-4 py-3 font-mono text-[12.5px] text-cream/30">Loading code…</span>
        }
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          glyphMargin: false,
          folding: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          scrollbar: { vertical: "auto", horizontal: "auto", verticalScrollbarSize: 8 },
          fontSize: 13,
          lineHeight: 21,
          fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: { top: 8, bottom: 8 },
          contextmenu: false,
          // A read-only snippet should not offer to complete anything.
          quickSuggestions: false,
          occurrencesHighlight: "off",
          selectionHighlight: false,
          matchBrackets: "near",
          guides: { indentation: false }
        }}
      />
    </div>
  );
}
