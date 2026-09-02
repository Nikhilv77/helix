import { Prisma } from "@prisma/client";

import type {
  WorkspaceSearchKind,
  WorkspaceSearchResponse,
  WorkspaceSearchResult
} from "@/lib/search/workspace-search";
import type { PrismaService } from "@/server/database/prisma.service";

const MAX_RESULTS = 24;

interface DatabaseSearchRow {
  id: string;
  kind: WorkspaceSearchKind;
  group_name: WorkspaceSearchResult["group"];
  title: string;
  description: string;
  href: string;
  badge: string | null;
  score: number;
}

interface StaticSearchItem {
  id: string;
  title: string;
  description: string;
  keywords: string;
  href: string;
}

const STATIC_ITEMS: StaticSearchItem[] = [
  {
    id: "home",
    title: "Home",
    description: "Your coaching summary and interview readiness.",
    keywords: "overview dashboard teacher readiness",
    href: "/"
  },
  {
    id: "practice",
    title: "Practice",
    description: "Open your personalized practice sessions and question roadmap.",
    keywords: "learn questions roadmap sessions dsa technical behavioral",
    href: "/practice"
  },
  {
    id: "dsa-questions",
    title: "DSA question bank",
    description: "Browse coding questions, patterns, notes, and solutions.",
    keywords: "algorithms data structures coding leetcode patterns",
    href: "/dsa-questions"
  },
  {
    id: "interviews",
    title: "Interviews",
    description: "Start a personalized interview or continue an existing round.",
    keywords: "mock interview voice technical behavioral resume",
    href: "/interviews"
  },
  {
    id: "progress",
    title: "Progress",
    description: "See completed questions, activity, strengths, and learning gaps.",
    keywords: "analytics completion streak learning mastery",
    href: "/progress"
  },
  {
    id: "reports",
    title: "Reports",
    description: "Review interview evidence, scores, competencies, and recommendations.",
    keywords: "results score readiness feedback weaknesses strengths",
    href: "/reports"
  },
  {
    id: "profile",
    title: "Profile",
    description: "Review your resume, target role, stories, and preparation context.",
    keywords: "resume account role level skills stories avatar",
    href: "/profile"
  },
  {
    id: "settings",
    title: "Settings",
    description: "Manage your teacher, accent, account, and workspace preferences.",
    keywords: "manage account teacher theme accent logout delete",
    href: "/manage"
  }
];

/**
 * Owner-scoped global search over canonical records. There is deliberately no
 * duplicate search table to drift out of sync: PostgreSQL ranks the authored
 * question banks and the learner's current records directly.
 */
export class WorkspaceSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(ownerId: string, rawQuery: string): Promise<WorkspaceSearchResponse> {
    const query = normalizeQuery(rawQuery);
    if (!query) return { query, results: [] };

    const databaseRows = await this.databaseSearch(ownerId, query);
    const pageRows = searchStaticItems(query);
    const results = [...databaseRows.map(toResult), ...pageRows]
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, MAX_RESULTS);

    return { query, results };
  }

  private databaseSearch(ownerId: string, query: string): Promise<DatabaseSearchRow[]> {
    return this.prisma.$queryRaw<DatabaseSearchRow[]>(Prisma.sql`
      WITH search_input AS (
        SELECT
          websearch_to_tsquery('english', ${query}) AS ts_query,
          lower(${query}) AS needle,
          '%' || lower(${query}) || '%' AS contains
      ),
      assigned_prep AS (
        SELECT DISTINCT ON (question."id")
          'prep:' || question."id" AS id,
          'question'::text AS kind,
          'Questions'::text AS group_name,
          question."title" AS title,
          question."objective" AS description,
          CASE
            WHEN placement."practiceSessionKey" IS NULL THEN '/practice'
            ELSE '/practice/' || placement."practiceSessionKey" || '/' || question."id"
          END AS href,
          initcap(question."difficulty") || ' · ' || initcap(question."format") AS badge,
          question."title" || ' ' || question."prompt" || ' ' || question."objective" || ' ' ||
          question."competency" || ' ' || array_to_string(question."tags", ' ') || ' ' ||
            array_to_string(question."whatItTests", ' ') AS search_text,
          0.35::double precision AS type_boost
        FROM "PrepQuestionTemplate" question
        LEFT JOIN LATERAL (
          SELECT item."practiceSessionKey", item."order"
          FROM "UserQuestionProgress" progress
          JOIN "UserRoadmap" roadmap
            ON roadmap."id" = progress."roadmapId" AND roadmap."ownerId" = ${ownerId}
          JOIN "PracticeQuestionPlacement" item
            ON item."questionProgressId" = progress."id"
          WHERE progress."prepQuestionTemplateId" = question."id"
          ORDER BY
            CASE WHEN item."practiceSessionKey" = 'final-mock' THEN 1 ELSE 0 END,
            item."order"
          LIMIT 1
        ) placement ON true
        WHERE question."publicationStatus" = 'PUBLISHED'
        ORDER BY question."id"
      ),
      prep_notes AS (
        SELECT DISTINCT ON (note."id")
          'prep-note:' || note."id"::text AS id,
          'note'::text AS kind,
          'Your work'::text AS group_name,
          'Note · ' || question."title" AS title,
          left(regexp_replace(note."content", '\\s+', ' ', 'g'), 180) AS description,
          CASE
            WHEN placement."practiceSessionKey" IS NULL THEN '/practice'
            ELSE '/practice/' || placement."practiceSessionKey" || '/' || question."id"
          END AS href,
          'Private note'::text AS badge,
          question."title" || ' ' || note."content" AS search_text,
          0.2::double precision AS type_boost
        FROM "UserPrepQuestionNote" note
        JOIN "PrepQuestionTemplate" question
          ON question."id" = note."prepQuestionTemplateId"
        LEFT JOIN LATERAL (
          SELECT item."practiceSessionKey", item."order"
          FROM "UserQuestionProgress" progress
          JOIN "UserRoadmap" roadmap
            ON roadmap."id" = progress."roadmapId" AND roadmap."ownerId" = note."ownerId"
          JOIN "PracticeQuestionPlacement" item
            ON item."questionProgressId" = progress."id"
          WHERE progress."prepQuestionTemplateId" = question."id"
          ORDER BY
            CASE WHEN item."practiceSessionKey" = 'final-mock' THEN 1 ELSE 0 END,
            item."order"
          LIMIT 1
        ) placement ON true
        WHERE note."ownerId" = ${ownerId}
        ORDER BY note."id"
      ),
      draft_answers AS (
        SELECT
          'draft:' || progress."id"::text AS id,
          'note'::text AS kind,
          'Your work'::text AS group_name,
          'Draft · ' || coalesce(question."title", template."titleSnapshot", 'Practice answer') AS title,
          left(regexp_replace(progress."draftAnswer", '\\s+', ' ', 'g'), 180) AS description,
          CASE
            WHEN progress."dsaQuestionSlug" IS NOT NULL
              THEN '/dsa-questions/' || progress."dsaQuestionSlug"
            WHEN placement."practiceSessionKey" IS NOT NULL
              THEN '/practice/' || placement."practiceSessionKey" || '/' || progress."prepQuestionTemplateId"
            ELSE '/practice'
          END AS href,
          'Saved draft'::text AS badge,
          coalesce(question."title", template."titleSnapshot", '') || ' ' || progress."draftAnswer" AS search_text,
          0.15::double precision AS type_boost
        FROM "UserQuestionProgress" progress
        JOIN "UserRoadmap" roadmap ON roadmap."id" = progress."roadmapId"
        LEFT JOIN "PrepQuestionTemplate" question
          ON question."id" = progress."prepQuestionTemplateId"
        LEFT JOIN "RoadmapQuestionTemplate" template
          ON template."id" = progress."roadmapQuestionTemplateId"
        LEFT JOIN LATERAL (
          SELECT item."practiceSessionKey"
          FROM "PracticeQuestionPlacement" item
          WHERE item."questionProgressId" = progress."id"
          ORDER BY CASE WHEN item."practiceSessionKey" = 'final-mock' THEN 1 ELSE 0 END, item."order"
          LIMIT 1
        ) placement ON true
        WHERE roadmap."ownerId" = ${ownerId}
          AND nullif(btrim(progress."draftAnswer"), '') IS NOT NULL
      ),
      recent_interviews AS (
        SELECT session.*
        FROM "InterviewSession" session
        WHERE session."ownerId" = ${ownerId}
        ORDER BY session."startedAt" DESC
        LIMIT 75
      ),
      candidates AS (
        SELECT
          'dsa:' || question."slug" AS id,
          'question'::text AS kind,
          'Questions'::text AS group_name,
          question."title" AS title,
          question."promptSummary" AS description,
          '/dsa-questions/' || question."slug" AS href,
          initcap(question."difficulty") || ' · ' || question."primaryPattern" AS badge,
          question."title" || ' ' || question."primaryPattern" || ' ' ||
            question."promptSummary" || ' ' || array_to_string(question."subPatterns", ' ') || ' ' ||
            array_to_string(question."conceptsTested", ' ') AS search_text,
          0.45::double precision AS type_boost
        FROM "DsaQuestion" question

        UNION ALL
        SELECT * FROM assigned_prep

        UNION ALL
        SELECT
          'practice:' || progress."id"::text,
          'practice'::text,
          'Practice'::text,
          coalesce(progress."titleSnapshot", template."title"),
          coalesce(progress."purposeSnapshot", template."purpose", ''),
          CASE
            WHEN progress."practiceSessionKey" = 'frontend-dsa' THEN '/practice/dsa'
            ELSE '/practice/' || progress."practiceSessionKey"
          END,
          round(progress."progressPercent")::int::text || '% complete',
          coalesce(progress."titleSnapshot", template."title") || ' ' ||
            coalesce(progress."purposeSnapshot", template."purpose", '') || ' ' ||
            array_to_string(progress."coversSnapshot", ' '),
          0.3::double precision
        FROM "UserSessionProgress" progress
        JOIN "UserRoadmap" roadmap ON roadmap."id" = progress."roadmapId"
        JOIN "RoadmapSessionTemplate" template ON template."id" = progress."sessionTemplateId"
        WHERE roadmap."ownerId" = ${ownerId}

        UNION ALL
        SELECT
          'dsa-note:' || note."id"::text,
          'note'::text,
          'Your work'::text,
          'Note · ' || question."title",
          left(regexp_replace(note."content", '\\s+', ' ', 'g'), 180),
          '/dsa-questions/' || question."slug",
          'Private note'::text,
          question."title" || ' ' || note."content",
          0.2::double precision
        FROM "UserDsaQuestionNote" note
        JOIN "DsaQuestion" question ON question."slug" = note."slug"
        WHERE note."ownerId" = ${ownerId}

        UNION ALL
        SELECT * FROM prep_notes

        UNION ALL
        SELECT * FROM draft_answers

        UNION ALL
        SELECT
          'interview:' || session."id"::text,
          'interview'::text,
          'Interviews'::text,
          coalesce(
            session."state" #>> '{setup,templateTitle}',
            initcap(replace(session."state" #>> '{setup,roundType}', '-', ' ')) || ' interview'
          ),
          concat_ws(
            ' · ',
            initcap(replace(session."state" #>> '{setup,role}', '-', ' ')),
            upper(session."state" #>> '{setup,level}'),
            initcap(session."state" #>> '{setup,intensity}')
          ),
          CASE
            WHEN session."state" ->> 'phase' = 'done' THEN '/reports'
            ELSE '/interview/voice?session=' || session."id"::text
          END,
          CASE WHEN session."state" ->> 'phase' = 'done' THEN 'Completed' ELSE 'In progress' END,
          concat_ws(
            ' ',
            session."state" #>> '{setup,templateTitle}',
            session."state" #>> '{setup,role}',
            session."state" #>> '{setup,level}',
            session."state" #>> '{setup,roundType}',
            session."state" #>> '{setup,intensity}',
            session."state" #>> '{setup,context}',
            (
              SELECT string_agg(question ->> 'text', ' ')
              FROM jsonb_array_elements(coalesce(session."state" -> 'plan', '[]'::jsonb)) question
            ),
            (
              SELECT string_agg(turn ->> 'text', ' ')
              FROM jsonb_array_elements(coalesce(session."state" -> 'turns', '[]'::jsonb)) turn
            )
          ),
          0.25::double precision
        FROM recent_interviews session
      ),
      ranked AS (
        SELECT
          candidate.id,
          candidate.kind,
          candidate.group_name,
          candidate.title,
          candidate.description,
          candidate.href,
          candidate.badge,
          greatest(
            ts_rank_cd(to_tsvector('english', candidate.search_text), input.ts_query) * 5,
            similarity(lower(candidate.title), input.needle) * 4,
            CASE
              WHEN lower(candidate.title) = input.needle THEN 8
              WHEN lower(candidate.title) LIKE input.needle || '%' THEN 6
              WHEN lower(candidate.title) LIKE input.contains THEN 3
              ELSE 0
            END,
            CASE WHEN lower(candidate.search_text) LIKE input.contains THEN 1.4 ELSE 0 END
          ) + candidate.type_boost AS score
        FROM candidates candidate
        CROSS JOIN search_input input
        WHERE
          to_tsvector('english', candidate.search_text) @@ input.ts_query
          OR lower(candidate.title) % input.needle
          OR lower(candidate.title) LIKE input.contains
          OR lower(candidate.search_text) LIKE input.contains
      )
      SELECT id, kind, group_name, title, description, href, badge, score
      FROM ranked
      ORDER BY score DESC, title ASC
      LIMIT ${MAX_RESULTS}
    `);
  }
}

export function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function searchStaticItems(query: string): WorkspaceSearchResult[] {
  const needle = query.toLowerCase();
  return STATIC_ITEMS.map((item) => {
    const title = item.title.toLowerCase();
    const haystack = `${title} ${item.description.toLowerCase()} ${item.keywords}`;
    const exact = title === needle ? 8 : 0;
    const prefix = title.startsWith(needle) ? 6 : 0;
    const contains = title.includes(needle) ? 3 : haystack.includes(needle) ? 1.4 : 0;
    const fuzzy = trigramSimilarity(title, needle) * 4;
    return {
      id: `page:${item.id}`,
      kind: "page" as const,
      group: "Pages" as const,
      title: item.title,
      description: item.description,
      href: item.href,
      badge: null,
      score: Math.max(exact, prefix, contains, fuzzy)
    };
  }).filter((item) => item.score >= 1.15);
}

export function trigramSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  const leftSet = trigrams(left);
  const rightSet = trigrams(right);
  let intersection = 0;
  for (const value of leftSet) if (rightSet.has(value)) intersection += 1;
  return (2 * intersection) / (leftSet.size + rightSet.size);
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value.toLowerCase()} `;
  const values = new Set<string>();
  for (let index = 0; index <= padded.length - 3; index += 1) {
    values.add(padded.slice(index, index + 3));
  }
  return values;
}

function toResult(row: DatabaseSearchRow): WorkspaceSearchResult {
  return {
    id: row.id,
    kind: row.kind,
    group: row.group_name,
    title: row.title,
    description: row.description,
    href: row.href,
    badge: row.badge,
    score: Number(row.score)
  };
}
