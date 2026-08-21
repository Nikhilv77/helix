# Interviewer avatar

`interviewer-v2.glb` is the current bundled interviewer model. The marketing
and workspace surfaces use it by default.

To use a different `.glb`, place it here and set `NEXT_PUBLIC_AVATAR_URL`:

```bash
NEXT_PUBLIC_AVATAR_URL=/avatars/your-avatar.glb
```

The model needs **ARKit blendshapes** and **Oculus visemes** — without them
it loads but the face cannot move. The rig looks these up by name:

- `jawOpen`, `mouthOpen`, `mouthSmile`
- `viseme_aa`, `viseme_O`, `viseme_E`
- `eyeBlinkLeft`, `eyeBlinkRight`

Ready Player Me shut down on 31 Jan 2026. Use [avaturn.me](https://avaturn.me)
for a realistic avatar from a selfie, or any GLB with the morph targets above.
A local file avoids depending on a third-party host staying up.
