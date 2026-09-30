"""Recompute src/voice-levels.json: one mouth-opening level per 60 fps frame
for each teacher, from their recorded greeting in public/<id>.mp3.

    python3 scripts/voice-levels.py maya claire      # just these teachers
    python3 scripts/voice-levels.py                  # every public/*.mp3

Level = RMS of each 1/60 s window, divided by the clip's 95th percentile,
capped at 1. Other keys already in the JSON are kept.
"""
import json
import math
import pathlib
import struct
import subprocess
import sys
import tempfile
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "voice-levels.json"
RATE, FPS = 48000, 60


def levels(mp3: pathlib.Path) -> list[float]:
    with tempfile.TemporaryDirectory() as tmp:
        wav = pathlib.Path(tmp) / "voice.wav"
        # Remotion's bundled ffmpeg can write WAV but not raw PCM.
        subprocess.run(["npx", "remotion", "ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", str(RATE), "-c:a", "pcm_s16le", str(wav)], cwd=ROOT, check=True)
        with wave.open(str(wav)) as f:
            n = f.getnframes()
            samples = struct.unpack(f"<{n}h", f.readframes(n))
    window = RATE // FPS
    rms = [math.sqrt(sum(x * x for x in samples[i : i + window]) / window) for i in range(0, n, window)]
    peak = sorted(rms)[int(0.95 * len(rms))] or 1
    return [min(1, round(x / peak, 3)) for x in rms]


def main() -> None:
    ids = sys.argv[1:] or sorted(p.stem for p in (ROOT / "public").glob("*.mp3"))
    data = json.loads(OUT.read_text()) if OUT.exists() else {}
    for teacher in ids:
        values = levels(ROOT / "public" / f"{teacher}.mp3")
        data[teacher] = {**data.get(teacher, {}), "frames": len(values), "levels": values}
        print(f"{teacher}: {len(values)} frames")
    OUT.write_text(json.dumps(data))


if __name__ == "__main__":
    main()
