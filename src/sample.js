/* Synthetic demo dataset for the Cost & sales tool. Everything here is made up.
   Bottle costs sit inside published bar ranges, menu prices and drink specs come from the public menus of three
   José Andrés Group restaurants (read Oct 13–14, 2026), and sales are drawn from a seeded random generator, so the
   same seed always gives the same files. The parameters are documented in docs/sample-data.md.
   None of it is the restaurants' real cost, sales or margin data. Runs in the browser (window.SampleData) and under Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SampleData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const slug = s => String(s).toLowerCase().replace(/®|™/g, "").replace(/\+/g, " ").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  function rng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const pad2 = n => (n < 10 ? "0" : "") + n;
  const iso = d => d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  const pick = (r, weights) => { const tot = weights.reduce((a, w) => a + w[1], 0); let x = r() * tot; for (const w of weights) { x -= w[1]; if (x <= 0) return w[0]; } return weights[weights.length - 1][0]; };
  const poisson = (r, mean) => { if (mean > 30) { let s = 0; for (let i = 0; i < 12; i++) s += r(); return Math.max(0, Math.round(mean + Math.sqrt(mean) * (s - 6))); } const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
  const round2 = v => Math.round(v * 100) / 100;

  // --- parameters (see docs/sample-data.md)
  const RESTAURANTS = [
    { restaurant_id: "OYA", restaurant_name: "Oyamel", group: "José Andrés Group", city: "Washington", state: "DC", orders: 150, dow: [0.9, 0.6, 0.7, 0.8, 1.0, 1.35, 1.45], channel: [["dine_in", 62], ["bar", 30], ["takeout", 3], ["event", 5]], priceAdj: 0 },
    { restaurant_id: "JAL", restaurant_name: "Jaleo", group: "José Andrés Group", city: "Washington", state: "DC", orders: 170, dow: [0.95, 0.65, 0.75, 0.85, 1.0, 1.35, 1.4], channel: [["dine_in", 66], ["bar", 26], ["takeout", 2], ["event", 6]], priceAdj: 0 },
    { restaurant_id: "ZAY", restaurant_name: "Zaytinya", group: "José Andrés Group", city: "Washington", state: "DC", orders: 140, dow: [0.9, 0.6, 0.7, 0.8, 1.0, 1.3, 1.4], channel: [["dine_in", 64], ["bar", 28], ["takeout", 3], ["event", 5]], priceAdj: -1 },
  ];
  // cost by family: [bottle cost, bottle size, bottle unit, pour size, pour unit, yield %, perishable, shelf life days, prep steps, abv]; the name hash spreads costs ±25% within a family
  const FAM_COST = {
    spirit: [29, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], liqueur: [31, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 28], wine: [18, 750, "ml", 1, "fl oz", 92, 1, 7, 1, 15],
    citrus: [9, 1, "qt", 1, "fl oz", 92, 1, 2, 2, 0], fruit: [14, 1, "qt", 1, "fl oz", 90, 1, 3, 3, 0], herb: [3.5, 20, "each", 1, "each", 85, 1, 4, 1, 0],
    sweet: [7, 1, "qt", 1, "fl oz", 100, 0, 30, 2, 0], mixer: [1.6, 24, "fl oz", 1, "fl oz", 100, 0, 180, 0, 0], other: [6, 32, "fl oz", 1, "fl oz", 100, 1, 7, 1, 0],
  };
  // ingredients priced by name, not by family: [bottle cost, bottle size, bottle unit, pour size, pour unit, yield, perishable, shelf, steps, abv]
  const COST = {
    "Mezcal": [38, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 45], "Reposado tequila": [30, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], "Sotol": [36, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 45],
    "Gin": [22, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 43], "Vodka": [19, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], "Rum": [20, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], "Cachaça": [24, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40],
    "Rye whiskey": [28, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 45], "Bourbon": [26, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 45], "Whiskey": [30, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 43],
    "Brandy": [34, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], "Pisco": [31, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 41], "Tsipouro": [33, 700, "ml", 1, "fl oz", 98, 0, 365, 1, 40],
    "Ouzo": [26, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], "Absinthe": [58, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 60], "Sake": [18, 720, "ml", 1, "fl oz", 95, 1, 14, 1, 15], "Shochu": [27, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 25],
    "NA spirit": [32, 700, "ml", 1, "fl oz", 98, 0, 180, 1, 0], "NA sangría": [11, 1, "qt", 1, "fl oz", 95, 1, 5, 3, 0],
    "Orange liqueur": [20, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], "Aperol": [25, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 11], "Campari": [29, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 24], "Green Chartreuse": [72, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 55], "Yellow Chartreuse": [64, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40], "Cynar": [26, 1000, "ml", 1, "fl oz", 98, 0, 365, 1, 16.5], "Mastiha": [34, 700, "ml", 1, "fl oz", 98, 0, 365, 1, 30], "Amaro": [32, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 30], "Elderflower liqueur": [36, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 20], "Licor 43": [27, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 31], "Velvet Falernum": [20, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 11], "Bénédictine": [36, 750, "ml", 1, "fl oz", 98, 0, 365, 1, 40],
    "Vermouth": [16, 1000, "ml", 1, "fl oz", 95, 1, 30, 1, 16], "Sherry": [19, 750, "ml", 1, "fl oz", 95, 1, 21, 1, 17], "Mavrodaphne": [18, 750, "ml", 1, "fl oz", 95, 1, 21, 1, 15],
    "Red wine": [12, 750, "ml", 1, "fl oz", 92, 1, 5, 1, 13.5], "Rosé": [12, 750, "ml", 1, "fl oz", 92, 1, 5, 1, 12], "Sparkling wine": [15, 750, "ml", 1, "fl oz", 90, 1, 2, 1, 11.5], "Beer": [2.2, 12, "fl oz", 1, "fl oz", 100, 0, 120, 0, 5],
    "Lime": [9, 1, "qt", 1, "fl oz", 92, 1, 2, 2, 0], "Lemon": [8, 1, "qt", 1, "fl oz", 92, 1, 2, 2, 0], "Orange": [7, 1, "qt", 1, "fl oz", 95, 1, 3, 2, 0], "Grapefruit": [8, 1, "qt", 1, "fl oz", 95, 1, 3, 2, 0], "Blood orange": [11, 1, "qt", 1, "fl oz", 95, 1, 3, 2, 0], "Citrus (mixed)": [8, 1, "qt", 1, "fl oz", 92, 1, 2, 2, 0],
    "Passion fruit": [19, 1, "qt", 1, "fl oz", 100, 1, 7, 1, 0], "Pomegranate": [12, 1, "qt", 1, "fl oz", 100, 1, 10, 1, 0], "Pineapple": [8, 1, "qt", 1, "fl oz", 90, 1, 3, 3, 0], "Cucumber": [6, 1, "qt", 1, "fl oz", 85, 1, 2, 3, 0], "Tomato / tomatillo": [9, 1, "qt", 1, "fl oz", 90, 1, 2, 3, 0], "Watermelon": [7, 1, "qt", 1, "fl oz", 85, 1, 2, 3, 0],
    "Mint": [4, 24, "each", 1, "each", 80, 1, 3, 1, 0], "Thyme": [3, 30, "each", 1, "each", 85, 1, 5, 1, 0], "Rosemary": [3, 30, "each", 1, "each", 85, 1, 7, 1, 0], "Chile": [5, 40, "each", 1, "each", 90, 1, 7, 1, 0],
    "Honey": [8, 1, "qt", 1, "fl oz", 100, 0, 60, 2, 0], "Sugar": [4, 1, "qt", 1, "fl oz", 100, 0, 30, 2, 0], "Maple": [14, 1, "qt", 1, "fl oz", 100, 0, 60, 1, 0], "Vanilla": [12, 1, "qt", 1, "fl oz", 100, 0, 60, 2, 0],
    "Angostura bitters": [19, 16, "fl oz", 1, "dash", 100, 0, 365, 0, 44.7], "Orange bitters": [16, 10, "fl oz", 1, "dash", 100, 0, 365, 0, 28], "Other bitters": [22, 10, "fl oz", 1, "dash", 100, 0, 365, 0, 40],
    "Tonic": [1.9, 6.8, "fl oz", 1, "fl oz", 100, 0, 180, 0, 0], "Soda water": [0.6, 10, "fl oz", 1, "fl oz", 100, 0, 180, 0, 0], "Cola": [1.1, 12, "fl oz", 1, "fl oz", 100, 0, 180, 0, 0], "Ginger": [1.7, 6.8, "fl oz", 1, "fl oz", 100, 0, 180, 0, 0],
    "Egg white": [5, 36, "each", 1, "each", 100, 1, 7, 1, 0], "Dairy": [5, 32, "fl oz", 1, "fl oz", 100, 1, 7, 0, 0], "Salt / salt air": [3, 200, "each", 1, "rim", 100, 0, 365, 1, 0], "Olive oil": [18, 32, "fl oz", 1, "fl oz", 100, 0, 180, 0, 0], "Savory sauce": [7, 16, "fl oz", 1, "fl oz", 100, 0, 90, 0, 0],
  };
  // bitters and dashes count by the dash: a 16 fl oz bottle holds about 480 dashes
  const DASH_PER_FLOZ = 30;
  // the amount of each family in a spec, in the ingredient's pour unit (fl oz or each); two of a kind split the spirit
  const SPEC = { spirit: 2, liqueur: 0.75, wine: 1.5, citrus: 0.75, fruit: 1, herb: 1, sweet: 0.5, mixer: 3, other: 1 };
  const SPEC_BY_CAT = { "Vermouth & fortified": 1, "Wine & beer": 2, "Bitters": 2, "Savory": 1, "Dairy & egg": 1, "Mixers": 3 };
  // call brands: a called bottle is its own ingredient with a call up-charge; it replaces the well of the same category in a well & call drink
  const CALLS = [
    ["casamigos-blanco", "Casamigos Blanco", "Agave", 46, 40, 4.00], ["don-julio-reposado", "Don Julio Reposado", "Agave", 52, 40, 5.00], ["del-maguey-vida", "Del Maguey Vida mezcal", "Agave", 42, 42, 4.00],
    ["hendricks", "Hendrick's gin", "Gin", 36, 41.4, 3.00], ["tanqueray-ten", "Tanqueray No. Ten", "Gin", 38, 47.3, 3.50], ["grey-goose", "Grey Goose vodka", "Vodka", 34, 40, 3.00], ["titos", "Tito's vodka", "Vodka", 24, 40, 1.50],
    ["woodford-reserve", "Woodford Reserve bourbon", "Whiskey", 36, 45.2, 3.50], ["rittenhouse-rye", "Rittenhouse rye", "Whiskey", 26, 50, 2.00], ["diplomatico", "Diplomático Reserva rum", "Rum & cane", 38, 40, 4.00], ["macchu-pisco", "Macchu Pisco", "Brandy & pisco", 33, 40, 3.00],
  ];
  const WELL = { Agave: "blanco-tequila", Gin: "gin", Vodka: "vodka", Whiskey: "bourbon", "Rum & cane": "rum", "Brandy & pisco": "pisco" };
  const MIXERS = [["soda-water", 45], ["tonic", 35], ["ginger", 12], ["cola", 8]];
  const WELL_NAMES = { "blanco-tequila": ["Blanco tequila", "Agave", "spirit"], gin: ["Gin", "Gin", "spirit"], vodka: ["Vodka", "Vodka", "spirit"], bourbon: ["Bourbon", "Whiskey", "spirit"], rum: ["Rum", "Rum & cane", "spirit"], pisco: ["Pisco", "Brandy & pisco", "spirit"], lime: ["Lime", "Citrus", "citrus"] };
  const WELL_BASE = 12; // a well & call drink at the bar
  const CALL_SHARE = 0.45; // share of well & call orders that call a brand
  const COST_V2 = { "blanco-tequila": 1.12, "mezcal": 1.12, "casamigos-blanco": 1.1, "don-julio-reposado": 1.1, "del-maguey-vida": 1.1, "lime": 1.15, "lemon": 1.1, "sparkling-wine": 0.95 }; // bottle-cost multipliers from 2026-09-01: agave and citrus up, cava down
  const FOOD = {
    OYA: [["Small plates", ["Guacamole", 16], ["Queso fundido", 15], ["Tacos al pastor", 14], ["Ceviche", 18]], ["Entrées", ["Enchiladas", 26], ["Carne asada", 34], ["Pescado a la talla", 32]], ["Desserts", ["Churros", 11], ["Flan", 10]]],
    JAL: [["Small plates", ["Patatas bravas", 12], ["Gambas al ajillo", 18], ["Jamón ibérico", 28], ["Croquetas", 14]], ["Entrées", ["Paella de verduras", 32], ["Paella Valenciana", 38], ["Solomillo", 42]], ["Desserts", ["Flan al estilo tradicional", 11], ["Churros con chocolate", 12]]],
    ZAY: [["Small plates", ["Hummus", 12], ["Falafel", 13], ["Spanakopita", 14], ["Crispy Brussels sprouts", 13]], ["Entrées", ["Lamb chops", 36], ["Branzino", 34], ["Chicken kebab", 24]], ["Desserts", ["Baklava", 11], ["Turkish coffee chocolate cake", 12]]],
  };
  const EXTRAS = [["Cocktails", "in_house", 0.38], ["Cocktails", "to_go", 0.72], ["Zero-proof", "in_house", 0.32], ["Zero-proof", "to_go", 0.6], ["Well & call", "in_house", 0.22], ["Well & call", "to_go", 0.55], ["all", "all", 0.12]];
  const WASTE_RATE = { citrus: 0.08, fruit: 0.06, herb: 0.12, wine: 0.05, other: 0.05, sweet: 0.02, spirit: 0.012, liqueur: 0.01 };
  const LOW_MOVER_FLOOR = { "tsipouro": 0.4, "yellow-chartreuse": 0.3, "mavrodaphne": 0.5, "velvet-falernum": 0.3 }; // pours a day lost to evaporation and dead stock regardless of sales
  const ACTUAL_GAP = { OYA: 0.09, JAL: 0.08, ZAY: 0.1 }; // books above theoretical (over-pours, spills, comps)
  const ACTUAL_GAP_OVERRIDE = { "ZAY|2026-09": 0.42 }; // one restaurant-month that fails on purpose
  const INV_VARIANCE = { "blanco-tequila": 0.09, "vodka": 0.12, "gin": 0.07, "mezcal": 0.05, "rum": 0.08, "bourbon": 0.06, "casamigos-blanco": 0.03, "orange-liqueur": 0.04, "aperol": 0.02, "vermouth": 0.11, "sparkling-wine": 0.14, "lime": 0.18 };
  const ZERO_SHARE = 0.12, CUSTOM_SHARE = 0.3;

  function makeSample(opts) {
    opts = opts || {};
    const group = opts.group || "José Andrés Group";
    const rests = new Set(RESTAURANTS.map(s => s.restaurant_name));
    const drinks = (opts.drinks || []).filter(d => d.group === group && rests.has(d.restaurant) && d.price != null);
    const catFam = opts.catFam || (c => "other");
    const seed = opts.seed || 20261016, days = opts.days || 92, start = opts.start || "2026-07-01", scale = opts.scale || 1;
    const r = rng(seed);
    const F = { restaurants: [], ingredients: [], drinks: [], recipes: [], sales: [], modifiers: [], extras: [], waste: [], actuals: [], inventory: [] };
    RESTAURANTS.forEach(s => F.restaurants.push({ restaurant_id: s.restaurant_id, restaurant_name: s.restaurant_name, group: s.group, city: s.city, state: s.state }));
    // ingredients: every canonical ingredient the three menus use, costed by name or by family
    const comp = new Map(); const compFam = new Map();
    const addComp = (id, name, category, fam, upcharge) => {
      if (comp.has(id)) return comp.get(id);
      const base = COST[name] || FAM_COST[fam] || FAM_COST.other; const jit = COST[name] ? 1 : 0.75 + 0.5 * hash(name);
      const [cost, size, unit, pour, punit, y, per, shelf, steps, abv] = base;
      const row = { ingredient_id: id, ingredient_name: name, category, bottle_cost: round2(cost * jit), bottle_size: punit === "dash" ? size * DASH_PER_FLOZ : size, bottle_unit: punit === "dash" ? "dash" : unit, pour_size: pour, pour_unit: punit, yield_pct: y, pour_cost: null, upcharge: upcharge || 0, effective_date: null, restaurant_id: null, perishable: per, shelf_life_days: shelf, prep_steps: steps, par_pours: null, abv_pct: abv };
      comp.set(id, row); compFam.set(id, fam); F.ingredients.push(row); return row;
    };
    const canonId = new Map();
    for (const d of drinks) for (const i of d.ings) { if (canonId.has(i.name)) continue; const id = slug(i.name); canonId.set(i.name, id); addComp(id, i.name, i.cat, catFam(i.cat)); }
    for (const [id, name, cat, cost, abv, up] of CALLS) { const row = addComp(id, name, cat, "spirit", up); row.bottle_cost = cost; row.abv_pct = abv; }
    for (const m of MIXERS) if (!comp.has(m[0])) addComp(m[0], m[0] === "soda-water" ? "Soda water" : m[0][0].toUpperCase() + m[0].slice(1), "Mixers", "mixer");
    for (const [id, [name, cat, fam]] of Object.entries(WELL_NAMES)) if (!comp.has(id)) addComp(id, name, cat, fam); // the well and the lime exist even if no menu drink uses them
    // well & call drinks and the menu drinks with their specs, per restaurant
    const itemRows = []; const addItem = (id, name, section, price, custom, restaurant) => { const row = { drink_id: id, drink_name: name, section, price, custom: custom ? 1 : 0, active: 1, restaurant_id: null }; row._rest = restaurant; F.drinks.push(row); itemRows.push(row); return row; };
    const rec = (iid, cid, qty, unit) => F.recipes.push({ drink_id: iid, ingredient_id: cid, qty, unit: unit || "" });
    addItem("WELL-CALL", "Well & call drink", "Well & call", WELL_BASE, true, null);
    const byRest = new Map();
    for (const d of drinks) {
      const id = slug(d.restaurant + " " + d.drink); if (itemRows.some(x => x.drink_id === id)) continue;
      const section = d.zero ? "Zero-proof" : "Cocktails";
      addItem(id, d.drink, section, d.price, false, d.restaurant);
      let a = byRest.get(d.restaurant); if (!a) { a = []; byRest.set(d.restaurant, a); } a.push(id);
      const ids = d.ings.map(i => canonId.get(i.name)).filter(Boolean);
      const n = {}; ids.forEach(c => { const f = compFam.get(c); n[f] = (n[f] || 0) + 1; });
      ids.forEach(c => { const f = compFam.get(c); const row = comp.get(c); const cat = row.category; let q = SPEC_BY_CAT[cat] != null ? SPEC_BY_CAT[cat] : SPEC[f]; if ((f === "spirit" || f === "liqueur") && n[f] > 1) q = f === "spirit" ? 1 : 0.5; const unit = row.pour_unit === "fl oz" ? "fl oz" : row.pour_unit; rec(id, c, q, unit); });
    }
    // food on the same checks: no recipe, used for pairing
    const foodByRest = new Map();
    for (const S of RESTAURANTS) { const list = []; for (const [section, ...items] of FOOD[S.restaurant_id]) for (const [name, price] of items) { const id = slug(S.restaurant_id + " " + name); addItem(id, name, section, price, false, S.restaurant_name); list.push({ id, section, price }); } foodByRest.set(S.restaurant_id, list); }
    // restaurant price overrides (Zaytinya cocktails $1 cheaper) and a second cost version
    for (const row of itemRows) if (row.section === "Cocktails" && row._rest === "Zaytinya") F.drinks.push({ drink_id: row.drink_id, drink_name: null, section: null, price: round2(row.price - 1), custom: null, active: null, restaurant_id: "ZAY" });
    for (const [cid, mult] of Object.entries(COST_V2)) { const c = comp.get(cid); if (c) F.ingredients.push(Object.assign({}, c, { bottle_cost: round2(c.bottle_cost * mult), effective_date: "2026-09-01" })); }
    EXTRAS.forEach(([section, channel, cost]) => F.extras.push({ section, channel, cost }));
    const conv = { ml: 1, l: 1000, "fl oz": 29.5735295625, qt: 946.352946, gal: 3785.411784, each: 1, dash: 1, rim: 1 };
    const compCostAt = (cid, date) => { const c = comp.get(cid); const cc = date >= "2026-09-01" && COST_V2[cid] != null ? c.bottle_cost * COST_V2[cid] : c.bottle_cost; const usable = c.bottle_size * conv[c.bottle_unit] / conv[c.pour_unit] * c.yield_pct / 100; return cc / usable * c.pour_size; };
    const recipeOf = new Map(); F.recipes.forEach(x => { let a = recipeOf.get(x.drink_id); if (!a) { a = []; recipeOf.set(x.drink_id, a); } const c = comp.get(x.ingredient_id); const pours = x.unit && x.unit !== c.pour_unit ? x.qty * conv[x.unit] / conv[c.pour_unit] / c.pour_size : x.qty / (x.unit ? c.pour_size : 1); a.push([x.ingredient_id, pours]); });
    const price = (iid, S) => { const row = itemRows.find(x => x.drink_id === iid); return row.section === "Cocktails" ? round2(row.price + S.priceAdj) : row.price; };
    const upch = cid => comp.get(cid).upcharge || 0;
    // popularity of each menu drink: cheaper and classic-sounding drinks sell more; a few are deliberately slow
    const pop = new Map(); for (const row of itemRows) { if (row.custom || !row._rest || FOOD[row.drink_id]) continue; if (row.section !== "Cocktails" && row.section !== "Zero-proof") continue; const h = hash(row.drink_id); pop.set(row.drink_id, Math.max(0.4, 4 * Math.exp(-0.12 * (row.price - 14)) * (0.5 + h * 1.4))); }
    const callOf = cat => pick(r, CALLS.filter(c => c[2] === cat).map(c => [c[0], 1]));
    const buildWell = () => { const cat = pick(r, [["Agave", 30], ["Vodka", 24], ["Gin", 18], ["Whiskey", 14], ["Rum & cane", 10], ["Brandy & pisco", 4]]); const spirit = r() < CALL_SHARE ? callOf(cat) : WELL[cat]; const mixer = pick(r, MIXERS); const b = [[spirit, 2], [mixer, 3]]; if (r() < 0.35) b.push(["lime", 0.5]); if (r() < 0.04) b[0][1] = 3; return b; };
    // sales
    const usageSW = new Map(), usageSM = new Map(), cogsSM = new Map(), revSM = new Map();
    const startD = new Date(start + "T00:00:00Z"); const weekOf = d => { const dt = new Date(d + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay()); return iso(dt); };
    const addUse = (st, date, cid, q) => { const k = st + "|" + weekOf(date) + "|" + cid; usageSW.set(k, (usageSW.get(k) || 0) + q); const m = st + "|" + date.slice(0, 7) + "|" + cid; usageSM.set(m, (usageSM.get(m) || 0) + q); };
    const monthFactor = m => ({ "2026-07": 1.0, "2026-08": 0.93, "2026-09": 1.05 })[m] || 1;
    for (let di = 0; di < days; di++) {
      const dt = new Date(startD.getTime() + di * 86400000); const date = iso(dt); const dow = dt.getUTCDay(); const month = date.slice(0, 7);
      for (const S of RESTAURANTS) {
        const menu = byRest.get(S.restaurant_name) || []; const cocktails = menu.filter(id => itemRows.find(x => x.drink_id === id).section === "Cocktails"), zeros = menu.filter(id => itemRows.find(x => x.drink_id === id).section === "Zero-proof");
        const nOrders = poisson(r, S.orders * scale * S.dow[dow] * monthFactor(month) * (0.9 + 0.2 * r()));
        for (let k = 1; k <= nOrders; k++) {
          const oid = `${S.restaurant_id}-${date.replace(/-/g, "")}-${String(k).padStart(4, "0")}`;
          const ch = pick(r, S.channel);
          const slot = pick(r, ch === "bar" ? [["happy_hour", 38], ["dinner", 40], ["late", 18], ["lunch", 4]] : [["dinner", 62], ["happy_hour", 18], ["late", 10], ["lunch", 10]]);
          const hh = slot === "lunch" ? 11 + Math.floor(r() * 4) : slot === "happy_hour" ? 15 + Math.floor(r() * 3) : slot === "dinner" ? 18 + Math.floor(r() * 3) : 21 + Math.floor(r() * 3); const time = pad2(hh % 24) + ":" + pad2(Math.floor(r() * 60));
          const nDrinks = pick(r, ch === "event" ? [[2, 30], [3, 35], [4, 25], [6, 10]] : ch === "bar" ? [[1, 45], [2, 35], [3, 15], [4, 5]] : [[1, 50], [2, 32], [3, 13], [4, 5]]);
          let lineNo = 0; const disc = ch === "dine_in" && slot === "happy_hour" && r() < 0.35 ? 0.85 : 1; const comp_ = r() < 0.02;
          const lines = []; let premium = false;
          const addCost = (cogs, p) => { const mk = S.restaurant_id + "|" + month; cogsSM.set(mk, (cogsSM.get(mk) || 0) + cogs); revSM.set(mk, (revSM.get(mk) || 0) + p); };
          for (let m = 0; m < nDrinks; m++) {
            lineNo++;
            const kind = r() < CUSTOM_SHARE ? "custom" : (zeros.length && r() < ZERO_SHARE) ? "zero" : "cocktail";
            if (kind === "custom") {
              const b = buildWell(); const up = b.reduce((a, [cid, q]) => a + upch(cid) * (q / 2 >= 1 ? 1 : q / 2) * (compFam.get(cid) === "spirit" ? 1 : 0), 0);
              const p = comp_ && m === 0 ? 0 : round2((WELL_BASE + up) * disc);
              lines.push({ order_id: oid, line_id: String(lineNo), restaurant_id: S.restaurant_id, date, time, channel: ch, daypart: "", drink_id: "WELL-CALL", qty: 1, net_price: p });
              b.forEach(([cid, q]) => { F.modifiers.push({ order_id: oid, line_id: String(lineNo), drink_id: "WELL-CALL", ingredient_id: cid, qty: q, unit: "" }); addUse(S.restaurant_id, date, cid, q); });
              addCost(b.reduce((a, [cid, q]) => a + compCostAt(cid, date) * q, 0), p);
              if (b[0][0] !== WELL[comp.get(b[0][0]).category]) premium = true;
            } else {
              const pool = kind === "zero" ? zeros : cocktails; if (!pool.length) { lineNo--; continue; }
              const iid = pick(r, pool.map(id => [id, pop.get(id) || 1]));
              const p = comp_ && m === 0 ? 0 : round2(price(iid, S) * disc);
              lines.push({ order_id: oid, line_id: String(lineNo), restaurant_id: S.restaurant_id, date, time, channel: ch, daypart: "", drink_id: iid, qty: 1, net_price: p });
              const rc = recipeOf.get(iid) || []; rc.forEach(([cid, q]) => addUse(S.restaurant_id, date, cid, q));
              // a swap on a menu drink: make it with mezcal, or call a brand in a margarita
              if (kind === "cocktail" && r() < 0.06) { const base = rc.find(([cid]) => compFam.get(cid) === "spirit"); if (base) { const cat = comp.get(base[0]).category; const calls = CALLS.filter(c => c[2] === cat); if (calls.length) { const cl = pick(r, calls.map(c => [c[0], 1])); F.modifiers.push({ order_id: oid, line_id: String(lineNo), drink_id: iid, ingredient_id: cl, qty: base[1], unit: "" }); addUse(S.restaurant_id, date, cl, base[1]); lines[lines.length - 1].net_price = round2(p + upch(cl)); premium = true; } } }
              addCost(rc.reduce((a, [cid, q]) => a + compCostAt(cid, date) * q, 0), lines[lines.length - 1].net_price);
            }
          }
          // food on the same check: depends on channel and daypart
          const food = foodByRest.get(S.restaurant_id);
          const addFood = (sec, n) => { const opts = food.filter(f => f.section === sec); for (let i = 0; i < n; i++) { const f = pick(r, opts.map(o => [o, 1])); lineNo++; lines.push({ order_id: oid, line_id: String(lineNo), restaurant_id: S.restaurant_id, date, time, channel: ch, daypart: "", drink_id: f.id, qty: 1, net_price: f.price }); } };
          const atTable = ch === "dine_in" || ch === "event";
          if (r() < (atTable ? 0.82 : ch === "bar" ? 0.48 : 0.3)) addFood("Small plates", pick(r, [[1, 50], [2, 35], [3, 15]]));
          if (r() < (atTable ? 0.6 : 0.14)) addFood("Entrées", pick(r, [[1, 70], [2, 30]]));
          if (r() < (atTable ? (premium ? 0.3 : 0.2) : 0.08)) addFood("Desserts", 1);
          for (const L of lines) F.sales.push(L);
        }
      }
    }
    // waste log: weekly, per restaurant and perishable ingredient, plus a floor for dead stock
    const weeks = [...new Set([...usageSW.keys()].map(k => k.split("|")[1]))].sort();
    const lastDate = F.sales[F.sales.length - 1].date;
    for (const S of RESTAURANTS) for (const wk of weeks) for (const c of comp.values()) {
      const fam = compFam.get(c.ingredient_id);
      if (!c.perishable && !LOW_MOVER_FLOOR[c.ingredient_id] && fam !== "spirit") continue;
      const use = usageSW.get(S.restaurant_id + "|" + wk + "|" + c.ingredient_id) || 0; if (!use && !LOW_MOVER_FLOOR[c.ingredient_id]) continue;
      const rate = WASTE_RATE[fam] || 0.02; let q = use * rate * (0.6 + 0.8 * r()) + (LOW_MOVER_FLOOR[c.ingredient_id] || 0) * 7 * (0.7 + 0.6 * r());
      q = Math.round(q); if (q <= 0) continue;
      const endOfWeek = new Date(wk + "T00:00:00Z"); endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6); const wdate = iso(endOfWeek) > lastDate ? lastDate : iso(endOfWeek);
      F.waste.push({ restaurant_id: S.restaurant_id, date: wdate, ingredient_id: c.ingredient_id, qty_pours: q, reason: pick(r, fam === "spirit" || fam === "liqueur" ? [["spill", 55], ["comp", 30], ["breakage", 15]] : [["spoilage", 50], ["over-prep", 30], ["expired", 15], ["spill", 5]]) });
    }
    // actuals (books) per restaurant-month, and inventory counts in bottles for a dozen ingredients
    const months = [...new Set(F.sales.map(l => l.date.slice(0, 7)))].sort();
    for (const S of RESTAURANTS) for (const m of months) {
      const k = S.restaurant_id + "|" + m; const cogs = cogsSM.get(k) || 0, rev = revSM.get(k) || 0;
      const gap = ACTUAL_GAP_OVERRIDE[k] != null ? ACTUAL_GAP_OVERRIDE[k] : ACTUAL_GAP[S.restaurant_id];
      F.actuals.push({ restaurant_id: S.restaurant_id, period: m, actual_beverage_cost: round2(cogs * (1 + gap)), net_sales: round2(rev * (1 + (r() - 0.5) * 0.006)) });
      for (const [cid, v] of Object.entries(INV_VARIANCE)) { const c = comp.get(cid); if (!c) continue; const use = usageSM.get(k + "|" + cid) || 0; if (!use) continue; const perBottle = c.bottle_size * conv[c.bottle_unit] / conv[c.pour_unit] / c.pour_size; const useB = use / perBottle; const begin = Math.round(useB / 30 * 6 * (0.8 + 0.4 * r()) * 10) / 10; const end = Math.round(begin * (0.9 + 0.2 * r()) * 10) / 10; const actual = useB * (1 + v) * (0.98 + 0.04 * r()); F.inventory.push({ restaurant_id: S.restaurant_id, period: m, ingredient_id: cid, begin_qty: begin, purchased_qty: Math.round((actual - begin + end) * 10) / 10, end_qty: end, qty_unit: "bottles" }); }
    }
    // par levels from usage (daily average × 1.3)
    for (const c of comp.values()) { let tot = 0; for (const [k, v] of usageSM) if (k.endsWith("|" + c.ingredient_id)) tot += v; c.par_pours = tot ? Math.round(tot / RESTAURANTS.length / days * 1.3) : null; }
    for (const row of itemRows) delete row._rest;
    const meta = { seed, days, start, restaurants: RESTAURANTS.length, orders: new Set(F.sales.map(l => l.order_id)).size, lines: F.sales.length, modifiers: F.modifiers.length, months, drinks: drinks.length, ingredients: F.ingredients.length };
    return { files: F, meta };
  }
  return { makeSample, RESTAURANTS, COST, FAM_COST, SPEC, CALLS, WELL, MIXERS, WELL_BASE, CALL_SHARE, COST_V2, FOOD, EXTRAS, WASTE_RATE, ACTUAL_GAP, ACTUAL_GAP_OVERRIDE, INV_VARIANCE, ZERO_SHARE, CUSTOM_SHARE };
});
