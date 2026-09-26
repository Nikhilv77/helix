import { lockAiMlPracticeOwner } from "./cohort-lock";
import { evaluateWrittenPracticeAnswer } from "@/features/practice/shared/server/written-answer-evaluator";
import {
  AiMlPracticeQuestionStatus,
  AiMlPracticeSessionStatus,
  AiMlPracticeTrack as DatabaseTrack,
  Prisma
} from "@prisma/client";
import {
  storyPracticeAttemptFeedbackSchema,
  interactivePracticeAttemptInputSchema,
  storyPracticeLearnInputSchema,
  storyPracticeRevealHintInputSchema,
  interactivePracticeSaveDraftInputSchema
} from "@/features/practice/shared/domain/story-practice-contracts";
import type { AiMlStoryQuestion } from "../domain/ai-ml-story-catalog";
import { aiMlQuickCheckQuestionById } from "../domain/ai-ml-quick-check-catalog";
import {
  storyDiscipline,
  storyDisciplinePaths,
  isStoryDiscipline,
  type StoryDiscipline
} from "@/features/practice/story-tracks/domain/story-disciplines";
import type { PersistedAiMlPracticeTrack } from "../domain/ai-ml-practice";
import {
  recommendAiMlPractice,
  type AiMlPracticePath,
  type AiMlPracticeRecommendation
} from "../domain/personalized-practice";
import { AI_ML_RESUME_PATH_KEY } from "../domain/resume-practice-path";
import type { CandidateProfile } from "@/lib/shared/types";
import type {
  StoryPracticeAttemptWork,
  StoryPracticeAttemptFeedbackView,
  StoryPracticeBlockView,
  StoryPracticeQuestionView
} from "@/features/practice/shared/ui/view-contracts";
import {
  interactiveResponseError,
  type PracticeInteraction,
  type InteractionCriterion
} from "@/features/practice/shared/domain/interactive-response";
import { evaluateInteractiveResponse } from "@/features/practice/shared/server/interactive-evaluator";
import {
  assertStoryPracticeWorkMatchesQuestion,
  assertStoryPracticeHintOrder
} from "@/features/practice/shared/server/practice-orchestrator";
import { storyPracticeFingerprint } from "@/features/practice/shared/server/practice-orchestrator";
import type { AiService } from "@/server/ai/ai.service";
import { BadRequestErrorException } from "@/server/common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import type { AiMlPracticeService } from "./ai-ml-practice.service";

const CONTENT_VERSION = 3;
const QUICK_CHECK_CONTENT_VERSION = 4;
const LEGACY_HINTS = [
  "Identify what the model is meant to improve for users.",
  "Compare the failing live input with the evaluation data.",
  "Choose a check that tests the production outcome, not a training proxy."
] as const;

type SessionRow = Prisma.AiMlPracticeSessionGetPayload<{
  include: { questions: { include: { attempt: true } } };
}>;
type QuestionRow = SessionRow["questions"][number];

const QUESTION_VIEW_INCLUDE = {
  attempt: true,
  session: {
    select: {
      track: true,
      discipline: true,
      questions: {
        select: { id: true, publicSnapshot: true },
        orderBy: { order: "asc" }
      }
    }
  }
} as const satisfies Prisma.AiMlPracticeQuestionInclude;
type QuestionViewRow = Prisma.AiMlPracticeQuestionGetPayload<{
  include: typeof QUESTION_VIEW_INCLUDE;
}>;

export type AiMlStorySession = {
  discipline: StoryDiscipline;
  track: PersistedAiMlPracticeTrack;
  blocks: StoryPracticeBlockView[];
  totalQuestions: number;
  terminalQuestions: number;
  recommendation: AiMlPracticeRecommendation | null;
};

export class AiMlStoryPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacy: AiMlPracticeService,
    private readonly ai: Pick<AiService, "generateStructured">
  ) {}

  async session(
    ownerId: string,
    track: PersistedAiMlPracticeTrack,
    profile?: CandidateProfile,
    discipline: StoryDiscipline = "ai-ml"
  ): Promise<AiMlStorySession> {
    const definition = storyDiscipline(discipline);
    // Published sessions are immutable apart from answers and drafts. The
    // usual GET can read them without a transaction or an owner-wide lock.
    const existing = await this.load(ownerId, discipline, track);
    if (existing && this.isPublished(existing, discipline, track, profile)) {
      return this.view(existing, discipline, track, profile);
    }
    // AI/ML cohorts start from the original eight-question quick check.
    if (discipline === "ai-ml") await this.legacy.session(ownerId, track);
    const row = await this.prisma.$transaction(async (tx) => {
      await lockAiMlPracticeOwner(tx, ownerId);
      let row: SessionRow | null =
        (await this.load(ownerId, discipline, track, tx)) ??
        (await this.createSession(tx, ownerId, discipline, track));
      const resumePath = profile ? definition.resumePath(profile, track) : null;
      const authored = [
        ...definition.paths(track).flatMap((path) => path.questions),
        ...(resumePath?.questions ?? [])
      ];
      const present = new Set(row.questions.map((question) => question.questionKey));
      const missing = authored.filter((question) => !present.has(question.id));
      if (missing.length) {
        const sessionId = row.id;
        // Existing sessions may already occupy the earlier story order slots.
        // New authored questions append instead of colliding with frozen rows.
        const reservedOrders = discipline === "ai-ml" ? 8 : 0;
        const nextOrder =
          Math.max(reservedOrders, ...row.questions.map((question) => question.order)) + 1;
        const result = await tx.aiMlPracticeQuestion.createMany({
          data: missing.map((question, index) => ({
            sessionId,
            ownerId,
            questionKey: question.id,
            order: nextOrder + index,
            contentVersion: CONTENT_VERSION,
            contentFingerprint: storyPracticeFingerprint(question),
            publicSnapshot: json({
              id: question.id,
              title: question.title,
              prompt: question.prompt,
              options: (question.choices ?? []).map((label, index) => ({
                id: String(index),
                label
              })),
              pathKey: question.pathKey,
              ...(resumePath && question.pathKey === resumePath.key
                ? {
                    pathTitle: resumePath.title,
                    pathDescription: resumePath.description,
                    pathExpectedMinutes: resumePath.expectedMinutes
                  }
                : {}),
              format: question.format,
              artifact: question.artifact,
              topicKeys: question.topicKeys,
              interaction: question.interaction,
              interviewConnection: question.interviewConnection
            }),
            privateSnapshot: json({
              interactionRubric: question.interactionRubric,
              answer: question.answer,
              hints: question.hints,
              rubric: question.rubric,
              correctChoiceIndex: question.correctChoiceIndex,
              commonMistakes: question.commonMistakes,
              interviewerFollowUps: question.interviewerFollowUps
            })
          })),
          skipDuplicates: true
        });
        if (result.count) {
          await tx.aiMlPracticeSession.update({
            where: { id: row.id },
            data: { status: AiMlPracticeSessionStatus.ACTIVE, completedAt: null }
          });
        }
        row = await this.load(ownerId, discipline, track, tx);
        if (!row) throw new Error("Story practice session disappeared");
      }
      // Submitted answers stay frozen. Unsubmitted selections and hints are
      // archived with the old snapshot before an active question is revised.
      const quickCheck = definition.quickCheck(track);
      const quickByKey = new Map(
        (quickCheck?.questions ?? []).map((question) => [question.id, question])
      );
      const candidates = row.questions.filter(
        (question) =>
          quickByKey.has(question.questionKey) &&
          question.contentVersion < QUICK_CHECK_CONTENT_VERSION &&
          question.status === AiMlPracticeQuestionStatus.ACTIVE &&
          !question.attempt
      );
      if (candidates.length) {
        const changed = await Promise.all(
          candidates.map((question) => {
            const authoredQuestion = quickByKey.get(question.questionKey)!;
            const snapshots = quickCheckSnapshots(authoredQuestion, question);
            return tx.aiMlPracticeQuestion.updateMany({
              where: {
                id: question.id,
                ownerId,
                status: AiMlPracticeQuestionStatus.ACTIVE,
                contentVersion: { lt: QUICK_CHECK_CONTENT_VERSION },
                revealedHintCount: question.revealedHintCount,
                draft: {
                  equals: question.draft == null ? Prisma.AnyNull : json(question.draft)
                },
                attempt: { is: null }
              },
              data: {
                contentVersion: QUICK_CHECK_CONTENT_VERSION,
                contentFingerprint: storyPracticeFingerprint(snapshots),
                publicSnapshot: json(snapshots.publicSnapshot),
                privateSnapshot: json(snapshots.privateSnapshot),
                draft: Prisma.JsonNull,
                revealedHintCount: 0
              }
            });
          })
        );
        if (changed.some((result) => result.count > 0)) {
          row = await this.load(ownerId, discipline, track, tx);
          if (!row) throw new Error("Story practice session disappeared");
        }
      }
      return row;
    });
    return this.view(row, discipline, track, profile);
  }

  /** Non-AI/ML cohorts have no legacy questions, so the row starts empty. */
  private async createSession(
    tx: Prisma.TransactionClient,
    ownerId: string,
    discipline: StoryDiscipline,
    track: PersistedAiMlPracticeTrack
  ): Promise<SessionRow> {
    const copy = storyDiscipline(discipline).tracks[track];
    await tx.aiMlPracticeSession.create({
      data: {
        ownerId,
        discipline,
        track: databaseTrack(track),
        schemaVersion: 1,
        contentVersion: CONTENT_VERSION,
        contentFingerprint: storyPracticeFingerprint(storyDisciplinePaths(discipline, track)),
        titleSnapshot: copy.title,
        descriptionSnapshot: copy.purpose
      }
    });
    const row = await this.load(ownerId, discipline, track, tx);
    if (!row) throw new Error("Story practice session was not created");
    return row;
  }

  private isPublished(
    row: SessionRow,
    discipline: StoryDiscipline,
    track: PersistedAiMlPracticeTrack,
    profile?: CandidateProfile
  ): boolean {
    const definition = storyDiscipline(discipline);
    const resumePath = profile ? definition.resumePath(profile, track) : null;
    const required = [
      ...storyDisciplinePaths(discipline, track).flatMap((path) => path.questions),
      ...(resumePath?.questions ?? [])
    ];
    const present = new Map(row.questions.map((question) => [question.questionKey, question]));
    if (required.some((question) => !present.has(question.id))) return false;
    const quickKeys = new Set(
      (definition.quickCheck(track)?.questions ?? []).map((question) => question.id)
    );
    return !row.questions.some(
      (question) =>
        quickKeys.has(question.questionKey) &&
        question.contentVersion < QUICK_CHECK_CONTENT_VERSION &&
        question.status === AiMlPracticeQuestionStatus.ACTIVE &&
        !question.attempt
    );
  }

  private view(
    row: SessionRow,
    discipline: StoryDiscipline,
    track: PersistedAiMlPracticeTrack,
    profile?: CandidateProfile
  ): AiMlStorySession {
    const candidateRole = storyDiscipline(discipline).candidateRole;
    const paths: AiMlPracticePath[] = [
      ...savedPersonalizedPaths(row.questions, AI_ML_RESUME_PATH_KEY),
      ...storyDisciplinePaths(discipline, track)
    ];
    const recommendation = profile
      ? recommendAiMlPractice({ profile, paths, questions: row.questions })
      : null;
    const currentPath =
      recommendation?.blockId ??
      paths.find((path) =>
        row!.questions.some(
          (question) => pathKey(question) === path.key && question.status === "ACTIVE"
        )
      )?.key;
    const blocks = paths.map((path, index) => {
      const questions = row!.questions.filter((question) => pathKey(question) === path.key);
      return {
        id: path.key,
        ordinal: index + 1,
        isCurrent: path.key === currentPath,
        status:
          questions.length > 0 && questions.every((question) => question.status !== "ACTIVE")
            ? ("COMPLETED" as const)
            : ("PRACTISING" as const),
        story: {
          key: path.key,
          title: path.title,
          premise: path.description,
          incident: path.description,
          candidateRole,
          primaryTopicKey: path.key,
          secondaryTopicKeys: [],
          mechanismKeys: [],
          difficulty: "guided" as const,
          expectedMinutes: path.expectedMinutes,
          stages: questions.map((question, stageIndex) => ({
            order: stageIndex + 1,
            title: stageTitle(question, track, stageIndex)
          }))
        },
        selection: {
          difficulty: "guided" as const,
          reason: recommendation?.blockId === path.key ? recommendation.reason : path.description
        },
        questions: questions.map((question, stageIndex) =>
          publicQuestion(question, path.key, stageIndex + 1, track)
        ),
        assessment: null
      } satisfies StoryPracticeBlockView;
    });
    const visiblePathKeys = new Set(paths.map((path) => path.key));
    const visibleQuestions = row.questions.filter((question) =>
      visiblePathKeys.has(pathKey(question))
    );
    return {
      discipline,
      track,
      blocks,
      totalQuestions: visibleQuestions.length,
      terminalQuestions: visibleQuestions.filter(
        ({ status }) => status !== AiMlPracticeQuestionStatus.ACTIVE
      ).length,
      recommendation
    };
  }

  async question(ownerId: string, questionId: string): Promise<StoryPracticeQuestionView> {
    return this.questionView(await this.questionRow(ownerId, questionId));
  }

  private async questionRow(ownerId: string, questionId: string): Promise<QuestionViewRow> {
    const row = await this.prisma.aiMlPracticeQuestion.findFirst({
      where: { id: questionId, ownerId },
      include: QUESTION_VIEW_INCLUDE
    });
    if (!row) throw new NotFoundErrorException("AI_ML_QUESTION_NOT_FOUND", "Question not found.");
    return row;
  }

  /** Writes render from the row they already read instead of reading it again. */
  private questionView(row: QuestionViewRow): StoryPracticeQuestionView {
    const track =
      row.session.track === DatabaseTrack.CORE_TECHNICAL ? "core-technical" : "applied-engineering";
    const peers = row.session.questions;
    const key = pathKey(row);
    const order =
      peers.filter((peer) => pathKey(peer) === key).findIndex((peer) => peer.id === row.id) + 1;
    return publicQuestion(row, key, order, track);
  }

  /** Read one answer-bearing row and only public navigation fields for its peers. */
  async questionWorkspace(
    ownerId: string,
    track: PersistedAiMlPracticeTrack,
    questionId: string,
    discipline: StoryDiscipline = "ai-ml"
  ) {
    const row = await this.prisma.aiMlPracticeQuestion.findFirst({
      where: { id: questionId, ownerId, session: { discipline, track: databaseTrack(track) } },
      include: {
        attempt: true,
        session: {
          select: {
            questions: {
              select: { id: true, questionKey: true, publicSnapshot: true, status: true },
              orderBy: { order: "asc" }
            }
          }
        }
      }
    });
    if (!row) return null;
    const peers = row.session.questions;
    const key = pathKey(row);
    const pathQuestions = peers.filter((peer) => pathKey(peer) === key);
    const order = pathQuestions.findIndex((peer) => peer.id === row.id) + 1;
    const path = [
      ...savedPersonalizedPaths(peers, AI_ML_RESUME_PATH_KEY),
      ...storyDisciplinePaths(discipline, track)
    ].find((candidate) => candidate.key === key);
    if (!path || order === 0) return null;
    return {
      block: {
        id: path.key,
        status: pathQuestions.every((peer) => peer.status !== AiMlPracticeQuestionStatus.ACTIVE)
          ? ("COMPLETED" as const)
          : ("PRACTISING" as const),
        story: {
          key: path.key,
          title: path.title,
          premise: path.description,
          incident: path.description,
          candidateRole: storyDiscipline(discipline).candidateRole,
          primaryTopicKey: path.key,
          secondaryTopicKeys: [],
          mechanismKeys: [],
          difficulty: "guided" as const,
          expectedMinutes: path.expectedMinutes,
          stages: pathQuestions.map((peer, index) => ({
            order: index + 1,
            title: stageTitle(peer, track, index)
          }))
        },
        selection: { difficulty: "guided" as const, reason: path.description },
        questions: pathQuestions.map((peer, index) => ({ id: peer.id, order: index + 1 }))
      },
      question: publicQuestion(row, path.key, order, track)
    };
  }

  async saveDraft(ownerId: string, raw: unknown) {
    const input = interactivePracticeSaveDraftInputSchema.parse(raw);
    const row = await this.questionRow(ownerId, input.questionId);
    const question = this.questionView(row);
    if (question.status !== "ACTIVE") return question;
    assertAnswerShape(question.question, input.draft);
    const draft = input.draft ? json(input.draft) : null;
    const updated = await this.prisma.aiMlPracticeQuestion.updateMany({
      where: { id: input.questionId, ownerId, status: AiMlPracticeQuestionStatus.ACTIVE },
      data: { draft: draft ?? Prisma.JsonNull }
    });
    // The question closed in between; show what was actually saved.
    if (!updated.count) return this.question(ownerId, input.questionId);
    return this.questionView({ ...row, draft: draft as Prisma.JsonValue | null });
  }

  async revealHint(ownerId: string, raw: unknown) {
    const input = storyPracticeRevealHintInputSchema.parse(raw);
    const row = await this.questionRow(ownerId, input.questionId);
    const question = this.questionView(row);
    if (question.status !== "ACTIVE") return question;
    assertStoryPracticeHintOrder(
      question.revealedHints.length,
      input.hintNumber,
      () => new ConflictErrorException("AI_ML_HINT_ORDER", "Reveal the hints in order.")
    );
    if (input.hintNumber === question.revealedHints.length + 1) {
      const updated = await this.prisma.aiMlPracticeQuestion.updateMany({
        where: {
          id: input.questionId,
          ownerId,
          status: AiMlPracticeQuestionStatus.ACTIVE,
          revealedHintCount: input.hintNumber - 1
        },
        data: { revealedHintCount: input.hintNumber }
      });
      if (!updated.count)
        throw new ConflictErrorException(
          "AI_ML_HINT_CONFLICT",
          "Hint state changed. Refresh and try again."
        );
      return this.questionView({ ...row, revealedHintCount: input.hintNumber });
    }
    return question;
  }

  async submitAttempt(ownerId: string, raw: unknown) {
    const input = interactivePracticeAttemptInputSchema.parse(raw);
    if (input.work.kind === "code")
      throw new BadRequestErrorException(
        "AI_ML_CODE_UNSUPPORTED",
        "This practice question does not accept code."
      );
    const row = await this.questionRow(ownerId, input.questionId);
    const workFingerprint = storyPracticeFingerprint(input.work);
    if (row.attempt) {
      if (
        row.attempt.requestId !== input.requestId ||
        storyPracticeFingerprint(row.attempt.answerSnapshot) !== workFingerprint
      ) {
        throw new ConflictErrorException(
          "AI_ML_ATTEMPT_EXISTS",
          "This question already has a saved answer."
        );
      }
      const question = this.questionView(row);
      return { attempt: question.latestAttempt, question };
    }
    if (row.status !== AiMlPracticeQuestionStatus.ACTIVE) {
      throw new ConflictErrorException(
        "AI_ML_QUESTION_CLOSED",
        "This question is already complete."
      );
    }
    const publicSnapshot = publicData(row);
    const privateSnapshot = privateData(row);
    assertAnswerShape(
      {
        format: publicSnapshot.format ?? "mcq",
        choices: publicSnapshot.options.map((option) => option.label),
        interaction: publicSnapshot.interaction
      },
      input.work
    );
    let feedback: StoryPracticeAttemptFeedbackView;
    if (input.work.kind === "interactive") {
      const invalid = interactiveResponseError(
        publicSnapshot.interaction!,
        input.work.response,
        true
      );
      if (invalid) throw new BadRequestErrorException("AI_ML_RESPONSE_INCOMPLETE", invalid);
      if (!privateSnapshot.interactionRubric)
        throw new Error("The frozen interaction rubric is missing");
      feedback = evaluateInteractiveResponse(
        input.work.response,
        privateSnapshot.interactionRubric,
        {
          explanation: privateSnapshot.answer!.explanation,
          consequence:
            publicSnapshot.interviewConnection ??
            "Check the production constraints before changing the system.",
          followUp:
            privateSnapshot.interviewerFollowUps?.[0] ?? "What evidence would change your decision?"
        }
      );
    } else {
      feedback =
        input.work.kind === "choice"
          ? choiceFeedback(publicSnapshot, privateSnapshot, input.work.selectedChoiceIndex)
          : await this.evaluateText(
              publicSnapshot,
              privateSnapshot,
              input.work.text,
              isStoryDiscipline(row.session.discipline) ? row.session.discipline : "ai-ml"
            );
    }
    let saved: { attempt: NonNullable<QuestionViewRow["attempt"]>; completedAt: Date } | null =
      null;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        await lockAiMlPracticeOwner(tx, ownerId);
        const current = await tx.aiMlPracticeQuestion.findFirst({
          where: { id: row.id, ownerId },
          select: { status: true, contentFingerprint: true, attempt: true }
        });
        if (current?.attempt) {
          if (
            current.attempt.requestId !== input.requestId ||
            storyPracticeFingerprint(current.attempt.answerSnapshot) !== workFingerprint
          ) {
            throw new ConflictErrorException(
              "AI_ML_ATTEMPT_EXISTS",
              "This question already has a saved answer."
            );
          }
          return null;
        }
        if (current?.contentFingerprint !== row.contentFingerprint) {
          throw new ConflictErrorException(
            "AI_ML_QUESTION_CHANGED",
            "This question changed while your answer was being evaluated. Refresh and try again."
          );
        }
        if (current?.status !== AiMlPracticeQuestionStatus.ACTIVE) {
          throw new ConflictErrorException(
            "AI_ML_QUESTION_CLOSED",
            "This question is already complete."
          );
        }
        const attempt = await tx.aiMlPracticeAttempt.create({
          data: {
            ownerId,
            questionId: row.id,
            requestId: input.requestId,
            contentFingerprint: row.contentFingerprint,
            selectedOptionId:
              input.work.kind === "choice"
                ? publicSnapshot.options[input.work.selectedChoiceIndex]!.id
                : null,
            correct: input.work.kind === "choice" ? feedback.score === 10 : null,
            answerSnapshot: json(input.work),
            evaluationSnapshot: json({
              evaluatorVersion:
                input.work.kind === "interactive" ? "interactive-rubric-v1" : "ai-ml-story-v1",
              feedback
            })
          }
        });
        const completedAt = new Date();
        await tx.aiMlPracticeQuestion.update({
          where: { id: row.id },
          data: {
            status: AiMlPracticeQuestionStatus.COMPLETED,
            completedAt,
            draft: Prisma.JsonNull
          }
        });
        await completeSessionIfTerminal(tx, row.sessionId);
        return { attempt, completedAt };
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const committed = await this.prisma.aiMlPracticeAttempt.findUnique({
        where: { questionId: row.id }
      });
      if (
        !committed ||
        committed.ownerId !== ownerId ||
        committed.requestId !== input.requestId ||
        storyPracticeFingerprint(committed.answerSnapshot) !== workFingerprint
      ) {
        throw new ConflictErrorException(
          "AI_ML_ATTEMPT_CONFLICT",
          "That answer conflicts with a saved attempt."
        );
      }
    }
    const question = saved
      ? this.questionView({
          ...row,
          attempt: saved.attempt,
          status: AiMlPracticeQuestionStatus.COMPLETED,
          completedAt: saved.completedAt,
          draft: null
        })
      : await this.question(ownerId, input.questionId);
    return { attempt: question.latestAttempt, question };
  }

  async learn(ownerId: string, raw: unknown) {
    const input = storyPracticeLearnInputSchema.parse(raw);
    const row = await this.questionRow(ownerId, input.questionId);
    if (row.status !== AiMlPracticeQuestionStatus.ACTIVE) return this.questionView(row);
    const learnedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await lockAiMlPracticeOwner(tx, ownerId);
      const result = await tx.aiMlPracticeQuestion.updateMany({
        where: { id: row.id, ownerId, status: AiMlPracticeQuestionStatus.ACTIVE },
        data: { status: AiMlPracticeQuestionStatus.LEARNED, learnedAt, draft: Prisma.JsonNull }
      });
      await completeSessionIfTerminal(tx, row.sessionId);
      return result.count > 0;
    });
    if (!updated) return this.question(ownerId, input.questionId);
    return this.questionView({
      ...row,
      status: AiMlPracticeQuestionStatus.LEARNED,
      learnedAt,
      draft: null
    });
  }

  private async evaluateText(
    question: PublicSnapshot,
    answer: PrivateSnapshot,
    response: string,
    discipline: StoryDiscipline
  ): Promise<StoryPracticeAttemptFeedbackView> {
    if (!answer.answer || !answer.rubric) throw new Error("The frozen answer rubric is missing");
    return evaluateWrittenPracticeAnswer(
      this.ai,
      {
        format: question.format ?? "written",
        prompt: question.prompt,
        artifact: question.artifact ?? { kind: "scenario", content: question.prompt },
        answer: answer.answer,
        rubric: answer.rubric,
        commonMistakes: answer.commonMistakes ?? [],
        interviewerFollowUps: answer.interviewerFollowUps ?? [],
        interviewConnection: question.interviewConnection ?? "Explain the production decision."
      },
      response,
      `${discipline}.practice.attempt`,
      storyDiscipline(discipline).reviewer
    );
  }

  private load(
    ownerId: string,
    discipline: StoryDiscipline,
    track: PersistedAiMlPracticeTrack,
    database: Pick<PrismaService, "aiMlPracticeSession"> = this.prisma
  ) {
    return database.aiMlPracticeSession.findUnique({
      where: {
        ownerId_discipline_track: { ownerId, discipline, track: databaseTrack(track) }
      },
      include: { questions: { include: { attempt: true }, orderBy: { order: "asc" } } }
    });
  }
}

type PublicSnapshot = {
  id: string;
  title: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  pathKey?: string;
  pathTitle?: string;
  pathDescription?: string;
  pathExpectedMinutes?: number;
  format?: AiMlStoryQuestion["format"];
  artifact?: AiMlStoryQuestion["artifact"];
  topicKeys?: string[];
  interviewConnection?: string;
  revisionNote?: string;
  interaction?: PracticeInteraction;
};
type PrivateSnapshot = {
  interactionRubric?: InteractionCriterion[];
  correctOptionId?: string;
  explanation?: string;
  answer?: AiMlStoryQuestion["answer"];
  hints?: AiMlStoryQuestion["hints"];
  rubric?: AiMlStoryQuestion["rubric"];
  correctChoiceIndex?: number;
  commonMistakes?: string[];
  interviewerFollowUps?: string[];
  previousVersion?: {
    publicSnapshot: PublicSnapshot;
    privateSnapshot: Omit<PrivateSnapshot, "previousVersion">;
    draft: Prisma.JsonValue | null;
    revealedHintCount: number;
    contentFingerprint: string;
  };
};

function quickCheckSnapshots(question: AiMlStoryQuestion, previous: QuestionRow) {
  const previousPublic = publicData(previous);
  const previousPrivate = privateData(previous);
  const selectedIndex =
    previous.draft &&
    typeof previous.draft === "object" &&
    !Array.isArray(previous.draft) &&
    "selectedChoiceIndex" in previous.draft &&
    typeof previous.draft.selectedChoiceIndex === "number"
      ? previous.draft.selectedChoiceIndex
      : null;
  const selectedLabel =
    selectedIndex === null ? null : (previousPublic.options[selectedIndex]?.label ?? null);
  const revisionNote = selectedLabel
    ? `This case was updated. Your unsubmitted choice (“${selectedLabel}”) is preserved in the earlier version, but does not answer this new case.`
    : previous.revealedHintCount > 0
      ? "This case was updated. Hints revealed for the earlier version were preserved, but the new hints start fresh."
      : undefined;
  const options =
    question.choices?.map((label, index) => ({ id: String(index), label })) ??
    previousPublic.options;
  return {
    publicSnapshot: {
      id: question.id,
      title: question.title,
      prompt: question.prompt,
      // Keep the old option IDs for the retired MCQ API projection on written
      // questions; the story workspace never displays these as choices.
      options,
      pathKey: question.pathKey,
      format: question.format,
      artifact: question.artifact,
      topicKeys: question.topicKeys,
      interviewConnection: question.interviewConnection,
      revisionNote
    } satisfies PublicSnapshot,
    privateSnapshot: {
      correctOptionId:
        question.choices && question.correctChoiceIndex !== undefined
          ? options[question.correctChoiceIndex]?.id
          : previousPrivate.correctOptionId,
      explanation: question.answer.explanation,
      answer: question.answer,
      hints: question.hints,
      rubric: question.rubric,
      correctChoiceIndex: question.correctChoiceIndex,
      commonMistakes: question.commonMistakes,
      interviewerFollowUps: question.interviewerFollowUps,
      previousVersion: {
        publicSnapshot: previousPublic,
        privateSnapshot: previousPrivate,
        draft: previous.draft,
        revealedHintCount: previous.revealedHintCount,
        contentFingerprint: previous.contentFingerprint
      }
    } satisfies PrivateSnapshot
  };
}

const publicData = (row: { publicSnapshot: Prisma.JsonValue }) =>
  row.publicSnapshot as PublicSnapshot;
const privateData = (row: { privateSnapshot: Prisma.JsonValue }) =>
  row.privateSnapshot as PrivateSnapshot;
const pathKey = (row: { publicSnapshot: Prisma.JsonValue }) =>
  publicData(row).pathKey ?? "quick-check";

function savedPersonalizedPaths(
  questions: Array<Pick<QuestionRow, "questionKey" | "publicSnapshot">>,
  prefix: string
): AiMlPracticePath[] {
  const groups = new Map<string, Array<Pick<QuestionRow, "questionKey" | "publicSnapshot">>>();
  for (const question of questions) {
    const key = pathKey(question);
    if (!key.startsWith(`${prefix}-`)) continue;
    const group = groups.get(key) ?? [];
    group.push(question);
    groups.set(key, group);
  }
  return [...groups.entries()].reverse().map(([key, saved]) => {
    const first = publicData(saved[0]!);
    return {
      key,
      title: first.pathTitle ?? "Your resume project",
      description: first.pathDescription ?? "Practise decisions from your resume evidence.",
      expectedMinutes: first.pathExpectedMinutes ?? 25,
      questions: saved.map((question) => {
        const snapshot = publicData(question);
        return {
          id: question.questionKey,
          title: snapshot.title,
          format: snapshot.format ?? "artifact-diagnosis",
          topicKeys: snapshot.topicKeys ?? [],
          interaction: snapshot.interaction
        };
      })
    };
  });
}

function stageTitle(
  row: Pick<QuestionRow, "questionKey" | "publicSnapshot">,
  track: PersistedAiMlPracticeTrack,
  index: number
): string {
  const snapshot = publicData(row);
  if (snapshot.title !== snapshot.prompt) return snapshot.title;
  if (track === "core-technical" && row.questionKey === "ai-ml-core-7") {
    return "Keep training and serving aligned";
  }
  return aiMlQuickCheckQuestionById(track, row.questionKey)?.title ?? `Question ${index + 1}`;
}

function frozenLegacyContext(
  questionKey: string
): Pick<AiMlStoryQuestion, "artifact" | "hints" | "interviewConnection"> | null {
  if (questionKey === "ai-ml-core-7") {
    return {
      artifact: {
        kind: "code",
        language: "python",
        title: "feature_parity.py",
        content:
          "# training: feature_store.get('account_age_days', as_of=snapshot_at)\n# serving: int((local_now - customer.created_at).days)\n# customer created near midnight: training=0, serving=1\n# model version unchanged; live predictions shifted",
        caption: "The two paths compute the same named feature from different definitions."
      },
      hints: [
        "Compare values for the same record at the same scoring instant.",
        "A shared feature definition prevents independent transformations from drifting.",
        "Version and test the training and serving transformations together."
      ],
      interviewConnection: "Training and serving must agree on the meaning of each feature."
    };
  }
  if (questionKey === "ai-ml-applied-6") {
    return {
      artifact: {
        kind: "metrics",
        title: "Primary versus fallback outcomes",
        content:
          "HTTP success: 99.9% → 99.9%\nprimary timeout: 1% → 19%\nfallback share: 2% → 20%\nanswer acceptance: 82% → 61%",
        caption: "Fallback answers return HTTP 200 but have lower task quality."
      },
      hints: [
        "A successful HTTP response can still come from the fallback.",
        "Measure fallback invocation and answer quality separately.",
        "Trace which model served each answer before declaring the route healthy."
      ],
      interviewConnection: "Fallback reliability includes user outcome, not only status codes."
    };
  }
  return null;
}

function publicQuestion(
  row: QuestionRow,
  blockId: string,
  order: number,
  track: PersistedAiMlPracticeTrack
): StoryPracticeQuestionView {
  const source = publicData(row);
  const hidden = privateData(row);
  const quickCheck = aiMlQuickCheckQuestionById(track, row.questionKey);
  const frozenLegacy = source.artifact ? null : frozenLegacyContext(row.questionKey);
  const terminal = row.status !== AiMlPracticeQuestionStatus.ACTIVE;
  const selectedChoice = row.attempt?.selectedOptionId
    ? source.options.findIndex((option) => option.id === row.attempt?.selectedOptionId)
    : null;
  const work = row.attempt?.answerSnapshot as StoryPracticeAttemptWork | undefined;
  const feedback = row.attempt
    ? ((row.attempt.evaluationSnapshot as { feedback?: StoryPracticeAttemptFeedbackView })
        .feedback ?? choiceFeedback(source, hidden, selectedChoice ?? -1))
    : null;
  const hints = hidden.hints ?? frozenLegacy?.hints ?? quickCheck?.hints ?? LEGACY_HINTS;
  return {
    id: row.id,
    blockId,
    order,
    status: row.status,
    question: {
      format: source.format ?? "mcq",
      prompt: source.prompt,
      topicKeys:
        source.topicKeys ?? (track === "core-technical" ? ["model-evaluation"] : ["production-ml"]),
      artifact: source.artifact ??
        frozenLegacy?.artifact ??
        quickCheck?.artifact ?? {
          kind: "scenario",
          title: stageTitle(row, track, order - 1),
          content: source.prompt
        },
      choices:
        (source.format ?? "mcq") === "mcq" ? source.options.map((option) => option.label) : [],
      hintCount: 3,
      interviewConnection:
        source.interviewConnection ??
        frozenLegacy?.interviewConnection ??
        quickCheck?.interviewConnection ??
        "Explain your decision using the evidence in the question.",
      revisionNote: source.revisionNote,
      interaction: source.interaction
    },
    draft: row.draft as StoryPracticeQuestionView["draft"],
    revealedHints: hints.slice(0, row.revealedHintCount ?? 0),
    authorizedAnswer: terminal
      ? {
          concise:
            hidden.answer?.concise ??
            source.options.find(({ id }) => id === hidden.correctOptionId)?.label ??
            "Review the correct option.",
          explanation:
            hidden.answer?.explanation ??
            hidden.explanation ??
            "Review the evidence for this decision."
        }
      : null,
    latestAttempt:
      row.attempt && feedback
        ? {
            id: row.attempt.id,
            work: work?.kind ? work : { kind: "choice", selectedChoiceIndex: selectedChoice ?? 0 },
            feedback,
            verificationStatus: "VERIFIED",
            score: feedback.score,
            createdAt: row.attempt.createdAt.toISOString()
          }
        : null,
    latestRun: null
  };
}

function choiceFeedback(
  question: PublicSnapshot,
  answer: PrivateSnapshot,
  selectedIndex: number
): StoryPracticeAttemptFeedbackView {
  const correctIndex =
    answer.correctChoiceIndex ??
    question.options.findIndex((option) => option.id === answer.correctOptionId);
  const correct = selectedIndex === correctIndex;
  const explanation = answer.answer?.explanation ?? answer.explanation ?? "Review the evidence.";
  const concise =
    answer.answer?.concise ?? question.options[correctIndex]?.label ?? "Review the correct option.";
  return storyPracticeAttemptFeedbackSchema.parse({
    schemaVersion: 1,
    score: correct ? 10 : 0,
    result: correct ? "That is the strongest choice." : `Not quite. ${concise}`,
    didWell: correct
      ? "You selected the decision supported by the evidence."
      : "You made a clear choice that we can examine.",
    mechanism: explanation,
    missingOrIncorrect: correct
      ? "Nothing needs correcting for this choice."
      : (answer.commonMistakes?.[0] ?? explanation),
    productionConsequence:
      "In production, this decision affects the quality and safety of the system.",
    transferExample: `For a similar case, use the same check: ${explanation}`,
    interviewerFollowUp:
      answer.interviewerFollowUps?.[0] ?? "What evidence would change your decision?",
    missedEdgeCases: []
  });
}

async function completeSessionIfTerminal(tx: Prisma.TransactionClient, sessionId: string) {
  const remaining = await tx.aiMlPracticeQuestion.count({
    where: { sessionId, status: AiMlPracticeQuestionStatus.ACTIVE }
  });
  if (!remaining) {
    await tx.aiMlPracticeSession.update({
      where: { id: sessionId },
      data: { status: AiMlPracticeSessionStatus.COMPLETED, completedAt: new Date() }
    });
  }
}

function databaseTrack(track: PersistedAiMlPracticeTrack): DatabaseTrack {
  return track === "core-technical"
    ? DatabaseTrack.CORE_TECHNICAL
    : DatabaseTrack.APPLIED_ENGINEERING;
}
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function assertAnswerShape(
  question: { format: string; choices?: string[]; interaction?: PracticeInteraction },
  work: StoryPracticeQuestionView["draft"]
) {
  assertStoryPracticeWorkMatchesQuestion(
    question,
    work,
    {
      format: () =>
        new BadRequestErrorException(
          "AI_ML_WORK_KIND",
          "That response does not match this question's answer controls."
        ),
      choice: () =>
        new BadRequestErrorException(
          "AI_ML_CHOICE_INVALID",
          "That choice is not part of this question."
        )
    },
    new Set()
  );
}
