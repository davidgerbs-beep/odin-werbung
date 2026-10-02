"""Tumblr-NPF-Video: prüft den tatsächlich erzeugten Multipart-Body gegen die Tumblr-API-Doku
und den Rückfall auf Bild als Warnung (Exit-Code 0). Postet nichts, requests.post ist gemockt.

Doku: https://github.com/tumblr/docs/blob/master/api.md, Abschnitt "User Uploaded Media",
und npf-spec.md, Abschnitt "Content Block Type: Video".

  python -m unittest discover tests
"""
import json
import struct
import sys
import tempfile
import unittest
from datetime import datetime
from email.parser import BytesParser
from email.policy import HTTP
from pathlib import Path
from unittest import mock
from zoneinfo import ZoneInfo

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import post as P  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CFG = {"tumblr_blog": "testblog", "tumblr_sprache": "en", "bild_url": "https://example.org/bilder",
       "tags": {"tumblr": ["ttrpg"]}, "zeitzone": "Europe/Berlin", "start": "2026-09-23",
       "kanaele": {"tumblr": True}, "max_pro_lauf": 1}
POST = {"id": "t01", "tag": 0, "zeit_en": "21:00", "bild": {"typ": "karte", "alt_en": "Alt"},
        "en": {"text": "Erster Absatz.", "link": "https://odin-rpg.pages.dev/", "tags": ["horror rpg"]}}
CRED = ("ck", "cs", "tok", "ts")


def box(typ, inhalt):
    return struct.pack(">I4s", 8 + len(inhalt), typ) + inhalt


def mini_mp4(breite=1080, hoehe=1920, dauer_ms=10000, version=0):
    """Kleinste MP4-Boxstruktur, die mp4_masse braucht: ftyp, moov mit mvhd, Tonspur zuerst, dann Videospur."""
    if version == 1:
        mvhd = bytes([1, 0, 0, 0]) + bytes(16) + struct.pack(">IQ", 1000, dauer_ms) + bytes(80)
    else:
        mvhd = bytes(4) + bytes(8) + struct.pack(">II", 1000, dauer_ms) + bytes(80)

    def tkhd(w, h):
        kopf = bytes([version, 0, 0, 3]) + bytes(32 if version == 1 else 20)
        return box(b"tkhd", kopf + bytes(52) + struct.pack(">II", w << 16, h << 16))

    ton = box(b"trak", tkhd(0, 0))
    bild = box(b"trak", tkhd(breite, hoehe))
    return box(b"ftyp", b"isom" + bytes(4)) + box(b"moov", box(b"mvhd", mvhd) + ton + bild) + box(b"mdat", b"x" * 64)


def antwort(status=201, id_string="123"):
    r = mock.Mock(status_code=status, text='{"meta":{"status":%d}}' % status)
    r.json.return_value = {"response": {"id_string": id_string}}
    return r


class Mp4MasseTest(unittest.TestCase):
    def test_echtes_reel_aus_dem_repo(self):
        self.assertEqual(P.mp4_masse(ROOT / "bilder" / "w02-psion_en.mp4"), (1080, 1920, 10000))

    def test_tonspur_wird_uebersprungen_und_version_1(self):
        with tempfile.TemporaryDirectory() as d:
            for version in (0, 1):
                f = Path(d) / f"v{version}.mp4"
                f.write_bytes(mini_mp4(720, 1280, 25740, version))
                self.assertEqual(P.mp4_masse(f), (720, 1280, 25740))

    def test_kaputte_datei_liefert_none(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "kaputt.mp4"
            f.write_bytes(b"keine mp4")
            self.assertEqual(P.mp4_masse(f), (None, None, None))


class MultipartDokuTest(unittest.TestCase):
    """Baut den Request so, wie requests ihn wirklich verschickt (inklusive OAuth1), und zerlegt ihn wieder."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.video = Path(self.tmp.name) / "w02-psion_en.mp4"
        self.daten = mini_mp4()
        self.video.write_bytes(self.daten)

    def tearDown(self):
        self.tmp.cleanup()

    def senden(self):
        gesendet = {}

        def fake_post(url, files=None, auth=None, timeout=None, **kw):
            req = requests.Request("POST", url, files=files, auth=auth).prepare()
            # requests_oauthlib liefert Header teils als bytes, hier einheitlich als str
            headers = {k: v.decode() if isinstance(v, bytes) else v for k, v in req.headers.items()}
            gesendet.update(url=url, headers=headers, body=req.body)
            return antwort(id_string="555")

        content, tags = P.compose_tumblr_npf(POST, "en", CFG)
        with mock.patch.object(P.requests, "post", side_effect=fake_post):
            res = P.tumblr_video_post("testblog", CRED, content, ["ttrpg", "horror rpg"], self.video)
        self.assertEqual(res, "tumblr:555")
        return gesendet

    def teile(self, gesendet):
        ctype = gesendet["headers"]["Content-Type"]
        msg = BytesParser(policy=HTTP).parsebytes(b"Content-Type: " + ctype.encode() + b"\r\n\r\n" + gesendet["body"])
        self.assertTrue(msg.is_multipart())
        return list(msg.iter_parts())

    def test_endpunkt_header_und_oauth(self):
        g = self.senden()
        self.assertEqual(g["url"], "https://api.tumblr.com/v2/blog/testblog/posts")
        self.assertTrue(g["headers"]["Content-Type"].startswith("multipart/form-data; boundary="))
        self.assertTrue(g["headers"]["Authorization"].startswith("OAuth "))

    def test_erster_teil_json_nach_doku(self):
        teile = self.teile(self.senden())
        self.assertEqual(len(teile), 2)
        js = teile[0]
        self.assertEqual(js.get_param("name", header="content-disposition"), "json")
        self.assertIsNone(js.get_filename())
        self.assertEqual(js.get_content_type(), "application/json")
        body = json.loads(js.get_payload(decode=True))
        self.assertIsInstance(body["content"], list)
        self.assertEqual(body["tags"], "ttrpg,horror rpg")
        video = body["content"][0]
        self.assertEqual(video["type"], "video")
        self.assertEqual(video["provider"], "tumblr")
        # npf-spec: video.media ist ein Media-Objekt (keine Liste wie bei image)
        self.assertIsInstance(video["media"], dict)
        self.assertEqual(video["media"]["type"], "video/mp4")
        self.assertEqual((video["media"]["width"], video["media"]["height"]), (1080, 1920))
        self.assertEqual(video["duration"], 10000)
        self.assertTrue(all(b["type"] == "text" for b in body["content"][1:]))

    def test_datei_teil_heisst_wie_der_identifier(self):
        teile = self.teile(self.senden())
        body = json.loads(teile[0].get_payload(decode=True))
        ident = body["content"][0]["media"]["identifier"]
        self.assertRegex(ident, r"^[a-z0-9-]+$")
        datei = teile[1]
        self.assertEqual(datei.get_param("name", header="content-disposition"), ident)
        self.assertEqual(datei.get_filename(), "w02-psion_en.mp4")
        self.assertEqual(datei.get_content_type(), "video/mp4")
        self.assertEqual(datei.get_payload(decode=True), self.daten)


class RueckfallWarnungTest(unittest.TestCase):
    """Rückfall auf Bild: Warnung in Log und Zusammenfassung, Lauf endet mit 0."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        d = Path(self.tmp.name)
        (d / "t01_en.jpg").write_bytes(b"jpg")
        (d / "t01_en.mp4").write_bytes(mini_mp4())
        self.summary = d / "summary.md"
        self.state = d / "gepostet.json"
        self.patches = [
            mock.patch.object(P, "BILDER", d),
            mock.patch.object(P, "STATE", self.state),
            mock.patch.dict("os.environ", {"TUMBLR_CONSUMER_KEY": "ck", "TUMBLR_CONSUMER_SECRET": "cs",
                                           "TUMBLR_TOKEN": "tok", "TUMBLR_TOKEN_SECRET": "ts",
                                           "GITHUB_ACTIONS": "true", "GITHUB_STEP_SUMMARY": str(self.summary)}),
        ]
        for p in self.patches:
            p.start()
        self.jetzt = datetime(2026, 9, 23, 21, 7, tzinfo=ZoneInfo("Europe/Berlin"))

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def test_rueckfall_ist_warnung_exit_0(self):
        with mock.patch.object(P.requests, "post", side_effect=[antwort(status=400), antwort(id_string="9")]), \
                mock.patch("builtins.print") as pr:
            code = P.run(CFG, {"posts": [POST]}, self.jetzt, dry=False)
        self.assertEqual(code, 0)
        log = [c.args[0] for c in pr.call_args_list]
        self.assertTrue(any(z.startswith("::warning::[tumblr] t01: Video-Post fehlgeschlagen") for z in log))
        self.assertFalse(any("FEHLER" in z for z in log))
        st = json.loads(self.state.read_text(encoding="utf-8"))
        self.assertEqual(st["t01"]["tumblr"]["ergebnis"], "tumblr:9 (Rückfall auf Bild)")
        text = self.summary.read_text(encoding="utf-8")
        self.assertIn("**Warnungen**", text)
        self.assertIn("Video-Post fehlgeschlagen", text)
        self.assertNotIn("**Fehler**", text)

    def test_echter_fehler_bleibt_rot(self):
        with mock.patch.object(P.requests, "post", side_effect=[antwort(status=400), antwort(status=500)]), \
                mock.patch("builtins.print"):
            code = P.run(CFG, {"posts": [POST]}, self.jetzt, dry=False)
        self.assertEqual(code, 1)
        self.assertFalse(self.state.exists())
        text = self.summary.read_text(encoding="utf-8")
        self.assertIn("**Fehler**", text)
        self.assertIn("**Warnungen**", text)


if __name__ == "__main__":
    unittest.main()
