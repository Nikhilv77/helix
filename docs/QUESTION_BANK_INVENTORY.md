# Question Bank Inventory

This is a quick map for agents working on Trailgrad question recommendations.

## Database Tables

### DsaPhase

Stores DSA curriculum phases.

Current count: 11 phases.

### DsaQuestion

Stores the global DSA question bank.

Current count: 200 questions.

Important fields:

- `slug`
- `phaseSlug`
- `title`
- `primaryPattern`
- `subPatterns`
- `difficulty`
- `expectedTimeMinutes`
- `recommendedOrder`
- `prerequisites`
- `conceptsTested`
- `commonMistakes`
- `interviewSignals`
- `followUpPrompts`
- `problemStatement`
- `hints`
- `approaches`
- `edgeCases`
- `relatedQuestions`

Local source files:

- `src/data/dsa/*.json`

Temporary verification pages:

- `/dsa-questions`
- `/dsa-questions/audit`
- `/dsa-questions/[slug]`

### PrepQuestionTemplate

Stores reusable non-DSA prep templates.

Current banks:

- `behavioral-resume-deep-dive`: 8 templates
- `frontend-core`: 12 templates

Local source files:

- `src/data/prep/behavioral-resume-deep-dive.json`
- `src/data/prep/frontend-core.json`

## Current Product Direction

Home should show a frontend playlist with six sessions:

1. Frontend DSA
2. JavaScript and React Core
3. Computer Fundamentals
4. Production UI Quality
5. Resume and Behavioral Defense
6. Final Frontend Mock

Only `Frontend DSA` should have real questions for now.

Other sessions should be placeholders using titles/purposes only. Do not generate detailed non-DSA questions yet.

This is a phased build slice. Do not remove other roles, existing templates, DSA data, resume parsing, interview flows, profile pages, reports, or backend services. Build the Frontend DSA playlist first while keeping the rest of Trailgrad available for later phases.

## Useful Queries

Count DSA questions by phase:

```ts
await prisma.dsaPhase.findMany({
  orderBy: { phaseNumber: "asc" },
  select: {
    slug: true,
    title: true,
    questionCount: true
  }
});
```

Fetch DSA questions by pattern:

```ts
await prisma.dsaQuestion.findMany({
  where: { primaryPattern: "sliding-window" },
  orderBy: [{ phase: { phaseNumber: "asc" } }, { recommendedOrder: "asc" }]
});
```

Fetch frontend prep templates:

```ts
await prisma.prepQuestionTemplate.findMany({
  where: { bank: "frontend-core" },
  orderBy: { id: "asc" }
});
```

Fetch core behavioral/resume templates:

```ts
await prisma.prepQuestionTemplate.findMany({
  where: { bank: "behavioral-resume-deep-dive" },
  orderBy: { id: "asc" }
});
```

## Frontend DSA Curation

The global DSA bank has 200 questions. The frontend session should show around 120 curated questions.

Prefer:

- Arrays and hashing
- Strings
- Two pointers
- Sliding window
- Stack and queue
- Binary search
- Linked list basics
- Tree basics
- Heap basics
- Backtracking basics
- DP basics

Use lightly:

- Advanced graphs
- Union find
- Shortest paths
- Hard DP
- Niche hard problems

Do not show all 200 as the frontend path.
