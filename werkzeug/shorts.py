#!/usr/bin/env python3
"""YouTube Shorts nach den Regeln vom 08.10.2026 (AUTOMATIK.md): höchstens 20 s,
Haken in den ersten 2 Sekunden, ein Short pro Tag.

Baut aus einem Plan-Beitrag mit Bildtyp „akte“ (Karteikarte aus der Registratur)
ein 17-Sekunden-Video 1080x1920:
  0-5 s   Haken: das Zitat groß, sofort lesbar, darüber der Countdown
  5-13 s  die Karteikarte, leicht vergrößert, langsam von oben nach unten
  13-17 s Abspann: Name, Band, kostenlos, Adresse

Aufruf: python3 werkzeug/shorts.py <id> <de|en> [ziel.mp4]
Ton: derselbe selbst erzeugte Klangteppich wie in reels.py.
"""
import re, subprocess, sys, tempfile, textwrap
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ROH = ROOT / "werkzeug" / "rohbilder"
FONTS = ROOT / "werkzeug" / "fonts"
W, H, FPS = 1080, 1920, 30
T_HAKEN, T_KARTE, T_ENDE = 5.0, 8.0, 4.0
ZOOM = 1.15
DAUER = T_HAKEN + T_KARTE + T_ENDE
BG = (20, 17, 12)
CREME = (240, 232, 214)
ROT = (196, 58, 48)
GRAU = (170, 160, 145)

AUDIO = (
    "aevalsrc='0.18*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*0.21*t))"
    "+0.11*sin(2*PI*82.4*t)*(0.5+0.5*sin(2*PI*0.13*t+1))"
    "+0.06*sin(2*PI*110.2*t)*(0.5+0.5*sin(2*PI*0.08*t+2))':s=48000:d={d}[a0];"
    "anoisesrc=color=brown:amplitude=0.07:r=48000:d={d},lowpass=f=400[a1];"
    "[a0][a1]amix=inputs=2:normalize=0,lowpass=f=900,"
    "afade=t=in:d=0.4,afade=t=out:st={fo}:d=1.5,aformat=channel_layouts=stereo[a]"
)


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def zeilen(draw, text, f, breite):
    """Bricht Text nach Pixelbreite um."""
    out = []
    for absatz in text.split("\n"):
        wort = absatz.split()
        z = ""
        for w in wort:
            probe = (z + " " + w).strip()
            if draw.textlength(probe, font=f) <= breite:
                z = probe
            else:
                out.append(z)
                z = w
        if z:
            out.append(z)
    return out


def tafel(pfad, oben, mitte, unten, mitte_gross=True):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    f_oben = font("SpecialElite-Regular.ttf", 46)
    f_mitte = font("Barlow-SemiBold.ttf", 74 if mitte_gross else 64)
    f_unten = font("Barlow-Regular.ttf", 46)
    # Text liegt zwischen 300 und 1500, damit die Shorts-Beschriftung unten nichts verdeckt
    y = 300
    for z in zeilen(d, oben, f_oben, W - 160):
        d.text((W / 2, y), z, font=f_oben, fill=ROT, anchor="ma")
        y += 62
    d.line([(W / 2 - 60, y + 24), (W / 2 + 60, y + 24)], fill=ROT, width=3)
    zl = zeilen(d, mitte, f_mitte, W - 150)
    hoehe = len(zl) * int(f_mitte.size * 1.28)
    y = max(y + 90, 820 - hoehe // 2)
    for z in zl:
        d.text((W / 2, y), z, font=f_mitte, fill=CREME, anchor="ma")
        y += int(f_mitte.size * 1.28)
    y += 50
    for z in zeilen(d, unten, f_unten, W - 200):
        d.text((W / 2, y), z, font=f_unten, fill=GRAU, anchor="ma")
        y += 56
    im.save(pfad, quality=95)


def beitrag(pid):
    d = yaml.safe_load(open(ROOT / "posts" / "plan.yaml", encoding="utf-8"))
    posts = d if isinstance(d, list) else next(iter(d.values()))
    return next(p for p in posts if p["id"] == pid)


def teile(p, lang):
    t = p[lang]["text"].strip()
    absaetze = [a.strip() for a in t.split("\n\n") if a.strip()]
    zitat = absaetze[0]
    rest = " ".join(absaetze[1:])
    m = re.search(r"(?:Aus der Registratur|From the Registry):\s*([^.]+)\.", rest)
    name = m.group(1).strip() if m else ""
    name = name[:1].upper() + name[1:]
    # Countdown aus dem Datum, damit er auch bei Beiträgen ohne Countdown-Satz stimmt
    tag = int(str(p["datum"])[-2:])
    n = 31 - tag
    if lang == "de":
        countdown = "Halloween ist heute Nacht" if n == 0 else ("Noch eine Nacht bis Halloween" if n == 1 else f"Noch {n} Nächte bis Halloween")
    else:
        countdown = "Halloween is tonight" if n == 0 else ("One night to Halloween" if n == 1 else f"{n} nights to Halloween")
    return zitat, countdown, name


def baue(pid, lang, ziel):
    p = beitrag(pid)
    bild = p["bild"][lang]
    karte = ROH / bild
    zitat, countdown, name = teile(p, lang)
    if lang == "de":
        abspann_mitte = f"{name}\naus Band 22, Die Registratur"
        abspann_unten = "105 Wesen auf Karteikarten.\nAlle 24 Bücher kostenlos:\nodin-rpg.pages.dev"
    else:
        abspann_mitte = f"{name}\nfrom Volume 22, The Registry"
        abspann_unten = "105 beings on index cards.\nAll 24 books free:\nodin-rpg.pages.dev"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        tafel(tmp / "haken.jpg", countdown, zitat, "")
        tafel(tmp / "ende.jpg", countdown, abspann_mitte, abspann_unten, mitte_gross=False)
        # Karte auf volle Breite, Höhe passend; Fahrt von oben nach unten
        k = Image.open(karte).convert("RGB")
        kw = int(W * ZOOM)
        kh = int(k.height * kw / k.width)
        k = k.resize((kw, kh), Image.LANCZOS)
        rand = (kw - W) // 2
        k.crop((rand, 0, rand + W, kh)).save(tmp / "karte.jpg", quality=95)
        n_k = int(T_KARTE * FPS)
        fahrt = max(kh - H, 0)
        v = (
            f"[0:v]loop=loop=-1:size=1:start=0,trim=duration={T_HAKEN},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p[h];"
            f"color=c=0x{BG[0]:02X}{BG[1]:02X}{BG[2]:02X}:s={W}x{H}:r={FPS}:d={T_KARTE}[kb];"
            f"[1:v]loop=loop=-1:size=1:start=0,fps={FPS},trim=duration={T_KARTE},setpts=PTS-STARTPTS[kr];"
            f"[kb][kr]overlay=x=0:y='{max(H - kh, 0) // 2}-{fahrt}*min(t/{T_KARTE - 1},1)':shortest=1,"
            f"fade=t=in:st=0:d=0.3,format=yuv420p[k];"
            f"[2:v]loop=loop=-1:size=1:start=0,trim=duration={T_ENDE},setpts=PTS-STARTPTS,fps={FPS},"
            f"fade=t=in:st=0:d=0.3,fade=t=out:st={T_ENDE - 0.6}:d=0.6,format=yuv420p[e];"
            f"[h][k][e]concat=n=3:v=1:a=0[v];"
        )
        a = AUDIO.format(d=DAUER, fo=DAUER - 1.5)
        cmd = ["ffmpeg", "-y", "-loglevel", "error",
               "-i", str(tmp / "haken.jpg"), "-i", str(tmp / "karte.jpg"), "-i", str(tmp / "ende.jpg"),
               "-filter_complex", v + a, "-map", "[v]", "-map", "[a]", "-t", str(DAUER),
               "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "20",
               "-r", str(FPS), "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
               "-movflags", "+faststart", str(ziel)]
        subprocess.run(cmd, check=True)
    return zitat, countdown, name


if __name__ == "__main__":
    pid, lang = sys.argv[1], sys.argv[2]
    ziel = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "bilder" / f"{pid}_short_{lang}.mp4"
    print(baue(pid, lang, ziel), ziel)
