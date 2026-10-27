#!/usr/bin/env python3
"""Generate the Android launcher icons, splash screens and the Play Store icon from the
Neon Dash art in icon.svg (ND-013). Needs chromium (renders the SVG) and Pillow.

Usage: python3 scripts/gen-android-icons.py [--out-store DIR]
Writes into android/app/src/main/res/ and docs/store/play-icon-512.png.
"""
import os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android/app/src/main/res")
SVG = open(os.path.join(ROOT, "icon.svg")).read()

# The art inside icon.svg, minus its rounded background square.
DEFS = re.search(r"<defs>.*?</defs>", SVG, re.S).group(0)
SCENE = re.sub(r'<rect width="512" height="512"[^>]*/>', "", SVG.split("</defs>", 1)[1].rsplit("</svg>", 1)[0])
BG_TOP, BG_BOTTOM = "#1a1a3e", "#3d1f5e"   # same gradient as icon.svg
BG_SOLID = "#2b1d4e"                         # adaptive-icon background colour (mid-gradient)

# The scene spans about x 40-472, y 158-368 in icon.svg's 512 box (centre 256, 263).
# Adaptive icons are cropped to a circle of 66/108 of the canvas; scale 0.6 keeps the
# scene's corners inside it (half-diagonal ~141 px < 156 px safe radius).
FG_SCALE = 0.6


def svg(body, w=512, h=512, bg=True, rx=0):
    back = f'<rect width="{w}" height="{h}" rx="{rx}" fill="url(#bg)"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f"{DEFS}{back}{body}</svg>")


def render(svg_text, w, h, path):
    """Render SVG to a PNG of exactly w x h with headless chromium (transparent background)."""
    with tempfile.TemporaryDirectory() as d:
        html = os.path.join(d, "a.html")
        open(html, "w").write(
            "<html><body style='margin:0;background:transparent'>"
            + svg_text.replace('width="', 'data-w="', 1).replace('<svg ', f'<svg style="display:block;width:{w}px;height:{h}px" ', 1)
            + "</body></html>")
        shot = os.path.join(d, "s.png")
        subprocess.run(["chromium", "--headless", "--disable-gpu", "--hide-scrollbars",
                        "--default-background-color=00000000", f"--window-size={w},{h}",
                        f"--screenshot={shot}", "file://" + html],
                       check=True, capture_output=True, timeout=120)
        Image.open(shot).convert("RGBA").crop((0, 0, w, h)).save(path)


def main():
    tmp = tempfile.mkdtemp()
    big = 1024
    full_sq = os.path.join(tmp, "full_square.png")     # full-bleed square (Play icon, splash)
    full_rnd = os.path.join(tmp, "full_rounded.png")   # icon.svg as-is (legacy launcher)
    fg = os.path.join(tmp, "foreground.png")           # transparent, scene in the safe zone
    render(svg(SCENE), big, big, full_sq)
    render(svg(SCENE, rx=96), big, big, full_rnd)
    k = FG_SCALE
    render(svg(f'<g transform="translate({256 - 256 * k} {256 - 263 * k}) scale({k})">{SCENE}</g>', bg=False),
           big, big, fg)

    densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, m in densities.items():
        d = os.path.join(RES, f"mipmap-{name}")
        n = int(48 * m)
        Image.open(full_rnd).resize((n, n), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
        sq = Image.open(full_sq).resize((n, n), Image.LANCZOS)
        mask = Image.new("L", (n * 4, n * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
        sq.putalpha(mask.resize((n, n), Image.LANCZOS))
        sq.save(os.path.join(d, "ic_launcher_round.png"))
        f = int(108 * m)
        Image.open(fg).resize((f, f), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"))

    # Adaptive icon background colour.
    open(os.path.join(RES, "values/ic_launcher_background.xml"), "w").write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">{BG_SOLID}</color>\n</resources>\n')

    # Splash screens: the game's gradient with the art centred, at each existing size.
    art = Image.open(fg)
    for folder in sorted(os.listdir(RES)):
        p = os.path.join(RES, folder, "splash.png")
        if not folder.startswith("drawable") or not os.path.exists(p):
            continue
        w, h = Image.open(p).size
        top, bot = Image.new("RGB", (1, 1), BG_TOP).getpixel((0, 0)), Image.new("RGB", (1, 1), BG_BOTTOM).getpixel((0, 0))
        grad = Image.new("RGB", (1, h))
        for y in range(h):
            t = y / max(1, h - 1)
            grad.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
        bg = grad.resize((w, h))
        s = int(min(w, h) * 0.75)
        a = art.resize((s, s), Image.LANCZOS)
        bg.paste(a, ((w - s) // 2, (h - s) // 2), a)
        bg.save(p)

    store = os.path.join(ROOT, "docs/store")
    os.makedirs(store, exist_ok=True)
    Image.open(full_sq).resize((512, 512), Image.LANCZOS).convert("RGB").save(os.path.join(store, "play-icon-512.png"))
    print("done:", RES, "and", store)


if __name__ == "__main__":
    main()
