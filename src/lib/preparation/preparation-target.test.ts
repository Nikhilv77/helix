import { describe, expect, it } from "vitest";
import { suggestedPreparationRole } from "./preparation-target";

function resume(skills: string[], role = "") {
  return {
    skills,
    experience: role ? [{ role, summary: "", skills: [] }] : [],
    projects: []
  };
}

describe("suggestedPreparationRole", () => {
  it("suggests frontend when the resume contains frontend-only evidence", () => {
    expect(
      suggestedPreparationRole({
        stage: "target_role",
        savedRole: "fullstack",
        resume: resume(["React", "Next.js", "CSS"], "Frontend Engineer")
      })
    ).toBe("frontend");
  });

  it("uses full stack for mixed frontend/backend or irrelevant evidence", () => {
    expect(
      suggestedPreparationRole({
        stage: "target_role",
        savedRole: "fullstack",
        resume: resume(["React", "Node.js", "REST APIs"])
      })
    ).toBe("fullstack");
    expect(
      suggestedPreparationRole({
        stage: "target_role",
        savedRole: "pm",
        resume: resume(["Roadmapping", "User research"], "Product Manager")
      })
    ).toBe("fullstack");
  });

  it("suggests dedicated backend, data, and AI/ML coding tracks", () => {
    expect(
      suggestedPreparationRole({
        stage: "target_role",
        savedRole: "fullstack",
        resume: resume(["Java", "Spring", "Microservices"])
      })
    ).toBe("backend");
    expect(
      suggestedPreparationRole({
        stage: "target_role",
        savedRole: "fullstack",
        resume: resume(["Apache Spark", "Airflow", "Data pipelines"])
      })
    ).toBe("data");
    expect(
      suggestedPreparationRole({
        stage: "target_role",
        savedRole: "fullstack",
        resume: resume(["PyTorch", "Machine learning", "Model training"])
      })
    ).toBe("ai-ml");
  });

  it("preserves the candidate's saved choice after the target-role screen", () => {
    expect(
      suggestedPreparationRole({
        stage: "target_level",
        savedRole: "backend",
        resume: resume(["React", "Next.js", "CSS"])
      })
    ).toBe("backend");
  });
});

