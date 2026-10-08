"""Derives the app icon variants from assets/icon.png (white skull + "GSLP" on a gradient).

Run once after changing the artwork:  python3 scripts/make-icons.py
Needs Pillow and numpy. Writes: adaptive-foreground/background/monochrome, icon-dark, icon-tinted, splash-icon.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SIZE = 1024
SAFE = 0.62  # Android adaptive icons are masked; keep the mark inside the central ~66 %


def mark_alpha(icon: Image.Image) -> np.ndarray:
    """Alpha of the white mark: the background gradient never exceeds ~213 in its weakest channel."""
    rgb = np.asarray(icon.convert("RGB"), dtype=np.float32)
    weakest = rgb.min(axis=2)
    return np.clip((weakest - 150.0) / (255.0 - 150.0), 0.0, 1.0)


def white_mark(alpha: np.ndarray) -> Image.Image:
    rgba = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def fit(mark: Image.Image, fraction: float) -> Image.Image:
    """Crop to the mark's bounding box and centre it on a transparent canvas using `fraction` of the height."""
    box = mark.getbbox()
    assert box, "no mark found in icon.png"
    cropped = mark.crop(box)
    scale = (SIZE * fraction) / max(cropped.width, cropped.height)
    cropped = cropped.resize((round(cropped.width * scale), round(cropped.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(cropped, ((SIZE - cropped.width) // 2, (SIZE - cropped.height) // 2), cropped)
    return canvas


def gradient(top_right: tuple[int, int, int], bottom_left: tuple[int, int, int]) -> Image.Image:
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    t = ((SIZE - x) + y) / (2 * SIZE)  # 0 at top-right, 1 at bottom-left
    out = np.stack([top_right[i] + (bottom_left[i] - top_right[i]) * t for i in range(3)], axis=2)
    return Image.fromarray(out.astype(np.uint8), "RGB")


def over(background: Image.Image, mark: Image.Image) -> Image.Image:
    base = background.convert("RGBA")
    base.alpha_composite(mark)
    return base.convert("RGB")


def main() -> None:
    icon = Image.open(ASSETS / "icon.png")
    mark = white_mark(mark_alpha(icon))

    foreground = fit(mark, SAFE)
    foreground.save(ASSETS / "adaptive-foreground.png")
    foreground.save(ASSETS / "adaptive-monochrome.png")  # Android tints it from the user's palette
    gradient((67, 114, 170), (127, 127, 213)).save(ASSETS / "adaptive-background.png")

    full = fit(mark, 0.74)  # the same composition as icon.png
    over(gradient((11, 12, 14), (31, 34, 40)), full).save(ASSETS / "icon-dark.png")
    over(Image.new("RGB", (SIZE, SIZE), (0, 0, 0)), full).save(ASSETS / "icon-tinted.png")

    fit(mark, 0.94).save(ASSETS / "splash-icon.png")


if __name__ == "__main__":
    main()
