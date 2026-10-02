# Product films

Last updated: October 3, 2026

The standalone `video/` Remotion authoring folder was removed at the owner's request on
October 3, 2026. The app still serves the existing home-page exports from
`public/videos/marketing/`; the final 4K product demo is kept outside the repository.
The source layout and commands below document the original workflow. Restore or recreate
an authoring project before using them.

The home page has two short films: the hero film and the "interview" film. This document
explains how they are made and how to make more in exactly the same style, for example a full
product demo, a feature launch, or a social clip. Read it before touching `video/trailgrad-demo`
or adding a film to the site.

## What the films are

- **Code, not footage.** Each film is a React component rendered frame by frame with
  [Remotion](https://www.remotion.dev). There is no screen recording, stock footage, video
  generation service, or real user data. The teachers are the app's own 3D avatars, rendered
  with three.js inside the film.
- **Silent.** They autoplay muted on the page, so every idea has to read from the type alone.
  Teachers' mouths still move, driven by the loudness of a recorded greeting.
- **Typography first.** Each "beat" is one short line of large type that moves in, holds, and
  punches past the camera. White background, near-black ink, one orange accent.

| Film | Composition IDs | Length | Used in |
| --- | --- | --- | --- |
| Hero: teachers, a follow-up, an answer, a score | `TrailgradDemo`, `TrailgradDemoPortrait` | 1620 frames, 27 s | `src/features/marketing/ui/home/hero.tsx` |
| Interview: one round from resume to report | `TrailgradRounds`, `TrailgradRoundsPortrait` | 1440 frames, 24 s | `src/features/marketing/ui/home/rounds-film-section.tsx` |

## Where things live

```
video/trailgrad-demo/            separate package, its own pinned dependencies
  package.json                   render, poster and encode scripts
  src/index.tsx                  registers every composition (landscape + portrait)
  src/kit.tsx                    the style: colours, easing, Beat, Words, Letters, Underline, Stage
  src/teacher.tsx                SpeakingTeacher: GLB avatar, framing, lip sync, blinks
  src/voice-levels.json          per-frame mouth levels for each teacher
  src/demo-film.tsx              the hero film
  src/rounds-film.tsx            the interview film
  scripts/voice-levels.py        regenerates voice-levels.json from public/<id>.mp3
  public/                        raleway.ttf, <teacher>.glb, <teacher>.mp3, licences
  out/                           intermediate renders (git-ignored)
public/videos/marketing/         the files the site serves (app root)
```

Always run commands from `video/trailgrad-demo`, so Remotion uses that package's dependencies
and not the Next.js app's.

```sh
cd video/trailgrad-demo
npm ci
npm run studio        # live preview with a timeline scrubber at http://localhost:3000
```

## The style, exactly

Everything below is already in `src/kit.tsx`. **Import from the kit; never restyle a film
locally.** If a new film needs a new move, add it to the kit so every film shares it.

### Frame

- 60 fps. Landscape 1920 × 1080; portrait (phones) 1080 × 1350 (4:5). The same component
  renders both.
- `Stage` gives a pure white background, Raleway loaded from `staticFile("raleway.ttf")`, and
  one faint orange radial light (7% opacity) that drifts slowly. Every film is wrapped in
  `<Stage f={f}>`.

### Colour

| Name | Value | Use |
| --- | --- | --- |
| `ink` | `#141414` | headlines, one-word flashes |
| `muted` | `#8d8d8d` | set-up lines ("They ask the follow-up."), the second half of a pair, "trailgrad.com" |
| `orange` | `#f26e01` | at most one phrase per beat (the payoff), the underline, the typing caret, highlight sweeps at 16% |

The films are the one place a fixed brand colour is allowed. They are pre-rendered, so they
cannot read the learner's accent token. Do not introduce other colours.

### Type

| Role | Component | Size (landscape) | Weight |
| --- | --- | --- | --- |
| Headline | `Words` | 112–150 | 600 |
| Quoted question | `Words` with `gap={2}` and `style={{ maxWidth: 1500 }}` | 86–92 | 600 |
| Set-up line above a headline | `Words` with `color={muted}` | 64–68 | 500 |
| Payoff line under a headline | `Words` with `color={orange}` | 60–64 | 600 |
| One-word flash | `Letters` | 160–260 (shrinks itself to fit) | 700 |
| Teacher name | `Letters` | 84 (104 portrait) | 700 |
| Typed answer or hint | inline text or `Typed` | 60–74 | 500 |
| Big score | plain div | 300, with "/10" at 140 in `muted` | 700 |
| Sign-off URL | plain div | 44, `muted` | 500 |

Letter spacing is always negative and scales with size (`-size * 0.045` for `Words`,
`-size * 0.05` for `Letters`). Curly quotes (“ ”) around spoken questions. Sentence case.
No uppercase, no emoji, no icons, no UI screenshots.

### Motion

| Move | Where | Timing |
| --- | --- | --- |
| `Beat` entry | every beat | 22 frames, `easeOut` = bezier(0.16, 1, 0.3, 1). `zoom` scales 0.82 → 1; `left`/`right` slide 340 px; `up` rises 160 px. Blur 14 px → 0 |
| `Beat` exit | every beat | last 16 frames, `easeIn` = bezier(0.7, 0, 0.84, 0). `zoom` punches to 1.42× past the camera; `left`/`right` slide 420 px. Blur to 18 px |
| `Words` | sentences | each word rises out of a mask with a small rotation, staggered by `gap` frames (3 by default). Spring damping 14, stiffness 170, mass 0.7 |
| `Letters` | single words | letters drop 60 px and scale up from 0.6, 2 frames apart, with blur. Spring damping 12, stiffness 200, mass 0.6 |
| `Underline` | under a key phrase | 8 px orange bar that wipes in over 26 frames |
| Typing | answers, hints | characters revealed with `interpolate` over about 100 frames; a 4 px orange caret blinks every 18 frames |
| Count-up | scores | `interpolate` over 60 frames with `easeOut`, then a slight scale settle |
| Teacher cut | montages | slides 420 px from alternating sides with a 10 px blur and a slow 6% push-in; the name fills the background at 460 px and 9% opacity, sliding the other way |

Rules that make it feel like one film:

- **Beats overlap by about 6 frames.** The next beat starts 6 frames before the previous one
  ends (`start={90} end={186}` follows `end={96}`). That overlap is the "hand-off".
- **Alternate directions.** If one beat enters from the right and leaves left, the next enters
  zoom or from the other side. Runs of one-word flashes alternate `left`/`right` and exit
  `zoom`.
- **Text starts 6 frames after its beat** (`at = start + 6`), so the beat is already moving
  when the words rise. A second line starts 10–14 frames after the first.
- **Hold long enough to read.** A headline beat is about 96–120 frames (1.6–2 s). A one-word
  flash is 36–40 frames. A quoted question or a typed line needs 170–230 frames.
- **Always end on the sign-off**: a headline ("Walk in ready.", "A little sharper every
  round.") with "trailgrad.com" fading up underneath, held about 150–240 frames, exit `zoom`.

### Copy

The voice is short, declarative, and second person. One idea per beat, usually 2–6 words.

- Set-up, then payoff: "They ask the follow-up." → “What happens to sign-in when Redis drops at
  peak?”
- A split headline: the first half in `ink`, the second half in `muted` or `orange`
  ("Practised before" / "it happens.").
- Concrete engineering detail beats adjectives: real-sounding systems (Redis, Kafka, checkout
  p95), real-sounding numbers.
- Illustrative data only. Never use a real candidate's resume, name, or answers.
- British spelling, matching the app: practise (verb), behavioural.
- "Resume Roast", never "Roastumé". No "AI-powered", no exclamation marks.

## Teachers in a film

`SpeakingTeacher` (from `src/teacher.tsx`) renders a head-and-shoulders portrait of one of the
app's GLB avatars into a 760 × 720 canvas, drawn at 2× so faces stay sharp, with a soft oval
mask. It loads every teacher in `TEACHERS` once, then shows one per frame.

```tsx
<SpeakingTeacher frame={f} teacher="maya" speakingFrom={slotStart} />
```

- **Lip sync.** `speakingFrom` is the frame where their greeting starts playing (silently).
  From then on, `voice-levels.json` gives one loudness value per frame, smoothed over three
  frames, which opens the jaw and a few visemes. They also blink every 212 frames and sway
  slightly.
- **Keep it mounted.** Render it for the whole stretch where teachers appear and change only
  the `teacher` prop, as `Teachers` in `demo-film.tsx` does. Unmounting reloads every model and
  slows the render badly.
- **Place it** at `left: (width - W) / 2` and `top: portrait ? 150 : 70`, with the name and
  line below at `top: portrait ? 900 : 800`.

To add a teacher (the app has more avatars in `public/avatars/`, e.g. `sophia`, `james`):

1. Copy `public/avatars/<id>.glb` from the app root to `video/trailgrad-demo/public/<id>.glb`.
2. Put a clean recording of that teacher speaking, 6–9 seconds, at
   `video/trailgrad-demo/public/<id>.mp3`. Their greeting from the app's voice lines
   (`public/voice/<id>-*.mp3`, see [STATIC_VOICE_LINES.md](STATIC_VOICE_LINES.md)) is ideal.
3. Run `python3 scripts/voice-levels.py <id>`. It writes one level per 60 fps frame (RMS of each
   1/60 s window divided by the clip's 95th percentile, capped at 1) into
   `src/voice-levels.json` and keeps the other teachers' entries.
4. Add the id to `TEACHERS` in `src/teacher.tsx`.

The avatars are Microsoft Rocketbox models; keep `public/LICENSE-rocketbox.md` next to them.

## Portrait cuts

Phones get a 4:5 version, because a 16:9 film on a phone makes the type too small. Nothing is
written twice. The same component lays out differently from `useFrameLayout()`:

- `fit(desired, pad = 70)` caps any block width to the frame minus padding. `Words` already uses
  it, so sentences rewrap in portrait on their own.
- `Letters` shrinks a word until it fits 88% of the frame width.
- For anything else positioned absolutely (teachers, names), branch on `portrait`.

After writing a beat, always check a portrait still of it.

## Making a new film, step by step

1. **Write the script first**, as a table of beats: frame range, entry and exit, text, and
   colour for each line. Keep beats 96–120 frames apart and overlap them by 6 frames. Total
   length: 20–30 s for a page section, 60–90 s for a full product demo.
2. **Create `src/<name>-film.tsx`**, exporting one component. Copy the structure of
   `rounds-film.tsx`: `const f = useCurrentFrame()`, `<Stage f={f}>`, then a list of `<Beat>`s.
   Keep film-specific helpers (like `Resume` or `Typed`) in that file. Move one into the kit
   only once a second film needs it.
3. **Register it** in `src/index.tsx`, twice:

   ```tsx
   <Composition id="TrailgradTour" component={TourFilm} width={1920} height={1080} fps={FPS} durationInFrames={4200} />
   <Composition id="TrailgradTourPortrait" component={TourFilm} width={1080} height={1350} fps={FPS} durationInFrames={4200} />
   ```

4. **Preview** in `npm run studio`, and render a few stills at key frames for both
   orientations before any full render. Stills take seconds; a full render takes minutes.

   ```sh
   npx remotion still src/index.tsx TrailgradTour out/check-600.png --frame=600 --gl=angle
   npx remotion still src/index.tsx TrailgradTourPortrait out/check-600-p.png --frame=600 --gl=angle
   ```

5. **Add scripts** to `package.json` by copying the existing ones with the new ID and file
   names: `render:<name>`, `poster:<name>`, a line in `mobile`, and portrait render and poster
   lines. Use the encoding settings below unchanged.
6. **Render**: master, poster, mobile, then portrait. They write to `public/videos/marketing/`
   in the app root. Run long renders in the background.
7. **Put it on the page** with `ProductFilm` (see below).
8. **Check it**: play the page at desktop and phone width, confirm the poster is a readable
   frame, and run `vitest run src/features/marketing`.

## Encoding

These settings were tuned by trial; keep them.

| File | Made by | Settings | Why |
| --- | --- | --- | --- |
| `<film>.mp4` (master) | `remotion render` | 1080p60, H.264 High, `--crf=16 --x264-preset=slow --pixel-format=yuv420p` | desktop; sharp type at 60 fps |
| `<film>-mobile.mp4` | `remotion ffmpeg` from the master | 1080p30, `-profile:v main -level:v 4.0 -preset slow -crf 17 -tune animation -movflags +faststart -an` | every phone decodes 1080p30 Main in hardware; budget phones stutter on 1080p60 High |
| `<film>-portrait.mp4` | render to `out/` at `--crf=14`, then the mobile settings | 1080 × 1350, 30 fps | phones |
| `<film>-poster.jpg`, `<film>-portrait-poster.jpg` | `remotion still --frame=N` | pick a frame where a full line of text is settled | shown before play, for reduced motion, and on slow connections |

- **Never go below 1080 on phones.** A 720p encode was tried: phones have 2–3× pixel density,
  so it was upscaled and the text broke up.
- **Always pass `--gl=angle`** to renders and stills; the three.js teachers need WebGL in
  headless Chrome, and every existing script uses it. Keep `--concurrency=2`: each render tab
  loads all five teacher models.
- Remotion's bundled ffmpeg is a minimal build. It has no `fps`, `hstack` or `astats` filters and
  no raw PCM output. Use `-r 30` to change the frame rate, and WAV for audio analysis.
- A zod version warning when rendering is harmless.
- Current sizes: masters 3.7–5.3 MB, mobile and portrait files 2.7–3.7 MB, posters about
  60 KB. A 75 s demo will be roughly three times that, which is fine because nothing downloads
  until the film is on screen.

## Putting a film on the page

`ProductFilm` (`src/features/marketing/ui/home/product-film.tsx`) handles playback. Use it
rather than a bare `<video>`:

```tsx
<ProductFilm
  src="/videos/marketing/trailgrad-tour.mp4?v=1"
  touchSrc="/videos/marketing/trailgrad-tour-mobile.mp4?v=1"
  portraitSrc="/videos/marketing/trailgrad-tour-portrait.mp4?v=1"
  poster="/videos/marketing/trailgrad-tour-poster.jpg?v=1"
  portraitPoster="/videos/marketing/trailgrad-tour-portrait-poster.jpg?v=1"
  label="Trailgrad product tour"
  description="A short silent film. Headlines say: ... (every line of on-screen text, in order)"
/>
```

- It chooses a source the first time the film scrolls into view: the master on desktop, the
  30 fps file on touch screens and tablets, the portrait cut on phones, and only the poster with
  data saver on, on 2G/3G, or on devices with 2 GB of memory or less. Until then no `src` is
  set, so nothing downloads.
- It plays muted and looping without controls while visible, pauses off screen and in hidden
  tabs, and stays on the poster for `prefers-reduced-motion`.
- `description` is read by screen readers instead of the film. Write out every on-screen line
  in order, as `hero.tsx` does.
- **Bump `?v=`** on every file you re-render. The files are cached for a long time, so without a
  new query string visitors keep the old film.
- The film frame on the page has a thin static ember border and no shadow or glow (see
  [10_DESIGN_SYSTEM.md](10_DESIGN_SYSTEM.md#decisions-and-rejected-alternatives)).

## Template: a full product demo

A 60–75 s tour in the same style, reusing only existing moves. Frame numbers are at 60 fps.
Every line is a suggestion; the structure is the point.

| Frames | Beat | Moves | Text |
| --- | --- | --- | --- |
| 0–100 | Opening | `Words` 140, zoom | "Your next interview." |
| 94–200 | Promise | `Words` ink + orange, enter right | "Practised before" / "it happens." |
| 194–330 | Resume | muted set-up + `Resume` sweep (from rounds film) | "It reads what you built." |
| 326–384 | Flash | `Letters` 260 | the highlighted skill, e.g. "Kafka." |
| 380–770 | Teachers | teacher montage, 78 frames each (from demo film) | name + one line each |
| 764–880 | Choice | `Words`, enter up | "Pick the teacher" / "you learn best with." |
| 874–1110 | Practice | muted set-up + typed hint | "Stuck? Ask for a hint." |
| 1104–1300 | Interview | muted set-up + quoted question | "They ask the follow-up." / “…” |
| 1294–1480 | Answer | typed answer with caret, enter right | "You answer out loud." |
| 1474–1650 | Score | count-up to 8/10 + orange payoff | "Now show how you measured it." |
| 1644–1690 | Bridge | `Words` 120 | "Then drill the gaps." |
| 1690–1850 | Drills | four `Letters` flashes, 38 frames apart, alternating | "Two pointers." … |
| 1850–2090 | Report | muted + headline + orange | "After every round," / "one thing to fix." |
| 2084–2280 | Rounds | four `Letters` flashes | "DSA." "System design." "Behavioural." "Resume Roast." |
| 2280–2420 | Help | muted + headline | "Still stuck?" / "Someone who solved it helps." |
| 2414–2650 | Progress | headline + count-up | "A little sharper" / "every round." |
| 2644–2880 | Sign-off | `Words` 150 + URL, exit zoom | "Walk in ready." / trailgrad.com |

For a new beat type that shows product UI (for example a stylised card), build it from type and
flat shapes in the same palette. Don't use a screenshot: screenshots date quickly, go blurry
when scaled, and break the typographic look.

## Asking an agent for a new film

Give it this, adjusted:

> Read `docs/11_PRODUCT_FILMS.md`. Make a new film called `<name>` in `video/trailgrad-demo`,
> in exactly the same style as the existing two, using only the kit. It should cover `<what>`
> and last about `<N>` seconds. Write the beat script as a table first and show it to me. Then
> build it, render stills in landscape and portrait for me to review, and only after I approve
> run the full renders. Don't wire it into the site unless I ask.
