import type {
  Level,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry
} from "@/lib/types";
import type { ResumeDocumentEvidence } from "./document";
import type { ResumeAnalysis } from "./service";

/** Model confidence below this is treated as an unverified document. */
const MINIMUM_DOCUMENT_CONFIDENCE = 0.82;
/** Quotes shorter than this match too much of an ordinary resume to prove anything. */
const MINIMUM_QUOTE_LENGTH = 8;
/** Organisation and project names are short, so they match as whole tokens. */
const MINIMUM_IDENTIFIER_LENGTH = 4;

export interface GroundedResumeEvidence {
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
  projects: ResumeProjectEntry[];
  achievements: string[];
}

/**
 * Answers one question only: is this document a real candidate's resume?
 *
 * How much practice material the model managed to write is deliberately not
 * part of this verdict. Folding the two together meant a thin roadmap was
 * reported to the candidate as "this is not a real resume".
 */
export function verifyResumeDocument(
  analysis: ResumeAnalysis,
  context?: { level: Level; evidence: ResumeDocumentEvidence }
): boolean {
  const acceptedDocumentType = analysis.documentType === "resume" || analysis.documentType === "cv";
  const strongEducationLedEvidence = context
    ? hasStrongEducationLedEvidence(context.evidence)
    : false;
  const chronologySupported = analysis.chronologyCoherent || strongEducationLedEvidence;
  const careerEvidenceSupported = analysis.personalCareerEvidence || strongEducationLedEvidence;

  return (
    acceptedDocumentType &&
    analysis.isLikelyResume &&
    analysis.confidence >= MINIMUM_DOCUMENT_CONFIDENCE &&
    analysis.candidateIdentitySupported &&
    chronologySupported &&
    careerEvidenceSupported
  );
}

function hasStrongEducationLedEvidence(evidence: ResumeDocumentEvidence): boolean {
  const contactSignals = [
    evidence.identity.emailPresent,
    evidence.identity.phonePresent,
    evidence.identity.profileLinkPresent
  ].filter(Boolean).length;

  return (
    evidence.educationEntries >= 1 &&
    evidence.achievementLines >= 1 &&
    evidence.sections.length >= 4 &&
    (Boolean(evidence.identity.name) || contactSignals >= 2)
  );
}

/**
 * Keeps only the entries traceable back to the uploaded document, through
 * either the verbatim quote the model was asked for or the organisation,
 * institution, or project name it claims. Requiring the quote alone silently
 * deleted real entries whenever the model paraphrased by a single word.
 */
export function groundResumeEvidence(
  analysis: ResumeAnalysis,
  sourceText: string
): GroundedResumeEvidence {
  const source = normalizeEvidence(sourceText);

  return {
    experience: analysis.experience
      .filter((entry) => isGrounded(source, entry.evidenceQuote, entry.organization))
      .map((entry) => ({
        organization: entry.organization,
        role: entry.role,
        period: entry.period,
        location: entry.location,
        summary: entry.summary,
        achievements: entry.achievements,
        skills: entry.skills
      })),
    education: analysis.education
      .filter((entry) => isGrounded(source, entry.evidenceQuote, entry.institution))
      .map((entry) => ({
        institution: entry.institution,
        credential: entry.credential,
        field: entry.field,
        period: entry.period
      })),
    projects: analysis.projects
      .filter((entry) => isGrounded(source, entry.evidenceQuote, entry.name))
      .map((entry) => ({
        name: entry.name,
        summary: entry.summary,
        outcome: entry.outcome,
        skills: entry.skills
      })),
    achievements: analysis.achievements.filter((achievement) => quoteAppears(achievement, source))
  };
}

export function hasGroundedEvidence(evidence: GroundedResumeEvidence): boolean {
  return evidence.experience.length + evidence.projects.length + evidence.education.length > 0;
}

function isGrounded(source: string, quote: string, identifier: string): boolean {
  return quoteAppears(quote, source) || identifierAppears(identifier, source);
}

function quoteAppears(quote: string, source: string): boolean {
  const needle = normalizeEvidence(quote);
  return needle.length >= MINIMUM_QUOTE_LENGTH && source.includes(needle);
}

function identifierAppears(identifier: string, source: string): boolean {
  const needle = normalizeEvidence(identifier);
  return needle.length >= MINIMUM_IDENTIFIER_LENGTH && ` ${source} `.includes(` ${needle} `);
}

function normalizeEvidence(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}+#.%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

