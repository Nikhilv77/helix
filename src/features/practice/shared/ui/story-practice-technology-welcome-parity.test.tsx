import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppliedEngineeringTechnologyWelcome } from "@/features/practice/applied-engineering/ui/applied-engineering-technology-welcome";
import { CoreTechnicalTechnologyWelcome } from "@/features/practice/core-technical/ui/core-technical-technology-welcome";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() })
}));
vi.mock("@/components/workspace/shared/maya/maya-stage", () => ({
  MayaStage: () => <div data-testid="teacher" />
}));
vi.mock("@/infrastructure/realtime/use-maya-voice", () => ({
  useMayaVoice: () => ({
    state: "idle",
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    awaitingGesture: true,
    setAwaitingGesture: vi.fn()
  })
}));

describe("story-practice technology welcome parity", () => {
  afterEach(() => vi.clearAllMocks());

  it("keeps Core and Applied on the same accessible responsive shell", () => {
    const core = render(
      <CoreTechnicalTechnologyWelcome
        technologies={[
          {
            value: "javascript",
            label: "JavaScript",
            detail: "JavaScript on Node.js",
            resumeMatched: true
          }
        ]}
      />
    );
    const coreGeometry = geometry();
    core.unmount();

    render(
      <AppliedEngineeringTechnologyWelcome
        technologies={[
          {
            value: "javascript",
            label: "JavaScript",
            detail: "Node.js production incidents",
            resumeMatched: true
          }
        ]}
      />
    );
    const appliedGeometry = geometry();

    expect(appliedGeometry).toEqual(coreGeometry);
    expect(appliedGeometry.main).toContain("max-w-[86rem]");
    expect(appliedGeometry.main).toContain("px-4");
    expect(appliedGeometry.main).toContain("sm:px-8");
    expect(appliedGeometry.main).toContain("lg:px-10");
    expect(appliedGeometry.stage).toContain("h-[17rem]");
    expect(appliedGeometry.stage).toContain("sm:h-[23rem]");
    expect(appliedGeometry.stage).toContain("lg:h-[31rem]");
    expect(appliedGeometry.stage).not.toContain("hidden");
    expect(appliedGeometry.choice).toContain("min-h-[6rem]");
    expect(appliedGeometry.choice).toContain("focus-visible:ring-2");
  });
});

function geometry() {
  const heading = screen.getByRole("heading", { name: "What do you want to get better at?" });
  const section = heading.closest("section");
  const main = heading.closest("main");
  const teacher = screen.getByTestId("teacher");
  const choice = screen.getByRole("button", { name: /JavaScript:/i });

  expect(section).toHaveAttribute("aria-labelledby", heading.id);
  expect(teacher.parentElement).toHaveAttribute("data-avatar-feather", "alpha-edge");

  return {
    main: main?.className,
    section: section?.className,
    stage: teacher.parentElement?.parentElement?.className,
    feather: teacher.parentElement?.className,
    choice: choice.className
  };
}
