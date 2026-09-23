#!/usr/bin/env python3
"""Baut aus posts/plan.yaml die Bildkarten (1080 x 1350, JPEG, unter 1 MB) nach bilder/.

Aufruf:  python werkzeug/karten.py            (alle Karten)
         python werkzeug/karten.py w02-psion  (nur eine)
"""
import sys
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ROH = ROOT / "werkzeug" / "rohbilder"
OUT = ROOT / "bilder"
FONTS = ROOT / "werkzeug" / "fonts"

W, H = 1080, 1350
BG = (20, 17, 13)
PAPER = (31, 26, 20)
INK = (237, 227, 208)
MUT = (168, 153, 127)
LINE = (62, 52, 40)
ACC = (192, 73, 58)

FOOTER = {"de": "Alle Bücher kostenlos  ·  odin-rpg.pages.dev",
          "en": "Every book free  ·  odin-rpg.pages.dev/en"}


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


TYPE = lambda s: font("SpecialElite-Regular.ttf", s)
BAR = lambda s: font("Barlow-Regular.ttf", s)
BARB = lambda s: font("Barlow-SemiBold.ttf", s)


def spaced(draw, xy, text, fnt, fill, spacing=6, anchor_center=True):
    widths = [draw.textlength(c, font=fnt) for c in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x, y = xy
    if anchor_center:
        x -= total / 2
    for c, w in zip(text, widths):
        draw.text((x, y), c, font=fnt, fill=fill)
        x += w + spacing


def frame(lang):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    spaced(d, (W / 2, 52), "O.D.I.N.", TYPE(40), INK, spacing=10)
    d.line([(W / 2 - 60, 112), (W / 2 + 60, 112)], fill=ACC, width=3)
    ft = BAR(30)
    tw = d.textlength(FOOTER[lang], font=ft)
    d.text(((W - tw) / 2, H - 78), FOOTER[lang], font=ft, fill=MUT)
    return im, d


def load(name):
    return Image.open(ROH / name).convert("RGB")


def shadow_paste(im, pic, x, y):
    sh = Image.new("RGBA", (pic.width + 60, pic.height + 60), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([30, 30, pic.width + 30, pic.height + 30], fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    im.paste(sh, (x - 22, y - 18), sh)
    im.paste(pic, (x, y))


def card_cover(src, lang):
    im, d = frame(lang)
    pic = load(src)
    box_w, box_h = 900, 1080
    pic = ImageOps.contain(pic, (box_w, box_h), Image.LANCZOS)
    x = (W - pic.width) // 2
    y = 150 + (box_h - pic.height) // 2
    shadow_paste(im, pic, x, y)
    return im


def caption_band(im, d, text, y):
    fnt = BARB(46)
    tw = d.textlength(text, font=fnt)
    while tw > W - 120:
        fnt = BARB(fnt.size - 2)
        tw = d.textlength(text, font=fnt)
    d.text(((W - tw) / 2, y), text, font=fnt, fill=INK)


def card_foto(src, zeile, lang):
    im, d = frame(lang)
    pic = load(src)
    pic = ImageOps.fit(pic, (W - 120, 1000), Image.LANCZOS, centering=(0.5, 0.4))
    shadow_paste(im, pic, 60, 140)
    d = ImageDraw.Draw(im)
    d.line([(60, 1172), (W - 60, 1172)], fill=LINE, width=2)
    caption_band(im, d, zeile, 1188)
    return im


def wrap(d, text, fnt, maxw):
    lines = []
    for para in text.split("\n"):
        if not para.strip():
            lines.append("")
            continue
        cur = ""
        for word in para.split(" "):
            test = (cur + " " + word).strip()
            if d.textlength(test, font=fnt) <= maxw:
                cur = test
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def card_zitat(text, quelle, lang):
    im, d = frame(lang)
    x0, y0, x1, y1 = 70, 170, W - 70, 1220
    d.rectangle([x0, y0, x1, y1], fill=PAPER, outline=LINE, width=2)
    d.rectangle([x0, y0, x0 + 8, y1], fill=ACC)
    maxw = (x1 - x0) - 150
    size = 60
    while True:
        fnt = TYPE(size)
        lines = wrap(d, text, fnt, maxw)
        lh = int(size * 1.38)
        block = sum(lh if l else lh // 2 for l in lines)
        if block <= (y1 - y0) - 260 or size <= 30:
            break
        size -= 2
    y = y0 + ((y1 - y0) - 120 - block) // 2
    for l in lines:
        if l:
            d.text((x0 + 80, y), l, font=fnt, fill=INK)
            y += lh
        else:
            y += lh // 2
    qf = BAR(32)
    q = quelle.upper()
    d.line([(x0 + 80, y1 - 110), (x0 + 160, y1 - 110)], fill=ACC, width=3)
    d.text((x0 + 80, y1 - 90), q, font=qf, fill=MUT)
    return im


def card_raster(files, zeile, lang):
    im, d = frame(lang)
    cols, rows, gap = 3, 2, 18
    cw = (W - 120 - gap * (cols - 1)) // cols
    ch = int(cw * 4 / 3)
    top = 150
    for i, f in enumerate(files[:6]):
        pic = ImageOps.fit(load(f), (cw, ch), Image.LANCZOS)
        x = 60 + (i % cols) * (cw + gap)
        y = top + (i // cols) * (ch + gap)
        im.paste(pic, (x, y))
    d = ImageDraw.Draw(im)
    yb = top + rows * ch + gap + 30
    d.line([(60, yb), (W - 60, yb)], fill=LINE, width=2)
    caption_band(im, d, zeile, yb + 30)
    return im


def save(im, path):
    q = 90
    while True:
        im.save(path, "JPEG", quality=q, optimize=True, progressive=True)
        if path.stat().st_size < 950_000 or q <= 60:
            return
        q -= 5


def build(post):
    b = post.get("bild")
    if not b:
        return []
    made = []
    for lang in ("de", "en"):
        if lang not in post:
            continue
        t = b["typ"]
        if t == "cover":
            src = b.get(lang) or b.get("de")
            im = card_cover(src, lang)
        elif t == "foto":
            im = card_foto(b["datei"], b[f"zeile_{lang}"], lang)
        elif t == "zitat":
            im = card_zitat(b[lang], b[f"quelle_{lang}"], lang)
        elif t == "raster":
            im = card_raster(b["dateien"], b[f"zeile_{lang}"], lang)
        else:
            raise SystemExit(f"{post['id']}: unbekannter Bildtyp {t}")
        out = OUT / f"{post['id']}_{lang}.jpg"
        save(im, out)
        made.append(out)
    return made


def main():
    plan = yaml.safe_load((ROOT / "posts" / "plan.yaml").read_text(encoding="utf-8"))
    only = set(sys.argv[1:])
    OUT.mkdir(exist_ok=True)
    for p in plan["posts"]:
        if only and p["id"] not in only:
            continue
        for f in build(p):
            print(f"{f.relative_to(ROOT)}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
