import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MermaidDiagram } from "./mermaid-diagram";

describe("MermaidDiagram", () => {
  it("rejects unsafe Mermaid source before rendering", async () => {
    render(
      <MermaidDiagram
        diagram={{
          type: "flowchart",
          direction: "TD",
          mermaid: "flowchart TD\n  A --> B\n  click A javascript:alert(1)",
          generatedAt: "2026-01-01T00:00:00.000Z"
        }}
      />
    );

    expect(
      await screen.findByText("The stored diagram is not a supported safe Mermaid flowchart.")
    ).toBeInTheDocument();
  });
});
