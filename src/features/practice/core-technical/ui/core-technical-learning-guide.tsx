import { ArrowDown, ArrowRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { StoryPracticeQuestionView } from "@/features/practice/shared/ui/view-contracts";

type LearningGuide = NonNullable<
  NonNullable<StoryPracticeQuestionView["authorizedAnswer"]>["learningGuide"]
>;

export function CoreTechnicalLearningGuide({ guide }: { guide: LearningGuide }) {
  return (
    <section
      className="mt-5 border-t border-white/[0.07] pt-5"
      aria-labelledby="learning-guide-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
        Learn the mechanism
      </p>
      <h3
        id="learning-guide-heading"
        className="mt-2 font-display text-[1.25rem] font-semibold text-cream"
      >
        Detailed walkthrough
      </h3>
      <div className="mt-5">
        <LearningMarkdown markdown={guide.markdown} />
      </div>
      <figure className="mt-7 border-t border-white/[0.07] pt-5">
        <figcaption className="text-[12.5px] font-semibold leading-5 text-cream/72">
          {guide.diagram.title}
        </figcaption>
        <ol
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch"
          aria-label={guide.diagram.title}
        >
          {guide.diagram.steps.map((step, index) => (
            <li
              key={`${index}:${step.label}`}
              className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 border-l-2 border-[var(--workspace-accent)] py-1 pl-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-cream/72">
                  {index + 1}. {step.label}
                </p>
                <p className="mt-1.5 text-[11.5px] leading-5 text-cream/46">{step.detail}</p>
              </div>
              {index < guide.diagram.steps.length - 1 ? (
                <>
                  <ArrowDown
                    size={14}
                    className="my-2 self-center text-cream/22 sm:hidden"
                    aria-hidden="true"
                  />
                  <ArrowRight
                    size={14}
                    className="mx-2 hidden shrink-0 text-cream/22 sm:block"
                    aria-hidden="true"
                  />
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </figure>
    </section>
  );
}

function LearningMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdownBlocks(markdown);
  return (
    <div className="space-y-3.5 text-[12.5px] leading-6 text-cream/58">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h4 key={index} className="pt-2 text-[13.5px] font-semibold text-cream/82 first:pt-0">
              {inlineMarkdown(block.text)}
            </h4>
          );
        }
        if (block.kind === "code") {
          return (
            <pre
              key={index}
              className="thin-scroll overflow-x-auto rounded-lg bg-black/28 px-3.5 py-3 font-mono text-[11.5px] leading-5 text-cream/68"
            >
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={index} className="space-y-2 pl-4">
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${itemIndex}:${item}`}
                  className="list-disc pl-1 marker:text-[var(--workspace-accent)]"
                >
                  {inlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{inlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

type MarkdownBlock =
  { kind: "heading" | "paragraph" | "code"; text: string } | { kind: "list"; items: string[] };

function markdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    if (list.length) blocks.push({ kind: "list", items: list });
    paragraph = [];
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else {
        flush();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(rawLine);
      continue;
    }
    const heading = line.match(/^#{2,4}\s+(.+)$/);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1]! });
      continue;
    }
    const listItem = line.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (listItem) {
      if (paragraph.length) flush();
      list.push(listItem[1]!);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list.length) flush();
    paragraph.push(line.trim());
  }
  flush();
  if (code?.length) blocks.push({ kind: "code", text: code.join("\n") });
  return blocks;
}

function inlineMarkdown(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-white/[0.055] px-1 py-0.5 font-mono text-[0.92em] text-cream/72"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-cream/78">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
