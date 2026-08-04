import {
  inspectResumeDocument,
  type ParsedResumeDocument,
  ResumeDocumentError,
  withVisualResumeText
} from "./resume-document";

const realResumeText = `
Nikhil Verma
nikhil@example.com | +91 98765 43210 | linkedin.com/in/nikhil-verma

PROFESSIONAL SUMMARY
Software engineer focused on reliable web applications, APIs, and production observability.

EXPERIENCE
Software Engineer, Acme Systems | Jan 2023 - Present
- Built a real-time interview platform using TypeScript, React, PostgreSQL, and WebRTC.
- Designed the session state machine and improved reconnect success by 28%.
- Led production incident reviews and implemented monitoring dashboards for latency and errors.

Software Engineering Intern, Example Labs | Jun 2022 - Dec 2022
- Developed API integrations and reduced repeated database queries through a Redis cache layer.

PROJECTS
Collaborative editor | 2021 - 2022
- Created an offline-first synchronization engine for concurrent document editing.
- Implemented automated tests and deployment checks for the first internal release.

EDUCATION
Bachelor of Technology in Computer Science, Example University | 2019 - 2023

SKILLS
TypeScript, React, Node.js, PostgreSQL, Redis, Docker, WebRTC, testing, observability
`;

const fresherResumeText = `
K Mahesh Babu
kmaheshbabu733@gmail.com • +91 9014-633-596 • Madanapalle, AP, India • linkedin.com/in/mahesh-babu-AI

SUMMARY
Emerging AI Engineer with hands-on experience in LLM-powered applications, multi-agent
orchestration, and voice AI systems. Built Talk2Campus AI, a multilingual voice assistant, and a
Multi-Agent Orchestration System with Groq/OpenAI LLM routing and shared memory. Driven to deliver
production-ready GenAI solutions.

EDUCATION
Madanapalle Institute of Technology & Science (MITS)
Master of Computer Applications (MCA)

S.D.H.R Degree College
Bachelor of Computer Applications (BCA) • AI & Data Science
CGPA: 8.20

Sunku Usha Gouthami Junior College, APBIE Board
Intermediate (Class 12) • CEC
85.2%

LICENSES & CERTIFICATIONS
Scientific Computing with Python
FreeCodeCamp

Python Full Stack Development
Sattva Infotech

SKILLS
Python • Java • C • Google Gemini • OpenAI GPT • Groq • Prompt Engineering • RAG • Vector Databases
• Multi-Agent AI

HONORS & AWARDS
Singularity Summit Project Expo
Showcased Talk2Campus AI demonstrating voice AI and multilingual LLM capabilities to industry
professionals.

FDP Participant
Redefining the Role of English in the AI Era.
`;

function document(text: string): ParsedResumeDocument {
  return { text, format: "pdf", pageCount: 2, pageCountEstimated: false };
}

describe("resume document inspection", () => {
  it("hydrates a visually read PDF before applying resume checks", () => {
    const hydrated = withVisualResumeText(document(""), realResumeText);

    expect(hydrated.text).toContain("Nikhil Verma");
    expect(inspectResumeDocument(hydrated, "3-5").identity.name).toBe("Nikhil Verma");
  });

  it("rejects a visual PDF when document reading still returns too little content", () => {
    expect(() => withVisualResumeText(document(""), "Nikhil Verma")).toThrow(
      expect.objectContaining<Partial<ResumeDocumentError>>({ code: "RESUME_TEXT_MISSING" })
    );
  });

  it("accepts a structured candidate resume with identity, chronology, and career evidence", () => {
    const result = inspectResumeDocument(document(realResumeText), "3-5");

    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.identity).toMatchObject({
      name: "Nikhil Verma",
      emailPresent: true,
      phonePresent: true,
      profileLinkPresent: true
    });
    expect(result.sections).toEqual(
      expect.arrayContaining(["summary", "experience", "projects", "education", "skills"])
    );
    expect(result.experienceEntries).toBeGreaterThanOrEqual(1);
    expect(result.achievementLines).toBeGreaterThanOrEqual(2);
  });

  it("accepts a fresher resume with education and project evidence instead of work history", () => {
    const result = inspectResumeDocument(document(fresherResumeText), "fresher");

    expect(result.identity).toMatchObject({
      name: "K Mahesh Babu",
      emailPresent: true,
      phonePresent: true,
      profileLinkPresent: true
    });
    expect(result.sections).toEqual(
      expect.arrayContaining(["summary", "education", "certifications", "skills", "achievements"])
    );
    expect(result.educationEntries).toBe(1);
    expect(result.achievementLines).toBeGreaterThanOrEqual(2);
    expect(result.warnings).toContain(
      "No dated education, work, or project timeline was detected."
    );
  });

  it("warns instead of rejecting when an education-led resume is uploaded for early career", () => {
    const result = inspectResumeDocument(document(fresherResumeText), "0-2");

    expect(result.identity.name).toBe("K Mahesh Babu");
    expect(result.educationEntries).toBe(1);
    expect(result.warnings).toContain(
      "No dated education, work, or project timeline was detected."
    );
  });

  it("rejects explicit sample and placeholder resumes", () => {
    expect(() =>
      inspectResumeDocument(document(`${realResumeText}\nSAMPLE RESUME`), "3-5")
    ).toThrow(
      expect.objectContaining<Partial<ResumeDocumentError>>({
        code: "RESUME_TEMPLATE_DETECTED"
      })
    );
  });

  it("rejects job descriptions even when they contain resume vocabulary", () => {
    const jobDescription = `${realResumeText}\nJob description: We are looking for an engineer. Responsibilities include shipping APIs.`;

    expect(() => inspectResumeDocument(document(jobDescription), "3-5")).toThrow(
      expect.objectContaining<Partial<ResumeDocumentError>>({
        code: "JOB_DESCRIPTION_DETECTED"
      })
    );
  });

  it("rejects a keyword-stuffed document with Skills and Education headings", () => {
    const keywordDump = `
Random Technical Notes
random@example.com | 2023 - 2024

SKILLS
JavaScript React Node PostgreSQL Docker Kubernetes AWS communication leadership

EDUCATION
University Bachelor degree engineering computer science certification coursework

EXPERIENCE
2021 - 2022 software developer engineer manager analyst intern consultant
Architecture databases APIs cloud systems testing performance reliability security

PROJECTS
2022 - 2023 project product platform application service dashboard analytics

This page repeats popular resume keywords but does not identify a candidate, provide a real phone
or profile, describe attributable work, name an employer, or establish a personal career history.
Additional prose is included only to make the document long enough for parsing and should never be
treated as evidence of a candidate resume. The words skills, education, experience, and projects are
labels without concrete entries or contribution statements. Technology names alone are not proof.
`;

    expect(() => inspectResumeDocument(document(keywordDump), "3-5")).toThrow(
      expect.objectContaining<Partial<ResumeDocumentError>>({
        code: "RESUME_NOT_VERIFIED"
      })
    );
  });

  it("does not mistake a date range for a phone number", () => {
    const withoutRealContact = realResumeText
      .replace("+91 98765 43210 | linkedin.com/in/nikhil-verma", "2023 - 2024")
      .replace("linkedin.com/in/nikhil-verma", "");

    const result = inspectResumeDocument(document(withoutRealContact), "3-5");

    expect(result.identity.phonePresent).toBe(false);
    expect(result.identity.profileLinkPresent).toBe(false);
  });

  it("accepts a senior resume with no Skills section and warns instead of rejecting", () => {
    const withoutSkills = realResumeText.slice(0, realResumeText.indexOf("SKILLS"));

    const result = inspectResumeDocument(document(withoutSkills), "5-plus");

    expect(result.sections).not.toContain("skills");
    expect(result.warnings).toContain("No dedicated skills section was detected.");
  });

  it("accepts a resume with no Education section", () => {
    const withoutEducation = realResumeText.replace(
      "EDUCATION\nBachelor of Technology in Computer Science, Example University | 2019 - 2023\n",
      ""
    );

    const result = inspectResumeDocument(document(withoutEducation), "5-plus");

    expect(result.educationEntries).toBe(0);
    expect(result.warnings).toContain("No education section was detected.");
  });

  it("recognises decorated and reworded section headings", () => {
    const decorated = realResumeText
      .replace("EXPERIENCE", "RELEVANT EXPERIENCE")
      .replace("EDUCATION", "Education & Training")
      .replace("SKILLS", "Technical Skills:");

    const result = inspectResumeDocument(document(decorated), "3-5");

    expect(result.sections).toEqual(expect.arrayContaining(["experience", "education", "skills"]));
  });

  it("does not treat prose mentioning a section word as a heading", () => {
    const withProse = realResumeText.replace(
      "PROFESSIONAL SUMMARY",
      "PROFESSIONAL SUMMARY\n5 years of experience"
    );

    const result = inspectResumeDocument(document(withProse), "3-5");
    const experienceHeadings = result.sections.filter((section) => section === "experience");

    expect(experienceHeadings).toHaveLength(1);
  });

  it("finds a candidate name that shares its line with contact details", () => {
    const inlineHeader = realResumeText.replace(
      "Nikhil Verma\nnikhil@example.com | +91 98765 43210 | linkedin.com/in/nikhil-verma",
      "Nikhil Verma | nikhil@example.com | +91 98765 43210 | linkedin.com/in/nikhil-verma"
    );

    expect(inspectResumeDocument(document(inlineHeader), "3-5").identity.name).toBe("Nikhil Verma");
  });

  it("accepts a long multi-page CV instead of rejecting it on line count", () => {
    const longCv = `${realResumeText}\n${Array.from(
      { length: 120 },
      (_, index) => `- Delivered internal tooling improvement number ${index + 1} for the team.`
    ).join("\n")}`;

    expect(() => inspectResumeDocument(document(longCv), "5-plus")).not.toThrow();
  });

  it("rejects long unrelated documents without candidate evidence", () => {
    const unrelated = `This document explains a general product strategy and market landscape. `
      .repeat(80)
      .trim();

    expect(() => inspectResumeDocument(document(unrelated), "fresher")).toThrow(
      expect.objectContaining<Partial<ResumeDocumentError>>({
        code: "RESUME_NOT_VERIFIED"
      })
    );
  });
});
