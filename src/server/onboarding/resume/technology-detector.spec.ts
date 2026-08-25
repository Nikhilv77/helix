import {
  detectExplicitResumeTechnologies,
  mergeResumeTechnologies
} from "./technology-detector";

describe("resume technology detector", () => {
  it("recovers explicit technologies independently of the model extraction", () => {
    const detected = detectExplicitResumeTechnologies(`
SUMMARY
Backend engineer building reliable systems.
EXPERIENCE
Implemented event pipelines with Apache Kafka and deployed services using Docker.
SKILLS
TypeScript, React.js, PostgreSQL
`);

    expect(detected).toEqual(
      expect.arrayContaining(["Apache Kafka", "Docker", "PostgreSQL", "React", "TypeScript"])
    );
  });

  it("does not turn ordinary Go, R, C, or common-word mentions into skills", () => {
    const detected = detectExplicitResumeTechnologies(`
SUMMARY
Helped the product go to market with the R&D team.
Prepared C-level reporting for the Spring 2024 launch.
Coordinated express delivery and container logistics with Oracle partners.
SKILLS
Go-to-market strategy, R&D collaboration, C-level communication
`);

    expect(detected).not.toEqual(
      expect.arrayContaining(["Go", "R", "C", "Spring Boot", "Express", "Docker", "Oracle Database"])
    );
  });

  it("accepts ambiguous language names in an explicit technical context", () => {
    const detected = detectExplicitResumeTechnologies(`
SKILLS
Go, R, C, C++, Python
EXPERIENCE
Built backend services in Go and statistical scripts using R.
Wrote systems code in C/C++.
`);

    expect(detected).toEqual(expect.arrayContaining(["Go", "R", "C", "C++", "Python"]));
  });

  it("merges detector results without duplicating extracted aliases", () => {
    expect(
      mergeResumeTechnologies(
        ["React.js", "TypeScript"],
        ["React", "PostgreSQL", "Apache Kafka"]
      )
    ).toEqual(["React.js", "TypeScript", "PostgreSQL", "Apache Kafka"]);
  });
});
