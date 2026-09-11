import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "../src/features/practice/core-technical/domain/gold-cases";
import { auditCoreTechnicalGoldCases } from "../src/features/practice/core-technical/domain/gold-case-audit";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "../src/features/practice/core-technical/domain/domain-map";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "../src/features/practice/core-technical/domain/interview-patterns";
import { NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS } from "../src/features/practice/core-technical/domain/practice-path-blueprints";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "../src/features/practice/core-technical/domain/story-ranking-catalogue";

async function main(): Promise<void> {
  const audit = auditCoreTechnicalGoldCases({
    cases: NODEJS_CORE_TECHNICAL_GOLD_CASES,
    domainMap: NODEJS_CORE_TECHNICAL_DOMAIN_MAP,
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
  });
  if (!audit.releaseReady) {
    throw new Error(
      `Core Technical gold cases are not release ready: ${audit.unapprovedCaseKeys.join(", ")}`
    );
  }

  for (const blueprint of NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS) {
    const catalogueEntry = NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.find(
      (entry) => entry.key === blueprint.key
    );
    if (
      !catalogueEntry ||
      catalogueEntry.publicationStatus !== "published" ||
      catalogueEntry.version !== 1 ||
      catalogueEntry.title !== blueprint.title
    ) {
      throw new Error(`Core Technical catalogue does not match blueprint: ${blueprint.key}`);
    }
  }
  process.stdout.write(
    JSON.stringify(
      {
        activeBlueprints: NODEJS_CORE_TECHNICAL_PRACTICE_PATH_BLUEPRINTS.map((blueprint) => ({
          storyKey: blueprint.key,
          version: 1,
          title: blueprint.title,
          questionCount: blueprint.stages.length
        }))
      },
      null,
      2
    ) + "\n"
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Core Technical publication failed: ${error instanceof Error ? error.message : "Unknown error"}\n`
  );
  process.exitCode = 1;
});
