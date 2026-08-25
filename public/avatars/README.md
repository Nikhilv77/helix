# Interviewer avatars

Every model here is registered in `src/lib/avatars/personas.ts`, which pairs it
with a voice and a set of rig constants. Nothing should reference a `.glb` path
directly — import the persona instead.

- `maya.glb` is **Maya**, the product's own voice. The dashboard, the
  welcome dialog and the marketing hero are pinned to her.
- The nine named models are the interview-room cast, picked per session by
  `personaForSession()`.

## Requirements for a new model

The rig looks morph targets up **by name**, so any `.glb` carrying ARKit
blendshapes and Oculus visemes works, whatever produced it:

- `jawOpen` (or `mouthOpen`), `mouthClose`, `mouthSmile` (or
  `mouthSmileLeft` + `mouthSmileRight`), `browInnerUp`
- `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`, `viseme_sil`,
  `viseme_PP`
- `eyeBlinkLeft`, `eyeBlinkRight`

Framing is derived from the bounding box rather than bone names, so proportions
and skeleton layout do not matter.

## Adding one

1. Drop the `.glb` in this folder.
2. Compress it: `node scripts/optimize-avatar.mjs public/avatars/your.glb`.
   Texture caps are applied per material role — the face keeps 1024px, clothing
   drops to 512px, because the camera crops to roughly the top third of the
   figure. Re-running on an already-processed file is a no-op.
3. Add an entry to `INTERVIEWERS` in `src/lib/avatars/personas.ts`.

Ready Player Me shut down on 31 Jan 2026. [avaturn.me](https://avaturn.me)
builds a model from a photo; the
[Microsoft Rocketbox library](https://github.com/microsoft/Microsoft-Rocketbox)
is MIT-licensed and needs no photo at all.

## Licensing

The nine Rocketbox-derived models are MIT — see `LICENSE-rocketbox.md`, which
must ship alongside them. `maya.glb` is a Ready Player Me export;
check its terms before relying on it commercially now that RPM is gone.

## Overrides

`NEXT_PUBLIC_AVATAR_URL` pins one model across every interview, for previewing
a replacement without a deploy. Set it to `off` to fall back to the non-3D
presence indicator.
