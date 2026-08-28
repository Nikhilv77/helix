ALTER TABLE "HelpSession"
ADD COLUMN "collaborationState" BYTEA,
ADD COLUMN "collaborationUpdatedAt" TIMESTAMP(3),
ADD COLUMN "helperWaitCreditAt" TIMESTAMP(3);
