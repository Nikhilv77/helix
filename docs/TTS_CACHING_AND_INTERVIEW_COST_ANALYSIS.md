# TTS Caching and Interview Cost Analysis

Last updated: September 16, 2026

## Executive summary

At 1,000 paying users, four interviews per user per month, and a subscription price of $5 per month:

- Monthly revenue is approximately **$5,000**.
- Estimated Gemini Live interview cost is approximately **$1,459.60**.
- Deepgram Aura-2 costs approximately **$60 without shared caching**.
- Deepgram Aura-2 costs approximately **$12 with an 80% cache hit rate**.
- The remaining amount before infrastructure, payment processing, taxes, support, and other model calls is approximately **$3,480–$3,528 per month**.

The subscription therefore recovers the direct interview voice and Deepgram TTS costs under the assumptions in this document. Gemini Live interview duration is the dominant cost. TTS caching improves latency and reliability but saves only approximately $48 per month at this scale.

## Current voice architecture

Trailgrad uses two separate voice systems.

### Shared TTS endpoint

Non-interview voice experiences use `useMayaVoice`, which requests generated audio from:

```text
GET /api/voice/speak?text=...&persona=...
```

The endpoint selects the provider and model on the server:

- Normal selected-teacher speech uses the teacher's configured Deepgram Aura voice.
- James with normal or `quality` delivery uses Gemini 2.5 Flash Preview TTS with Charon.
- James falls back to Deepgram Aura-2 Neptune if Gemini TTS fails.
- James with `delivery=fast` uses Deepgram Aura-2 Neptune directly.
- Resume Roast setup questions use the quality path.
- The generated Resume Roast summary uses the fast path.

The current server cache is an in-memory map limited to 64 generated audio entries. It is not a durable, cross-instance cache. The browser response is private-cacheable for one hour.

Relevant implementation:

- `src/infrastructure/realtime/use-maya-voice.ts`
- `src/app/api/voice/speak/route.ts`
- `src/features/resume-roast/ui/resume-roast-workspace.tsx`

### Gemini Live interview audio

Live interview rooms use Gemini Live native audio instead of `/api/voice/speak`.

This includes:

- Resume & Behavioural
- Core Technical & Projects
- DSA & Design
- Hiring Manager & Final Behavioural
- Fundamentals and existing assessment rooms

The fixed interview voice mapping is:

- Claire: Gemini Kore
- James: Gemini Charon

The selected everyday teacher is used for launch briefings and completion debriefs. The interview room itself uses Claire or James.

Relevant implementation:

- `src/app/api/interview/gemini-live/token/route.ts`
- `src/features/interviews/ui/voice/gemini-live-interviewer.tsx`
- `src/features/interviews/domain/interviewer-persona.ts`

## Pricing used

The calculations use the published pay-as-you-go prices available on September 16, 2026.

### Gemini 3.1 Flash Live Preview

| Modality     |                                             Price |
| ------------ | ------------------------------------------------: |
| Text input   |                        $0.75 per 1 million tokens |
| Audio input  |  $3.00 per 1 million tokens, or $0.005 per minute |
| Text output  |                        $4.50 per 1 million tokens |
| Audio output | $12.00 per 1 million tokens, or $0.018 per minute |

Source: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

### Deepgram Aura

| Model  |         Pay-as-you-go price |
| ------ | --------------------------: |
| Aura-2 | $0.030 per 1,000 characters |
| Aura-1 | $0.015 per 1,000 characters |

Source: [Deepgram pricing](https://deepgram.com/pricing)

## Usage assumptions

The model assumes:

- 1,000 paying users.
- Four interviews per user per month.
- 4,000 interviews per month in total.
- Every user consumes the maximum duration of every round.
- The candidate microphone remains connected for the full interview duration.
- James or Claire speaks for approximately 30% of the interview duration.
- Each interview uses approximately 10,000 text-input tokens and 2,000 text/tool-output tokens.
- The launch and completion narration together average 500 Deepgram characters per interview.
- Deepgram cost calculations use Aura-2 as the conservative case.

Actual invoices should eventually replace these estimates with measured audio minutes, token usage, generated characters, provider cache misses, and completed session durations.

## Interview duration model

| Interview                          | Maximum duration |
| ---------------------------------- | ---------------: |
| Resume & Behavioural               |       24 minutes |
| Core Technical & Projects          |       40 minutes |
| DSA & Design                       |       40 minutes |
| Hiring Manager & Final Behavioural |       30 minutes |
| **Total per user**                 |  **134 minutes** |

The hard limits are used for conservative planning. Interviews that complete naturally before their limit will cost less.

## Gemini Live interview cost

### Audio input

```text
134 minutes × $0.005 = $0.67 per user
$0.67 × 1,000 users = $670 per month
```

### Audio output

With the interviewer speaking for 30% of the session:

```text
134 minutes × 30% = 40.2 output-audio minutes per user
40.2 × $0.018 = $0.7236 per user
$0.7236 × 1,000 users = $723.60 per month
```

### Text and tool traffic

Using the token assumptions above:

```text
Text input per interview:
10,000 / 1,000,000 × $0.75 = $0.0075

Text/tool output per interview:
2,000 / 1,000,000 × $4.50 = $0.009

Text total per interview = $0.0165
$0.0165 × 4,000 interviews = $66 per month
```

### Combined monthly interview cost

| Component                      |  Monthly cost |
| ------------------------------ | ------------: |
| Gemini audio input             |       $670.00 |
| Gemini audio output            |       $723.60 |
| Estimated text and tool tokens |        $66.00 |
| **Total**                      | **$1,459.60** |

This equals approximately:

- **$1.46 per user per month**
- **$0.365 per interview**

### Cost by interview

The following table assumes 30% interviewer speech and approximately $0.0165 of text/tool traffic per interview.

| Interview                             | Audio cost | Estimated complete cost |
| ------------------------------------- | ---------: | ----------------------: |
| Resume, 24 minutes                    |    $0.2496 |                 $0.2661 |
| Core Technical & Projects, 40 minutes |    $0.4160 |                 $0.4325 |
| DSA & Design, 40 minutes              |    $0.4160 |                 $0.4325 |
| Hiring Manager, 30 minutes            |    $0.3120 |                 $0.3285 |

### Interviewer speech sensitivity

The amount of time spoken by James or Claire changes the output-audio cost.

| Interviewer share | Gemini audio cost per month | Total including token and uncached Aura estimates |
| ----------------- | --------------------------: | ------------------------------------------------: |
| 20%               |                   $1,152.40 |                                         $1,278.40 |
| 30%               |                   $1,393.60 |                                         $1,519.60 |
| 40%               |                   $1,634.80 |                                         $1,760.80 |

The final column includes the $66 text estimate and $60 uncached Aura-2 estimate.

## Deepgram Aura-2 cost

With 500 characters of launch and closing speech per interview:

```text
4,000 interviews × 500 characters = 2,000,000 characters
```

### Without shared caching

```text
2,000,000 / 1,000 × $0.030 = $60 per month
```

### With shared caching

At an 80% cache hit rate:

```text
Uncached characters = 2,000,000 × 20% = 400,000
400,000 / 1,000 × $0.030 = $12 per month
```

The estimated saving is **$48 per month**.

| Cache hit rate | Monthly Aura-2 cost | Monthly saving |
| -------------- | ------------------: | -------------: |
| 0%             |                 $60 |             $0 |
| 50%            |                 $30 |            $30 |
| 80%            |                 $12 |            $48 |
| 90%            |                  $6 |            $54 |
| 95%            |                  $3 |            $57 |

If every selected voice used Aura-1, the Deepgram amounts would be half. Trailgrad currently has a mixture of Aura-1 and Aura-2 teacher voices, so the real amount depends on teacher selection.

## What TTS caching means

Deepgram does not provide a prompt-cache discount. It charges for the characters sent for synthesis. Trailgrad must avoid the provider call by caching and serving the previously generated audio.

The recommended cache identity is:

```text
provider
+ model
+ persona/voice
+ style version
+ delivery mode
+ playback-affecting options
+ normalized text
```

The resulting identity should be hashed and used as an object-storage or CDN key.

## Caching opportunities

### High potential

These lines are fixed or come from a small finite catalogue:

- Teacher onboarding greetings.
- Resume Roast target questions.
- Resume Roast analysis-status messages.
- Target setup and baseline introduction copy.
- Empty-report messages.
- Technology-selection introductions.
- Repeated roadmap chapter narration.
- Fixed interview instructions without candidate-specific data.

### Medium potential

These use templates but currently include personalized fragments:

- Interview launch briefings.
- Interview completion debriefs.
- Core Technical, Applied Engineering, and Architecture introductions.
- Evaluation-parameter explanations.

Exact-text caching will fragment when the string contains a first name, project name, skill name, or changing score. Cache reuse can be improved by separating speech into reusable fixed sentences and short personalized fragments.

### Low potential

These are generated or strongly personalized:

- Resume Roast generated summaries.
- DSA generated feedback.
- Personalized progress briefings.
- Dashboard coaching summaries.
- Interview report summaries.

### No useful audio caching

These are unique conversational audio:

- Candidate speech.
- Gemini Live interviewer responses.
- Dynamic follow-up questions.
- Project-specific challenges.
- Behavioral responses and clarifications.

Caching fixed system instructions might reduce text-token costs if the selected Live model supports an applicable cached-content mechanism in the future. It would not materially reduce dynamic input/output audio charges. The current application does not configure cached content for Gemini Live sessions.

## Current cache limitations

The current implementation uses:

- A 64-entry process-local server map.
- Exact provider/model/text hashes.
- A private browser cache with a one-hour maximum age.

This has several limitations:

- Serverless cold starts lose the cache.
- Different application instances do not share cached audio.
- Personalized strings create different keys.
- Preloading can trigger provider generation even when the candidate never listens.
- A private browser cache cannot provide cross-user reuse.

For meaningful cross-user savings, generated audio should be persisted in shared object storage and served through an authenticated or privacy-safe CDN strategy.

## Subscription economics

### Revenue

```text
1,000 users × $5 = $5,000 per month
```

### Without durable TTS caching

| Item                          |        Amount |
| ----------------------------- | ------------: |
| Subscription revenue          |     $5,000.00 |
| Gemini interviews             |    -$1,459.60 |
| Deepgram Aura-2               |       -$60.00 |
| **Remaining**                 | **$3,480.40** |
| **Direct voice gross margin** |     **69.6%** |

### With an 80% TTS cache hit rate

| Item                          |        Amount |
| ----------------------------- | ------------: |
| Subscription revenue          |     $5,000.00 |
| Gemini interviews             |    -$1,459.60 |
| Deepgram Aura-2               |       -$12.00 |
| **Remaining**                 | **$3,528.40** |
| **Direct voice gross margin** |     **70.6%** |

The $5 subscription covers the direct interview and TTS costs in this model. The remaining approximately $3.48–$3.53 per user must cover:

- Resume analysis and report-generation model calls.
- Answer evaluation calls.
- Database, Redis, object storage, and bandwidth.
- Hosting and serverless execution.
- Authentication.
- Payment-processing fees.
- Taxes, monitoring, support, and refunds.

Therefore this analysis establishes positive direct voice unit economics, not complete company profitability.

## Recommended priorities

1. Measure actual interview duration, candidate audio minutes, interviewer audio minutes, text tokens, and generated TTS characters.
2. End completed interviews immediately instead of treating the hard cap as a target.
3. Add a durable audio cache for fixed and catalogue-based speech.
4. Remove first names and other unnecessary personalization from otherwise reusable TTS lines.
5. Split mixed fixed/dynamic narration into separately cacheable audio segments.
6. Avoid speculative preloading for lines with a low probability of playback.
7. Track `cache_hit`, provider, model, characters, generation latency, and playback completion for every TTS request.

The largest financial lever is reducing unused Gemini Live minutes. Durable TTS caching remains worthwhile primarily for latency, reliability, and predictable provider usage rather than for a large change in total monthly spend.
