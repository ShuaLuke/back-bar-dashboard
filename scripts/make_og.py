"""Render og.png, the 1200x630 link-preview image, with headless Google Chrome.

Usage (from the project root, after build.py):
    python3 scripts/make_og.py

Screenshots the built index.html, then frames it in src/og-card.html with stats from data/drinks.json.
Needs Google Chrome and an internet connection (fonts and D3 load from CDNs).
"""
import json, pathlib, statistics, subprocess, tempfile, os

MENU_DATE = "Oct 13–14, 2026"
SHORT = {"José Andrés Group": "José Andrés", "Fabio Trabocchi Restaurants": "Fabio Trabocchi", "STARR Restaurants": "STARR", "Neighborhood Restaurant Group": "Neighborhood Restaurant Group"}
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
root = pathlib.Path(__file__).resolve().parent.parent
drinks = json.loads((root / "data" / "drinks.json").read_text())


def shoot(url, out, w, h, scale):
    args = ["--headless=new", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files",
            f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", "--virtual-time-budget=8000", f"--screenshot={out}", url]
    # Launched directly from the Anaconda interpreter, headless Chrome writes the screenshot and then never exits (a
    # process-inheritance quirk on this Mac; the system Python and a plain shell are fine). Going through launchd with
    # `open -W` avoids it, so that is the default on macOS; CHROME=... keeps the direct launch for other setups.
    app = CHROME.split("/Contents/MacOS/")[0] if "/Contents/MacOS/" in CHROME else None
    if app and app.endswith(".app") and os.path.exists("/usr/bin/open"):
        subprocess.run(["open", "-n", "-W", "-a", app, "--args", *args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    else:
        subprocess.run([CHROME, *args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    if not pathlib.Path(out).exists(): raise SystemExit(f"Chrome wrote no screenshot for {url}")


with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    shot = tmp / "dash.png"
    # a copy of the page that opens Head to head on the first two groups, so the preview shows the comparison
    page_src = (root / "index.html").read_text()
    groups = list(dict.fromkeys(d["group"] for d in drinks))
    a, b = groups[0], (groups[2] if len(groups) > 2 else groups[-1])  # José Andrés vs STARR when both exist
    hook = ('<script>window.__notour = true; window.__noct = true; addEventListener("load", () => { '
            f'h2h.a = "g:" + {json.dumps(a)}; h2h.b = "g:" + {json.dumps(b)}; renderH2H(); setView("h2h"); }});</script>')
    snap = tmp / "snap.html"
    snap.write_text(page_src.replace("</body>", hook + "</body>"))
    shoot(snap.as_uri() + "#h2h", shot, 1200, 800, 1)  # og-card.html's crop assumes this size
    prices = [d["price"] for d in drinks if not d["zero"] and d["price"] is not None]
    med = statistics.median(prices)
    fill = {
        "__RESTS__": str(len({d["restaurant"] for d in drinks})),
        "__N_GROUPS__": str(len({d["group"] for d in drinks})),
        "__GROUPS__": ", ".join(SHORT.get(g, g) for g in dict.fromkeys(d["group"] for d in drinks)),
        "__DRINKS__": str(len(drinks)),
        "__INGS__": str(len({i["name"] for d in drinks for i in d["ings"]})),
        "__MEDIAN__": f"${med:g}",
        "__DATE__": MENU_DATE,
        "__SHOT__": shot.as_uri(),
    }
    card = (root / "src" / "og-card.html").read_text()
    for k, v in fill.items():
        card = card.replace(k, v)
    page = tmp / "card.html"
    page.write_text(card)
    shoot(page.as_uri(), root / "og.png", 1200, 630, 1)
print(f"Wrote og.png ({(root / 'og.png').stat().st_size // 1024} KB)")
