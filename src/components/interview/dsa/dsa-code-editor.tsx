"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useRef } from "react";

export type DsaEditorLanguage = "python" | "javascript" | "cpp" | "java";

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
};

export function DsaCodeEditor({
  language,
  value,
  onChange,
  onRun
}: {
  language: DsaEditorLanguage;
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.setTheme("trailgrad-modern");
    editor.addAction({
      id: "trailgrad-run-code",
      label: "Run code",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: onRun
    });
    editor.focus();
  };

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={(next) => onChange(next ?? "")}
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
        automaticLayout: true,
        fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13.5,
        lineHeight: 23,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 20 },
        renderLineHighlight: "line",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        wordWrap: "off",
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
        suggest: { showMethods: true, showFunctions: true }
      }}
    />
  );
}
