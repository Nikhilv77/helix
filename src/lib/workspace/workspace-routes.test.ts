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

  it("renders the Core Technical checkpoint as a full-screen workspace canvas", () => {
    expect(isWorkspaceChromeRoute("/practice/core-technical/assessment")).toBe(false);
    expect(isWorkspaceCanvasRoute("/practice/core-technical/assessment")).toBe(true);
    expect(isWorkspaceChromeRoute("/practice/core-technical/assessment/test-id")).toBe(false);
    expect(isWorkspaceCanvasRoute("/practice/core-technical/assessment/test-id")).toBe(true);
  });

  it("renders the Architecture checkpoint full-screen like the other assessments", () => {
    expect(isWorkspaceChromeRoute("/practice/architecture-design/assessment")).toBe(false);
    expect(isWorkspaceCanvasRoute("/practice/architecture-design/assessment")).toBe(true);
    for (const path of [
      "/practice/frontend/core-technical/assessment",
      "/practice/data/applied-engineering/assessment",
      "/practice/ai-ml/core-technical/assessment"
    ]) {
      expect(isWorkspaceChromeRoute(path)).toBe(false);
      expect(isWorkspaceCanvasRoute(path)).toBe(true);
    }
    // The track overviews keep the workspace chrome.
    expect(isWorkspaceChromeRoute("/practice/frontend/core-technical")).toBe(true);
    expect(isWorkspaceChromeRoute("/practice/architecture-design")).toBe(true);
  });

  it("renders the Applied Engineering checkpoint in the same full-screen room", () => {
    expect(isWorkspaceChromeRoute("/practice/applied-engineering/assessment")).toBe(false);
    expect(isWorkspaceCanvasRoute("/practice/applied-engineering/assessment")).toBe(true);
    // The track itself keeps the workspace navigation.
    expect(isWorkspaceChromeRoute("/practice/applied-engineering")).toBe(true);
  });
});
