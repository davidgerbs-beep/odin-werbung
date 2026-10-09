#!/usr/bin/env python3
"""Schnelles Reel im Musikvideo-Schnitt aus den Rundumvideos der Miniaturen.

gut 16 s bei 112,5 BPM (ein Schlag = 16 Bilder): Haken mit Achtel-Schnitten, dann Schnitt auf jeden Schlag,
Nah und Total im Wechsel, Blitzbilder an den Abschnitten, Schlagwörter auf dem Schlag,
zum Schluss eine Figur ruhig und der Abspann mit Preisen. Ton: selbst erzeugter Beat (numpy).

Aufruf: python3 werkzeug/miniaturen_mtv.py <ordner_mit_rundumvideos> <de|en> <ziel.mp4>
Die Rundumvideos heißen <unterklasse>-<m|w>.mp4 (720x720, 10 s), wie unter /video/miniaturen/.
"""
import random, subprocess, sys, tempfile, wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shorts  # Schriften, Farben, Abspanntafel

W, H, FPS = 1080, 1920, 30
BEAT = 16 / 30  # 112,5 BPM: ein Schlag = 16 Bilder, ein Achtel = 8 Bilder, kein Versatz beim Schneiden
SR = 48000

FIGUREN = ["invoker-w", "techno-stormtrooper-m", "psychic-healer-w", "antiquarian-m", "assassin-w", "telepath-w",
           "shadow-paratrooper-m", "alchemist-w", "infiltrator-m", "chronomancer-m", "cyberneticist-w",
           "paranormal-detective-m", "stormbreaker-w", "spy-m", "elementarist-w", "nanotech-veteran-m",
           "journalist-w", "illusionist-m", "saboteur-w", "precognitive-m", "biochemist-w", "echo-operative-m",
           "profiler-w", "thaumaturgist-m", "cryptanalyst-w", "telekinetic-m", "engineer-w", "negotiator-m",
           "astrobiologist-w", "physicist-m"]

WORTE = {
    "de": {"haken": "30 MINIATUREN", 6: "STL", 10: "RESIN", 14: "28 MM", 18: "MANN & FRAU", 24: "JETZT BEI ETSY",
           "ende": ("O.D.I.N.-Miniaturen", "Alle 30 Unterklassen",
                    "STL ab 5,90 €, gedruckt ab 19,90 €.\nodin-rpg.pages.dev/miniaturen")},
    "en": {"haken": "30 MINIATURES", 6: "STL", 10: "RESIN", 14: "28 MM", 18: "MALE & FEMALE", 24: "NOW ON ETSY",
           "ende": ("O.D.I.N. miniatures", "All 30 subclasses",
                    "STL from €5.90, printed from €19.90\n(shipping in Germany).\nodin-rpg.pages.dev/en/miniatures")},
}


def plan(figuren=None, ruhig="invoker-m"):
    """Liste von (bilder, figur, einstellung, blitz, wortschluessel)."""
    figuren = figuren or FIGUREN
    figs = iter(figuren * (40 // len(figuren) + 1))
    segs = []
    for i in range(8):  # Haken: Achtel
        segs.append((8, next(figs), "nah" if i % 2 else "total", i == 0, "haken"))
    for i in range(16):  # Hauptteil: jeder Schlag ein Schnitt
        segs.append((16, next(figs), ["total", "nah", "weit", "nah"][i % 4], i in (0, 8), i + 4 if i + 4 in (6, 10, 14, 18) else None))
    for i in range(8):  # Anlauf: Achtel
        segs.append((8, next(figs), "nah" if i % 2 else "total", i == 0, None))
    segs.append((64, ruhig, "weit", True, 24))  # ruhig, vier Schläge
    return segs


def textbild(pfad, wort, gross=170):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = shorts.font("Barlow-SemiBold.ttf", gross)
    zl = shorts.zeilen(d, wort, f, W - 120)
    y = 1380 - len(zl) * int(gross * 1.05) // 2
    for z in zl:
        # dunkler Schatten, dann weiß
        d.text((W / 2 + 6, y + 6), z, font=f, fill=(0, 0, 0, 200), anchor="ma")
        d.text((W / 2, y), z, font=f, fill=(245, 240, 230, 255), anchor="ma")
        y += int(gross * 1.05)
    d.rectangle([W / 2 - 90, y + 20, W / 2 + 90, y + 32], fill=shorts.ROT + (255,))
    im.save(pfad)


def filter_fuer(einst):
    if einst == "nah":
        return "scale=2700:2700,crop=1080:1920:(iw-1080)/2:ih*0.10"
    if einst == "total":
        return "scale=1920:1920,crop=1080:1920"
    return f"scale=1080:1080,pad={W}:{H}:0:420:color=0x0e0b08"


def beat(dauer, ende_beats):
    n = int(SR * dauer)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rng = np.random.default_rng(23)
    nb = int(ende_beats)
    for b in range(nb):
        s = int(b * BEAT * SR)
        # Kick: Sinus mit fallender Tonhöhe
        k = np.arange(int(0.18 * SR)) / SR
        kick = np.sin(2 * np.pi * (45 + 90 * np.exp(-k * 30)) * k) * np.exp(-k * 18)
        out[s:s + len(kick)] += 0.9 * kick[: max(0, min(len(kick), n - s))]
        # Clap auf 2 und 4
        if b % 2 == 1:
            c = rng.standard_normal(int(0.12 * SR)) * np.exp(-np.arange(int(0.12 * SR)) / SR * 30)
            out[s:s + len(c)] += 0.35 * c[: max(0, min(len(c), n - s))]
        # Hi-Hat auf den Achteln dazwischen
        h0 = s + int(BEAT / 2 * SR)
        hh = rng.standard_normal(int(0.03 * SR))
        hh = np.diff(hh, prepend=0) * np.exp(-np.arange(len(hh)) / SR * 120)
        if h0 < n:
            out[h0:h0 + len(hh)] += 0.25 * hh[: min(len(hh), n - h0)]
    # Bass: dunkler Grundton mit Puls auf dem Schlag
    puls = 0.6 + 0.4 * np.cos(2 * np.pi * t / BEAT)
    out += 0.22 * np.sin(2 * np.pi * 55 * t) * puls * (t < ende_beats * BEAT)
    # Abspann: leiser Ton, ausblenden
    out += 0.12 * np.sin(2 * np.pi * 55 * t) * (t >= ende_beats * BEAT)
    fade = np.clip((dauer - t) / 1.2, 0, 1)
    out *= fade
    out /= max(1e-9, np.max(np.abs(out))) / 0.85
    return (out * 32767).astype(np.int16)


def baue(quelle, lang, ziel, figuren=None, worte=None, ruhig="invoker-m"):
    quelle = Path(quelle)
    segs = plan(figuren, ruhig)
    bilder_ges = sum(x[0] for x in segs)
    t_ende = bilder_ges / FPS
    T_ABSPANN = 2.6
    dauer = t_ende + T_ABSPANN
    w = dict(WORTE[lang]); w.update(worte or {})
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        liste = []
        r = random.Random(42)
        for i, (nb, fig, einst, blitz, key) in enumerate(segs):
            d = nb / FPS
            wort = w.get(key) if key is not None else None
            off = 0.5 if einst == "weit" and d > 1 else r.uniform(0.5, 9.0 - d)
            vf = filter_fuer(einst) + f",fps={FPS},eq=contrast=1.12:brightness=-0.02,format=yuv420p"
            if blitz:
                vf += ",fade=t=in:st=0:d=0.08:color=white"
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{off:.2f}", "-i", str(quelle / f"{fig}.mp4")]
            if wort:
                tb = tmp / f"w{i}.png"
                textbild(tb, wort, 150 if len(wort) > 10 else 190)
                cmd += ["-i", str(tb), "-filter_complex", f"[0:v]{vf}[v];[v][1:v]overlay=0:0,format=yuv420p[o]", "-map", "[o]"]
            else:
                cmd += ["-vf", vf]
            seg = tmp / f"s{i:02d}.mp4"
            cmd += ["-frames:v", str(nb), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-r", str(FPS), str(seg)]
            subprocess.run(cmd, check=True)
            liste.append(seg)
        o, m, u = w["ende"]
        shorts.tafel(tmp / "ende.jpg", o, m, u)
        ende = tmp / "ende.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(tmp / "ende.jpg"),
                        "-vf", f"fps={FPS},fade=t=in:st=0:d=0.15:color=white,format=yuv420p", "-frames:v", str(int(T_ABSPANN * FPS)),
                        "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-r", str(FPS), str(ende)], check=True)
        liste.append(ende)
        (tmp / "liste.txt").write_text("".join(f"file '{p}'\n" for p in liste))
        a = beat(dauer, round(t_ende / BEAT))
        with wave.open(str(tmp / "beat.wav"), "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(a.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(tmp / "liste.txt"),
                        "-i", str(tmp / "beat.wav"), "-map", "0:v", "-map", "1:a", "-t", f"{dauer:.3f}",
                        "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-preset", "slow", "-crf", "20",
                        "-r", str(FPS), "-g", str(FPS * 2), "-c:a", "aac", "-b:a", "160k", "-ar", str(SR), "-ac", "2",
                        "-movflags", "+faststart", str(ziel)], check=True)
    return dauer


if __name__ == "__main__":
    print(baue(sys.argv[1], sys.argv[2], sys.argv[3]))
