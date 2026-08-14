from pathlib import Path
import sys

from PIL import Image


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/crop-profile-cover-ideas.py <uploaded-cover-sheet>")
        return 1

    source = Path(sys.argv[1])
    if not source.exists():
      print(f"Missing source image: {source}")
      return 1

    out_dir = Path("public/images/profile/covers")
    out_dir.mkdir(parents=True, exist_ok=True)

    image = Image.open(source).convert("RGB")
    width, height = image.size

    # The uploaded sheet is five equal horizontal banners separated by gutters.
    # Cropping by bands is more robust than hardcoded pixel coordinates.
    band_height = height / 5
    gutter_ratio = 0.035

    for index in range(5):
        top = int(index * band_height + band_height * gutter_ratio)
        bottom = int((index + 1) * band_height - band_height * gutter_ratio)
        crop = image.crop((0, top, width, bottom))
        crop = crop.resize((1600, 360), Image.Resampling.LANCZOS)
        crop.save(out_dir / f"cover-idea-{index + 1:02d}.webp", "WEBP", quality=82, method=6)

    print("Wrote profile cover assets to public/images/profile/covers/cover-idea-*.webp")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
