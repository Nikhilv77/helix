import { Code2, FileText } from "lucide-react";
import { DsaCodeEditor } from "@/features/interviews/ui/dsa/dsa-code-editor";

export type StoryPracticeArtifactKind =
  "scenario" | "code" | "logs" | "trace" | "metrics" | "waterfall" | "query-plan" | "config";

export type StoryPracticeArtifactData = {
  kind: StoryPracticeArtifactKind;
  title: string;
  content: string;
  language?: string;
  caption?: string;
};

/** Typed renderer shared by the story-driven Practice tracks. */
export function StoryPracticeArtifact({ artifact }: { artifact: StoryPracticeArtifactData }) {
  const presentation = artifactPresentation(artifact);
  const lines = artifact.content.split("\n");

  return (
    <section aria-labelledby="question-artifact-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--workspace-accent)]">
            Evidence artifact
          </p>
          <h2
            id="question-artifact-heading"
            className="mt-1.5 text-[16px] font-semibold tracking-[-0.015em] text-cream/88"
          >
            {artifact.title}
          </h2>
          {artifact.caption ? (
            <p className="mt-1 text-[11px] leading-5 text-cream/38">{artifact.caption}</p>
          ) : null}
        </div>
        <span className="rounded-full border border-white/[0.065] bg-white/[0.035] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-cream/42">
          {humanize(artifact.kind)}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.085] bg-[#0b0d10] shadow-[0_16px_45px_rgba(0,0,0,0.2)]">
        <div className="flex h-10 items-center gap-2 border-b border-white/[0.065] bg-[#15181d] px-3.5">
          {presentation.editor ? (
            <Code2 size={12} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          ) : (
            <FileText size={12} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          )}
          <span className="min-w-0 truncate font-mono text-[10.5px] text-cream/42">
            {artifactFileName(artifact.title, presentation.extension)}
          </span>
          <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-[0.11em] text-cream/28">
            Read only
          </span>
        </div>
        {presentation.editor ? (
          <div style={{ height: codeViewerHeight(artifact.content, 440) }}>
            <DsaCodeEditor
              language="javascript"
              value={artifact.content}
              readOnly
              autoFocus={false}
              ariaLabel={`${artifact.title} ${artifact.kind} artifact, read only`}
            />
          </div>
        ) : (
          <div className="thin-scroll max-h-[28rem] overflow-auto py-3">
            <ol className="min-w-max font-mono text-[12px] leading-[1.85] text-cream/64">
              {lines.map((line, index) => (
                <li key={`${index}:${line}`} className="flex min-h-6 hover:bg-white/[0.025]">
                  <span
                    aria-hidden="true"
                    className="w-12 shrink-0 select-none border-r border-white/[0.045] pr-3 text-right tabular-nums text-cream/20"
                  >
                    {index + 1}
                  </span>
                  <span className="whitespace-pre-wrap px-4">{line || " "}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

function artifactPresentation(artifact: StoryPracticeArtifactData): {
  editor: boolean;
  extension: string;
} {
  switch (artifact.kind) {
    case "code":
      return { editor: true, extension: artifact.language === "typescript" ? "ts" : "mjs" };
    case "config":
      return { editor: /^\s*[[{]/.test(artifact.content), extension: "config" };
    case "logs":
      return {
        editor:
          /(^|\n)\s*(?:import|export|const|let|var|function|class|setImmediate\(|setTimeout\()/m.test(
            artifact.content
          ),
        extension: "log"
      };
    case "trace":
      return { editor: false, extension: "trace" };
    case "metrics":
      return { editor: false, extension: "metrics" };
    case "waterfall":
      return { editor: false, extension: "waterfall" };
    case "query-plan":
      return { editor: false, extension: "plan" };
    case "scenario":
      return { editor: false, extension: "txt" };
  }
}

function artifactFileName(title: string, extension: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.includes(".")) return normalized;
  return `${normalized || "evidence"}.${extension}`;
}

function codeViewerHeight(value: string, maximum: number): number {
  return Math.min(maximum, Math.max(180, value.split("\n").length * 19 + 28));
}

function humanize(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
