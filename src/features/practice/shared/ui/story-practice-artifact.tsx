import { Code2, FileText } from "lucide-react";
import { PracticeCodeViewer } from "@/features/practice/shared/ui/practice-code-viewer";

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
export function StoryPracticeArtifact({
  artifact,
  comfortable = false
}: {
  artifact: StoryPracticeArtifactData;
  comfortable?: boolean;
}) {
  const presentation = artifactPresentation(artifact);
  const lines = artifactDisplayLines(artifact);

  return (
    <section aria-labelledby="question-artifact-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-0.5">
        <div>
          <p
            className={`${comfortable ? "text-sm tracking-[0.1em]" : "text-[10px] tracking-[0.15em]"} font-semibold uppercase text-[var(--workspace-accent)]`}
          >
            Evidence artifact
          </p>
          <h2
            id="question-artifact-heading"
            className="mt-1.5 text-[16px] font-semibold tracking-[-0.015em] text-cream/88"
          >
            {artifact.title}
          </h2>
          {artifact.caption ? (
            <p
              className={`${comfortable ? "text-sm leading-6" : "text-[11px] leading-5"} mt-1 text-cream/38`}
            >
              {artifact.caption}
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-white/[0.065] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-cream/42">
          {humanize(artifact.kind)}
        </span>
      </div>
      <div className="story-practice-artifact overflow-hidden rounded-xl border border-white/[0.085] bg-[#0b0d10] shadow-[0_16px_45px_rgba(0,0,0,0.2)]">
        <div className="story-practice-artifact-header flex h-10 items-center gap-2 border-b border-white/[0.065] bg-[#15181d] px-3.5">
          {presentation.editor ? (
            <Code2 size={12} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          ) : (
            <FileText size={12} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          )}
          <span
            className={`${comfortable ? "text-sm" : "text-[10.5px]"} min-w-0 truncate font-mono text-cream/42`}
          >
            {artifactFileName(artifact.title, presentation.extension)}
          </span>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-cream/28">
            {presentation.editor && artifact.language
              ? `${humanize(artifact.language)} · read only`
              : "Read only"}
          </span>
        </div>
        {presentation.editor ? (
          <PracticeCodeViewer
            code={artifact.content}
            language={artifact.language ?? inferArtifactLanguage(artifact)}
            maxLines={20}
            ariaLabel={`${artifact.title} ${artifact.kind} artifact, read only`}
            embedded
          />
        ) : (
          <div className="thin-scroll max-h-[28rem] overflow-auto py-3">
            <ol
              className={`${comfortable ? "text-sm" : "text-[12px]"} w-full font-mono leading-[1.85] text-cream/64`}
            >
              {lines.map((line, index) => (
                <li key={`${index}:${line}`} className="flex min-h-6 w-full hover:bg-white/[0.025]">
                  <span
                    aria-hidden="true"
                    className="w-12 shrink-0 select-none border-r border-white/[0.045] pr-3 text-right tabular-nums text-cream/20"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words px-4">
                    {line || " "}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

function artifactDisplayLines(artifact: StoryPracticeArtifactData): string[] {
  const authoredLines = artifact.content.split("\n");
  if (authoredLines.length > 1) return authoredLines;
  if (!new Set<StoryPracticeArtifactKind>(["metrics", "trace", "waterfall"]).has(artifact.kind)) {
    return authoredLines;
  }

  const sections = artifact.content
    .split(/;\s+/)
    .map((section) => section.trim())
    .filter(Boolean);
  return sections.length > 1 ? sections : authoredLines;
}

function artifactPresentation(artifact: StoryPracticeArtifactData): {
  editor: boolean;
  extension: string;
} {
  switch (artifact.kind) {
    case "code":
      return { editor: true, extension: languageExtension(artifact.language) };
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

function inferArtifactLanguage(artifact: StoryPracticeArtifactData): string {
  const value = artifact.content;
  if (/^\s*(?:package\s+\w+|func\s+\w+\s*\()/m.test(value)) return "go";
  if (/^\s*(?:def\s+\w+\s*\(|from\s+\w+\s+import\s+|import\s+\w+)/m.test(value)) return "python";
  if (/^\s*(?:public\s+class|class\s+\w+\s*\{|import\s+java\.)/m.test(value)) return "java";
  if (/^\s*#include\s*[<"]/m.test(value)) return "cpp";
  if (/^\s*[[{]/.test(value)) return "json";
  if (/\b(?:interface|type)\s+\w+\s*[={]|:\s*(?:string|number|boolean)\b/.test(value)) {
    return "typescript";
  }
  return "javascript";
}

function languageExtension(language: string | undefined): string {
  switch (language?.trim().toLowerCase()) {
    case "typescript":
    case "ts":
      return "ts";
    case "python":
    case "py":
      return "py";
    case "java":
      return "java";
    case "go":
    case "golang":
      return "go";
    case "cpp":
    case "c++":
      return "cpp";
    case "csharp":
    case "c#":
      return "cs";
    default:
      return "js";
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

function humanize(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
