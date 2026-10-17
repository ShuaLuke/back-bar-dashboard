# Methodology

Every formula and assumption in the Cost & sales tool, so a beverage director or a finance lead can check the math. The code is `src/costmodel.js`; the hand-calculated cases in `tests/costmodel.test.js` (also shown on the Reconcile tab) must reproduce these numbers exactly after every change.

Vocabulary: an **ingredient** is one thing the bar stocks (a bottle of blanco tequila, a quart of lime juice, a bottle of bitters, a sprig of mint). A **drink** is a menu entry: a cocktail or zero-proof drink with a fixed **spec** (recipe), a **well & call drink** built at the POS from a spirit and a mixer (`custom = 1`) whose contents come from the check's **modifiers**, or a food item on the same check (a section whose name says food, plate, entrée or dessert) that has no spec and is used only for pairing. A **pour** is one standard measure of an ingredient as the bar pours it (1 fl oz of a spirit, 1 dash of bitters, 1 wedge of lime). A **call** is a guest naming a brand; a called bottle carries a call **up-charge** and replaces the well of its category.

## 1. Pour cost

Each ingredient row gives either a `pour_cost` directly, or the bottle (or case, jug, bag) it is bought in:

```
usable per bottle = bottle_size × unit(bottle_unit → pour_unit) × yield_pct / 100
cost per pour     = bottle_cost ÷ usable per bottle × pour_size
```

Example: a 750 ml bottle of tequila at $18, 1.5 fl oz pours. 750 ml = 25.36 fl oz; cost = $18 ÷ 25.36 × 1.5 = **$1.065**. A quart of lime juice at $9 with 90% usable (pulp, pith, the last ounce) and 1 fl oz pours: $9 ÷ (32 × 0.9) × 1 = **$0.3125**.

- Units convert within one family only (volume: ml, l, fl oz, cup, pt, qt, gal; weight: g, kg, oz, lb; count: each, dash, sprig, wedge, wheel, slice, twist, rim, bottle, dozen). A weight bottle with a volume pour is a **unit mismatch** error, never a silent guess. Note that `oz` is weight; a liquid pour is `fl oz`.
- Yield must be between 0 and 100. Blank means 100. For spirits it covers spillage and evaporation (95–98%); for fresh juice it covers what the fruit gives.
- `pour_cost`, when present, wins over the bottle math (for batched or prepped items costed elsewhere).
- Bitters are costed by the dash: a 16 fl oz bottle is about 480 dashes.

## 2. Recipe quantities

A spec row gives `qty` in a `unit` (2 fl oz of tequila, 1 dash of bitters, 1 each of a lime wedge), converted to the ingredient's standard pours through its `pour_size` and `pour_unit`:

```
pours = qty × unit(unit → pour_unit) ÷ pour_size
```

With `unit` blank, `qty` counts standard pours directly (0.5 is a half pour, 2 a double). A unit of the wrong kind (a sprig of lime juice) is reported on load. The same rule applies to modifier rows.

## 3. Cost versions and restaurant costs

An ingredient may have several rows. `effective_date` makes versions: the cost used on a given day is the latest version dated on or before that day; before the first dated version, the undated row (or the earliest version) applies. A row with a `restaurant_id` is used for that bar only; bars without their own row use the global one. Every sales line is costed at its own restaurant and date, so a distributor increase on September 1 affects September sales, not August's.

## 4. Drink cost

Menu drink (spec rows):

```
pour cost = Σ over spec rows ( pours × cost per pour of the ingredient )
```

Well & call drink (no spec): the same sum over the check line's modifier rows (the spirit, well or called, and the mixer).

Menu drink with modifiers: a called spirit **replaces** the spec's spirit of the same category ("make it with Casamigos": the well tequila comes out, the Casamigos pour goes in, the rest of the spec stays); any other modifier is an add.

Extras (optional file) are added per drink by menu section and service: `channel` dine_in and bar → `in_house`; takeout, delivery and event → `to_go`; `all` rows are fallbacks. They are shown separately everywhere ("pour cost" vs "with extras") so theoretical pour cost stays comparable with the books.

Waste is **not** a per-drink adder. It is reported at period level from the waste log (section 11) and shows up in reconciliation as the gap between theoretical and actual.

Food lines on a check are never costed and never counted in beverage sales; they feed the pairing and check-size views only.

## 5. Revenue per line

```
unit revenue = net_price if given
             = restaurant menu price + Σ (call up-charge × pours) over modifiers, otherwise
line revenue = unit revenue × qty
```

`net_price` is what was paid after discounts and comps, including call up-charges; happy-hour discounts and comped drinks show up here.

## 6. Mix-weighted (theoretical) pour cost

For any scope (restaurants, months, channel):

```
theoretical pour cost % = Σ line cost ÷ Σ line beverage revenue × 100
with extras             = (Σ line cost + Σ extras) ÷ Σ line revenue × 100
gross profit            = Σ revenue − Σ pour cost − Σ extras
```

The same sums are kept per restaurant, month, restaurant-month, channel, daypart, day of week, menu section and drink.

**Coverage**: well & call lines with no modifiers and drinks with no spec have unknown cost; their revenue is counted and their share is reported as "uncosted". The reconciliation test refuses to judge a month below 97% coverage.

## 7. Menu engineering

Kasavana & Smith's matrix on menu drinks (well & call drinks are excluded: they are a line, not a drink; food is excluded: it has no pour cost). Per drink in scope:

```
units, revenue, cost from the sales lines
contribution per unit  = (revenue − cost) ÷ units
popularity threshold   = 0.7 × total drink units ÷ number of drinks sold
contribution threshold = Σ contribution ÷ Σ units  (sales-weighted average)
```

Star = above both; Plowhorse = popular, low contribution; Puzzle = unpopular, high contribution; Dog = neither. The reading column gives the standard action: keep and feature, reprice or trim the pour, promote or reposition, candidate to cut.

## 8. Call up-charge coverage

For every ingredient with an up-charge:

```
incremental cost = pour cost − average well pour of its category   (spirits: it replaces the well)
                 = pour cost                                       (anything else: a pure add)
margin per call  = up-charge − incremental cost
break-even cost  = up-charge + well pour   (spirits)
                 = up-charge               (adds)
calls            = Σ pours picked in scope (from modifiers)
margin in scope  = margin per call × calls
```

The **well** of a category is the average cost per pour of its spirits with no up-charge (the well tequila for Agave, the well gin for Gin), at the reference restaurant and date. A category with no well falls back to the average of every well spirit.

## 9. Well & call analysis

From checks whose line is a `custom` drink with modifiers:

- **Pick rate** of an ingredient = well & call orders containing it ÷ all well & call orders.
- **Ingredients per order** = Σ modifier quantities ÷ orders; also per category.
- **Orders**: the sorted set of (ingredient, quantity) on a line is its signature. Orders are counted per signature; the most common signatures are the most common orders.
- **Nearest menu drink** = the menu drink in the same section with the highest Jaccard similarity (shared ingredients ÷ ingredients in either) to the order's ingredient set.
- **Combinations not on the menu** = orders made at least twice whose nearest menu drink is less than 80% similar, ranked by orders, with their average paid price, cost, pour cost % and the price that would hit the target.
- **Cannibalization** for a menu drink = look-alike well & call orders (≥ 75% similar, same section) ÷ (menu units + look-alike orders). High overlap: the drink mostly gives a name to what guests already order at the bar; low: it brings new demand. This is a heuristic read of co-existence, not a before/after test.

## 10. Checks

- **Food on the check** for drink D and food section S = checks holding D that also hold an item from S ÷ checks holding D. Also by channel, and the five most attached individual dishes.
- **Check lift** = average check (drinks and food) of checks containing the drink − average of checks without it (drinks with ≥ 20 checks). Correlation only, and dearer drinks sit on dearer checks by construction.
- **Channel price differences** = average paid per unit by channel, for drinks where any channel differs from dine-in by more than a cent (happy-hour and event pricing).
- **Dayparts** from `time` when `daypart` is blank: before 15:00 lunch (and brunch), 15:00–17:59 happy hour, 18:00–20:59 dinner, 21:00 to 03:59 late.

## 11. Operations

- **Prep load** per drink: number of ingredients, number of categories, Σ `prep_steps` (default 1 per ingredient: juicing, syrups, infusions), and the ingredients nothing else moves ("only this drink needs": used by no other menu drink and poured under 20 pours per restaurant-week at the well).
- **Cross-utilization** of a spec = share of its ingredients already moving at volume elsewhere (on two or more menu drinks, or ≥ 20 pours per restaurant-week at the well). Works for any drink and for candidates built on the Scenarios tab.
- **Waste exposure**: waste cost = logged pours × the pour cost at that restaurant and date; waste % = wasted ÷ (theoretical usage + wasted); per week = ÷ weeks in scope. Theoretical usage of an ingredient = Σ pours implied by the sales lines (specs + modifiers).
- **Low movers** = stocked ingredients that no menu drink uses and whose pick rate is under 3%: the first bottles to delist.
- **Theoretical vs actual usage** = actual (begin + purchased − end, converted from bottles or volume to pours) against theoretical for the same restaurant-months; variance over +10% reads as over-pouring, spillage or shrink, under −5% as under-pouring or a count error.
- **Trend**: per drink, contribution per unit and pour cost % in the first month in scope against the last; "slipping" = contribution down more than $0.10 or pour cost up more than 2 points. Needs two months.
- **Restaurants**: drinks sold at a subset of the restaurants in scope, and drinks with a restaurant-specific price.

## 12. Scenarios

A scenario re-runs the whole engine with changes applied; every table is recomputed and compared with the base.

- **Bottle cost change**: ingredient cost × (1 + % ÷ 100), or set to a dollar amount per pour, at every version.
- **Swap**: bottle A is costed and counted as bottle B wherever it appears (specs and modifiers), pours unchanged.
- **Repricing**: new price per drink. Units respond: `units' = units × (1 + elasticity × Δprice ÷ old price)`, with elasticity adjustable (default −0.8; 0 switches the demand response off). Revenue and cost scale with units'.
- **Call up-charge change**: Δ on the called bottle. Share of calls kept `pf = 1 + elasticity × Δ ÷ old up-charge` (clamped 0–1.5; if the old up-charge was 0, the drink price is the denominator). Lines keeping the call pay Δ more; lines dropping it lose the old up-charge in revenue and the incremental cost in pour cost (they take the well instead). Call counts in the up-charge table are scaled by `pf`.
- **Remove a drink**: its lines are dropped; `retention` (default 80%) of its units move to the other drinks in the same section, pro rata to their units; the rest is lost.
- **New drink / limited-time drink**: cost from its spec; projected units = units per restaurant-week × restaurants in scope × weeks (limited-time weeks, capped at the scope); a `cannibal` share (default 70%) of that volume is pulled pro rata from the other drinks in its section, the rest is new demand. The projection is spread over restaurants, months and channels in proportion to existing units.
- **Supply disruption** (an allocation, a shortage): for a bottle, the menu drinks using it (units, sales, share) and the well & call orders calling it; revenue at risk is their sum. Reporting only; nothing is re-routed.
- **Saved scenarios** are kept in memory (and on this device only with the storage opt-in). Compare shows up to three against the base; exports are CSV (table) and JSON (the scenario definitions).

**Price ladder**: for each menu drink that contains a spirit (zero-proof sections are skipped), `formula = well & call base price + Σ call up-charges of its called bottles`; gap = price − formula. A menu drink below the ladder is cheaper than calling the same bottles at the well; above it carries a premium for the recipe, which is normal. Drinks with the same formula and different prices are flagged as overlaps. When a section has no well & call drink of its own, the bar's well & call drink is the base.

## 12b. Month-to-month decomposition (Monthly review, step 2)

Why pour cost % moved from month A to month B, in two parts that add up exactly:

```
cost effect  = PC(A's sales costed at B's bottle costs) − PC(A)
mix & price  = PC(B) − PC(A's sales costed at B's bottle costs)
```

"Costed at B's costs" re-runs the engine with every line costed as of B's last day (`scope.costAsOf`). Per drink, its contribution to the change in points is `(drink pour cost ÷ total sales)_B − (drink pour cost ÷ total sales)_A`; these sum to the total change. Per ingredient, the table lists the cost before and after, the dollar impact at B's usage and the points of pour cost that represents. Mix indicators shown alongside: well & call share of drinks, share of well & call orders calling a brand, checks with food, average paid per drink, average beverage check.

## 12c. New-drink candidates (Suggest new menu drinks)

From the "combinations not on the menu" list (section 9):

```
score = contribution per order × orders per restaurant-week × (0.5 + 0.5 × share of ingredients at volume) × min(1, target ÷ pour cost %)
```

where contribution per order = average paid − pour cost, and the suggested price is the average paid rounded to 5¢. The "why" for each candidate states the orders, the bottles already at volume (and any new bottle or prep), the pour cost at the paid price against the target, and the closest menu drink with its similarity. "Evaluate as a new drink" carries the spec, price and observed volume into the menu-change flow.

## 12d. Pour changes

A scenario may replace a drink's spec (`scn.recipes[drink] = [{ingredient, pours}]`). Every sales line of that drink is re-costed with the new pours; nothing else changes. The strength check recomputes with the new pours when ABV is loaded.

## 12e. What to do: recommendations

Given a situation, the advisor generates candidate moves, scores each with the same formulas the scenario engine uses, ranks them, assembles a plan and verifies the plan with one full engine run.

Situations and their baseline:

| Situation | Baseline the moves are measured against |
|---|---|
| Improve pour cost | today |
| A bottle cost changed by x% | today's menu at the new cost (the loss at current prices is shown first) |
| A bottle is unavailable | every menu drink that needs it comes off the menu (retention applies) and well & call orders calling it are served nothing and pay no up-charge |
| A new bottle is available | today (the bottle joins the model for the session with its cost and up-charge) |
| A price change is planned | today with that change applied |

Candidate moves and their quick estimates (per period in scope, net of extras so they match the engine's gross profit):

- **Reprice a drink** to p′: `units × f × (paid′ − cost − extras) − units × (paid − cost − extras)`, where `f = 1 + elasticity × (p′ − p) ÷ p` and the paid price scales with the menu price (happy-hour discounts and event pricing are kept). Candidates: +$0.25 to the maximum step, and the price that hits the target.
- **Change a call up-charge** to u′: `calls × (Δ × pf − (1 − pf) × margin)`, `pf = 1 + elasticity × Δ ÷ u`, plus a reprice of every menu drink that contains the bottle so the ladder holds (bundled into the same move). Candidates: +$0.25 to the maximum step, and the up-charge that keeps a 25% margin.
- **Trim a pour** by 12.5% (2 fl oz → 1.75): `units × pours trimmed × pour cost`; spirits, liqueurs, wine, sweeteners, mixers, juices and citrus only; flagged for a taste test and the bar manager's sign-off.
- **Replace a bottle in menu specs** with a same-category alternative costing at least half as much (called bottles only with called bottles): `pours × (old cost − new cost)`; flagged for sign-off. When a bottle is unavailable the substitute applies everywhere, well & call included, and the move's value is what it wins back against the baseline: the kept drinks' contribution, the cost difference, and the substitute's up-charge (if any) on the calls.
- **Remove a drink** (Dogs only, menu drinks only): `−(its contribution) + retention × units × average contribution of the other drinks in its section`.
- **List a combination** from the candidates in 12c: `units × (price − cost − extras) − cannibal × units × average section contribution`, units = what guests already order per restaurant-week.

Ranking: the estimate, discounted ×0.8 if the drink stays over target, ×0.75 if more than 15% of volume is at risk, ×0.7 for bottle replacements, ×0.95 for other sign-off moves, ×0.8 for removals, and ×1.5 for a move that repairs the ladder. One entry per move and target. The plan takes moves in rank order, at most five, skipping any worth less than 5% of the best, with at most one price move and one spec move per drink, no move on a removed drink, one bottle per swap, one new drink. Moves can be ticked on and off; the plan is then re-verified. Verification = `analyze` with every chosen move merged into one scenario (for a lost bottle, a substitute replaces the baseline); the verified figure is the headline, the quick estimate is shown beside it.

## 13. Reconciliation test

Per restaurant-month with an `actuals` row (channel filter ignored; food lines left out):

```
theoretical %   = Σ line cost ÷ Σ line beverage revenue (sales file)
+ logged waste  = (Σ line cost + waste cost in the month) ÷ Σ line revenue
books %         = actual_beverage_cost ÷ (net_sales from the books, or the sales file if blank)
gap             = books % − theoretical %   (points)
```

Verdict, decided before the test (`CostModel.RECON`):

| Check | Rule | Result |
|---|---|---|
| Coverage | costed revenue ÷ revenue ≥ 97% | otherwise **Not assessable** |
| Sales agree | \|file − books\| ÷ books ≤ 2% | otherwise **Review** (fix the extract first) |
| Gap | 0 to +4.0 points | **Pass** |
| Gap | −1.5 to 0, or +4.0 to +7.0 | **Review** |
| Gap | below −1.5 or above +7.0 | **Fail** |

Why a positive gap is the expected result: the books carry over-pours, spills, comps, breakage and shrink; theoretical does not. Bars run a wider gap than kitchens, so the bands are wider than a food-cost test's. Theoretical above the books means specs, pours or costs are overstated. Overall: Pass only if every judged restaurant-month passes; Fail if any fails; otherwise Review.

## 14. Cost history and strength

- **Cost history**: for each `effective_date`, every ingredient whose cost changed and every menu drink whose cost moved, with the bottle that drove the largest part of the move.
- **Strength**: alcohol per drink = Σ pours × pour volume (fl oz) × ABV ÷ 100 over the spec, before dilution, reported in US standard drinks (0.6 fl oz of pure alcohol). Over two standard drinks is flagged for responsible service. Needs `abv_pct` in the ingredients file; count-unit pours (a dash) contribute nothing.

## 15. Assumptions and limits

- A pour is the same size everywhere unless the spec or modifier says otherwise; the tool does not know about free-pour drift between bars (the theoretical vs actual table is where that shows).
- Demand responses (elasticity, retention, cannibalization) are user-set assumptions applied linearly. They are for comparing options, not forecasting.
- Call economics assume a called spirit replaces the well of its category; if a guest adds a second spirit, the modifier row's quantity carries that.
- Scope filters apply to sales; cost versions apply by date regardless of scope. Costed-at date for the Costs view is the last sales day in scope (or the latest cost date without sales). The Price change flow defaults its base period to the latest month; Menu change uses all loaded months.
- Every figure in the guided flows can be hovered for its formula, the values plugged in and the source file; figures that depend on a user-set assumption (elasticity, retention, share pulled from the section, forecast units) are shown in amber and say so.
- Checks without `order_id` are treated as single-line checks, which disables food pairing, check lift and cannibalization.
- No labor, occupancy, glass breakage beyond the extras file, or discounts beyond what `net_price` already reflects.
