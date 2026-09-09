import { describe, expect, it } from "vitest";
import { normalizeDsaNoteDrawing } from "./dsa-note-drawing";

describe("normalizeDsaNoteDrawing", () => {
  it("moves a legacy single-canvas drawing onto page one", () => {
    const drawing = normalizeDsaNoteDrawing({
      version: 1,
      strokes: [
        {
          id: "legacy-stroke",
          color: "#f26e01",
          width: 3.5,
          opacity: 1,
          points: [{ x: 0.25, y: 0.5, pressure: 0.7 }]
        }
      ]
    });

    expect(drawing.version).toBe(2);
    expect(drawing.pages).toEqual([
      expect.objectContaining({
        id: "page-1",
        strokes: [expect.objectContaining({ id: "legacy-stroke" })]
      })
    ]);
  });
});
