# Well & Call: DC cocktail menus, by the bottle

> Unofficial fan project. Not affiliated with, endorsed by or connected to José Andrés, José Andrés Group, STARR Restaurants, Fabio Trabocchi Restaurants, Neighborhood Restaurant Group or any of the restaurants. Menus and prices change.

An interactive dashboard of the cocktail and zero-proof menus at Washington, DC restaurants, read from each restaurant's own website on Oct 13–14, 2026. It started with five José Andrés Group restaurants (Oyamel, Jaleo, Zaytinya, China Chilcano, Bazaar Meat) and now also covers STARR Restaurants, Fabio Trabocchi Restaurants and Neighborhood Restaurant Group (ChurchKey, The Sovereign, Iron Gate), so the groups can be compared. Its sibling is [Spread Sheet](https://github.com/ShuaLuke/cava-dashboard), the CAVA menu dashboard, built from the same code.

## Views
- **Overview**: KPIs, top pairings, by-restaurant price spread, most-used ingredients, category mix, signals (including the latest pour cost from the Cost & sales tool)
- **Ingredient lookup**: search an ingredient, see ranked partners and the drinks
- **Pairing matrix**: co-occurrence heatmap of the top 16/24/32 ingredients
- **Pairing map**: interactive chord diagram (categories ⇄ ingredients, drill-down, filters)
- **Prep & inventory / Pricing / Menu gaps**: operations views built from the menus alone, for whichever restaurants are selected
- **Head to head**: pick any two restaurants (or two groups) and compare side by side: stats, what they build drinks from, price dots on a shared axis, shared vs. exclusive ingredients and pairings, same-style pricing
- **Compare groups**: group-vs-group view: price, zero-proof share, what drinks are built from, signature ingredients, common ground, same-style pricing, and pairings other groups use that one doesn't
- **Cost & sales**: a pour-cost, sales-mix, menu-engineering and scenario tool that runs on your own pour-cost sheet and POS files, entirely in the browser tab (nothing is uploaded). Opens on a synthetic sample dataset so every view works before anything is loaded. See below
- **Pairing map sub-maps**: click a category arc or ribbon to see the ingredients behind it as a two-column link diagram (or a small chord for pairs within one category). In the Ingredients view, an ingredient shows its partners grouped by category, and a pair shows what else goes into its drinks. The pairing matrix detail panel uses the same diagrams

On a desktop the Overview fits on one screen. Clicking an ingredient, pairing or category on it opens a detail drawer with the same sub-maps, without leaving the dashboard. Hover any stat for details. On a phone, tap once for details and again to open.

## Cost & sales tool
Organized around the jobs people come to do. **Home** flags what needs attention in the latest month (pour cost vs target by restaurant, call up-charges that no longer cover their cost, drinks whose margin slipped, the latest reconciliation verdict, the best new-drink candidate), each linking to the view that explains it. **What to do** takes a situation (a bottle cost change, an allocation or shortage, a new bottle, a planned price change, or simply "improve pour cost"), tries every move the tool knows, ranks them with the reasons, and assembles a plan that is verified by the engine and handed to the flows. Four guided flows: **Monthly review** (where pour cost landed → what moved it, split into bottle costs vs mix → where to look → one-page summary), **Menu change** (new drink, limited-time drink, pour change, bottle swap or removal → cost and margin → ripple across the menu and the back bar → compare options → export), **Price change** (new prices or call up-charges → margin, pour cost and volume under a stated demand assumption → ladder check against the well & call base with a one-click fix → compare and export) and **New drink ideas** (well & call orders guests already make, ranked, with the reasons, opening straight into Menu change). Every figure can be hovered for its formula, the values and the source file; anything resting on an assumption is amber and says so.

**Explore** keeps the full views for deeper digging, in five tabs: **Data** (load CSV/TSV/.xlsx, templates, validation, column mapping, storage opt-in), **Costs** (per-drink cost from the spec after yield, call up-charge coverage against the well, cost a well & call drink, cost history, strength check in standard drinks), **Sales & mix** (mix-weighted pour cost by restaurant and month, menu engineering, well & call pick rates and the most common orders, combinations not on the menu, cannibalization, food on the check, check lift, channel and daypart), **Scenarios** (bottle cost, repricing with elasticity, call up-charges, remove or swap, new drink or limited-time drink, supply disruption, saved comparisons, price ladder), **Operations** (restaurants side by side, prep load, waste and low movers, theoretical vs actual from bottle counts, trend) and **Reconcile** (theoretical pour cost against the books with pass criteria fixed in advance).

- Inputs: `docs/data-dictionary.md`, blank templates in `data/templates/`, filled examples in `data/sample/`. Specs can be given in fl oz, ml, dashes or pieces; the column mapper accepts POS and pour-cost-sheet headers as they come.
- Method: `docs/methodology.md`; tests: `node --test tests/*.test.js`.
- Privacy: `docs/security-review.md`. The page's content-security policy blocks every network connection; the offline build makes no requests at all.
- The sample: `docs/sample-data.md`. A worked decision in three minutes: `docs/walkthrough.md`. The gating test: `docs/reconciliation-test.md`.

## Run it
Open `index.html` in a browser. It needs an internet connection for D3 (cdnjs) and fonts (Google Fonts). `dist/offline/index.html` is the same page with D3 and the fonts embedded: it needs no connection and makes no network requests.

## Publish on GitHub Pages
Push the repo to GitHub, then go to Settings → Pages → Deploy from a branch → `main` / `(root)`. `index.html` is self-contained, so nothing else needs building on GitHub. Rebuild and commit `index.html` after every change.

## Rebuild after changing data or code
```
python3 scripts/normalize.py data/drinks_raw.tsv data/drinks.json   # raw menu rows -> normalized ingredients
python3 scripts/build.py --offline                                  # template + data + src/*.js -> index.html and dist/offline/index.html
node --test tests/*.test.js                                         # cost-model test cases
node scripts/make_sample.js                                         # templates, data dictionary and sample files from src/
python3 scripts/vendor.py                                           # once: download D3 + fonts into vendor/ (SRI hash, offline build)
python3 scripts/make_og.py                                          # optional: re-render og.png (link preview) with headless Chrome
```

## Files
- `data/drinks_raw.tsv`: one row per drink: group, restaurant, section, drink, price (by the glass; blank if the menu lists none), ingredients as written on the menu (`;`-separated). Rows are grouped by restaurant group; `data/sources.md` lists the menu URLs and read dates
- `scripts/normalize.py`: regex rules mapping menu wording to a canonical ingredient and category (first match wins). It exits with an error listing anything unmapped.
- `data/drinks.json`: normalized output the page reads
- `src/template.html`: the menu dashboard (CSS + HTML + JS, D3 v7). Everything above the `<!--BODY-->` marker goes in `<head>`. `__DATA__` and the script markers are replaced at build time
- `src/costmodel.js`: the cost & sales engine (templates, CSV, validation, costing, analysis, scenarios, reconciliation); runs in the browser and under Node
- `src/costtool.js`: the tool's UI; `src/sample.js`: the synthetic dataset generator; `src/xlsx-lite.js`: dependency-free .xlsx reader
- `tests/costmodel.test.js`: hand-calculated cases; `docs/`: dictionary, methodology, security review, sample notes, walkthrough, reconciliation test
- `vendor/`: pinned copies of D3 and the fonts with hashes (`scripts/vendor.py`); `dist/offline/`: the offline build

## Data notes
- Prices are by the glass. Pitchers, flights, straight pours, wine and beer are excluded.
- barmini is missing because its menu isn't published online.
- Garnish techniques (liquid nitrogen, aromatic clouds, carbonation) aren't counted. "Salt air" counts as salt.
- The menu views use no sales or cost data. The Cost & sales tool's default dataset is synthetic (`docs/sample-data.md`); none of it is the restaurants' real cost, sales or margin data.
