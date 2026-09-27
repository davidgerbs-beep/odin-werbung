"""Tumblr: Video-Post (NPF) bei vorhandener MP4, sonst Foto-Post. Postet nichts, requests.post ist gemockt.

  python -m unittest discover tests
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import post as P  # noqa: E402

CFG = {"tumblr_blog": "testblog", "tumblr_sprache": "en", "bild_url": "https://example.org/bilder",
       "tags": {"tumblr": ["ttrpg"]}}
POST = {"id": "t01", "bild": {"typ": "karte", "alt_en": "Alt"},
        "en": {"text": "Erster Absatz.\n\nZweiter Absatz.", "link": "https://odin-rpg.pages.dev/", "tags": ["horror rpg"]}}
CRED = ("ck", "cs", "tok", "ts")


def antwort(status=201, id_string="123"):
    r = mock.Mock(status_code=status, text="")
    r.json.return_value = {"response": {"id_string": id_string}}
    return r


class TumblrTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.bilder = Path(self.tmp.name)
        (self.bilder / "t01_en.jpg").write_bytes(b"jpg")
        self.patch = mock.patch.object(P, "BILDER", self.bilder)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def test_mit_mp4_npf_video_post(self):
        (self.bilder / "t01_en.mp4").write_bytes(b"mp4-daten")
        with mock.patch.object(P.requests, "post", return_value=antwort(id_string="777")) as m:
            res = P.Poster(CFG, dry=False).send(POST, "tumblr", "en", CRED)
        self.assertEqual(res, "tumblr:777")
        self.assertEqual(m.call_count, 1)
        args, kw = m.call_args
        self.assertEqual(args[0], "https://api.tumblr.com/v2/blog/testblog/posts")
        self.assertNotIn("data", kw)
        files = kw["files"]
        # JSON-Teil
        _, raw, ctype = files["json"]
        self.assertEqual(ctype, "application/json")
        body = json.loads(raw)
        video = body["content"][0]
        self.assertEqual(video["type"], "video")
        ident = video["media"][0]["identifier"]
        texte = [b["text"] for b in body["content"][1:]]
        self.assertEqual(texte[:2], ["Erster Absatz.", "Zweiter Absatz."])
        link = body["content"][3]
        self.assertEqual(link["formatting"][0]["type"], "link")
        self.assertEqual(link["formatting"][0]["url"], "https://odin-rpg.pages.dev/")
        self.assertEqual(body["tags"], "ttrpg,horror rpg")
        # Datei-Teil mit demselben identifier
        name, fh, ctype = files[ident]
        self.assertEqual(name, "t01_en.mp4")
        self.assertEqual(ctype, "video/mp4")
        self.assertIsNotNone(kw.get("auth"))

    def test_ohne_mp4_foto_post(self):
        with mock.patch.object(P.requests, "post", return_value=antwort(id_string="42")) as m:
            res = P.Poster(CFG, dry=False).send(POST, "tumblr", "en", CRED)
        self.assertEqual(res, "tumblr:42")
        self.assertEqual(m.call_count, 1)
        args, kw = m.call_args
        self.assertEqual(args[0], "https://api.tumblr.com/v2/blog/testblog/post")
        self.assertNotIn("files", kw)
        self.assertEqual(kw["data"]["type"], "photo")
        self.assertEqual(kw["data"]["source"], "https://example.org/bilder/t01_en.jpg")

    def test_video_fehler_faellt_auf_foto_zurueck(self):
        (self.bilder / "t01_en.mp4").write_bytes(b"mp4-daten")
        with mock.patch.object(P.requests, "post", side_effect=[antwort(status=400), antwort(id_string="9")]) as m, \
                mock.patch("builtins.print") as pr:
            res = P.Poster(CFG, dry=False).send(POST, "tumblr", "en", CRED)
        self.assertEqual(res, "tumblr:9")
        self.assertEqual(m.call_count, 2)
        self.assertTrue(m.call_args_list[0].args[0].endswith("/posts"))
        self.assertEqual(m.call_args_list[1].kwargs["data"]["type"], "photo")
        self.assertIn("Video-Post fehlgeschlagen", pr.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
