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
    subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files",
                    f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", "--virtual-time-budget=8000",
                    f"--screenshot={out}", url], check=True, capture_output=True)


with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    shot = tmp / "dash.png"
    # a copy of the page that opens the detail drawer on the top pairing, so the preview shows the drill-down
    page_src = (root / "index.html").read_text()
    counts = {}
    for d in drinks:
        names = sorted(x["name"] for x in d["ings"])
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                counts[(a, b)] = counts.get((a, b), 0) + 1
    pair = max(counts, key=counts.get)
    hook = ('<script>addEventListener("load", () => { document.body.classList.add("no-anim"); '
            f'openDrawer({{ type: "pair", a: {json.dumps(pair[0])}, b: {json.dumps(pair[1])} }}); }});</script>'
            '<style>.no-anim .drawer, .no-anim .drawer-scrim { transition: none !important; }</style>')
    snap = tmp / "snap.html"
    snap.write_text(page_src.replace("</body>", hook + "</body>"))
    shoot(snap.as_uri() + "#overview", shot, 1200, 800, 1)  # og-card.html's crop assumes this size
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
