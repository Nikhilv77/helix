-- AlterTable
ALTER TABLE "PrepQuestionTemplate" ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RoadmapChapterTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoadmapQuestionTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoadmapSessionTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoadmapTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserChapterProgress" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserDsaQuestionNote" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserMayaInsight" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserQuestionAttempt" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserQuestionProgress" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserRoadmap" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserSessionProgress" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "CandidateInterviewProfileVersion_ownerId_sourceResumeFingerprin" RENAME TO "CandidateInterviewProfileVersion_ownerId_sourceResumeFinger_key";

-- RenameIndex
ALTER INDEX "CandidatePerformanceProfileVersion_ownerId_sourceSessionFingerp" RENAME TO "CandidatePerformanceProfileVersion_ownerId_sourceSessionFin_key";

-- RenameIndex
ALTER INDEX "CandidatePracticeEvidenceVersion_ownerId_sourceAttemptFingerpri" RENAME TO "CandidatePracticeEvidenceVersion_ownerId_sourceAttemptFinge_key";

-- RenameIndex
ALTER INDEX "PracticeQuestionPlacement_sessionProgressId_questionProgressId_" RENAME TO "PracticeQuestionPlacement_sessionProgressId_questionProgres_key";

-- RenameIndex
ALTER INDEX "RoadmapQuestionTemplate_sessionTemplateId_prepQuestionTemplateI" RENAME TO "RoadmapQuestionTemplate_sessionTemplateId_prepQuestionTempl_key";
