"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

export type DsaEditorLanguage = "python" | "javascript" | "cpp" | "java";

export interface DsaEditorSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

const registerTrailgradTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("trailgrad-modern", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "667080", fontStyle: "italic" },
      { token: "keyword", foreground: "B69BF8" },
      { token: "keyword.control", foreground: "B69BF8" },
      { token: "storage", foreground: "B69BF8" },
      { token: "string", foreground: "A8C99B" },
      { token: "string.escape", foreground: "E5C07B" },
      { token: "number", foreground: "E5B478" },
      { token: "type", foreground: "81B8D8" },
      { token: "type.identifier", foreground: "81B8D8" },
      { token: "identifier.function", foreground: "C8D4F0" },
      { token: "function", foreground: "C8D4F0" },
      { token: "variable", foreground: "D7D9DE" },
      { token: "constant", foreground: "E5B478" },
      { token: "annotation", foreground: "D19A66" },
      { token: "operator", foreground: "9DA8BA" },
      { token: "delimiter", foreground: "8D96A5" },
      { token: "delimiter.bracket", foreground: "B3BAC5" }
    ],
    colors: {
      "editor.background": "#0b0d10",
      "editor.foreground": "#D7D9DE",
      "editorLineNumber.foreground": "#414752",
      "editorLineNumber.activeForeground": "#AEB6C2",
      "editorCursor.foreground": "#C8B1FF",
      "editor.selectionBackground": "#725AA84D",
      "editor.selectionHighlightBackground": "#725AA826",
      "editor.inactiveSelectionBackground": "#4D435E40",
      "editor.lineHighlightBackground": "#12161B",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#1D2229",
      "editorIndentGuide.activeBackground1": "#3D4652",
      "editorBracketHighlight.foreground1": "#B69BF8",
      "editorBracketHighlight.foreground2": "#81B8D8",
      "editorBracketHighlight.foreground3": "#E5B478",
      "editorBracketHighlight.foreground4": "#A8C99B",
      "editorBracketHighlight.unexpectedBracket.foreground": "#FF7B86",
      "editorGutter.background": "#0b0d10",
      "editor.findMatchBackground": "#B69BF84D",
      "editor.findMatchHighlightBackground": "#B69BF826",
      "editor.hoverHighlightBackground": "#FFFFFF0A",
      "editorWidget.background": "#15181D",
      "editorWidget.border": "#292E36",
      "editorHoverWidget.background": "#15181D",
      "editorHoverWidget.border": "#292E36",
      "editorSuggestWidget.background": "#15181D",
      "editorSuggestWidget.border": "#292E36",
      "editorSuggestWidget.selectedBackground": "#252A33",
      "editorSuggestWidget.highlightForeground": "#B69BF8",
      "input.background": "#101318",
      "input.border": "#292E36",
      "dropdown.background": "#15181D",
      "dropdown.border": "#292E36",
      "scrollbarSlider.background": "#7279862E",
      "scrollbarSlider.hoverBackground": "#89919F4A",
      "scrollbarSlider.activeBackground": "#A0A8B85C"
    }
  });
  monaco.editor.defineTheme("trailgrad-modern-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748B", fontStyle: "italic" },
      { token: "keyword", foreground: "7C3AED" },
      { token: "keyword.control", foreground: "7C3AED" },
      { token: "string", foreground: "047857" },
      { token: "number", foreground: "B45309" },
      { token: "type", foreground: "0369A1" },
      { token: "identifier.function", foreground: "1E3A8A" },
      { token: "function", foreground: "1E3A8A" },
      { token: "variable", foreground: "1F2937" }
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#1F2937",
      "editorLineNumber.foreground": "#94A3B8",
      "editorLineNumber.activeForeground": "#475569",
      "editorCursor.foreground": "#7C3AED",
      "editor.selectionBackground": "#DDD6FE99",
      "editor.lineHighlightBackground": "#F8FAFC",
      "editorIndentGuide.background1": "#E2E8F0",
      "editorIndentGuide.activeBackground1": "#CBD5E1",
      "editorGutter.background": "#FFFFFF",
      "editorWidget.background": "#FFFFFF",
      "editorWidget.border": "#CBD5E1",
      "editorHoverWidget.background": "#FFFFFF",
      "editorHoverWidget.border": "#CBD5E1",
      "editorSuggestWidget.background": "#FFFFFF",
      "editorSuggestWidget.border": "#CBD5E1",
      "editorSuggestWidget.selectedBackground": "#F1F5F9",
      "input.background": "#FFFFFF",
      "input.border": "#CBD5E1",
      "dropdown.background": "#FFFFFF",
      "dropdown.border": "#CBD5E1"
    }
  });
};

export function DsaCodeEditor({
  language,
  syntaxLanguage,
  value,
  onChange,
  onRun,
  onSelectionChange,
  readOnly = false,
  autoFocus = true,
  selection = null,
  ariaLabel,
  wordWrap = "off"
}: {
  language: DsaEditorLanguage;
  /** Monaco language id when display syntax differs from the execution language. */
  syntaxLanguage?: string;
  value: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
  onSelectionChange?: (selection: DsaEditorSelection) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  selection?: DsaEditorSelection | null;
  ariaLabel?: string;
  wordWrap?: "on" | "off";
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const [lightTheme, setLightTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setLightTheme(root.classList.contains("light"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    monacoRef.current?.editor.setTheme(lightTheme ? "trailgrad-modern-light" : "trailgrad-modern");
  }, [lightTheme]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !selection) return;
    editor.setSelection(selection);
    editor.revealRangeInCenterIfOutsideViewport(selection);
  }, [selection]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.setTheme(
      document.documentElement.classList.contains("light")
        ? "trailgrad-modern-light"
        : "trailgrad-modern"
    );
    if (!readOnly && onRun) {
      editor.addAction({
        id: "trailgrad-run-code",
        label: "Run code",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: onRun
      });
    }
    if (selection) editor.setSelection(selection);
    if (onSelectionChange) {
      const publishSelection = () => {
        const selection = editor.getSelection();
        if (!selection) return;
        onSelectionChange({
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn
        });
      };
      publishSelection();
      editor.onDidChangeCursorSelection((event) =>
        onSelectionChange({
          startLineNumber: event.selection.startLineNumber,
          startColumn: event.selection.startColumn,
          endLineNumber: event.selection.endLineNumber,
          endColumn: event.selection.endColumn
        })
      );
    }
    if (!readOnly && autoFocus) editor.focus();
  };

  return (
    <Editor
      height="100%"
      language={syntaxLanguage ?? language}
      value={value}
      onChange={(next) => {
        if (!readOnly) onChange?.(next ?? "");
      }}
      beforeMount={registerTrailgradTheme}
      onMount={handleMount}
      theme="trailgrad-modern"
      loading={
        <div
          role="status"
          className="flex h-full w-full items-center justify-center bg-[#0b0d10] text-sm text-cream/45"
        >
          Loading code editor…
        </div>
      }
      options={{
        ariaLabel: ariaLabel ?? (readOnly ? "Code editor, read only" : "Code editor"),
        automaticLayout: true,
        readOnly,
        domReadOnly: readOnly,
        fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13.5,
        lineHeight: 23,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 20 },
        renderLineHighlight: readOnly ? "all" : "line",
        renderLineHighlightOnlyWhenFocus: false,
        roundedSelection: false,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        wordWrap,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        bracketPairColorization: { enabled: true },
        matchBrackets: "never",
        guides: {
          bracketPairs: false,
          bracketPairsHorizontal: false,
          highlightActiveBracketPair: false,
          indentation: true,
          highlightActiveIndentation: true
        },
        stickyScroll: { enabled: false },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          useShadows: false
        },
        suggest: readOnly ? undefined : { showMethods: true, showFunctions: true },
        contextmenu: !readOnly
      }}
    />
  );
}
