#!/usr/bin/env python3
"""O.D.I.N. Werbe-Automatik.

Liest posts/plan.yaml und config.yaml, postet fällige Beiträge auf Bluesky, Mastodon,
Discord und Instagram und merkt sich in state/gepostet.json, was schon draußen ist.

  python scripts/post.py               normaler Lauf (so ruft GitHub Actions es stündlich auf)
  python scripts/post.py --probe       prüft den ganzen Plan, postet nichts
  python scripts/post.py --trocken     zeigt, was jetzt gepostet würde, postet nichts
  python scripts/post.py --vorschau ID zeigt die fertigen Texte eines Beitrags je Kanal
  python scripts/post.py --sofort ID   postet diesen Beitrag sofort (ohne auf die Uhrzeit zu warten)
  python scripts/post.py --jetzt 2026-10-12T19:00   tut so, als wäre es diese Uhrzeit
  python scripts/post.py --ig-token-auffrischen     verlängert das Instagram-Token (wöchentlich)
"""
import argparse
import base64
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
import yaml

try:
    import regex as _re_graphemes
except ImportError:  # pragma: no cover
    _re_graphemes = None

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "posts" / "plan.yaml"
CONFIG = ROOT / "config.yaml"
STATE = ROOT / "state" / "gepostet.json"
BILDER = ROOT / "bilder"

UA = "odin-werbung/1.0 (+https://odin-rpg.pages.dev)"
IG_API = "https://graph.instagram.com/v23.0"
KI_TYPEN = {"cover", "foto", "raster"}


# ----------------------------------------------------------------- Hilfen

def graphemes(s):
    if _re_graphemes:
        return len(_re_graphemes.findall(r"\X", s))
    return len(s)


def show_link(url):
    return re.sub(r"^https?://", "", url).rstrip("/")


def env(*names):
    for n in names:
        v = os.environ.get(n, "").strip()
        if v:
            return v
    return ""


def load_yaml(p):
    return yaml.safe_load(p.read_text(encoding="utf-8"))


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {}


def save_state(st):
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def fill(text, cfg):
    return text.format(**{k: v for k, v in cfg.items() if isinstance(v, str)}).strip()


def hashtags(tags):
    return " ".join("#" + t.lstrip("#") for t in tags)


# ----------------------------------------------------------------- Zeitplan

def due_time(post, lang, cfg):
    tz = ZoneInfo(cfg.get("zeitzone", "Europe/Berlin"))
    if "datum" in post:
        d = date.fromisoformat(str(post["datum"]))
    else:
        d = date.fromisoformat(str(cfg["start"])) + timedelta(days=int(post["tag"]))
    if lang == "en":
        hhmm = post.get("zeit_en") or cfg.get("zeit_en", "21:00")
    else:
        hhmm = post.get("zeit", "18:00")
    h, m = map(int, str(hhmm).split(":"))
    return datetime(d.year, d.month, d.day, h, m, tzinfo=tz)


def blocked(post, cfg):
    if post.get("wartet_auf"):
        return f"wartet auf: {post['wartet_auf']}"
    for key in post.get("braucht", []) or []:
        if not str(cfg.get(key, "")).strip():
            return f"braucht {key} in config.yaml"
    return ""


# ----------------------------------------------------------------- Texte je Kanal

def image_for(post, lang):
    if not post.get("bild"):
        return None, None
    f = BILDER / f"{post['id']}_{lang}.jpg"
    alt = post["bild"].get(f"alt_{lang}") or post["bild"].get("alt_de") or ""
    return f, alt


def is_ki(post):
    return bool(post.get("bild")) and post["bild"].get("typ") in KI_TYPEN


def compose_bluesky(post, lang, cfg, channel):
    p = post[lang]
    body = fill(p["text"], cfg)
    link = p.get("link", "")
    tags = list(cfg.get("tags", {}).get(channel, [])) + list(p.get("tags", []) or [])
    while True:
        parts = [body]
        if link:
            parts.append(show_link(link))
        if tags:
            parts.append(hashtags(tags))
        text = "\n\n".join(parts)
        if graphemes(text) <= 300 or not tags:
            return text
        tags = tags[:-1]


def compose_mastodon(post, lang, cfg, channel):
    p = post[lang]
    parts = [fill(p["text"], cfg)]
    if p.get("mehr"):
        parts.append(fill(p["mehr"], cfg))
    if p.get("link"):
        parts.append(p["link"])
    tags = list(cfg.get("tags", {}).get(channel, [])) + list(p.get("tags", []) or [])
    ki = cfg.get("ki_hinweis", {}).get(channel)
    if ki and is_ki(post):
        tags.append(ki)
    if tags:
        parts.append(hashtags(tags))
    return "\n\n".join(parts)


def mastodon_len(text):
    # Mastodon zählt jede URL als 23 Zeichen
    return len(re.sub(r"https?://\S+", "x" * 23, text))


def compose_discord(post, lang, cfg):
    p = post[lang]
    parts = [fill(p["text"], cfg)]
    if p.get("mehr"):
        parts.append(fill(p["mehr"], cfg))
    return "\n\n".join(parts), p.get("link", "")


def compose_instagram(post, cfg):
    blocks = []
    for lang, bio in (("de", "Link in der Bio."), ("en", "Link in bio.")):
        if lang not in post:
            continue
        p = post[lang]
        t = fill(p["text"], cfg)
        if p.get("mehr"):
            t += "\n\n" + fill(p["mehr"], cfg)
        blocks.append(t + "\n\n" + bio)
    tags = list(cfg.get("tags", {}).get("instagram", []))
    for lang in ("de", "en"):
        for t in (post.get(lang, {}) or {}).get("tags", []) or []:
            if t.lower() not in [x.lower() for x in tags]:
                tags.append(t)
    return "\n\n· · ·\n\n".join(blocks) + "\n\n" + hashtags(tags[:30])


# ----------------------------------------------------------------- Bluesky

class Bluesky:
    def __init__(self, handle, password, service="https://bsky.social"):
        self.service = service.rstrip("/")
        r = requests.post(f"{self.service}/xrpc/com.atproto.server.createSession",
                          json={"identifier": handle, "password": password}, timeout=30)
        r.raise_for_status()
        s = r.json()
        self.did, self.jwt = s["did"], s["accessJwt"]

    def _h(self, extra=None):
        h = {"Authorization": f"Bearer {self.jwt}", "User-Agent": UA}
        h.update(extra or {})
        return h

    def upload(self, path):
        data = Path(path).read_bytes()
        r = requests.post(f"{self.service}/xrpc/com.atproto.repo.uploadBlob", data=data,
                          headers=self._h({"Content-Type": "image/jpeg"}), timeout=60)
        r.raise_for_status()
        return r.json()["blob"]

    @staticmethod
    def facets(text, link):
        out = []
        b = text.encode("utf-8")
        if link:
            shown = show_link(link).encode("utf-8")
            i = b.find(shown)
            if i >= 0:
                out.append({"index": {"byteStart": i, "byteEnd": i + len(shown)},
                            "features": [{"$type": "app.bsky.richtext.facet#link", "uri": link}]})
        for m in re.finditer(r"(?<![\w/])#(\w+)", text):
            start = len(text[:m.start()].encode("utf-8"))
            end = len(text[:m.end()].encode("utf-8"))
            out.append({"index": {"byteStart": start, "byteEnd": end},
                        "features": [{"$type": "app.bsky.richtext.facet#tag", "tag": m.group(1)}]})
        return out

    def post(self, text, lang, link, image=None, alt=""):
        from PIL import Image
        rec = {"$type": "app.bsky.feed.post", "text": text, "langs": [lang],
               "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
               "facets": self.facets(text, link)}
        if image:
            with Image.open(image) as im:
                w, h = im.size
            rec["embed"] = {"$type": "app.bsky.embed.images", "images": [
                {"alt": alt, "image": self.upload(image), "aspectRatio": {"width": w, "height": h}}]}
        r = requests.post(f"{self.service}/xrpc/com.atproto.repo.createRecord",
                          json={"repo": self.did, "collection": "app.bsky.feed.post", "record": rec},
                          headers=self._h(), timeout=30)
        r.raise_for_status()
        uri = r.json()["uri"]
        rkey = uri.rsplit("/", 1)[-1]
        return f"https://bsky.app/profile/{self.did}/post/{rkey}"


# ----------------------------------------------------------------- Mastodon

def mastodon_post(instance, token, text, lang, image=None, alt="", key=""):
    base = instance.rstrip("/")
    if not base.startswith("http"):
        base = "https://" + base
    h = {"Authorization": f"Bearer {token}", "User-Agent": UA}
    media_ids = []
    if image:
        with open(image, "rb") as fh:
            r = requests.post(f"{base}/api/v2/media", headers=h,
                              files={"file": (Path(image).name, fh, "image/jpeg")},
                              data={"description": alt[:1500]}, timeout=120)
        r.raise_for_status()
        m = r.json()
        for _ in range(30):
            if m.get("url"):
                break
            time.sleep(2)
            m = requests.get(f"{base}/api/v1/media/{m['id']}", headers=h, timeout=30).json()
        media_ids.append(m["id"])
    data = {"status": text, "language": lang, "visibility": "public"}
    if media_ids:
        data["media_ids[]"] = media_ids
    r = requests.post(f"{base}/api/v1/statuses", headers={**h, "Idempotency-Key": key or text[:60]},
                      data=data, timeout=60)
    r.raise_for_status()
    return r.json().get("url", "")


# ----------------------------------------------------------------- Discord

def discord_post(webhook, text, link, image=None, alt=""):
    embed = {"description": text[:4000], "color": 0xC0493A}
    if link:
        embed["title"] = show_link(link)
        embed["url"] = link
    payload = {"username": "O.D.I.N. Funkraum", "embeds": [embed], "allowed_mentions": {"parse": []}}
    files = None
    if image:
        name = Path(image).name
        embed["image"] = {"url": f"attachment://{name}"}
        payload["attachments"] = [{"id": 0, "filename": name, "description": alt[:1024]}]
        files = {"files[0]": (name, open(image, "rb"), "image/jpeg")}
    r = requests.post(webhook + ("&" if "?" in webhook else "?") + "wait=true",
                      data={"payload_json": json.dumps(payload)}, files=files, timeout=60)
    r.raise_for_status()
    return f"discord:{r.json().get('id', '')}"


# ----------------------------------------------------------------- Instagram

def instagram_image_url(cfg, fname):
    base = str(cfg.get("bild_url", "")).strip().rstrip("/")
    if not base:
        repo = env("GITHUB_REPOSITORY")
        branch = env("GITHUB_REF_NAME") or "main"
        if not repo:
            raise RuntimeError("bild_url in config.yaml fehlt")
        base = f"https://raw.githubusercontent.com/{repo}/{branch}/bilder"
    return f"{base}/{fname}"


def instagram_post(user_id, token, image_url, caption):
    r = requests.post(f"{IG_API}/{user_id}/media",
                      data={"image_url": image_url, "caption": caption[:2200], "access_token": token}, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"Instagram media: {r.status_code} {r.text[:300]}")
    cid = r.json()["id"]
    for _ in range(30):
        s = requests.get(f"{IG_API}/{cid}", params={"fields": "status_code", "access_token": token},
                         timeout=30).json()
        if s.get("status_code") == "FINISHED":
            break
        if s.get("status_code") == "ERROR":
            raise RuntimeError(f"Instagram-Container fehlerhaft: {s}")
        time.sleep(3)
    r = requests.post(f"{IG_API}/{user_id}/media_publish",
                      data={"creation_id": cid, "access_token": token}, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"Instagram publish: {r.status_code} {r.text[:300]}")
    return f"instagram:{r.json().get('id', '')}"


def instagram_refresh():
    token = env("INSTAGRAM_TOKEN")
    if not token:
        print("Kein INSTAGRAM_TOKEN gesetzt, nichts zu tun.")
        return 0
    r = requests.get("https://graph.instagram.com/refresh_access_token",
                     params={"grant_type": "ig_refresh_token", "access_token": token}, timeout=30)
    if r.status_code >= 400:
        print(f"Auffrischen fehlgeschlagen: {r.status_code} {r.text[:300]}")
        return 1
    new = r.json()["access_token"]
    days = int(r.json().get("expires_in", 0)) // 86400
    print(f"Instagram-Token gültig für weitere {days} Tage.")
    if new == token:
        return 0
    pat, repo = env("GH_PAT"), env("GITHUB_REPOSITORY")
    if not (pat and repo):
        print("Neues Token erhalten, aber GH_PAT fehlt: Secret INSTAGRAM_TOKEN bitte von Hand ersetzen.")
        return 1
    from nacl import encoding, public
    h = {"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github+json"}
    k = requests.get(f"https://api.github.com/repos/{repo}/actions/secrets/public-key", headers=h, timeout=30).json()
    box = public.SealedBox(public.PublicKey(k["key"].encode(), encoding.Base64Encoder()))
    enc = base64.b64encode(box.encrypt(new.encode())).decode()
    r = requests.put(f"https://api.github.com/repos/{repo}/actions/secrets/INSTAGRAM_TOKEN", headers=h,
                     json={"encrypted_value": enc, "key_id": k["key_id"]}, timeout=30)
    r.raise_for_status()
    print("Secret INSTAGRAM_TOKEN aktualisiert.")
    return 0


# ----------------------------------------------------------------- Kanäle

def channels(cfg):
    """Liefert {kanal: (sprache, zugangsdaten oder None)}."""
    on = cfg.get("kanaele", {})
    c = {
        "bluesky_de": ("de", (env("BSKY_DE_HANDLE", "BSKY_HANDLE"), env("BSKY_DE_PASSWORD", "BSKY_PASSWORD"))),
        "bluesky_en": ("en", (env("BSKY_EN_HANDLE", "BSKY_HANDLE"), env("BSKY_EN_PASSWORD", "BSKY_PASSWORD"))),
        "mastodon_de": ("de", (env("MASTODON_DE_INSTANCE"), env("MASTODON_DE_TOKEN"))),
        "mastodon_en": ("en", (env("MASTODON_EN_INSTANCE"), env("MASTODON_EN_TOKEN"))),
        "discord_de": ("de", (env("DISCORD_DE_WEBHOOK"),)),
        "discord_en": ("en", (env("DISCORD_EN_WEBHOOK"),)),
        "instagram": ("ig", (env("INSTAGRAM_USER_ID"), env("INSTAGRAM_TOKEN"))),
    }
    out = {}
    for k, (lang, cred) in c.items():
        if not on.get(k, False):
            continue
        out[k] = (lang, cred if all(cred) else None)
    return out


def post_langs(post, lang, cfg):
    if lang == "ig":
        return "de" if "de" in post else "en"
    return lang


def applies(post, lang):
    if lang == "ig":
        return bool(post.get("bild")) and ("de" in post or "en" in post)
    return lang in post


class Poster:
    def __init__(self, cfg, dry):
        self.cfg, self.dry, self.bsky = cfg, dry, {}

    def send(self, post, channel, lang, cred):
        cfg = self.cfg
        if channel.startswith("bluesky"):
            text = compose_bluesky(post, lang, cfg, channel)
            img, alt = image_for(post, lang)
            if self.dry:
                return "(trocken)"
            key = cred[0]
            if key not in self.bsky:
                self.bsky[key] = Bluesky(*cred, service=env("BSKY_SERVICE") or "https://bsky.social")
            return self.bsky[key].post(text, lang, post[lang].get("link", ""), img, alt)
        if channel.startswith("mastodon"):
            text = compose_mastodon(post, lang, cfg, channel)
            img, alt = image_for(post, lang)
            if self.dry:
                return "(trocken)"
            return mastodon_post(cred[0], cred[1], text, lang, img, alt, key=f"{post['id']}-{channel}")
        if channel.startswith("discord"):
            text, link = compose_discord(post, lang, cfg)
            img, alt = image_for(post, lang)
            if self.dry:
                return "(trocken)"
            return discord_post(cred[0], text, link, img, alt)
        if channel == "instagram":
            il = cfg.get("instagram_bildsprache", "en")
            if il not in post:
                il = "de"
            img, _ = image_for(post, il)
            caption = compose_instagram(post, cfg)
            if self.dry:
                return "(trocken)"
            return instagram_post(cred[0], cred[1], instagram_image_url(cfg, img.name), caption)
        raise ValueError(channel)


# ----------------------------------------------------------------- Läufe

def run(cfg, plan, now, dry, only_id=None):
    st = load_state()
    chans = channels(cfg)
    poster = Poster(cfg, dry)
    maxlate = timedelta(hours=float(cfg.get("max_verspaetung_stunden", 36)))
    per_run = int(cfg.get("max_pro_lauf", 1))
    errors = 0
    for channel, (lang, cred) in chans.items():
        if cred is None:
            print(f"[{channel}] keine Zugangsdaten, übersprungen")
            continue
        sent = 0
        todo = []
        for post in plan["posts"]:
            if only_id and post["id"] != only_id:
                continue
            if not applies(post, lang):
                continue
            if channel in st.get(post["id"], {}):
                continue
            if blocked(post, cfg) and not only_id:
                continue
            due = due_time(post, post_langs(post, lang, cfg), cfg)
            if only_id or due <= now:
                todo.append((due, post))
        todo.sort(key=lambda x: x[0])
        for due, post in todo:
            if sent >= per_run and not only_id:
                break
            if not only_id and now - due > maxlate:
                print(f"[{channel}] {post['id']}: {int((now - due).total_seconds() // 3600)} h zu spät, übersprungen")
                if not dry:
                    st.setdefault(post["id"], {})[channel] = {"zeit": now.isoformat(), "ergebnis": "übersprungen"}
                    save_state(st)
                continue
            l = post_langs(post, lang, cfg) if lang != "ig" else "ig"
            try:
                res = poster.send(post, channel, l, cred)
                print(f"[{channel}] {post['id']}: gepostet {res}")
                if not dry:
                    st.setdefault(post["id"], {})[channel] = {"zeit": now.isoformat(), "ergebnis": res}
                    save_state(st)
                sent += 1
            except Exception as e:  # ein Kanal darf die anderen nicht aufhalten
                errors += 1
                msg = getattr(getattr(e, "response", None), "text", "") or str(e)
                print(f"[{channel}] {post['id']}: FEHLER {msg[:400]}")
                break
    return 1 if errors else 0


def probe(cfg, plan):
    from PIL import Image
    probs, rows = [], []
    ids = set()
    for post in plan["posts"]:
        pid = post["id"]
        if pid in ids:
            probs.append(f"{pid}: id doppelt")
        ids.add(pid)
        if "tag" not in post and "datum" not in post:
            probs.append(f"{pid}: weder tag noch datum")
        for lang in ("de", "en"):
            if lang not in post:
                continue
            p = post[lang]
            if not p.get("text"):
                probs.append(f"{pid}/{lang}: text fehlt")
                continue
            if "—" in p["text"] or "—" in p.get("mehr", ""):
                probs.append(f"{pid}/{lang}: langer Gedankenstrich im Text")
            try:
                for ch in ("bluesky_de" if lang == "de" else "bluesky_en",):
                    t = compose_bluesky(post, lang, cfg, ch)
                    g = graphemes(t)
                    if g > 300:
                        probs.append(f"{pid}/{lang}: Bluesky {g} Zeichen (max 300)")
                    base = "\n\n".join([fill(p["text"], cfg), show_link(p.get("link", ""))])
                    if graphemes(base) > 300:
                        probs.append(f"{pid}/{lang}: Bluesky schon ohne Tags zu lang")
                ch = "mastodon_de" if lang == "de" else "mastodon_en"
                ml = mastodon_len(compose_mastodon(post, lang, cfg, ch))
                if ml > 500:
                    probs.append(f"{pid}/{lang}: Mastodon {ml} Zeichen (max 500)")
            except KeyError as e:
                if not blocked(post, cfg):
                    probs.append(f"{pid}/{lang}: Platzhalter {e} fehlt in config.yaml")
            img, alt = image_for(post, lang)
            if img:
                if not img.exists():
                    probs.append(f"{pid}/{lang}: Bild {img.name} fehlt (python werkzeug/karten.py)")
                else:
                    if img.stat().st_size >= 1_000_000:
                        probs.append(f"{pid}/{lang}: Bild über 1 MB")
                    with Image.open(img) as im:
                        if im.format != "JPEG":
                            probs.append(f"{pid}/{lang}: Bild ist kein JPEG")
                        r = im.width / im.height
                        if not (0.8 <= r <= 1.91):
                            probs.append(f"{pid}/{lang}: Seitenverhältnis {r:.2f} passt nicht zu Instagram")
                if not alt:
                    probs.append(f"{pid}/{lang}: Alt-Text fehlt")
            rows.append((due_time(post, lang, cfg), pid, lang, blocked(post, cfg)))
        if post.get("bild"):
            cap = compose_instagram(post, cfg)
            if len(cap) > 2200:
                probs.append(f"{pid}: Instagram-Text {len(cap)} Zeichen (max 2200)")
    rows.sort()
    print("Zeitplan:")
    for due, pid, lang, bl in rows:
        print(f"  {due:%a %d.%m.%Y %H:%M}  {lang}  {pid}" + (f"   [{bl}]" if bl else ""))
    chans = channels(cfg)
    print("\nKanäle:")
    for k in ("bluesky_de", "bluesky_en", "mastodon_de", "mastodon_en", "discord_de", "discord_en", "instagram"):
        if k not in chans:
            print(f"  {k:12s} aus (config.yaml)")
        else:
            print(f"  {k:12s} {'bereit' if chans[k][1] else 'an, aber Zugangsdaten fehlen'}")
    if probs:
        print("\nProbleme:")
        for p in probs:
            print("  - " + p)
        return 1
    print(f"\nAlles in Ordnung: {len(plan['posts'])} Beiträge geprüft.")
    return 0


def preview(cfg, plan, pid):
    post = next((p for p in plan["posts"] if p["id"] == pid), None)
    if not post:
        print(f"{pid} nicht gefunden")
        return 1
    for lang in ("de", "en"):
        if lang not in post:
            continue
        b = compose_bluesky(post, lang, cfg, f"bluesky_{lang}")
        m = compose_mastodon(post, lang, cfg, f"mastodon_{lang}")
        d, _ = compose_discord(post, lang, cfg)
        print(f"===== Bluesky {lang} ({graphemes(b)}/300)\n{b}\n")
        print(f"===== Mastodon {lang} ({mastodon_len(m)}/500)\n{m}\n")
        print(f"===== Discord {lang}\n{d}\n")
    if post.get("bild"):
        print(f"===== Instagram\n{compose_instagram(post, cfg)}\n")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--trocken", action="store_true")
    ap.add_argument("--vorschau")
    ap.add_argument("--sofort")
    ap.add_argument("--jetzt")
    ap.add_argument("--ig-token-auffrischen", action="store_true")
    a = ap.parse_args()
    cfg, plan = load_yaml(CONFIG), load_yaml(PLAN)
    tz = ZoneInfo(cfg.get("zeitzone", "Europe/Berlin"))
    now = datetime.fromisoformat(a.jetzt).replace(tzinfo=tz) if a.jetzt else datetime.now(tz)
    if a.ig_token_auffrischen:
        return instagram_refresh()
    if a.probe:
        return probe(cfg, plan)
    if a.vorschau:
        return preview(cfg, plan, a.vorschau)
    return run(cfg, plan, now, dry=a.trocken, only_id=a.sofort)


if __name__ == "__main__":
    sys.exit(main())
