import {
  groundResumeEvidence,
  hasGroundedEvidence,
  verifyResumeDocument
} from "./verification";
import type { ResumeAnalysis } from "./service";

const sourceText = `Nikhil Verma
nikhil@example.com | +91 98765 43210

EXPERIENCE
Software Engineer, Acme Systems | Jan 2023 - Present
- Designed the session state machine and improved reconnect success by 28%.

PROJECTS
Collaborative editor
- Created an offline-first synchronization engine for concurrent document editing.

EDUCATION
Bachelor of Technology in Computer Science, Example University | 2019 - 2023`;

function analysis(overrides: Partial<ResumeAnalysis> = {}): ResumeAnalysis {
  return {
    documentType: "resume",
    isLikelyResume: true,
    confidence: 0.95,
    rejectionReason: "",
    candidateIdentitySupported: true,
    chronologyCoherent: true,
    personalCareerEvidence: true,
    evidenceCounts: {
      experienceEntries: 1,
      projectEntries: 1,
      educationEntries: 1,
      quantifiedAchievements: 1
    },
    fullName: "Nikhil Verma",
    headline: "Software engineer",
    summary: "Builds reliable web applications.",
    skills: ["TypeScript"],
    focusAreas: ["Ownership"],
    stories: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    achievements: [],
    practiceQuestions: [],
    roadmap: [],
    warnings: [],
    ...overrides
  };
}

function experienceEntry(overrides: Partial<ResumeAnalysis["experience"][number]> = {}) {
  return {
    organization: "Acme Systems",
    role: "Software Engineer",
    period: "Jan 2023 - Present",
    location: "",
    summary: "Owned the interview session lifecycle.",
    achievements: [],
    skills: [],
    evidenceQuote: "Designed the session state machine and improved reconnect success by 28%.",
    ...overrides
  };
}

describe("verifyResumeDocument", () => {
  it("accepts a resume the model is confident about", () => {
    expect(verifyResumeDocument(analysis())).toBe(true);
  });

  it("accepts resumes when deterministic evidence supports an education-led profile", () => {
    expect(
      verifyResumeDocument(analysis({ chronologyCoherent: false, personalCareerEvidence: false }), {
        level: "0-2",
        evidence: {
          confidence: 0.82,
          score: 82,
          signals: [],
          warnings: [],
          identity: {
            name: "K Mahesh Babu",
            emailPresent: true,
            phonePresent: true,
            profileLinkPresent: true
          },
          sections: ["summary", "education", "certifications", "skills", "achievements"],
          dateRanges: 0,
          achievementLines: 2,
          quantifiedAchievements: 1,
          experienceEntries: 0,
          projectEntries: 0,
          educationEntries: 1
        }
      })
    ).toBe(true);
  });

  it("rejects documents the model classified as something other than a resume", () => {
    expect(verifyResumeDocument(analysis({ documentType: "job_description" }))).toBe(false);
    expect(verifyResumeDocument(analysis({ isLikelyResume: false }))).toBe(false);
    expect(verifyResumeDocument(analysis({ confidence: 0.5 }))).toBe(false);
    expect(verifyResumeDocument(analysis({ candidateIdentitySupported: false }))).toBe(false);
    expect(verifyResumeDocument(analysis({ chronologyCoherent: false }))).toBe(false);
    expect(verifyResumeDocument(analysis({ personalCareerEvidence: false }))).toBe(false);
  });

  it("does not treat thin practice material as an unverified document", () => {
    const thin = analysis({ stories: [], practiceQuestions: [], roadmap: [], skills: [] });

    expect(verifyResumeDocument(thin)).toBe(true);
  });
});

describe("groundResumeEvidence", () => {
  it("keeps entries whose verbatim quote appears in the document", () => {
    const grounded = groundResumeEvidence(
      analysis({ experience: [experienceEntry()] }),
      sourceText
    );

    expect(grounded.experience).toHaveLength(1);
    expect(grounded.experience[0]).toMatchObject({
      organization: "Acme Systems",
      role: "Software Engineer"
    });
  });

  it("keeps an entry when the model paraphrases the quote but names a real employer", () => {
    const paraphrased = experienceEntry({
      evidenceQuote: "Designed a session state machine that improved reconnects by 28 percent."
    });

    const grounded = groundResumeEvidence(analysis({ experience: [paraphrased] }), sourceText);

    expect(grounded.experience).toHaveLength(1);
  });

  it("drops an entry that names an employer absent from the document", () => {
    const invented = experienceEntry({
      organization: "Globex Corporation",
      evidenceQuote: "Led the Globex platform rewrite across four teams."
    });

    const grounded = groundResumeEvidence(analysis({ experience: [invented] }), sourceText);

    expect(grounded.experience).toHaveLength(0);
  });

  it("grounds education and projects through their institution and project names", () => {
    const grounded = groundResumeEvidence(
      analysis({
        education: [
          {
            institution: "Example University",
            credential: "B.Tech",
            field: "Computer Science",
            period: "2019 - 2023",
            evidenceQuote: "paraphrased beyond recognition"
          }
        ],
        projects: [
          {
            name: "Collaborative editor",
            summary: "Offline-first sync",
            outcome: "",
            skills: [],
            evidenceQuote: "also paraphrased"
          }
        ]
      }),
      sourceText
    );

    expect(grounded.education).toHaveLength(1);
    expect(grounded.projects).toHaveLength(1);
  });

  it("keeps only achievements copied from the document", () => {
    const grounded = groundResumeEvidence(
      analysis({
        achievements: [
          "improved reconnect success by 28%",
          "Grew revenue by 400% across three continents"
        ]
      }),
      sourceText
    );

    expect(grounded.achievements).toEqual(["improved reconnect success by 28%"]);
  });

  it("reports no grounded evidence when every entry was invented", () => {
    const grounded = groundResumeEvidence(
      analysis({
        experience: [
          experienceEntry({
            organization: "Globex",
            evidenceQuote: "Ran the Globex migration end to end."
          })
        ]
      }),
      sourceText
    );

    expect(hasGroundedEvidence(grounded)).toBe(false);
  });
});
