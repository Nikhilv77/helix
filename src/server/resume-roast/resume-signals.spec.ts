import type { CandidateResume } from "@/lib/shared/types";
import {
  RESUME_ROAST_LONG_BULLET_WORD_THRESHOLD,
  RESUME_ROAST_MAX_EVIDENCE_TEXT_LENGTH,
  RESUME_ROAST_MAX_TOP_SKILLS,
  buildResumeRoastSnapshot
} from "./resume-signals";

function resume(overrides: Partial<CandidateResume> = {}): CandidateResume {
  return {
    fileName: "ada-lovelace-resume.pdf",
    uploadedAt: 1_700_000_000_000,
    confidence: 0.96,
    fullName: "Ada Lovelace",
    skills: ["TypeScript", "React", "PostgreSQL"],
    warnings: ["Dates were inferred from the uploaded document."],
    experience: [],
    education: [],
    projects: [],
    achievements: [],
    practiceQuestions: [],
    roadmap: [],
    document: { format: "pdf", pageCount: 1, pageCountEstimated: false, sections: [] },
    evidence: {
      dateRanges: 1,
      achievementLines: 0,
      quantifiedAchievements: 0,
      experienceEntries: 0,
      projectEntries: 0,
      educationEntries: 0
    },
    interviewKit: null,
    ...overrides
  };
}

describe("buildResumeRoastSnapshot", () => {
  it("returns null for a missing stored resume", () => {
    expect(buildResumeRoastSnapshot(null)).toBeNull();
  });

  it("prepares a weak resume without pretending its dates are impact", () => {
    const snapshot = buildResumeRoastSnapshot(
      resume({
        experience: [
          {
            organization: "Example Corp",
            role: "Software Engineer",
            period: "2022–2024",
            location: "Remote",
            summary: "Built web features for internal teams.",
            achievements: ["Worked with stakeholders on product improvements."],
            skills: []
          }
        ]
      })
    );

    expect(snapshot?.signals).toMatchObject({
      bulletCount: 2,
      metricBearingBulletCount: 0,
      missingMetricBulletCount: 2
    });
    expect(snapshot?.signals.missingMetricEvidenceIds).toEqual([
      "experience-1-summary",
      "experience-1-achievement-1"
    ]);
  });

  it("distinguishes average and strong resumes using quantitative notation only", () => {
    const average = buildResumeRoastSnapshot(
      resume({
        achievements: ["Reduced page load time by 35%.", "Collaborated on a migration project."]
      })
    );
    const strong = buildResumeRoastSnapshot(
      resume({
        achievements: [
          "Improved checkout latency from 450ms to 120ms for 18,000 daily requests.",
          "Led a 6-person team that reduced cloud spend by $42,000.",
          "Scaled the pipeline 3x across 12 regions."
        ]
      })
    );

    expect(average?.signals).toMatchObject({ bulletCount: 2, metricBearingBulletCount: 1 });
    expect(strong?.signals).toMatchObject({ bulletCount: 3, metricBearingBulletCount: 3 });
  });

  it("keeps difficult-to-roast evidence grounded instead of inventing a weakness", () => {
    const snapshot = buildResumeRoastSnapshot(
      resume({
        experience: [
          {
            organization: "Private Systems",
            role: "Staff Backend Engineer",
            period: "2023–present",
            location: "",
            summary: "Architected a payment platform serving 2.4M transactions with 99.99% availability.",
            achievements: ["Reduced p99 latency by 48% while mentoring 7 engineers."],
            skills: []
          }
        ],
        projects: [
          {
            name: "Capacity Planner",
            summary: "Built forecasting workflows for 14 services.",
            outcome: "Cut provisioning lead time from 3 days to 4 hours.",
            skills: []
          }
        ]
      })
    );

    expect(snapshot?.signals.metricBearingBulletCount).toBe(4);
    expect(snapshot?.signals.missingMetricBulletCount).toBe(0);
    expect(snapshot?.evidence.map((item) => item.text)).toContain(
      "Reduced p99 latency by 48% while mentoring 7 engineers."
    );
  });

  it("keeps education evidence for a new-grad resume out of every bullet-writing signal", () => {
    const snapshot = buildResumeRoastSnapshot(
      resume({
        education: [
          {
            institution: "Trailgrad Institute of Technology",
            credential: "Bachelor of Technology",
            field: "Computer Science",
            period: "2022–2026"
          }
        ]
      })
    );

    expect(snapshot?.evidence).toEqual([
      {
        id: "education-1",
        kind: "education",
        text: "Bachelor of Technology · Computer Science · Trailgrad Institute of Technology"
      }
    ]);
    expect(snapshot?.signals).toEqual({
      bulletCount: 0,
      metricBearingBulletCount: 0,
      metricBearingEvidenceIds: [],
      missingMetricBulletCount: 0,
      missingMetricEvidenceIds: [],
      repeatedLeadingVerbs: [],
      longBulletEvidenceIds: [],
      averageWordsPerBullet: 0,
      maxWordsPerBullet: 0,
      skillListSize: 3
    });
  });

  it("recognizes common metric patterns but calls them quantitative evidence, not impact", () => {
    const snapshot = buildResumeRoastSnapshot(
      resume({
        achievements: [
          "Improved conversion by 12.5%.",
          "Saved ₹1,20,000 annually.",
          "Scaled throughput 2.5x.",
          "Lowered p95 latency to 80ms.",
          "Processed 4,500 requests per minute.",
          "Worked from 2022 to 2024."
        ]
      })
    );

    expect(snapshot?.signals.metricBearingEvidenceIds).toEqual([
      "achievement-1",
      "achievement-2",
      "achievement-3",
      "achievement-4",
      "achievement-5"
    ]);
    expect(snapshot?.signals.missingMetricEvidenceIds).toEqual(["achievement-6"]);
  });

  it("normalizes only known leading-verb inflections and preserves evidence IDs", () => {
    const snapshot = buildResumeRoastSnapshot(
      resume({
        achievements: [
          "Built the first service.",
          "Building the replacement service.",
          "Developed dashboard workflows.",
          "Developing reporting workflows.",
          "Co-authored the architecture decision record."
        ]
      })
    );

    expect(snapshot?.signals.repeatedLeadingVerbs).toEqual([
      { verb: "build", count: 2, evidenceIds: ["achievement-1", "achievement-2"] },
      { verb: "develop", count: 2, evidenceIds: ["achievement-3", "achievement-4"] }
    ]);
  });

  it("ignores repeated non-verbs and recognizes common base-form action verbs", () => {
    const snapshot = buildResumeRoastSnapshot(
      resume({
        achievements: [
          "The platform supports customer reporting.",
          "The customer workflow remains manual.",
          "Platform ownership was shared across teams.",
          "Platform monitoring is documented.",
          "Build reliable reporting pipelines.",
          "Built automated billing pipelines."
        ]
      })
    );

    expect(snapshot?.signals.repeatedLeadingVerbs).toEqual([
      { verb: "build", count: 2, evidenceIds: ["achievement-5", "achievement-6"] }
    ]);
  });

  it("flags long bullets and reports stable word-count statistics", () => {
    const longBullet = Array.from(
      { length: RESUME_ROAST_LONG_BULLET_WORD_THRESHOLD + 1 },
      (_, index) => `word${index + 1}`
    ).join(" ");
    const snapshot = buildResumeRoastSnapshot(
      resume({ achievements: ["Built a service.", longBullet] })
    );

    expect(snapshot?.signals.longBulletEvidenceIds).toEqual(["achievement-2"]);
    expect(snapshot?.signals).toMatchObject({ averageWordsPerBullet: 18, maxWordsPerBullet: 33 });
  });

  it("caps compact skills while retaining the original skill-list size", () => {
    const skills = Array.from({ length: RESUME_ROAST_MAX_TOP_SKILLS + 4 }, (_, index) => `Skill ${index + 1}`);
    const snapshot = buildResumeRoastSnapshot(
      resume({ skills: [" TypeScript ", "typescript", ...skills] })
    );

    expect(snapshot?.signals.skillListSize).toBe(RESUME_ROAST_MAX_TOP_SKILLS + 6);
    expect(snapshot?.topSkills).toHaveLength(RESUME_ROAST_MAX_TOP_SKILLS);
    expect(snapshot?.topSkills[0]).toBe("TypeScript");
  });

  it("uses deterministic IDs, de-duplicates exact text, and skips oversized source bullets", () => {
    const duplicated = "Built a durable API for customers.";
    const snapshot = buildResumeRoastSnapshot(
      resume({
        experience: [
          {
            organization: "Example Corp",
            role: "Backend Engineer",
            period: "",
            location: "",
            summary: duplicated,
            achievements: [duplicated],
            skills: []
          }
        ],
        projects: [
          { name: "API", summary: duplicated, outcome: "", skills: [] },
          {
            name: "Oversized",
            summary: "x".repeat(RESUME_ROAST_MAX_EVIDENCE_TEXT_LENGTH + 1),
            outcome: "Launched safely.",
            skills: []
          }
        ],
        achievements: [duplicated]
      })
    );

    expect(snapshot?.evidence).toEqual([
      {
        id: "experience-1-summary",
        kind: "experience-summary",
        text: duplicated,
        context: { role: "Backend Engineer" }
      },
      {
        id: "project-2-outcome",
        kind: "project-outcome",
        text: "Launched safely.",
        context: { project: "Oversized" }
      }
    ]);
    expect(buildResumeRoastSnapshot(resume({ achievements: [duplicated] }))).toEqual(
      buildResumeRoastSnapshot(resume({ achievements: [duplicated] }))
    );
  });

  it("excludes identity and file metadata from the serialized snapshot", () => {
    const snapshot = buildResumeRoastSnapshot(
      resume({
        fullName: "Ada Lovelace",
        fileName: "ada.lovelace@example.com-resume.pdf",
        achievements: ["Built a secure API for 20 users."]
      })
    );
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain("Ada Lovelace");
    expect(serialized).not.toContain("ada.lovelace@example.com-resume.pdf");
    expect(serialized).not.toContain("fullName");
    expect(serialized).not.toContain("fileName");
  });
});
