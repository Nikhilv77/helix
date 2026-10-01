import type { RefObject } from "react";
import { BriefcaseBusiness, Code2, Loader2 } from "lucide-react";
import type { InterviewQuestion, InterviewSetup, Turn } from "@/lib/shared/types";
import {
  DsaCodeEditor,
  type DsaEditorLanguage
} from "@/features/interviews/ui/dsa/dsa-code-editor";
import { formatClock, roleLabel, roundLabel } from "../utils/voice-interview";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

export function ConversationTranscript({
  turns,
  spokenAgentTurnKeys,
  liveUserText,
  liveAgentText = "",
  teacherName,
  startedAt,
  setup,
  question,
  thinking,
  bottomRef,
  compact = false,
  hideHeader = false
}: {
  turns: Turn[];
  spokenAgentTurnKeys: ReadonlySet<string>;
  liveUserText: string;
  /** Native-live output, shown before the server has stored a completed turn. */
  liveAgentText?: string;
  /** Allows the interview room to pin a presenter independently of workspace teacher. */
  teacherName?: string;
  startedAt: number | null;
  setup: InterviewSetup | null;
  question: InterviewQuestion | null;
  thinking: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  hideHeader?: boolean;
}) {
  const teacher = useWorkspaceTeacher();
  const visibleTurns = turns.filter(
    (turn) =>
      turn.text.trim().length > 0 &&
      (turn.speaker === "user" || spokenAgentTurnKeys.has(turnKey(turn)) || Boolean(teacherName))
  );
  const normalizedLiveUserText = liveUserText.trim();
  const normalizedLiveAgentText = liveAgentText.trim();
  const hasLiveUserTurn = visibleTurns.some(
    (turn) => turn.speaker === "user" && turn.text.trim() === normalizedLiveUserText
  );
  const hasLiveAgentTurn = visibleTurns.some(
    (turn) => turn.speaker === "agent" && turn.text.trim() === normalizedLiveAgentText
  );
  const withLiveUser =
    normalizedLiveUserText && !hasLiveUserTurn
      ? [
          ...visibleTurns,
          {
            speaker: "user" as const,
            text: normalizedLiveUserText,
            startMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
            endMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0
          }
        ]
      : visibleTurns;
  const displayTurns =
    normalizedLiveAgentText && !hasLiveAgentTurn
      ? [
          ...withLiveUser,
          {
            speaker: "agent" as const,
            text: normalizedLiveAgentText,
            startMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
            endMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0
          }
        ]
      : withLiveUser;
  const isCode = question?.kind === "code" && question.codeSnippet;
  let latestAgentIndex = -1;
  for (let index = displayTurns.length - 1; index >= 0; index -= 1) {
    if (displayTurns[index]?.speaker === "agent") {
      latestAgentIndex = index;
      break;
    }
  }

  return (
    <section className="msg-in flex min-h-0 flex-col">
      {!hideHeader ? (
        <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
          <span className="flex items-center gap-2 text-xs font-semibold text-cream/62">
            {isCode ? (
              <Code2 size={12} aria-hidden="true" />
            ) : (
              <BriefcaseBusiness size={12} aria-hidden="true" />
            )}
            Live exchange
          </span>

          {setup ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ContextPill>{roleLabel(setup.role)}</ContextPill>
              <ContextPill>{roundLabel(setup.roundType)}</ContextPill>
            </div>
          ) : null}
        </div>
      ) : null}

      {displayTurns.length === 0 ? (
        <div className="px-1 py-2">
          <p
            className={
              compact
                ? "text-sm leading-6 text-cream/76"
                : "text-base leading-7 text-cream sm:text-lg sm:leading-8"
            }
          >
            {question
              ? `${teacherName ?? teacher.name} is getting ready to speak.`
              : `${teacherName ?? teacher.name} is preparing your first question.`}
          </p>
          {question?.codeTask ? (
            <p className="mt-4 text-sm leading-6 text-cream/60">{question.codeTask}</p>
          ) : null}
        </div>
      ) : (
        <div className={compact ? "space-y-5" : "space-y-7"}>
          {displayTurns.map((turn, index) => {
            const isAgent = turn.speaker === "agent";
            const isLatestAgent = isAgent && index === latestAgentIndex;
            // A submitted solution needs the panel's full width; a right-aligned
            // bubble squeezed the code into a sliver.
            const carriesCode = !isAgent && turn.text.includes("```");

            return (
              <article
                key={`${turn.speaker}-${turn.startMs}-${index}`}
                className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[min(100%,44rem)] break-words px-1 ${
                    isAgent ? "text-left" : carriesCode ? "w-full text-left" : "max-w-[88%] text-right"
                  }`}
                >
                  <div
                    className={`${compact ? "mb-1.5" : "mb-2"} flex items-center gap-2 ${
                      carriesCode ? "justify-end" : ""
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${
                        isAgent ? "text-[var(--workspace-accent)]" : "text-cream/48"
                      }`}
                    >
                      {isAgent ? (teacherName ?? teacher.name) : "You"}
                    </span>
                    <span className="text-xs tabular-nums text-cream/36">
                      {formatClock(turn.startMs)}
                    </span>
                  </div>

                  <TranscriptMarkdown
                    text={turn.text}
                    className={
                      compact
                        ? isAgent
                          ? "text-sm leading-6 text-cream/82"
                          : "text-sm leading-6 text-cream/64"
                        : isLatestAgent
                          ? "text-base leading-7 text-cream sm:text-lg sm:leading-8"
                          : isAgent
                            ? "text-base leading-7 text-cream/82"
                            : "text-sm leading-6 text-cream/68"
                    }
                  />
                </div>
              </article>
            );
          })}

          {isCode ? (
            <div className="rounded-xl bg-black/10 p-3">
              <CodeBlock code={question.codeSnippet ?? ""} language={question.language ?? "code"} />
            </div>
          ) : null}

          {thinking ? <ThinkingLine interviewerName={teacherName ?? teacher.name} /> : null}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  );
}

type TranscriptBlock =
  { kind: "prose"; text: string } | { kind: "code"; code: string; language: string };

export function transcriptMarkdownBlocks(text: string): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  const fence = /```\s*([^\s`\n]*)\s*\n([\s\S]*?)```/g;
  let cursor = 0;

  for (const match of text.matchAll(fence)) {
    const index = match.index ?? 0;
    const prose = text.slice(cursor, index).trim();
    if (prose) blocks.push({ kind: "prose", text: prose });
    blocks.push({
      kind: "code",
      language: match[1]?.trim() || "text",
      code: (match[2] ?? "").replace(/^\n|\n$/g, "")
    });
    cursor = index + match[0].length;
  }

  const remainder = text.slice(cursor).trim();
  if (remainder) blocks.push({ kind: "prose", text: remainder });
  return blocks.length > 0 ? blocks : [{ kind: "prose", text }];
}

function TranscriptMarkdown({ text, className }: { text: string; className: string }) {
  const blocks = transcriptMarkdownBlocks(text);

  return (
    <div className={`${className} space-y-3`}>
      {blocks.map((block, index) =>
        block.kind === "code" ? (
          <TranscriptCodeBlock
            key={`${index}-${block.language}-${block.code.length}`}
            code={block.code}
            language={block.language}
          />
        ) : (
          <p key={`${index}-${block.text.length}`} className="whitespace-pre-wrap">
            {block.text}
          </p>
        )
      )}
    </div>
  );
}

function TranscriptCodeBlock({ code, language }: { code: string; language: string }) {
  const editorLanguage = normalizeEditorLanguage(language);
  const lineCount = Math.max(1, code.split("\n").length);
  const height = Math.min(320, Math.max(112, lineCount * 23 + 34));

  return (
    <div
      className="transcript-code w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.07] text-left"
      data-testid="transcript-code-block"
    >
      <div className="border-b border-white/[0.06] px-3 py-2 text-xs font-medium text-cream/52">
        {displayLanguage(language || editorLanguage)}
      </div>
      <div style={{ height }}>
        <DsaCodeEditor
          language={editorLanguage}
          syntaxLanguage={monacoLanguage(language)}
          value={code}
          readOnly
          autoFocus={false}
          ariaLabel={`${language || editorLanguage} code from transcript`}
        />
      </div>
    </div>
  );
}

const LANGUAGE_NAMES: Record<string, string> = {
  python: "Python",
  py: "Python",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  java: "Java",
  cpp: "C++",
  "c++": "C++",
  sql: "SQL",
  go: "Go"
};

/** "python" → "Python", for headers that read as words, not code tokens. */
function displayLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_NAMES[normalized] ?? (language.trim() || "Code");
}

function normalizeEditorLanguage(language: string): DsaEditorLanguage {
  const normalized = language.trim().toLowerCase();
  if (["js", "jsx", "javascript", "typescript", "ts", "tsx"].includes(normalized)) {
    return "javascript";
  }
  if (["py", "python"].includes(normalized)) return "python";
  if (["c++", "cpp", "cxx"].includes(normalized)) return "cpp";
  if (normalized === "java") return "java";
  return "javascript";
}

function monacoLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized === "js") return "javascript";
  if (normalized === "ts") return "typescript";
  if (normalized === "py") return "python";
  if (["c++", "cxx"].includes(normalized)) return "cpp";
  return normalized || "plaintext";
}

function turnKey(turn: Turn): string {
  return `${turn.speaker}-${turn.startMs}-${turn.endMs}-${turn.text}`;
}

function ThinkingLine({ interviewerName }: { interviewerName: string }) {
  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-cream/40">
      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      {interviewerName} is responding
    </p>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="transcript-code overflow-hidden rounded-xl">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-xs font-semibold text-cream/62">{displayLanguage(language)}</span>
        <span className="text-xs text-cream/42">Code to review</span>
      </div>
      <pre className="transcript-code-text thin-scroll max-h-72 overflow-auto px-4 pb-4 font-mono text-[12px] leading-6">
        <code>
          {code.split("\n").map((line, index) => (
            <span key={index} className="block whitespace-pre">
              <span className="transcript-code-gutter mr-4 inline-block w-5 select-none text-right">
                {index + 1}
              </span>
              {line || " "}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function ContextPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-cream/[0.055] px-2.5 py-1 text-xs font-medium text-cream/52">
      {children}
    </span>
  );
}
