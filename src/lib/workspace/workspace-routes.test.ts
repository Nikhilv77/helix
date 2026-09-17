import { describe, expect, it } from "vitest";
import { isWorkspaceCanvasRoute, isWorkspaceChromeRoute } from "./workspace-routes";

describe("workspace routes", () => {
  it.each([
    "/practice",
    "/practice/dsa",
    "/practice/arrays-hashing",
    "/dsa-questions/two-sum",
    "/resume-roast",
    "/trailmate"
  ])("keeps the complete practice journey inside the workspace shell: %s", (pathname) => {
    expect(isWorkspaceChromeRoute(pathname)).toBe(true);
  });

  it.each(["/blog", "/about", "/pricing", "/trailguide", "/trailguide/mentors"])(
    "keeps public editorial routes outside the workspace shell: %s",
    (pathname) => {
      expect(isWorkspaceChromeRoute(pathname)).toBe(false);
    }
  );

  it("renders the DSA checkpoint as a full-screen workspace canvas", () => {
    expect(isWorkspaceChromeRoute("/practice/dsa/assessment")).toBe(false);
    expect(isWorkspaceCanvasRoute("/practice/dsa/assessment")).toBe(true);
  });
});
