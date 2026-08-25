import { createHash } from "node:crypto";
import type {
  CandidateInterviewProfile,
  CandidateSkill,
  ExperienceBand,
  RelevanceSignal,
  RoleFamily,
  SkillCategory,
  SkillEvidence,
  SkillRelevanceScore
} from "@/lib/interviews/personalized-plan";
import {
  CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION,
  parseCandidateInterviewProfile
} from "@/lib/interviews/personalized-plan";
import type { CandidateResume, Level, Role } from "@/lib/shared/types";

export interface SkillDefinition {
  key: string;
  label: string;
  category: SkillCategory;
  aliases: string[];
  roleFamilies: RoleFamily[];
}

interface SkillAccumulator {
  definition: Pick<SkillDefinition, "key" | "label" | "category" | "roleFamilies">;
  aliases: Set<string>;
  evidence: SkillEvidence[];
}

interface PeriodMetrics {
  startMonth: number;
  endMonth: number;
  durationMonths: number;
  recencyMonths: number;
}

export interface CompileCandidateInterviewProfileInput {
  resume: CandidateResume;
  /** Existing profile headline/summary from the same grounded extraction. */
  headline?: string;
  selectedRole?: Role | null;
  selectedLevel?: Level | null;
  profileId?: string;
  revision?: number;
  sourceResumeFingerprint?: string;
  generatedAt?: number;
}

export interface NormalizedSkill {
  key: string;
  label: string;
  category: SkillCategory;
  roleFamilies: RoleFamily[];
}

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  skill(
    "javascript",
    "JavaScript",
    "language",
    ["JavaScript", "JS", "ECMAScript"],
    ["frontend", "backend", "fullstack"]
  ),
  skill(
    "typescript",
    "TypeScript",
    "language",
    ["TypeScript", "TS"],
    ["frontend", "backend", "fullstack"]
  ),
  skill("python", "Python", "language", ["Python", "Python 3"], ["backend", "data", "ai-ml"]),
  skill("java", "Java", "language", ["Java", "Java SE"], ["backend", "fullstack"]),
  skill("php", "PHP", "language", ["PHP"], ["backend", "fullstack"]),
  skill("c-sharp", "C#", "language", ["C#", "C Sharp"], ["backend", "fullstack"]),
  skill("c-plus-plus", "C++", "language", ["C++", "CPP"], ["backend", "other"]),
  skill("c", "C", "language", ["C", "C Language", "C Programming", "ANSI C"], ["backend", "other"]),
  skill("go", "Go", "language", ["Go", "Golang"], ["backend", "devops-platform"]),
  skill("r", "R", "language", ["R", "R Language", "R Programming", "RStudio"], ["data", "ai-ml"]),
  skill("rust", "Rust", "language", ["Rust"], ["backend", "devops-platform"]),
  skill("ruby", "Ruby", "language", ["Ruby"], ["backend"]),
  skill("kotlin", "Kotlin", "language", ["Kotlin"], ["backend", "mobile"]),
  skill("swift", "Swift", "language", ["Swift"], ["mobile"]),
  skill("sql", "SQL", "language", ["SQL"], ["backend", "data", "fullstack"]),

  skill(
    "react",
    "React",
    "framework",
    ["React", "React.js", "ReactJS", "React JS"],
    ["frontend", "fullstack"]
  ),
  skill(
    "nextjs",
    "Next.js",
    "framework",
    ["Next.js", "NextJS", "Next JS"],
    ["frontend", "fullstack"]
  ),
  skill(
    "nodejs",
    "Node.js",
    "framework",
    ["Node.js", "NodeJS", "Node JS", "Node"],
    ["backend", "fullstack"]
  ),
  skill(
    "express",
    "Express",
    "framework",
    ["Express", "Express.js", "ExpressJS"],
    ["backend", "fullstack"]
  ),
  skill("angular", "Angular", "framework", ["Angular", "AngularJS"], ["frontend", "fullstack"]),
  skill("vue", "Vue", "framework", ["Vue", "Vue.js", "VueJS"], ["frontend", "fullstack"]),
  skill("svelte", "Svelte", "framework", ["Svelte", "SvelteKit"], ["frontend"]),
  skill(
    "spring-boot",
    "Spring Boot",
    "framework",
    ["Spring Boot", "SpringBoot", "Spring"],
    ["backend", "fullstack"]
  ),
  skill("laravel", "Laravel", "framework", ["Laravel"], ["backend", "fullstack"]),
  skill("django", "Django", "framework", ["Django"], ["backend", "fullstack"]),
  skill("fastapi", "FastAPI", "framework", ["FastAPI", "Fast API"], ["backend", "ai-ml"]),
  skill("flask", "Flask", "framework", ["Flask"], ["backend", "ai-ml"]),
  skill("dotnet", ".NET", "framework", [".NET", "Dotnet", "Dot Net"], ["backend", "fullstack"]),
  skill(
    "aspnet-core",
    "ASP.NET Core",
    "framework",
    ["ASP.NET Core", "ASP.NET", "AspNet Core"],
    ["backend", "fullstack"]
  ),
  skill(
    "ruby-on-rails",
    "Ruby on Rails",
    "framework",
    ["Ruby on Rails", "Rails", "RoR"],
    ["backend", "fullstack"]
  ),
  skill("flutter", "Flutter", "framework", ["Flutter"], ["mobile"]),
  skill("react-native", "React Native", "framework", ["React Native", "ReactNative"], ["mobile"]),
  skill("langchain", "LangChain", "framework", ["LangChain"], ["ai-ml"]),
  skill("llamaindex", "LlamaIndex", "framework", ["LlamaIndex", "Llama Index"], ["ai-ml"]),
  skill("pytorch", "PyTorch", "framework", ["PyTorch", "Torch"], ["ai-ml"]),
  skill("tensorflow", "TensorFlow", "framework", ["TensorFlow", "Tensor Flow"], ["ai-ml"]),
  skill("pandas", "Pandas", "framework", ["Pandas"], ["data", "ai-ml"]),
  skill(
    "apache-spark",
    "Apache Spark",
    "framework",
    ["Apache Spark", "Spark", "PySpark"],
    ["data"]
  ),

  skill(
    "postgresql",
    "PostgreSQL",
    "database",
    ["PostgreSQL", "Postgres", "Postgre SQL"],
    ["backend", "data", "fullstack"]
  ),
  skill("mysql", "MySQL", "database", ["MySQL", "My SQL"], ["backend", "data", "fullstack"]),
  skill(
    "mongodb",
    "MongoDB",
    "database",
    ["MongoDB", "Mongo DB"],
    ["backend", "data", "fullstack"]
  ),
  skill("redis", "Redis", "database", ["Redis"], ["backend", "data"]),
  skill(
    "sql-server",
    "SQL Server",
    "database",
    ["SQL Server", "MSSQL", "Microsoft SQL Server"],
    ["backend", "data"]
  ),
  skill("oracle", "Oracle Database", "database", ["Oracle", "Oracle DB"], ["backend", "data"]),
  skill("dynamodb", "DynamoDB", "database", ["DynamoDB", "Dynamo DB"], ["backend", "data"]),
  skill(
    "vector-databases",
    "Vector Databases",
    "database",
    ["Vector Database", "Vector Databases", "Vector DB", "Vector Stores"],
    ["ai-ml", "data"]
  ),
  skill("pinecone", "Pinecone", "database", ["Pinecone"], ["ai-ml", "data"]),
  skill("weaviate", "Weaviate", "database", ["Weaviate"], ["ai-ml", "data"]),
  skill("qdrant", "Qdrant", "database", ["Qdrant"], ["ai-ml", "data"]),
  skill("chroma", "Chroma", "database", ["Chroma", "ChromaDB"], ["ai-ml", "data"]),

  skill(
    "aws",
    "AWS",
    "cloud",
    ["AWS", "Amazon Web Services"],
    ["backend", "devops-platform", "fullstack"]
  ),
  skill(
    "azure",
    "Azure",
    "cloud",
    ["Azure", "Microsoft Azure"],
    ["backend", "devops-platform", "fullstack"]
  ),
  skill(
    "gcp",
    "Google Cloud",
    "cloud",
    ["GCP", "Google Cloud", "Google Cloud Platform"],
    ["backend", "devops-platform", "data"]
  ),
  skill(
    "docker",
    "Docker",
    "infrastructure",
    ["Docker", "Containers"],
    ["backend", "devops-platform"]
  ),
  skill(
    "kubernetes",
    "Kubernetes",
    "infrastructure",
    ["Kubernetes", "K8s"],
    ["backend", "devops-platform"]
  ),
  skill("terraform", "Terraform", "infrastructure", ["Terraform", "IaC"], ["devops-platform"]),
  skill(
    "kafka",
    "Apache Kafka",
    "infrastructure",
    ["Kafka", "Apache Kafka"],
    ["backend", "data", "devops-platform"]
  ),
  skill("rabbitmq", "RabbitMQ", "infrastructure", ["RabbitMQ", "Rabbit MQ"], ["backend"]),
  skill(
    "github-actions",
    "GitHub Actions",
    "devops",
    ["GitHub Actions", "Github Actions"],
    ["devops-platform"]
  ),
  skill("jenkins", "Jenkins", "devops", ["Jenkins"], ["devops-platform"]),
  skill(
    "ci-cd",
    "CI/CD",
    "devops",
    ["CI/CD", "CICD", "Continuous Integration"],
    ["devops-platform"]
  ),

  skill(
    "llm",
    "Large Language Models",
    "ai-ml",
    ["LLM", "LLMs", "Large Language Model", "Large Language Models", "Generative AI", "GenAI"],
    ["ai-ml"]
  ),
  skill(
    "rag",
    "Retrieval-Augmented Generation",
    "ai-ml",
    ["RAG", "Retrieval Augmented Generation", "Retrieval-Augmented Generation"],
    ["ai-ml"]
  ),
  skill(
    "machine-learning",
    "Machine Learning",
    "ai-ml",
    ["Machine Learning", "ML"],
    ["ai-ml", "data"]
  ),
  skill(
    "nlp",
    "Natural Language Processing",
    "ai-ml",
    ["NLP", "Natural Language Processing"],
    ["ai-ml"]
  ),
  skill("embeddings", "Embeddings", "ai-ml", ["Embeddings", "Vector Embeddings"], ["ai-ml"]),
  skill("prompt-engineering", "Prompt Engineering", "ai-ml", ["Prompt Engineering"], ["ai-ml"]),

  skill("jest", "Jest", "testing", ["Jest"], ["frontend", "backend", "qa"]),
  skill("vitest", "Vitest", "testing", ["Vitest"], ["frontend", "qa"]),
  skill("pytest", "pytest", "testing", ["pytest", "PyTest"], ["backend", "ai-ml", "qa"]),
  skill("junit", "JUnit", "testing", ["JUnit", "JUnit 5"], ["backend", "qa"]),
  skill("playwright", "Playwright", "testing", ["Playwright"], ["frontend", "qa"]),
  skill("cypress", "Cypress", "testing", ["Cypress"], ["frontend", "qa"]),
  skill("selenium", "Selenium", "testing", ["Selenium"], ["qa"]),

  skill(
    "rest-api",
    "REST APIs",
    "architecture",
    ["REST", "REST API", "REST APIs", "RESTful API"],
    ["backend", "fullstack"]
  ),
  skill(
    "graphql",
    "GraphQL",
    "architecture",
    ["GraphQL", "Graph QL"],
    ["backend", "frontend", "fullstack"]
  ),
  skill(
    "microservices",
    "Microservices",
    "architecture",
    ["Microservices", "Microservice Architecture"],
    ["backend", "devops-platform"]
  ),
  skill(
    "event-driven",
    "Event-Driven Architecture",
    "architecture",
    ["Event Driven Architecture", "Event-Driven Architecture", "EDA"],
    ["backend", "data"]
  ),
  skill(
    "distributed-systems",
    "Distributed Systems",
    "architecture",
    ["Distributed Systems"],
    ["backend", "devops-platform"]
  )
];

const DOMAIN_DEFINITIONS: Array<{
  key: string;
  label: string;
  summary: string;
  skillKeys: Set<string>;
}> = [
  domain(
    "frontend-engineering",
    "Frontend Engineering",
    "Browser applications, UI systems, and client-side delivery.",
    [
      "javascript",
      "typescript",
      "react",
      "nextjs",
      "angular",
      "vue",
      "svelte",
      "playwright",
      "cypress"
    ]
  ),
  domain(
    "backend-engineering",
    "Backend Engineering",
    "APIs, services, persistence, and server-side application behavior.",
    [
      "nodejs",
      "express",
      "spring-boot",
      "laravel",
      "django",
      "fastapi",
      "flask",
      "dotnet",
      "aspnet-core",
      "ruby-on-rails",
      "rest-api",
      "graphql"
    ]
  ),
  domain(
    "data-engineering",
    "Data Engineering",
    "Data storage, processing, movement, and analytical workloads.",
    [
      "sql",
      "postgresql",
      "mysql",
      "mongodb",
      "sql-server",
      "oracle",
      "dynamodb",
      "apache-spark",
      "kafka"
    ]
  ),
  domain(
    "applied-ai",
    "Applied AI Engineering",
    "Machine-learning and language-model systems grounded in application workflows.",
    [
      "llm",
      "rag",
      "machine-learning",
      "nlp",
      "embeddings",
      "prompt-engineering",
      "langchain",
      "llamaindex",
      "pytorch",
      "tensorflow",
      "vector-databases",
      "pinecone",
      "weaviate",
      "qdrant",
      "chroma"
    ]
  ),
  domain(
    "cloud-platform",
    "Cloud & Platform Engineering",
    "Cloud delivery, containers, infrastructure, and deployment automation.",
    [
      "aws",
      "azure",
      "gcp",
      "docker",
      "kubernetes",
      "terraform",
      "github-actions",
      "jenkins",
      "ci-cd"
    ]
  ),
  domain(
    "distributed-architecture",
    "Distributed Architecture",
    "Service boundaries, messaging, scale, and distributed-system trade-offs.",
    ["microservices", "event-driven", "distributed-systems", "kafka", "rabbitmq", "redis"]
  ),
  domain(
    "mobile-engineering",
    "Mobile Engineering",
    "Native and cross-platform mobile application delivery.",
    ["swift", "kotlin", "flutter", "react-native"]
  )
];

const ROLE_PATTERNS: Array<{ family: RoleFamily; pattern: RegExp; weight: number }> = [
  { family: "fullstack", pattern: /\bfull[ -]?stack\b/i, weight: 8 },
  { family: "frontend", pattern: /\b(front[ -]?end|ui engineer|web developer)\b/i, weight: 7 },
  { family: "backend", pattern: /\b(back[ -]?end|api engineer|server[ -]?side)\b/i, weight: 7 },
  { family: "ai-ml", pattern: /\b(ai|machine learning|ml|llm|nlp|data scientist)\b/i, weight: 8 },
  { family: "data", pattern: /\b(data engineer|analytics engineer|data platform)\b/i, weight: 8 },
  {
    family: "devops-platform",
    pattern: /\b(devops|sre|site reliability|platform engineer|cloud engineer)\b/i,
    weight: 8
  },
  { family: "mobile", pattern: /\b(mobile|android|ios)\b/i, weight: 8 },
  { family: "security", pattern: /\b(security|cybersecurity|application security)\b/i, weight: 8 },
  { family: "qa", pattern: /\b(qa|quality assurance|test automation|sdet)\b/i, weight: 8 },
  { family: "product", pattern: /\b(product manager|product management)\b/i, weight: 8 }
];

const BACKEND_ROLE_ANCHORS = new Set([
  "nodejs",
  "express",
  "spring-boot",
  "laravel",
  "django",
  "fastapi",
  "flask",
  "dotnet",
  "aspnet-core",
  "ruby-on-rails",
  "rest-api",
  "microservices"
]);

const aliasIndex = new Map<string, SkillDefinition>();
for (const definition of SKILL_DEFINITIONS) {
  for (const alias of new Set([definition.label, ...definition.aliases])) {
    aliasIndex.set(aliasLookupKey(alias), definition);
  }
}

export function compileCandidateInterviewProfile(
  input: CompileCandidateInterviewProfileInput
): CandidateInterviewProfile {
  const generatedAt = input.generatedAt ?? Date.now();
  const fingerprint = input.sourceResumeFingerprint ?? fingerprintResume(input.resume);
  const accumulators = collectSkills(input.resume, generatedAt);
  const resumeConfidence = normalizeResumeConfidence(input.resume.confidence);

  const skills = [...accumulators.values()]
    .map((accumulator) => compileSkill(accumulator, resumeConfidence))
    .sort(
      (left, right) =>
        right.relevance.score - left.relevance.score || left.label.localeCompare(right.label)
    );

  const inferredRole = inferRole({
    skills,
    experienceRoles: input.resume.experience.map((entry) => entry.role),
    selectedRole: input.selectedRole ?? null
  });
  const experience = inferExperience(input.resume, input.selectedLevel ?? null, generatedAt);
  const domains = compileDomains(skills);
  const importantProjects = compileProjects(input.resume, accumulators);
  const warnings = compileWarnings(input.resume, skills);

  return parseCandidateInterviewProfile({
    schemaVersion: CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION,
    id: input.profileId ?? `candidate-profile-${fingerprint.slice(-24)}`,
    revision: input.revision ?? 1,
    sourceResumeFingerprint: fingerprint,
    generatedAt,
    headline: input.headline?.trim() || inferredRole.title,
    inferredRole,
    experience,
    skills,
    domains,
    importantProjects,
    warnings
  });
}

export function normalizeSkill(rawSkill: string): NormalizedSkill | null {
  const cleaned = rawSkill.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const known = aliasIndex.get(aliasLookupKey(cleaned));
  if (known) {
    return {
      key: known.key,
      label: known.label,
      category: known.category,
      roleFamilies: known.roleFamilies
    };
  }

  const key = slugify(cleaned);
  if (!key) return null;
  return {
    key,
    label: cleaned.slice(0, 120),
    category: inferFallbackCategory(cleaned),
    roleFamilies: []
  };
}

function collectSkills(
  resume: CandidateResume,
  generatedAt: number
): Map<string, SkillAccumulator> {
  const accumulators = new Map<string, SkillAccumulator>();

  for (const rawSkill of resume.skills) {
    addSkillEvidence(accumulators, rawSkill, {
      idPrefix: "skills-section",
      sourceKind: "skills-section",
      sourceId: null,
      sourceLabel: "Resume skills section",
      excerpt: rawSkill,
      recencyMonths: null,
      durationMonths: null,
      confidence: 0.68
    });
  }

  resume.experience.forEach((entry, index) => {
    const sourceId = `experience-${index + 1}`;
    const label =
      [entry.role, entry.organization].filter(Boolean).join(" at ") ||
      `Work experience ${index + 1}`;
    const excerpt = compactExcerpt([entry.summary, ...entry.achievements]);
    const period = parsePeriod(entry.period, generatedAt);
    for (const rawSkill of entry.skills) {
      addSkillEvidence(accumulators, rawSkill, {
        idPrefix: sourceId,
        sourceKind: "work-experience",
        sourceId,
        sourceLabel: label,
        excerpt,
        recencyMonths: period?.recencyMonths ?? null,
        durationMonths: period?.durationMonths ?? null,
        confidence: 0.94
      });
    }
  });

  resume.projects.forEach((project, index) => {
    const sourceId = `project-${index + 1}`;
    const excerpt = compactExcerpt([project.summary, project.outcome]);
    for (const rawSkill of project.skills) {
      addSkillEvidence(accumulators, rawSkill, {
        idPrefix: sourceId,
        sourceKind: "project",
        sourceId,
        sourceLabel: project.name || `Project ${index + 1}`,
        excerpt,
        recencyMonths: null,
        durationMonths: null,
        confidence: 0.88
      });
    }
  });

  return accumulators;
}

function addSkillEvidence(
  accumulators: Map<string, SkillAccumulator>,
  rawSkill: string,
  evidence: Omit<SkillEvidence, "id" | "occurrences"> & { idPrefix: string }
): void {
  const normalized = normalizeSkill(rawSkill);
  if (!normalized) return;

  const accumulator = accumulators.get(normalized.key) ?? {
    definition: normalized,
    aliases: new Set<string>(),
    evidence: []
  };
  if (aliasLookupKey(rawSkill) !== aliasLookupKey(normalized.label)) {
    accumulator.aliases.add(rawSkill.trim().slice(0, 120));
  }

  const existing = accumulator.evidence.find(
    (item) => item.sourceKind === evidence.sourceKind && item.sourceId === evidence.sourceId
  );
  if (existing) {
    existing.occurrences += 1;
    existing.confidence = Math.max(existing.confidence, evidence.confidence);
  } else {
    accumulator.evidence.push({
      id: `${evidence.idPrefix}-${normalized.key}`.slice(0, 160),
      sourceKind: evidence.sourceKind,
      sourceId: evidence.sourceId,
      sourceLabel: evidence.sourceLabel,
      excerpt: evidence.excerpt,
      recencyMonths: evidence.recencyMonths,
      durationMonths: evidence.durationMonths,
      occurrences: 1,
      confidence: evidence.confidence
    });
  }

  accumulators.set(normalized.key, accumulator);
}

function compileSkill(accumulator: SkillAccumulator, resumeConfidence: number): CandidateSkill {
  const relevance = scoreResumeEvidence(accumulator.evidence, resumeConfidence);
  return {
    key: accumulator.definition.key,
    label: accumulator.definition.label,
    category: accumulator.definition.category,
    aliases: [...accumulator.aliases].sort(),
    primary:
      relevance.score >= 35 &&
      accumulator.evidence.some(
        (item) => item.sourceKind === "work-experience" || item.sourceKind === "project"
      ),
    evidence: accumulator.evidence,
    relevance
  };
}

/**
 * A resume-only baseline. Step 3 will apply target-role, job-description, and
 * demonstrated-ability policy on top of these traceable signals.
 */
function scoreResumeEvidence(
  evidence: SkillEvidence[],
  resumeConfidence: number
): SkillRelevanceScore {
  const work = evidence.filter((item) => item.sourceKind === "work-experience");
  const projects = evidence.filter((item) => item.sourceKind === "project");
  const skillsMentioned = evidence.some((item) => item.sourceKind === "skills-section");
  const distinctSubstantialSources = work.length + projects.length;
  const signals: RelevanceSignal[] = [];

  if (work.length) {
    const months = work.reduce((sum, item) => sum + (item.durationMonths ?? 0), 0);
    const strength = clamp01(0.5 + (work.length - 1) * 0.25 + Math.min(months, 36) / 120);
    signals.push(
      signal("work-experience", strength, 0.55, "Supported by professional experience.")
    );
  }
  if (projects.length) {
    const strength = clamp01(0.55 + (projects.length - 1) * 0.2);
    signals.push(signal("project", strength, 0.25, "Used in a named candidate project."));
  }
  if (distinctSubstantialSources > 1) {
    const strength = clamp01((distinctSubstantialSources - 1) / 3);
    signals.push(
      signal("repeated-use", strength, 0.1, "Appears across multiple substantial sources.")
    );
  }

  const knownRecencies = work.flatMap((item) =>
    item.recencyMonths === null ? [] : [item.recencyMonths]
  );
  if (knownRecencies.length) {
    const newest = Math.min(...knownRecencies);
    const strength = clamp01(1 - newest / 60);
    signals.push(
      signal("recency", strength, 0.05, "Professional usage is recent enough to interview.")
    );
  }
  if (skillsMentioned) {
    signals.push(
      signal("skills-mention", 1, 0.05, "Explicitly listed in the resume skills section.")
    );
  }

  if (!signals.length) {
    signals.push(signal("skills-mention", 0.25, 0.05, "Present in the extracted resume profile."));
  }

  const score = roundScore(signals.reduce((sum, item) => sum + item.contribution, 0));
  const evidenceConfidence =
    evidence.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, evidence.length);
  const confidence = roundUnit(
    clamp01(evidenceConfidence * 0.7 + resumeConfidence * 0.3) *
      (distinctSubstantialSources > 0 ? 1 : 0.78)
  );
  const reasons = [
    work.length
      ? `${work.length} professional experience source${work.length === 1 ? "" : "s"}`
      : "",
    projects.length
      ? `${projects.length} named project source${projects.length === 1 ? "" : "s"}`
      : "",
    skillsMentioned ? "Explicit skills-section mention" : ""
  ].filter(Boolean);

  return {
    score,
    confidence,
    signals,
    reasons: reasons.length ? reasons : ["Extracted resume evidence"]
  };
}

function compileDomains(skills: CandidateSkill[]): CandidateInterviewProfile["domains"] {
  return DOMAIN_DEFINITIONS.flatMap((definition) => {
    const matches = skills.filter((candidateSkill) => definition.skillKeys.has(candidateSkill.key));
    if (!matches.length) return [];

    const sorted = matches.sort((left, right) => right.relevance.score - left.relevance.score);
    const top = sorted.slice(0, 4);
    const relevance: SkillRelevanceScore = {
      score: roundScore(top.reduce((sum, item) => sum + item.relevance.score, 0) / top.length),
      confidence: roundUnit(
        top.reduce((sum, item) => sum + item.relevance.confidence, 0) / top.length
      ),
      signals: top.flatMap((item) => item.relevance.signals).slice(0, 12),
      reasons: [`Supported by ${matches.map((item) => item.label).join(", ")}`]
    };

    return [
      {
        key: definition.key,
        label: definition.label,
        summary: definition.summary,
        skillKeys: matches.map((item) => item.key),
        evidenceIds: unique(
          matches.flatMap((item) => item.evidence.map((evidence) => evidence.id))
        ),
        relevance
      }
    ];
  }).sort((left, right) => right.relevance.score - left.relevance.score);
}

function compileProjects(
  resume: CandidateResume,
  accumulators: Map<string, SkillAccumulator>
): CandidateInterviewProfile["importantProjects"] {
  return resume.projects
    .map((project, index) => {
      const sourceId = `project-${index + 1}`;
      const skillKeys = unique(
        project.skills.flatMap((rawSkill) => {
          const normalized = normalizeSkill(rawSkill);
          return normalized ? [normalized.key] : [];
        })
      );
      const evidenceIds = unique(
        skillKeys.flatMap((key) =>
          (accumulators.get(key)?.evidence ?? [])
            .filter((evidence) => evidence.sourceId === sourceId)
            .map((evidence) => evidence.id)
        )
      );
      const importance = roundUnit(
        clamp01(0.4 + Math.min(skillKeys.length, 5) * 0.07 + (project.outcome.trim() ? 0.2 : 0))
      );

      return {
        id: sourceId,
        name: project.name || `Project ${index + 1}`,
        summary: project.summary || project.outcome || "Resume-backed candidate project.",
        candidateRole: null,
        outcome: project.outcome.trim() || null,
        skillKeys,
        evidenceIds,
        importance
      };
    })
    .sort((left, right) => right.importance - left.importance);
}

function inferRole(input: {
  skills: CandidateSkill[];
  experienceRoles: string[];
  selectedRole: Role | null;
}): CandidateInterviewProfile["inferredRole"] {
  const scores = new Map<RoleFamily, number>();
  const add = (family: RoleFamily, value: number) =>
    scores.set(family, (scores.get(family) ?? 0) + value);

  for (const role of input.experienceRoles) {
    for (const pattern of ROLE_PATTERNS) {
      if (pattern.pattern.test(role)) add(pattern.family, pattern.weight);
    }
  }

  for (const candidateSkill of input.skills) {
    const normalized = normalizeSkill(candidateSkill.label);
    if (!normalized) continue;
    const evidenceFactor = Math.max(0.25, candidateSkill.relevance.score / 100);
    for (const family of normalized.roleFamilies) add(family, evidenceFactor);
  }

  const frontend = scores.get("frontend") ?? 0;
  const backend = scores.get("backend") ?? 0;
  if (frontend >= 1 && backend >= 1) add("fullstack", Math.min(frontend, backend) * 0.9);

  if (!scores.size && input.selectedRole) add(roleFamilyFromSelected(input.selectedRole), 1);
  if (!scores.size) add("other", 1);

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  const [topFamily = "other", topScore = 1] = ranked[0] ?? [];
  const [secondFamily, secondScore = 0] = ranked[1] ?? [];
  const confidence = roundUnit(clamp01(0.5 + (topScore / (topScore + secondScore + 2)) * 0.45));
  const backendScore = scores.get("backend") ?? 0;
  const hasBackendAnchor = input.skills.some(
    (candidateSkill) => candidateSkill.primary && BACKEND_ROLE_ANCHORS.has(candidateSkill.key)
  );
  const title =
    topFamily === "ai-ml" && hasBackendAnchor
      ? roleTitle(topFamily, "backend", backendScore / Math.max(topScore, 0.001))
      : roleTitle(topFamily, secondFamily, secondScore / Math.max(topScore, 0.001));
  const primarySkills = input.skills
    .filter((candidateSkill) => candidateSkill.primary)
    .slice(0, 4)
    .map((candidateSkill) => candidateSkill.label);

  return {
    title,
    family: topFamily,
    confidence,
    rationale: primarySkills.length
      ? `Resume roles and substantial evidence center on ${primarySkills.join(", ")}.`
      : "Inferred from the candidate's extracted role and available resume evidence."
  };
}

function inferExperience(
  resume: CandidateResume,
  selectedLevel: Level | null,
  generatedAt: number
): CandidateInterviewProfile["experience"] {
  const intervals = resume.experience.flatMap((entry) => {
    const period = parsePeriod(entry.period, generatedAt);
    return period ? [{ start: period.startMonth, end: period.endMonth }] : [];
  });
  const months = mergedIntervalMonths(intervals);
  const estimatedYears = months > 0 ? Math.round((months / 12) * 2) / 2 : null;
  const band =
    estimatedYears === null ? bandFromSelectedLevel(selectedLevel) : bandFromYears(estimatedYears);
  const parsedRatio = resume.experience.length ? intervals.length / resume.experience.length : 0;
  const confidence = roundUnit(
    clamp01(0.45 + parsedRatio * 0.4 + normalizeResumeConfidence(resume.confidence) * 0.15)
  );

  return { estimatedYears, band, confidence };
}

function compileWarnings(resume: CandidateResume, skills: CandidateSkill[]): string[] {
  const warnings = new Set(resume.warnings.map((warning) => warning.trim()).filter(Boolean));
  const substantial = skills.some((candidateSkill) =>
    candidateSkill.evidence.some(
      (evidence) => evidence.sourceKind === "work-experience" || evidence.sourceKind === "project"
    )
  );
  if (!skills.length) warnings.add("No interviewable technologies were extracted from the resume.");
  else if (!substantial) {
    warnings.add(
      "Technology evidence comes mainly from the skills section, without job or project support."
    );
  }
  return [...warnings].slice(0, 10);
}

function parsePeriod(period: string, generatedAt: number): PeriodMetrics | null {
  const parts = period
    .trim()
    .split(/\s*(?:-|–|—|\bto\b)\s*/i)
    .filter(Boolean);
  if (parts.length < 2) return null;

  const now = new Date(generatedAt);
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const startMonth = parseDateToken(parts[0] ?? "", false, currentMonth);
  const endMonth = parseDateToken(parts[parts.length - 1] ?? "", true, currentMonth);
  if (startMonth === null || endMonth === null || endMonth < startMonth) return null;

  return {
    startMonth,
    endMonth,
    durationMonths: endMonth - startMonth + 1,
    recencyMonths: Math.max(0, currentMonth - endMonth)
  };
}

function parseDateToken(token: string, end: boolean, currentMonth: number): number | null {
  if (/\b(present|current|now)\b/i.test(token)) return currentMonth;
  const yearMatch = token.match(/\b((?:19|20)\d{2})\b/);
  if (!yearMatch?.[1]) return null;
  const year = Number(yearMatch[1]);
  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec"
  ];
  const month = monthNames.findIndex((name) => token.toLowerCase().includes(name));
  return year * 12 + (month >= 0 ? month : end ? 11 : 0);
}

function mergedIntervalMonths(intervals: Array<{ start: number; end: number }>): number {
  if (!intervals.length) return 0;
  const sorted = intervals.slice().sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];

  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end + 1) {
      merged.push({ ...interval });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged.reduce((sum, interval) => sum + interval.end - interval.start + 1, 0);
}

function bandFromYears(years: number): ExperienceBand {
  if (years < 0.5) return "fresher";
  if (years < 2) return "junior";
  if (years < 5) return "mid";
  if (years < 9) return "senior";
  return "staff-plus";
}

function bandFromSelectedLevel(level: Level | null): ExperienceBand {
  if (level === "fresher") return "fresher";
  if (level === "0-2") return "junior";
  if (level === "3-5") return "mid";
  if (level === "5-plus") return "senior";
  return "unknown";
}

function roleFamilyFromSelected(role: Role): RoleFamily {
  if (role === "pm") return "product";
  return role;
}

function roleTitle(
  top: RoleFamily,
  second: RoleFamily | undefined,
  secondToTopRatio: number
): string {
  if (top === "ai-ml" && second === "backend" && secondToTopRatio >= 0.15) {
    return "AI / Backend Engineer";
  }
  if (
    ((top === "frontend" && second === "backend") ||
      (top === "backend" && second === "frontend")) &&
    secondToTopRatio >= 0.55
  ) {
    return "Full Stack Engineer";
  }

  const titles: Record<RoleFamily, string> = {
    frontend: "Frontend Engineer",
    backend: "Backend Engineer",
    fullstack: "Full Stack Engineer",
    mobile: "Mobile Engineer",
    data: "Data Engineer",
    "ai-ml": "AI / ML Engineer",
    "devops-platform": "Platform Engineer",
    security: "Security Engineer",
    qa: "Quality Engineer",
    product: "Product Manager",
    other: "Software Engineer"
  };
  return titles[top];
}

function fingerprintResume(resume: CandidateResume): string {
  const source = {
    fullName: resume.fullName,
    skills: resume.skills,
    experience: resume.experience,
    education: resume.education,
    projects: resume.projects,
    achievements: resume.achievements
  };
  return `sha256-${createHash("sha256").update(JSON.stringify(source)).digest("hex")}`;
}

function inferFallbackCategory(label: string): SkillCategory {
  const value = label.toLowerCase();
  if (/\b(db|database|sql|store)\b/.test(value)) return "database";
  if (/\b(cloud|aws|azure|gcp)\b/.test(value)) return "cloud";
  if (/\b(test|testing|qa)\b/.test(value)) return "testing";
  if (/\b(ai|ml|model|embedding|retrieval)\b/.test(value)) return "ai-ml";
  if (/\b(framework|sdk|library)\b/.test(value)) return "framework";
  if (/\b(docker|container|kubernetes|queue|broker)\b/.test(value)) return "infrastructure";
  if (/\b(architecture|system design|microservice|distributed)\b/.test(value)) {
    return "architecture";
  }
  return "other";
}

function signal(
  kind: RelevanceSignal["kind"],
  strength: number,
  weight: number,
  reason: string
): RelevanceSignal {
  return {
    kind,
    strength: roundUnit(strength),
    weight,
    contribution: roundScore(strength * weight * 100),
    reason
  };
}

function skill(
  key: string,
  label: string,
  category: SkillCategory,
  aliases: string[],
  roleFamilies: RoleFamily[]
): SkillDefinition {
  return { key, label, category, aliases, roleFamilies };
}

function domain(key: string, label: string, summary: string, skillKeys: string[]) {
  return { key, label, summary, skillKeys: new Set(skillKeys) };
}

function aliasLookupKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function compactExcerpt(values: string[]): string | null {
  const excerpt = values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 1_000);
  return excerpt || null;
}

function normalizeResumeConfidence(value: number): number {
  return clamp01(value > 1 ? value / 100 : value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundUnit(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}
