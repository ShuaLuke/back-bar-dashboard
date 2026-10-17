// Hand-calculated test cases the cost model must reproduce exactly. Run: node --test tests/
// The cases live in src/costmodel.js (SELFTEST) so the page can run the same checks; this file is the gate.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const CM = require(path.join(__dirname, "..", "src", "costmodel.js"));
const SD = require(path.join(__dirname, "..", "src", "sample.js"));
const CAT2FAM = { "Agave": "spirit", "Whiskey": "spirit", "Gin": "spirit", "Vodka": "spirit", "Rum & cane": "spirit", "Brandy & pisco": "spirit", "Other spirits": "spirit", "Zero-proof spirits": "spirit", "Liqueurs & amari": "liqueur", "Vermouth & fortified": "wine", "Wine & beer": "wine", "Citrus": "citrus", "Fruit": "fruit", "Herbs & spices": "herb", "Sweeteners": "sweet", "Bitters": "sweet", "Mixers": "mixer", "Dairy & egg": "other", "Savory": "other" };

for (const t of CM.SELFTEST) {
  test(t.name, () => {
    const got = t.run();
    const close = (a, b) => a == null || b == null ? assert.equal(a, b) : assert.ok(Math.abs(a - b) < 1e-6, `${got} vs ${t.expect}${t.note ? " (" + t.note + ")" : ""}`);
    if (Array.isArray(t.expect)) { assert.equal(got.length, t.expect.length); t.expect.forEach((e, i) => typeof e === "number" ? close(got[i], e) : assert.equal(got[i], e)); }
    else close(got, t.expect);
  });
}

test("CSV parser handles quotes, CRLF and a BOM", () => {
  const { headers, rows } = CM.parseCSV('﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n2,,\r\n');
  assert.deepEqual(headers, ["a", "b", "c"]);
  assert.deepEqual(rows, [{ a: "1", b: "x, y", c: 'say "hi"' }, { a: "2", b: "", c: "" }]);
});
test("Column mapper recognises POS export headers", () => {
  const m = CM.autoMap("sales", ["Check #", "Store Number", "Business Date", "PLU", "Quantity", "Net Amount", "Revenue Center"]);
  assert.equal(m.order_id, "Check #"); assert.equal(m.restaurant_id, "Store Number"); assert.equal(m.date, "Business Date"); assert.equal(m.drink_id, "PLU"); assert.equal(m.qty, "Quantity"); assert.equal(m.net_price, "Net Amount"); assert.equal(m.channel, "Revenue Center");
  const i = CM.autoMap("ingredients", ["SKU", "Description", "Spirit Type", "Case Cost", "Bottle Size", "UOM", "Standard Pour", "Call Price"]);
  assert.equal(i.ingredient_id, "SKU"); assert.equal(i.ingredient_name, "Description"); assert.equal(i.category, "Spirit Type"); assert.equal(i.bottle_cost, "Case Cost"); assert.equal(i.bottle_size, "Bottle Size"); assert.equal(i.bottle_unit, "UOM"); assert.equal(i.pour_size, "Standard Pour"); assert.equal(i.upcharge, "Call Price");
});
test("Dates in several formats and Excel serials", () => {
  assert.equal(CM.toISODate("7/4/2026"), "2026-07-04"); assert.equal(CM.toISODate("2026-07-04"), "2026-07-04"); assert.equal(CM.toISODate(46207), "2026-07-04"); assert.equal(CM.toISODate("20260704"), "2026-07-04"); assert.equal(CM.toISODate("4-Jul-26"), "2026-07-04");
});
test("Channels and dayparts normalise to the bar vocabulary", () => {
  const M = CM.build(tinyWith(r => { r.sales.push({ _row: 9, order_id: "o3", restaurant_id: "S1", date: "2026-07-03", time: "16:20", channel: "Patio", drink_id: "marg", qty: 1 }); r.sales.push({ _row: 10, order_id: "o4", restaurant_id: "S1", date: "2026-07-03", time: "11:30 PM", channel: "DoorDash", drink_id: "marg", qty: 1 }); }));
  const l3 = M.sales.find(L => L.oid === "o3"), l4 = M.sales.find(L => L.oid === "o4");
  assert.equal(l3.ch, "dine_in"); assert.equal(l3.daypart, "happy_hour"); assert.equal(l4.ch, "delivery"); assert.equal(l4.daypart, "late");
});
test("Validation reports unmapped ingredients instead of dropping them silently", () => {
  const ds = tinyWith(r => r.recipes.push({ _row: 99, drink_id: "marg", ingredient_id: "ghost", qty: 1, unit: null }));
  const v = CM.validate(ds);
  assert.ok(v.errors.some(e => e.file === "recipes" && /unmapped/.test(e.msg) && /ghost/.test(e.msg)));
});
test("Validation flags drinks without a spec, unit mismatches and bad recipe units", () => {
  const ds = tinyWith(r => {
    r.drinks.push({ _row: 50, drink_id: "orphan", drink_name: "Orphan", section: "Cocktails", price: 9, custom: null, active: null, restaurant_id: null });
    r.ingredients.push({ _row: 60, ingredient_id: "odd", ingredient_name: "Odd", category: "Mixers", bottle_cost: 10, bottle_size: 1, bottle_unit: "lb", pour_size: 1, pour_unit: "fl oz" });
    r.recipes.push({ _row: 61, drink_id: "marg", ingredient_id: "lime", qty: 1, unit: "sprig" });
  });
  const v = CM.validate(ds);
  assert.ok(v.errors.some(e => /no recipe/.test(e.msg) && /Orphan/.test(e.msg)));
  assert.ok(v.errors.some(e => /unit mismatch/.test(e.msg) && e.file === "ingredients"));
  assert.ok(v.errors.some(e => /unit mismatch/.test(e.msg) && e.file === "recipes"));
});
test("Food lines on a check count for pairing but never for pour cost", () => {
  const ds = tinyWith(r => { r.drinks.push({ _row: 70, drink_id: "tacos", drink_name: "Tacos", section: "Small plates", price: 14, custom: null, active: null, restaurant_id: null }); r.sales.push({ _row: 71, order_id: "o1", restaurant_id: "S1", date: "2026-07-01", drink_id: "tacos", qty: 1, channel: "bar" }); });
  assert.deepEqual(CM.validate(ds).errors, []);
  const R = CM.analyze(CM.build(ds), {});
  assert.ok(Math.abs(R.totals.rev - 40) < 1e-9, "food revenue is not beverage revenue: " + R.totals.rev);
  assert.equal(R.attach.lines[0], "Small plates");
  assert.ok(Math.abs(R.attach.drinks.find(a => a.key === "marg").rates["Small plates"] - 1) < 1e-9);
});
test("Inventory counted in bottles converts to pours", () => {
  const ds = tinyWith(r => { r.ingredients.forEach(c => { if (c.ingredient_id === "tequila" && !c.effective_date) { c.pour_cost = null; c.bottle_cost = 21.5; c.bottle_size = 750; c.bottle_unit = "ml"; } }); r.inventory = [{ _row: 2, restaurant_id: "S1", period: "2026-07", ingredient_id: "tequila", begin_qty: 2, purchased_qty: 1, end_qty: 2.5, qty_unit: "bottles" }]; });
  const M = CM.build(ds); const R = CM.analyze(M, {});
  const row = R.ops.tva.find(x => x.cid === "tequila");
  assert.ok(Math.abs(row.actual - 0.5 * 750 / 29.5735295625) < 1e-6, "half a bottle is 12.68 one-ounce pours: " + row.actual);
});
test("Synthetic dataset validates cleanly and reconciles as designed", () => {
  const drinks = require(path.join(__dirname, "..", "data", "drinks.json"));
  const { files } = SD.makeSample({ drinks, catFam: c => CAT2FAM[c] || "other", days: 31 });
  const ds = {}; for (const k of Object.keys(files)) ds[k] = files[k].map((r, i) => Object.assign({ _row: i + 2 }, r));
  const v = CM.validate(ds); assert.deepEqual(v.errors, []);
  const M = CM.build(ds); const R = CM.analyze(M, { target: 22 });
  assert.ok(R.totals.fc > 15 && R.totals.fc < 28, "pour cost in a plausible range: " + R.totals.fc);
  assert.ok(R.byo.orders > 0 && R.byo.avgComponents >= 2);
  assert.ok(R.reconcile.rows.every(r => r.verdict === "Pass"), JSON.stringify(R.reconcile.rows.map(r => [r.name, r.month, r.verdict])));
  assert.ok(R.upcharges.length >= 8 && R.upcharges.every(u => u.margin > 0), "every call up-charge covers its cost in the sample");
  assert.ok(R.ladder.length > 0, "the ladder compares menu drinks with the well & call base");
  // the scenario machinery conserves revenue when nothing changes
  const R0 = CM.analyze(M, { target: 22 }, { name: "noop" }); assert.ok(Math.abs(R0.totals.rev - R.totals.rev) < 1e-6);
});
function tinyWith(f) {
  // rebuild the engine's tiny fixture through the public API and let the test mutate it
  const ds = JSON.parse(JSON.stringify(CM.__tiny()));
  f(ds); return ds;
}
