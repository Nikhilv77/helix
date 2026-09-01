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
};

/** Monaco's ids differ from the language names carried on an answer key. */
function monacoLanguage(language: string): string {
  switch (language) {
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
    case "sql":
      return "sql";
    default:
      return "plaintext";
  }
}

export function PracticeCodeViewer({
  code,
  language,
  highlightLine = null,
  maxLines = 18
}: PracticeCodeViewerProps) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const decorationsRef = useRef<DecorationsCollection | null>(null);
  const [ready, setReady] = useState(false);

  const lineCount = code.split("\n").length;
  // 21px per line plus a little breathing room; Monaco needs an explicit height.
  const height = Math.min(lineCount, maxLines) * 21 + 24;

  const onMount: OnMount = (instance) => {
    editorRef.current = instance;
    decorationsRef.current = instance.createDecorationsCollection();
    setReady(true);
  };

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
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0f10] py-2">
      <Editor
        height={`${height}px`}
        language={monacoLanguage(language)}
        value={code}
        theme="trailgrad-practice"
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
