"""Render og.png, the 1200x630 link-preview image, with headless Google Chrome.

Usage (from the project root, after build.py):
    python3 scripts/make_og.py

Screenshots the built index.html, then frames it in src/og-card.html with stats from data/drinks.json.
Needs Google Chrome and an internet connection (fonts and D3 load from CDNs).
"""
import json, pathlib, statistics, subprocess, tempfile, os

MENU_DATE = "Oct 13, 2026"
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
root = pathlib.Path(__file__).resolve().parent.parent
drinks = json.loads((root / "data" / "drinks.json").read_text())


def shoot(url, out, w, h, scale):
    subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files",
                    f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", "--virtual-time-budget=8000",
                    f"--screenshot={out}", url], check=True, capture_output=True)


with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    shot = tmp / "dash.png"
    shoot((root / "index.html").as_uri() + "#overview", shot, 1440, 900, 1)
    prices = [d["price"] for d in drinks if not d["zero"]]
    med = statistics.median(prices)
    fill = {
        "__RESTS__": ["zero", "one", "two", "three", "four", "five", "six", "seven"][len({d["restaurant"] for d in drinks})],
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
