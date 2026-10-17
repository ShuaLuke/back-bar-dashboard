# The reconciliation test

The one test that decides whether anything else is worth pursuing: load one real restaurant-month on the operator's own machine and check whether theoretical pour cost lands close to what the books show. The pass criteria below are fixed in advance and built into the tool (`CostModel.RECON` in `src/costmodel.js`, shown on the Reconcile tab).

## What to load

Nothing leaves the machine (see `docs/security-review.md`). Use the offline build (`dist/offline/index.html`) on an internal laptop.

| File | What it holds for the restaurant-month | Where it usually comes from |
|---|---|---|
| `ingredients.csv` | Every bottle, juice, syrup and garnish with bottle cost, bottle size, pour size, yield (or a pour cost) and call up-charge, as of that month | The bar manager's pour-cost sheet, or an export from R365, xtraCHEF, MarketMan, BevSpot or Backbar |
| `drinks.csv` | Every drink sold that month with its menu price; the well & call drink with `custom = 1`; food items if they are on the same checks | Menu management / POS item list |
| `recipes.csv` | The spec of each menu drink (2 fl oz tequila, 1 fl oz lime, …) | Spec sheets / recipe cards |
| `sales.csv` | Every check line for the restaurant-month with check id, date, item, quantity and net price | POS export (Toast, Square, Aloha, Micros) |
| `modifiers.csv` | Every spirit and mixer picked on well & call lines, and every call or swap on a menu drink | POS modifier export |
| `actuals.csv` | One row: the restaurant, the month, beverage COGS from the P&L and net beverage sales from the P&L | Finance |
| optional `waste.csv`, `inventory.csv` | The month's waste log and bottle counts | Bar systems, the inventory app |

Templates with exact columns: `data/templates/`; dictionary: `docs/data-dictionary.md`. The column mapper on the Data tab accepts the systems' own header names (SKU, PLU, Check #, Revenue Center, Case Cost, Standard Pour), so exports need not be reformatted.

## Steps

1. Open the tool, Data tab, drop the files. Check that every file shows "Ready" and that the Checks panel reports no errors. Problems it reports (unmapped ingredients, drinks without a spec, sales for unknown drinks, unit mismatches, a recipe in `oz` against a bottle in `ml`) are fixed in the files, not worked around.
2. Click "Use this data". The banner turns teal ("Your data").
3. Explore → Reconcile. One row per restaurant-month in `actuals.csv`.
4. Record the row: coverage, theoretical %, theoretical + logged waste, books %, gap, verdict. Export the table ("⤓ CSV") for the record.

Time: an hour the first time, mostly spent on the ingredient and spec files; minutes after that.

## What counts as a pass

| Check | Rule | If it fails |
|---|---|---|
| Coverage | ≥ 97% of the month's net beverage sales is costed (every sold drink has a spec; every well & call line has modifiers) | **Not assessable.** Fix the files; the result is not a verdict on the model. |
| Sales agree | Beverage sales in the file within 2% of net beverage sales in the books | **Review.** The POS extract and the P&L disagree; fix the extract before judging cost. |
| Gap = books % − theoretical % | 0 to +4.0 points | **Pass.** The books carry over-pours, spills, comps, breakage and shrink; theoretical does not. 1–4 points is the normal distance at a bar. |
| | −1.5 to 0, or +4.0 to +7.0 | **Review.** Negative: specs, pours or costs are overstated, or purchases were timed across the month boundary. High: free pouring, comps or breakage are above normal, or something is missing from specs or costs. The waste log narrows it down. |
| | below −1.5 or above +7.0 | **Fail.** The model does not describe the bar. Find out why before building anything on it. |

A pass on one restaurant-month means the ingredient model and the cost inputs are sound for that bar, and the rest of the tool can be trusted on that data. It does not say the gap is "good" or "bad" operationally; that is what the waste and theoretical-vs-actual views are for.

## What to do with each outcome

- **Pass**: proceed to the proof-of-value decision (`docs/walkthrough.md`) on real data, then a second restaurant-month to confirm.
- **Review**: list the top five drinks by sales and check their specs and costs by hand against the Costs tab (click a drink for its build-up). Check cost effective dates against invoice dates. Load the waste log and re-read "+ logged waste".
- **Fail**: compare one high-volume bottle's theoretical usage with purchases (`inventory.csv`, Operations → Theoretical vs actual). A large variance on one bottle points at a spec or pour error; a uniform variance across bottles points at costs or sales coverage, or at free pouring.

## What the sample shows

With the built-in sample, eight restaurant-months pass (gaps of about 1 to 1.5 points, by construction) and Zaytinya in September fails (about 9 points, by construction) so the fail state is visible before any real data is loaded.
