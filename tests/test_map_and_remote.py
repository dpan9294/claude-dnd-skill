"""Dungeon map (map.py + /map) and remote-play gate (--tunnel) tests."""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DISPLAY = ROOT / "skills" / "dnd" / "display"


def _fresh_env(tmp: str) -> None:
    os.environ["DND_CAMPAIGN_ROOT"] = tmp
    os.environ["DND_RUNTIME_DIR"] = os.path.join(tmp, ".runtime")
    for mod in ("runtime_paths", "paths"):
        sys.modules.pop(mod, None)


def _load(path: pathlib.Path, name: str):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


class _EnvCase(unittest.TestCase):
    def setUp(self) -> None:
        self._saved = {k: os.environ.get(k) for k in ("DND_CAMPAIGN_ROOT", "DND_RUNTIME_DIR")}
        self.tmp = tempfile.mkdtemp()
        _fresh_env(self.tmp)

    def tearDown(self) -> None:
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        for mod in ("runtime_paths", "paths"):
            sys.modules.pop(mod, None)


class MapCliTests(_EnvCase):
    def setUp(self) -> None:
        super().setUp()
        self.map = _load(DISPLAY / "map.py", "dnd_map_cli")
        self.camp = "testcamp"

    def run_cmd(self, *args):
        return self.map.main(["--campaign", self.camp, "--no-push", *args])

    def state(self):
        return self.map.load(self.camp)

    def test_build_and_mutate(self):
        self.run_cmd("init", "--title", "Яма", "--w", "20", "--h", "10")
        self.run_cmd("room", "c1", "1", "1", "10", "2", "--name", "Коридор")
        self.run_cmd("room", "r2", "1", "4", "4", "4", "--hidden")
        self.run_cmd("door", "1", "4", "h", "--state", "locked", "--kind", "wood", "--hidden")
        self.run_cmd("brazier", "b1", "9", "1", "--name", "жаровня")
        self.run_cmd("light", "b1")
        self.run_cmd("hero", "Діма", "2", "1", "--light", "4")
        self.run_cmd("hero", "діма", "3", "1")          # case-insensitive move
        self.run_cmd("mark", "5", "1", "--icon", "☠", "--label", "Згаслий")
        self.run_cmd("dead", "5", "1", "Згаслий")         # replaces the live marker
        self.run_cmd("stain", "Ілля", "6", "2", "20 зм")
        self.run_cmd("stain", "Ілля", "7", "2", "5 зм")   # new death erases the old stain
        self.run_cmd("reveal", "r2")
        self.run_cmd("log", "Перший", "запис")
        s = self.state()
        self.assertEqual(s["title"], "Яма")
        self.assertEqual(len(s["heroes"]), 1)
        self.assertEqual((s["heroes"][0]["x"], s["heroes"][0]["light"]), (3, 4))
        self.assertTrue(s["braziers"][0]["lit"])
        marks = [m for m in s["marks"] if m["x"] == 5]
        self.assertEqual([m.get("kind") for m in marks], ["dead"])
        self.assertEqual(s["stains"], [{"who": "Ілля", "x": 7, "y": 2, "gold": "5 зм"}])
        self.assertTrue(next(r for r in s["rooms"] if r["id"] == "r2")["rev"])
        self.assertTrue(s["doors"][0]["rev"], "revealing a room reveals its doors")
        self.assertEqual(s["log"], ["Перший запис"])
        path = pathlib.Path(self.tmp) / "campaigns" / self.camp / "map.json"
        self.assertTrue(path.exists())
        json.loads(path.read_text(encoding="utf-8"))

    def test_unstain_and_unmark(self):
        self.run_cmd("stain", "Діма", "1", "1", "3 зм")
        self.run_cmd("unstain", "ДІМА")
        self.run_cmd("mark", "2", "2", "--label", "ключ")
        self.run_cmd("unmark", "Ключ")
        s = self.state()
        self.assertEqual(s["stains"], [])
        self.assertEqual(s["marks"], [])


class DisplayAppTests(_EnvCase):
    def setUp(self) -> None:
        super().setUp()
        try:
            import flask  # noqa: F401
            import flask_cors  # noqa: F401
        except ImportError:
            self.skipTest("flask not installed")
        self.app_mod = _load(DISPLAY / "dnd-display-app.py", "dnd_display_app_maptest")
        self.client = self.app_mod.app.test_client()
        self.rt = pathlib.Path(os.environ["DND_RUNTIME_DIR"])

    TUNNEL = {"Cf-Connecting-Ip": "203.0.113.7", "Cf-Ray": "abc"}

    def test_map_roundtrip_local(self):
        r = self.client.post("/map", data=json.dumps({"title": "Яма", "rooms": []}),
                             content_type="application/json")
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.client.get("/map").get_json()["title"], "Яма")

    def test_map_rejects_non_object(self):
        r = self.client.post("/map", data="[1,2]", content_type="application/json")
        self.assertEqual(r.status_code, 400)

    def test_tunnel_refused_without_key(self):
        r = self.client.get("/", headers=self.TUNNEL)
        self.assertEqual(r.status_code, 403)

    def test_tunnel_requires_invite_then_limits_endpoints(self):
        self.rt.mkdir(parents=True, exist_ok=True)
        (self.rt / ".tunnel_key").write_text("sekret-key-123", encoding="utf-8")
        # no cookie yet
        self.assertEqual(self.client.get("/", headers=self.TUNNEL).status_code, 403)
        # wrong key
        self.assertEqual(self.client.get("/join?key=nope", headers=self.TUNNEL).status_code, 403)
        # right key → cookie + redirect to phone view
        r = self.client.get("/join?key=sekret-key-123", headers=self.TUNNEL)
        self.assertEqual(r.status_code, 302)
        self.assertIn("view=input", r.headers["Location"])
        # player endpoints now reachable
        self.assertEqual(self.client.get("/", headers=self.TUNNEL).status_code, 200)
        self.assertEqual(self.client.get("/map", headers=self.TUNNEL).status_code, 200)
        # DM-only endpoints stay closed to remote players
        for path in ("/map", "/chunk", "/stats", "/clear", "/dice-request", "/player-input/drain"):
            r = self.client.post(path, data="{}", content_type="application/json", headers=self.TUNNEL)
            self.assertEqual(r.status_code, 403, path)

    def test_local_requests_unaffected_by_tunnel_key(self):
        self.rt.mkdir(parents=True, exist_ok=True)
        (self.rt / ".tunnel_key").write_text("k", encoding="utf-8")
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_character_route_accepts_cyrillic(self):
        camp_dir = pathlib.Path(self.tmp) / "campaigns" / "yama" / "characters"
        camp_dir.mkdir(parents=True)
        (camp_dir / "Діма.md").write_text("# Діма\n", encoding="utf-8")
        (self.rt).mkdir(parents=True, exist_ok=True)
        pathlib.Path(self.app_mod.CAMP_FILE).write_text("yama", encoding="utf-8")
        r = self.client.get("/character/Діма")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Діма", r.get_data(as_text=True))
        self.assertEqual(self.client.get("/character/..%2F..%2Fx").status_code, 404)


if __name__ == "__main__":
    unittest.main()
