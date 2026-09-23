#!/usr/bin/env python3
"""Baut aus den Bildkarten (bilder/<id>_<lang>.jpg, 1080x1350) kurze Hochkant-Videos für
Instagram Reels (bilder/<id>_<lang>.mp4, 1080x1920, 30 fps, 10 s, H.264 + AAC).

Aufruf: python3 werkzeug/reels.py [ids...]      (ohne ids: alle Bilder ohne passendes Video)
Ton: ein selbst erzeugter, leiser dunkler Klangteppich (keine fremde Musik, keine Lizenzfragen).
"""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BILDER = ROOT / "bilder"
DAUER = 10
FPS = 30
BG = "0x140F0C"  # Randfarbe der Bildkarten (20,17,12) leicht abgedunkelt

AUDIO = (
    "aevalsrc='0.18*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*0.21*t))"
    "+0.11*sin(2*PI*82.4*t)*(0.5+0.5*sin(2*PI*0.13*t+1))"
    "+0.06*sin(2*PI*110.2*t)*(0.5+0.5*sin(2*PI*0.08*t+2))':s=48000:d={d}[a0];"
    "anoisesrc=color=brown:amplitude=0.07:r=48000:d={d},lowpass=f=400[a1];"
    "[a0][a1]amix=inputs=2:normalize=0,lowpass=f=900,"
    "afade=t=in:d=1.2,afade=t=out:st={fo}:d=1.5,aformat=channel_layouts=stereo[a]"
)


def baue(src: Path, ziel: Path):
    n = DAUER * FPS
    # Bild 0.9-fach (972x1215), leicht nach oben versetzt, damit die untere Zeile
    # nicht unter der Instagram-Beschriftung verschwindet; langsamer Zoom auf 8 %.
    v = (
        f"[0:v]scale=3888:4860,zoompan=z='1+0.08*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={n}:s=972x1215:fps={FPS}[fg];"
        f"color=c={BG}:s=1080x1920:r={FPS}:d={DAUER}[bg];"
        f"[bg][fg]overlay=54:250:shortest=1,fade=t=in:st=0:d=0.6,fade=t=out:st={DAUER-0.8}:d=0.8,format=yuv420p[v];"
    )
    a = AUDIO.format(d=DAUER, fo=DAUER - 1.5)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-filter_complex", v + a,
           "-map", "[v]", "-map", "[a]", "-t", str(DAUER),
           "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-preset", "slow", "-crf", "21",
           "-r", str(FPS), "-g", str(FPS * 2), "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
           "-movflags", "+faststart", str(ziel)]
    subprocess.run(cmd, check=True)


def main():
    ids = sys.argv[1:]
    bilder = sorted(BILDER.glob("*.jpg"))
    if not ids:
        # Instagram nimmt das englische Bild, sonst das deutsche (config: instagram_bildsprache)
        stems = {b.stem for b in bilder}
        bilder = [b for b in bilder if b.stem.endswith("_en") or
                  (b.stem.endswith("_de") and b.stem[:-3] + "_en" not in stems)]
    if ids:
        bilder = [b for b in bilder if b.stem.rsplit("_", 1)[0] in ids]
    for b in bilder:
        ziel = b.with_suffix(".mp4")
        if ziel.exists() and not ids:
            continue
        baue(b, ziel)
        print(f"{ziel.name}: {ziel.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
