import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceProse, isProseEvidence } from "./evidence-prose";

const evidence =
  "chunk { text, vector, tenantName }; answer { text, sourceUrl }. Ingestion overwrites vectors by arrival time. The client submits tenantName; retrieval trusts it.";

describe("EvidenceProse", () => {
  it("shows one sentence per line with code fragments as inline code", () => {
    const { container } = render(<EvidenceProse text={evidence} />);

    const sentences = Array.from(container.querySelectorAll("li")).map((li) => li.textContent);
    expect(sentences).toEqual([
      "chunk { text, vector, tenantName }; answer { text, sourceUrl }.",
      "Ingestion overwrites vectors by arrival time.",
      "The client submits tenantName; retrieval trusts it."
    ]);
    const code = Array.from(container.querySelectorAll("code")).map((node) => node.textContent);
    expect(code).toEqual([
      "chunk { text, vector, tenantName }",
      "answer { text, sourceUrl }",
      "tenantName"
    ]);
  });

  it("treats only single-paragraph sentences as prose evidence", () => {
    expect(isProseEvidence(evidence)).toBe(true);
    expect(isProseEvidence("12:00 healthy\n12:03 burst begins")).toBe(false);
    expect(isProseEvidence("SELECT * FROM orders")).toBe(false);
  });
});
