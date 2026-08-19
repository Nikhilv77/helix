"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useRef } from "react";

export type DsaEditorLanguage = "python" | "javascript" | "cpp" | "java";

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
    monaco.editor.defineTheme("trailgrad-code", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8797c2", fontStyle: "italic" },
        { token: "keyword", foreground: "f4d58b" },
        { token: "string", foreground: "a9f0d0" },
        { token: "number", foreground: "e8b4ff" },
        { token: "type", foreground: "8fc7ff" }
      ],
      colors: {
        "editor.background": "#172f78",
        "editor.foreground": "#f2ecdd",
        "editorLineNumber.foreground": "#6680c5",
        "editorLineNumber.activeForeground": "#f2ecdd",
        "editorCursor.foreground": "#f4d58b",
        "editor.selectionBackground": "#526fb866",
        "editor.lineHighlightBackground": "#25458f",
        "editorIndentGuide.background1": "#2c4b91",
        "editorIndentGuide.activeBackground1": "#5b76b8"
      }
    });
    monaco.editor.setTheme("trailgrad-code");
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
      onMount={handleMount}
      theme="trailgrad-code"
      options={{
        automaticLayout: true,
        fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 14,
        lineHeight: 24,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 20 },
        renderLineHighlight: "line",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        wordWrap: "off",
        cursorBlinking: "smooth",
        suggest: { showMethods: true, showFunctions: true }
      }}
    />
  );
}
