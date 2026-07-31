# AI System Design Copilot

Full-stack local workspace for an AI System Design Copilot. The NestJS backend manages projects, design sessions, knowledge ingestion, retrieval, requirement analysis, deterministic capacity calculation, system-design generation, Mermaid diagrams, and design validation. The Next.js frontend connects to those APIs and provides the guided product flow.

## Technology Stack

- NestJS and TypeScript
- pnpm
- PostgreSQL
- Prisma ORM
- Zod
- Official `@google/genai` SDK
- Next.js App Router, React, TypeScript, Tailwind CSS
- Mermaid diagram rendering
- Jest
- Vitest and React Testing Library
- ESLint and Prettier
- Docker Compose

## Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer
- Docker Desktop or a compatible Docker runtime

## Environment Setup

Copy `.env.example` to `.env` and adjust values for your machine.

Required values are validated with Zod during startup. Invalid or missing required configuration stops the app with a clear error. Sensitive values such as `DATABASE_URL` are not logged by the application.

AI configuration is provider-agnostic at the application boundary, with Gemini as the only working provider for now:

```bash
GEMINI_API_KEY=...
GEMINI_FAST_MODEL=gemini-flash-latest
GEMINI_REASONING_MODEL=gemini-flash-latest
AI_TIMEOUT_MS=30000
AI_MAX_RETRIES=2
KNOWLEDGE_CHUNK_MAX_TOKENS=800
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_MODEL_VERSION=v1
KNOWLEDGE_EMBEDDING_DIMENSIONS=768
KNOWLEDGE_EMBEDDING_BATCH_SIZE=16
RETRIEVAL_DEFAULT_TOP_K=5
RETRIEVAL_MIN_SIMILARITY=0.2
```

Prompts, system instructions, API keys, and generated content are not written to request logs by the AI provider wrapper.

The frontend reads its API URL from `frontend/.env.local`:

```bash
cp frontend/.env.example frontend/.env.local
```

Default frontend API target:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

When running the frontend on `localhost:3001`, keep `http://localhost:3001` in backend `CORS_ORIGINS`.

## Database Startup

```bash
pnpm docker:up
```

PostgreSQL runs on `localhost:5432` with a persistent Docker volume named `postgres_data`. The Docker Compose service uses the `pgvector/pgvector:pg16` image so the `vector` extension is available for knowledge chunk embeddings.

## Prisma Commands

```bash
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:seed
pnpm prisma:studio
```

The current Prisma schema includes projects, design sessions, persisted requirement analysis JSON, persisted capacity calculation JSON, persisted generated system design JSON, persisted architecture diagram JSON, persisted design validation JSON, knowledge documents, knowledge chunks, and pgvector-backed chunk embeddings. It does not include authentication, agent, frontend, or chat-follow-up models.

To apply the included migration to an existing database:

```bash
pnpm prisma migrate deploy
```

Seed data creates one active project, one archived project, and two design sessions:

```bash
pnpm prisma:seed
```

## Development Commands

```bash
pnpm install
pnpm start:dev
pnpm build
pnpm lint
pnpm format
```

Run the frontend in a second terminal:

```bash
pnpm frontend:dev
```

The Next.js app runs on:

```text
http://localhost:3001
```

To verify structured Gemini output during development:

```bash
pnpm ai:verify
```

This script calls the configured fast Gemini model with an internal Zod schema and is separate from the design-session requirement-analysis workflow.

## Knowledge Ingestion Endpoints

```text
POST   /api/v1/knowledge/documents
GET    /api/v1/knowledge/documents
GET    /api/v1/knowledge/documents/:id
DELETE /api/v1/knowledge/documents/:id
```

Create request:

```json
{
  "title": "Caching Strategies",
  "sourceType": "MARKDOWN",
  "sourceUrl": null,
  "content": "# Caching\n..."
}
```

Supported `sourceType` values are `PLAIN_TEXT` and `MARKDOWN`. Ingestion normalizes text, hashes normalized content for deduplication, splits content into heading-aware chunks, and stores metadata such as heading path and source title. `KNOWLEDGE_CHUNK_MAX_TOKENS` controls chunk sizing.

## Knowledge Embedding Endpoints

```text
POST /api/v1/knowledge/documents/:id/embed
POST /api/v1/knowledge/embeddings/rebuild
GET  /api/v1/knowledge/embeddings/status
```

Embeddings are generated for knowledge chunks with the configured Gemini embedding model. The service batches chunk content, retries transient provider failures, applies timeout handling, skips unchanged chunks, and stores vectors in PostgreSQL using `pgvector`.

Embedding storage tracks:

- chunk embedding status
- embedding model and model version
- embedding content hash
- chunk failure messages
- document embedding status and useful aggregate counts

Vector writes use raw SQL isolated inside the knowledge repository because Prisma does not support `pgvector` cleanly.

## Retrieval Endpoint

```text
POST /api/v1/retrieval/search
```

Sample request:

```json
{
  "query": "How should a scalable notification system handle retries?",
  "topK": 5
}
```

Optional request fields:

```json
{
  "minSimilarity": 0.25,
  "sourceType": "MARKDOWN",
  "documentId": "00000000-0000-0000-0000-000000000000"
}
```

Retrieval generates an embedding for the user query, runs pgvector similarity search over embedded knowledge chunks, applies configurable `topK` and minimum-similarity thresholds, supports source-type and document filters, and removes duplicate or near-identical chunks from results. Responses include chunk content, similarity score, document title, source metadata, and chunk metadata. Retrieval logs metadata such as result counts, thresholds, and filters, but not full document content.

## Test Commands

```bash
pnpm test
pnpm test:watch
pnpm test:cov
pnpm test:e2e
pnpm frontend:test
pnpm frontend:lint
pnpm frontend:build
```

## Health Endpoint

```text
GET /api/v1/health
```

The endpoint returns application status, database status, application name, version, environment, uptime, and timestamp. It returns HTTP 503 when the database cannot be reached.

## Project Endpoints

```text
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
POST   /api/v1/projects/:id/archive
POST   /api/v1/projects/:id/restore
DELETE /api/v1/projects/:id
```

Project listing supports:

```text
page, limit, status, search, sortBy, sortOrder
```

Valid `status` values are `ACTIVE` and `ARCHIVED`. Valid `sortBy` values are `createdAt`, `updatedAt`, `name`, and `status`.

## Design Session Endpoints

```text
POST   /api/v1/projects/:projectId/design-sessions
GET    /api/v1/projects/:projectId/design-sessions
GET    /api/v1/design-sessions/:id
PATCH  /api/v1/design-sessions/:id
DELETE /api/v1/design-sessions/:id
```

Archived projects cannot receive new design sessions. Only `DRAFT` sessions can be edited. Only `DRAFT` or `FAILED` sessions can be deleted.

## Requirement Analysis Endpoints

```text
POST /api/v1/design-sessions/:id/analyze-requirements
GET  /api/v1/design-sessions/:id/requirements
POST /api/v1/design-sessions/:id/clarifications
```

Requirement analysis uses the existing provider-agnostic AI service to convert a design session `problemStatement` into structured JSON validated with Zod. The persisted analysis includes product summary, functional requirements, non-functional requirements, assumptions, scale inputs, constraints, missing information, and up to five clarification questions.

Only `DRAFT` sessions, or `FAILED` sessions that do not yet have requirement analysis, can be analyzed. While analysis is running, the session is temporarily marked `GENERATING` with `currentStep` set to `requirements_analysis`, which prevents repeated concurrent analysis. Sessions move to `REQUIREMENTS_PENDING` when clarification is still needed, or `READY_FOR_DESIGN` when the analysis has enough information. AI failures are stored on the session with safe failure details and returned without exposing prompts or provider internals.

Clarification submission example:

```json
{
  "answers": [
    {
      "questionId": "CQ-1",
      "answer": "Support 100 concurrent editors per document."
    }
  ]
}
```

Clarification answers are validated against the currently stored analysis questions, saved on the session, and then used to rerun requirement analysis.

## Internal Tool Endpoints

```text
POST /api/v1/tools/capacity-calculator
POST /api/v1/design-sessions/:id/calculate-capacity
GET  /api/v1/design-sessions/:id/capacity
```

The internal tool system executes deterministic tools with Zod input and output schemas. Tool execution validates inputs, validates tool outputs, and maps validation or execution failures into structured API errors. Tools do not use the LLM for arithmetic.

Standalone capacity calculator request:

```json
{
  "monthlyActiveUsers": 1000000,
  "dailyActiveUserPercentage": 25,
  "requestsPerActiveUserPerDay": 24,
  "readWriteRatio": "80:20",
  "averagePayloadSizeBytes": 2048,
  "peakTrafficMultiplier": 3,
  "dataCreatedPerUserBytes": 10240,
  "retentionPeriodDays": 365
}
```

The result includes raw and display-rounded values for daily active users, average and peak RPS, read and write QPS, daily and monthly bandwidth, monthly storage growth, retained storage estimate, assumptions, and warnings.

Session-based capacity calculation only runs for `READY_FOR_DESIGN` sessions. It uses stored requirement-analysis scale inputs as defaults when they can be parsed, accepts validated user overrides, and persists the result on the design session.

## System Design Generation Endpoints

```text
POST /api/v1/design-sessions/:id/generate-design
GET  /api/v1/design-sessions/:id/design
```

System design generation uses analyzed requirements, clarification answers, saved capacity calculations, retrieved knowledge chunks, and the structured AI provider. It persists a validated structured design with architecture summary, components, API recommendations, database choices, caching, messaging, storage, scalability, reliability, security, observability, deployment approach, technology choices, assumptions, trade-offs, risks, and retrieved source references.

Generation is intentionally simple: one orchestration step, no multiple agents, and no autonomous tool selection. `READY_FOR_DESIGN` sessions can generate, and `FAILED` sessions can retry when the required requirements and capacity data are still present. During execution the session is marked `GENERATING` with `currentStep` set to `design_generation`; duplicate concurrent generation is rejected. Successful generation moves the session to `COMPLETED`. Failures move the session to `FAILED` and store safe failure details without exposing prompts or provider internals.

## Architecture Diagram Endpoints

```text
POST /api/v1/design-sessions/:id/generate-diagram
GET  /api/v1/design-sessions/:id/diagram
```

Diagram generation is separate from system-design generation. It uses the saved structured design as input, asks the existing structured AI provider for Mermaid syntax, validates the output, and stores it on the design session. Only Mermaid `flowchart TD` diagrams are accepted. Unsupported Mermaid types, init directives, click/href actions, scripts, custom classes, and custom styles are rejected before saving. Re-running `generate-diagram` replaces the saved diagram.

Sample response data:

```json
{
  "designSessionId": "33333333-3333-4333-8333-333333333333",
  "diagram": {
    "type": "flowchart",
    "direction": "TD",
    "mermaid": "flowchart TD\n  Client[Client Apps] --> Api[Notification API]\n  Api --> Cache[(Template Cache)]\n  Api --> Db[(PostgreSQL)]\n  Api --> Queue[Message Queue]\n  Queue --> Worker[Worker Pool]\n  Worker --> Provider[External Notification Provider]",
    "generatedAt": "2026-07-28T00:00:00.000Z"
  },
  "generatedAt": "2026-07-28T00:00:00.000Z"
}
```

## Design Validation Endpoints

```text
POST /api/v1/design-sessions/:id/validate-design
GET  /api/v1/design-sessions/:id/validation
```

Design validation uses deterministic rule checks plus the structured AI provider. It validates the saved generated architecture against functional requirements, scalability, availability, reliability, data consistency, security, observability, disaster recovery, cost awareness, and operational complexity. Validation does not modify the original generated design.

The persisted validation includes overall score, category scores, critical issues, warnings, missing areas, improvement suggestions, strengths, unresolved assumptions, the deterministic review, and the AI review. Re-running `validate-design` replaces the saved validation result.

## Frontend Screens

The Next.js frontend implements the guided copilot flow:

```text
Create Project
-> Create Design Session
-> Analyze Requirements
-> Answer Clarifications
-> Calculate Capacity
-> Generate Design
-> Generate Diagram
-> Validate Design
```

Implemented screens:

- Projects list with search, status filter, archive, restore, and delete actions
- Create project
- Project details with design-session list
- Create design session
- Design session workspace with requirement analysis, clarification questions, capacity cards, generated design sections, sandboxed Mermaid diagram rendering, and validation scores

The frontend uses a reusable typed API client in `frontend/src/lib/api-client.ts`. API responses are unwrapped from the backend success envelope, backend error envelopes are mapped to typed client errors, and invalid actions are disabled based on session status and persisted workflow data.

Mermaid diagrams are rendered client-side with Mermaid strict security settings and displayed in a sandboxed iframe. Unsupported or unsafe Mermaid source is rejected before rendering.

## Current Scope

Implemented:

- Application configuration and Zod environment validation
- Global `/api` prefix and URI version `v1`
- Consistent success and error response envelopes
- Global exception formatting and request logging
- PostgreSQL Prisma service and database module
- Health, users, projects, and design sessions modules
- Project and design session Prisma models, migration, repositories, CRUD services, and APIs
- Provider-agnostic AI service contract with Gemini structured JSON generation
- AI timeout, retry, safe error mapping, and metadata-only request logging
- Knowledge document ingestion for plain text and Markdown
- Knowledge chunking with heading-path metadata and content-hash deduplication
- Knowledge chunk embeddings with PostgreSQL `pgvector`
- Embedding rebuild and status APIs
- RAG retrieval layer over embedded knowledge chunks
- Reusable retrieval service for later design-generation workflows
- Requirement analysis for draft design sessions with clarification handling
- Internal deterministic tool registry and capacity calculator
- Session-based capacity calculation persistence
- Retrieval-backed system design generation with structured AI output validation
- Generated design persistence and retry from failed generation
- Mermaid flowchart architecture diagram generation for completed designs
- Diagram validation, unsafe syntax rejection, persistence, and regeneration
- Design validation with deterministic checks plus structured AI review
- Validation scoring, issue lists, missing areas, strengths, assumptions, persistence, and reruns
- Next.js frontend connected to the existing NestJS API
- Frontend project, session, requirement, clarification, capacity, design, diagram, and validation screens
- Typed frontend API client, reusable UI components, loading, empty, error, and retry states
- Docker Compose PostgreSQL service with persistent volume and health check
- Unit and database-backed e2e test coverage for the backend foundation
- Frontend component, flow-helper, and API-client tests

Not implemented in this phase:

- Authentication
- Chat follow-ups, agents, autonomous tool selection, or final reports
- Full RAG answer generation
- External web ingestion or AI summarization for knowledge documents
- Billing, collaboration, or deployment automation
