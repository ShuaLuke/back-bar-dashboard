// Write the blank input templates, the data dictionary and the synthetic sample files from the definitions in src/.
// Usage: node scripts/make_sample.js
// data/templates/*.csv   one header row + one example row per file type (from CostModel.TEMPLATES)
// docs/data-dictionary.md the same definitions as a document
// data/sample/*.csv      the full synthetic dataset the tool opens on (sales.csv and modifiers.csv are large and not committed;
//                        one restaurant-week excerpts of each are), plus sample-manifest.json with sizes
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const CM = require(path.join(root, "src", "costmodel.js")), SD = require(path.join(root, "src", "sample.js"));
const drinks = require(path.join(root, "data", "drinks.json"));
// the same category → family map the dashboard uses (CAT2FAM in src/template.html)
const CAT2FAM = { "Agave": "spirit", "Whiskey": "spirit", "Gin": "spirit", "Vodka": "spirit", "Rum & cane": "spirit", "Brandy & pisco": "spirit", "Other spirits": "spirit", "Zero-proof spirits": "spirit", "Liqueurs & amari": "liqueur", "Vermouth & fortified": "wine", "Wine & beer": "wine", "Citrus": "citrus", "Fruit": "fruit", "Herbs & spices": "herb", "Sweeteners": "sweet", "Bitters": "sweet", "Mixers": "mixer", "Dairy & egg": "other", "Savory": "other" };
const T = CM.TEMPLATES;
fs.mkdirSync(path.join(root, "data", "templates"), { recursive: true }); fs.mkdirSync(path.join(root, "data", "sample"), { recursive: true }); fs.mkdirSync(path.join(root, "docs"), { recursive: true });
for (const t of CM.TYPES) fs.writeFileSync(path.join(root, "data", "templates", T[t].file), CM.templateCSV(t));
// data dictionary
let md = `# Data dictionary\n\nThe input files the Cost & sales tool reads, with exact column names, types and units. Blank templates with one example row are in \`data/templates/\`; filled examples are in \`data/sample/\` and downloadable from the tool's Data tab.\n\nGeneral rules:\n\n- CSV, TSV or Excel (.xlsx). In a workbook, name each sheet after the file type (ingredients, drinks, …) and every sheet loads at once.\n- Column order does not matter. Headers are matched by name, case-insensitively, ignoring spaces and punctuation; the alternative names listed below are recognised automatically, and anything else can be mapped by hand on load.\n- Dates: YYYY-MM-DD preferred; M/D/YYYY, YYYYMMDD, D-Mon-YY and Excel date cells are accepted. Months: YYYY-MM.\n- Money in dollars without symbols (12.50). Percentages as numbers (95 means 95%).\n- Codes (restaurant_id, drink_id, ingredient_id) must match exactly across files. They are case-sensitive.\n- Several files of the same type can be loaded together (one sales file per month, for example); their rows are concatenated.\n- Rows the tool cannot use are never dropped silently: every problem is listed on the Data tab with the file, row and reason.\n\n`;
for (const t of CM.TYPES) {
  md += `## ${T[t].label} · \`${T[t].file}\`\n\n${T[t].need === "required" ? "**Required.**" : T[t].need === "optional" ? "Optional." : "Needed " + T[t].need + "."} ${T[t].desc}\n\n| Column | Required | Type | Meaning | Example | Also recognised as |\n|---|---|---|---|---|---|\n`;
  for (const c of T[t].cols) md += `| \`${c.k}\` | ${c.req ? "yes" : ""} | ${c.type}${c.unit ? " (" + c.unit + ")" : ""} | ${c.desc.replace(/\|/g, "\\|")} | ${c.ex ? "`" + c.ex + "`" : ""} | ${c.aliases.join(", ")} |\n`;
  md += "\n";
}
md += `## Units\n\nVolume: ml, l, fl oz, cup, pt, qt, gal. Weight: g, kg, oz, lb (note: \`oz\` is weight; a liquid pour is \`fl oz\`). Count: each, dash, drop, sprig, leaf, wedge, wheel, slice, twist, peel, rim, cube, splash, barspoon, pinch, egg, bottle, can, dozen. A bottle and its pour must use the same kind of unit; a weight bottle with a volume pour is reported as a unit mismatch. Bitters are easiest to cost by the dash: a 16 fl oz bottle is about 480 dashes, so \`bottle_size 480, bottle_unit dash, pour_size 1, pour_unit dash\`.\n\n## Recipe quantities\n\nA recipe row gives \`qty\` in a \`unit\` (2 fl oz of tequila, 1 dash of bitters, 1 each of a lime wedge), converted to the ingredient's standard pours through its \`pour_size\`. Leave \`unit\` blank to count standard pours directly (0.5 is a half pour, 2 a double). The same rule applies to modifiers.\n\n## Channels and dayparts\n\nChannel values are normalised to dine_in, bar, takeout, delivery, event or other (so "Patio", "Bar Top", "DoorDash" and "Private Dining" all work). Dayparts, when not given, come from the time column: before 15:00 lunch, 15:00–17:59 happy hour, 18:00–20:59 dinner, 21:00 to 03:59 late.\n\n## Minimum sets\n\n- Costs only: ingredients, drinks, recipes.\n- Sales, menu engineering, scenarios with volumes: add sales (and modifiers for well & call drinks and swaps).\n- Reconciliation test: add actuals.\n- Everything: add restaurants, extras, waste and inventory. Food lines on the same checks (in sales, with their drinks rows) switch on the food-pairing views.\n`;
fs.writeFileSync(path.join(root, "docs", "data-dictionary.md"), md);
// sample files
const { files, meta } = SD.makeSample({ drinks, catFam: c => CAT2FAM[c] || "other" });
const sizes = {};
for (const t of CM.TYPES) { const rows = files[t] || []; const csv = CM.toCSV(rows, T[t].cols.map(c => c.k)); fs.writeFileSync(path.join(root, "data", "sample", T[t].file), csv); sizes[T[t].file] = { rows: rows.length, bytes: csv.length }; }
// one restaurant-week excerpts of the two big files
const week = new Set(); for (const r of files.sales) { if (r.restaurant_id === "OYA" && r.date <= "2026-07-07") week.add(r.order_id); }
const sx = files.sales.filter(r => week.has(r.order_id)), mx = files.modifiers.filter(r => week.has(r.order_id));
fs.writeFileSync(path.join(root, "data", "sample", "sales-excerpt-OYA-week1.csv"), CM.toCSV(sx, T.sales.cols.map(c => c.k)));
fs.writeFileSync(path.join(root, "data", "sample", "modifiers-excerpt-OYA-week1.csv"), CM.toCSV(mx, T.modifiers.cols.map(c => c.k)));
fs.writeFileSync(path.join(root, "data", "sample", "sample-manifest.json"), JSON.stringify({ generated_by: "scripts/make_sample.js (src/sample.js, seed " + meta.seed + ")", note: "Synthetic data. sales.csv and modifiers.csv are regenerated by this script and not committed; the excerpts cover Oyamel, 2026-07-01 to 07-07.", meta, files: sizes, excerpts: { "sales-excerpt-OYA-week1.csv": sx.length, "modifiers-excerpt-OYA-week1.csv": mx.length } }, null, 1));
console.log("templates:", CM.TYPES.length, "sample files:", sizes, "excerpt rows:", sx.length, mx.length);
