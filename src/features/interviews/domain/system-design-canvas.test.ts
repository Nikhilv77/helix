import { describe, expect, it } from "vitest";
import {
  EMPTY_SYSTEM_DESIGN_CANVAS,
  SYSTEM_DESIGN_CANVAS_SCHEMA_VERSION,
  describeSystemDesignCanvas
} from "./system-design-canvas";

describe("describeSystemDesignCanvas", () => {
  it("is empty when nothing is drawn", () => {
    expect(describeSystemDesignCanvas(EMPTY_SYSTEM_DESIGN_CANVAS)).toBe("");
  });

  it("names components, connections, loose components, and notes", () => {
    const summary = describeSystemDesignCanvas({
      schemaVersion: SYSTEM_DESIGN_CANVAS_SCHEMA_VERSION,
      nodes: [
        { id: "a", kind: "service", label: "Webhook API", detail: "Validates and signs", x: 0, y: 0 },
        { id: "b", kind: "queue", label: "Delivery queue", detail: "", x: 10, y: 10 },
        { id: "c", kind: "cache", label: "", detail: "", x: 20, y: 20 }
      ],
      edges: [{ id: "e", from: "a", to: "b", label: "enqueue", mode: "async" }],
      notes: "50k events per second at peak"
    });

    expect(summary).toContain("- Webhook API (service): Validates and signs");
    expect(summary).toContain("- Webhook API -> Delivery queue (async, enqueue)");
    expect(summary).toContain("Not connected to anything: cache");
    expect(summary).toContain("Assumptions and estimates:\n50k events per second at peak");
    expect(summary).not.toContain("x:");
  });
});
