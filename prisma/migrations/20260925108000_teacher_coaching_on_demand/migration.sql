-- Active candidates receive at most one daily coaching decision. A short lease
-- lets a new request retry after a crashed worker without scanning all users.
ALTER TABLE "CandidateProfile"
  ADD COLUMN "teacherCoachingLastDay" VARCHAR(10),
  ADD COLUMN "teacherCoachingNextAt" TIMESTAMP(3),
  ADD COLUMN "teacherCoachingLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "teacherCoachingLeaseToken" UUID;
