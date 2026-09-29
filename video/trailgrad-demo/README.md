# Trailgrad product films

Two silent 1920 × 1080, 60 fps Remotion compositions on a white background:
`TrailgradDemo` (27 s, the hero: teachers, a follow-up, a score) and
`TrailgradRounds` (24 s, the second section: resume to report). Everything is rendered from React and three.js: no screen
recording, external generation API, or real candidate data.

From this directory:

```sh
npm ci
npm run studio
```

`src/kit.tsx` holds the shared moves: kinetic headlines (`Words`, `Letters`,
`Underline`), each wrapped in a `Beat` that zooms or slides in and punches
past the camera on exit, and the white `Stage`. `src/demo-film.tsx` and
`src/rounds-film.tsx` are the two films; `src/index.tsx` registers both.

`src/teacher.tsx` renders the app's GLB avatars (Maya, Daniel, Olivia, Ryan,
Claire), framed head and shoulders. The film has no audio; mouths move from
`src/voice-levels.json`, loudness levels taken from each teacher's recorded
greeting so the lip motion looks natural.

To regenerate the assets used by the landing page:

```sh
npm run render
npm run poster
npm run render:rounds
npm run poster:rounds
npm run mobile
```

`npm run mobile` makes the phone versions (`*-mobile.mp4`: 1080p, 30 fps,
H.264 Main 4.0, about 3 MB each) from the 1080p60 masters. Budget phones may
not decode 1080p60 High profile in hardware, but every phone decodes 1080p30
Main, so `ProductFilm` serves these on small screens and touch devices. Keep
them at 1080p: a phone's 2-3x pixel density means a 720p film is upscaled and
its text breaks up.

Outputs are written to `public/videos/marketing/` in the application root.
Bump the `?v=` query where `ProductFilm` is used after re-rendering so browsers refetch.
Run these scripts from this package so Remotion resolves its pinned
dependencies, which are separate from the Next.js application.

`ProductFilm` picks the file on first view (the master on desktop, the
mobile encode on phones, only the poster with data saver, on 2G/3G-class
connections, or on devices reporting 2 GB of memory or less), then plays it
muted and looping with no controls while it is visible, pauses off-screen or in a hidden tab, and stays on the poster for
reduced-motion visitors. A screen-reader description carries the copy.

Raleway is bundled locally for reproducible renders; its SIL Open Font License
is in `public/OFL.txt`. Remotion documentation: https://www.remotion.dev/docs/render
