"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";
import type { ArchitectureDiagram } from "@/lib/types";
import { ErrorState } from "./ui/error-state";

interface MermaidDiagramProps {
  diagram: ArchitectureDiagram | null;
  compact?: boolean;
}

function isSafeFlowchart(mermaidSource: string): boolean {
  const normalized = mermaidSource.trim().toLowerCase();
  const unsafePatterns = [
    "%%{init",
    "click ",
    "href ",
    "<script",
    "javascript:",
    "classdef ",
    "style "
  ];
  return (
    normalized.startsWith("flowchart td") &&
    !unsafePatterns.some((pattern) => normalized.includes(pattern))
  );
}

export function MermaidDiagram({ diagram, compact = false }: MermaidDiagramProps) {
  const id = useId().replace(/:/g, "");
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      setError(null);
      setSrcDoc(null);

      if (!diagram) return;

      if (!isSafeFlowchart(diagram.mermaid)) {
        setError("The stored diagram is not a supported safe Mermaid flowchart.");
        return;
      }

      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            background: "#07080c",
            mainBkg: "#121622",
            primaryColor: "#151a26",
            primaryTextColor: "#f6f7fb",
            primaryBorderColor: "#7dd3fc",
            secondaryColor: "#111827",
            tertiaryColor: "#0f172a",
            lineColor: "#86efac",
            clusterBkg: "#0f141f",
            clusterBorder: "#334155",
            edgeLabelBackground: "#111827"
          }
        });
        const result = await mermaid.render(`diagram-${id}`, diagram.mermaid);

        if (active) {
          setSrcDoc(
            `<html><body style="margin:0;display:flex;justify-content:center;background:#07080c;">${result.svg}</body></html>`
          );
        }
      } catch {
        if (active) {
          setError("Mermaid could not render this diagram.");
        }
      }
    }

    void renderDiagram();

    return () => {
      active = false;
    };
  }, [diagram, id]);

  if (!diagram) {
    return (
      <p className="rounded-md border border-line bg-white/5 p-4 text-sm text-muted">
        The architecture diagram has not been generated yet.
      </p>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="space-y-4">
      <iframe
        title="Mermaid architecture diagram"
        sandbox=""
        srcDoc={srcDoc ?? "<html><body></body></html>"}
        className={[
          "w-full rounded-md border border-line bg-[#07080c]",
          compact ? "h-[520px]" : "h-[460px]"
        ].join(" ")}
      />
      {!compact ? (
        <details className="rounded-md border border-line bg-white/5 p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Mermaid source</summary>
          <pre className="mt-3 overflow-x-auto text-xs leading-5 text-slate-300">
            {diagram.mermaid}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
