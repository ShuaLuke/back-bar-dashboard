# Back Bar: José Andrés DC cocktail menus

> Unofficial fan project. Not affiliated with, endorsed by or connected to José Andrés, José Andrés Group or any of the restaurants. Menus and prices change.

An interactive dashboard of the cocktail and zero-proof menus at five José Andrés restaurants in Washington, DC (Oyamel, Jaleo, Zaytinya, China Chilcano, Bazaar Meat), read from each restaurant's website on Oct 13, 2026.

## Views
- **Overview**: KPIs, top pairings, by-restaurant price spread, most-used ingredients, category mix, signals
- **Ingredient lookup**: search an ingredient, see ranked partners and the drinks
- **Pairing matrix**: co-occurrence heatmap of the top 16/24/32 ingredients
- **Pairing map**: interactive chord diagram (categories ⇄ ingredients, drill-down, filters)
- **Prep & inventory / Pricing / Menu gaps**: operations views built from the menus alone
- **Cost & sales (what if)**: a preview of margin and sales analysis. Costs are adjustable *assumptions* per ingredient type. Sales are a seeded *random simulated* sample (menu-engineering matrix, top sellers, drink + food pairing, check lift). Lists what real recipe, invoice and POS data would unlock
- **Pairing map sub-maps**: click a category arc or ribbon to see the ingredients behind it as a two-column link diagram (or a small chord for pairs within one category)

On a desktop the Overview fits on one screen. Hover any stat for details. On a phone, tap once for details and again to open.

## Run it
Open `index.html` in a browser. It needs an internet connection for D3 (cdnjs) and fonts (Google Fonts).

## Publish on GitHub Pages
Push the repo to GitHub, then go to Settings → Pages → Deploy from a branch → `main` / `(root)`. `index.html` is self-contained, so nothing else needs building on GitHub. Rebuild and commit `index.html` after every change.

## Rebuild after changing data or code
```
python3 scripts/normalize.py data/drinks_raw.tsv data/drinks.json   # raw menu rows -> normalized ingredients
python3 scripts/build.py                                            # template + data -> index.html
python3 scripts/make_og.py                                          # optional: re-render og.png (link preview) with headless Chrome
```

## Files
- `data/drinks_raw.tsv`: one row per drink: restaurant, section, drink, price (by the glass), ingredients as written on the menu (`;`-separated)
- `scripts/normalize.py`: regex rules mapping menu wording to a canonical ingredient and category (first match wins). It exits with an error listing anything unmapped.
- `data/drinks.json`: normalized output the page reads
- `src/template.html`: the whole app (CSS + HTML + JS, D3 v7). Everything above the `<!--BODY-->` marker goes in `<head>`. `__DATA__` is replaced at build time.

## Data notes
- Prices are by the glass. Pitchers, flights, straight pours, wine and beer are excluded.
- barmini is missing because its menu isn't published online.
- Garnish techniques (liquid nitrogen, aromatic clouds, carbonation) aren't counted. "Salt air" counts as salt.
- No sales or cost data. Operations views are based on the menus only.
