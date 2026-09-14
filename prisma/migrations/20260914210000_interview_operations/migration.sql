CREATE INDEX "InterviewEvaluationJob_status_createdAt_idx"
ON "InterviewEvaluationJob"("status", "createdAt");

CREATE INDEX "InterviewEvaluationJob_status_updatedAt_idx"
ON "InterviewEvaluationJob"("status", "updatedAt");

CREATE INDEX "InterviewAnswerRequest_status_updatedAt_idx"
ON "InterviewAnswerRequest"("status", "updatedAt");
