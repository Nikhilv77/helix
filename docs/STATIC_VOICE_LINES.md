# Static Voice Lines

Last updated: September 26, 2026

Teachers speak many lines that never depend on the learner's data: greetings, practice
intros, interview hand-offs, report and progress openers. Generating those live with Gemini
text-to-speech takes 7–9 seconds per line and spends quota on audio that is identical for
every user. This system records each fixed line once per teacher as an MP3 and serves it
from the CDN (about 0.1 s). Lines that depend on the learner stay live.

## Current status

| Item | State |
| --- | --- |
| Active provider | **Deepgram** (default in code; override with `NEXT_PUBLIC_TTS_PROVIDER`) |
| Deepgram set | **946 of 946** lines (117 fixed lines × 8 teachers + 10 greetings); the 19 block-assessment lines were added 2026-09-26 in 46 s |
| Gemini set | 8 of 794 (greetings for Maya, Claire, Daniel, Olivia, James, Alex, Sophia, Ryan) |
| Files | 954 MP3s in `public/voice/`, 35 MB |
| Behaviour for missing files | Falls back to live speech automatically; nothing breaks |

## Switching providers

Teacher speech uses one provider at a time, chosen by `NEXT_PUBLIC_TTS_PROVIDER`
(`deepgram` or `gemini`; Deepgram when unset). The browser, the speak route, and the generator
all read it through [`src/lib/avatars/voice-style.ts`](../src/lib/avatars/voice-style.ts), so they
always agree on which voice is current.

- **Live speech** goes to the active provider first. Under Deepgram, Gemini is the fallback if
  Deepgram fails; under Gemini, Deepgram is the fallback (and is used directly while Gemini's
  quota is exhausted).
- **Pre-generated lines** for both providers live side by side in the manifest. The app plays the
  set that matches the active provider, so switching is instant once that set exists.

To switch to Gemini (for example after enabling Gemini billing):

1. Generate the Gemini set: `pnpm voice:lines --provider gemini`.
2. Set `NEXT_PUBLIC_TTS_PROVIDER=gemini` in Vercel (Production), run
   `npx vercel pull --environment=production` so the local build sees it, then deploy.
   Or change `DEFAULT_TTS_PROVIDER` in `voice-style.ts`.

| Provider | Price | Speed | Voice |
| --- | --- | --- | --- |
| Deepgram Aura-2 | ~$0.027 per minute ($0.030 per 1,000 characters); $200 signup credit | Streams; ~0.5–1 s to first audio | Neutral Aura voice per teacher |
| Gemini 2.5 Flash TTS | ~$0.015 per minute; free tier 10 requests/day | Whole clip first; ~7–9 s | Styled per teacher's personality |

## How it works

1. **Fixed text lives in two files.**
   - [`src/lib/voice/teacher-lines.ts`](../src/lib/voice/teacher-lines.ts) holds every
     fixed line, grouped by moment, with 2–3 phrasings each.
   - [`src/features/practice/shared/domain/teacher-voice-lines.ts`](../src/features/practice/shared/domain/teacher-voice-lines.ts)
     holds the practice track intros and technology welcomes.
2. **A phrasing is picked when the teacher starts speaking** (`pickLine`), so repeated
   visits sound different. It is never picked during render, which would cause a
   server/browser mismatch.
3. **Personal details stay on screen.** Names, scores, skills, and next steps are displayed
   as before; only the spoken line is generic.
4. **Playback lookup.** `voiceUrl()` in
   [`src/infrastructure/realtime/use-maya-voice.ts`](../src/infrastructure/realtime/use-maya-voice.ts)
   calls `staticVoiceUrl()` from [`src/lib/avatars/static-voice.ts`](../src/lib/avatars/static-voice.ts).
   It returns the MP3 only when the teacher, exact text, Gemini voice, and style version all
   match the manifest. Anything else goes to `/api/voice/speak` (live).
5. **Manifest.** [`src/lib/avatars/static-voice.generated.ts`](../src/lib/avatars/static-voice.generated.ts)
   lists every generated line. Audio files live in `public/voice/<persona>-<hash>.mp3`.
   The hash covers the style version, model, voice, persona, and text, so changed wording
   always gets a new file.
6. **Onboarding preloads** the focused teacher's and both neighbours' greetings, but only
   when a static file exists, so browsing never spends live quota.

## Where fixed lines are used

| Moment | Screen | Phrasings |
| --- | --- | --- |
| Teacher greeting | Onboarding teacher picker, Manage | 1 per persona |
| Practice track intros | Core Technical, Applied Engineering, Architecture, AI/ML, Frontend, Data | 1 each |
| Technology welcome | Welcome, confirming, preparing per track | 1 each |
| Interview launch | Resume, fundamentals, technical projects, DSA, system design, hiring manager | 2 each |
| Interview end | Voice interview debrief | 3 |
| Report summary | By score band: strong ≥ 75, steady ≥ 45, starting | 3 per band |
| Reports overview | Prepared, banded briefing, empty, limit reached | 1–3 |
| Progress | Not started, quiet week, streak, building, restart | 2 each |
| Overview coaching | One set per coaching state | 1–2 each |
| DSA practice intro | Focus, empty, first chapter, ongoing, complete | 2 each |
| Assessment run cue | Tests passed, tests failed (DSA and Core Technical) | 2 each |
| Chapter lesson beats | Opening, ideas, approaches, traps, signals, hand-off | 1–2 each |
| DSA block assessment | Opening, quick-check verdict (right/wrong, next check or coding), coding submitted/skipped, finished. The screen keeps the full feedback, explanation, and next question. | 2–3 each |

## Still generated live (by design)

| Moment | Why it stays live |
| --- | --- |
| DSA feedback after solving | Written by AI about the learner's own code |
| Assessment guidance | Generated by the interviewer during the assessment |
| Onboarding welcome | Built from the learner's resume |
| Resume Roast | Personal; kept live on purpose (final roast uses Deepgram) |
| Interviews themselves | Gemini Live |

## Generating audio

```bash
pnpm voice:lines                          # active provider; only missing or changed lines
pnpm voice:lines --provider deepgram      # or --provider gemini
pnpm voice:lines --concurrency 8          # parallel requests (default 8 Deepgram, 2 Gemini)
pnpm voice:lines --limit 5                # generate at most 5 lines (a quick test)
pnpm voice:lines --force                  # regenerate every line for that provider
pnpm voice:lines --from-wav <dir>         # encode existing Gemini WAVs, no API calls
```

The script ([`scripts/generate-static-voice.mts`](../scripts/generate-static-voice.mts)):

- generates greetings first, then every fixed line for each selectable teacher, starting
  with Daniel (the default teacher);
- encodes 64 kbps mono MP3 (56–74 KB per line, about 6× smaller than WAV);
- saves the manifest after every file, so a run stopped by quota resumes where it left off;
- deletes MP3s that no longer match any line.

It needs `DEEPGRAM_API_KEY` or `GEMINI_API_KEY` for the chosen provider (read from
`.env`/`.env.local`). A full Deepgram run takes about 5 minutes and roughly $2.50 of credit.

### Gemini quota and cost

| Option | Time to finish the remaining 786 Gemini files | Cost |
| --- | --- | --- |
| Free tier (10 requests/day, resets 07:00 UTC / 12:30 IST) | ~80 days | $0 |
| Paid tier, one run | Minutes | **~$1.40 once** (~93 min of audio at ~$0.015/min) |

The cost is paid once when audio is generated, not per user or per play. Only new or
edited lines cost anything later (about a cent each). The free quota is shared with the
running app if production uses the same key, so run the script before using the app that
day.

Not needed while Deepgram is the active provider. Generate the Gemini set only before
switching to Gemini.

## After each generation run

1. Run `pnpm vitest run src/infrastructure/realtime src/lib/voice` (checks every manifest
   entry still matches its text and voice, and every MP3 exists).
2. Commit `public/voice/*.mp3` and `src/lib/avatars/static-voice.generated.ts`.
3. Deploy with `pnpm deploy:production`.

## Editing lines

- Change wording in `teacher-lines.ts` or `teacher-voice-lines.ts`, then run
  `pnpm voice:lines`. Only the changed lines are regenerated.
- Lines must stay free of learner data. A test fails if a line contains a number or a
  `${...}` placeholder.
- Changing a teacher's Gemini voice, or `GEMINI_TTS_STYLE_VERSION` /
  `GEMINI_TTS_MODEL` in [`src/lib/avatars/voice-style.ts`](../src/lib/avatars/voice-style.ts),
  makes that audio stale; it falls back to live speech until regenerated.

## Related speech changes

- **Quota fallback.** When Gemini refuses for quota, `/api/voice/speak` skips Gemini and uses
  Deepgram until the quota is expected back (midnight Pacific for the daily quota). Logged as
  `voice.gemini_quota_paused`. Per server instance.
- **Shared speech module.** Gemini TTS lives in
  [`src/server/voice/gemini-speech.ts`](../src/server/voice/gemini-speech.ts), used by both
  the live route and the generator so recorded and live speech sound the same.

## Later

- Optional: one live personal sentence at the end of the report briefing (for example the
  strongest skill), generated while the fixed opener plays.
- Speak only a short DSA feedback headline and show the full feedback as text; DSA feedback
  is about 70% of the remaining live TTS cost.
- Background-generate unique lines (reports, feedback) when the content is created, so they
  play instantly. Same cost, no wait.
