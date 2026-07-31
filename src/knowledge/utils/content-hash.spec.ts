import { createContentHash } from "./content-hash";

describe("createContentHash", () => {
  it("creates stable hashes for identical normalized content", () => {
    expect(createContentHash("same content")).toBe(createContentHash("same content"));
    expect(createContentHash("same content")).not.toBe(createContentHash("different content"));
  });
});
