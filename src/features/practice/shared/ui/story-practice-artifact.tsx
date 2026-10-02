import { Code2, FileText } from "lucide-react";
import { EvidenceProse, isProseEvidence } from "@/features/practice/shared/ui/evidence-prose";
import { PracticeCodeViewer } from "@/features/practice/shared/ui/practice-code-viewer";

export type StoryPracticeArtifactKind =
  "scenario" | "code" | "logs" | "trace" | "metrics" | "waterfall" | "query-plan" | "config";

export type StoryPracticeArtifactData = {
  kind: StoryPracticeArtifactKind;
  title: string;
  content: string;
  language?: string;
  caption?: string;
  table?: { columns: string[]; rows: string[][] };
};

/**
 * An artifact's text split into prose and fenced code. Authors put real code,
 * JSON, SQL, or YAML inside ```language fences so it renders in the read-only
 * editor instead of as a sentence describing the code.
 */
export type StoryPracticeArtifactBlock =
  | { kind: "text"; text: string }
  | { kind: "code"; language: string; code: string };

export function storyPracticeArtifactBlocks(content: string): StoryPracticeArtifactBlock[] {
  const blocks: StoryPracticeArtifactBlock[] = [];
  const fence = /```[ \t]*([\w+#-]*)[ \t]*\n([\s\S]*?)\n?```/g;
  let cursor = 0;
  for (const match of content.matchAll(fence)) {
    const index = match.index ?? 0;
    const text = content.slice(cursor, index).trim();
    if (text) blocks.push({ kind: "text", text });
    blocks.push({
      kind: "code",
      language: match[1]?.trim() || "plaintext",
      code: (match[2] ?? "").replace(/^\n+|\s+$/g, "")
    });
    cursor = index + match[0].length;
  }
  const rest = content.slice(cursor).trim();
  if (rest) blocks.push({ kind: "text", text: rest });
  return blocks;
}

/** Prose and fenced code blocks, with each code block in the read-only editor. */
export function StoryPracticeArtifactBlocks({
  blocks,
  label,
  comfortable = false
}: {
  blocks: StoryPracticeArtifactBlock[];
  label: string;
  comfortable?: boolean;
}) {
  return (
    <div className="divide-y divide-white/[0.06]">
      {blocks.map((block, index) =>
        block.kind === "code" ? (
          <div key={index} className="relative">
            <span className="pointer-events-none absolute right-3 top-2 z-10 text-[12px] text-cream/38">
              {block.language === "plaintext" ? "text" : block.language}
            </span>
            <PracticeCodeViewer
              code={block.code}
              language={block.language}
              maxLines={24}
              ariaLabel={`${label}, ${block.language} excerpt, read only`}
              embedded
            />
          </div>
        ) : (
          <p
            key={index}
            className={`${comfortable ? "text-sm leading-7" : "text-[13px] leading-6"} whitespace-pre-wrap px-4 py-3 text-cream/62`}
          >
            {block.text}
          </p>
        )
      )}
    </div>
  );
}

/** Typed renderer shared by the story-driven Practice tracks. */
export function StoryPracticeArtifact({
  artifact,
  comfortable = false
}: {
  artifact: StoryPracticeArtifactData;
  comfortable?: boolean;
}) {
  const blocks = storyPracticeArtifactBlocks(artifact.content);
  const firstCode = blocks.find((block) => block.kind === "code");
  const presentation = firstCode
    ? { editor: true, extension: languageExtension(firstCode.language) }
    : artifactPresentation(artifact);
  const editorLanguage = firstCode?.language ?? artifact.language;
  const lines = artifactDisplayLines(artifact);

  return (
    <section aria-labelledby="question-artifact-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-0.5">
        <div>
          <p
            className={`${comfortable ? "text-sm" : "text-[12.5px]"} font-semibold text-[var(--workspace-accent)]`}
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
              className={`${comfortable ? "text-sm leading-6" : "text-[12px] leading-5"} mt-1 text-cream/42`}
            >
              {artifact.caption}
            </p>
          ) : null}
        </div>
        <span className="text-[12px] font-medium text-cream/45">
          {humanize(artifact.kind)}
        </span>
      </div>
      <div className="story-practice-artifact overflow-hidden rounded-xl bg-[#0b0d10]">
        <div className="story-practice-artifact-header flex h-10 items-center gap-2 bg-[#15181d] px-3.5">
          {presentation.editor ? (
            <Code2 size={12} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          ) : (
            <FileText size={12} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          )}
          <span
            className={`${comfortable ? "text-sm" : "text-[12px]"} min-w-0 truncate font-mono text-cream/42`}
          >
            {artifactFileName(artifact.title, presentation.extension)}
          </span>
          <span className="ml-auto text-[12px] text-cream/38">
            {presentation.editor && editorLanguage && editorLanguage !== "plaintext"
              ? `${humanize(editorLanguage)} · read only`
              : "Read only"}
          </span>
        </div>
        {artifact.table ? (
          <div className="thin-scroll overflow-auto p-3">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{artifact.title}</caption>
              <thead>
                <tr>
                  {artifact.table.columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="whitespace-nowrap border-b border-white/10 px-3 py-3 font-semibold text-cream/60"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artifact.table.rows.map((row, index) => (
                  <tr key={index} className="story-artifact-row">
                    {row.map((cell, column) =>
                      column === 0 ? (
                        <th
                          key={column}
                          scope="row"
                          className="px-3 py-3 font-medium text-cream/80"
                        >
                          {cell}
                        </th>
                      ) : (
                        <td
                          key={column}
                          className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-cream/65"
                        >
                          {cell}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : firstCode ? (
          <StoryPracticeArtifactBlocks
            blocks={blocks}
            label={artifact.title}
            comfortable={comfortable}
          />
        ) : presentation.editor ? (
          <PracticeCodeViewer
            code={artifact.content}
            language={artifact.language ?? inferArtifactLanguage(artifact)}
            maxLines={20}
            ariaLabel={`${artifact.title} ${artifact.kind} artifact, read only`}
            embedded
          />
        ) : lines.length === 1 && isProseEvidence(lines[0]!) ? (
          <EvidenceProse text={lines[0]!} className="px-4 py-4" />
        ) : (
          <div className="thin-scroll max-h-[28rem] overflow-auto py-3">
            <ol
              className={`${comfortable ? "text-sm" : "text-[12px]"} w-full font-mono leading-[1.85] text-cream/64`}
            >
              {lines.map((line, index) => (
                <li key={`${index}:${line}`} className="practice-soft-hover flex min-h-6 w-full">
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
    case "sql":
      return "sql";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "plaintext":
    case "text":
    case "log":
      return "log";
    case "css":
      return "css";
    case "tsx":
      return "tsx";
    case "jsx":
      return "jsx";
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
