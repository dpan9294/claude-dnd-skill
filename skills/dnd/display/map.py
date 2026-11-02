#!/usr/bin/env python3
"""map.py — the DM's dungeon map.

The map is a small JSON document stored with the campaign
(<campaign>/map.json) and mirrored to the display companion, which renders it
on the TV (🗺 button) and on every phone (Map tab): stone floor, walls, doors,
braziers with firelight, fog over unexplored areas, hero tokens, markers,
fallen enemies and Dark-Souls-style bloodstains with dropped gold.

Every mutating command saves the campaign file and pushes the new state to the
display (silently skipped when the display isn't running). Run with --help for
the full command list; SKILL-scripts.md documents the DM workflow.

Coordinates are grid cells (1 cell = 5 ft). x grows east, y grows south.

Examples:
    map.py init --title "Вугільна Яма" --area "Ярус I" --w 34 --h 26
    map.py room cells 4 10 26 2 --name "Камерний коридор"
    map.py door 30 10 v --state locked --kind bars
    map.py brazier b1 27 10 --name "жаровня камер" --lit
    map.py hero Діма 26 11 --light 4
    map.py mark 3 10 --icon "?" --label "шкребіння за рогом"
    map.py dead 7 10 "Згаслий"
    map.py stain Ілля 12 18 "20 зм"
    map.py where "Камерний коридор. Бій!"
    map.py log "Діма запалив жаровню."
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

for _s in (sys.stdin, sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_HERE, os.pardir, "scripts"))
from runtime_paths import rt  # noqa: E402

try:
    from paths import campaign_dir  # noqa: E402
except Exception:  # pragma: no cover - fallback mirrors paths.py
    import pathlib

    def campaign_dir(name: str):
        root = os.environ.get("DND_CAMPAIGN_ROOT", "").strip() or "~/.claude/dnd"
        return pathlib.Path(root).expanduser() / "campaigns" / name


LOG_KEEP = 40          # journal lines kept in the map document
DOOR_STATES = ("open", "closed", "locked", "broken")


# ── campaign + file helpers ──────────────────────────────────────────────────

def _active_campaign() -> str:
    for path in (rt("active-campaign.json"),):
        try:
            with open(path, encoding="utf-8") as f:
                name = (json.load(f) or {}).get("name", "")
            if name:
                return name
        except Exception:
            pass
    try:
        return open(rt(".campaign"), encoding="utf-8").read().strip()
    except Exception:
        return ""


def _map_path(campaign: str):
    return campaign_dir(campaign) / "map.json"


def _blank(title: str = "", area: str = "", w: int = 40, h: int = 28) -> dict:
    return {
        "title": title, "area": area, "where": "", "grid": {"w": w, "h": h},
        "rooms": [], "doors": [], "braziers": [], "marks": [], "heroes": [],
        "stains": [], "log": [],
    }


def load(campaign: str) -> dict:
    p = _map_path(campaign)
    if not p.exists():
        return _blank()
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    base = _blank()
    base.update(data if isinstance(data, dict) else {})
    for k in ("rooms", "doors", "braziers", "marks", "heroes", "stains", "log"):
        if not isinstance(base.get(k), list):
            base[k] = []
    return base


def save(campaign: str, m: dict) -> None:
    m["updated"] = int(time.time() * 1000)
    p = _map_path(campaign)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p)


def push(m: dict) -> bool:
    """POST the map to the display. Returns False when the display is offline."""
    scheme_file = os.path.join(_HERE, ".scheme")
    scheme = "http"
    if os.path.exists(scheme_file):
        scheme = open(scheme_file, encoding="utf-8").read().strip() or "http"
    ctx = None
    if scheme == "https":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    headers = {"Content-Type": "application/json"}
    try:
        token = open(rt(".token"), encoding="utf-8").read().strip()
        if token:
            headers["X-DND-Token"] = token
    except OSError:
        pass
    req = urllib.request.Request(f"{scheme}://localhost:5001/map",
                                 data=json.dumps(m, ensure_ascii=False).encode("utf-8"),
                                 headers=headers, method="POST")
    try:
        urllib.request.urlopen(req, timeout=5, context=ctx)
        return True
    except urllib.error.HTTPError as e:
        print(f"map.py: display rejected the map (HTTP {e.code})", file=sys.stderr)
    except Exception:
        pass   # display not running — the campaign file is still saved
    return False


# ── small lookups ────────────────────────────────────────────────────────────

def _find(items: list, **kv):
    for it in items:
        if all(it.get(k) == v for k, v in kv.items()):
            return it
    return None


def _norm(s: str) -> str:
    return (s or "").strip().casefold()


# ── commands ─────────────────────────────────────────────────────────────────

def cmd_show(m: dict, a) -> bool:
    if a.json:
        print(json.dumps(m, ensure_ascii=False, indent=1))
        return False
    print(f"{m.get('title') or '(untitled)'} — {m.get('area') or ''}  grid {m['grid'].get('w')}×{m['grid'].get('h')}")
    if m.get("where"):
        print(f"Where: {m['where']}")
    print("Heroes:  " + (", ".join(f"{h['name']}@{h['x']},{h['y']}" + (f" light {h['light']}" if h.get('light') else "")
                                    for h in m["heroes"]) or "—"))
    print("Rooms:   " + (", ".join(f"{r['id']}{'' if r.get('rev') else '(hidden)'}" for r in m["rooms"]) or "—"))
    print("Braziers:" + " " + (", ".join(f"{b['id']}{'🔥' if b.get('lit') else '·'}@{b['x']},{b['y']}" for b in m["braziers"]) or "—"))
    alive = [mk for mk in m["marks"] if mk.get("kind") != "dead"]
    dead = [mk for mk in m["marks"] if mk.get("kind") == "dead"]
    print("Marks:   " + (", ".join(f"{mk.get('icon','?')} {mk.get('label','')}@{mk['x']},{mk['y']}" for mk in alive) or "—"))
    print("Fallen:  " + (", ".join(f"{mk.get('label','')}@{mk['x']},{mk['y']}" for mk in dead) or "—"))
    print("Stains:  " + (", ".join(f"{s['who']} {s.get('gold','')}@{s['x']},{s['y']}" for s in m["stains"]) or "—"))
    return False


def cmd_init(m: dict, a) -> dict:
    return _blank(a.title or "", a.area or "", a.w, a.h)


def cmd_import(m: dict, a) -> dict:
    with open(a.file, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "data" in data and "rooms" not in data:
        data = data["data"]          # tolerate {"data": {...}} exports
    if not isinstance(data, dict):
        sys.exit("map.py: import file must contain a JSON object")
    base = _blank()
    base.update(data)
    return base


def cmd_export(m: dict, a) -> bool:
    with open(a.file, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    print(f"Exported to {a.file}")
    return False


def cmd_room(m: dict, a) -> dict:
    r = _find(m["rooms"], id=a.id)
    if r is None:
        r = {"id": a.id}
        m["rooms"].append(r)
    r.update({"x": a.x, "y": a.y, "w": a.w, "h": a.h, "rev": not a.hidden})
    if a.name is not None:
        r["name"] = a.name
    if a.no_label:
        r["label"] = False
    for k in ("fs", "lx", "ly"):
        v = getattr(a, k)
        if v is not None:
            r[k] = v
    return m


def cmd_reveal(m: dict, a, value: bool = True) -> dict:
    for rid in a.ids:
        r = _find(m["rooms"], id=rid)
        if r is None:
            sys.exit(f"map.py: no room '{rid}'")
        r["rev"] = value
        # doors on a revealed room's edge become visible too
        if value:
            for d in m["doors"]:
                if r["x"] - 1 <= d["x"] <= r["x"] + r["w"] and r["y"] - 1 <= d["y"] <= r["y"] + r["h"]:
                    d["rev"] = True
    return m


def cmd_door(m: dict, a) -> dict:
    d = _find(m["doors"], x=a.x, y=a.y, dir=a.dir)
    if d is None:
        d = {"x": a.x, "y": a.y, "dir": a.dir, "state": "closed", "kind": "wood", "rev": True}
        m["doors"].append(d)
    if a.state:
        d["state"] = a.state
    if a.kind:
        d["kind"] = a.kind
    d["rev"] = not a.hidden
    return m


def cmd_brazier(m: dict, a) -> dict:
    b = _find(m["braziers"], id=a.id)
    if b is None:
        b = {"id": a.id}
        m["braziers"].append(b)
    b.update({"x": a.x, "y": a.y, "lit": bool(a.lit), "rev": True})
    if a.name is not None:
        b["name"] = a.name
    if a.radius:
        b["radius"] = a.radius
    return m


def cmd_light(m: dict, a, lit: bool = True) -> dict:
    b = _find(m["braziers"], id=a.id)
    if b is None:
        sys.exit(f"map.py: no brazier '{a.id}'")
    b["lit"] = lit
    b["rev"] = True
    return m


def cmd_hero(m: dict, a) -> dict:
    h = next((x for x in m["heroes"] if _norm(x.get("name")) == _norm(a.name)), None)
    if h is None:
        h = {"id": a.name, "name": a.name}
        m["heroes"].append(h)
    h["x"], h["y"] = a.x, a.y
    if a.light is not None:
        if a.light > 0:
            h["light"] = a.light
        else:
            h.pop("light", None)
    if a.color:
        h["color"] = a.color
    return m


def cmd_hero_remove(m: dict, a) -> dict:
    m["heroes"] = [h for h in m["heroes"] if _norm(h.get("name")) != _norm(a.name)]
    return m


def cmd_mark(m: dict, a) -> dict:
    mk = {"x": a.x, "y": a.y, "icon": a.icon, "label": a.label or "", "rev": True}
    if a.dx is not None:
        mk["dx"] = a.dx
    if a.dy is not None:
        mk["dy"] = a.dy
    m["marks"] = [x for x in m["marks"]
                  if not (x.get("x") == a.x and x.get("y") == a.y and x.get("kind") != "dead")]
    m["marks"].append(mk)
    return m


def cmd_unmark(m: dict, a) -> dict:
    before = len(m["marks"])
    if a.at:
        x, y = a.at
        m["marks"] = [k for k in m["marks"] if not (k.get("x") == x and k.get("y") == y)]
    else:
        m["marks"] = [k for k in m["marks"] if _norm(k.get("label")) != _norm(a.label)]
    if len(m["marks"]) == before:
        print("map.py: nothing matched", file=sys.stderr)
    return m


def cmd_dead(m: dict, a) -> dict:
    # A slain creature replaces the live marker standing on that cell.
    m["marks"] = [k for k in m["marks"]
                  if not (k.get("x") == a.x and k.get("y") == a.y and k.get("kind") != "dead")]
    mk = {"x": a.x, "y": a.y, "kind": "dead", "label": a.label, "rev": True}
    if a.dy is not None:
        mk["dy"] = a.dy
    m["marks"].append(mk)
    return m


def cmd_stain(m: dict, a) -> dict:
    # Dark-Souls rule: a new death erases the previous stain of the same hero.
    m["stains"] = [s for s in m["stains"] if _norm(s.get("who")) != _norm(a.who)]
    m["stains"].append({"who": a.who, "x": a.x, "y": a.y, "gold": a.gold})
    return m


def cmd_unstain(m: dict, a) -> dict:
    m["stains"] = [s for s in m["stains"] if _norm(s.get("who")) != _norm(a.who)]
    return m


def _text_setter(field: str):
    def fn(m: dict, a) -> dict:
        m[field] = " ".join(a.text).strip()
        return m
    return fn


def cmd_log(m: dict, a) -> dict:
    line = " ".join(a.text).strip()
    if line:
        m["log"].append(line)
        m["log"] = m["log"][-LOG_KEEP:]
    return m


def cmd_push(m: dict, a) -> bool:
    print("Pushed." if push(m) else "Display not running — nothing pushed.")
    return False


# ── CLI ──────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="DM dungeon map (saved per campaign, mirrored to the display).")
    p.add_argument("--campaign", "-c", help="campaign name (default: active campaign)")
    p.add_argument("--no-push", action="store_true", help="save only, don't update the display")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("show", help="print a summary (or --json)")
    s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_show)

    s = sub.add_parser("init", help="start a blank map (overwrites!)")
    s.add_argument("--title", default="")
    s.add_argument("--area", default="")
    s.add_argument("--w", type=int, default=40)
    s.add_argument("--h", type=int, default=28)
    s.set_defaults(fn=cmd_init)

    s = sub.add_parser("import", help="replace the map with a JSON file")
    s.add_argument("file")
    s.set_defaults(fn=cmd_import)

    s = sub.add_parser("export", help="write the map to a JSON file")
    s.add_argument("file")
    s.set_defaults(fn=cmd_export)

    s = sub.add_parser("push", help="re-send the saved map to the display")
    s.set_defaults(fn=cmd_push)

    s = sub.add_parser("room", help="add/update a rectangular area")
    s.add_argument("id")
    for k in ("x", "y", "w", "h"):
        s.add_argument(k, type=int)
    s.add_argument("--name")
    s.add_argument("--hidden", action="store_true", help="not yet explored")
    s.add_argument("--no-label", action="store_true")
    s.add_argument("--fs", type=int, help="label font size")
    s.add_argument("--lx", type=float, help="label x (cells)")
    s.add_argument("--ly", type=float, help="label y (cells)")
    s.set_defaults(fn=cmd_room)

    s = sub.add_parser("reveal", help="mark rooms as explored")
    s.add_argument("ids", nargs="+")
    s.set_defaults(fn=lambda m, a: cmd_reveal(m, a, True))

    s = sub.add_parser("hide", help="hide rooms again")
    s.add_argument("ids", nargs="+")
    s.set_defaults(fn=lambda m, a: cmd_reveal(m, a, False))

    s = sub.add_parser("door", help="add/update a door on a cell edge")
    s.add_argument("x", type=int)
    s.add_argument("y", type=int)
    s.add_argument("dir", choices=("h", "v"), help="h = on the top edge of cell, v = on the left edge")
    s.add_argument("--state", choices=DOOR_STATES)
    s.add_argument("--kind", choices=("wood", "bars"))
    s.add_argument("--hidden", action="store_true")
    s.set_defaults(fn=cmd_door)

    s = sub.add_parser("brazier", help="add/update a brazier (bonfire)")
    s.add_argument("id")
    s.add_argument("x", type=int)
    s.add_argument("y", type=int)
    s.add_argument("--name")
    s.add_argument("--lit", action="store_true")
    s.add_argument("--radius", type=float, help="light radius in cells (default 6.5)")
    s.set_defaults(fn=cmd_brazier)

    s = sub.add_parser("light", help="light a brazier")
    s.add_argument("id")
    s.set_defaults(fn=lambda m, a: cmd_light(m, a, True))

    s = sub.add_parser("douse", help="put a brazier out")
    s.add_argument("id")
    s.set_defaults(fn=lambda m, a: cmd_light(m, a, False))

    s = sub.add_parser("hero", help="place/move a hero token")
    s.add_argument("name")
    s.add_argument("x", type=int)
    s.add_argument("y", type=int)
    s.add_argument("--light", type=float, help="carried light radius in cells (torch ≈ 4, 0 = none)")
    s.add_argument("--color", help="CSS colour for the token")
    s.set_defaults(fn=cmd_hero)

    s = sub.add_parser("hero-remove")
    s.add_argument("name")
    s.set_defaults(fn=cmd_hero_remove)

    s = sub.add_parser("mark", help="place a marker (enemy, clue, item…)")
    s.add_argument("x", type=int)
    s.add_argument("y", type=int)
    s.add_argument("--icon", default="?", help="one glyph, e.g. ? ! ☠ ✓ →")
    s.add_argument("--label", default="")
    s.add_argument("--dx", type=float, help="label offset x (cells)")
    s.add_argument("--dy", type=float, help="label offset y (cells, default 1.2)")
    s.set_defaults(fn=cmd_mark)

    s = sub.add_parser("unmark", help="remove markers by label or --at X Y")
    s.add_argument("label", nargs="?", default="")
    s.add_argument("--at", nargs=2, type=int, metavar=("X", "Y"))
    s.set_defaults(fn=cmd_unmark)

    s = sub.add_parser("dead", help="mark where an enemy/NPC fell (grey ✕)")
    s.add_argument("x", type=int)
    s.add_argument("y", type=int)
    s.add_argument("label")
    s.add_argument("--dy", type=float)
    s.set_defaults(fn=cmd_dead)

    s = sub.add_parser("stain", help="hero died here and dropped their gold")
    s.add_argument("who")
    s.add_argument("x", type=int)
    s.add_argument("y", type=int)
    s.add_argument("gold", help='e.g. "16 зм 22 см"')
    s.set_defaults(fn=cmd_stain)

    s = sub.add_parser("unstain", help="hero recovered their stain")
    s.add_argument("who")
    s.set_defaults(fn=cmd_unstain)

    for name, field, hlp in (("where", "where", "the 'where you are' banner"),
                             ("area", "area", "sub-title, e.g. level name"),
                             ("title", "title", "map title")):
        s = sub.add_parser(name, help=f"set {hlp}")
        s.add_argument("text", nargs="+")
        s.set_defaults(fn=_text_setter(field))

    s = sub.add_parser("log", help="append a line to the map journal")
    s.add_argument("text", nargs="+")
    s.set_defaults(fn=cmd_log)
    return p


def main(argv=None) -> int:
    a = build_parser().parse_args(argv)
    campaign = a.campaign or _active_campaign()
    if not campaign:
        print("map.py: no campaign — pass --campaign NAME", file=sys.stderr)
        return 2
    m = load(campaign)
    result = a.fn(m, a)
    if result is False:          # read-only command
        return 0
    m = result if isinstance(result, dict) else m
    save(campaign, m)
    if not a.no_push:
        push(m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
