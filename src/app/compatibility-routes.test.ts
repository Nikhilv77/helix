import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import LegacyDsaInterviewPage from "./interview/dsa/[slug]/page";
import LegacyTextInterviewPage from "./interview/text/page";
import LegacyMentorsPage from "./mentors/page";

describe("compatibility routes", () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it("keeps the former mentors URL pointed at Trailguide", () => {
    LegacyMentorsPage();

    expect(redirectMock).toHaveBeenCalledWith("/trailguide");
  });

  it("preserves an existing text-interview session when moving it to voice", async () => {
    await LegacyTextInterviewPage({
      searchParams: Promise.resolve({ session: "session with spaces" })
    });

    expect(redirectMock).toHaveBeenCalledWith("/interview/voice?session=session%20with%20spaces");
  });

  it("sends old per-question DSA interview links to the round entry", async () => {
    await LegacyDsaInterviewPage({ params: Promise.resolve({ slug: "two-sum" }) });

    expect(redirectMock).toHaveBeenCalledWith("/interview/dsa");
  });
});
