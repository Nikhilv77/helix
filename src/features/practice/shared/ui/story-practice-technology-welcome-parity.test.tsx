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

  it("keeps automatic Core preparation and selectable Applied setup on the same responsive shell", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const core = render(<CoreTechnicalTechnologyWelcome />);
    const coreGeometry = geometry("Preparing your personalised practice path.");
    expect(screen.queryByRole("button", { name: /JavaScript:/i })).toBeNull();
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
    const appliedGeometry = geometry("What do you want to get better at?");

    expect(appliedGeometry).toEqual(coreGeometry);
    expect(appliedGeometry.main).toContain("max-w-[86rem]");
    expect(appliedGeometry.main).toContain("px-4");
    expect(appliedGeometry.main).toContain("sm:px-8");
    expect(appliedGeometry.main).toContain("lg:px-10");
    expect(appliedGeometry.stage).toContain("h-[17rem]");
    expect(appliedGeometry.stage).toContain("sm:h-[23rem]");
    expect(appliedGeometry.stage).toContain("lg:h-[31rem]");
    expect(appliedGeometry.stage).not.toContain("hidden");
    const choice = screen.getByRole("button", { name: /JavaScript:/i });
    expect(choice.className).toContain("min-h-[6rem]");
    expect(choice.className).toContain("focus-visible:ring-2");
  });
});

function geometry(headingName: string) {
  const heading = screen.getByRole("heading", { name: headingName });
  const section = heading.closest("section");
  const main = heading.closest("main");
  const teacher = screen.getByTestId("teacher");

  expect(section).toHaveAttribute("aria-labelledby", heading.id);
  expect(teacher.parentElement).toHaveAttribute("data-avatar-feather", "alpha-edge");

  return {
    main: main?.className,
    section: section?.className,
    stage: teacher.parentElement?.parentElement?.className,
    feather: teacher.parentElement?.className
  };
}
