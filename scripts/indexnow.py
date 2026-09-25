#!/usr/bin/env python3
"""Meldet geänderte Seiten der Website per IndexNow (Bing, Yandex, Seznam, Naver).

Kostenlos, ohne Konto. Liest die live-Sitemap, vergleicht <lastmod> mit
state/indexnow.json und schickt nur neue oder geänderte Adressen.
Läuft über .github/workflows/indexnow.yml (alle 6 Stunden und von Hand).
"""
import json, re, sys, urllib.request
from pathlib import Path

BASE = "https://odin-rpg.pages.dev"
KEY = "451d3aed371ca1b1a35723f1eb97c968"
STAND = Path(__file__).resolve().parent.parent / "state" / "indexnow.json"


def holen(url):
    req = urllib.request.Request(url, headers={"User-Agent": "odin-werbung-indexnow"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def main():
    if holen(f"{BASE}/{KEY}.txt").strip() != KEY:
        sys.exit("Schlüsseldatei auf der Website fehlt oder stimmt nicht")
    xml = holen(f"{BASE}/sitemap.xml")
    eintraege = re.findall(r"<url>\s*<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", xml)
    stand = json.loads(STAND.read_text(encoding="utf-8")) if STAND.exists() else {}
    neu = [(u, d) for u, d in eintraege if stand.get(u) != d]
    print(f"Sitemap: {len(eintraege)} Adressen, neu oder geändert: {len(neu)}")
    if not neu:
        return
    for i in range(0, len(neu), 1000):
        teil = neu[i:i + 1000]
        daten = json.dumps({"host": "odin-rpg.pages.dev", "key": KEY, "keyLocation": f"{BASE}/{KEY}.txt",
                            "urlList": [u for u, _ in teil]}).encode("utf-8")
        req = urllib.request.Request("https://api.indexnow.org/indexnow", data=daten, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        with urllib.request.urlopen(req, timeout=30) as r:
            print("IndexNow:", r.status)
            if r.status not in (200, 202):
                sys.exit(1)
        for u, d in teil:
            stand[u] = d
            print("  gemeldet:", u)
    STAND.parent.mkdir(exist_ok=True)
    STAND.write_text(json.dumps(stand, indent=1, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
