"""Builds the store graphics from the raw simulator captures in store/screenshots/raw/dark.

Run after retaking captures:  python3 store/make-screenshots.py
Needs Pillow and numpy. Writes screenshots/ios-6.9 (1320x2868), screenshots/android-phone (1080x1920),
graphics/play-icon-512.png and graphics/play-feature-1024x500.png.
"""

import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

STORE = Path(__file__).resolve().parent
ROOT = STORE.parent
RAW = STORE / "screenshots" / "raw" / "dark"
FONT = ROOT / "node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"

# Order matters: the first three carry the listing.
SHOTS = [
    ("01-today.png", "Know exactly what to lift"),
    ("02-session.png", "Plates worked out for you"),
    ("03-progress.png", "See every lift climb"),
    ("04-lift.png", "Projections for each lift"),
    ("05-plan.png", "Greyskull LP, built in"),
    ("06-gym.png", "Your plates. kg or lb."),
]
TARGETS = {"ios-6.9": (1320, 2868), "android-phone": (1080, 1920)}

spec = importlib.util.spec_from_file_location("make_icons", ROOT / "scripts" / "make-icons.py")
make_icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(make_icons)

icon = Image.open(ROOT / "assets" / "icon.png").convert("RGB")
TOP, BOTTOM = icon.getpixel((8, 8)), icon.getpixel((8, 1015))


def gradient(size: tuple[int, int]) -> Image.Image:
    """Vertical blend of the icon's top-left and bottom-left colours."""
    w, h = size
    col = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        col.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))
    return col.resize(size)


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def wrap(text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    for word in text.split():
        if lines and font.getlength(f"{lines[-1]} {word}") <= width:
            lines[-1] += f" {word}"
        else:
            lines.append(word)
    return lines


def frame(raw: Path, caption: str, size: tuple[int, int]) -> Image.Image:
    w, h = size
    canvas = gradient(size).convert("RGBA")
    font = ImageFont.truetype(str(FONT), round(w * 0.062))
    draw = ImageDraw.Draw(canvas)
    y = round(h * 0.045)
    for line in wrap(caption, font, round(w * 0.88)):
        draw.text((w / 2, y), line, font=font, fill="white", anchor="mt")
        y += round(font.size * 1.2)
    shot_w = round(w * 0.82)
    shot = Image.open(raw).convert("RGB")
    shot = shot.resize((shot_w, round(shot.height * shot_w / shot.width)), Image.LANCZOS)
    shot = rounded(shot, round(w * 0.06))
    x, top = (w - shot_w) // 2, y + round(h * 0.02)
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x, top + 24, x + shot_w, top + 24 + shot.height), round(w * 0.06), fill=(0, 0, 0, 110)
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    canvas.alpha_composite(shot, (x, top))  # bleeds off the bottom edge
    return canvas.convert("RGB")


def play_graphics() -> None:
    out = STORE / "graphics"
    out.mkdir(exist_ok=True)
    icon.convert("RGB").resize((512, 512), Image.LANCZOS).save(out / "play-icon-512.png")
    banner = gradient((1024, 500)).convert("RGBA")
    mark = make_icons.white_mark(make_icons.mark_alpha(icon))
    mark = mark.crop(mark.getbbox())
    mark = mark.resize((round(mark.width * 300 / mark.height), 300), Image.LANCZOS)
    banner.alpha_composite(mark, (90, 100))
    draw = ImageDraw.Draw(banner)
    draw.text((400, 245), "Greyskull LP", font=ImageFont.truetype(str(FONT), 82), fill="white", anchor="ls")
    draw.text(
        (404, 310), "Strength training log", font=ImageFont.truetype(str(FONT), 36), fill=(255, 255, 255, 210), anchor="ls"
    )
    banner.convert("RGB").save(out / "play-feature-1024x500.png")


def main() -> None:
    for folder, size in TARGETS.items():
        dest = STORE / "screenshots" / folder
        dest.mkdir(parents=True, exist_ok=True)
        for raw, caption in SHOTS:
            img = frame(RAW / raw, caption, size)
            assert img.size == size, (img.size, size)
            img.save(dest / raw)
    play_graphics()
    for path, size in [("graphics/play-icon-512.png", (512, 512)), ("graphics/play-feature-1024x500.png", (1024, 500))]:
        assert Image.open(STORE / path).size == size, path
    print("ok")


if __name__ == "__main__":
    main()
