# Well & Call: José Andrés DC cocktail menus

> Unofficial fan project. Not affiliated with, endorsed by or connected to José Andrés, José Andrés Group or any of the restaurants. Menus and prices change.

An interactive dashboard of the cocktail and zero-proof menus at Washington, DC restaurants, read from each restaurant's own website on Oct 13–14, 2026. It started with five José Andrés Group restaurants (Oyamel, Jaleo, Zaytinya, China Chilcano, Bazaar Meat) and now also covers STARR Restaurants, Fabio Trabocchi Restaurants and Neighborhood Restaurant Group (ChurchKey, The Sovereign, Iron Gate), so the groups can be compared.

## Views
- **Overview**: KPIs, top pairings, by-restaurant price spread, most-used ingredients, category mix, signals
- **Ingredient lookup**: search an ingredient, see ranked partners and the drinks
- **Pairing matrix**: co-occurrence heatmap of the top 16/24/32 ingredients
- **Pairing map**: interactive chord diagram (categories ⇄ ingredients, drill-down, filters)
- **Prep & inventory / Pricing / Menu gaps**: operations views built from the menus alone, for whichever restaurants are selected
- **Head to head**: pick any two restaurants (or two groups) and compare side by side: stats, what they build drinks from, price dots on a shared axis, shared vs. exclusive ingredients and pairings, same-style pricing
- **Compare groups**: group-vs-group view: price, zero-proof share, what drinks are built from, signature ingredients, common ground, same-style pricing, and pairings other groups use that one doesn't
- **Cost & sales (what if)**: a preview of margin and sales analysis. Costs are adjustable *assumptions* per ingredient type. Sales are a seeded *random simulated* sample (menu-engineering matrix, top sellers, drink + food pairing, check lift). Lists what real recipe, invoice and POS data would unlock
- **Pairing map sub-maps**: click a category arc or ribbon to see the ingredients behind it as a two-column link diagram (or a small chord for pairs within one category). In the Ingredients view, an ingredient shows its partners grouped by category, and a pair shows what else goes into its drinks. The pairing matrix detail panel uses the same diagrams: a cell shows what else goes in, a diagonal cell shows partners

On a desktop the Overview fits on one screen. Clicking an ingredient, pairing or category on it opens a detail drawer with the same sub-maps, without leaving the dashboard. Hover any stat for details. On a phone, tap once for details and again to open.

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
- `data/drinks_raw.tsv`: one row per drink: group, restaurant, section, drink, price (by the glass; blank if the menu lists none), ingredients as written on the menu (`;`-separated). Rows are grouped by restaurant group; `data/sources.md` lists the menu URLs and read dates
- `scripts/normalize.py`: regex rules mapping menu wording to a canonical ingredient and category (first match wins). It exits with an error listing anything unmapped.
- `data/drinks.json`: normalized output the page reads
- `src/template.html`: the whole app (CSS + HTML + JS, D3 v7). Everything above the `<!--BODY-->` marker goes in `<head>`. `__DATA__` is replaced at build time.

## Data notes
- Prices are by the glass. Pitchers, flights, straight pours, wine and beer are excluded.
- barmini is missing because its menu isn't published online.
- Garnish techniques (liquid nitrogen, aromatic clouds, carbonation) aren't counted. "Salt air" counts as salt.
- No sales or cost data. Operations views are based on the menus only.
