import { describe, expect, it } from "vitest";
import { isWorkspaceChromeRoute } from "./workspace-routes";

describe("workspace routes", () => {
  it.each([
    "/practice",
    "/practice/dsa",
    "/practice/arrays-hashing",
    "/dsa-questions/two-sum",
    "/trailmate"
  ])("keeps the complete practice journey inside the workspace shell: %s", (pathname) => {
    expect(isWorkspaceChromeRoute(pathname)).toBe(true);
  });

  it.each(["/blog", "/about", "/pricing"])(
    "keeps public editorial routes outside the workspace shell: %s",
    (pathname) => {
      expect(isWorkspaceChromeRoute(pathname)).toBe(false);
    }
  );
});
