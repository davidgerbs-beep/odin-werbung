#!/usr/bin/env python3
"""Einmalige Tumblr-Anmeldung (OAuth 1.0a) ohne API-Konsole.

Schritt 1 (ohne --verifier): holt ein Request-Token, legt es als Secret ab und gibt den
Freigabe-Link aus. Nach „Allow“ leitet Tumblr auf odin-rpg.pages.dev/?oauth_token=…&oauth_verifier=… weiter.
Schritt 2 (--verifier …): tauscht gegen Token und Token Secret und schreibt beide als
Secrets TUMBLR_TOKEN und TUMBLR_TOKEN_SECRET. Kein Wert wird im Log ausgegeben.
"""
import argparse, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post import env, secret_setzen  # noqa: E402
from requests_oauthlib import OAuth1Session  # noqa: E402

CALLBACK = "https://odin-rpg.pages.dev/"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verifier", default="")
    a = ap.parse_args()
    ck, cs = env("TUMBLR_CONSUMER_KEY"), env("TUMBLR_CONSUMER_SECRET")
    if not (ck and cs):
        print("TUMBLR_CONSUMER_KEY oder TUMBLR_CONSUMER_SECRET fehlt.")
        return 1
    v = a.verifier.strip()
    if "oauth_verifier=" in v:  # ganze Adresse eingefügt
        v = v.split("oauth_verifier=", 1)[1].split("&")[0].split("#")[0]
    if not v:
        import hashlib
        fp = lambda x: hashlib.sha256(x.encode()).hexdigest()[:6]
        print(f"Fingerabdruck Key {fp(ck)}, Secret {fp(cs)}")
        print(f"Consumer Key: {len(ck)} Zeichen, Secret: {len(cs)} Zeichen "
              f"(erwartet je 50; Sonderzeichen im Key: {sorted(set(c for c in ck if not c.isalnum()))}, "
              f"im Secret: {sorted(set(c for c in cs if not c.isalnum()))})")
        r = None
        for cb, meth in ((None, "POST"), (CALLBACK, "POST"), (None, "GET"), (CALLBACK, "GET")):
            s = OAuth1Session(ck, client_secret=cs, callback_uri=cb)
            try:
                if meth == "POST":
                    r = s.fetch_request_token("https://www.tumblr.com/oauth/request_token")
                else:
                    g = s.get("https://www.tumblr.com/oauth/request_token", timeout=30)
                    if g.status_code >= 400:
                        raise RuntimeError(f"{g.status_code} {g.text}")
                    r = dict(x.split("=", 1) for x in g.text.strip().split("&"))
                print(f"Request-Token erhalten (Callback {'ja' if cb else 'nein'}, {meth}).")
                break
            except Exception as e:
                print(f"Versuch Callback {'ja' if cb else 'nein'} {meth}: {str(e)[:160]}")
        if r is None:
            return 1
        secret_setzen("TUMBLR_REQ_TOKEN", r["oauth_token"])
        secret_setzen("TUMBLR_REQ_SECRET", r["oauth_token_secret"])
        print("Freigabe-Link (öffnen, „Allow“ klicken):")
        print("https://www.tumblr.com/oauth/authorize?oauth_token=" + r["oauth_token"])
        return 0
    rt, rs = env("TUMBLR_REQ_TOKEN"), env("TUMBLR_REQ_SECRET")
    if not (rt and rs):
        print("Erst Schritt 1 ausführen (ohne Verifier).")
        return 1
    s = OAuth1Session(ck, client_secret=cs, resource_owner_key=rt,
                      resource_owner_secret=rs, verifier=v)
    t = s.fetch_access_token("https://www.tumblr.com/oauth/access_token")
    ok = secret_setzen("TUMBLR_TOKEN", t["oauth_token"])
    ok = secret_setzen("TUMBLR_TOKEN_SECRET", t["oauth_token_secret"]) and ok
    secret_setzen("TUMBLR_REQ_TOKEN", "-")
    secret_setzen("TUMBLR_REQ_SECRET", "-")
    print("Tumblr angemeldet." if ok else "Token erhalten, Secrets konnten nicht gesetzt werden.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
