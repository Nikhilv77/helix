import { useEffect, useState, type RefObject } from "react";
import { BriefcaseBusiness, Code2, Loader2 } from "lucide-react";
import type { InterviewQuestion, InterviewSetup, Turn } from "@/lib/shared/types";
import { formatClock, roleLabel, roundLabel } from "../utils/voice-interview";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

export function ConversationTranscript({
  turns,
  spokenAgentTurnKeys,
  liveUserText,
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
  startedAt: number | null;
  setup: InterviewSetup | null;
  question: InterviewQuestion | null;
  thinking: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  hideHeader?: boolean;
}) {
  const teacher = useWorkspaceTeacher();
  const visibleTurns = mergeConsecutiveUserTurns(
    turns.filter(
      (turn) =>
        turn.text.trim().length > 0 &&
        (turn.speaker === "user" || spokenAgentTurnKeys.has(turnKey(turn)))
    )
  );
  const normalizedLiveUserText = liveUserText.trim();
  const hasLiveUserTurn = visibleTurns.some(
    (turn) => turn.speaker === "user" && turn.text.trim() === normalizedLiveUserText
  );
  const displayTurns =
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
          <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cream/62">
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
              ? `${teacher.name} is getting ready to speak.`
              : `${teacher.name} is preparing your first question.`}
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

            return (
              <article
                key={`${turn.speaker}-${turn.startMs}-${index}`}
                className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[min(100%,44rem)] break-words px-1 ${
                    isAgent ? "text-left" : "max-w-[88%] text-right"
                  }`}
                >
                  <div
                    className={
                      compact ? "mb-1.5 flex items-center gap-2" : "mb-2 flex items-center gap-2"
                    }
                  >
                    <span
                      className={`font-mono text-[9px] uppercase tracking-[0.18em] ${
                        isAgent ? "text-cream/60" : "text-cream/38"
                      }`}
                    >
                      {isAgent ? teacher.name : "You"}
                    </span>
                    <span className="font-mono text-[9px] text-cream/25">
                      {formatClock(turn.startMs)}
                    </span>
                  </div>

                  <TypewriterText
                    active={isLatestAgent}
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
                    text={turn.text}
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

          {thinking ? <ThinkingLine /> : null}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  );
}

function turnKey(turn: Turn): string {
  return `${turn.speaker}-${turn.startMs}-${turn.endMs}-${turn.text}`;
}

function mergeConsecutiveUserTurns(turns: Turn[]): Turn[] {
  return turns.reduce<Turn[]>((merged, turn) => {
    const previous = merged.at(-1);
    if (turn.speaker !== "user" || previous?.speaker !== "user") {
      merged.push({ ...turn });
      return merged;
    }

    previous.text = mergeTranscriptText(previous.text, turn.text);
    previous.endMs = Math.max(previous.endMs, turn.endMs);
    return merged;
  }, []);
}

function mergeTranscriptText(existing: string, incoming: string): string {
  const current = existing.trim();
  const next = incoming.trim();

  if (!current || next.startsWith(current)) return next;
  if (current.startsWith(next)) return current;
  return `${current} ${next}`;
}

function TypewriterText({
  text,
  active,
  className
}: {
  text: string;
  active: boolean;
  className: string;
}) {
  const [visibleText, setVisibleText] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setVisibleText(text);
      return;
    }

    setVisibleText("");
    let nextLength = 0;
    const stepMs = 42;
    const timer = window.setInterval(() => {
      nextLength += 1;
      setVisibleText(text.slice(0, nextLength));

      if (nextLength >= text.length) {
        window.clearInterval(timer);
      }
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [active, text]);

  return (
    <p className={className}>
      {visibleText}
      {active && visibleText.length < text.length ? (
        <span className="ml-0.5 animate-pulse text-cream/55">|</span>
      ) : null}
    </p>
  );
}

function ThinkingLine() {
  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-cream/40">
      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      Following the strongest thread in your answer
    </p>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="overflow-hidden rounded-xl bg-black/15">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-cream/42">
          {language}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-cream/25">
          review target
        </span>
      </div>
      <pre className="thin-scroll max-h-72 overflow-auto p-4 text-[12px] leading-6 text-[#d8e2ff]">
        <code>
          {code.split("\n").map((line, index) => (
            <span key={index} className="block whitespace-pre">
              <span className="mr-4 inline-block w-5 select-none text-right text-cream/20">
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
    <span className="rounded-full bg-cream/[0.055] px-2.5 py-1 text-[10px] font-medium text-cream/45">
      {children}
    </span>
  );
}
