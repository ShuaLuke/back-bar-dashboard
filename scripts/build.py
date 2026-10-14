"""Build index.html from src/template.html + data/drinks.json.

Usage (from the project root):
    python3 scripts/normalize.py data/drinks_raw.tsv data/drinks.json
    python3 scripts/build.py

Everything in the template above the <!--BODY--> marker goes in <head>.
"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
template = (root / "src" / "template.html").read_text()
drinks = json.loads((root / "data" / "drinks.json").read_text())
if template.count("<!--BODY-->") != 1:
    raise SystemExit("src/template.html needs exactly one <!--BODY--> marker")
head, body = template.split("<!--BODY-->")
for k, v in {"__N_DRINKS__": len(drinks), "__N_RESTS__": len({d["restaurant"] for d in drinks}), "__N_GROUPS__": len({d["group"] for d in drinks})}.items():
    head = head.replace(k, str(v))
body = body.replace("__DATA__", json.dumps(drinks, ensure_ascii=False, separators=(",", ":")))
html = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head.strip() + '\n</head>\n<body style="margin:0">\n' + body.strip() + '\n</body>\n</html>\n')
(root / "index.html").write_text(html)
print(f"Wrote index.html ({len(drinks)} drinks)")
