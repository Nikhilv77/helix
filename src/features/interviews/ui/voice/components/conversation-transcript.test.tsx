import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Turn } from "@/lib/shared/types";

vi.mock("@/lib/avatars/teacher-context", () => ({
  useWorkspaceTeacher: () => ({ id: "sophia", name: "Sophia" })
}));

vi.mock("@/features/interviews/ui/dsa/dsa-code-editor", () => ({
  DsaCodeEditor: ({ value, syntaxLanguage, ariaLabel }: Record<string, string>) => (
    <pre data-language={syntaxLanguage} aria-label={ariaLabel}>
      {value}
    </pre>
  )
}));

import { ConversationTranscript } from "./conversation-transcript";

const turns: Turn[] = [
  {
    speaker: "agent",
    text: "Tell me about the career choice that brought you here.",
    startMs: 0,
    endMs: 1_000
  },
  {
    speaker: "user",
    text: "I chose software engineering because I enjoy building useful products.",
    startMs: 1_000,
    endMs: 2_000
  },
  {
    speaker: "agent",
    text: "That motivation is clear. Which project first turned that interest into a career?",
    startMs: 2_000,
    endMs: 3_000
  }
];

describe("ConversationTranscript", () => {
  afterEach(cleanup);

  it("renders candidate turns and complete James turns immediately", () => {
    renderTranscript();

    expect(screen.getByText(turns[1]!.text)).toBeVisible();
    expect(screen.getByText(turns[2]!.text)).toBeVisible();
    expect(screen.getAllByText("You")).toHaveLength(1);
    expect(screen.getAllByText("James")).toHaveLength(2);
  });

  it("does not duplicate an approved live caption already returned by the session", () => {
    renderTranscript(turns[2]!.text);

    expect(screen.getAllByText(turns[2]!.text)).toHaveLength(1);
  });

  it("renders fenced candidate code in the read-only Monaco presentation", () => {
    render(
      <ConversationTranscript
        turns={[
          {
            speaker: "user",
            text: "Here is my solution:\n```javascript\nfunction solve(nums) {\n  return nums.length;\n}\n```\nIt is O(n).",
            startMs: 1_000,
            endMs: 2_000
          }
        ]}
        spokenAgentTurnKeys={new Set()}
        liveUserText=""
        teacherName="James"
        startedAt={0}
        setup={null}
        question={null}
        thinking={false}
        bottomRef={createRef<HTMLDivElement>()}
      />
    );

    expect(screen.getByText("Here is my solution:")).toBeVisible();
    expect(screen.getByText("It is O(n).")).toBeVisible();
    expect(screen.getByTestId("transcript-code-block")).toBeVisible();
    expect(screen.getByLabelText("javascript code from transcript")).toHaveTextContent(
      "function solve(nums)"
    );
    expect(screen.queryByText(/```javascript/)).toBeNull();
  });
});

function renderTranscript(liveAgentText = "") {
  return render(
    <ConversationTranscript
      turns={turns}
      spokenAgentTurnKeys={new Set()}
      liveUserText=""
      liveAgentText={liveAgentText}
      teacherName="James"
      startedAt={0}
      setup={null}
      question={null}
      thinking={false}
      bottomRef={createRef<HTMLDivElement>()}
    />
  );
}
