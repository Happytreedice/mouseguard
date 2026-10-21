#!/usr/bin/env python3
"""Generate the placeholder art in assets/sheet/.

The character sheet copies the layout of the "Legend in the Mist" (mist-engine-fvtt) sheet. That sheet draws its look
with raster images (parchment cards, ribbon headers, paper boxes, separators...). Those images are proprietary, so this
system ships PLACEHOLDERS instead: every file below has the same role, file format, colour mode, pixel size and alpha
layout (transparent margin + rim inside the CSS border-image slice) as the image it stands in for, so the CSS can use it
exactly the way mist-engine uses the original. Drop your own art in under the same file name to restyle the sheets.

assets/sheet/README.md lists every file (role, size, mirrored mist-engine file, where it is used).

Usage:  python3 -I scripts/make-placeholders.py          (needs Pillow with WebP support; no other dependency)
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "sheet"


def rgb(colour):
    return ImageColor.getrgb(colour)[:3]


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def font(size=11):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def textured_panel(size, edge, centre, falloff, noise=6):
    """An opaque RGB panel: `edge` colour at the border fading to `centre` over `falloff` px, plus soft grain."""
    w, h = size
    panel = Image.new("RGB", size, rgb(centre))
    draw = ImageDraw.Draw(panel)
    steps = max(1, min(falloff, w // 2, h // 2))
    e, c = rgb(edge), rgb(centre)
    for i in range(steps):
        t = (i / steps) ** 0.6
        draw.rectangle([i, i, w - 1 - i, h - 1 - i], outline=mix(e, c, t))
    if noise:  # gaussian grain centred on 0: panel + (noise - 128)
        grain = Image.effect_noise(size, noise).convert("RGB")
        panel = ImageChops.add(panel, grain, scale=1.0, offset=-128)
    return panel


def box(name, size, mode, centre, edge, rim, rim_px, margin, falloff, label, noise=4, lossless=False, quality=82):
    """Card / paper / panel placeholder. RGBA images keep a transparent `margin` (WebP drops the alpha channel of a fully
    opaque image, so every RGBA placeholder keeps at least 1 transparent pixel)."""
    w, h = size
    inner = (w - 2 * margin, h - 2 * margin)
    panel = textured_panel(inner, edge, centre, falloff, noise)
    if rim_px:
        d = ImageDraw.Draw(panel)
        for i in range(rim_px):
            d.rectangle([i, i, inner[0] - 1 - i, inner[1] - 1 - i], outline=rgb(rim))
    if mode == "RGBA":
        im = Image.new("RGBA", size, (0, 0, 0, 0))
        im.paste(panel.convert("RGBA"), (margin, margin))
    else:
        im = Image.new("RGB", size, rgb(edge))
        im.paste(panel, (margin, margin))
    if label:
        d = ImageDraw.Draw(im, "RGBA")
        r, g, b = rgb(rim)
        d.text((margin + rim_px + 14, h - margin - rim_px - 22), f"placeholder: {label}", fill=(r, g, b, 80), font=font(11))
    save(im, name, lossless, quality)


def ribbon(name, body, edge):
    """250x30 ribbon header (drawn at background-size 100% 20px by the CSS)."""
    w, h = 250, 30
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    panel = textured_panel((w - 2, h - 2), edge, body, 4, noise=3)
    im.paste(panel.convert("RGBA"), (1, 1))
    save(im, name, True)


def line(name, size, colour, alpha, thickness=2, diamond=False, fade_left=False):
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = h // 2
    th = max(1, min(thickness, h - 2))
    r, g, b = rgb(colour)
    for x in range(w):
        a = alpha
        if fade_left:
            a = round(alpha * min(1.0, x / (w * 0.6)))
        d.line([(x, y - th // 2), (x, y - th // 2 + th - 1)], fill=(r, g, b, a))
    if diamond:
        c, rad = w // 2, min(h // 3, 9)
        d.polygon([(c - rad, y), (c, y - rad), (c + rad, y), (c, y + rad)], fill=(0, 0, 0, 0), outline=(r, g, b, alpha))
        d.polygon([(c - rad + 4, y), (c, y - rad + 4), (c + rad - 4, y), (c, y + rad - 4)], fill=(r, g, b, alpha))
    save(im, name, True)


def deco(name, size, label):
    """Optional card decoration (sits ABOVE the card text in mist-engine): keep it almost fully transparent."""
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for x in range(1, w - 1, 12):
        d.line([(x, 1), (min(x + 5, w - 2), 1)], fill=(110, 80, 50, 70))
        d.line([(x, h - 2), (min(x + 5, w - 2), h - 2)], fill=(110, 80, 50, 70))
    for y in range(1, h - 1, 12):
        d.line([(1, y), (1, min(y + 5, h - 2))], fill=(110, 80, 50, 70))
        d.line([(w - 2, y), (w - 2, min(y + 5, h - 2))], fill=(110, 80, 50, 70))
    d.text((8, 6), f"placeholder: {label}", fill=(110, 80, 50, 90), font=font(11))
    save(im, name, True)


def save(im, name, lossless=True, quality=82):
    OUT.mkdir(parents=True, exist_ok=True)
    if lossless:
        im.save(OUT / name, "WEBP", lossless=True, method=6)
    else:
        im.save(OUT / name, "WEBP", quality=quality, method=6)


CIRCLE_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" preserveAspectRatio="none">'
    '<path d="M18 30 C 12 12, 70 4, 112 5 C 160 6, 196 14, 192 27 C 188 41, 120 47, 80 45 C 40 43, 8 38, 12 24 '
    'C 15 15, 40 9, 62 8" fill="none" stroke="#2d1506" stroke-width="2.5" stroke-linecap="round" opacity=".85"/></svg>\n'
)


def main():
    # name, size, mode, centre, edge, rim, rim_px, transparent margin, falloff, label, noise, lossless
    # Images drawn with border-image "fill stretch" get no label: stretching would smear it across the sheet content.
    box("sheet-background.webp", (2400, 1553), "RGB", "#221d17", "#100d0a", "#100d0a", 0, 0, 380, "sheet background",
        noise=7, lossless=False, quality=70)
    box("card-parchment.webp", (347, 983), "RGBA", "#f1e4d4", "#a8907c", "#695646", 3, 2, 60, None, noise=5)
    box("paper-dialog.webp", (433, 368), "RGBA", "#e2dcce", "#cfc2b6", "#7c746a", 2, 2, 40, None, noise=4)
    box("paper-note-300.webp", (569, 314), "RGBA", "#f8f4ea", "#ece4d8", "#c5bcb4", 2, 11, 18, None, noise=3)
    box("paper-note-500.webp", (569, 537), "RGBA", "#fefbf0", "#ece4d8", "#c5bcb4", 2, 11, 18, None, noise=3)
    box("paper-item.webp", (1229, 1589), "RGB", "#f2d5a8", "#e2bf8d", "#d9b98c", 0, 0, 160, "item sheet paper",
        noise=6, lossless=False, quality=75)
    box("outcome-success.webp", (738, 489), "RGBA", "#faf2de", "#f1dcac", "#cec3a2", 2, 2, 90, None)
    box("outcome-partial.webp", (994, 660), "RGBA", "#efe4de", "#ead9c1", "#d8cbb8", 2, 2, 110, None)
    box("outcome-failure.webp", (994, 660), "RGBA", "#e9dddf", "#e3d8db", "#cfc3c6", 2, 2, 110, None)
    ribbon("header-green.webp", "#748876", "#4c5a4a")
    ribbon("header-rust.webp", "#a5786a", "#754b37")
    ribbon("header-slate.webp", "#7a7a91", "#4c495c")
    ribbon("header-orange.webp", "#b5825a", "#935f36")
    ribbon("header-black.webp", "#303030", "#090909")
    line("separator.webp", (947, 45), "#9d6849", 255, thickness=2, diamond=True)
    line("header-backline.webp", (105, 6), "#dd9328", 121, thickness=4, fade_left=True)
    line("line-red.webp", (474, 7), "#915655", 140, thickness=2)
    line("line-gray.webp", (492, 8), "#8b7a5b", 127, thickness=2)
    deco("deco-1.webp", (326, 500), "deco-1")
    deco("deco-2.webp", (420, 1000), "deco-2")
    deco("deco-3.webp", (500, 488), "deco-3")
    deco("deco-4.webp", (500, 481), "deco-4")
    (OUT / "circle-selection.svg").write_text(CIRCLE_SVG, encoding="utf-8")


if __name__ == "__main__":
    main()
    for p in sorted(OUT.iterdir()):
        if p.suffix == ".webp":
            with Image.open(p) as im:
                print(f"{p.name:28s} {im.format} {im.mode:5s} {im.size[0]}x{im.size[1]}  {p.stat().st_size // 1024} KB")
        elif p.suffix == ".svg":
            print(f"{p.name:28s} SVG")
