import { config as loadEnvFile } from "dotenv";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { CandidateResume } from "../src/lib/shared/types";
import type {
  ResumeRoastResult,
  ResumeRoastTarget
} from "../src/features/resume-roast/contracts/resume-roast";

// Imported Prisma code may load .env first; restore the verified local database.
const localEnvironment = loadEnvFile({ path: ".env.local", override: true });
if (!localEnvironment.parsed?.DATABASE_URL) {
  throw new Error("Resume Roast evaluation requires DATABASE_URL in .env.local.");
}
loadEnvFile();

/**
 * Live quality check for Resume Roast prompts and the scoring rubric. It runs
 * fictional resumes several times and reports what a reviewer cares about:
 * whether the score is stable, how long it takes, how often sections get
 * dropped by grounding checks, and whether the writing sounds like a model.
 *
 *   pnpm resume-roast:eval [--runs=3] [--case=weak-backend] [--write]
 *   pnpm resume-roast:eval --scoring=reasoning   (score with the reasoning model)
 */

interface EvalCase {
  id: string;
  target: ResumeRoastTarget;
  /** What a human reviewer would roughly expect, for eyeballing calibration. */
  expectedOverall: [number, number];
  resume: Pick<CandidateResume, "skills" | "warnings" | "experience" | "projects" | "education" | "achievements">;
}

const CASES: EvalCase[] = [
  {
    id: "weak-backend",
    target: { role: "backend-engineer", companyEnvironment: "big-tech", level: "senior" },
    expectedOverall: [2, 4],
    resume: {
      skills: ["Java", "Spring Boot", "MySQL", "Git", "HTML", "CSS", "JavaScript", "Jira", "Postman", "Linux", "Docker", "AWS", "Kafka", "Redis", "MongoDB", "React", "Angular", "Python"],
      warnings: [],
      experience: [
        {
          organization: "Infotech Services",
          role: "Software Engineer",
          summary: "Worked on backend development for client projects using Java and Spring Boot.",
          achievements: [
            "Responsible for developing REST APIs for various modules.",
            "Worked on bug fixing and enhancements as per client requirements.",
            "Developed database queries and stored procedures in MySQL.",
            "Participated in daily stand-ups and sprint planning meetings.",
            "Developed unit test cases using JUnit."
          ]
        }
      ] as CandidateResume["experience"],
      projects: [
        {
          name: "Employee Portal",
          summary: "Built an employee management portal with Spring Boot and MySQL.",
          outcome: "Used by the HR team for managing employee records."
        }
      ] as CandidateResume["projects"],
      education: [
        { credential: "B.Tech", field: "Computer Science", institution: "State Engineering College" }
      ] as CandidateResume["education"],
      achievements: []
    }
  },
  {
    id: "mid-frontend",
    target: { role: "frontend-engineer", companyEnvironment: "product-company", level: "mid-level" },
    expectedOverall: [5, 7],
    resume: {
      skills: ["TypeScript", "React", "Next.js", "Redux", "Jest", "Cypress", "Tailwind CSS", "GraphQL"],
      warnings: [],
      experience: [
        {
          organization: "Shopline",
          role: "Frontend Engineer",
          summary: "Frontend engineer on the checkout team of an e-commerce platform.",
          achievements: [
            "Rebuilt the checkout flow in React and TypeScript, cutting drop-off by 12%.",
            "Built a shared component library used by four product teams.",
            "Improved Lighthouse performance score on product pages from 54 to 88.",
            "Wrote Cypress tests for the payment flow."
          ]
        },
        {
          organization: "Pixel Agency",
          role: "Junior Web Developer",
          summary: "Built marketing sites for agency clients.",
          achievements: [
            "Built responsive landing pages for 20+ clients.",
            "Developed reusable page templates in Next.js."
          ]
        }
      ] as CandidateResume["experience"],
      projects: [],
      education: [
        { credential: "BSc", field: "Information Technology", institution: "City University" }
      ] as CandidateResume["education"],
      achievements: []
    }
  },
  {
    id: "strong-data",
    target: { role: "data-or-ml-engineer", companyEnvironment: "product-company", level: "senior" },
    expectedOverall: [7, 9],
    resume: {
      skills: ["Python", "SQL", "Spark", "Airflow", "Kafka", "dbt", "Snowflake", "AWS"],
      warnings: [],
      experience: [
        {
          organization: "RideCo",
          role: "Senior Data Engineer",
          summary: "Owned the real-time trip data platform serving pricing and ETA models.",
          achievements: [
            "Designed and owned a Kafka and Spark streaming pipeline processing 2B events a day with 99.95% uptime.",
            "Cut the nightly warehouse load from 6 hours to 40 minutes by moving transforms to dbt on Snowflake.",
            "Led a team of 3 engineers to migrate 140 Airflow DAGs to a new orchestration setup with zero missed SLAs.",
            "Built data quality checks that caught 30+ upstream schema breaks before they reached pricing models."
          ]
        },
        {
          organization: "FinSight",
          role: "Data Engineer",
          summary: "Built batch pipelines for a lending analytics product.",
          achievements: [
            "Built Airflow pipelines ingesting data from 12 partner banks.",
            "Reduced monthly AWS spend by $18k by right-sizing EMR clusters."
          ]
        }
      ] as CandidateResume["experience"],
      projects: [],
      education: [
        { credential: "MSc", field: "Computer Science", institution: "National Institute of Technology" }
      ] as CandidateResume["education"],
      achievements: ["Speaker at a regional data engineering meetup on streaming data quality."]
    }
  },
  {
    id: "mismatch-staff-frontend",
    target: { role: "frontend-engineer", companyEnvironment: "product-company", level: "staff-or-principal" },
    expectedOverall: [2, 4],
    resume: {
      skills: ["C#", ".NET", "ASP.NET Core", "SQL Server", "Azure", "React"],
      warnings: [],
      experience: [
        {
          organization: "BankCore",
          role: "Senior Software Engineer",
          summary: "Built backend services for a payments platform in C# and ASP.NET Core.",
          achievements: [
            "Built payment reconciliation services in ASP.NET Core.",
            "Developed SQL Server stored procedures for settlement reports.",
            "Built integrations with three card networks."
          ]
        }
      ] as CandidateResume["experience"],
      projects: [
        {
          name: "Ops Dashboard",
          summary: "Built an internal React dashboard for payment operations.",
          outcome: "Provided supporting frontend portal for transaction monitoring."
        }
      ] as CandidateResume["projects"],
      education: [
        { credential: "B.E.", field: "Electronics", institution: "Regional Engineering College" }
      ] as CandidateResume["education"],
      achievements: []
    }
  }
];

interface RunRecord {
  caseId: string;
  run: number;
  durationMs: number;
  ok: boolean;
  error?: string;
  overall?: number;
  dimensions?: Record<string, number>;
  rawProblems?: number;
  keptProblems?: number;
  rawRewrite?: boolean;
  keptRewrite?: boolean;
  aiPhrases?: string[];
  cliches?: string[];
  result?: ResumeRoastResult;
}

async function main(): Promise<void> {
  const [
    { getAppContainer },
    { AiService },
    { GeminiProvider },
    { ResumeRoastGenerator },
    { buildResumeRoastSnapshot },
    { findAiSoundingPhrases, findRoastCliches }
  ] = await Promise.all([
    import("../src/server/app-container"),
    import("../src/server/ai/ai.service"),
    import("../src/server/ai/providers/gemini.provider"),
    import("../src/features/resume-roast/server/resume-roast.generator"),
    import("../src/features/resume-roast/server/resume-signals"),
    import("../src/features/resume-roast/server/resume-roast.language")
  ]);
  const argv = process.argv.slice(2);
  const runs = Number(argv.find((value) => value.startsWith("--runs="))?.slice(7) ?? 3);
  const only = argv.filter((value) => value.startsWith("--case=")).map((value) => value.slice(7));
  const config = getAppContainer().config;
  const gemini = new AiService(
    new GeminiProvider(config, new GoogleGenAI({ apiKey: config.geminiApiKey }))
  );

  const records: RunRecord[] = [];
  for (const evalCase of CASES.filter((item) => !only.length || only.includes(item.id))) {
    const snapshot = buildResumeRoastSnapshot({
      ...evalCase.resume,
      fileName: `${evalCase.id}.pdf`,
      uploadedAt: 0,
      confidence: 1,
      fullName: "Sample Person"
    } as CandidateResume)!;
    // Runs are sequential so latency reflects one user, not a burst.
    for (let run = 1; run <= runs; run += 1) {
      const raw: Record<string, unknown> = {};
      const recordingAi = {
        generateStructured: async <T>(request: Parameters<typeof gemini.generateStructured<T>>[0]) => {
          const value = await gemini.generateStructured(request);
          raw[request.operation] = value;
          return value;
        }
      };
      const startedAt = Date.now();
      try {
        const result = await new ResumeRoastGenerator(
          recordingAi,
          Date.now,
          argv.includes("--scoring=reasoning") ? "reasoning" : "fast"
        ).generate({
          snapshot,
          target: evalCase.target
        });
        const draft = raw["resume.roast.generate"] as
          | { problems?: unknown[]; rewrite?: unknown }
          | undefined;
        const text = [
          result.openingRoast,
          result.spokenSummary ?? "",
          result.strength.explanation,
          result.verdict.explanation,
          ...result.problems.flatMap((problem) => [
            problem.joke,
            problem.issue,
            problem.recruiterImpact,
            problem.improvement
          ]),
          ...(result.scorecard
            ? Object.values(result.scorecard.dimensions).map((dimension) => dimension.note)
            : []),
          ...result.actionPlan.flatMap((action) => [action.action, action.rationale])
        ].join("\n");
        records.push({
          caseId: evalCase.id,
          run,
          durationMs: Date.now() - startedAt,
          ok: true,
          overall: result.scorecard?.overall,
          dimensions: result.scorecard
            ? Object.fromEntries(
                Object.entries(result.scorecard.dimensions).map(([key, value]) => [key, value.score])
              )
            : undefined,
          rawProblems: draft?.problems?.length ?? 0,
          keptProblems: result.problems.length,
          rawRewrite: Boolean(draft?.rewrite),
          keptRewrite: Boolean(result.rewrite),
          aiPhrases: findAiSoundingPhrases(text),
          cliches: findRoastCliches(text),
          result
        });
      } catch (error) {
        records.push({
          caseId: evalCase.id,
          run,
          durationMs: Date.now() - startedAt,
          ok: false,
          error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown"
        });
      }
      const last = records.at(-1)!;
      process.stderr.write(
        `${evalCase.id} #${run}: ${last.ok ? `${last.overall}/10 ${JSON.stringify(last.dimensions)}` : last.error} (${last.durationMs} ms)\n`
      );
    }
  }

  const summary = CASES.filter((item) => records.some((record) => record.caseId === item.id)).map(
    (evalCase) => {
      const caseRuns = records.filter((record) => record.caseId === evalCase.id);
      const ok = caseRuns.filter((record) => record.ok);
      const scores = ok.map((record) => record.overall ?? 0);
      const durations = caseRuns.map((record) => record.durationMs).sort((a, b) => a - b);
      return {
        case: evalCase.id,
        expected: evalCase.expectedOverall.join("-"),
        scores: scores.join(","),
        scoreSpread: scores.length ? Math.max(...scores) - Math.min(...scores) : null,
        failures: caseRuns.length - ok.length,
        p50Ms: durations[Math.floor(durations.length / 2)],
        maxMs: durations.at(-1),
        droppedProblems: ok.reduce(
          (total, record) => total + ((record.rawProblems ?? 0) - (record.keptProblems ?? 0)),
          0
        ),
        droppedRewrites: ok.filter((record) => record.rawRewrite && !record.keptRewrite).length,
        aiPhrases: [...new Set(ok.flatMap((record) => record.aiPhrases ?? []))].join(", "),
        cliches: [...new Set(ok.flatMap((record) => record.cliches ?? []))].join(", ")
      };
    }
  );
  console.table(summary);

  for (const evalCase of CASES) {
    const sample = records.find((record) => record.caseId === evalCase.id && record.ok)?.result;
    if (sample) process.stdout.write(`\n=== ${evalCase.id}\n${JSON.stringify(sample, null, 2)}\n`);
  }

  if (argv.includes("--write")) {
    const directory = path.resolve(process.cwd(), "output/resume-roast-eval");
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(file, JSON.stringify({ model: config.geminiFastModel, summary, records }, null, 2));
    process.stderr.write(`Wrote ${path.relative(process.cwd(), file)}\n`);
  }
}

void main()
  .catch((error: unknown) => {
    process.stderr.write(
      `Resume Roast evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}\n`
    );
    process.exitCode = 1;
  })
  .finally(() => process.exit());
