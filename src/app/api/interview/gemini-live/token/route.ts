import {
  ActivityHandling,
  AudioTranscriptionConfigMode,
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity
} from "@google/genai";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAppContainer } from "@/server/app-container";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { existingInterviewOwnerId } from "@/features/interviews/server/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";
import { LIVE_END_OF_SPEECH_SILENCE_MS } from "@/features/interviews/domain/voice-turn-timing";
import { voiceConnectionLifetimeMs } from "@/features/interviews/server/voice-connection-policy";
import type { InterviewState } from "@/features/interviews/server/types";
import type { CandidateProfile } from "@/lib/shared/types";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  purpose: z.enum(["session", "transcription-refresh"]).default("session")
});
const TRANSCRIPTION_VOCABULARY_LIMIT = 100;
export const INTERVIEW_TRANSCRIPTION_LANGUAGE_CODES = ["en-IN", "hi-IN"] as const;
const COMMON_INTERVIEW_VOCABULARY = [
  "React",
  "React.js",
  "Next.js",
  "Node.js",
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "GraphQL",
  "REST API",
  "GitHub",
  "GitLab",
  "Docker",
  "Kubernetes",
  "AWS",
  "Azure",
  "Google Cloud",
  "CI/CD",
  "microservices",
  "full-stack",
  "frontend",
  "backend",
  "system design",
  "machine learning",
  "generative AI"
] as const;

/**
 * Issues a one-use credential for a single browser Live connection. The
 * credential is intentionally not cached: it expires quickly and a reconnect
 * must be explicitly authorised again by this endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiRouteError(400, "BAD_REQUEST", "Validation failed", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const app = getAppContainer();
    if (!app.config.geminiLiveInterviewsEnabled) {
      throw new ApiRouteError(
        503,
        "GEMINI_LIVE_DISABLED",
        "Live interviews are temporarily disabled."
      );
    }

    const ownerId = await existingInterviewOwnerId(request, app.config);
    if (!ownerId) {
      throw new ApiRouteError(401, "INTERVIEW_ACCESS_REQUIRED", "Interview access is required.");
    }

    const state = await app.interviewService.getOwnedActive(ownerId, parsed.data.sessionId);
    if (state.phase === "done") {
      throw new ApiRouteError(409, "SESSION_COMPLETE", "This interview has ended.");
    }

    const remainingMs = voiceConnectionLifetimeMs(state);
    if (remainingMs <= 0) {
      throw new ApiRouteError(409, "SESSION_EXPIRED", "This interview has run out of time.");
    }

    const guard = getSharedGuard(app.config);
    await guard.enforce(RATE_LIMIT_POLICIES.livekitToken, state.id);

    const profile = await app.profileService.get(ownerId);
    const transcriptionVocabulary = buildTranscriptionVocabulary(state, profile);

    const question = state.plan[state.questionIndex];
    const openingUtterance = buildOpeningUtterance(
      state.setup.roundType === "hiring-manager",
      question?.text ?? "Could you tell me a little about yourself?"
    );
    const client = new GoogleGenAI({ apiKey: app.config.geminiApiKey });
    const expiresAt = new Date(Date.now() + Math.min(remainingMs, 29 * 60 * 1000)).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 60_000).toISOString();
    const createTranscriptionToken = () =>
      client.authTokens.create({
        config: {
          uses: 1,
          expireTime: expiresAt,
          newSessionExpireTime,
          liveConnectConstraints: {
            model: app.config.geminiLiveTranscriptionModel,
            config: {
              responseModalities: [Modality.TEXT],
              inputAudioTranscription: buildTranscriptionAudioConfig(transcriptionVocabulary),
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 300,
                  silenceDurationMs: LIVE_END_OF_SPEECH_SILENCE_MS
                }
              }
            }
          }
        }
      });

    if (parsed.data.purpose === "transcription-refresh") {
      const transcriptionToken = await createTranscriptionToken();
      if (!transcriptionToken.name) {
        throw new ApiRouteError(
          502,
          "GEMINI_TRANSCRIPTION_TOKEN_FAILED",
          "Could not refresh interview transcription."
        );
      }
      return apiSuccess({
        transcription: {
          token: transcriptionToken.name,
          model: app.config.geminiLiveTranscriptionModel,
          vocabulary: transcriptionVocabulary,
          languageCodes: [...INTERVIEW_TRANSCRIPTION_LANGUAGE_CODES]
        }
      });
    }

    const createVoiceToken = () =>
      client.authTokens.create({
        config: {
          uses: 1,
          expireTime: expiresAt,
          newSessionExpireTime,
          liveConnectConstraints: {
            model: app.config.geminiLiveModel,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } }
              },
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 300,
                  silenceDurationMs: LIVE_END_OF_SPEECH_SILENCE_MS
                },
                activityHandling: ActivityHandling.NO_INTERRUPTION
              },
              sessionResumption: {}
            }
          }
        }
      });

    const [token, transcriptionToken] = await Promise.all([
      createVoiceToken(),
      createTranscriptionToken()
    ]);

    if (!token.name || !transcriptionToken.name) {
      throw new ApiRouteError(502, "GEMINI_TOKEN_FAILED", "Could not prepare the live interview.");
    }

    return apiSuccess({
      token: token.name,
      model: app.config.geminiLiveModel,
      expiresAt,
      sessionStartedAt: state.startedAt,
      openingUtterance,
      transcription: {
        token: transcriptionToken.name,
        model: app.config.geminiLiveTranscriptionModel,
        vocabulary: transcriptionVocabulary,
        languageCodes: [...INTERVIEW_TRANSCRIPTION_LANGUAGE_CODES]
      },
      systemInstruction: buildSystemInstruction({
        roundTitle: state.setup.templateTitle ?? "Behavioral interview",
        isResumeRound: state.setup.resumeRound === true,
        isHiringManagerRound: state.setup.roundType === "hiring-manager",
        question: question?.text ?? "Ask the current interview question.",
        questionNumber: state.questionIndex + 1,
        questionCount: state.plan.length,
        followUpCount: state.followUpCount,
        maxFollowUps: question?.maxFollowUps ?? 1,
        mustHit: question?.mustHit ?? [],
        openingUtterance,
        pronunciationVocabulary: transcriptionVocabulary
      })
    });
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

export function buildTranscriptionAudioConfig(vocabulary: string[]) {
  return {
    languageCodes: [...INTERVIEW_TRANSCRIPTION_LANGUAGE_CODES],
    customVocabulary: vocabulary,
    // Smart mode is allowed to clean up grammar and perform minor edits. The
    // interview needs the candidate's actual words, especially for negatives,
    // opt-outs, and English/Hindi code-switching.
    mode: AudioTranscriptionConfigMode.VERBATIM
  };
}

export function buildTranscriptionVocabulary(
  state: InterviewState,
  profile: Pick<
    CandidateProfile,
    "targetRole" | "targetCompany" | "headline" | "focusAreas" | "resume"
  >
): string[] {
  const vocabulary = new Map<string, string>();
  const add = (raw: string | null | undefined) => {
    const value = raw
      ?.replace(/\s+/g, " ")
      .trim()
      .replace(/^[,;:|]+|[,;:|]+$/g, "");
    if (!value || value.length < 2 || value.length > 80) return;
    const key = value.toLocaleLowerCase();
    if (!vocabulary.has(key)) vocabulary.set(key, value);
  };
  const addTermsFromText = (text: string | null | undefined) => {
    if (!text) return;
    for (const match of text.matchAll(
      /\b[A-Z][A-Za-z0-9+#.-]*(?:\s+[A-Z][A-Za-z0-9+#.-]*){0,3}\b/g
    )) {
      const value = match[0];
      if (!/^(?:I|A|An|The|To|At|In|On|What|Why|How|Tell|Could|Which)$/i.test(value)) add(value);
    }
  };

  COMMON_INTERVIEW_VOCABULARY.forEach(add);
  add(
    profile.targetRole ? `${profile.targetRole.replace("fullstack", "full-stack")} engineer` : null
  );
  add(profile.targetCompany);
  add(profile.headline);
  profile.focusAreas.forEach(add);
  addTermsFromText(state.setup.context);
  state.setup.agenda?.forEach(addTermsFromText);

  const resume = profile.resume;
  if (resume) {
    add(resume.fullName);
    resume.skills.forEach(add);
    resume.certifications?.forEach(add);
    for (const experience of resume.experience) {
      add(experience.organization);
      add(experience.role);
      experience.skills.forEach(add);
    }
    for (const project of resume.projects) {
      add(project.name);
      project.skills.forEach(add);
    }
    for (const education of resume.education) {
      add(education.institution);
      add(education.credential);
      add(education.field);
    }
  }

  for (const question of state.plan) {
    add(question.skill);
    add(question.competency);
    add(question.evidenceAnchor);
    add(question.dsaTransferQuestion?.title);
    add(question.dsaTransferQuestion?.primaryPattern);
    question.skillKeys?.forEach(add);
    question.mustHit.forEach(add);
    addTermsFromText(question.text);
    addTermsFromText(question.evidenceAnchor);
  }

  return [...vocabulary.values()].slice(0, TRANSCRIPTION_VOCABULARY_LIMIT);
}

export function buildSystemInstruction(input: {
  roundTitle: string;
  isResumeRound: boolean;
  isHiringManagerRound: boolean;
  question: string;
  questionNumber: number;
  questionCount: number;
  followUpCount: number;
  maxFollowUps: number;
  mustHit: string[];
  openingUtterance: string;
  pronunciationVocabulary?: string[];
}): string {
  return `You are James, a formal, exacting senior interviewer conducting a ${input.roundTitle}.
This is a live interview: listen without rushing, do not talk over the candidate, and keep spoken replies concise.
You are on planned question ${input.questionNumber} of ${input.questionCount}. The only current planned question is: ${input.question}
The answer should cover: ${input.mustHit.join(", ") || "the question itself"}.
Known candidate, company, project, and technical terms are: ${input.pronunciationVocabulary?.slice(0, 100).join(", ") || "none supplied"}. Preserve their spelling and pronounce them naturally.
The server allows ${input.maxFollowUps} useful follow-up maximum; ${input.followUpCount} have already been used. Never ask another follow-up once that limit is reached.
${input.isHiringManagerRound ? "This is a final HR and behavioural conversation. Listen for motivation, judgement, collaboration, accountability, self-awareness, personal action, and outcomes. Do not turn it into a technical screen." : input.isResumeRound ? "This is a resume-defense round. Ask for concrete ownership, decisions, trade-offs, and outcomes from the candidate's own experience." : "Use the current question and its format. For technical, coding, or multiple-choice questions, let the candidate reason aloud and accept typed answers as authoritative submissions."}
At the start of this session, say this opening exactly and completely: ${input.openingUtterance}
You must never ask a question that is not supplied by the interview server. Do not substitute a similar question or choose a resume topic yourself.
After a candidate finishes a substantive answer, do not answer, score, advance, repeat the question, or invent a follow-up. The browser submits the finalized transcript directly to the interview server. Wait silently for the server's next text instruction.
When the interview server sends an exact response, speak it exactly once without adding, removing, or changing anything. Do not insert a separate processing acknowledgement.`;
}

export function buildOpeningUtterance(isHiringManagerRound: boolean, question: string): string {
  if (isHiringManagerRound) {
    return `Hi, thanks for joining me today. We’ll have a straightforward conversation about your background, what you want next, and how you work with others. To start, ${question}`;
  }
  return `Hi, thanks for joining me. We’ll talk through your background, recent work, and a few things from your resume. To begin, ${question}`;
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
