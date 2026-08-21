import mammoth from "mammoth";
import type { Level } from "@/lib/types";

const MAX_EXTRACTED_CHARACTERS = 24_000;
const MAX_RESUME_PAGES = 5;
export const MIN_RESUME_TEXT_CHARACTERS = 500;

const SECTION_ALIASES = {
  summary: ["summary", "professional summary", "profile", "objective", "career objective"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "employment history",
    "work history"
  ],
  projects: ["project", "projects", "personal projects", "selected projects", "academic projects"],
  education: ["education", "academic background", "academic qualifications"],
  skills: [
    "skill",
    "skills",
    "technical skills",
    "core skills",
    "core competencies",
    "technologies"
  ],
  achievements: ["achievement", "achievements", "awards", "honors", "accomplishments"],
  certifications: ["certification", "certifications", "licenses", "courses"]
} as const;

type ResumeSection = keyof typeof SECTION_ALIASES;

const ACTION_LINE =
  /^(?:[-•▪◦*]\s*)?(?:built|created|developed|designed|implemented|led|owned|launched|improved|reduced|increased|optimized|automated|managed|delivered|architected|migrated|deployed|introduced|integrated|analyzed|researched|collaborated|mentored|scaled|secured|showcased)\b/i;
const CONTRIBUTION_LANGUAGE =
  /\b(?:built|created|developed|designed|implemented|led|owned|launched|improved|reduced|increased|optimized|automated|managed|delivered|architected|migrated|deployed|introduced|integrated|analyzed|researched|collaborated|mentored|scaled|secured|showcased)\b/i;
const JOB_DESCRIPTION_LANGUAGE =
  /\b(?:we are looking for|the ideal candidate|responsibilities include|job description|minimum qualifications|required qualifications|equal opportunity employer|apply now|salary range)\b/i;
const DEGREE_LANGUAGE =
  /\b(?:bachelor|master|b\.?(?:tech|e|sc|a)\b|m\.?(?:tech|e|sc|a|ba)\b|ph\.?d|diploma|university|college|institute|school)\b/i;

type PdfParseModule = typeof import("pdf-parse");

export interface ParsedResumeDocument {
  text: string;
  format: "pdf" | "docx";
  pageCount: number;
  pageCountEstimated: boolean;
}

export interface ResumeDocumentEvidence {
  confidence: number;
  score: number;
  signals: string[];
  warnings: string[];
  identity: {
    name: string;
    emailPresent: boolean;
    phonePresent: boolean;
    profileLinkPresent: boolean;
  };
  sections: ResumeSection[];
  dateRanges: number;
  achievementLines: number;
  quantifiedAchievements: number;
  experienceEntries: number;
  projectEntries: number;
  educationEntries: number;
}

export class ResumeDocumentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ResumeDocumentError";
  }
}

export async function extractResumeDocument(input: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ParsedResumeDocument> {
  const extension = input.fileName.toLowerCase().split(".").pop() ?? "";
  const pdf = extension === "pdf" || input.mimeType === "application/pdf";
  const docx =
    extension === "docx" ||
    input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (!pdf && !docx) {
    throw new ResumeDocumentError("RESUME_TYPE_UNSUPPORTED", "Upload a PDF or DOCX resume.");
  }

  let text = "";
  let pageCount = 1;
  let pageCountEstimated = false;

  if (pdf) {
    if (input.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new ResumeDocumentError(
        "RESUME_FILE_INVALID",
        "This file is named like a PDF, but its contents are not a valid PDF."
      );
    }
    const { PDFParse } = await loadPdfParser();
    const parser = new PDFParse({ data: new Uint8Array(input.buffer) });
    try {
      const parsed = await parser.getText();
      text = parsed.text;
      pageCount = parsed.total;
    } catch {
      text = "";
    } finally {
      await parser.destroy();
    }
  } else {
    if (input.buffer[0] !== 0x50 || input.buffer[1] !== 0x4b) {
      throw new ResumeDocumentError(
        "RESUME_FILE_INVALID",
        "This file is named like a DOCX, but its contents are not a valid DOCX document."
      );
    }
    const parsed = await mammoth.extractRawText({ buffer: input.buffer }).catch(() => null);
    text = parsed?.value ?? "";
    pageCountEstimated = true;
  }

  const normalized = normalizeText(text);

  if (!pdf && normalized.length < MIN_RESUME_TEXT_CHARACTERS) {
    throw new ResumeDocumentError(
      "RESUME_TEXT_MISSING",
      "We could not find enough structured resume content in this DOCX file."
    );
  }

  if (pageCountEstimated) {
    pageCount = Math.max(1, Math.ceil(normalized.length / 3_500));
  }

  if (pageCount > MAX_RESUME_PAGES) {
    throw new ResumeDocumentError(
      "RESUME_TOO_LONG",
      `Upload a focused resume of ${MAX_RESUME_PAGES} pages or fewer.`,
      { pageCount }
    );
  }

  return {
    text: normalized.slice(0, MAX_EXTRACTED_CHARACTERS),
    format: pdf ? "pdf" : "docx",
    pageCount,
    pageCountEstimated
  };
}

async function loadPdfParser(): Promise<PdfParseModule> {
  installPdfNodePolyfills();
  return import("pdf-parse");
}

/**
 * `pdfjs-dist` normally gets these classes from `@napi-rs/canvas`, but Vercel's
 * serverless bundle can omit that nested native package. Text extraction only
 * needs the classes to exist during module initialization; rendering paths are
 * never used by the onboarding parser.
 */
function installPdfNodePolyfills(): void {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = MinimalDOMMatrix as unknown as typeof DOMMatrix;
  }

  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = MinimalImageData as unknown as typeof ImageData;
  }

  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = MinimalPath2D as unknown as typeof Path2D;
  }
}

class MinimalDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: string | number[]) {
    if (Array.isArray(init)) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = [
        init[0] ?? 1,
        init[1] ?? 0,
        init[2] ?? 0,
        init[3] ?? 1,
        init[4] ?? 0,
        init[5] ?? 0
      ];
    }
  }

  multiplySelf(): this {
    return this;
  }

  preMultiplySelf(): this {
    return this;
  }

  translate(): this {
    return this;
  }

  scale(): this {
    return this;
  }

  invertSelf(): this {
    return this;
  }
}

class MinimalImageData {
  readonly data: Uint8ClampedArray;

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    readonly width: number,
    readonly height = typeof dataOrWidth === "number" ? width : 0
  ) {
    this.data =
      dataOrWidth instanceof Uint8ClampedArray
        ? dataOrWidth
        : new Uint8ClampedArray(dataOrWidth * width * 4);
  }
}

class MinimalPath2D {
  addPath(): void {
    // Rendering is not used during resume text extraction.
  }
}

export function withVisualResumeText(
  document: ParsedResumeDocument,
  text: string
): ParsedResumeDocument {
  const normalized = normalizeText(text);
  if (normalized.length < MIN_RESUME_TEXT_CHARACTERS) {
    throw new ResumeDocumentError(
      "RESUME_TEXT_MISSING",
      "We could not read enough resume content from this PDF. Try exporting it with selectable text."
    );
  }

  return {
    ...document,
    text: normalized.slice(0, MAX_EXTRACTED_CHARACTERS)
  };
}

export function inspectResumeDocument(
  document: ParsedResumeDocument,
  level: Level
): ResumeDocumentEvidence {
  const text = document.text;
  const compact = text.replace(/\s+/g, " ").trim();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  rejectKnownNonResumes(compact);

  const sectionLocations = findSections(lines);
  const sections = [...new Set(sectionLocations.map((item) => item.section))];
  const firstSection = sectionLocations[0]?.index ?? Math.min(lines.length, 12);
  const name = findCandidateName(lines.slice(0, Math.max(3, firstSection)));
  const emailPresent = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(compact);
  const phonePresent = hasPhoneNumber(compact);
  const profileLinkPresent =
    /\b(?:linkedin\.com\/in|github\.com\/[^\s/]+|portfolio\b|behance\.net|dribbble\.com)\b/i.test(
      compact
    );
  const contactSignals = [emailPresent, phonePresent, profileLinkPresent].filter(Boolean).length;
  const dateRanges = countMatches(
    compact,
    /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2}|present|current|now)\b/gi
  );
  const yearMarkers = countMatches(compact, /\b(?:19|20)\d{2}\b/g);
  const achievementLines = lines.filter((line) => hasContributionLanguage(line)).length;
  const quantifiedAchievements = lines.filter(
    (line) =>
      ACTION_LINE.test(line) &&
      /(?:\b\d+(?:\.\d+)?%|\$\s?\d|₹\s?\d|\b\d+(?:\.\d+)?x\b|\b\d{2,}\+?\b)/i.test(line)
  ).length;

  const experienceText = sectionBody(lines, sectionLocations, "experience");
  const projectText = sectionBody(lines, sectionLocations, "projects");
  const educationText = sectionBody(lines, sectionLocations, "education");
  const experienceEntries = Math.max(
    countMatches(
      experienceText,
      /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:\b(?:19|20)\d{2}\b|present|current|now)/gi
    ),
    countMatches(
      experienceText,
      /\b(?:engineer|developer|designer|manager|analyst|intern|consultant|architect|researcher|lead)\b/gi
    ) > 0
      ? 1
      : 0
  );
  const projectEntries = sections.includes("projects")
    ? Math.max(
        1,
        Math.min(8, projectText.split("\n").filter((line) => hasContributionLanguage(line)).length)
      )
    : 0;
  const educationEntries =
    sections.includes("education") && DEGREE_LANGUAGE.test(educationText) ? 1 : 0;
  const strongEducationLedEvidence =
    educationEntries >= 1 &&
    achievementLines >= 1 &&
    sections.length >= 4 &&
    (Boolean(name) || contactSignals >= 2) &&
    (sections.includes("summary") ||
      sections.includes("projects") ||
      sections.includes("achievements") ||
      sections.includes("certifications"));

  /**
   * Only signals that a genuine resume cannot plausibly lack are allowed to
   * reject an upload. Everything else is scored and surfaced as a warning: a
   * senior engineer with no Skills heading, an academic CV that runs long, or a
   * header that puts the name on the same line as the contact details all used
   * to be told their real resume was fake.
   */
  const requirements = [
    requirement(
      "a candidate identity in the header",
      Boolean(name) || contactSignals >= 2,
      "Trailgrad could not find a candidate name or contact details in the header."
    ),
    requirement(
      "a dated career timeline",
      dateRanges >= 1 || yearMarkers >= 2 || strongEducationLedEvidence,
      level === "fresher" || level === "0-2"
        ? "Trailgrad could not find education or project evidence for an early-career resume."
        : "Trailgrad could not find dated education, work, or project entries."
    ),
    requirement(
      "personal contribution statements",
      achievementLines >= 2,
      "Trailgrad could not find statements describing what you personally did."
    ),
    requirement(
      level === "fresher" ? "project or work evidence" : "work or project evidence",
      experienceEntries + projectEntries >= 1 ||
        sections.includes("experience") ||
        strongEducationLedEvidence,
      "Trailgrad could not find an experience or projects section with real entries."
    ),
    requirement(
      "at least two recognizable resume sections",
      sections.length >= 2,
      "Trailgrad could not find the sections a resume normally has."
    ),
    requirement(
      "resume-like line structure",
      lines.length >= 12,
      "This document is too short to read as a resume."
    )
  ];

  const failed = requirements.filter((check) => !check.passed);
  if (failed.length > 0) {
    throw new ResumeDocumentError(
      "RESUME_NOT_VERIFIED",
      failed.length === 1
        ? failed[0]!.reason
        : "This document does not have the identity, timeline, and career evidence expected in a real resume.",
      { failedChecks: failed.map((check) => check.label) }
    );
  }

  const softSignals = [
    requirement("a Skills section", sections.includes("skills"), ""),
    requirement("an Education section", educationEntries >= 1, ""),
    requirement("two or more contact signals", contactSignals >= 2, ""),
    requirement("a named candidate", Boolean(name), ""),
    requirement("three or more resume sections", sections.length >= 3, ""),
    requirement("measurable outcomes", quantifiedAchievements > 0, "")
  ];

  const signals = [...requirements, ...softSignals]
    .filter((check) => check.passed)
    .map((check) => check.label);
  const warnings: string[] = [];
  if (quantifiedAchievements === 0) {
    warnings.push("No measurable outcome was detected in the experience bullets.");
  }
  if (dateRanges === 0 && yearMarkers < 2) {
    warnings.push("No dated education, work, or project timeline was detected.");
  }
  if (!profileLinkPresent) warnings.push("No LinkedIn, GitHub, or portfolio profile was detected.");
  if (educationEntries === 0) warnings.push("No education section was detected.");
  if (!sections.includes("skills")) warnings.push("No dedicated skills section was detected.");
  const passedSoftSignals = softSignals.filter((check) => check.passed).length;
  const score = Math.min(
    98,
    64 +
      passedSoftSignals * 3 +
      Math.min(8, quantifiedAchievements * 3) +
      Math.min(8, sections.length)
  );

  return {
    confidence: score / 100,
    score,
    signals,
    warnings,
    identity: { name, emailPresent, phonePresent, profileLinkPresent },
    sections,
    dateRanges,
    achievementLines,
    quantifiedAchievements,
    experienceEntries,
    projectEntries,
    educationEntries
  };
}

function normalizeText(text: string): string {
  return text
    .split("\u0000")
    .join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function rejectKnownNonResumes(text: string): void {
  const mockMarkers = [
    /\blorem ipsum\b/i,
    /\bsample (?:resume|cv)\b/i,
    /\b(?:dummy|mock|example) resume\b/i,
    /\breplace (?:this|with your|with actual)\b/i,
    /\byour name here\b/i,
    /\bexample candidate\b/i,
    /\bresume template\b/i
  ];

  if (mockMarkers.some((marker) => marker.test(text))) {
    throw new ResumeDocumentError(
      "RESUME_TEMPLATE_DETECTED",
      "This looks like a sample or placeholder resume. Upload the resume you actually use for applications."
    );
  }

  if (JOB_DESCRIPTION_LANGUAGE.test(text)) {
    throw new ResumeDocumentError(
      "JOB_DESCRIPTION_DETECTED",
      "This looks like a job description rather than a candidate resume."
    );
  }
}

function hasContributionLanguage(line: string): boolean {
  return ACTION_LINE.test(line) || CONTRIBUTION_LANGUAGE.test(line);
}

function findSections(lines: string[]): Array<{ section: ResumeSection; index: number }> {
  return lines.flatMap((line, index) => {
    // Real resumes decorate headings ("EDUCATION & TRAINING", "Relevant
    // Experience", "TECHNICAL SKILLS ———"), so match the alias as a word inside
    // a heading-shaped line rather than demanding an exact string.
    const normalized = line
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized || normalized.length > 42) return [];
    if (normalized.split(" ").length > 6) return [];
    if (ACTION_LINE.test(line) || !looksLikeHeading(line)) return [];

    for (const [section, aliases] of Object.entries(SECTION_ALIASES) as Array<
      [ResumeSection, readonly string[]]
    >) {
      if (aliases.some((alias) => containsWholePhrase(normalized, alias))) {
        return [{ section, index }];
      }
    }
    return [];
  });
}

function containsWholePhrase(value: string, phrase: string): boolean {
  return value === phrase || ` ${value} `.includes(` ${phrase} `);
}

/**
 * Keeps prose such as "5 years of experience" from registering as a section.
 * Headings are written in caps, in title case, or terminated with a colon.
 */
function looksLikeHeading(line: string): boolean {
  const letters = line.replace(/[^\p{L}\s]/gu, "").trim();
  if (!letters) return false;
  if (/[:|]\s*$/.test(line.trim())) return true;
  if (letters === letters.toUpperCase()) return true;
  return letters.split(/\s+/).every((word) => /^[\p{Lu}]/u.test(word));
}

function findCandidateName(lines: string[]): string {
  const excluded =
    /\b(?:resume|curriculum|vitae|engineer|developer|designer|manager|analyst|student|summary|profile|phone|email)\b/i;
  // A header of "Jane Doe | jane@example.com | +1 555 0100" is as common as a
  // name on its own line, so each separated segment is a candidate.
  const candidates = lines.flatMap((line) => line.split(/[|•·,]|\s{2,}/));

  return (
    candidates
      .map((candidate) => candidate.trim())
      .find((candidate) => {
        if (candidate.length < 4 || candidate.length > 60 || excluded.test(candidate)) return false;
        if (/[@:/\d]/.test(candidate)) return false;
        return /^[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){1,4}$/u.test(candidate);
      }) ?? ""
  );
}

function sectionBody(
  lines: string[],
  locations: Array<{ section: ResumeSection; index: number }>,
  section: ResumeSection
): string {
  const locationIndex = locations.findIndex((location) => location.section === section);
  if (locationIndex < 0) return "";
  const start = (locations[locationIndex]?.index ?? 0) + 1;
  const end = locations[locationIndex + 1]?.index ?? lines.length;
  return lines.slice(start, end).join("\n");
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function hasPhoneNumber(value: string): boolean {
  return (value.match(/\+?\d[\d\s().-]{8,}\d/g) ?? []).some((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  });
}

function requirement(
  label: string,
  passed: boolean,
  reason: string
): { label: string; passed: boolean; reason: string } {
  return { label, passed, reason };
}

