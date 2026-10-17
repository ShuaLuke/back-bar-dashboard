/* Well & Call cost model: the computation engine behind the Cost & sales tool (bar version).
   Pure JavaScript, no dependencies, no network. Runs in the browser (window.CostModel) and under Node
   (module.exports) so the same code is unit-tested with hand-calculated cases (tests/costmodel.test.js).
   Every formula here is written up in docs/methodology.md; keep the two in step. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CostModel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- 1. Input templates (the data dictionary) ---------- */
  // Each file type lists its columns: key, required, type (text|num|int|date|month|bool), unit, description, example
  // and the alternative header names the column mapper recognises. Headers are matched after normalisation
  // (lower case, anything that isn't a letter or digit becomes "_").
  const T = (k, req, type, desc, ex, aliases, unit) => ({ k, req: !!req, type, desc, ex, aliases: aliases || [], unit });
  const TEMPLATES = {
    ingredients: {
      label: "Ingredients (bottle cost)", need: "required", file: "ingredients.csv",
      desc: "One row per ingredient (a bottle, a juice, a syrup, a garnish) and cost version. Pour cost is computed from the bottle, or taken from pour_cost when given. Repeat an ingredient with a later effective_date to add a cost version, or with a restaurant_id to give one bar its own cost. A call brand is its own row with an upcharge.",
      cols: [
        T("ingredient_id", 1, "text", "Unique code. Matches ingredient_id in recipes, modifiers, waste and inventory.", "blanco-tequila", ["sku", "component_id", "item_code", "code", "id", "ingredient", "product_id", "bottle_id"]),
        T("ingredient_name", 1, "text", "Display name.", "Blanco tequila (well)", ["name", "component_name", "description", "ingredient", "product", "bottle"]),
        T("category", 1, "text", "What it is: Agave, Gin, Whiskey, Vodka, Rum & cane, Brandy & pisco, Other spirits, Liqueurs & amari, Vermouth & fortified, Wine & beer, Citrus, Fruit, Herbs & spices, Sweeteners, Bitters, Mixers, Dairy & egg, Savory or Extras.", "Agave", ["station", "group", "family", "type", "class", "spirit_type", "ingredient_type"]),
        T("bottle_cost", 0, "num", "What one purchase unit (bottle, case, jug, bag) costs.", "21.50", ["case_cost", "case_price", "bottle_price", "unit_cost", "purchase_cost", "invoice_cost", "cost_per_bottle", "price_per_bottle", "price"], "$"),
        T("bottle_size", 0, "num", "How much is in one purchase unit, in bottle_unit.", "750", ["case_size", "size", "pack_size", "volume", "bottle_volume", "purchase_qty", "quantity"]),
        T("bottle_unit", 0, "text", "Unit of bottle_size: ml, l, fl oz, oz, lb, kg, qt, gal, each, dozen, case.", "ml", ["case_unit", "purchase_unit", "size_unit", "uom", "unit", "volume_unit"]),
        T("pour_size", 0, "num", "One standard pour (or garnish), in pour_unit.", "1", ["portion_size", "pour", "serving_size", "portion", "standard_pour", "pour_oz"]),
        T("pour_unit", 0, "text", "Unit of pour_size: fl oz, ml, oz, each, dash, sprig, wedge, slice, rim. Must be the same kind (volume, weight or count) as bottle_unit.", "fl oz", ["portion_unit", "serving_unit", "pour_uom"]),
        T("yield_pct", 0, "num", "Usable share after spillage, evaporation, juicing or trim, 0–100. Blank = 100.", "95", ["yield", "yield_percent", "usable_pct", "usable"], "%"),
        T("pour_cost", 0, "num", "Optional. If given, used as the cost of one pour instead of the bottle math.", "0.84", ["portion_cost", "cost_per_pour", "cost_per_portion", "unit_pour_cost", "cost", "pour_price"], "$"),
        T("upcharge", 0, "num", "What a guest pays to call this brand in a well & call drink. Blank = 0 (well).", "4.00", ["up_charge", "call_upcharge", "premium", "add_on_price", "modifier_price", "surcharge", "extra_charge", "call_price"], "$"),
        T("effective_date", 0, "date", "The day this cost takes effect. Blank = from the start. Later dates make cost versions.", "2026-09-01", ["date", "as_of", "effective", "valid_from", "start_date", "cost_date", "price_date", "invoice_date"]),
        T("restaurant_id", 0, "text", "Blank = every restaurant. A row with a restaurant_id gives that bar its own cost.", "", ["store_id", "location_id", "store_number", "store_no", "store", "location", "restaurant", "bar", "venue", "unit_number", "site"]),
        T("perishable", 0, "bool", "1 if it spoils within days (fresh juice, herbs, cut fruit, dairy). Used for waste exposure.", "1", ["fresh", "is_perishable"]),
        T("shelf_life_days", 0, "num", "Days it keeps once prepped or opened.", "3", ["shelf_life"]),
        T("prep_steps", 0, "num", "Prep steps per batch (default 1): juicing, syrup making, infusions. Used for prep load.", "2", ["steps", "prep", "prep_step_count"]),
        T("par_pours", 0, "num", "Daily par in pours, for waste exposure.", "60", ["par", "par_level", "daily_par", "par_portions"]),
        T("abv_pct", 0, "num", "Alcohol by volume, 0–100, for the strength check (standard drinks per cocktail).", "40", ["abv", "alcohol", "proof_pct", "alcohol_pct"], "%"),
      ],
    },
    drinks: {
      label: "Drinks (menu)", need: "required", file: "drinks.csv",
      desc: "One row per menu drink. Well & call drinks (a spirit plus a mixer, built at the POS) are drinks too (custom = 1) with no recipe rows: their ingredients come from the modifiers file. Food items from the same checks can be listed with a section that says food, plate, entrée or dessert; they need no recipe and are used for pairing. Repeat a drink with a restaurant_id to give that bar its own price.",
      cols: [
        T("drink_id", 1, "text", "Unique code. Matches drink_id in recipes and sales.", "oyamel-margarita", ["id", "plu", "item_id", "menu_item_id", "product_id", "sku", "code", "item", "drink"]),
        T("drink_name", 1, "text", "Display name.", "Oyamel Margarita", ["name", "item_name", "item", "menu_item", "product", "description", "drink", "cocktail"]),
        T("section", 1, "text", "Menu section: Cocktails, Margaritas, Zero-proof, Well & call, Small plates, … Sections whose name says food, plate, entrée, dessert, snack or tapa count as food.", "Margaritas", ["line", "menu_section", "category", "menu_category", "group", "department", "menu_line"]),
        T("price", 1, "num", "Menu price before call up-charges.", "16.00", ["menu_price", "base_price", "list_price", "retail", "retail_price", "unit_price"], "$"),
        T("custom", 0, "bool", "1 for a well & call drink built from modifiers at the POS (spirit + mixer), with no fixed recipe.", "0", ["byo", "build_your_own", "is_custom", "well_drink", "customizable", "modifier_driven"]),
        T("active", 0, "bool", "0 to keep a drink in the files but off the menu. Blank = 1.", "1", ["is_active", "on_menu", "status", "enabled"]),
        T("restaurant_id", 0, "text", "Blank = every restaurant. A row with a restaurant_id overrides the price at that bar.", "", ["store_id", "location_id", "store_number", "store_no", "store", "location", "restaurant", "bar", "venue"]),
      ],
    },
    recipes: {
      label: "Recipes (specs)", need: "required", file: "recipes.csv",
      desc: "One row per ingredient in each menu drink: the spec. Give qty in a unit (2 fl oz, 1 dash, 1 each) or leave unit blank to count standard pours of that ingredient (0.5 is half a pour, 2 is a double).",
      cols: [
        T("drink_id", 1, "text", "From drinks.", "oyamel-margarita", ["id", "plu", "item_id", "menu_item_id", "product_id", "item", "drink"]),
        T("ingredient_id", 1, "text", "From ingredients.", "blanco-tequila", ["sku", "component_id", "component", "ingredient", "modifier_id", "bottle_id"]),
        T("qty", 1, "num", "Amount in unit, or in standard pours when unit is blank.", "2", ["portions", "pours", "quantity", "amount", "qty_oz", "oz", "count", "servings"]),
        T("unit", 0, "text", "fl oz, ml, oz, dash, each, sprig, wedge, … Blank = standard pours of the ingredient.", "fl oz", ["uom", "qty_unit", "measure", "units"]),
      ],
    },
    sales: {
      label: "Sales (check lines)", need: "for sales, scenarios and reconciliation", file: "sales.csv",
      desc: "One row per item line on each check, from the POS: drinks and, if you have them, food lines on the same checks. order_id lets the tool see what was bought together (food pairing, check size, cannibalization). Without it each row counts as its own check.",
      cols: [
        T("order_id", 0, "text", "Check or order number, unique within a restaurant and day.", "OYA-20260701-0042", ["order", "check_id", "check", "ticket", "ticket_id", "transaction_id", "receipt", "order_number", "check_number"]),
        T("line_id", 0, "text", "Line number within the check. Lets modifiers attach to the right line when a check holds the same drink twice.", "1", ["line", "line_no", "line_number", "seq", "order_line_id", "sequence"]),
        T("restaurant_id", 1, "text", "From restaurants.", "OYA", ["store_id", "location_id", "store_number", "store_no", "store", "location", "restaurant", "bar", "venue", "unit_number", "site"]),
        T("date", 1, "date", "Business date, YYYY-MM-DD (M/D/YYYY and Excel dates are accepted).", "2026-07-01", ["business_date", "order_date", "day", "transaction_date", "sale_date", "check_date"]),
        T("time", 0, "text", "HH:MM, 24-hour. Used for dayparts when daypart is blank.", "19:35", ["order_time", "time_of_day", "timestamp", "sale_time", "check_time"]),
        T("channel", 0, "text", "dine_in, bar, takeout, delivery or event. Blank = dine_in.", "bar", ["order_channel", "source", "order_type", "order_source", "revenue_center", "service", "seating", "area", "ordering_channel"]),
        T("daypart", 0, "text", "Optional: lunch, happy_hour, dinner, late. Computed from time when blank.", "dinner", ["meal_period", "day_part", "shift"]),
        T("drink_id", 1, "text", "From drinks. A well & call order uses the custom drink for its line (WELL-CALL).", "WELL-CALL", ["plu", "item_id", "menu_item_id", "product_id", "sku", "item", "menu_item", "drink"]),
        T("qty", 1, "num", "Units on the line. Blank = 1.", "1", ["quantity", "units", "count"]),
        T("net_price", 0, "num", "Price actually paid per unit, after discounts and comps, including call up-charges. Blank = menu price plus the up-charges of its modifiers.", "16.00", ["price", "unit_price", "net", "net_amount", "amount", "gross_price", "sale_price", "net_sales"], "$"),
      ],
    },
    modifiers: {
      label: "Modifiers (calls and swaps)", need: "for well & call analysis", file: "modifiers.csv",
      desc: "One row per ingredient picked on a check line: every ingredient of a well & call drink (the spirit, well or called, and the mixer), or a swap or add on a menu drink (make it with mezcal). qty 2 is a double; give a unit to pick an amount instead of standard pours.",
      cols: [
        T("order_id", 1, "text", "From sales.", "OYA-20260701-0042", ["order", "check_id", "check", "ticket", "ticket_id", "transaction_id", "order_number", "check_number"]),
        T("line_id", 0, "text", "From sales. Blank = the first line on the check with this drink_id.", "1", ["line", "line_no", "line_number", "seq", "order_line_id"]),
        T("drink_id", 0, "text", "The drink on the check the modifier belongs to; used when line_id is blank.", "WELL-CALL", ["plu", "item_id", "menu_item_id", "product_id", "item", "parent_item", "drink"]),
        T("ingredient_id", 1, "text", "From ingredients.", "casamigos-blanco", ["modifier", "modifier_id", "sku", "component_id", "component", "ingredient", "modifier_code", "bottle_id"]),
        T("qty", 0, "num", "Pours picked (or amount in unit). Blank = 1.", "1", ["quantity", "pours", "portions", "count", "modifier_qty", "amount"]),
        T("unit", 0, "text", "Optional unit for qty (fl oz, ml). Blank = standard pours.", "", ["uom", "qty_unit", "measure"]),
      ],
    },
    restaurants: {
      label: "Restaurants", need: "optional", file: "restaurants.csv",
      desc: "Restaurant names and groups for the multi-bar views. Restaurants named only in sales still work; they just show as their code.",
      cols: [
        T("restaurant_id", 1, "text", "Unique code used in every other file.", "OYA", ["store_id", "location_id", "store_number", "store_no", "store", "location", "restaurant", "bar", "venue", "unit_number", "site", "id"]),
        T("restaurant_name", 0, "text", "Display name.", "Oyamel", ["name", "store_name", "location_name", "restaurant", "venue_name"]),
        T("group", 0, "text", "Restaurant group or region for roll-ups.", "José Andrés Group", ["region", "market", "area", "district", "company", "brand"]),
        T("city", 0, "text", "", "Washington", []),
        T("state", 0, "text", "", "DC", ["st"]),
      ],
    },
    extras: {
      label: "Extras (ice, garnish, glassware)", need: "optional", file: "extras.csv",
      desc: "Non-ingredient cost per drink by menu section and service: ice, garnish, straw, napkin, glass breakage share, to-go cup. channel is in_house (dine-in and bar), to_go (takeout, delivery, event) or all; section can be all.",
      cols: [
        T("section", 1, "text", "Menu section from drinks, or all.", "Cocktails", ["line", "menu_section", "category", "menu_line"]),
        T("channel", 1, "text", "in_house, to_go or all.", "in_house", ["service", "order_type", "mode"]),
        T("cost", 1, "num", "Extras cost per drink.", "0.35", ["extras_cost", "packaging_cost", "garnish_cost", "amount", "cost_per_drink"], "$"),
      ],
    },
    waste: {
      label: "Waste log", need: "optional", file: "waste.csv",
      desc: "Pours thrown away or spilled, by restaurant, day and ingredient: dead juice, spoiled garnish, breakage, spill, comps. Replaces the flat waste assumption.",
      cols: [
        T("restaurant_id", 1, "text", "From restaurants.", "OYA", ["store_id", "location_id", "store_number", "store_no", "store", "location", "restaurant", "bar"]),
        T("date", 1, "date", "Day logged.", "2026-07-03", ["business_date", "log_date", "day"]),
        T("ingredient_id", 1, "text", "From ingredients.", "lime-juice", ["sku", "component_id", "component", "ingredient", "bottle_id"]),
        T("qty_pours", 1, "num", "Pours wasted.", "12", ["qty", "quantity", "pours", "portions", "qty_portions", "waste_qty", "amount", "units"]),
        T("reason", 0, "text", "Optional: spoilage, spill, breakage, comp, over-prep, expired.", "spoilage", ["waste_reason", "type", "category"]),
      ],
    },
    actuals: {
      label: "Actuals (books)", need: "for the reconciliation test", file: "actuals.csv",
      desc: "Beverage (liquor) cost from the books, one row per restaurant and month, for the reconciliation test.",
      cols: [
        T("restaurant_id", 1, "text", "From restaurants.", "OYA", ["store_id", "location_id", "store_number", "store_no", "store", "location", "restaurant", "bar"]),
        T("period", 1, "month", "Month, YYYY-MM.", "2026-07", ["month", "fiscal_period", "period_name", "accounting_period"]),
        T("actual_beverage_cost", 1, "num", "Beverage cost of goods sold for the month, from the P&L (liquor, wine, beer and mixers for the drinks in the sales file).", "31250.00", ["cogs", "beverage_cost", "liquor_cost", "bar_cost", "actual_cogs", "actual_cost", "actual_food_cost", "cost_of_goods", "pour_cost"], "$"),
        T("net_sales", 0, "num", "Net beverage sales for the month from the books. Blank = the sum of the sales file.", "148900.00", ["sales", "revenue", "net_revenue", "actual_sales", "total_sales", "beverage_sales"], "$"),
      ],
    },
    inventory: {
      label: "Inventory counts", need: "optional", file: "inventory.csv",
      desc: "Beginning count, purchases and ending count per restaurant, month and ingredient, in pours or in bottles (qty_unit), for theoretical vs actual usage.",
      cols: [
        T("restaurant_id", 1, "text", "From restaurants.", "OYA", ["store_id", "location_id", "store_number", "store_no", "store", "location", "restaurant", "bar"]),
        T("period", 1, "month", "Month, YYYY-MM.", "2026-07", ["month", "fiscal_period", "period_name"]),
        T("ingredient_id", 1, "text", "From ingredients.", "blanco-tequila", ["sku", "component_id", "component", "ingredient", "bottle_id"]),
        T("begin_qty", 1, "num", "On hand at the start of the month, in qty_unit.", "14.5", ["beginning", "begin", "opening", "start_qty", "begin_count", "opening_count"]),
        T("purchased_qty", 1, "num", "Received during the month, in qty_unit.", "60", ["purchases", "received", "purchased", "receipts"]),
        T("end_qty", 1, "num", "On hand at the end, in qty_unit.", "12.2", ["ending", "end", "closing", "end_count", "closing_count"]),
        T("qty_unit", 0, "text", "pours (blank), bottles, or a volume unit (ml, l, fl oz). Bottles use the ingredient's bottle_size.", "bottles", ["unit", "uom", "count_unit"]),
      ],
    },
  };
  const TYPES = Object.keys(TEMPLATES);
  const CORE = ["ingredients", "drinks", "recipes"];
  const FAMS = ["spirit", "liqueur", "wine", "citrus", "fruit", "herb", "sweet", "mixer", "other", "extras"];

  /* ---------- 2. Small utilities ---------- */
  const norm = s => String(s == null ? "" : s).replace(/^﻿/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const num = v => { if (v == null) return null; if (typeof v === "number") return Number.isFinite(v) ? v : null; const s = String(v).trim().replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1"); if (s === "" || s === "-") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const bool = v => { if (v == null || v === "") return null; if (typeof v === "boolean") return v; const s = String(v).trim().toLowerCase(); if (["1", "y", "yes", "true", "t", "x", "active", "on"].includes(s)) return true; if (["0", "n", "no", "false", "f", "inactive", "off"].includes(s)) return false; return null; };
  const pad2 = n => (n < 10 ? "0" : "") + n;
  const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
  function toISODate(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") { if (v > 20000 && v < 80000) { const d = new Date(EXCEL_EPOCH + Math.round(v) * 86400000); return d.toISOString().slice(0, 10); } return null; }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
    m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/); if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return `${y}-${pad2(+m[1])}-${pad2(+m[2])}`; }
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/); if (m) { const mo = "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(m[2].toLowerCase()) / 3; if (mo >= 0) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return `${y}-${pad2(mo + 1)}-${pad2(+m[1])}`; } }
    const n = Number(s); if (Number.isFinite(n) && n > 20000 && n < 80000) return toISODate(n);
    return null;
  }
  function toMonth(v) { if (v == null || v === "") return null; const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{1,2})$/); if (m) return `${m[1]}-${pad2(+m[2])}`; m = s.match(/^(\d{1,2})\/(\d{4})$/); if (m) return `${m[2]}-${pad2(+m[1])}`; m = s.match(/^(\d{4})(\d{2})$/); if (m) return `${m[1]}-${m[2]}`; const d = toISODate(s); return d ? d.slice(0, 7) : null; }
  function toTime(v) { if (v == null || v === "") return null; const s = String(v).trim(); let m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/); if (!m) { const n = Number(s); if (Number.isFinite(n) && n >= 0 && n < 1) { const mins = Math.round(n * 1440); return pad2(Math.floor(mins / 60)) + ":" + pad2(mins % 60); } return null; } let h = +m[1]; const mi = +m[2]; if (m[3]) { const pm = m[3].toLowerCase() === "pm"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } return pad2(h) + ":" + pad2(mi); }
  const daypartNorm = v => { const s = norm(v); if (/happy|hh|afternoon/.test(s)) return "happy_hour"; if (/late|night|close/.test(s)) return "late"; if (/dinner|evening|pm_service/.test(s)) return "dinner"; if (/lunch|brunch|day|breakfast|morning/.test(s)) return "lunch"; return s || "unknown"; };
  const dayOfWeek = iso => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(iso + "T12:00:00Z").getUTCDay()];
  function daypartOf(time) { if (!time) return "unknown"; const h = +time.slice(0, 2); return h < 4 ? "late" : h < 15 ? "lunch" : h < 18 ? "happy_hour" : h < 21 ? "dinner" : "late"; }
  const DAYPARTS = ["lunch", "happy_hour", "dinner", "late", "unknown"];
  const CHANNELS = ["dine_in", "bar", "takeout", "delivery", "event", "other"];
  function channelOf(v) {
    const s = norm(v); if (!s) return "dine_in";
    if (/^(dine|dining|table|restaurant|in_house|inhouse|in_store|instore|pos|counter|main|floor|patio|terrace|garden|room)/.test(s)) return "dine_in";
    if (/^(bar|lounge|rail|counter_bar|bar_top|cocktail)/.test(s) || /\bbar\b/.test(s.replace(/_/g, " "))) return "bar";
    if (/take|to_go|togo|pickup|pick_up|carry|app|online|web|mobile/.test(s)) return "takeout";
    if (/deliver|doordash|uber|grubhub|postmates|third|3p|marketplace/.test(s)) return "delivery";
    if (/event|private|banquet|cater|party|buyout/.test(s)) return "event";
    return "other";
  }
  const pkgChannel = ch => ch === "dine_in" || ch === "bar" ? "in_house" : "to_go";
  const ZERO_LINE = /zero|n\/a|non-?alc|mocktail|spirit-?free|temperance|soft/i;
  const FOOD_LINE = /food|plate|entr|dessert|snack|kitchen|share|tapa|meze|taco|dish|appet|starter|pizza|burger|sandwich|salad|brunch|raw bar|oyster/i;
  const CAT_FAM = s => { const t = norm(s);
    if (/(^|_)(extras?|ice|glass|glassware|straws?|napkins?|supply|supplies|paper|packaging|smallwares?)(_|$)/.test(t)) return "extras";
    if (/agave|tequila|mezcal|whisk|bourbon|rye|scotch|gin|vodka|rum|cane|cacha|brandy|pisco|cognac|spirit|sotol|ouzo|sake|shochu|absinthe|base|raki|grappa|baijiu/.test(t)) return "spirit";
    if (/liqueur|amar|aperitif|aperol|campari|chartreuse|cordial|cr_me|creme|schnapps/.test(t)) return "liqueur";
    if (/vermouth|fortified|sherry|wine|beer|cider|sparkling|champagne|cava|port|madeira|sake_wine/.test(t)) return "wine";
    if (/citrus|lime|lemon|grapefruit|orange|yuzu/.test(t)) return "citrus";
    if (/fruit|juice|puree|veg|produce|berry|melon|tropical/.test(t)) return "fruit";
    if (/herb|spice|garnish|botanical|flower|floral|tea_leaf/.test(t)) return "herb";
    if (/sweet|syrup|sugar|honey|bitter|nectar|cordial_syrup|shrub/.test(t)) return "sweet";
    if (/mixer|soda|tonic|water|cola|ginger|tea|coffee|juice_box|energy/.test(t)) return "mixer";
    return "other"; };
  const FAM_LABEL = { spirit: "Base spirits", liqueur: "Liqueurs & amari", wine: "Wine, vermouth & beer", citrus: "Citrus", fruit: "Fruit & veg", herb: "Herbs & spices", sweet: "Sweeteners & bitters", mixer: "Mixers", other: "Dairy, egg & savory", extras: "Extras" };
  const BAR_FAMS = new Set(["spirit", "liqueur", "wine", "citrus", "fruit", "herb", "sweet", "mixer", "other"]); // what the bar stocks (everything but extras)
  const TRIM_FAMS = ["spirit", "liqueur", "wine", "sweet", "mixer", "fruit", "citrus"]; // pours an advisor may suggest trimming
  const UNITS = (() => { const w = "w", v = "v", c = "c"; const u = {
    g: [w, 1], gram: [w, 1], grams: [w, 1], gr: [w, 1], kg: [w, 1000], kilogram: [w, 1000], oz: [w, 28.349523125], ounce: [w, 28.349523125], ounces: [w, 28.349523125], lb: [w, 453.59237], lbs: [w, 453.59237], pound: [w, 453.59237], pounds: [w, 453.59237],
    ml: [v, 1], milliliter: [v, 1], l: [v, 1000], liter: [v, 1000], litre: [v, 1000], floz: [v, 29.5735295625], fl_oz: [v, 29.5735295625], fluid_ounce: [v, 29.5735295625], fluid_ounces: [v, 29.5735295625], cup: [v, 236.5882365], cups: [v, 236.5882365], pt: [v, 473.176473], pint: [v, 473.176473], qt: [v, 946.352946], quart: [v, 946.352946], quarts: [v, 946.352946], gal: [v, 3785.411784], gallon: [v, 3785.411784], gallons: [v, 3785.411784],
    each: [c, 1], ea: [c, 1], ct: [c, 1], dash: [c, 1], dashes: [c, 1], drop: [c, 1], drops: [c, 1], sprig: [c, 1], sprigs: [c, 1], leaf: [c, 1], leaves: [c, 1], wedge: [c, 1], wedges: [c, 1], wheel: [c, 1], wheels: [c, 1], slice: [c, 1], slices: [c, 1], twist: [c, 1], twists: [c, 1], peel: [c, 1], rim: [c, 1], rims: [c, 1], cube: [c, 1], cubes: [c, 1], splash: [c, 1], splashes: [c, 1], barspoon: [c, 1], bsp: [c, 1], pinch: [c, 1], egg: [c, 1], eggs: [c, 1], olive: [c, 1], olives: [c, 1], cherry: [c, 1], cherries: [c, 1], count: [c, 1], pc: [c, 1], pcs: [c, 1], piece: [c, 1], pieces: [c, 1], unit: [c, 1], units: [c, 1], serving: [c, 1], servings: [c, 1], pour: [c, 1], pours: [c, 1], scoop: [c, 1], scoops: [c, 1], bag: [c, 1], bags: [c, 1], bottle: [c, 1], bottles: [c, 1], can: [c, 1], cans: [c, 1], cup_ct: [c, 1], sleeve: [c, 1], dozen: [c, 12], dz: [c, 12], case_ct: [c, 12] }; return u; })();
  // pours of an ingredient for a quantity in a unit: qty × unit ÷ the ingredient's pour size (same kind of unit required). Blank unit = standard pours.
  function toPours(c, qty, unit) { if (qty == null) return null; if (!unit) return qty; const u = unitOf(unit); if (!u) return { err: `unit "${unit}" is not a known unit` }; if (!c || !(c.pourSize > 0) || !c.pourUnit) return { err: `${c ? c.name : "the ingredient"} has no pour_size, so a quantity in ${unit} cannot be converted` }; const pu = unitOf(c.pourUnit); if (!pu) return { err: `pour_unit "${c.pourUnit}" is not a known unit` }; if (u[0] !== pu[0]) return { err: `unit mismatch: ${unit} is ${u[0] === "w" ? "weight" : u[0] === "v" ? "volume" : "count"} but ${c.name} pours in ${c.pourUnit}` }; return qty * u[1] / pu[1] / c.pourSize; }
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  // "2 fl oz" / "1 dash" / "1.5 pours" for a number of pours of an ingredient
  function fmtQty(c, pours) { if (!c || !(c.pourSize > 0) || !c.pourUnit) return (Math.round(pours * 100) / 100) + (pours === 1 ? " pour" : " pours"); const q = Math.round(pours * c.pourSize * 100) / 100; const u = norm(c.pourUnit).replace(/^fl_oz$|^floz$|^fluid_ounces?$/, "fl oz").replace(/_/g, " "); return q + " " + u; }
  const unitOf = s => { const t = norm(s).replace(/_+/g, "_"); if (!t) return null; return UNITS[t] || UNITS[t.replace(/s$/, "")] || null; };
  const sum = (arr, f) => { let s = 0; for (let i = 0; i < arr.length; i++) s += f ? f(arr[i], i) : arr[i]; return s; };
  const by = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(x); } return m; };
  const r2 = v => Math.round(v * 100) / 100;
  const slug = s => String(s).toLowerCase().replace(/®|™/g, "").replace(/\+/g, " ").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  /* ---------- 3. CSV ---------- */
  function parseCSV(text, delim) {
    text = String(text).replace(/^﻿/, "");
    if (!delim) { const head = text.slice(0, 4000).split(/\r?\n/)[0] || ""; const c = { ",": (head.match(/,/g) || []).length, "\t": (head.match(/\t/g) || []).length, ";": (head.match(/;/g) || []).length, "|": (head.match(/\|/g) || []).length }; delim = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; if (!c[delim]) delim = ","; }
    const rows = []; let row = [], field = "", q = false, i = 0; const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; } field += ch; i++; continue; }
      if (ch === '"') { q = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ""; i++; continue; }
      if (ch === "\n" || ch === "\r") { row.push(field); field = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; if (ch === "\r" && text[i + 1] === "\n") i++; i++; continue; }
      field += ch; i++;
    }
    row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row);
    if (!rows.length) return { headers: [], rows: [], delim };
    const headers = rows[0].map(h => String(h).trim());
    const out = rows.slice(1).map(r => { const o = {}; for (let k = 0; k < headers.length; k++) o[headers[k]] = r[k] == null ? "" : r[k]; return o; });
    return { headers, rows: out, delim };
  }
  const csvCell = v => { if (v == null) return ""; const s = typeof v === "number" ? String(v) : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function toCSV(rows, cols) { if (!cols) cols = rows.length ? Object.keys(rows[0]) : []; const lines = [cols.map(csvCell).join(",")]; for (const r of rows) lines.push(cols.map(c => csvCell(r[c])).join(",")); return lines.join("\n") + "\n"; }
  function templateCSV(type) { const t = TEMPLATES[type]; return toCSV([Object.fromEntries(t.cols.map(c => [c.k, c.ex || ""]))], t.cols.map(c => c.k)); }

  /* ---------- 4. File type detection and column mapping ---------- */
  function detectType(filename, headers) {
    const f = norm(filename || "");
    const byName = [["modifier", "modifiers"], ["calls", "modifiers"], ["sales", "sales"], ["order", "sales"], ["pos_", "sales"], ["check", "sales"], ["transaction", "sales"], ["pour_cost", "ingredients"], ["ingredient", "ingredients"], ["component", "ingredients"], ["bottle", "ingredients"], ["sku", "ingredients"], ["spec", "recipes"], ["recipe", "recipes"], ["bom", "recipes"], ["drink", "drinks"], ["cocktail", "drinks"], ["menu", "drinks"], ["item", "drinks"], ["product", "drinks"], ["restaurant", "restaurants"], ["location", "restaurants"], ["store", "restaurants"], ["venue", "restaurants"], ["extra", "extras"], ["garnish", "extras"], ["glass", "extras"], ["packag", "extras"], ["waste", "waste"], ["spill", "waste"], ["actual", "actuals"], ["books", "actuals"], ["pnl", "actuals"], ["p_l", "actuals"], ["inventor", "inventory"], ["count", "inventory"]];
    for (const [k, t] of byName) if (f.includes(k)) return t;
    if (!headers || !headers.length) return null;
    let best = null, bestScore = 0;
    for (const t of TYPES) { const m = autoMap(t, headers); const req = TEMPLATES[t].cols.filter(c => c.req); const hit = req.filter(c => m[c.k]).length; const opt = TEMPLATES[t].cols.filter(c => !c.req && m[c.k]).length; const score = hit === req.length ? 10 + opt : hit; if (score > bestScore) { bestScore = score; best = t; } }
    return bestScore >= 10 ? best : null;
  }
  function autoMap(type, headers) {
    const t = TEMPLATES[type]; const used = new Set(); const map = {};
    const H = headers.map(h => ({ h, n: norm(h) }));
    const take = (col, pred) => { if (map[col.k]) return; const hit = H.find(x => !used.has(x.h) && pred(x.n)); if (hit) { map[col.k] = hit.h; used.add(hit.h); } };
    // pass 1: exact key; pass 2: exact alias; pass 3: key contained; required columns first in each pass
    const cols = t.cols.slice().sort((a, b) => (b.req - a.req));
    cols.forEach(c => take(c, n => n === c.k));
    cols.forEach(c => take(c, n => c.aliases.includes(n)));
    cols.forEach(c => take(c, n => n.includes(c.k) || c.k.includes(n) && n.length >= 4));
    t.cols.forEach(c => { if (!(c.k in map)) map[c.k] = null; });
    return map;
  }
  // apply a header map and coerce types; returns rows keyed by template column, plus the rows it could not parse
  function applyMap(type, rows, map) {
    const t = TEMPLATES[type]; const out = []; const bad = [];
    rows.forEach((r, i) => {
      const o = { _row: i + 2 }; let problem = null;
      for (const c of t.cols) {
        const h = map[c.k]; let v = h == null ? null : r[h];
        if (v === "" || v == null) v = null;
        else if (c.type === "num" || c.type === "int") { const n = num(v); if (n == null) problem = problem || `${c.k} is not a number ("${v}")`; v = n; }
        else if (c.type === "date") { const d = toISODate(v); if (!d) problem = problem || `${c.k} is not a date ("${v}")`; v = d; }
        else if (c.type === "month") { const d = toMonth(v); if (!d) problem = problem || `${c.k} is not a month ("${v}")`; v = d; }
        else if (c.type === "bool") { const b = bool(v); if (b == null) problem = problem || `${c.k} is not yes/no ("${v}")`; v = b; }
        else v = String(v).trim();
        o[c.k] = v;
      }
      if (problem) bad.push({ row: i + 2, problem }); else out.push(o);
    });
    return { rows: out, bad };
  }

  /* ---------- 5. Validation ---------- */
  // dataset: { ingredients: rows, drinks: rows, recipes: rows, sales?, modifiers?, restaurants?, extras?, waste?, actuals?, inventory? } (rows already mapped)
  function validate(ds) {
    const errors = [], warnings = [], info = [];
    const E = (file, msg, rows) => errors.push({ file, msg, rows });
    const W = (file, msg, rows) => warnings.push({ file, msg, rows });
    const has = k => Array.isArray(ds[k]) && ds[k].length;
    for (const k of CORE) if (!has(k)) E(k, `The ${TEMPLATES[k].label.toLowerCase()} file is missing or empty.`);
    if (errors.length) return { errors, warnings, info, ok: false };
    // ingredients
    const compIds = new Set(); const compKey = new Set(); const compPour = new Map();
    ds.ingredients.forEach(r => {
      if (!r.ingredient_id) return E("ingredients", `Row ${r._row}: ingredient_id is blank.`);
      compIds.add(r.ingredient_id);
      const key = `${r.ingredient_id}|${r.restaurant_id || ""}|${r.effective_date || ""}`;
      if (compKey.has(key)) W("ingredients", `Row ${r._row}: duplicate cost row for ${r.ingredient_id}${r.restaurant_id ? " at " + r.restaurant_id : ""}${r.effective_date ? " dated " + r.effective_date : ""}; the last one wins.`);
      compKey.add(key);
      const pc = pourCost(r);
      if (r.pour_size > 0 && r.pour_unit && !compPour.has(r.ingredient_id)) compPour.set(r.ingredient_id, { name: r.ingredient_name || r.ingredient_id, pourSize: r.pour_size, pourUnit: r.pour_unit });
      if (pc.cost == null) E("ingredients", `Row ${r._row} (${r.ingredient_name || r.ingredient_id}): no cost: ${pc.why}`);
      else if (pc.cost < 0) E("ingredients", `Row ${r._row} (${r.ingredient_id}): negative cost.`);
      if (r.yield_pct != null && (r.yield_pct <= 0 || r.yield_pct > 100)) E("ingredients", `Row ${r._row} (${r.ingredient_id}): yield_pct must be between 0 and 100 (got ${r.yield_pct}).`);
    });
    // drinks
    const itemIds = new Set(); const itemKey = new Set();
    ds.drinks.forEach(r => {
      if (!r.drink_id) return E("drinks", `Row ${r._row}: drink_id is blank.`);
      itemIds.add(r.drink_id);
      const key = `${r.drink_id}|${r.restaurant_id || ""}`;
      if (itemKey.has(key)) W("drinks", `Row ${r._row}: duplicate row for ${r.drink_id}${r.restaurant_id ? " at " + r.restaurant_id : ""}; the last one wins.`);
      itemKey.add(key);
      if (r.restaurant_id) { if (r.price == null) E("drinks", `Row ${r._row} (${r.drink_id} at ${r.restaurant_id}): a restaurant row needs a price.`); return; }
      if (r.price == null) E("drinks", `Row ${r._row} (${r.drink_name || r.drink_id}): price is blank.`);
      if (!r.section) E("drinks", `Row ${r._row} (${r.drink_id}): section is blank.`);
    });
    // recipes
    const recipeItems = new Set(); const unknownC = new Map(), unknownI = new Map();
    ds.recipes.forEach(r => {
      if (!itemIds.has(r.drink_id)) unknownI.set(r.drink_id, (unknownI.get(r.drink_id) || 0) + 1);
      if (!compIds.has(r.ingredient_id)) unknownC.set(r.ingredient_id, (unknownC.get(r.ingredient_id) || 0) + 1);
      if (!(r.qty > 0)) E("recipes", `Row ${r._row} (${r.drink_id} / ${r.ingredient_id}): qty must be more than 0.`);
      else if (r.unit && compIds.has(r.ingredient_id)) { const p = toPours(compPour.get(r.ingredient_id) || null, r.qty, r.unit); if (p && p.err) E("recipes", `Row ${r._row} (${r.drink_id} / ${r.ingredient_id}): ${p.err}.`); }
      recipeItems.add(r.drink_id);
    });
    if (unknownI.size) E("recipes", `${unknownI.size} drink_id value(s) are not in drinks: ${[...unknownI.keys()].slice(0, 8).join(", ")}${unknownI.size > 8 ? "…" : ""}`, sum([...unknownI.values()]));
    if (unknownC.size) E("recipes", `${unknownC.size} ingredient_id value(s) are not in ingredients (unmapped ingredients): ${[...unknownC.keys()].slice(0, 8).join(", ")}${unknownC.size > 8 ? "…" : ""}`, sum([...unknownC.values()]));
    const noRecipe = ds.drinks.filter(r => !r.custom && !r.restaurant_id && r.active !== false && !FOOD_LINE.test(r.section || "") && !recipeItems.has(r.drink_id));
    if (noRecipe.length) E("drinks", `${noRecipe.length} active drink(s) have no recipe rows and are not well & call (or food): ${noRecipe.slice(0, 8).map(r => r.drink_name || r.drink_id).join(", ")}${noRecipe.length > 8 ? "…" : ""}`, noRecipe.length);
    // sales
    if (has("sales")) {
      const unk = new Map(); let unkRev = 0, rev = 0, noDate = 0, noStore = 0, badQty = 0; const restaurants = new Set((ds.restaurants || []).map(s => s.restaurant_id));
      const hasOrder = ds.sales.some(r => r.order_id);
      ds.sales.forEach(r => {
        const q = r.qty == null ? 1 : r.qty; const line = (r.net_price != null ? r.net_price : 0) * q; rev += line;
        if (!itemIds.has(r.drink_id)) { unk.set(r.drink_id, (unk.get(r.drink_id) || 0) + q); unkRev += line; }
        if (!r.date) noDate++; if (!r.restaurant_id) noStore++; if (!(q > 0)) badQty++;
        if (restaurants.size && r.restaurant_id && !restaurants.has(r.restaurant_id)) restaurants.add("?" + r.restaurant_id);
      });
      if (unk.size) { const share = rev ? unkRev / rev : 0; (share > 0.02 ? E : W)("sales", `${unk.size} drink_id value(s) in sales are not in drinks (${Math.round(sum([...unk.values()])).toLocaleString()} units${rev ? ", " + (share * 100).toFixed(1) + "% of sales" : ""}); these lines are left out: ${[...unk.keys()].slice(0, 8).join(", ")}${unk.size > 8 ? "…" : ""}`, sum([...unk.values()])); }
      if (noDate) E("sales", `${noDate} line(s) have no usable date and are left out.`, noDate);
      if (noStore) E("sales", `${noStore} line(s) have no restaurant_id and are left out.`, noStore);
      if (badQty) W("sales", `${badQty} line(s) have a qty of 0 or less (refunds?) and are left out.`, badQty);
      const extra = [...restaurants].filter(s => s.startsWith("?")); if (extra.length) W("sales", `Restaurant(s) not in the restaurants file, shown by code: ${extra.map(s => s.slice(1)).join(", ")}`);
      if (!hasOrder) W("sales", "No order_id column: each line counts as its own order, so attach rates, order size and cannibalization are off.");
      if (!ds.sales.some(r => r.net_price != null)) info.push({ file: "sales", msg: "No net_price column: revenue uses menu prices plus up-charges." });
      if (!ds.sales.some(r => r.channel)) info.push({ file: "sales", msg: "No channel column: everything counts as dine-in." });
      if (!ds.sales.some(r => r.time || r.daypart)) info.push({ file: "sales", msg: "No time or daypart column: daypart views are off." });
    }
    if (has("modifiers")) {
      const unkC = new Map(); let n = 0; const orders = new Set((ds.sales || []).map(r => r.order_id)); let orphan = 0;
      let badUnit = 0;
      ds.modifiers.forEach(r => { if (!compIds.has(r.ingredient_id)) { unkC.set(r.ingredient_id, (unkC.get(r.ingredient_id) || 0) + 1); n++; } else if (r.unit) { const p = toPours(compPour.get(r.ingredient_id) || null, r.qty == null ? 1 : r.qty, r.unit); if (p && p.err) badUnit++; } if (orders.size && !orders.has(r.order_id)) orphan++; });
      if (badUnit) W("modifiers", `${badUnit.toLocaleString()} modifier row(s) give a unit that cannot be converted to pours and are left out.`, badUnit);
      if (unkC.size) E("modifiers", `${unkC.size} ingredient_id value(s) in modifiers are not in ingredients (unmapped ingredients, ${n.toLocaleString()} rows left out): ${[...unkC.keys()].slice(0, 8).join(", ")}${unkC.size > 8 ? "…" : ""}`, n);
      if (orphan) W("modifiers", `${orphan.toLocaleString()} modifier row(s) point at an order_id that is not in sales.`, orphan);
      const byoItems = ds.drinks.filter(r => r.custom).map(r => r.drink_id);
      if (!byoItems.length) W("modifiers", "No drink has custom = 1, so modifiers are treated as swaps and adds on menu drinks.");
    } else if (has("sales") && ds.drinks.some(r => r.custom)) {
      W("sales", "Well & call drinks are in sales but there is no modifiers file, so their cost is unknown and they are left out of pour cost.");
    }
    if (has("extras")) ds.extras.forEach(r => { if (!(r.cost >= 0)) E("extras", `Row ${r._row}: cost is blank or negative.`); });
    if (has("waste")) { let u = 0; ds.waste.forEach(r => { if (!compIds.has(r.ingredient_id)) u++; }); if (u) W("waste", `${u} waste row(s) name an ingredient that is not in ingredients and are left out.`, u); }
    if (has("inventory")) { let u = 0; ds.inventory.forEach(r => { if (!compIds.has(r.ingredient_id)) u++; }); if (u) W("inventory", `${u} inventory row(s) name an ingredient that is not in ingredients and are left out.`, u); }
    if (has("actuals")) ds.actuals.forEach(r => { if (!(r.actual_beverage_cost >= 0)) E("actuals", `Row ${r._row}: actual_beverage_cost is blank.`); });
    return { errors, warnings, info, ok: !errors.some(e => CORE.includes(e.file) && /missing|blank|unmapped|no cost|no recipe/.test(e.msg)) };
  }

  /* ---------- 6. Pour cost (bottle → pour, after yield) ---------- */
  function pourCost(r) {
    if (r.pour_cost != null) return { cost: r.pour_cost, how: "given" };
    if (r.bottle_cost == null) return { cost: null, why: "bottle_cost (or pour_cost) is blank" };
    if (!(r.bottle_size > 0)) return { cost: null, why: "bottle_size is blank or 0" };
    if (!(r.pour_size > 0)) return { cost: null, why: "pour_size is blank or 0" };
    const cu = unitOf(r.bottle_unit), pu = unitOf(r.pour_unit);
    if (!cu) return { cost: null, why: `bottle_unit "${r.bottle_unit || ""}" is not a known unit` };
    if (!pu) return { cost: null, why: `pour_unit "${r.pour_unit || ""}" is not a known unit` };
    if (cu[0] !== pu[0]) return { cost: null, why: `unit mismatch: the bottle is in ${r.bottle_unit} (${cu[0] === "w" ? "weight" : cu[0] === "v" ? "volume" : "count"}) but the pour is in ${r.pour_unit} (${pu[0] === "w" ? "weight" : pu[0] === "v" ? "volume" : "count"})` };
    const y = r.yield_pct == null ? 100 : r.yield_pct; if (!(y > 0 && y <= 100)) return { cost: null, why: "yield_pct must be between 0 and 100" };
    const caseInPortionUnits = r.bottle_size * cu[1] / pu[1];
    const usable = caseInPortionUnits * y / 100;
    const cost = r.bottle_cost / usable * r.pour_size;
    return { cost, how: "bottle", perUnit: r.bottle_cost / usable, usable, unit: r.pour_unit };
  }

  /* ---------- 7. Build the model ---------- */
  function build(ds) {
    const M = { ds, restaurants: new Map(), comps: new Map(), drinks: new Map(), lines: [], addonLines: new Set(), byoByLine: new Map(), extras: [], warnings: [] };
    (ds.restaurants || []).forEach(s => { if (s.restaurant_id) M.restaurants.set(s.restaurant_id, { id: s.restaurant_id, name: s.restaurant_name || s.restaurant_id, region: s.group || "", city: s.city || "", state: s.state || "" }); });
    // ingredients and cost versions
    for (const r of ds.ingredients) {
      if (!r.ingredient_id) continue;
      let c = M.comps.get(r.ingredient_id);
      if (!c) { c = { id: r.ingredient_id, name: r.ingredient_name || r.ingredient_id, category: r.category || "Other", fam: CAT_FAM(r.category), upcharge: 0, perishable: null, shelf: null, steps: 1, par: null, abv: null, pourSize: null, pourUnit: null, versions: new Map(), dates: new Set() }; M.comps.set(c.id, c); }
      if (r.pour_size > 0 && r.pour_unit && !c.pourSize) { c.pourSize = r.pour_size; c.pourUnit = r.pour_unit; }
      const pc = pourCost(r); if (pc.cost == null) continue;
      const restaurant = r.restaurant_id || "", date = r.effective_date || "0000-00-00";
      let list = c.versions.get(restaurant); if (!list) { list = []; c.versions.set(restaurant, list); }
      const v = { date, cost: pc.cost, how: pc.how, caseCost: r.bottle_cost, caseSize: r.bottle_size, caseUnit: r.bottle_unit, portionSize: r.pour_size, portionUnit: r.pour_unit, yield: r.yield_pct == null ? 100 : r.yield_pct, perUnit: pc.perUnit, usable: pc.usable, row: r._row };
      const i = list.findIndex(x => x.date === date); if (i >= 0) list[i] = v; else list.push(v);
      if (r.effective_date) c.dates.add(r.effective_date);
      if (r.upcharge != null) c.upcharge = r.upcharge;
      if (r.perishable != null) c.perishable = r.perishable; if (r.shelf_life_days != null) c.shelf = r.shelf_life_days;
      if (r.prep_steps != null) c.steps = r.prep_steps; if (r.par_pours != null) c.par = r.par_pours;
      if (r.abv_pct != null) c.abv = r.abv_pct;
      if (r.ingredient_name) c.name = r.ingredient_name; if (r.category) { c.category = r.category; c.fam = CAT_FAM(r.category); }
    }
    for (const c of M.comps.values()) for (const list of c.versions.values()) list.sort((a, b) => a.date < b.date ? -1 : 1);
    M.costDates = [...new Set([...M.comps.values()].flatMap(c => [...c.dates]))].sort();
    // drinks
    for (const r of ds.drinks) {
      if (!r.drink_id) continue;
      let it = M.drinks.get(r.drink_id);
      if (!it) { it = { id: r.drink_id, name: r.drink_name || r.drink_id, line: r.section || "Other", price: null, prices: new Map(), byo: false, active: true, addon: false, recipe: [] }; M.drinks.set(it.id, it); }
      if (r.restaurant_id) it.prices.set(r.restaurant_id, r.price); else { if (r.price != null) it.price = r.price; if (r.drink_name) it.name = r.drink_name; if (r.section) it.line = r.section; if (r.custom != null) it.byo = r.custom; if (r.active != null) it.active = r.active; }
    }
    for (const it of M.drinks.values()) { it.addon = FOOD_LINE.test(it.line); if (it.price == null && it.prices.size) it.price = [...it.prices.values()][0]; }
    for (const r of ds.recipes) { const it = M.drinks.get(r.drink_id), c = M.comps.get(r.ingredient_id); if (!it || !c || !(r.qty > 0)) continue; const pours = toPours(c, r.qty, r.unit); if (!isNum(pours) || !(pours > 0)) continue; const ex = it.recipe.find(x => x.cid === c.id); if (ex) ex.pours += pours; else it.recipe.push({ cid: c.id, pours }); }
    for (const it of M.drinks.values()) it.set = new Set(it.recipe.map(x => x.cid));
    M.lines = [...new Set([...M.drinks.values()].map(i => i.line))];
    for (const it of M.drinks.values()) { if (it.addon) M.addonLines.add(it.line); if (it.byo && !M.byoByLine.has(it.line)) M.byoByLine.set(it.line, it.id); }
    M.extras = (ds.extras || []).map(r => ({ line: norm(r.section) === "all" ? "all" : r.section, channel: /house|dine|bar|in_store|restaurant|table/.test(norm(r.channel)) ? "in_house" : /go|take|deliv|event|online|offprem|off_prem|dig/.test(norm(r.channel)) ? "to_go" : "all", cost: r.cost || 0 }));
    M.hasPackaging = M.extras.length > 0;
    const pkgCache = new Map();
    M.pkg = (line, ch) => { const k = line + "|" + ch; if (pkgCache.has(k)) return pkgCache.get(k); const pc = pkgChannel(ch); const find = (l, c) => M.extras.find(p => p.line === l && p.channel === c); const hit = find(line, pc) || find(line, "all") || find("all", pc) || find("all", "all"); const v = hit ? hit.cost : 0; pkgCache.set(k, v); return v; };
    // cost lookup with a small cache (ingredient|restaurant|month)
    const cache = new Map();
    M.compCost = (cid, restaurant, date) => {
      const key = cid + "|" + (restaurant || "") + "|" + (date || "").slice(0, 7);
      let v = cache.get(key); if (v !== undefined) return v;
      v = compCostRaw(M, cid, restaurant, date); cache.set(key, v); return v;
    };
    M.clearCache = () => { cache.clear(); wellCache.clear(); };
    // pours in one unit of an inventory count: bottles use the bottle size, volume units convert, blank means pours
    M.pourPerUnit = (cid, unit) => { const c = M.comps.get(cid); if (!c) return 1; const u = norm(unit || ""); if (!u || /^(pours?|portions?|servings?)$/.test(u)) return 1; const v = [...c.versions.values()].flat().find(x => x.caseSize > 0 && x.caseUnit && x.portionSize > 0 && x.portionUnit); if (/^(bottles?|cases?|each|units?|cans?|kegs?|bags?)$/.test(u)) { if (!v) return 1; const cu = unitOf(v.caseUnit), pu = unitOf(v.portionUnit); return cu && pu && cu[0] === pu[0] ? v.caseSize * cu[1] / pu[1] / v.portionSize : 1; } const uu = unitOf(u), pu = c.pourUnit ? unitOf(c.pourUnit) : null; if (uu && pu && uu[0] === pu[0] && c.pourSize > 0) return uu[1] / pu[1] / c.pourSize; return 1; };
    M.itemPrice = (iid, restaurant) => { const it = M.drinks.get(iid); if (!it) return null; return restaurant && it.prices.has(restaurant) ? it.prices.get(restaurant) : it.price; };
    // the well: what a called brand replaces. Per category (a Casamigos call replaces the well tequila, not the well gin); falls back to every well spirit.
    const wellCache = new Map();
    M.wellCost = (category, restaurant, date) => { const key = (category || "") + "|" + (restaurant || "") + "|" + (date || "").slice(0, 7); let v = wellCache.get(key); if (v !== undefined) return v; let wells = [...M.comps.values()].filter(c => c.fam === "spirit" && !(c.upcharge > 0) && (!category || norm(c.category) === norm(category))); if (!wells.length) wells = [...M.comps.values()].filter(c => c.fam === "spirit" && !(c.upcharge > 0)); v = wells.length ? sum(wells, c => M.compCost(c.id, restaurant, date)) / wells.length : 0; wellCache.set(key, v); return v; };
    M.includedMainCost = (restaurant, date) => M.wellCost(null, restaurant, date);
    // waste, actuals, inventory kept as rows, filtered on use
    M.waste = (ds.waste || []).filter(r => M.comps.has(r.ingredient_id) && r.date && r.qty_pours != null);
    M.actuals = (ds.actuals || []).filter(r => r.period && r.actual_beverage_cost != null);
    M.inventory = (ds.inventory || []).filter(r => M.comps.has(r.ingredient_id) && r.period);
    // sales: join modifiers to lines
    M.sales = []; M.orders = new Map(); M.months = []; M.channels = []; M.dates = [];
    if (ds.sales && ds.sales.length) joinSales(M, ds.sales, ds.modifiers || []);
    return M;
  }
  function compCostRaw(M, cid, restaurant, date) {
    const c = M.comps.get(cid); if (!c) return 0;
    const d = date || "9999-12-31";
    const pick = list => { if (!list || !list.length) return null; let hit = null; for (const v of list) { if (v.date <= d) hit = v; else break; } return hit || list[0]; };
    let v = null; if (restaurant && c.versions.has(restaurant)) { const l = c.versions.get(restaurant); const h = pick(l); if (h && h.date <= d) v = h; }
    if (!v) v = pick(c.versions.get("")); if (!v && restaurant) v = pick([...c.versions.values()][0]);
    return v ? v.cost : 0;
  }
  function joinSales(M, sales, mods) {
    // index modifiers
    const byLine = new Map(), byItem = new Map();
    for (const m of mods) {
      if (!m.order_id || !M.comps.has(m.ingredient_id)) continue;
      let q = m.qty == null ? 1 : m.qty; if (m.unit) { q = toPours(M.comps.get(m.ingredient_id), q, m.unit); if (!isNum(q)) continue; } if (!(q > 0)) continue;
      const rec = { cid: m.ingredient_id, qty: q };
      if (m.line_id != null && m.line_id !== "") { const k = m.order_id + "|" + m.line_id; let a = byLine.get(k); if (!a) { a = []; byLine.set(k, a); } a.push(rec); }
      else { const k = m.order_id + "|" + (m.drink_id || ""); let a = byItem.get(k); if (!a) { a = []; byItem.set(k, a); } a.push(rec); }
    }
    const seenItemLine = new Set(); let n = 0;
    const months = new Set(), channels = new Set(), dates = new Set();
    for (const r of sales) {
      const it = M.drinks.get(r.drink_id); if (!it || !r.date || !r.restaurant_id) continue;
      const q = r.qty == null ? 1 : r.qty; if (!(q > 0)) continue;
      const oid = r.order_id || ("_" + (n++));
      const time = toTime(r.time); const ch = channelOf(r.channel);
      let mlist = null;
      if (r.line_id != null && r.line_id !== "") mlist = byLine.get(oid + "|" + r.line_id) || null;
      if (!mlist) { const k = oid + "|" + r.drink_id; if (!seenItemLine.has(k)) { mlist = byItem.get(k) || byItem.get(oid + "|") || null; if (mlist) seenItemLine.add(k); } }
      const L = { oid, restaurant: r.restaurant_id, date: r.date, month: r.date.slice(0, 7), dow: dayOfWeek(r.date), time, daypart: r.daypart ? daypartNorm(r.daypart) : daypartOf(time), ch, iid: it.id, qty: q, net: r.net_price, mods: mlist };
      M.sales.push(L); months.add(L.month); channels.add(ch); dates.add(r.date);
      let o = M.orders.get(oid); if (!o) { o = { id: oid, restaurant: L.restaurant, date: L.date, ch, lines: [] }; M.orders.set(oid, o); } o.lines.push(L);
    }
    M.months = [...months].sort(); M.channels = CHANNELS.filter(c => channels.has(c)); M.dates = [...dates].sort();
    for (const L of M.sales) if (!M.restaurants.has(L.restaurant)) M.restaurants.set(L.restaurant, { id: L.restaurant, name: L.restaurant, region: "", city: "", state: "" });
  }

  /* ---------- 8. Costing one drink or one build ---------- */
  // Unit cost of an drink at a restaurant on a date. Returns parts for display. scn: scenario (cost overrides, swaps).
  function costOf(M, parts, restaurant, date, scn) {
    const out = []; let food = 0;
    for (const p of parts) {
      let cid = p.cid; if (scn && scn.swapMap && scn.swapMap.has(cid)) cid = scn.swapMap.get(cid);
      const c = M.comps.get(cid); if (!c) continue;
      let unit = M.compCost(cid, restaurant, date);
      if (scn) { if (scn.costAbs && scn.costAbs[cid] != null) unit = scn.costAbs[cid]; else if (scn.costPct && scn.costPct[cid]) unit = unit * (1 + scn.costPct[cid] / 100); }
      const cost = unit * p.pours; food += cost;
      out.push({ cid, orig: p.cid, name: c.name, category: c.category, fam: c.fam, pours: p.pours, qty: fmtQty(c, p.pours), unit, cost, upcharge: scn && scn.upcharges && scn.upcharges[cid] != null ? scn.upcharges[cid] : c.upcharge });
    }
    return { food, parts: out };
  }
  const modsToParts = mods => mods.map(m => ({ cid: m.cid, pours: m.qty }));
  // modifiers on a menu drink: a called spirit replaces the spec's spirit of the same category (make it with Casamigos); anything else is an add
  function applyMods(M, base, mc) {
    if (!mc.parts.length || !base.parts.length) return { food: base.food + mc.food, parts: base.parts.concat(mc.parts) };
    const replaced = new Set();
    for (const p of mc.parts) { const c = M.comps.get(p.cid); if (!c || c.fam !== "spirit") continue; const b = base.parts.find(x => !replaced.has(x) && x.fam === "spirit" && norm(x.category) === norm(c.category) && x.cid !== p.cid); if (b) replaced.add(b); }
    const kept = base.parts.filter(x => !replaced.has(x));
    return { food: sum(kept, x => x.cost) + mc.food, parts: kept.concat(mc.parts), replaced: [...replaced] };
  }
  function upchargeOf(M, cid, scn) { const c = M.comps.get(cid); if (!c) return 0; return scn && scn.upcharges && scn.upcharges[cid] != null ? scn.upcharges[cid] : c.upcharge; }
  // price for a target pour cost
  const priceFor = (cost, targetPct) => targetPct > 0 ? cost / (targetPct / 100) : null;

  /* ---------- 9. Scenarios ---------- */
  // scn = { name, costPct: {cid: +15}, costAbs: {cid: 2.10}, prices: {iid: 13.25}, upcharges: {cid: 4.5}, remove: [iid], swaps: [{from, to}],
  //         newItems: [{id, name, line, price, recipe: [{cid, pours}], unitsPerStoreWeek, cannibal: 0.7, weeks: null}], unavailable: [cid],
  //         elasticity: -0.8, retention: 0.8 }
  function normScenario(scn) {
    if (!scn) return null;
    const s = Object.assign({ costPct: {}, costAbs: {}, prices: {}, upcharges: {}, remove: [], swaps: [], newItems: [], unavailable: [], recipes: {}, elasticity: -0.8, retention: 0.8 }, scn);
    s.swapMap = new Map(s.swaps.filter(x => x.from && x.to && x.from !== x.to).map(x => [x.from, x.to]));
    s.removeSet = new Set(s.remove);
    s.empty = !Object.keys(s.costPct).some(k => s.costPct[k]) && !Object.keys(s.costAbs).length && !Object.keys(s.prices).length && !Object.keys(s.upcharges).length && !s.remove.length && !s.swapMap.size && !s.newItems.length && !s.unavailable.length && !Object.keys(s.recipes).length;
    return s;
  }

  /* ---------- 10. Analysis ---------- */
  // scope = { restaurants: Set|null, months: Set|null, channel: "all"|channel, target: 30 }
  function analyze(M, scope, scenario) {
    scope = scope || {}; const scn = normScenario(scenario);
    const target = scope.target || 30;
    const inScope = L => (!scope.restaurants || scope.restaurants.has(L.restaurant)) && (!scope.months || scope.months.has(L.month)) && (!scope.channel || scope.channel === "all" || L.ch === scope.channel);
    const lines = M.sales.filter(inScope);
    const storesIn = scope.restaurants ? [...scope.restaurants] : [...M.restaurants.keys()];
    const R = { scope: { restaurants: storesIn, months: scope.months ? [...scope.months] : M.months, channel: scope.channel || "all", target, costAsOf: scope.costAsOf || null }, hasSales: lines.length > 0, scenario: scn && !scn.empty ? scn.name || "Scenario" : null, warnings: [] };
    const cDate = L => scope.costAsOf || L.date; // costAsOf: cost every line as of one date (used to split cost changes from mix changes)
    const recipeOf = it => scn && scn.recipes && scn.recipes[it.id] ? scn.recipes[it.id] : it.recipe;
    const refDate = scope.costAsOf || (lines.length ? lines[lines.length - 1].date : (M.costDates[M.costDates.length - 1] || "9999-12-31"));
    const refStore = storesIn[0] || "";
    R.refDate = refDate; R.refStore = refStore;
    const nStores = Math.max(1, storesIn.filter(s => lines.some(L => L.restaurant === s)).length || storesIn.length);
    const dateSet = new Set(lines.map(L => L.date)); const nDays = dateSet.size || 1; const weeks = nDays / 7;
    R.days = nDays; R.weeks = weeks; R.nStores = nStores;

    // --- static drink costing (at the reference restaurant/date), used by cost views and by the sales pass for menu drinks
    R.drinks = new Map();
    for (const it of M.drinks.values()) {
      if (!it.active) continue;
      const price = scn && scn.prices[it.id] != null ? scn.prices[it.id] : M.itemPrice(it.id, refStore);
      const c = it.byo ? { food: 0, parts: [] } : costOf(M, recipeOf(it), refStore, refDate, scn);
      const pkgIn = M.pkg(it.line, "dine_in"), pkgDig = M.pkg(it.line, "takeout");
      R.drinks.set(it.id, { id: it.id, name: it.name, line: it.line, addon: it.addon, byo: it.byo, price, basePrice: M.itemPrice(it.id, refStore), food: c.food, parts: c.parts, pkgIn, pkgDig, recipeChanged: !!(scn && scn.recipes && scn.recipes[it.id]),
        fc: price ? c.food / price * 100 : null, cm: price != null ? price - c.food : null, priceFor: priceFor(c.food, target), removed: !!(scn && scn.removeSet.has(it.id)),
        units: 0, rev: 0, cogs: 0, pkg: 0, orders: 0, restaurants: new Set(), months: new Map() });
    }
    // new drinks from the scenario
    if (scn) for (const n of scn.newItems) {
      if (!n || !n.id) continue;
      const c = costOf(M, n.recipe || [], refStore, refDate, scn); const price = n.price || 0;
      R.drinks.set(n.id, { id: n.id, name: n.name || n.id, line: n.line || "Cocktails", addon: FOOD_LINE.test(n.line || ""), byo: false, price, basePrice: null, food: c.food, parts: c.parts, pkgIn: M.pkg(n.line || "", "dine_in"), pkgDig: M.pkg(n.line || "", "takeout"),
        fc: price ? c.food / price * 100 : null, cm: price - c.food, priceFor: priceFor(c.food, target), isNew: true, units: 0, rev: 0, cogs: 0, pkg: 0, orders: 0, restaurants: new Set(), months: new Map() });
    }

    // --- sales pass
    const agg = () => ({ units: 0, rev: 0, cogs: 0, pkg: 0, orders: new Set(), drinks: 0 });
    const tot = agg(); const byStore = new Map(), byMonth = new Map(), byStoreMonth = new Map(), byChannel = new Map(), byDaypart = new Map(), byDow = new Map(), byLine = new Map();
    const get = (m, k) => { let a = m.get(k); if (!a) { a = agg(); m.set(k, a); } return a; };
    const add = (a, L, w, rev, cogs, pkg, drink) => { a.units += w; a.rev += rev; a.cogs += cogs; a.pkg += pkg; a.orders.add(L.oid); if (drink) a.drinks += w; };
    // first pass: base units per drink and per line (needed for removal / cannibalization factors)
    const baseUnits = new Map(), lineUnits = new Map();
    for (const L of lines) { baseUnits.set(L.iid, (baseUnits.get(L.iid) || 0) + L.qty); const it = M.drinks.get(L.iid); lineUnits.set(it.line, (lineUnits.get(it.line) || 0) + L.qty); }
    const lineFactor = new Map(); // demand moved into remaining drinks of a line by removals and pulled out by new drinks
    if (scn && !scn.empty) {
      for (const [line, U] of lineUnits) {
        let removed = 0; for (const [iid, u] of baseUnits) if (scn.removeSet.has(iid) && M.drinks.get(iid).line === line) removed += u;
        const remaining = U - removed; let g = remaining > 0 ? 1 + scn.retention * removed / remaining : 1;
        let pulled = 0; for (const n of scn.newItems) if ((n.line || "Cocktails") === line && n.unitsPerStoreWeek > 0) { const wk = n.weeks ? Math.min(n.weeks, weeks) : weeks; pulled += n.unitsPerStoreWeek * nStores * wk * (n.cannibal == null ? 0.7 : n.cannibal); }
        const h = remaining > 0 ? Math.max(0, 1 - pulled / (remaining * g)) : 1;
        lineFactor.set(line, g * h);
      }
    }
    const elasticity = scn ? scn.elasticity : 0;
    const priceFactor = iid => { if (!scn || scn.prices[iid] == null) return 1; const it = M.drinks.get(iid); const old = M.itemPrice(iid, refStore); if (!old) return 1; return Math.max(0, 1 + elasticity * (scn.prices[iid] - old) / old); };
    const includedMain = M.includedMainCost(refStore, refDate);
    const wellOf = c => c.fam === "spirit" ? M.wellCost(c.category, refStore, refDate) : null;
    const incrementalOf = (c, unit) => c.fam === "spirit" ? Math.max(0, unit - wellOf(c)) : unit;
    // BYO / modifier accumulators
    const picks = new Map(); // cid -> {picks, qty, rev(upcharge), orders}
    const builds = new Map(); // key -> {comps, n, rev, cost, line, iid}
    let byoOrders = 0, byoComps = 0; const byoByStation = new Map(); const byoByLineCount = new Map();
    const upStats = new Map(); // cid -> {picks, margin}
    const uncostedRev = { byoNoMods: 0, total: 0 };
    const orderTotals = new Map(); // oid -> rev
    const itemOrders = new Map(); // iid -> Set(oid)
    const compUsage = new Map(); // cid -> pours (theoretical usage), by restaurant-month too
    const compUsageSM = new Map();
    const perishUse = new Map();
    for (const L of lines) {
      const it = M.drinks.get(L.iid); const RI = R.drinks.get(L.iid); if (!RI) continue;
      if (scn && scn.removeSet.has(L.iid)) continue;
      const w = L.qty * priceFactor(L.iid) * (lineFactor.get(it.line) || 1);
      const basePrice = M.itemPrice(L.iid, L.restaurant);
      const price = scn && scn.prices[L.iid] != null ? (L.net != null && basePrice ? L.net * scn.prices[L.iid] / basePrice : scn.prices[L.iid]) : (L.net != null ? L.net : basePrice);
      let unitFood, parts;
      let unitRev = price || 0;
      if (it.byo || (L.mods && L.mods.length)) {
        const base = it.byo ? { food: 0, parts: [] } : costOf(M, recipeOf(it), L.restaurant, cDate(L), scn);
        const mc = L.mods && L.mods.length ? costOf(M, modsToParts(L.mods), L.restaurant, cDate(L), scn) : { food: 0, parts: [] };
        const merged = it.byo ? { food: base.food + mc.food, parts: base.parts.concat(mc.parts) } : applyMods(M, base, mc);
        unitFood = merged.food; parts = merged.parts;
        if (it.byo && !(L.mods && L.mods.length)) { uncostedRev.byoNoMods += unitRev * w; }
        if (L.net == null && !(scn && scn.prices[L.iid] != null)) unitRev = (M.itemPrice(L.iid, L.restaurant) || 0) + sum(mc.parts, p => upchargeOf(M, p.cid, null) * p.pours);
        else if (scn && scn.swapMap.size) for (const p of mc.parts) if (p.orig !== p.cid) unitRev += (upchargeOf(M, p.cid, null) - upchargeOf(M, p.orig, null)) * p.pours; // the guest no longer pays for the swapped-out premium
        // up-charge scenario: Δ on picked premium ingredients with a demand response (pf = share of picks kept)
        const pfOf = new Map();
        if (scn && Object.keys(scn.upcharges).length) for (const p of mc.parts) { const c = M.comps.get(p.cid); const oldU = c.upcharge, newU = scn.upcharges[p.cid]; if (newU == null || newU === oldU) continue; const d = newU - oldU; const pf = Math.max(0, Math.min(1.5, 1 + elasticity * d / (oldU || M.itemPrice(L.iid, L.restaurant) || 1))); pfOf.set(p.cid, pf); unitRev += p.pours * (d * pf - oldU * (1 - pf)); unitFood -= p.pours * (1 - pf) * incrementalOf(c, p.unit); }
        if (L.mods && L.mods.length && it.byo) {
          byoOrders += w; byoComps += sum(L.mods, m => m.qty) * w; byoByLineCount.set(it.line, (byoByLineCount.get(it.line) || 0) + w);
          const key = L.mods.map(m => (scn && scn.swapMap.get(m.cid)) || m.cid).map((cid, i) => cid + (L.mods[i].qty !== 1 ? "×" + L.mods[i].qty : "")).sort().join("+");
          let b = builds.get(key); if (!b) { b = { key, comps: L.mods.map((m, i) => ({ cid: (scn && scn.swapMap.get(m.cid)) || m.cid, qty: m.qty })), n: 0, rev: 0, cost: 0, line: it.line, iid: it.id }; builds.set(key, b); }
          b.n += w; b.rev += unitRev * w; b.cost += unitFood * w;
          const st = new Map(); for (const p of mc.parts) { st.set(p.category, (st.get(p.category) || 0) + p.pours); }
          for (const [s, q] of st) { let a = byoByStation.get(s); if (!a) { a = { qty: 0, orders: 0 }; byoByStation.set(s, a); } a.qty += q * w; a.orders += w; }
        }
        for (const p of mc.parts) { let a = picks.get(p.cid); if (!a) { a = { picks: 0, qty: 0, rev: 0, byo: 0 }; picks.set(p.cid, a); } const wp = w * (pfOf.get(p.cid) || 1); a.picks += wp; a.qty += p.pours * wp; a.rev += upchargeOf(M, p.cid, scn) * p.pours * wp; if (it.byo) a.byo += wp; }
      } else { unitFood = RI.food; parts = RI.parts; if (L.net == null && !(scn && scn.prices[L.iid] != null)) unitRev = M.itemPrice(L.iid, L.restaurant) || 0; if (refStore !== L.restaurant || RI.parts.length && cDate(L).slice(0, 7) !== refDate.slice(0, 7)) { const c = costOf(M, recipeOf(it), L.restaurant, cDate(L), scn); unitFood = c.food; parts = c.parts; } }
      const pkg = M.pkg(it.line, L.ch);
      const rev = unitRev * w, cogs = unitFood * w, pk = pkg * w;
      if (it.addon) { // food on the check: counted for pairing and check size, never in pour cost
        RI.units += w; RI.rev += rev; RI.restaurants.add(L.restaurant); orderTotals.set(L.oid, (orderTotals.get(L.oid) || 0) + rev); { let s = itemOrders.get(L.iid); if (!s) { s = new Set(); itemOrders.set(L.iid, s); } s.add(L.oid); }
        continue;
      }
      uncostedRev.total += rev;
      add(tot, L, w, rev, cogs, pk, !it.addon);
      add(get(byStore, L.restaurant), L, w, rev, cogs, pk, !it.addon); add(get(byMonth, L.month), L, w, rev, cogs, pk, !it.addon); add(get(byStoreMonth, L.restaurant + "|" + L.month), L, w, rev, cogs, pk, !it.addon);
      add(get(byChannel, L.ch), L, w, rev, cogs, pk, !it.addon); add(get(byDaypart, L.daypart), L, w, rev, cogs, pk, !it.addon); add(get(byDow, L.dow), L, w, rev, cogs, pk, !it.addon); add(get(byLine, it.line), L, w, rev, cogs, pk, !it.addon);
      RI.units += w; RI.rev += rev; RI.cogs += cogs; RI.pkg += pk; RI.restaurants.add(L.restaurant); { let mm = RI.months.get(L.month); if (!mm) { mm = { units: 0, rev: 0, cogs: 0 }; RI.months.set(L.month, mm); } mm.units += w; mm.rev += rev; mm.cogs += cogs; }
      orderTotals.set(L.oid, (orderTotals.get(L.oid) || 0) + rev); { let s = itemOrders.get(L.iid); if (!s) { s = new Set(); itemOrders.set(L.iid, s); } s.add(L.oid); }
      for (const p of parts) { compUsage.set(p.cid, (compUsage.get(p.cid) || 0) + p.pours * w); const k = p.cid + "|" + L.restaurant + "|" + L.month; compUsageSM.set(k, (compUsageSM.get(k) || 0) + p.pours * w); }
    }
    // new drinks: projected volume, spread across the scope
    if (scn) for (const n of scn.newItems) {
      const RI = R.drinks.get(n.id); if (!RI || !(n.unitsPerStoreWeek > 0)) continue;
      const wk = n.weeks ? Math.min(n.weeks, weeks) : weeks; const units = n.unitsPerStoreWeek * nStores * wk;
      const rev = units * RI.price, cogs = units * RI.food, pk = units * (RI.pkgIn + RI.pkgDig) / 2;
      RI.units = units; RI.rev = rev; RI.cogs = cogs; RI.pkg = pk; RI.projected = true; RI.cannibal = n.cannibal == null ? 0.7 : n.cannibal; RI.weeks = wk;
      const spread = (map, share) => { for (const [k, a] of map) { const s = share(k, a); a.units += units * s; a.rev += rev * s; a.cogs += cogs * s; a.pkg += pk * s; if (!RI.addon) a.drinks += units * s; } };
      const T = tot.units || 1; spread(byStore, (k, a) => a.units / T); spread(byMonth, (k, a) => a.units / T); spread(byStoreMonth, (k, a) => a.units / T); spread(byChannel, (k, a) => a.units / T); spread(byDaypart, (k, a) => a.units / T); spread(byDow, (k, a) => a.units / T);
      const bl = get(byLine, RI.line); bl.units += units; bl.rev += rev; bl.cogs += cogs; bl.pkg += pk; if (!RI.addon) bl.drinks += units;
      tot.units += units; tot.rev += rev; tot.cogs += cogs; tot.pkg += pk; if (!RI.addon) tot.drinks += units;
      for (const p of RI.parts) compUsage.set(p.cid, (compUsage.get(p.cid) || 0) + p.pours * units);
    }
    const fin = a => ({ units: a.units, rev: a.rev, cogs: a.cogs, pkg: a.pkg, orders: a.orders.size, drinks: a.drinks, fc: a.rev ? a.cogs / a.rev * 100 : null, fcAll: a.rev ? (a.cogs + a.pkg) / a.rev * 100 : null, gp: a.rev - a.cogs - a.pkg, aov: a.orders.size ? a.rev / a.orders.size : null });
    const finMap = (m, keyName) => [...m].map(([k, a]) => Object.assign({ [keyName]: k }, fin(a))).sort((a, b) => a[keyName] < b[keyName] ? -1 : 1);
    R.totals = fin(tot);
    R.totals.orders = new Set(lines.map(L => L.oid)).size || R.totals.orders;
    R.byStore = finMap(byStore, "restaurant").map(x => Object.assign(x, { name: (M.restaurants.get(x.restaurant) || {}).name || x.restaurant, region: (M.restaurants.get(x.restaurant) || {}).region || "" }));
    R.byMonth = finMap(byMonth, "month"); R.byStoreMonth = new Map([...byStoreMonth].map(([k, a]) => [k, fin(a)]));
    R.byChannel = CHANNELS.filter(c => byChannel.has(c)).map(c => Object.assign({ channel: c }, fin(byChannel.get(c))));
    const DP = DAYPARTS; R.byDaypart = DP.filter(d => byDaypart.has(d)).map(d => Object.assign({ daypart: d }, fin(byDaypart.get(d))));
    const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; R.byDow = DOW.filter(d => byDow.has(d)).map(d => Object.assign({ dow: d }, fin(byDow.get(d))));
    R.byLine = finMap(byLine, "line");
    R.coverage = uncostedRev.total ? 1 - uncostedRev.byoNoMods / uncostedRev.total : 1;
    R.compUsage = compUsage; R.compUsageSM = compUsageSM;

    // --- drink table and menu engineering
    R.itemList = [...R.drinks.values()].map(x => { x.avgPrice = x.units ? x.rev / x.units : x.price; x.unitCost = x.units ? x.cogs / x.units : x.food; x.cmUnit = x.avgPrice != null ? x.avgPrice - x.unitCost : null; x.cmTotal = x.rev - x.cogs; x.fcSold = x.rev ? x.cogs / x.rev * 100 : x.fc; x.share = tot.units ? x.units / tot.units : 0; x.nStores = x.restaurants.size; return x; });
    const drinks = R.itemList.filter(x => !x.addon && !x.byo && x.units > 0), addons = R.itemList.filter(x => x.addon && x.units > 0);
    R.itemList.forEach(x => { if (x.byo) { x.quadrant = null; x.read = "Well & call drink: see the calls analysis"; } });
    const me = (list) => { if (!list.length) return { pop: 0, cm: 0 }; const U = sum(list, x => x.units); const pop = 0.7 * U / list.length; const cm = sum(list, x => x.cmTotal) / U; list.forEach(x => { const hiPop = x.units >= pop, hiCm = x.cmUnit >= cm; x.quadrant = hiPop ? (hiCm ? "Star" : "Plowhorse") : (hiCm ? "Puzzle" : "Dog"); x.read = x.quadrant === "Star" ? "Keep and feature" : x.quadrant === "Plowhorse" ? "Reprice or trim cost" : x.quadrant === "Puzzle" ? "Promote or reposition" : "Candidate to cut"; }); return { pop, cm }; };
    R.me = { drinks: me(drinks), addons: me(addons) };

    // --- well & call
    const pickList = [...picks].map(([cid, a]) => { const c = M.comps.get(cid); const unit = costOf(M, [{ cid, pours: 1 }], refStore, refDate, scn).parts[0]; return { cid, name: c.name, category: c.category, fam: c.fam, picks: a.picks, byoPicks: a.byo, qty: a.qty, rate: byoOrders ? a.byo / byoOrders : 0, upcharge: unit ? unit.upcharge : c.upcharge, cost: unit ? unit.unit : 0, menu: [...M.drinks.values()].filter(i => i.set.has(cid) && i.active).length }; }).sort((a, b) => b.picks - a.picks);
    R.byo = { orders: byoOrders, avgComponents: byoOrders ? byoComps / byoOrders : null, picks: pickList, byLine: [...byoByLineCount].map(([line, n]) => ({ line, n })),
      byStation: [...byoByStation].map(([category, a]) => ({ category, avgPerOrder: byoOrders ? a.qty / byoOrders : 0, share: byoOrders ? a.orders / byoOrders : 0 })).sort((a, b) => b.avgPerOrder - a.avgPerOrder) };
    // builds: top builds, nearest menu drink, off-menu candidates, cannibalization
    const menu = [...M.drinks.values()].filter(i => i.active && !i.byo && !i.addon && i.set.size);
    const jaccard = (A, B) => { let inter = 0; for (const x of A) if (B.has(x)) inter++; const u = A.size + B.size - inter; return u ? inter / u : 0; };
    const allBuilds = [...builds.values()].sort((a, b) => b.n - a.n);
    const topBuilds = allBuilds.slice(0, 400);
    for (const b of topBuilds) { b.set = new Set(b.comps.map(c => c.cid)); let best = null, bs = 0; for (const it of menu) { const s = jaccard(b.set, it.set); if (s > bs) { bs = s; best = it; } } b.nearest = best ? { id: best.id, name: best.name } : null; b.sim = bs; b.avgPrice = b.n ? b.rev / b.n : 0; b.unitCost = b.n ? b.cost / b.n : 0; b.fc = b.rev ? b.cost / b.rev * 100 : null; b.label = b.comps.map(c => M.comps.get(c.cid).name + " " + fmtQty(M.comps.get(c.cid), c.qty)).join(", "); b.names = b.comps.map(c => M.comps.get(c.cid).name).join(" & "); b.spirits = b.comps.filter(c => M.comps.get(c.cid).fam === "spirit").map(c => M.comps.get(c.cid).name); }
    R.byo.builds = topBuilds.slice(0, 50); R.byo.distinctBuilds = builds.size;
    R.byo.offMenu = topBuilds.filter(b => b.sim < 0.8 && b.n >= 2).slice(0, 25).map(b => Object.assign({}, b, { priceFor: priceFor(b.unitCost, target), perStoreWeek: b.n / nStores / weeks }));
    R.byo.cannibal = menu.map(it => { let look = 0; for (const b of allBuilds) { if (b.line !== it.line) continue; if (!b.set) b.set = new Set(b.comps.map(c => c.cid)); if (jaccard(b.set, it.set) >= 0.75) look += b.n; } const RI = R.drinks.get(it.id); const units = RI ? RI.units : 0; return { id: it.id, name: it.name, line: it.line, units, lookalikes: look, ratio: units + look ? look / (units + look) : 0, read: units + look === 0 ? "No data" : look / (units + look) >= 0.5 ? "Mostly formalizes an existing build" : look / (units + look) >= 0.2 ? "Partly overlaps with well & call" : "Brings mostly new demand" }; }).sort((a, b) => b.ratio - a.ratio);

    // --- up-charge coverage
    R.upcharges = [...M.comps.values()].filter(c => c.upcharge > 0 || (scn && scn.upcharges[c.id] > 0)).map(c => { const p = costOf(M, [{ cid: c.id, pours: 1 }], refStore, refDate, scn).parts[0]; const unit = p ? p.unit : 0; const up = p ? p.upcharge : c.upcharge; const inc = incrementalOf(c, unit); const pk = picks.get(c.id); const n = pk ? pk.qty : 0; const well = wellOf(c); return { cid: c.id, name: c.name, category: c.category, fam: c.fam, upcharge: up, cost: unit, incremental: inc, margin: up - inc, marginPct: up ? (up - inc) / up * 100 : null, breakEven: c.fam === "spirit" ? up + well : up, picks: n, marginTotal: (up - inc) * n, perStoreWeek: n / nStores / weeks, baseMain: well }; }).sort((a, b) => b.upcharge - a.upcharge);
    R.includedMain = includedMain;

    // --- attach rates (orders with a drink that also hold an food), by channel
    const orders = [...M.orders.values()].filter(o => o.lines.some(inScope));
    R.ordersN = orders.length; let foodOrders = 0;
    const attach = new Map(); // mealKey -> {n, any, lines: Map(addonLine -> n), drinks: Map(addonItem -> n), ch: Map(channel -> {n, lines: Map})}
    const addonLines = [...M.addonLines];
    for (const o of orders) {
      const ls = o.lines.filter(inScope); const mealsIn = ls.filter(L => !M.drinks.get(L.iid).addon && !(scn && scn.removeSet.has(L.iid))); const adds = ls.filter(L => M.drinks.get(L.iid).addon); if (adds.length) foodOrders++;
      const addLines = new Set(adds.map(L => M.drinks.get(L.iid).line)), addItems = new Set(adds.map(L => L.iid));
      for (const mk of new Set(mealsIn.map(L => L.iid))) {
        let a = attach.get(mk); if (!a) { a = { key: mk, n: 0, any: 0, lines: new Map(), drinks: new Map(), ch: new Map() }; attach.set(mk, a); }
        a.n++; if (adds.length) a.any++; for (const l of addLines) a.lines.set(l, (a.lines.get(l) || 0) + 1); for (const i of addItems) a.drinks.set(i, (a.drinks.get(i) || 0) + 1);
        let c = a.ch.get(o.ch); if (!c) { c = { n: 0, lines: new Map() }; a.ch.set(o.ch, c); } c.n++; for (const l of addLines) c.lines.set(l, (c.lines.get(l) || 0) + 1);
      }
    }
    R.attach = { lines: addonLines, drinks: [...attach.values()].map(a => ({ key: a.key, name: M.drinks.get(a.key).name, line: M.drinks.get(a.key).line, n: a.n, rates: Object.fromEntries(addonLines.map(l => [l, a.n ? (a.lines.get(l) || 0) / a.n : 0])), anyRate: a.n ? a.any / a.n : 0, top: [...a.drinks].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([iid, n]) => ({ id: iid, name: M.drinks.get(iid).name, rate: n / a.n })), byChannel: Object.fromEntries([...a.ch].map(([ch, c]) => [ch, { n: c.n, rates: Object.fromEntries(addonLines.map(l => [l, c.n ? (c.lines.get(l) || 0) / c.n : 0])) }])) })).sort((a, b) => b.n - a.n) };
    R.foodAttach = orders.length ? foodOrders / orders.length : null;
    // --- spend per order drivers
    const totalRev = sum([...orderTotals.values()]); const nOrders = orderTotals.size || 1;
    R.drivers = [...itemOrders].map(([iid, set]) => { const n = set.size; let withRev = 0; for (const o of set) withRev += orderTotals.get(o) || 0; const aovWith = withRev / n; const rest = nOrders - n; const aovWithout = rest ? (totalRev - withRev) / rest : null; return { id: iid, name: M.drinks.get(iid).name, line: M.drinks.get(iid).line, n, aovWith, aovWithout, lift: aovWithout != null ? aovWith - aovWithout : null }; }).filter(x => x.n >= 20).sort((a, b) => (b.lift || 0) - (a.lift || 0));
    R.aov = totalRev / nOrders;
    // --- channel price differences (avg paid per drink by channel vs in-restaurant)
    const chPrice = new Map(); for (const L of lines) { const k = L.iid + "|" + L.ch; let a = chPrice.get(k); if (!a) { a = { n: 0, rev: 0 }; chPrice.set(k, a); } const p = L.net != null ? L.net : M.itemPrice(L.iid, L.restaurant); a.n += L.qty; a.rev += (p || 0) * L.qty; }
    R.channelPrices = [...R.drinks.values()].filter(x => x.units > 0 && !x.byo).map(x => { const row = { id: x.id, name: x.name, line: x.line }; for (const ch of M.channels) { const a = chPrice.get(x.id + "|" + ch); row[ch] = a && a.n ? a.rev / a.n : null; } return row; }).filter(r => M.channels.some(ch => r[ch] != null && r.in_store != null && Math.abs(r[ch] - r.in_store) > 0.01));

    // --- operations
    const curatedAll = [...M.drinks.values()].filter(i => i.active && !i.byo && i.recipe.length);
    const useCount = new Map(); for (const it of curatedAll) for (const p of it.recipe) useCount.set(p.cid, (useCount.get(p.cid) || 0) + 1);
    const perSW = cid => (compUsage.get(cid) || 0) / nStores / weeks; const VOL = scope.volume || 20; // pours per restaurant-week that count as "at volume"
    const prepOf = (recipe) => { const categories = new Set(recipe.map(p => (M.comps.get(p.cid) || {}).category)); return { ingredients: recipe.length, categories: categories.size, steps: sum(recipe, p => (M.comps.get(p.cid) || { steps: 1 }).steps || 1), exclusive: recipe.filter(p => (useCount.get(p.cid) || 0) <= 1 && perSW(p.cid) < VOL).map(p => M.comps.get(p.cid).name), atVolume: recipe.filter(p => perSW(p.cid) >= VOL || (useCount.get(p.cid) || 0) >= 2).length }; };
    R.ops = {};
    R.ops.prep = R.itemList.filter(x => !x.byo && x.parts.length).map(x => { const pr = prepOf(x.parts.map(p => ({ cid: p.cid, pours: p.pours }))); return Object.assign({ id: x.id, name: x.name, line: x.line, units: x.units, isNew: !!x.isNew, crossUtil: pr.ingredients ? pr.atVolume / pr.ingredients : null }, pr); }).sort((a, b) => b.steps - a.steps);
    R.crossUtil = recipe => { const pr = prepOf(recipe); return { score: pr.ingredients ? pr.atVolume / pr.ingredients : null, newLoad: recipe.filter(p => !useCount.has(p.cid) && perSW(p.cid) < VOL).map(p => M.comps.get(p.cid) ? M.comps.get(p.cid).name : p.cid), atVolume: pr.atVolume, ingredients: pr.ingredients }; };
    // waste
    const wasteIn = M.waste.filter(r => (!scope.restaurants || scope.restaurants.has(r.restaurant_id)) && (!scope.months || scope.months.has(r.date.slice(0, 7))));
    const wasteBy = new Map(); for (const r of wasteIn) { let a = wasteBy.get(r.ingredient_id); if (!a) { a = { qty: 0, cost: 0, reasons: new Map() }; wasteBy.set(r.ingredient_id, a); } const c = M.compCost(r.ingredient_id, r.restaurant_id, r.date); a.qty += r.qty_pours; a.cost += r.qty_pours * c; if (r.reason) a.reasons.set(r.reason, (a.reasons.get(r.reason) || 0) + r.qty_pours); }
    R.ops.hasWaste = wasteIn.length > 0;
    R.ops.waste = [...M.comps.values()].filter(c => c.fam !== "extras").map(c => { const w = wasteBy.get(c.id); const use = compUsage.get(c.id) || 0; return { cid: c.id, name: c.name, category: c.category, fam: c.fam, perishable: c.perishable, usage: use, perStoreWeek: perSW(c.id), wasteQty: w ? w.qty : 0, wasteCost: w ? w.cost : 0, wastePerWeek: w ? w.cost / weeks : 0, wastePct: w && (use + w.qty) ? w.qty / (use + w.qty) * 100 : null, reasons: w ? [...w.reasons].sort((a, b) => b[1] - a[1]) : [], menu: useCount.get(c.id) || 0, onLine: BAR_FAMS.has(c.fam), rate: byoOrders && picks.get(c.id) ? picks.get(c.id).byo / byoOrders : 0 }; });
    R.ops.wasteTotal = sum(R.ops.waste, w => w.wasteCost); R.ops.wastePctCogs = tot.cogs ? R.ops.wasteTotal / tot.cogs * 100 : null;
    R.ops.lowMovers = R.ops.waste.filter(w => w.onLine && w.menu === 0 && (byoOrders ? w.rate < 0.03 : true)).sort((a, b) => a.rate - b.rate);
    // theoretical vs actual usage
    const invIn = M.inventory.filter(r => (!scope.restaurants || scope.restaurants.has(r.restaurant_id)) && (!scope.months || scope.months.has(r.period)));
    R.ops.hasInventory = invIn.length > 0;
    const tva = new Map(); for (const r of invIn) { const actual = ((r.begin_qty || 0) + (r.purchased_qty || 0) - (r.end_qty || 0)) * M.pourPerUnit(r.ingredient_id, r.qty_unit); const theo = compUsageSM.get(r.ingredient_id + "|" + r.restaurant_id + "|" + r.period) || 0; let a = tva.get(r.ingredient_id); if (!a) { a = { actual: 0, theo: 0, n: 0 }; tva.set(r.ingredient_id, a); } a.actual += actual; a.theo += theo; a.n++; }
    R.ops.tva = [...tva].map(([cid, a]) => { const c = M.comps.get(cid); const cost = M.compCost(cid, refStore, refDate); return { cid, name: c.name, category: c.category, theoretical: a.theo, actual: a.actual, variance: a.actual - a.theo, variancePct: a.theo ? (a.actual - a.theo) / a.theo * 100 : null, varianceCost: (a.actual - a.theo) * cost, read: !a.theo ? "No theoretical usage" : (a.actual - a.theo) / a.theo > 0.1 ? "Over-pouring, spillage or shrink" : (a.actual - a.theo) / a.theo < -0.05 ? "Under-pouring or a count error" : "In line" }; }).sort((a, b) => Math.abs(b.varianceCost) - Math.abs(a.varianceCost));
    // trend: per restaurant per month fc, and per drink cm first vs last month
    const monthsIn = R.byMonth.map(m => m.month);
    R.ops.trend = { months: monthsIn, restaurants: R.byStore.map(s => ({ restaurant: s.restaurant, name: s.name, points: monthsIn.map(m => { const a = R.byStoreMonth.get(s.restaurant + "|" + m); return a ? a.fc : null; }) })),
      drinks: monthsIn.length >= 2 ? R.itemList.filter(x => x.units > 0 && !x.byo).map(x => { const f = x.months.get(monthsIn[0]), l = x.months.get(monthsIn[monthsIn.length - 1]); if (!f || !l || !f.units || !l.units) return null; const cmF = (f.rev - f.cogs) / f.units, cmL = (l.rev - l.cogs) / l.units; const fcF = f.rev ? f.cogs / f.rev * 100 : null, fcL = l.rev ? l.cogs / l.rev * 100 : null; return { id: x.id, name: x.name, line: x.line, cmFirst: cmF, cmLast: cmL, cmDelta: cmL - cmF, fcFirst: fcF, fcLast: fcL, fcDelta: fcL != null && fcF != null ? fcL - fcF : null, unitsFirst: f.units, unitsLast: l.units, slipping: cmL < cmF - 0.1 || (fcL != null && fcF != null && fcL - fcF > 2) }; }).filter(Boolean).sort((a, b) => a.cmDelta - b.cmDelta) : [] };
    // regional: drinks sold in a subset of restaurants; restaurant price overrides
    R.ops.regional = { drinks: R.itemList.filter(x => x.units > 0 && x.nStores < nStores && nStores > 1).map(x => ({ id: x.id, name: x.name, line: x.line, units: x.units, restaurants: [...x.restaurants].map(s => (M.restaurants.get(s) || { name: s }).name) })), prices: [...M.drinks.values()].filter(i => i.active && i.prices.size).map(i => ({ id: i.id, name: i.name, line: i.line, base: i.price, restaurants: [...i.prices].map(([s, p]) => ({ restaurant: s, name: (M.restaurants.get(s) || { name: s }).name, price: p })) })) };

    // --- reconciliation (ignores the channel filter; by restaurant-month, full data)
    R.reconcile = reconcile(M, scope, scn);
    // --- cost version history
    R.history = history(M, scn);
    // --- price ladder
    R.ladder = ladder(M, R, scn);
    // --- strength check: alcohol per drink from the spec (pour volume × ABV), in US standard drinks (0.6 fl oz of pure alcohol)
    const alcoholOz = (c, pours) => { if (c.abv == null || !(c.pourSize > 0)) return null; const u = unitOf(c.pourUnit); if (!u || u[0] !== "v") return 0; return pours * c.pourSize * u[1] / 29.5735295625 * c.abv / 100; };
    R.strength = [...M.drinks.values()].filter(i => i.active && !i.byo && i.recipe.length).map(i => { let oz = 0, missing = 0, vol = 0; for (const p of i.recipe) { const c = M.comps.get(p.cid); const a = alcoholOz(c, p.pours); if (a == null) { if (c.fam === "spirit" || c.fam === "liqueur" || c.fam === "wine") missing++; } else oz += a; const u = unitOf(c.pourUnit); if (u && u[0] === "v" && c.pourSize > 0) vol += p.pours * c.pourSize * u[1] / 29.5735295625; } return { id: i.id, name: i.name, line: i.line, alcoholOz: oz, stdDrinks: oz / 0.6, volumeOz: vol, abv: vol ? oz / vol * 100 : null, missing, read: missing ? "ABV missing for a spirit" : oz / 0.6 > 2 ? "Strong: over two standard drinks" : oz / 0.6 > 1.5 ? "Stiff" : oz / 0.6 < 0.4 ? "Light" : "Typical" }; }).sort((a, b) => b.stdDrinks - a.stdDrinks);
    R.hasStrength = R.strength.some(n => n.alcoholOz > 0);
    // --- disruption exposure
    if (scn && scn.unavailable.length) R.disruption = scn.unavailable.map(cid => { const c = M.comps.get(cid); if (!c) return null; const curatedHit = R.itemList.filter(x => x.parts.some(p => p.cid === cid) && x.units > 0); const curatedRev = sum(curatedHit, x => x.rev); const pk = picks.get(cid); const byoN = pk ? pk.byo : 0; let byoRev = 0; for (const b of allBuilds) { if (!b.set) b.set = new Set(b.comps.map(c => c.cid)); if (b.set.has(cid)) byoRev += b.rev; } return { cid, name: c.name, category: c.category, drinks: curatedHit.map(x => ({ id: x.id, name: x.name, units: x.units, rev: x.rev, share: tot.rev ? x.rev / tot.rev : 0 })), curatedRev, byoOrders: byoN, byoRev, revAtRisk: curatedRev + byoRev, share: tot.rev ? (curatedRev + byoRev) / tot.rev : 0 }; }).filter(Boolean);
    return R;
  }

  /* ---------- 10b. Month-to-month decomposition ---------- */
  // Why did pour cost % move from month A to month B? Cost effect = A's sales re-costed at B's costs; the rest is mix and price.
  // Per drink: contribution to the change in points = (its cost ÷ all sales)_B − (its cost ÷ all sales)_A, which sums exactly to the total change.
  function decompose(M, restaurants, monthA, monthB, target) {
    const sc = m => ({ restaurants, months: new Set([m]), channel: "all", target });
    const RA = analyze(M, sc(monthA)), RB = analyze(M, sc(monthB));
    if (!RA.hasSales || !RB.hasSales) return { ok: false, RA, RB };
    const asOf = RB.refDate; const RA2 = analyze(M, Object.assign(sc(monthA), { costAsOf: asOf }));
    const fcA = RA.totals.fc, fcB = RB.totals.fc, fcA2 = RA2.totals.fc;
    const drinks = [...RB.drinks.values()].map(b => { const a = RA.drinks.get(b.id); const sa = RA.totals.rev ? (a ? a.cogs : 0) / RA.totals.rev * 100 : 0, sb = RB.totals.rev ? b.cogs / RB.totals.rev * 100 : 0; return { id: b.id, name: b.name, line: b.line, pts: sb - sa, unitsA: a ? a.units : 0, unitsB: b.units, fcA: a && a.rev ? a.cogs / a.rev * 100 : null, fcB: b.rev ? b.cogs / b.rev * 100 : null, shareA: RA.totals.rev && a ? a.rev / RA.totals.rev : 0, shareB: RB.totals.rev ? b.rev / RB.totals.rev : 0 }; }).filter(x => Math.abs(x.pts) > 0.005).sort((x, y) => Math.abs(y.pts) - Math.abs(x.pts));
    const lastA = RA.refDate; const comps = [...M.comps.values()].map(c => ({ cid: c.id, name: c.name, category: c.category, before: compCostRaw(M, c.id, "", lastA), after: compCostRaw(M, c.id, "", asOf), usage: RB.compUsage.get(c.id) || 0 })).filter(c => Math.abs(c.after - c.before) > 1e-9).map(c => Object.assign(c, { pct: c.before ? (c.after - c.before) / c.before * 100 : null, dollars: (c.after - c.before) * c.usage, pts: RB.totals.rev ? (c.after - c.before) * c.usage / RB.totals.rev * 100 : 0 })).sort((x, y) => Math.abs(y.pts) - Math.abs(x.pts));
    const mix = (R) => { const drinks = R.totals.drinks || 1; const prem = R.byo.picks.filter(p => p.fam === "spirit" && p.upcharge > 0).reduce((a, p) => a + p.byoPicks, 0); return { byoShare: R.byo.orders / drinks, premiumShare: R.byo.orders ? prem / R.byo.orders : null, addonShare: R.foodAttach, avgPaid: R.totals.units ? R.totals.rev / R.totals.units : null, aov: R.totals.aov }; };
    return { ok: true, monthA, monthB, fcA, fcB, fcA2, total: fcB - fcA, costEffect: fcA2 - fcA, mixEffect: fcB - fcA2, drinks, ingredients: comps, mixA: mix(RA), mixB: mix(RB), RA, RB, byStore: RB.byStore.map(s => { const a = RA.byStore.find(x => x.restaurant === s.restaurant); return { restaurant: s.restaurant, name: s.name, fcA: a ? a.fc : null, fcB: s.fc, delta: a && a.fc != null && s.fc != null ? s.fc - a.fc : null, rev: s.rev, gp: s.gp }; }) };
  }
  /* ---------- 10c. New-drink candidates ---------- */
  // Rank builds guests already order that no menu drink offers: demand (orders per restaurant-week) × contribution per order × share of ingredients at volume.
  function suggest(M, R, target) {
    const t = target || R.scope.target || 30;
    const list = R.byo.offMenu.map(b => { const recipe = b.comps.map(c => ({ cid: c.cid, pours: c.qty })); const cu = R.crossUtil(recipe); const cm = b.avgPrice - b.unitCost; const gpPerStoreWeek = cm * b.perStoreWeek; const line = b.line; const base = M.byoByLine.get(line) ? M.itemPrice(M.byoByLine.get(line), R.refStore) : null;
      const price = Math.round(b.avgPrice * 20) / 20; const fcAtPrice = price ? b.unitCost / price * 100 : null;
      const why = [`Ordered ${Math.round(b.n).toLocaleString()} times in scope (${b.perStoreWeek.toFixed(1)} per restaurant-week)`, `${cu.atVolume} of ${cu.ingredients} ingredients already move at volume${cu.newLoad.length ? "; new to stock or prep: " + cu.newLoad.join(", ") : ""}`, `${(b.fc).toFixed(1)}% pour cost at the $${b.avgPrice.toFixed(2)} guests already pay (${b.fc <= t ? "under" : "over"} the ${t}% target; $${(b.priceFor || 0).toFixed(2)} would hit it exactly)`, b.nearest ? `Closest menu drink is ${b.nearest.name}, only ${Math.round(b.sim * 100)}% alike` : "Nothing like it on the menu"];
      return { key: b.key, label: b.label, names: b.names, line, recipe, n: b.n, perStoreWeek: b.perStoreWeek, avgPrice: b.avgPrice, suggestedPrice: price, unitCost: b.unitCost, fc: b.fc, fcAtPrice, priceFor: b.priceFor, cm, gpPerStoreWeek, crossUtil: cu.score, newLoad: cu.newLoad, nearest: b.nearest, sim: b.sim, spirits: b.spirits, score: gpPerStoreWeek * (cu.score == null ? 1 : 0.5 + 0.5 * cu.score) * (b.fc <= t ? 1 : t / b.fc), why, base }; });
    return list.sort((a, b) => b.score - a.score);
  }

  /* ---------- 10d. Recommendations: given a situation, what is the best course of action? ----------
     Candidate moves (repricing, up-charge changes with the ladder moved alongside, pour trims, swaps, removals, new drinks)
     are scored in closed form with the same formulas the scenario engine uses, ranked, combined into a plan with at most one
     move per drink and per ingredient, and the plan is verified with one full engine run. */
  const r05 = v => Math.round(v * 20) / 20;
  function addComponent(M, c) { // a ingredient defined on the fly (a new product): joins the model for this session
    const id = c.id || slug(c.name); if (M.comps.has(id)) return id;
    M.comps.set(id, { id, name: c.name, category: c.category || "Other", fam: CAT_FAM(c.category), upcharge: c.upcharge || 0, perishable: null, shelf: null, steps: c.steps || 1, par: null, abv: c.abv == null ? null : c.abv, pourSize: c.pourSize || 1, pourUnit: c.pourUnit || "fl oz", versions: new Map([["", [{ date: "0000-00-00", cost: c.cost, how: "given" }]]]), dates: new Set(), transient: true });
    M.clearCache(); return id;
  }
  function recommend(M, scope, trigger, opts) {
    opts = Object.assign({ elasticity: -0.8, maxStep: 1, minUpMargin: 0.25, allowPortion: true, allowSwap: true, allowRemove: true, allowNew: true, retention: 0.8, cannibal: 0.7, trimFrac: 0.125, verify: true, limit: 12, minGain: 0.5, likeForLike: 0.5 }, opts || {});
    const e = opts.elasticity; const target = scope.target || 30;
    const R0 = analyze(M, scope); const period = { restaurants: R0.nStores, weeks: R0.weeks };
    // 1. the situation as a base scenario, and what it touches
    let scnT = null; const focusC = new Set(), focusI = new Set(); let kind = trigger.type;
    if (kind === "cost") { scnT = { costPct: { [trigger.cid]: trigger.pct } }; focusC.add(trigger.cid); }
    else if (kind === "unavailable") { const c0 = M.comps.get(trigger.cid); const nil = addComponent(M, { id: "__none__", name: "nothing", category: c0 ? c0.category : "Other", cost: 0 }); const lost = [...M.drinks.values()].filter(i => i.active && !i.byo && i.recipe.some(p => p.cid === trigger.cid)).map(i => i.id); scnT = { unavailable: [trigger.cid], remove: lost, retention: opts.retention, swaps: [{ from: trigger.cid, to: nil }] }; focusC.add(trigger.cid); }
    else if (kind === "price") { scnT = trigger.cid ? { upcharges: { [trigger.cid]: trigger.value } } : { prices: { [trigger.iid]: trigger.value } }; if (trigger.cid) focusC.add(trigger.cid); else focusI.add(trigger.iid); }
    else if (kind === "newComponent") { const id = addComponent(M, trigger.comp); trigger.cid = id; focusC.add(id); }
    const RT = scnT ? analyze(M, scope, Object.assign({ elasticity: e }, scnT)) : R0;
    const RX = kind === "unavailable" ? R0 : RT; // the state candidates are read from (for a lost ingredient: today's state, before the loss)
    for (const x of RX.itemList) if (x.parts.some(p => focusC.has(p.cid))) focusI.add(x.id);
    const situation = { kind, fc0: R0.totals.fc, fc: RT.totals.fc, gp0: R0.totals.gp, gp: RT.totals.gp, dGp: RT.totals.gp - R0.totals.gp, rev: RT.totals.rev, drinks: [...focusI].map(i => RX.drinks.get(i)).filter(Boolean), comps: [...focusC].map(c => M.comps.get(c)).filter(Boolean) };
    if (kind === "cost") { const c = M.comps.get(trigger.cid); situation.before = R0.upcharges.find(u => u.cid === c.id) ? R0.upcharges.find(u => u.cid === c.id).cost : M.compCost(c.id, R0.refStore, R0.refDate); situation.after = situation.before * (1 + trigger.pct / 100); situation.usage = R0.compUsage.get(c.id) || 0; situation.dGp = -situation.usage * (situation.after - situation.before); situation.picks = (R0.byo.picks.find(p => p.cid === c.id) || { byoPicks: 0 }).byoPicks; }
    if (kind === "unavailable") { situation.disruption = RT.disruption && RT.disruption[0]; situation.lostItems = scnT.remove.map(i => R0.drinks.get(i)).filter(Boolean); situation.picks = (R0.byo.picks.find(p => p.cid === trigger.cid) || { qty: 0, byoPicks: 0 }); }
    if (kind === "newComponent") { situation.cost = M.compCost(trigger.cid, R0.refStore, R0.refDate); situation.included = RT.includedMain; }
    // helpers on the post-situation state
    const pkgU = x => x.units ? x.pkg / x.units : (x.pkgIn + x.pkgDig) / 2; // extras per unit, so gains match the engine's gross profit
    const lineCM = new Map(); for (const line of M.lines) { const xs = RX.itemList.filter(x => x.line === line && x.units > 0 && !x.byo); const u = sum(xs, x => x.units); lineCM.set(line, u ? sum(xs, x => (x.cmUnit - pkgU(x)) * x.units) / u : 0); }
    const cands = [];
    const add = c => { if (c && Number.isFinite(c.dGp) && c.dGp > opts.minGain) cands.push(c); };
    const curatedWith = cid => RX.itemList.filter(x => !x.byo && !x.addon && x.parts.some(p => p.cid === cid) && !x.removed);
    // 2. candidate generators
    const priceCand = (x, np, why) => { const p0 = x.basePrice != null ? x.basePrice : x.price; if (!(p0 > 0) || Math.abs(np - p0) < 0.01 || np <= x.unitCost) return null; const f = Math.max(0, 1 + e * (np - p0) / p0); const k = pkgU(x); const paid = x.avgPrice * np / p0; const dGp = x.units * f * (paid - x.unitCost - k) - x.units * (x.avgPrice - x.unitCost - k); const fcAfter = x.food / np * 100;
      return { kind: "price", id: "price:" + x.id + ":" + np, label: `${np > p0 ? "Raise" : "Lower"} ${x.name} to $${np.toFixed(2)}`, itemIds: [x.id], cids: [], dGp, confidence: "assumption", assumes: `elasticity ${e}: ${pf1((1 - f) * 100)} ${f < 1 ? "fewer" : "more"} units`, volumeLoss: 1 - f, fcAfter, overTarget: fcAfter > target, reasons: [why, `contribution per unit $${(x.avgPrice - x.unitCost).toFixed(2)} → $${(paid - x.unitCost).toFixed(2)}`, `pour cost ${pf1(x.fc)} → ${pf1(fcAfter)}${fcAfter > target ? " (still over target)" : ""}`], scn: { prices: { [x.id]: np } } }; };
    const pf1 = v => v == null ? "—" : Math.abs(v).toFixed(1) + "%";
    const upCand = (u, nu, why) => { const U = u.upcharge, d = nu - U; if (Math.abs(d) < 0.01 || nu < 0) return null; const pf = Math.max(0, Math.min(1.5, 1 + e * d / (U || 1))); let dGp = u.picks * (d * pf - (1 - pf) * u.margin); const lad = RT.ladder.filter(l => l.ups.some(x => x.name === u.name) && l.gap > -0.05); const prices = {}; const reasons = [why, `margin per add $${u.margin.toFixed(2)} → $${(nu - u.incremental).toFixed(2)}`, `${pf1((1 - pf) * 100)} fewer picks assumed`];
      for (const l of lad) { const x = RT.drinks.get(l.id); if (!x) continue; const pc = priceCand(x, r05(x.price + d), ""); if (pc) { dGp += pc.dGp; prices[l.id] = r05(x.price + d); } }
      if (lad.length) reasons.push(`${lad.length} menu drink${lad.length === 1 ? "" : "s"} moved +$${d.toFixed(2)} to keep the ladder`);
      return { kind: "upcharge", id: "up:" + u.cid + ":" + nu, label: `${d > 0 ? "Raise" : "Lower"} the ${u.name} up-charge to $${nu.toFixed(2)}${lad.length ? ` and move ${lad.length} menu drink${lad.length === 1 ? "" : "s"} with it` : ""}`, itemIds: Object.keys(prices), cids: [u.cid], dGp, confidence: "assumption", assumes: `elasticity ${e}`, volumeLoss: 1 - pf, marginAfter: nu - u.incremental, reasons, scn: { upcharges: { [u.cid]: nu }, prices } }; };
    const trimCand = (x, p, frac, why) => { if (!opts.allowPortion || p.pours < 0.5 || !TRIM_FAMS.includes(p.fam)) return null; const np = Math.round(p.pours * (1 - frac) * 8) / 8; if (np >= p.pours || np <= 0) return null; const save = (p.pours - np) * p.unit; const dGp = x.units * save; const recipe = x.parts.map(q => ({ cid: q.cid, pours: q.cid === p.cid ? np : q.pours }));
      return { kind: "pour", id: "trim:" + x.id + ":" + p.cid, label: `Trim ${p.name} in ${x.name} from ${fmtQty(M.comps.get(p.cid), p.pours)} to ${fmtQty(M.comps.get(p.cid), np)}`, itemIds: [x.id], cids: [], dGp, confidence: "data", assumes: null, culinary: true, fcAfter: (x.food - save) / (x.price || 1) * 100, reasons: [why, `saves $${save.toFixed(2)} per unit on ${Math.round(x.units).toLocaleString()} units`, `pour cost ${pf1(x.fc)} → ${pf1((x.food - save) / (x.price || 1) * 100)}`, "needs a taste test and the strength check"], scn: { recipes: { [x.id]: recipe } } }; };
    const swapCand = (from, to, why) => { if (!opts.allowSwap || from === to) return null; const a = M.comps.get(from), b = M.comps.get(to); if (!a || !b) return null; const everywhere = kind === "unavailable"; const ca = M.compCost(from, RT.refStore, RT.refDate) * (scnT && scnT.costPct && scnT.costPct[from] ? 1 + scnT.costPct[from] / 100 : 1), cb = M.compCost(to, RT.refStore, RT.refDate); if (!everywhere && cb < ca * opts.likeForLike) return null; if (a.fam === "spirit" && ((a.upcharge > 0) !== (b.upcharge > 0)) && !everywhere) return null; const drinks = curatedWith(from); if (!drinks.length && !everywhere) return null;
      const curatedUse = sum(drinks, x => x.units * (x.parts.find(p => p.cid === from) || { pours: 0 }).pours); const pk = RX.byo.picks.find(p => p.cid === from); const byoQty = everywhere && pk ? pk.qty : 0; const lostUp = byoQty * Math.max(0, (a.upcharge || 0) - (b.upcharge || 0));
      // relative to the baseline: for a lost ingredient the baseline is "those drinks are gone and the picks pay nothing", so a substitute wins back their contribution
      const kept = everywhere ? sum(drinks, x => (x.rev - x.cogs - x.pkg) - opts.retention * x.units * (lineCM.get(x.line) || 0)) : 0;
      const dGp = everywhere ? kept + curatedUse * (ca - cb) + byoQty * ((b.upcharge || 0) - cb) : (curatedUse + byoQty) * (ca - cb) - lostUp;
      const recipes = {}; if (!everywhere) for (const x of drinks) recipes[x.id] = x.parts.map(q => ({ cid: q.cid === from ? to : q.cid, pours: q.pours }));
      return { kind: "swap", id: "swap:" + from + ":" + to, label: everywhere ? `Substitute ${b.name}${b.transient ? " (new)" : ""} for ${a.name} everywhere, including the well & call line` : `Replace ${a.name} with ${b.name}${b.transient ? " (new)" : ""} in ${drinks.length} menu drink${drinks.length === 1 ? "" : "s"}`, itemIds: drinks.map(x => x.id), cids: everywhere ? [from, to] : [], dGp, confidence: "data", assumes: null, culinary: true, reasons: [why, `$${ca.toFixed(2)} → $${cb.toFixed(2)} per pour on ${Math.round(curatedUse + byoQty).toLocaleString()} pours`, everywhere ? `keeps ${drinks.length} menu drink${drinks.length === 1 ? "" : "s"} on the menu and ${Math.round(byoQty).toLocaleString()} well & call picks served${lostUp ? `; the $${(a.upcharge || 0).toFixed(2)} ${a.name} up-charge ${b.upcharge ? "becomes $" + b.upcharge.toFixed(2) : "is not charged"}` : ""}` : drinks.map(x => x.name).join(", "), "same category; taste and spec need the bar manager's sign-off"], scn: everywhere ? { swaps: [{ from, to }] } : { recipes } }; };
    const removeCand = (x, why) => { if (!opts.allowRemove || x.byo || x.isNew || x.addon) return null; const back = opts.retention * x.units * (lineCM.get(x.line) || 0); const dGp = -(x.rev - x.cogs - x.pkg) + back; const pr = RT.ops.prep.find(p => p.id === x.id);
      return { kind: "remove", id: "remove:" + x.id, label: `Remove ${x.name}`, itemIds: [x.id], cids: [], dGp, confidence: "assumption", assumes: `${Math.round(opts.retention * 100)}% of its orders move to other ${x.line}`, reasons: [why, `gives up $${Math.round(x.rev - x.cogs - x.pkg).toLocaleString()} of contribution, gets $${Math.round(back).toLocaleString()} back from the line`, pr && pr.exclusive.length ? `drops prep for ${pr.exclusive.join(", ")}` : "no prep disappears with it"], scn: { remove: [x.id], retention: opts.retention } }; };
    const newCand = (sg, why) => { if (!opts.allowNew) return null; const units = sg.perStoreWeek * period.restaurants * period.weeks; const kp = (M.pkg(sg.line, "in_store") + M.pkg(sg.line, "app")) / 2; const dGp = units * (sg.suggestedPrice - sg.unitCost - kp) - opts.cannibal * units * (lineCM.get(sg.line) || 0); const id = "new-" + sg.key.slice(0, 24).replace(/[^a-z0-9]+/gi, "-");
      return { kind: "new", id: "new:" + sg.key, label: `List ${sg.names || sg.label} as a menu drink at $${sg.suggestedPrice.toFixed(2)}`, itemIds: [], cids: [], dGp, confidence: "assumption", assumes: `${Math.round(sg.perStoreWeek)} units per restaurant-week (what guests order today), ${Math.round(opts.cannibal * 100)}% pulled from the section`, reasons: [why].concat(sg.why.slice(0, 3)), scn: { newItems: [{ id, name: sg.names || sg.label, line: sg.line, price: sg.suggestedPrice, recipe: sg.recipe, unitsPerStoreWeek: Math.round(sg.perStoreWeek), cannibal: opts.cannibal }] }, recipe: sg.recipe, price: sg.suggestedPrice }; };
    const steps = [0.25, 0.5, 0.75, 1].filter(d => d <= opts.maxStep + 1e-9);
    // 3. generate by situation
    const overItems = RT.itemList.filter(x => !x.byo && !x.addon && x.units > 0 && x.fc > target && !x.removed);
    const thinUps = RT.upcharges.filter(u => u.margin < opts.minUpMargin * u.upcharge);
    const considerItem = (x, why) => { for (const d of steps) add(priceCand(x, r05(x.price + d), why)); if (x.priceFor > x.price && x.priceFor <= x.price + opts.maxStep) add(priceCand(x, r05(Math.ceil(x.priceFor * 20) / 20), why)); const costliest = x.parts.slice().sort((a, b) => b.cost - a.cost)[0]; if (costliest) add(trimCand(x, costliest, opts.trimFrac, why)); if (x.quadrant === "Dog") add(removeCand(x, why)); };
    const considerUp = (u, why) => { for (const d of steps) add(upCand(u, r05(u.upcharge + d), why)); const need = r05(Math.ceil(u.incremental / (1 - opts.minUpMargin) * 20) / 20); if (need > u.upcharge && need <= u.upcharge + opts.maxStep) add(upCand(u, need, why)); };
    if (kind === "cost") { const c = M.comps.get(trigger.cid); const u = RT.upcharges.find(x => x.cid === c.id); if (u) considerUp(u, `${c.name} costs ${trigger.pct > 0 ? "+" : ""}${trigger.pct}%`); for (const x of curatedWith(c.id)) { for (const d of steps) add(priceCand(x, r05(x.price + d), `${x.name} uses ${c.name}`)); const p = x.parts.find(q => q.cid === c.id); if (p) add(trimCand(x, p, opts.trimFrac, `${x.name} uses ${c.name}`)); if (x.fc > target && x.quadrant === "Dog") add(removeCand(x, `${x.name} is a Dog and now over target`)); } for (const o of M.comps.values()) if (o.category === c.category && o.id !== c.id) add(swapCand(c.id, o.id, `cheaper ${c.category.toLowerCase()} alternative`)); }
    else if (kind === "unavailable") { const c = M.comps.get(trigger.cid); for (const o of M.comps.values()) if (o.category === c.category && o.id !== c.id && !o.transient) add(swapCand(c.id, o.id, `${c.name} is unavailable`)); }
    else if (kind === "newComponent") { const c = M.comps.get(trigger.cid); for (const o of M.comps.values()) if (o.category === c.category && o.id !== c.id) add(swapCand(o.id, c.id, `${c.name} is cheaper`)); const sgs = suggest(M, RT, target).slice(0, 5); for (const sg of sgs) { const st = sg.recipe.find(p => (M.comps.get(p.cid) || {}).category === c.category); if (!st) continue; const sg2 = Object.assign({}, sg, { key: sg.key + "+" + c.id, names: (sg.names || "").replace(M.comps.get(st.cid).name, c.name), recipe: sg.recipe.map(p => p.cid === st.cid ? { cid: c.id, pours: p.pours } : p), unitCost: sg.unitCost - M.compCost(st.cid, RT.refStore, RT.refDate) * st.pours + M.compCost(c.id, RT.refStore, RT.refDate) * st.pours, spirits: c.fam === "spirit" ? [c.name] : sg.spirits, suggestedPrice: r05(sg.avgPrice + Math.max(0, (c.upcharge || 0) - (M.comps.get(st.cid).upcharge || 0))) }); add(newCand(sg2, `a build guests already order, made with ${c.name}`)); } }
    else if (kind === "price") { if (trigger.cid) { const u = RT.upcharges.find(x => x.cid === trigger.cid); const lad = RT.ladder.filter(l => l.gap < -0.05); const parts = lad.map(l => { const x = RT.drinks.get(l.id); return x ? priceCand(x, r05(x.price - l.gap), "") : null; }).filter(Boolean); if (parts.length) add({ kind: "price", id: "ladder:" + trigger.cid, label: `Move ${parts.length} menu drink${parts.length === 1 ? "" : "s"} +$${(-lad[0].gap).toFixed(2)} so none sits below well & call`, itemIds: parts.flatMap(p => p.itemIds), cids: [], dGp: sum(parts, p => p.dGp), confidence: "assumption", assumes: `elasticity ${e}`, fixesLadder: true, reasons: [`${lad.map(l => l.name).join(", ")} fell below their well & call formula`].concat(parts.map(p => p.reasons[1])), scn: { prices: Object.assign({}, ...parts.map(p => p.scn.prices)) } }); if (u) for (const x of curatedWith(u.cid)) if (x.fc > target) add(trimCand(x, x.parts.find(q => q.cid === u.cid), opts.trimFrac, `${x.name} is over target`)); } else { const x = RT.drinks.get(trigger.iid); if (x) { const l = RT.ladder.find(z => z.id === x.id); if (l && Math.abs(l.gap) >= 0.05) for (const o of RT.ladder.filter(z => z.line === x.line && z.id !== x.id && Math.abs(z.formula - l.formula) < 0.01)) { const y = RT.drinks.get(o.id); if (y) add(priceCand(y, trigger.value, `same ladder position as ${x.name}`)); } if (x.fc > target) add(trimCand(x, x.parts.slice().sort((a, b) => b.cost - a.cost)[0], opts.trimFrac, `${x.name} is over target even at the new price`)); } } }
    else { for (const x of overItems) considerItem(x, `${x.name} is over the ${target}% target`); for (const u of thinUps) considerUp(u, `${u.name} keeps only $${u.margin.toFixed(2)} of its $${u.upcharge.toFixed(2)} up-charge`); for (const x of RT.itemList.filter(z => z.quadrant === "Dog")) add(removeCand(x, `${x.name} is a Dog: unpopular and low contribution`)); for (const sg of suggest(M, RT, target).slice(0, 3)) add(newCand(sg, "guests already build it")); }
    // 4. rank: gross profit, discounted for risk and for breaking the rules
    for (const c of cands) { let score = c.dGp; if (c.overTarget) score *= 0.8; if (c.volumeLoss > 0.15) score *= 0.75; if (c.kind === "swap") score *= 0.7; else if (c.culinary) score *= 0.95; if (c.kind === "remove") score *= 0.8; if (c.fixesLadder) score *= 1.5; c.score = score; }
    cands.sort((a, b) => b.score - a.score);
    // one entry per (kind, target) keeping the best, then the greedy plan
    const seen = new Set(); const ranked = cands.filter(c => { const k = c.kind === "swap" || c.kind === "new" ? c.id : c.kind + "|" + (c.itemIds[0] || c.cids[0] || c.id); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, opts.limit);
    const usedI = new Set(), usedC = new Set(); const plan = [];
    const floor = ranked.length ? Math.max(opts.minGain, 0.05 * ranked[0].dGp) : 0;
    if (opts.pick) { for (const c of ranked) if (opts.pick.has(c.id)) plan.push(c); }
    else for (const c of ranked) { if (c.dGp < floor || plan.length >= 5) continue; const keyOf = i => (c.kind === "pour" || c.kind === "swap" ? "recipe" : c.kind === "remove" ? "*" : "price") + "|" + i; if (c.itemIds.some(i => usedI.has(keyOf(i)) || usedI.has("*|" + i) || (c.kind === "remove" && [...usedI].some(k => k.endsWith("|" + i)))) || c.cids.some(x => usedC.has(x))) continue; if (c.kind === "new" && plan.some(p => p.kind === "new")) continue; plan.push(c); c.itemIds.forEach(i => usedI.add(keyOf(i))); c.cids.forEach(x => usedC.add(x)); }
    const planHasSub = kind === "unavailable" && plan.some(p => p.kind === "swap");
    const combined = mergeScn(scnT && !planHasSub ? [scnT].concat(plan.map(p => p.scn)) : plan.map(p => p.scn), e, opts.retention);
    let verified = null;
    if (opts.verify && plan.length) { const RP = analyze(M, scope, combined); verified = { fc: RP.totals.fc, gp: RP.totals.gp, dGp: RP.totals.gp - RT.totals.gp, dGp0: RP.totals.gp - R0.totals.gp, rev: RP.totals.rev, over: RP.itemList.filter(x => !x.addon && !x.byo && x.fc > target).length, over0: RT.itemList.filter(x => !x.addon && !x.byo && x.fc > target).length, belowLadder: RP.ladder.filter(l => l.gap < -0.05).length, R: RP }; }
    return { trigger, situation, R0, RT, candidates: ranked, plan, planDGp: sum(plan, p => p.dGp), combined, verified, period, opts };
  }
  function mergeScn(list, e, retention) { const out = { costPct: {}, costAbs: {}, prices: {}, upcharges: {}, remove: [], swaps: [], newItems: [], unavailable: [], recipes: {}, elasticity: e, retention }; for (const s of list) { if (!s) continue; Object.assign(out.costPct, s.costPct || {}); Object.assign(out.costAbs, s.costAbs || {}); Object.assign(out.prices, s.prices || {}); Object.assign(out.upcharges, s.upcharges || {}); Object.assign(out.recipes, s.recipes || {}); out.remove.push(...(s.remove || [])); out.swaps.push(...(s.swaps || [])); out.newItems.push(...(s.newItems || [])); out.unavailable.push(...(s.unavailable || [])); } return out; }

  const RECON = { coverage: 0.97, salesTol: 0.02, pass: [0, 4], review: [-1.5, 7] }; // bars run a wider gap than kitchens: over-pours, comps and spills
  function reconcile(M, scope, scn) {
    if (!M.actuals.length || !M.sales.length) return { rows: [], note: !M.actuals.length ? "No actuals file loaded." : "No sales loaded." };
    const rows = [];
    for (const a of M.actuals) {
      if (scope.restaurants && !scope.restaurants.has(a.restaurant_id)) continue;
      const ls = M.sales.filter(L => L.restaurant === a.restaurant_id && L.month === a.period);
      if (!ls.length) { rows.push({ restaurant: a.restaurant_id, name: (M.restaurants.get(a.restaurant_id) || { name: a.restaurant_id }).name, month: a.period, verdict: "No sales", note: "No sales lines for this restaurant and month." }); continue; }
      let rev = 0, cogs = 0, uncosted = 0;
      for (const L of ls) { const it = M.drinks.get(L.iid); if (it.addon) continue; let unitRev = L.net; let food; if (it.byo || (L.mods && L.mods.length)) { const base = it.byo ? { food: 0, parts: [] } : costOf(M, it.recipe, L.restaurant, L.date, scn); const mc = L.mods && L.mods.length ? costOf(M, modsToParts(L.mods), L.restaurant, L.date, scn) : { food: 0, parts: [] }; food = it.byo ? base.food + mc.food : applyMods(M, base, mc).food; if (unitRev == null) unitRev = (M.itemPrice(L.iid, L.restaurant) || 0) + sum(mc.parts, p => upchargeOf(M, p.cid, null) * p.pours); if (it.byo && !(L.mods && L.mods.length)) uncosted += unitRev * L.qty; } else { food = costOf(M, it.recipe, L.restaurant, L.date, scn).food; if (unitRev == null) unitRev = M.itemPrice(L.iid, L.restaurant) || 0; if (!it.recipe.length) uncosted += unitRev * L.qty; } rev += unitRev * L.qty; cogs += food * L.qty; }
      const waste = sum(M.waste.filter(w => w.restaurant_id === a.restaurant_id && w.date.slice(0, 7) === a.period), w => w.qty_pours * M.compCost(w.ingredient_id, w.restaurant_id, w.date));
      const books = a.net_sales != null ? a.net_sales : rev;
      const theo = rev ? cogs / rev * 100 : null, theoW = rev ? (cogs + waste) / rev * 100 : null, actual = books ? a.actual_beverage_cost / books * 100 : null;
      const coverage = rev ? 1 - uncosted / rev : 0; const salesGap = a.net_sales != null && a.net_sales ? (rev - a.net_sales) / a.net_sales : 0;
      const gap = actual != null && theo != null ? actual - theo : null;
      let verdict, note;
      if (coverage < RECON.coverage) { verdict = "Not assessable"; note = `Only ${(coverage * 100).toFixed(1)}% of sales are costed (need ${RECON.coverage * 100}%): well & call lines without modifiers or drinks without a spec.`; }
      else if (Math.abs(salesGap) > RECON.salesTol) { verdict = "Review"; note = `Sales in the file are ${(salesGap * 100).toFixed(1)}% ${salesGap > 0 ? "above" : "below"} the books; fix the sales extract before judging pour cost.`; }
      else if (gap == null) { verdict = "Not assessable"; note = "Missing sales or cost."; }
      else if (gap >= RECON.pass[0] && gap <= RECON.pass[1]) { verdict = "Pass"; note = `Books are ${gap.toFixed(1)} pts above theoretical, inside the ${RECON.pass[0]}–${RECON.pass[1]} pt band expected from over-pours, spills and comps.`; }
      else if (gap >= RECON.review[0] && gap <= RECON.review[1]) { verdict = "Review"; note = gap < 0 ? `Theoretical is ${(-gap).toFixed(1)} pts above the books: specs or costs look overstated, or purchases were timed across months.` : `Gap of ${gap.toFixed(1)} pts is more than normal spillage explains; check the waste log, free pouring, comps and missing drinks.`; }
      else { verdict = "Fail"; note = gap < 0 ? `Theoretical is ${(-gap).toFixed(1)} pts above the books: specs, pours or costs are wrong.` : `Gap of ${gap.toFixed(1)} pts: costs or specs are missing something, or there is a real over-pouring or shrink problem.`; }
      rows.push({ restaurant: a.restaurant_id, name: (M.restaurants.get(a.restaurant_id) || { name: a.restaurant_id }).name, month: a.period, rev, books, cogs, waste, actualCost: a.actual_beverage_cost, theo, theoW, actual, gap, gapW: actual != null && theoW != null ? actual - theoW : null, coverage, salesGap, verdict, note });
    }
    rows.sort((a, b) => (a.restaurant + a.month) < (b.restaurant + b.month) ? -1 : 1);
    const judged = rows.filter(r => r.gap != null);
    return { rows, judged: judged.length, pass: rows.filter(r => r.verdict === "Pass").length, overall: !judged.length ? "Not assessable" : rows.every(r => r.verdict === "Pass" || r.verdict === "No sales") ? "Pass" : rows.some(r => r.verdict === "Fail") ? "Fail" : "Review" };
  }
  function history(M, scn) {
    const dates = M.costDates; if (dates.length < 1) return { snapshots: [], note: "All costs share one effective date, so there is no history yet. Add rows with a later effective_date to track changes." };
    const menu = [...M.drinks.values()].filter(i => i.active && !i.byo && i.recipe.length);
    const all = ["0000-00-00"].concat(dates); const snaps = [];
    for (let k = 1; k < all.length; k++) {
      const prev = all[k - 1] === "0000-00-00" ? dates[0] < all[k] ? "0000-00-01" : all[k - 1] : all[k - 1]; const d = all[k];
      const comps = [...M.comps.values()].map(c => ({ cid: c.id, name: c.name, before: compCostRaw(M, c.id, "", prev), after: compCostRaw(M, c.id, "", d) })).filter(x => Math.abs(x.after - x.before) > 1e-9);
      if (!comps.length) continue;
      const drinks = menu.map(it => { const b = costOf(M, it.recipe, "", prev, scn).food, a = costOf(M, it.recipe, "", d, scn).food; const parts = it.recipe.map(p => ({ name: M.comps.get(p.cid).name, d: (compCostRaw(M, p.cid, "", d) - compCostRaw(M, p.cid, "", prev)) * p.pours })).filter(p => Math.abs(p.d) > 1e-9).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)); const price = it.price || 0; return { id: it.id, name: it.name, line: it.line, before: b, after: a, delta: a - b, fcBefore: price ? b / price * 100 : null, fcAfter: price ? a / price * 100 : null, driver: parts[0] ? parts[0].name : null, drivers: parts }; }).filter(x => Math.abs(x.delta) > 1e-9).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
      snaps.push({ date: d, ingredients: comps.map(c => Object.assign(c, { pct: c.before ? (c.after - c.before) / c.before * 100 : null })).sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)), drinks });
    }
    return { snapshots: snaps, dates };
  }
  function ladder(M, R, scn) {
    const rows = [];
    const defaultByo = [...M.byoByLine.values()][0]; // a bar's well & call drink usually sits in its own section; every menu drink is compared with it
    for (const it of M.drinks.values()) {
      if (!it.active || it.byo || it.addon || !it.recipe.length) continue;
      if (ZERO_LINE.test(it.line) || !it.recipe.some(p => { const c = M.comps.get(p.cid); return c && c.fam === "spirit" && (c.abv == null || c.abv > 0); })) continue; // only drinks a guest could call at the well
      const byoId = M.byoByLine.get(it.line) || defaultByo; if (!byoId) continue;
      const base = scn && scn.prices[byoId] != null ? scn.prices[byoId] : M.itemPrice(byoId, R.refStore); if (base == null) continue;
      const ups = it.recipe.map(p => ({ name: M.comps.get(p.cid).name, up: upchargeOf(M, p.cid, scn) })).filter(u => u.up > 0);
      const formula = base + sum(ups, u => u.up); const price = scn && scn.prices[it.id] != null ? scn.prices[it.id] : M.itemPrice(it.id, R.refStore);
      const gap = price - formula;
      rows.push({ id: it.id, name: it.name, line: it.line, price, base, ups, formula, gap, flag: Math.abs(gap) < 0.05 ? "On the ladder" : gap < 0 ? "Below well & call" : "Premium over well & call" });
    }
    // overlaps: same formula, different price
    const byF = by(rows, r => r.line + "|" + r.formula.toFixed(2));
    for (const [, g] of byF) if (g.length > 1 && new Set(g.map(r => r.price)).size > 1) g.forEach(r => { r.overlap = g.filter(x => x !== r).map(x => x.name); });
    return rows.sort((a, b) => a.line.localeCompare(b.line) || b.gap - a.gap);
  }

  /* ---------- 11. Self-test cases (hand-calculated; also run by tests/costmodel.test.js) ---------- */
  const SELFTEST = [
    { name: "Bottle to pour", run: () => pourCost({ bottle_cost: 18, bottle_size: 750, bottle_unit: "ml", pour_size: 1.5, pour_unit: "fl oz" }).cost, expect: 18 / (750 / 29.5735295625) * 1.5, note: "750 ml at $18, 1.5 fl oz pour → $18 ÷ 25.36 fl oz × 1.5 = $1.0646" },
    { name: "Yield applies before the pour", run: () => pourCost({ bottle_cost: 9, bottle_size: 1, bottle_unit: "qt", pour_size: 1, pour_unit: "fl oz", yield_pct: 90 }).cost, expect: 9 / (32 * 0.9), note: "1 qt of lime juice at $9, 90% usable, 1 fl oz pour → $0.3125" },
    { name: "Count units", run: () => pourCost({ bottle_cost: 36, bottle_size: 120, bottle_unit: "each", pour_size: 1, pour_unit: "each", yield_pct: 100 }).cost, expect: 0.3, note: "120 limes at $36 → $0.30 each" },
    { name: "Pour cost override wins", run: () => pourCost({ pour_cost: 1.25, bottle_cost: 100, bottle_size: 1, bottle_unit: "l", pour_size: 1, pour_unit: "fl oz" }).cost, expect: 1.25 },
    { name: "Unit mismatch is an error", run: () => pourCost({ bottle_cost: 10, bottle_size: 1, bottle_unit: "lb", pour_size: 1, pour_unit: "fl oz" }).cost, expect: null },
    { name: "Recipe quantity in oz converts to pours", run: () => toPours({ name: "t", pourSize: 1, pourUnit: "fl oz" }, 2, "oz") === 2 ? 2 : toPours({ name: "t", pourSize: 1, pourUnit: "fl oz" }, 60, "ml"), expect: 60 / 29.5735295625, note: "a 1 fl oz pour: 60 ml is 2.03 pours (oz is read as weight, so a volume pour needs fl oz or ml)" },
    { name: "Drink cost sums pours", run: () => { const M = build(tiny()); return costOf(M, M.drinks.get("marg").recipe, "", "2026-07-15").food; }, expect: 0.85 * 2 + 0.30 * 1 + 0.20 * 0.5, note: "2 oz tequila ($0.85 a pour) + 1 oz lime ($0.30) + 0.5 oz agave ($0.20 a pour) = $2.10" },
    { name: "Later cost version applies after its date", run: () => { const M = build(tiny()); return M.compCost("tequila", "", "2026-09-10"); }, expect: 1.02 },
    { name: "Earlier date keeps the old cost", run: () => { const M = build(tiny()); return M.compCost("tequila", "", "2026-08-31"); }, expect: 0.85 },
    { name: "Restaurant-specific cost overrides", run: () => { const M = build(tiny()); return M.compCost("lime", "S2", "2026-07-15"); }, expect: 0.36 },
    { name: "Mix-weighted pour cost", run: () => { const M = build(tiny()); const R = analyze(M, {}); return r2(R.totals.fc); }, expect: r2((2 * 2.10 + 1 * (2.10 + 0.45)) / (2 * 12 + 1 * (12 + 4)) * 100), note: "two margaritas at $12 costing $2.10, one well & call at $12 + $4 Casamigos call costing $2.10 + $0.45 soda → 6.75 / 40 = 16.9%" },
    { name: "Call up-charge margin vs the well", run: () => { const M = build(tiny()); const R = analyze(M, {}); const s = R.upcharges.find(u => u.cid === "casamigos"); return r2(s.margin); }, expect: r2(4 - (2.10 - 0.85)), note: "Casamigos $2.10 a pour replaces the $0.85 well tequila: incremental $1.25 against a $4.00 call up-charge → $2.75" },
    { name: "Cost scenario: tequila +20%", run: () => { const M = build(tiny()); const R = analyze(M, {}, { costPct: { tequila: 20 } }); return r2(R.drinks.get("marg").food); }, expect: r2(0.85 * 2 * 1.2 + 0.30 + 0.10) },
    { name: "Repricing with elasticity", run: () => { const M = build(tiny()); const R = analyze(M, {}, { prices: { marg: 13.2 }, elasticity: -1 }); return r2(R.drinks.get("marg").units); }, expect: r2(2 * (1 - 0.1)), note: "+10% price at elasticity −1 → units × 0.9" },
    { name: "Remove a drink: 80% of its units move to the section", run: () => { const M = build(tiny()); const R = analyze(M, {}, { remove: ["marg"], retention: 0.8 }); return r2(R.drinks.get("well-call").units); }, expect: r2(1 + 0.8 * 2) },
    { name: "Extras by service", run: () => { const M = build(tiny()); return [M.pkg("Cocktails", "bar"), M.pkg("Cocktails", "takeout")]; }, expect: [0.3, 0.55] },
    { name: "Reconciliation verdict bands", run: () => { const M = build(tiny()); const R = analyze(M, {}); return R.reconcile.rows.map(r => r.verdict); }, expect: ["Pass"], note: "theoretical 16.9% vs books 18.75% → gap 1.9 pts" },
    { name: "Price ladder gap", run: () => { const M = build(tiny()); const R = analyze(M, {}); return r2(R.ladder[0].gap); }, expect: 0, note: "a $12 margarita with no called brand sits on the $12 well & call base" },
    { name: "Cost as of a later date re-costs old sales", run: () => { const M = build(tiny()); const R = analyze(M, { costAsOf: "2026-09-10" }); return r2(R.drinks.get("marg").food); }, expect: r2(1.02 * 2 + 0.30 + 0.10), note: "a July margarita costed at the September tequila price" },
    { name: "Pour change: 1.5 oz of tequila", run: () => { const M = build(tiny()); const R = analyze(M, {}, { recipes: { marg: [{ cid: "tequila", pours: 1.5 }, { cid: "lime", pours: 1 }, { cid: "agave", pours: 0.5 }] } }); return r2(R.drinks.get("marg").food); }, expect: r2(1.275 + 0.30 + 0.10) },
    { name: "Strength check in standard drinks", run: () => { const M = build(tiny()); const R = analyze(M, {}); return r2(R.strength.find(x => x.id === "marg").stdDrinks); }, expect: r2(2 * 0.4 / 0.6), note: "2 fl oz at 40% ABV = 0.8 fl oz of alcohol = 1.33 standard drinks" },
    { name: "Decomposition sums to the total change", run: () => { const M = build(tiny()); const d = decompose(M, null, "2026-07", "2026-07", 22); return d.ok ? r2(d.costEffect + d.mixEffect - d.total) : null; }, expect: 0 },
    { name: "Recommendation: a cost shock on Casamigos proposes raising its call up-charge", run: () => { const M = build(tiny()); const r = recommend(M, {}, { type: "cost", cid: "casamigos", pct: 20 }, { verify: false, minGain: 0 }); return r.candidates.some(c => c.kind === "upcharge" && c.cids[0] === "casamigos") && r2(r.situation.after); }, expect: r2(2.10 * 1.2) },
    { name: "Recommendation: closed-form repricing matches the engine", run: () => { const M = build(tiny()); const R = analyze(M, {}); const x = R.drinks.get("marg"); const c = recommend(M, {}, { type: "price", iid: "marg", value: 13.2 }, { verify: false }); const R2 = analyze(M, {}, { prices: { marg: 13.2 }, elasticity: -0.8 }); const k = x.pkg / x.units; const closed = x.units * (1 - 0.8 * 0.1) * (13.2 - x.unitCost - k) - x.units * (x.avgPrice - x.unitCost - k); return r2(R2.totals.gp - R.totals.gp - closed); }, expect: 0, note: "the advisor's quick estimate and the full engine agree" },
  ];
  function tiny() {
    const mk = (type, rows) => applyMap(type, rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))), Object.fromEntries(TEMPLATES[type].cols.map(c => [c.k, c.k]))).rows;
    return {
      restaurants: mk("restaurants", [{ restaurant_id: "S1", restaurant_name: "One" }, { restaurant_id: "S2", restaurant_name: "Two" }]),
      ingredients: mk("ingredients", [
        { ingredient_id: "tequila", ingredient_name: "Blanco tequila (well)", category: "Agave", pour_cost: 0.85, pour_size: 1, pour_unit: "fl oz", abv_pct: 40 },
        { ingredient_id: "tequila", ingredient_name: "Blanco tequila (well)", category: "Agave", pour_cost: 1.02, pour_size: 1, pour_unit: "fl oz", effective_date: "2026-09-01" },
        { ingredient_id: "casamigos", ingredient_name: "Casamigos Blanco", category: "Agave", pour_cost: 2.10, pour_size: 1, pour_unit: "fl oz", upcharge: 4, abv_pct: 40 },
        { ingredient_id: "lime", ingredient_name: "Lime juice", category: "Citrus", pour_cost: 0.30, pour_size: 1, pour_unit: "fl oz" },
        { ingredient_id: "lime", ingredient_name: "Lime juice", category: "Citrus", pour_cost: 0.36, pour_size: 1, pour_unit: "fl oz", restaurant_id: "S2" },
        { ingredient_id: "agave", ingredient_name: "Agave syrup", category: "Sweeteners", pour_cost: 0.20, pour_size: 1, pour_unit: "fl oz" },
        { ingredient_id: "soda", ingredient_name: "Soda water", category: "Mixers", pour_cost: 0.15, pour_size: 1, pour_unit: "fl oz" },
      ]),
      drinks: mk("drinks", [{ drink_id: "marg", drink_name: "Margarita", section: "Cocktails", price: 12 }, { drink_id: "well-call", drink_name: "Well & call", section: "Cocktails", price: 12, custom: 1 }]),
      recipes: mk("recipes", [{ drink_id: "marg", ingredient_id: "tequila", qty: 2, unit: "fl oz" }, { drink_id: "marg", ingredient_id: "lime", qty: 1 }, { drink_id: "marg", ingredient_id: "agave", qty: 0.5, unit: "fl oz" }]),
      sales: mk("sales", [{ order_id: "o1", restaurant_id: "S1", date: "2026-07-01", drink_id: "marg", qty: 2, channel: "bar" }, { order_id: "o2", restaurant_id: "S1", date: "2026-07-02", drink_id: "well-call", qty: 1, channel: "takeout" }]),
      modifiers: mk("modifiers", [{ order_id: "o2", drink_id: "well-call", ingredient_id: "casamigos", qty: 1 }, { order_id: "o2", drink_id: "well-call", ingredient_id: "soda", qty: 3 }]),
      extras: mk("extras", [{ section: "Cocktails", channel: "in_house", cost: 0.30 }, { section: "Cocktails", channel: "to_go", cost: 0.55 }]),
      actuals: mk("actuals", [{ restaurant_id: "S1", period: "2026-07", actual_beverage_cost: 7.5, net_sales: 40 }]),
    };
  }
  function selfTest() { return SELFTEST.map(t => { let got, ok = false, err = null; try { got = t.run(); const close = (a, b) => a == null || b == null ? a === b : Math.abs(a - b) < 1e-6; ok = Array.isArray(t.expect) ? Array.isArray(got) && t.expect.length === got.length && t.expect.every((e, i) => typeof e === "number" ? close(got[i], e) : got[i] === e) : close(got, t.expect); } catch (e) { err = e; } return { name: t.name, ok, got, expect: t.expect, note: t.note, err }; }); }

  return { __tiny: tiny, TEMPLATES, TYPES, CORE, CHANNELS, DAYPARTS, FAMS, FAM_LABEL, RECON, SELFTEST, parseCSV, toCSV, templateCSV, detectType, autoMap, applyMap, validate, pourCost, toPours, fmtQty, build, costOf, analyze, decompose, suggest, recommend, addComponent, mergeScn, normScenario, selfTest, priceFor, slug, norm, toISODate, toMonth, toTime, unitOf, CAT_FAM, FOOD_LINE, sum, by };
});
