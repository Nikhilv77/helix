import { BadRequestErrorException } from "../common/exceptions/bad-request-error.exception";
import { MermaidFlowchartValidator } from "./mermaid-flowchart.validator";

describe("MermaidFlowchartValidator", () => {
  const validator = new MermaidFlowchartValidator();

  it("accepts a simple flowchart TD diagram", () => {
    const mermaid = `flowchart TD
  Client[Client Apps] --> Api[API Service]
  Api --> Db[(PostgreSQL)]
  Api --> Queue[Message Queue]`;

    expect(validator.validate(mermaid)).toBe(mermaid);
  });

  it("accepts safe layered subgraph blocks", () => {
    const mermaid = `flowchart TD
  subgraph ClientLayer[Client Layer]
    Client[Client Apps]
  end
  subgraph DataLayer[Data Layer]
    Db[(PostgreSQL)]
  end
  Client --> Db`;

    expect(validator.validate(mermaid)).toBe(mermaid);
  });

  it("rejects unsupported Mermaid diagram types", () => {
    expect(() =>
      validator.validate(`sequenceDiagram
  User->>API: request`)
    ).toThrow(BadRequestErrorException);
  });

  it("rejects unsupported flowchart directions", () => {
    expect(() =>
      validator.validate(`flowchart LR
  Client --> Api`)
    ).toThrow("Only Mermaid flowchart TD diagrams are supported");
  });

  it("rejects unsafe Mermaid directives and actions", () => {
    expect(() =>
      validator.validate(`%%{init: {"theme": "dark"}}%%
flowchart TD
  Client --> Api`)
    ).toThrow("Mermaid directives are not allowed");

    expect(() =>
      validator.validate(`flowchart TD
  Client --> Api
  click Api "javascript:alert(1)"`)
    ).toThrow("Interactive click actions are not allowed");
  });

  it("returns clear validation errors for unsupported syntax", () => {
    expect(() =>
      validator.validate(`flowchart TD
  Client <--> Api`)
    ).toThrow("Diagram contains unsupported Mermaid syntax");
  });
});
