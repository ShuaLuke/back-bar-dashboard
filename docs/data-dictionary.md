# Data dictionary

The input files the Cost & sales tool reads, with exact column names, types and units. Blank templates with one example row are in `data/templates/`; filled examples are in `data/sample/` and downloadable from the tool's Data tab.

General rules:

- CSV, TSV or Excel (.xlsx). In a workbook, name each sheet after the file type (ingredients, drinks, …) and every sheet loads at once.
- Column order does not matter. Headers are matched by name, case-insensitively, ignoring spaces and punctuation; the alternative names listed below are recognised automatically, and anything else can be mapped by hand on load.
- Dates: YYYY-MM-DD preferred; M/D/YYYY, YYYYMMDD, D-Mon-YY and Excel date cells are accepted. Months: YYYY-MM.
- Money in dollars without symbols (12.50). Percentages as numbers (95 means 95%).
- Codes (restaurant_id, drink_id, ingredient_id) must match exactly across files. They are case-sensitive.
- Several files of the same type can be loaded together (one sales file per month, for example); their rows are concatenated.
- Rows the tool cannot use are never dropped silently: every problem is listed on the Data tab with the file, row and reason.

## Ingredients (bottle cost) · `ingredients.csv`

**Required.** One row per ingredient (a bottle, a juice, a syrup, a garnish) and cost version. Pour cost is computed from the bottle, or taken from pour_cost when given. Repeat an ingredient with a later effective_date to add a cost version, or with a restaurant_id to give one bar its own cost. A call brand is its own row with an upcharge.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `ingredient_id` | yes | text | Unique code. Matches ingredient_id in recipes, modifiers, waste and inventory. | `blanco-tequila` | sku, component_id, item_code, code, id, ingredient, product_id, bottle_id |
| `ingredient_name` | yes | text | Display name. | `Blanco tequila (well)` | name, component_name, description, ingredient, product, bottle |
| `category` | yes | text | What it is: Agave, Gin, Whiskey, Vodka, Rum & cane, Brandy & pisco, Other spirits, Liqueurs & amari, Vermouth & fortified, Wine & beer, Citrus, Fruit, Herbs & spices, Sweeteners, Bitters, Mixers, Dairy & egg, Savory or Extras. | `Agave` | station, group, family, type, class, spirit_type, ingredient_type |
| `bottle_cost` |  | num ($) | What one purchase unit (bottle, case, jug, bag) costs. | `21.50` | case_cost, case_price, bottle_price, unit_cost, purchase_cost, invoice_cost, cost_per_bottle, price_per_bottle, price |
| `bottle_size` |  | num | How much is in one purchase unit, in bottle_unit. | `750` | case_size, size, pack_size, volume, bottle_volume, purchase_qty, quantity |
| `bottle_unit` |  | text | Unit of bottle_size: ml, l, fl oz, oz, lb, kg, qt, gal, each, dozen, case. | `ml` | case_unit, purchase_unit, size_unit, uom, unit, volume_unit |
| `pour_size` |  | num | One standard pour (or garnish), in pour_unit. | `1` | portion_size, pour, serving_size, portion, standard_pour, pour_oz |
| `pour_unit` |  | text | Unit of pour_size: fl oz, ml, oz, each, dash, sprig, wedge, slice, rim. Must be the same kind (volume, weight or count) as bottle_unit. | `fl oz` | portion_unit, serving_unit, pour_uom |
| `yield_pct` |  | num (%) | Usable share after spillage, evaporation, juicing or trim, 0–100. Blank = 100. | `95` | yield, yield_percent, usable_pct, usable |
| `pour_cost` |  | num ($) | Optional. If given, used as the cost of one pour instead of the bottle math. | `0.84` | portion_cost, cost_per_pour, cost_per_portion, unit_pour_cost, cost, pour_price |
| `upcharge` |  | num ($) | What a guest pays to call this brand in a well & call drink. Blank = 0 (well). | `4.00` | up_charge, call_upcharge, premium, add_on_price, modifier_price, surcharge, extra_charge, call_price |
| `effective_date` |  | date | The day this cost takes effect. Blank = from the start. Later dates make cost versions. | `2026-09-01` | date, as_of, effective, valid_from, start_date, cost_date, price_date, invoice_date |
| `restaurant_id` |  | text | Blank = every restaurant. A row with a restaurant_id gives that bar its own cost. |  | store_id, location_id, store_number, store_no, store, location, restaurant, bar, venue, unit_number, site |
| `perishable` |  | bool | 1 if it spoils within days (fresh juice, herbs, cut fruit, dairy). Used for waste exposure. | `1` | fresh, is_perishable |
| `shelf_life_days` |  | num | Days it keeps once prepped or opened. | `3` | shelf_life |
| `prep_steps` |  | num | Prep steps per batch (default 1): juicing, syrup making, infusions. Used for prep load. | `2` | steps, prep, prep_step_count |
| `par_pours` |  | num | Daily par in pours, for waste exposure. | `60` | par, par_level, daily_par, par_portions |
| `abv_pct` |  | num (%) | Alcohol by volume, 0–100, for the strength check (standard drinks per cocktail). | `40` | abv, alcohol, proof_pct, alcohol_pct |

## Drinks (menu) · `drinks.csv`

**Required.** One row per menu drink. Well & call drinks (a spirit plus a mixer, built at the POS) are drinks too (custom = 1) with no recipe rows: their ingredients come from the modifiers file. Food items from the same checks can be listed with a section that says food, plate, entrée or dessert; they need no recipe and are used for pairing. Repeat a drink with a restaurant_id to give that bar its own price.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `drink_id` | yes | text | Unique code. Matches drink_id in recipes and sales. | `oyamel-margarita` | id, plu, item_id, menu_item_id, product_id, sku, code, item, drink |
| `drink_name` | yes | text | Display name. | `Oyamel Margarita` | name, item_name, item, menu_item, product, description, drink, cocktail |
| `section` | yes | text | Menu section: Cocktails, Margaritas, Zero-proof, Well & call, Small plates, … Sections whose name says food, plate, entrée, dessert, snack or tapa count as food. | `Margaritas` | line, menu_section, category, menu_category, group, department, menu_line |
| `price` | yes | num ($) | Menu price before call up-charges. | `16.00` | menu_price, base_price, list_price, retail, retail_price, unit_price |
| `custom` |  | bool | 1 for a well & call drink built from modifiers at the POS (spirit + mixer), with no fixed recipe. | `0` | byo, build_your_own, is_custom, well_drink, customizable, modifier_driven |
| `active` |  | bool | 0 to keep a drink in the files but off the menu. Blank = 1. | `1` | is_active, on_menu, status, enabled |
| `restaurant_id` |  | text | Blank = every restaurant. A row with a restaurant_id overrides the price at that bar. |  | store_id, location_id, store_number, store_no, store, location, restaurant, bar, venue |

## Recipes (specs) · `recipes.csv`

**Required.** One row per ingredient in each menu drink: the spec. Give qty in a unit (2 fl oz, 1 dash, 1 each) or leave unit blank to count standard pours of that ingredient (0.5 is half a pour, 2 is a double).

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `drink_id` | yes | text | From drinks. | `oyamel-margarita` | id, plu, item_id, menu_item_id, product_id, item, drink |
| `ingredient_id` | yes | text | From ingredients. | `blanco-tequila` | sku, component_id, component, ingredient, modifier_id, bottle_id |
| `qty` | yes | num | Amount in unit, or in standard pours when unit is blank. | `2` | portions, pours, quantity, amount, qty_oz, oz, count, servings |
| `unit` |  | text | fl oz, ml, oz, dash, each, sprig, wedge, … Blank = standard pours of the ingredient. | `fl oz` | uom, qty_unit, measure, units |

## Sales (check lines) · `sales.csv`

Needed for sales, scenarios and reconciliation. One row per item line on each check, from the POS: drinks and, if you have them, food lines on the same checks. order_id lets the tool see what was bought together (food pairing, check size, cannibalization). Without it each row counts as its own check.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `order_id` |  | text | Check or order number, unique within a restaurant and day. | `OYA-20260701-0042` | order, check_id, check, ticket, ticket_id, transaction_id, receipt, order_number, check_number |
| `line_id` |  | text | Line number within the check. Lets modifiers attach to the right line when a check holds the same drink twice. | `1` | line, line_no, line_number, seq, order_line_id, sequence |
| `restaurant_id` | yes | text | From restaurants. | `OYA` | store_id, location_id, store_number, store_no, store, location, restaurant, bar, venue, unit_number, site |
| `date` | yes | date | Business date, YYYY-MM-DD (M/D/YYYY and Excel dates are accepted). | `2026-07-01` | business_date, order_date, day, transaction_date, sale_date, check_date |
| `time` |  | text | HH:MM, 24-hour. Used for dayparts when daypart is blank. | `19:35` | order_time, time_of_day, timestamp, sale_time, check_time |
| `channel` |  | text | dine_in, bar, takeout, delivery or event. Blank = dine_in. | `bar` | order_channel, source, order_type, order_source, revenue_center, service, seating, area, ordering_channel |
| `daypart` |  | text | Optional: lunch, happy_hour, dinner, late. Computed from time when blank. | `dinner` | meal_period, day_part, shift |
| `drink_id` | yes | text | From drinks. A well & call order uses the custom drink for its line (WELL-CALL). | `WELL-CALL` | plu, item_id, menu_item_id, product_id, sku, item, menu_item, drink |
| `qty` | yes | num | Units on the line. Blank = 1. | `1` | quantity, units, count |
| `net_price` |  | num ($) | Price actually paid per unit, after discounts and comps, including call up-charges. Blank = menu price plus the up-charges of its modifiers. | `16.00` | price, unit_price, net, net_amount, amount, gross_price, sale_price, net_sales |

## Modifiers (calls and swaps) · `modifiers.csv`

Needed for well & call analysis. One row per ingredient picked on a check line: every ingredient of a well & call drink (the spirit, well or called, and the mixer), or a swap or add on a menu drink (make it with mezcal). qty 2 is a double; give a unit to pick an amount instead of standard pours.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `order_id` | yes | text | From sales. | `OYA-20260701-0042` | order, check_id, check, ticket, ticket_id, transaction_id, order_number, check_number |
| `line_id` |  | text | From sales. Blank = the first line on the check with this drink_id. | `1` | line, line_no, line_number, seq, order_line_id |
| `drink_id` |  | text | The drink on the check the modifier belongs to; used when line_id is blank. | `WELL-CALL` | plu, item_id, menu_item_id, product_id, item, parent_item, drink |
| `ingredient_id` | yes | text | From ingredients. | `casamigos-blanco` | modifier, modifier_id, sku, component_id, component, ingredient, modifier_code, bottle_id |
| `qty` |  | num | Pours picked (or amount in unit). Blank = 1. | `1` | quantity, pours, portions, count, modifier_qty, amount |
| `unit` |  | text | Optional unit for qty (fl oz, ml). Blank = standard pours. |  | uom, qty_unit, measure |

## Restaurants · `restaurants.csv`

Optional. Restaurant names and groups for the multi-bar views. Restaurants named only in sales still work; they just show as their code.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `restaurant_id` | yes | text | Unique code used in every other file. | `OYA` | store_id, location_id, store_number, store_no, store, location, restaurant, bar, venue, unit_number, site, id |
| `restaurant_name` |  | text | Display name. | `Oyamel` | name, store_name, location_name, restaurant, venue_name |
| `group` |  | text | Restaurant group or region for roll-ups. | `José Andrés Group` | region, market, area, district, company, brand |
| `city` |  | text |  | `Washington` |  |
| `state` |  | text |  | `DC` | st |

## Extras (ice, garnish, glassware) · `extras.csv`

Optional. Non-ingredient cost per drink by menu section and service: ice, garnish, straw, napkin, glass breakage share, to-go cup. channel is in_house (dine-in and bar), to_go (takeout, delivery, event) or all; section can be all.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `section` | yes | text | Menu section from drinks, or all. | `Cocktails` | line, menu_section, category, menu_line |
| `channel` | yes | text | in_house, to_go or all. | `in_house` | service, order_type, mode |
| `cost` | yes | num ($) | Extras cost per drink. | `0.35` | extras_cost, packaging_cost, garnish_cost, amount, cost_per_drink |

## Waste log · `waste.csv`

Optional. Pours thrown away or spilled, by restaurant, day and ingredient: dead juice, spoiled garnish, breakage, spill, comps. Replaces the flat waste assumption.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `restaurant_id` | yes | text | From restaurants. | `OYA` | store_id, location_id, store_number, store_no, store, location, restaurant, bar |
| `date` | yes | date | Day logged. | `2026-07-03` | business_date, log_date, day |
| `ingredient_id` | yes | text | From ingredients. | `lime-juice` | sku, component_id, component, ingredient, bottle_id |
| `qty_pours` | yes | num | Pours wasted. | `12` | qty, quantity, pours, portions, qty_portions, waste_qty, amount, units |
| `reason` |  | text | Optional: spoilage, spill, breakage, comp, over-prep, expired. | `spoilage` | waste_reason, type, category |

## Actuals (books) · `actuals.csv`

Needed for the reconciliation test. Beverage (liquor) cost from the books, one row per restaurant and month, for the reconciliation test.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `restaurant_id` | yes | text | From restaurants. | `OYA` | store_id, location_id, store_number, store_no, store, location, restaurant, bar |
| `period` | yes | month | Month, YYYY-MM. | `2026-07` | month, fiscal_period, period_name, accounting_period |
| `actual_beverage_cost` | yes | num ($) | Beverage cost of goods sold for the month, from the P&L (liquor, wine, beer and mixers for the drinks in the sales file). | `31250.00` | cogs, beverage_cost, liquor_cost, bar_cost, actual_cogs, actual_cost, actual_food_cost, cost_of_goods, pour_cost |
| `net_sales` |  | num ($) | Net beverage sales for the month from the books. Blank = the sum of the sales file. | `148900.00` | sales, revenue, net_revenue, actual_sales, total_sales, beverage_sales |

## Inventory counts · `inventory.csv`

Optional. Beginning count, purchases and ending count per restaurant, month and ingredient, in pours or in bottles (qty_unit), for theoretical vs actual usage.

| Column | Required | Type | Meaning | Example | Also recognised as |
|---|---|---|---|---|---|
| `restaurant_id` | yes | text | From restaurants. | `OYA` | store_id, location_id, store_number, store_no, store, location, restaurant, bar |
| `period` | yes | month | Month, YYYY-MM. | `2026-07` | month, fiscal_period, period_name |
| `ingredient_id` | yes | text | From ingredients. | `blanco-tequila` | sku, component_id, component, ingredient, bottle_id |
| `begin_qty` | yes | num | On hand at the start of the month, in qty_unit. | `14.5` | beginning, begin, opening, start_qty, begin_count, opening_count |
| `purchased_qty` | yes | num | Received during the month, in qty_unit. | `60` | purchases, received, purchased, receipts |
| `end_qty` | yes | num | On hand at the end, in qty_unit. | `12.2` | ending, end, closing, end_count, closing_count |
| `qty_unit` |  | text | pours (blank), bottles, or a volume unit (ml, l, fl oz). Bottles use the ingredient's bottle_size. | `bottles` | unit, uom, count_unit |

## Units

Volume: ml, l, fl oz, cup, pt, qt, gal. Weight: g, kg, oz, lb (note: `oz` is weight; a liquid pour is `fl oz`). Count: each, dash, drop, sprig, leaf, wedge, wheel, slice, twist, peel, rim, cube, splash, barspoon, pinch, egg, bottle, can, dozen. A bottle and its pour must use the same kind of unit; a weight bottle with a volume pour is reported as a unit mismatch. Bitters are easiest to cost by the dash: a 16 fl oz bottle is about 480 dashes, so `bottle_size 480, bottle_unit dash, pour_size 1, pour_unit dash`.

## Recipe quantities

A recipe row gives `qty` in a `unit` (2 fl oz of tequila, 1 dash of bitters, 1 each of a lime wedge), converted to the ingredient's standard pours through its `pour_size`. Leave `unit` blank to count standard pours directly (0.5 is a half pour, 2 a double). The same rule applies to modifiers.

## Channels and dayparts

Channel values are normalised to dine_in, bar, takeout, delivery, event or other (so "Patio", "Bar Top", "DoorDash" and "Private Dining" all work). Dayparts, when not given, come from the time column: before 15:00 lunch, 15:00–17:59 happy hour, 18:00–20:59 dinner, 21:00 to 03:59 late.

## Minimum sets

- Costs only: ingredients, drinks, recipes.
- Sales, menu engineering, scenarios with volumes: add sales (and modifiers for well & call drinks and swaps).
- Reconciliation test: add actuals.
- Everything: add restaurants, extras, waste and inventory. Food lines on the same checks (in sales, with their drinks rows) switch on the food-pairing views.
