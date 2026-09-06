ALTER TABLE "PrepQuestionTemplate"
ADD COLUMN "ecosystems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "runtimes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "frameworks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "runtimeVersion" TEXT;

-- Explicit classifications for the reviewed runtime-prediction packs.
UPDATE "PrepQuestionTemplate"
SET
  "ecosystems" = ARRAY['javascript'],
  "runtimes" = ARRAY['nodejs', 'browser'],
  "runtimeVersion" = 'ECMAScript 2024'
WHERE "bank" = 'javascript-runtime-predict';

UPDATE "PrepQuestionTemplate"
SET
  "ecosystems" = ARRAY['python'],
  "runtimes" = ARRAY['python'],
  "runtimeVersion" = 'Python 3.12'
WHERE "bank" = 'python-runtime-predict';

UPDATE "PrepQuestionTemplate"
SET
  "ecosystems" = ARRAY['java'],
  "runtimes" = ARRAY['jvm'],
  "runtimeVersion" = 'Java SE 21'
WHERE "bank" = 'java-runtime-predict';

UPDATE "PrepQuestionTemplate"
SET
  "ecosystems" = ARRAY['cpp'],
  "runtimes" = ARRAY['native'],
  "runtimeVersion" = 'C++17'
WHERE "bank" = 'cpp-runtime-predict';

-- Existing frontend Core Technical content is browser-only. It must never be
-- used as a Node.js fallback merely because both ecosystems use JavaScript.
UPDATE "PrepQuestionTemplate"
SET
  "ecosystems" = ARRAY['javascript'],
  "runtimes" = ARRAY['browser'],
  "runtimeVersion" = 'ECMAScript 2024'
WHERE "bank" IN ('frontend-core', 'frontend-expanded')
  AND "sessionKey" = 'core-technical';

UPDATE "PrepQuestionTemplate"
SET "ecosystems" = ARRAY['typescript']
WHERE "id" = 'frontend-typescript-narrowing-boundaries';

UPDATE "PrepQuestionTemplate"
SET "frameworks" = ARRAY['react']
WHERE "id" IN (
  'frontend-react-rendering-state-effects',
  'frontend-react-component-architecture',
  'frontend-react-forms-validation',
  'frontend-react-keys-state-identity',
  'frontend-react-effect-race-cleanup',
  'frontend-react-state-ownership-scale'
);

CREATE INDEX "PrepQuestionTemplate_sessionKey_ecosystems_runtimes_idx"
ON "PrepQuestionTemplate"("sessionKey", "ecosystems", "runtimes");

