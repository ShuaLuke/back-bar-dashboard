/* Cost & sales tool: the UI over src/costmodel.js. Loaded after the dashboard script and reuses its helpers
   (esc, tipAttr, ttRows, ttList, money, m2, pct, css, d3, DRINKS, CAT2FAM, FAM_NAME, dEl, openDrawer, setView, hideTip).
   Everything runs in this browser tab. No network calls; the only storage is the opt-in "keep my data on this device". */
(function () {
  "use strict";
  const CM = window.CostModel, SD = window.SampleData;
  const $ = v => v == null || Number.isNaN(v) ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(2);
  const $0 = v => v == null || Number.isNaN(v) ? "—" : (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString();
  const $k = v => v == null ? "—" : Math.abs(v) >= 1e6 ? (v < 0 ? "−" : "") + "$" + (Math.abs(v) / 1e6).toFixed(2) + "M" : Math.abs(v) >= 1e4 ? (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v) / 1e3) + "k" : $0(v);
  const pf = (v, d = 1) => v == null || Number.isNaN(v) ? "—" : v.toFixed(d) + "%";
  const nf = v => v == null || Number.isNaN(v) ? "—" : Math.round(v).toLocaleString();
  const n1 = v => v == null || Number.isNaN(v) ? "—" : (Math.round(v * 10) / 10).toLocaleString();
  const sgn = (v, f) => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + f(Math.abs(v)).replace(/^[−-]/, "");
  const pts = v => v == null ? "—" : Math.abs(v) < 0.05 ? "0.0 pts" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1) + " pts";
  const monthName = m => { const [y, mo] = m.split("-"); return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo - 1] + " " + y; };
  const CH_LABEL = { dine_in: "Dine-in", bar: "Bar", takeout: "Takeout", delivery: "Delivery", event: "Events", other: "Other" };
  const DP_LABEL = { lunch: "Lunch & brunch", happy_hour: "Happy hour", dinner: "Dinner", late: "Late night", unknown: "Unknown" };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const QCOL = { Star: "var(--teal)", Plowhorse: "var(--f-citrus)", Puzzle: "var(--f-sweet)", Dog: "var(--muted)" };
  const VERDICT = { Pass: "ok", Review: "warn", Fail: "bad", "Not assessable": "quiet", "No sales": "quiet" };

  const blankScn = () => ({ name: "", costPct: {}, costAbs: {}, prices: {}, upcharges: {}, remove: [], swaps: [], newItems: [], unavailable: [], elasticity: -0.8, retention: 0.8 });
  const CT = { tab: "costs", src: "sample", sample: null, own: null, files: [], scope: { restaurants: null, months: null, channel: "all", target: 22 }, scn: blankScn(), saved: [], compare: new Set(), persist: false, cache: new Map(), exports: new Map(), ready: false, busy: false,
    ui: { itemSort: "fc", itemQ: "", buildQ: "", newItem: { name: "", line: "Cocktails", price: 16, recipe: [], units: 40, cannibal: 70, weeks: "" }, byoCalc: [], crossItem: "", salesSort: "units", opsStore: null, costTab: "drinks" },
    job: "home", flow: { review: { month: null, restaurants: null, step: 1 }, price: { step: 1, ups: {}, prices: {}, elasticity: -0.8, base: "last", q: "", name: "", options: [] }, menu: { step: 1, type: null, def: null, name: "", options: [] }, ideas: { open: null } } };
  try { CT.persist = localStorage.getItem("ja-ct-persist") === "1"; } catch (e) {}

  /* ---------- storage (opt-in) ---------- */
  const idb = {
    open() { return new Promise((res, rej) => { const q = indexedDB.open("ja-costtool", 1); q.onupgradeneeded = () => q.result.createObjectStore("kv"); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
    async get(k) { try { const db = await this.open(); return await new Promise((res, rej) => { const t = db.transaction("kv").objectStore("kv").get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); } catch (e) { return null; } },
    async set(k, v) { try { const db = await this.open(); await new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} },
    async clear() { try { const db = await this.open(); await new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").clear(); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} },
  };
  async function persistNow() {
    if (!CT.persist) return;
    await idb.set("files", CT.files.map(f => ({ name: f.name, type: f.type, text: f.text, map: f.map })));
    try { localStorage.setItem("ja-ct-saved", JSON.stringify(CT.saved)); } catch (e) {}
  }
  async function restore() {
    if (!CT.persist) return;
    try { CT.saved = JSON.parse(localStorage.getItem("ja-ct-saved") || "[]"); } catch (e) {}
    const files = await idb.get("files");
    if (files && files.length) { CT.files = files.map(f => { const p = CM.parseCSV(f.text); return { name: f.name, type: f.type, headers: p.headers, rows: p.rows, map: f.map || CM.autoMap(f.type, p.headers), text: f.text }; }); useOwnData(true); }
  }
  async function clearAll() {
    CT.files = []; CT.own = null; CT.src = "sample"; CT.saved = []; CT.compare.clear(); CT.scn = blankScn(); CT.cache.clear(); CT.scope = { restaurants: null, months: null, channel: "all", target: 22 }; resetFlows();
    await idb.clear(); try { localStorage.removeItem("ja-ct-saved"); } catch (e) {}
    render();
  }

  /* ---------- data ---------- */
  function ensureSample() {
    if (CT.sample) return CT.sample;
    const { files, meta } = SD.makeSample({ drinks: DRINKS, catFam: c => CAT2FAM[c] || "other" });
    const ds = {}; for (const k of Object.keys(files)) ds[k] = files[k].map((r, i) => Object.assign({ _row: i + 2 }, r));
    const validation = CM.validate(ds); const M = CM.build(ds);
    CT.sample = { ds, M, meta, files, validation, label: `Sample data · ${meta.restaurants} restaurants · ${monthName(meta.months[0])} to ${monthName(meta.months[meta.months.length - 1])} · ${nf(meta.orders)} orders` };
    return CT.sample;
  }
  const data = () => CT.src === "own" && CT.own ? CT.own : ensureSample();
  function scopeObj() { const M = data().M; const s = CT.scope; const restaurants = s.restaurants ? new Set([...s.restaurants].filter(x => M.restaurants.has(x))) : null; const months = s.months ? new Set([...s.months].filter(x => M.months.includes(x))) : null; return { restaurants: restaurants && restaurants.size ? restaurants : null, months: months && months.size ? months : null, channel: s.channel || "all", target: s.target || 22 }; }
  function results(scn) {
    const key = CT.src + "|" + JSON.stringify(CT.scope, (k, v) => v instanceof Set ? [...v] : v) + "|" + (scn ? JSON.stringify(scn) : "");
    let R = CT.cache.get(key); if (R) return R;
    R = CM.analyze(data().M, scopeObj(), scn || null);
    if (CT.cache.size > 10) CT.cache.delete(CT.cache.keys().next().value);
    CT.cache.set(key, R); return R;
  }
  const liveScn = () => { const s = CM.normScenario(CT.scn); return s && !s.empty ? CT.scn : null; };
  // results for any scope (months/restaurants arrays), independent of the Explore scope bar
  function resultsFor(sc, scn) {
    const M = data().M; const months = sc.months ? sc.months.filter(m => M.months.includes(m)) : null; const restaurants = sc.restaurants ? [...sc.restaurants].filter(x => M.restaurants.has(x)) : null;
    const key = "F|" + CT.src + "|" + JSON.stringify({ months, restaurants, ch: sc.channel || "all", t: CT.scope.target, asOf: sc.costAsOf || null }) + "|" + (scn ? JSON.stringify(scn) : "");
    let R = CT.cache.get(key); if (R) return R;
    R = CM.analyze(M, { restaurants: restaurants && restaurants.length ? new Set(restaurants) : null, months: months && months.length ? new Set(months) : null, channel: sc.channel || "all", target: CT.scope.target, costAsOf: sc.costAsOf }, scn || null);
    if (CT.cache.size > 24) CT.cache.delete(CT.cache.keys().next().value);
    CT.cache.set(key, R); return R;
  }
  function decomposeFor(restaurants, a, b) { const key = "D|" + CT.src + "|" + JSON.stringify({ restaurants: restaurants ? [...restaurants] : null, a, b, t: CT.scope.target }); let d = CT.cache.get(key); if (d) return d; d = CM.decompose(data().M, restaurants && restaurants.size ? restaurants : null, a, b, CT.scope.target); CT.cache.set(key, d); return d; }

  /* ---------- files ---------- */
  async function onFiles(list) {
    const files = [...list]; if (!files.length) return;
    CT.busy = "Reading " + files.map(f => f.name).join(", ") + "…"; render();
    for (const f of files) {
      try {
        if (/\.xlsx$/i.test(f.name)) {
          if (!window.XlsxLite) throw new Error("Excel reader not loaded");
          const sheets = await XlsxLite.read(await f.arrayBuffer());
          for (const sh of sheets) { if (!sh.rows.length) continue; const name = sheets.length > 1 ? `${f.name} › ${sh.name}` : f.name; const type = CM.detectType(sh.name, sh.headers) || CM.detectType(f.name, sh.headers); addFile({ name, type, headers: sh.headers, rows: sh.rows, text: CM.toCSV(sh.rows, sh.headers) }); }
        } else {
          const text = await f.text(); const p = CM.parseCSV(text); const type = CM.detectType(f.name, p.headers);
          addFile({ name: f.name, type, headers: p.headers, rows: p.rows, text });
        }
      } catch (e) { CT.files.push({ name: f.name, type: null, headers: [], rows: [], error: e.message || String(e), map: {} }); }
    }
    CT.busy = false; CT.job = "data"; render();
  }
  function addFile(f) { f.map = f.type ? CM.autoMap(f.type, f.headers) : {}; const i = CT.files.findIndex(x => x.name === f.name); if (i >= 0) CT.files[i] = f; else CT.files.push(f); }
  const fileReady = f => f.type && !f.error && CM.TEMPLATES[f.type].cols.filter(c => c.req).every(c => f.map[c.k]);
  function useOwnData(quiet) {
    const ds = {}; const bad = [];
    for (const f of CT.files) { if (!fileReady(f)) continue; const r = CM.applyMap(f.type, f.rows, f.map); r.bad.forEach(b => bad.push({ file: f.name, row: b.row, problem: b.problem })); ds[f.type] = (ds[f.type] || []).concat(r.rows); }
    const validation = CM.validate(ds); validation.bad = bad;
    if (bad.length) validation.warnings.unshift({ file: "files", msg: `${bad.length} row(s) could not be parsed and were left out (first: ${bad[0].file} row ${bad[0].row}: ${bad[0].problem}).`, rows: bad.length });
    CT.own = { ds, validation, M: validation.ok ? CM.build(ds) : null, loadedAt: new Date() };
    if (validation.ok) { const M = CT.own.M; CT.own.label = `Your data · ${M.restaurants.size} restaurant${M.restaurants.size === 1 ? "" : "s"}${M.months.length ? " · " + monthName(M.months[0]) + (M.months.length > 1 ? " to " + monthName(M.months[M.months.length - 1]) : "") : ""} · ${nf(M.orders.size)} orders`; CT.src = "own"; CT.cache.clear(); CT.scope = { restaurants: null, months: null, channel: "all", target: CT.scope.target }; resetFlows(); if (!quiet) CT.job = "home"; persistNow(); }
    else CT.src = "sample";
    if (!quiet) render();
  }
  function download(name, text, mime) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function exportCSV(id) { const e = CT.exports.get(id); if (!e) return; download((e.name || id).replace(/[^a-z0-9-]+/gi, "-").toLowerCase() + ".csv", CM.toCSV(e.rows.map(r => Object.fromEntries(e.cols.map(c => [c.l || c.k, c.raw ? c.raw(r) : r[c.k]]))), e.cols.map(c => c.l || c.k))); }
  function exportPNG(svg, name) {
    let s = new XMLSerializer().serializeToString(svg); s = s.replace(/var\((--[a-z0-9-]+)\)/g, (m, v) => css(v) || "#888").replace(/font-family:var\(--mono\)/g, "font-family:ui-monospace,Menlo,monospace");
    const vb = (svg.getAttribute("viewBox") || "0 0 600 300").split(/\s+/).map(Number); const W = vb[2] * 2, H = vb[3] * 2;
    const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H); const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = name + ".png"; a.click(); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s.replace(/<svg /, '<svg xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif;background:#fff" '));
  }

  /* ---------- small render helpers ---------- */
  const tile = (v, label, tip, cls) => `<div class="stat" tabindex="0" ${tip ? tipAttr(tip) : ""}><b class="num ${cls || ""}">${v}</b><span>${label}</span></div>`;
  const flag = (v, kind) => `<span class="flag ${kind || "quiet"}">${esc(v)}</span>`;
  // table with CSV export; cols: {k, l, n (numeric), f (format), w (width), tip (row tip fn)}
  function table(id, cols, rows, opts = {}) {
    CT.exports.set(id, { cols, rows, name: opts.name || id });
    const h = `<div class="ct-tbl" style="${opts.maxh ? "max-height:" + opts.maxh + "px" : ""}"><table class="ops ct"><thead><tr>${cols.map(c => `<th class="${c.n ? "n" : ""}" ${c.w ? `style="width:${c.w}"` : ""}>${c.l || c.k}</th>`).join("")}</tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr ${opts.tip ? tipAttr(opts.tip(r)) : ""} ${opts.row ? opts.row(r) : ""}>${cols.map(c => `<td class="${c.n ? "n" : ""} ${c.cls ? c.cls(r) : ""}">${c.f ? c.f(r[c.k], r) : esc(r[c.k] == null ? "—" : r[c.k])}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="empty">${esc(opts.empty || "Nothing to show.")}</td></tr>`}</tbody></table></div>`;
    return `<div class="ct-block"><div class="ct-head"><div class="sub">${opts.title || ""}</div><div class="ct-tools">${opts.tools || ""}${rows.length ? `<button class="linkbtn" data-act="csv:${id}" title="Download this table as CSV">⤓ CSV</button>` : ""}</div></div>${opts.note ? `<p class="hint">${opts.note}</p>` : ""}${h}</div>`;
  }
  const chart = (id, title, svg, note) => `<div class="ct-block"><div class="ct-head"><div class="sub">${title}</div><div class="ct-tools"><button class="linkbtn" data-act="png:${id}" title="Download this chart as an image">⤓ PNG</button></div></div><div id="${id}">${svg}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const bars = (rows, { k, label, max, color, fmt }) => `<div class="bars">${rows.map(r => `<div class="bar" ${r.tip ? tipAttr(r.tip) : ""} tabindex="0"><span class="name">${esc(label(r))}</span><span class="track"><span class="fill" style="display:block;width:${Math.min(100, (k(r) / (max || 1)) * 100)}%;background:${typeof color === "function" ? color(r) : color || "var(--accent)"}"></span></span><span class="val">${fmt(k(r))}</span></div>`).join("")}</div>`;
  const spark = (vals, w = 90, h = 22, color = "var(--accent)") => { const v = vals.filter(x => x != null); if (v.length < 2) return ""; const lo = Math.min(...v), hi = Math.max(...v); const sx = i => 2 + i / (vals.length - 1) * (w - 4), sy = x => hi === lo ? h / 2 : 2 + (1 - (x - lo) / (hi - lo)) * (h - 4); return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${vals.map((x, i) => x == null ? "" : sx(i).toFixed(1) + "," + sy(x).toFixed(1)).filter(Boolean).join(" ")}"></polyline></svg>`; };
  const sel = (name, options, value, attrs = "") => `<select data-set="${name}" ${attrs}>${options.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(value) ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
  const compOptions = M => [...M.comps.values()].filter(c => c.fam !== "extras").sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map(c => [c.id, `${c.name} · ${c.category}`]);
  const itemOptions = (M, pred) => [...M.drinks.values()].filter(i => i.active && (!pred || pred(i))).sort((a, b) => a.line.localeCompare(b.line) || a.name.localeCompare(b.name)).map(i => [i.id, `${i.name} · ${i.line}`]);
  const partsTip = (x, M) => `<b>${esc(x.name)}</b> <span class="tt-k">${esc(x.line)}</span>` + ttRows(x.parts.map(p => [`<i class="dot" style="background:var(--f-${p.fam === "extras" ? "other" : p.fam});margin-right:5px"></i>${esc(p.name)} <span class="tt-k">${esc(p.qty || "×" + p.pours)}</span>`, $(p.cost)])) + ttRows([["<b>Pour cost</b>", `<b>${$(x.food)}</b>`], ["Extras in-house / to-go", `${$(x.pkgIn)} / ${$(x.pkgDig)}`], ["Price", $(x.price)], ["Pour cost %", pf(x.fc)], ["Contribution", $(x.cm)]]);
  const srcTag = () => CT.src === "own" ? '<div class="tt-hint">Your data</div>' : '<div class="tt-hint">Sample data (synthetic)</div>';

  /* ---------- shell: jobs first, Explore keeps every view ---------- */
  const JOBS = [["home", "Home"], ["advise", "What to do"], ["review", "Monthly review"], ["menu", "Menu change"], ["price", "Price change"], ["ideas", "New drink ideas"], ["explore", "Explore"], ["data", "Data"]];
  function resetFlows() { CT.flow = { review: { month: null, restaurants: null, step: 1 }, price: { step: 1, ups: {}, prices: {}, elasticity: -0.8, base: "last", q: "", name: "", options: [] }, menu: { step: 1, type: null, def: null, name: "", options: [] }, ideas: { open: null }, advise: advBlank() }; }
  function render() {
    const box = dEl("cost-out"); if (!box) return;
    if (!CT.ready) { box.innerHTML = `<p class="hint">Preparing the sample dataset…</p>`; return; }
    const D = data(); const M = D.M;
    const own = CT.own && CT.own.M;
    box.innerHTML = `
      <div class="ct-banner ${CT.src === "own" ? "own" : "sample"}" id="ct-banner" role="status">
        <span class="ct-dot" aria-hidden="true"></span>
        <b>${CT.src === "own" ? "YOUR DATA" : "SAMPLE DATA"}</b>
        <span>${esc(D.label)}${CT.src === "sample" ? ". Every number is synthetic: nothing here is a real cost, sale or margin." : ""}${window.__offline ? " · Offline build: no external requests." : ""}</span>
        <span class="ct-banner-tools">
          ${CT.src === "own" ? `<button class="linkbtn" data-act="src:sample">Switch to sample</button>` : own ? `<button class="linkbtn" data-act="src:own">Switch to my data</button>` : `<button class="linkbtn" data-act="job:data">Load my data</button>`}
          ${CT.files.length || own ? `<button class="linkbtn" data-act="clear">Clear all data</button>` : ""}
        </span>
      </div>
      <nav class="ct-jobs" aria-label="Cost & sales jobs">${JOBS.map(([k, l]) => `<button class="ct-job ${CT.job === k ? "on" : ""}" data-act="job:${k}" aria-current="${CT.job === k ? "page" : "false"}">${l}</button>`).join("")}</nav>
      ${CT.job === "explore" ? `<div class="ct-bar"><div class="controls seg" role="tablist" aria-label="Explore views">${[["costs", "Costs"], ["sales", "Sales & mix"], ["scenarios", "Scenarios"], ["ops", "Operations"], ["recon", "Reconcile"]].map(([k, l]) => `<button class="chip" role="tab" data-act="tab:${k}" aria-pressed="${CT.tab === k}">${l}</button>`).join("")}</div>${scopeBar(M)}</div>` : ""}
      <div id="ct-tab">${CT.busy ? `<p class="hint">${esc(CT.busy)}</p>` : jobBody(M)}</div>`;
    wireInputs(box);
  }
  function scopeBar(M) {
    const s = CT.scope; const restaurants = [...M.restaurants.values()]; const months = M.months;
    return `<div class="ct-scope">
      ${restaurants.length > 1 ? `<span class="label">Restaurants</span>${restaurants.map(st => `<button class="chip" data-act="restaurant:${esc(st.id)}" aria-pressed="${!s.restaurants || s.restaurants.has(st.id)}">${esc(st.name)}</button>`).join("")}` : ""}
      ${months.length > 1 ? `<span class="label">Months</span>${months.map(m => `<button class="chip" data-act="month:${m}" aria-pressed="${!s.months || s.months.has(m)}">${monthName(m)}</button>`).join("")}` : ""}
      ${M.channels.length > 1 ? `<span class="label">Channel</span>${sel("channel", [["all", "All channels"]].concat(M.channels.map(c => [c, CH_LABEL[c]])), s.channel)}` : ""}
      <span class="label">Target pour cost</span><span style="white-space:nowrap;display:inline-flex;align-drinks:center;gap:4px"><input type="number" data-set="target" value="${s.target}" min="10" max="60" step="0.5" style="width:62px"><span class="label" style="margin:0">%</span></span>
    </div>`;
  }
  function jobBody(M) {
    try {
      if (CT.job === "data") return tabData();
      if (CT.job === "home") return jobHome(M);
      if (CT.job === "review") return jobReview(M);
      if (CT.job === "price") return jobPrice(M);
      if (CT.job === "menu") return jobMenu(M);
      if (CT.job === "ideas") return jobIdeas(M);
      if (CT.job === "advise") return jobAdvise(M);
      const R = results(null);
      if (CT.tab === "costs") return tabCosts(R, M);
      if (CT.tab === "sales") return tabSales(R, M);
      if (CT.tab === "scenarios") return tabScenarios(R, M);
      if (CT.tab === "ops") return tabOps(R, M);
      if (CT.tab === "recon") return tabRecon(R, M);
    } catch (e) { console.error(e); return `<p class="empty">Something went wrong rendering this view: ${esc(e.message)}</p>`; }
    return "";
  }

  /* ---------- Data tab ---------- */
  function tabData() {
    const T = CM.TEMPLATES; const own = CT.own; const V = own && own.validation;
    const need = t => T[t].need === "required" ? flag("required", "warn") : T[t].need === "optional" ? flag("optional") : flag(T[t].need);
    const fileRow = (f, i) => { const ready = fileReady(f); const t = f.type && T[f.type]; const missing = t ? t.cols.filter(c => c.req && !f.map[c.k]).map(c => c.k) : [];
      return `<div class="ct-file ${f.error ? "bad" : ready ? "ok" : "warn"}">
        <div class="ct-file-head"><b>${esc(f.name)}</b><span class="hint">${f.error ? esc(f.error) : `${nf(f.rows.length)} rows · ${f.headers.length} columns`}</span>
          <span class="ct-file-tools">${sel("ftype:" + i, [["", "— choose a file type —"]].concat(CM.TYPES.map(k => [k, T[k].label])), f.type || "")}<button class="linkbtn" data-act="map:${i}">${f.showMap ? "Hide mapping" : "Column mapping"}</button><button class="linkbtn" data-act="rmfile:${i}" aria-label="Remove ${esc(f.name)}">✕</button></span></div>
        ${f.type && !f.error ? (ready ? `<span class="flag ok">Ready${f.type ? " · " + esc(T[f.type].label) : ""}</span>` : `<span class="flag warn">Map the required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}</span>`) : f.error ? "" : `<span class="flag warn">Pick what this file is</span>`}
        ${f.showMap && f.type ? `<div class="ct-map">${T[f.type].cols.map(c => `<label><span>${c.k}${c.req ? ' <b style="color:var(--warn)">*</b>' : ""}</span>${sel(`map:${i}:${c.k}`, [["", "— not in file —"]].concat(f.headers.map(h => [h, h])), f.map[c.k] || "")}</label>`).join("")}<p class="hint">Columns are matched by name; fix any that are wrong. <code>*</code> = required. Header names are only remembered if “keep my data on this device” is on.</p></div>` : ""}
      </div>`; };
    const vList = (list, kind) => list.length ? `<ul class="ct-vlist ${kind}">${list.map(x => `<li><b>${esc(x.file)}</b> ${esc(x.msg)}</li>`).join("")}</ul>` : "";
    const canUse = CT.files.some(fileReady);
    return `<div class="ct-grid">
      <div class="ct-col">
        <h3>Load your data</h3>
        <p class="hint">CSV, TSV or Excel (.xlsx, one file type per sheet). Files are read and computed <b>in this tab only</b>: nothing is uploaded, the page makes no network requests with your data, and nothing is kept after the tab closes unless you opt in below.</p>
        <label class="ct-drop" id="ct-drop"><input type="file" id="ct-file" multiple accept=".csv,.tsv,.txt,.xlsx" hidden><span><b>Drop files here</b> or click to choose</span><span class="hint">ingredients, drinks, recipes, sales, modifiers, restaurants, extras, waste, actuals, inventory · POS exports and the bar manager's pour-cost sheet as they are</span></label>
        <div class="ct-opts">
          <label class="ct-check"><input type="checkbox" data-set="persist" ${CT.persist ? "checked" : ""}> Keep my data on this device (browser storage, this computer only). Off by default: data clears when the tab closes.</label>
          ${CT.files.length || (CT.own) ? `<button class="linkbtn" data-act="clear">Clear all data</button>` : ""}
        </div>
        <h3 style="margin-top:8px">What to load</h3>
        <div class="ct-templates">${CM.TYPES.map(t => `<div class="ct-tpl"><div><b>${esc(T[t].label)}</b> ${need(t)}</div><span class="hint">${esc(T[t].desc)}</span><span class="ct-tpl-tools"><button class="linkbtn" data-act="tpl:${t}">⤓ Blank template</button><button class="linkbtn" data-act="sample:${t}">⤓ Sample file</button><button class="linkbtn" data-act="dict:${t}">Columns</button></span></div>`).join("")}</div>
        <p class="hint">Minimum to see costs: ingredients, drinks and recipes. Add sales (and modifiers for well & call) for the sales, scenario and operations views, and actuals for the reconciliation test. The full data dictionary is in <code>docs/data-dictionary.md</code>; the sample files follow it exactly.</p>
      </div>
      <div class="ct-col">
        <h3>Loaded files ${CT.files.length ? `<span class="hint">${CT.files.length}</span>` : ""}</h3>
        ${CT.files.length ? CT.files.map(fileRow).join("") : `<p class="empty">No files yet. The tool is showing the built-in sample dataset.</p>`}
        ${CT.files.length ? `<div class="ct-actions"><button class="tour-next" data-act="use" ${canUse ? "" : "disabled"}>Use this data</button><span class="hint">Checks every file, reports problems, then switches the whole tool to your data.</span></div>` : ""}
        ${V ? `<h3 style="margin-top:12px">Checks ${!V.ok ? flag("fix before use", "bad") : V.errors.length ? flag(`usable · ${V.errors.length} error${V.errors.length === 1 ? "" : "s"} reported`, "warn") : flag("data usable", "ok")}</h3>
          ${V.errors.length ? `<div class="sub" style="margin:4px 0">Errors · ${V.errors.length}</div>` + vList(V.errors, "bad") : `<p class="hint">No errors.</p>`}
          ${V.warnings.length ? `<div class="sub" style="margin:8px 0 4px">Warnings · ${V.warnings.length}</div>` + vList(V.warnings, "warn") : ""}
          ${V.info.length ? `<div class="sub" style="margin:8px 0 4px">Notes</div>` + vList(V.info, "info") : ""}
          ${own.M ? `<p class="hint" style="margin-top:8px">Loaded: ${own.M.comps.size} ingredients, ${own.M.drinks.size} drinks, ${nf(own.M.sales.length)} sales lines, ${nf(own.M.orders.size)} orders, ${own.M.restaurants.size} restaurants, ${own.M.months.length} months.</p>` : ""}` : ""}
        <h3 style="margin-top:14px">How this stays private</h3>
        <ul class="ct-notes">
          <li>Parsing and every calculation run in your browser. There is no server, no upload and no analytics.</li>
          <li>The page's content-security policy blocks every network connection (<code>connect-src 'none'</code>); the hosted version only fetches the D3 library and fonts, and the offline build fetches nothing at all.</li>
          <li>Storage is off unless you tick “keep my data on this device”; “Clear all data” wipes it, including saved scenarios and column mappings.</li>
          <li>The full source, the list of external requests and the review notes are in <code>docs/security-review.md</code>.</li>
        </ul>
      </div>
    </div>`;
  }

  /* ---------- Costs tab ---------- */
  function tabCosts(R, M) {
    const t = R.scope.target; const all = R.itemList.filter(x => !x.byo && !x.removed && !x.addon);
    const drinks = all.filter(x => x.parts.length), addons = [];
    const over = drinks.filter(x => x.fc != null && x.fc > t).sort((a, b) => b.fc - a.fc);
    const q = CT.ui.itemQ.toLowerCase(); const sortK = CT.ui.itemSort;
    const list = all.filter(x => !q || x.name.toLowerCase().includes(q) || x.line.toLowerCase().includes(q)).sort(sortK === "fc" ? (a, b) => (b.fc || 0) - (a.fc || 0) : sortK === "cm" ? (a, b) => (b.cm || 0) - (a.cm || 0) : sortK === "lo" ? (a, b) => (a.cm || 0) - (b.cm || 0) : (a, b) => a.line.localeCompare(b.line) || a.name.localeCompare(b.name));
    const pkgShare = R.totals.rev ? R.totals.pkg / R.totals.rev * 100 : null;
    const kpis = `<div class="ops-tiles">
      ${tile(pf(drinks.length ? d3.mean(drinks, x => x.fc) : null), "avg pour cost, drinks at menu price", `<b>Average pour cost at menu price</b>` + ttRows([["Drinks", pf(drinks.length ? d3.mean(drinks, x => x.fc) : null)], ["Food", pf(addons.length ? d3.mean(addons, x => x.fc) : null)], ["Mix-weighted (sold)", pf(R.totals.fc)]]) + srcTag())}
      ${tile($(drinks.length ? d3.median(drinks, x => x.cm) : null), "median contribution per drink", `<b>Contribution = price − pour cost</b>` + ttRows([["Drinks (median)", $(drinks.length ? d3.median(drinks, x => x.cm) : null)], ["Food (median)", $(addons.length ? d3.median(addons, x => x.cm) : null)]]) + srcTag())}
      ${tile(over.length, `drinks over the ${t}% target`, `<b>Over target</b>` + ttList(over.map(x => `${esc(x.name)} <span class="tt-k">${pf(x.fc)}</span>`), 10) + srcTag(), over.length ? "pc-hi" : "")}
      ${tile(M.hasPackaging ? pf(pkgShare) : "—", "ice, garnish & glassware, share of sales", M.hasPackaging ? `<b>Extras</b>` + ttRows([["In-house cocktail", $(M.pkg("Cocktails", "dine_in"))], ["To-go cocktail", $(M.pkg("Cocktails", "takeout"))], ["Total in scope", $0(R.totals.pkg)]]) : "<b>No extras file loaded</b><div class='tt-k'>Load extras.csv to add ice, garnish and glassware per drink, in-house and to-go</div>")}
      ${tile(M.costDates.length ? M.costDates.length + 1 : 1, "cost versions", `<b>Cost versions</b>` + ttRows([["Effective dates", M.costDates.length ? M.costDates.join(", ") : "none (one version)"], ["Costed at", R.refDate]]))}
    </div>`;
    const itemsT = table("drinks-cost", [
      { k: "name", l: "Drink", f: (v, r) => `<b style="font-weight:600">${esc(v)}</b>${r.isNew ? ' <span class="zp">new</span>' : ""}` }, { k: "line", l: "Section", f: v => `<span style="color:var(--muted)">${esc(v)}</span>` },
      { k: "price", l: "Price", n: 1, f: $ }, { k: "food", l: "Pour cost", n: 1, f: $ }, { k: "fc", l: "Pour cost %", n: 1, f: pf, cls: r => r.fc > t && !r.addon ? "pc-hi" : "" }, { k: "cm", l: "Contribution", n: 1, f: $ }, { k: "priceFor", l: `Price for ${t}%`, n: 1, f: $ },
      { k: "pkgIn", l: "Extras in-house", n: 1, f: $ }, { k: "pkgDig", l: "Extras to-go", n: 1, f: $ }, { k: "parts", l: "Ingredients", n: 1, f: v => v.length, raw: r => r.parts.length },
      { k: "parts", l: "Cost mix", f: (v, r) => `<span class="cbar">${v.map(p => `<i style="width:${r.food ? p.cost / r.food * 100 : 0}%;background:var(--f-${p.fam === "extras" ? "other" : p.fam})"></i>`).join("")}</span>`, raw: r => r.parts.map(p => `${p.name}×${p.pours}=${p.cost.toFixed(3)}`).join("; ") },
    ], list, { title: `Drink by drink · costed at ${R.refDate}${R.scope.restaurants.length === 1 ? " · " + esc((M.restaurants.get(R.scope.restaurants[0]) || { name: "" }).name) : ""}`, name: "drink-costs", maxh: 420, tip: r => partsTip(r, M) + '<div class="tt-hint">Click for the full build-up</div>', row: r => `data-act="drink:${esc(r.id)}" style="cursor:pointer"`,
      tools: `<input type="search" data-set="itemQ" value="${esc(CT.ui.itemQ)}" placeholder="Filter drinks" style="width:130px"><div class="controls">${[["fc", "Highest pour cost"], ["lo", "Lowest contribution"], ["cm", "Highest contribution"], ["line", "By line"]].map(([k, l]) => `<button class="chip" data-act="isort:${k}" aria-pressed="${sortK === k}">${l}</button>`).join("")}</div>` });
    const upT = table("upcharges", [
      { k: "name", l: "Ingredient", f: (v, r) => `<b style="font-weight:600">${esc(v)}</b> <span class="hint">${esc(r.category)}</span>` }, { k: "upcharge", l: "Up-charge", n: 1, f: $ }, { k: "cost", l: "Pour cost", n: 1, f: $ },
      { k: "incremental", l: "Incremental cost", n: 1, f: $ }, { k: "margin", l: "Margin per call", n: 1, f: $, cls: r => r.margin < 0 ? "pc-hi" : "" }, { k: "marginPct", l: "Margin %", n: 1, f: pf }, { k: "breakEven", l: "Break-even cost", n: 1, f: $ },
      { k: "picks", l: "Calls", n: 1, f: nf }, { k: "perStoreWeek", l: "Per restaurant-week", n: 1, f: n1 }, { k: "marginTotal", l: "Margin in scope", n: 1, f: $0 },
    ], R.upcharges, { title: "Call up-charge coverage · what a called brand earns against what it costs", name: "upcharge-coverage", note: `A called brand replaces the well spirit of its category, so its incremental cost is its pour cost minus that well (the average well pour is ${$(R.includedMain)}). A non-spirit up-charge is a pure add. Break-even is the pour cost at which the margin reaches zero.`, tip: r => `<b>${esc(r.name)}</b>` + ttRows([["Up-charge", $(r.upcharge)], ["Pour cost", $(r.cost)], [r.baseMain != null ? "Well it replaces" : "Pure add", r.baseMain != null ? $(r.baseMain) : "—"], ["Margin per call", $(r.margin)], ["Calls in scope", nf(r.picks)]]) + srcTag() });
    const hist = R.history.snapshots.length ? R.history.snapshots.map(s => `<div class="ct-block"><div class="sub">Costs effective ${s.date} · ${s.ingredients.length} ingredient${s.ingredients.length === 1 ? "" : "s"} changed, ${s.drinks.length} drink${s.drinks.length === 1 ? "" : "s"} moved</div>
        <div class="ops-two"><div>${bars(s.ingredients.slice(0, 8).map(c => ({ ...c, tip: `<b>${esc(c.name)}</b>` + ttRows([["Before", $(c.before)], ["After", $(c.after)], ["Change", c.pct == null ? "—" : sgn(c.pct, v => v.toFixed(1) + "%")]]) })), { k: c => Math.abs(c.after - c.before), label: c => `${c.name} ${sgn(c.pct, v => v.toFixed(0) + "%")}`, max: d3.max(s.ingredients, c => Math.abs(c.after - c.before)), color: c => c.after > c.before ? "var(--warn)" : "var(--teal)", fmt: v => $(v) })}</div>
        ${table("history-" + s.date, [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "before", l: "Cost before", n: 1, f: $ }, { k: "after", l: "After", n: 1, f: $ }, { k: "delta", l: "Change", n: 1, f: v => sgn(v, $), cls: r => r.delta > 0 ? "pc-hi" : "" }, { k: "fcAfter", l: "Pour cost % after", n: 1, f: (v, r) => `${pf(r.fcBefore)} → ${pf(v)}` }, { k: "driver", l: "Driven by" }], s.drinks, { name: "cost-history-" + s.date, maxh: 260 })}</div></div>`).join("")
      : `<p class="hint">${esc(R.history.note || "")}</p>`;
    const strT = R.hasStrength ? table("strength", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "stdDrinks", l: "Standard drinks", n: 1, f: v => n1(v), cls: r => r.stdDrinks > 2 ? "pc-hi" : "" }, { k: "alcoholOz", l: "Alcohol, fl oz", n: 1, f: v => v.toFixed(2) }, { k: "volumeOz", l: "Liquid, fl oz", n: 1, f: v => v.toFixed(1) }, { k: "abv", l: "ABV of the drink", n: 1, f: v => pf(v, 0) }, { k: "missing", l: "Spirits without ABV", n: 1 }, { k: "read", l: "Reading" }], R.strength, { title: "Strength check · alcohol per drink from the spec, in US standard drinks (0.6 fl oz of pure alcohol)", name: "strength-check", maxh: 300, note: "Pour volume × ABV, summed over the spec, before dilution. Over two standard drinks is worth a look for responsible service; a pour change shows here as well as in cost. Needs abv_pct in ingredients.csv." }) : "";
    return `${kpis}
      <div class="controls seg" style="margin-top:4px">${[["drinks", "Drinks"], ["upcharges", "Up-charges"], ["byo", "Cost a well & call"], ["history", "Cost history"], ["strength", "Strength check"]].map(([k, l]) => `<button class="chip" data-act="ctab:${k}" aria-pressed="${CT.ui.costTab === k}">${l}</button>`).join("")}</div>
      ${CT.ui.costTab === "drinks" ? itemsT + `<p class="hint">Pour cost is the spec (each ingredient × its quantity) at the bottle cost in force on the reference date, after yield. Extras (ice, garnish, glassware) are shown separately and included in the mix-weighted figures on the Sales tab. Prices are the restaurant's menu price before call up-charges.</p>` : ""}
      ${CT.ui.costTab === "upcharges" ? upT : ""}
      ${CT.ui.costTab === "byo" ? byoCalc(R, M) : ""}
      ${CT.ui.costTab === "history" ? hist : ""}
      ${CT.ui.costTab === "strength" ? (strT || `<p class="hint">No ABV in the ingredients file, so strength cannot be computed. Add an <code>abv_pct</code> column to ingredients.csv.</p>`) : ""}`;
  }
  // cost any well & call drink from its modifiers
  function byoCalc(R, M) {
    const parts = CT.ui.byoCalc; const line = CT.ui.byoLine || [...M.byoByLine.keys()][0] || "Well & call"; const byoId = M.byoByLine.get(line);
    const base = byoId ? M.itemPrice(byoId, R.refStore) : 0; const c = CM.costOf(M, parts, R.refStore, R.refDate, liveScn());
    const ups = c.parts.reduce((a, p) => a + p.upcharge * p.pours, 0); const price = base + ups; const pkgIn = M.pkg(line, "dine_in"), pkgDig = M.pkg(line, "takeout");
    return `<div class="ops-two">
      <div class="ct-editor">
        <div class="sub" style="margin-top:0">Build a well & call drink</div>
        <div class="ct-row">${sel("byoLine", M.lines.filter(l => M.byoByLine.has(l)).map(l => [l, l]).concat(M.byoByLine.size ? [] : [[line, line]]), line)}<span class="hint">base ${$(base)}</span></div>
        <div class="ct-row">${sel("byoPick", [["", "— add a ingredient —"]].concat(compOptions(M)), "")}<input type="number" data-set="byoQty" value="${CT.ui.byoQty || 1}" step="0.25" min="0.25" style="width:64px" aria-label="Pours"><button class="linkbtn" data-act="byoAdd">Add</button></div>
        <div class="ct-list">${parts.map((p, i) => `<div><span>${esc(M.comps.get(p.cid).name)} <span class="hint">${CM.fmtQty(M.comps.get(p.cid), p.pours)}${M.comps.get(p.cid).upcharge ? " · +" + $(M.comps.get(p.cid).upcharge) : ""}</span></span><button class="linkbtn" data-act="byoRm:${i}" aria-label="Remove">✕</button></div>`).join("") || `<p class="hint">Pick a spirit (the well, or a called brand with its up-charge), a mixer and any garnish. Quantities are standard pours: ×2 is a double, ×0.5 a half pour.</p>`}</div>
        ${parts.length ? `<button class="linkbtn" data-act="byoClear">Clear</button>` : ""}
      </div>
      <div><div class="ops-tiles">
        ${tile($(c.food), "pour cost of this drink")}${tile($(price), `price: base + ${$(ups)} call up-charges`)}${tile(pf(price ? c.food / price * 100 : null), "pour cost %", null, price && c.food / price * 100 > R.scope.target ? "pc-hi" : "")}${tile($(price - c.food - pkgIn), "contribution in-house")}${tile($(price - c.food - pkgDig), "contribution to-go")}
      </div>
      ${c.parts.length ? table("byo-build", [{ k: "name", l: "Ingredient" }, { k: "category", l: "Category" }, { k: "qty", l: "Quantity", n: 1 }, { k: "unit", l: "Pour cost", n: 1, f: $ }, { k: "cost", l: "Cost", n: 1, f: $ }, { k: "upcharge", l: "Call up-charge", n: 1, f: v => v ? $(v) : "—" }], c.parts, { name: "well-call-cost" }) : ""}
      <p class="hint">Costs the drink exactly as the modifiers file would: every ingredient picked, times its pours, at the cost in force. The same engine prices every well & call line in the sales data.</p></div>
    </div>`;
  }

  /* ---------- Sales tab ---------- */
  function tabSales(R, M) {
    if (!R.hasSales) return `<p class="empty">No sales in this scope. Load a sales file (and modifiers for well & call orders), or widen the restaurant and month filters.</p>`;
    const T = R.totals; const t = R.scope.target;
    const byoShare = T.drinks ? R.byo.orders / T.drinks : 0;
    const kpis = `<div class="ops-tiles">
      ${tile($k(T.rev), "net sales in scope", `<b>Sales</b>` + ttRows([["Orders", nf(T.orders)], ["Units", nf(T.units)], ["Drinks", nf(T.drinks)], ["Average order", $(T.aov)]]) + srcTag())}
      ${tile(pf(T.fc), "mix-weighted pour cost", `<b>Theoretical pour cost</b><div class="tt-k">Cost of what sold ÷ what it sold for</div>` + ttRows([["Food", $0(T.cogs)], ["Extras & extras", $0(T.pkg)], ["Food + extras", pf(T.fcAll)]]) + srcTag(), T.fc > t ? "pc-hi" : "")}
      ${tile($k(T.gp), "gross profit after food & extras", `<b>Gross profit</b>` + ttRows([["Sales", $0(T.rev)], ["Food", "−" + $0(T.cogs)], ["Extras", "−" + $0(T.pkg)]]) + srcTag())}
      ${tile(pf(byoShare * 100, 0), "of drinks are well & call", `<b>Well & call</b>` + ttRows([["Orders", nf(R.byo.orders)], ["Avg ingredients", n1(R.byo.avgComponents)], ["Distinct combinations", nf(R.byo.distinctBuilds)]]) + srcTag())}
      ${tile($(T.aov), "average order", `<b>Average order value</b>` + ttRows(R.byChannel.map(c => [CH_LABEL[c.channel], $(c.aov)])) + srcTag())}
    </div>`;
    // pour cost by restaurant × month
    const months = R.byMonth.map(m => m.month);
    const smRows = R.byStore.map(s => { const row = { restaurant: s.name, fc: s.fc, rev: s.rev, orders: s.orders }; months.forEach(m => { const a = R.byStoreMonth.get(s.restaurant + "|" + m); row[m] = a ? a.fc : null; }); return row; });
    const smT = table("fc-restaurant-month", [{ k: "restaurant", l: "Restaurant", f: v => `<b style="font-weight:600">${esc(v)}</b>` }].concat(months.map(m => ({ k: m, l: monthName(m), n: 1, f: v => pf(v), cls: r => r[m] > t ? "pc-hi" : "" }))).concat([{ k: "fc", l: "All months", n: 1, f: pf, cls: r => r.fc > t ? "pc-hi" : "" }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "orders", l: "Orders", n: 1, f: nf }]), smRows, { title: "Theoretical pour cost % · by restaurant and month", name: "food-cost-by-restaurant-month" });
    const lineT = table("fc-line", [{ k: "line", l: "Section" }, { k: "units", l: "Units", n: 1, f: nf }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "fc", l: "Pour cost %", n: 1, f: pf, cls: r => r.fc > t ? "pc-hi" : "" }, { k: "fcAll", l: "With extras", n: 1, f: pf }, { k: "gp", l: "Gross profit", n: 1, f: $k }], R.byLine.slice().sort((a, b) => b.rev - a.rev), { title: "By menu section", name: "pour-cost-by-section" });
    // menu engineering
    const drinks = R.itemList.filter(x => !x.addon && !x.byo && x.units > 0);
    const W = 600, H = 280, L = 44, Rm = 12, Tm = 14, B = 30;
    const xMax = Math.max(1, d3.max(drinks, x => x.units) * 1.05), yLo = Math.min(0, d3.min(drinks, x => x.cmUnit) || 0), yHi = Math.max(1, (d3.max(drinks, x => x.cmUnit) || 1) * 1.1);
    const sx = v => L + v / xMax * (W - L - Rm), sy = v => Tm + (1 - (v - yLo) / (yHi - yLo)) * (H - Tm - B);
    const me = R.me.drinks;
    const scatter = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Menu engineering matrix">
      <rect x="${sx(me.pop)}" y="${Tm}" width="${Math.max(0, W - Rm - sx(me.pop))}" height="${Math.max(0, sy(me.cm) - Tm)}" fill="var(--teal-soft)" opacity=".7"></rect>
      ${d3.ticks(yLo, yHi, 5).map(v => `<line x1="${L}" x2="${W - Rm}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)"></line><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted);font-family:var(--mono)">$${v}</text>`).join("")}
      ${d3.ticks(0, xMax, 5).map(v => `<text x="${sx(v)}" y="${H - 10}" text-anchor="middle" font-size="11" style="fill:var(--muted);font-family:var(--mono)">${nf(v)}</text>`).join("")}
      <line x1="${sx(me.pop)}" x2="${sx(me.pop)}" y1="${Tm}" y2="${H - B}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".5"></line><line x1="${L}" x2="${W - Rm}" y1="${sy(me.cm)}" y2="${sy(me.cm)}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".5"></line>
      <text x="${W - Rm - 6}" y="${Tm + 14}" text-anchor="end" font-size="12" font-weight="650" style="fill:var(--teal)">Stars</text><text x="${L + 6}" y="${Tm + 14}" font-size="12" font-weight="650" style="fill:var(--f-sweet)">Puzzles</text><text x="${W - Rm - 6}" y="${H - B - 8}" text-anchor="end" font-size="12" font-weight="650" style="fill:var(--warn)">Plowhorses</text><text x="${L + 6}" y="${H - B - 8}" font-size="12" font-weight="650" style="fill:var(--muted)">Dogs</text>
      ${drinks.map(x => `<circle cx="${sx(x.units).toFixed(1)}" cy="${sy(x.cmUnit).toFixed(1)}" r="5.5" fill="${QCOL[x.quadrant]}" fill-opacity=".85" stroke="var(--surface)" ${tipAttr(`<b>${esc(x.name)}</b> <span class="tt-k">${esc(x.line)}</span>` + ttRows([["Units", nf(x.units)], ["Avg paid", $(x.avgPrice)], ["Contribution / unit", $(x.cmUnit)], ["Pour cost %", pf(x.fcSold)], ["Quadrant", x.quadrant], ["Reading", x.read]]) + srcTag())}></circle>`).join("")}
    </svg>`;
    const qCount = Object.fromEntries(Object.keys(QCOL).map(k => [k, drinks.filter(x => x.quadrant === k)]));
    const meT = table("menu-engineering", [{ k: "name", l: "Drink", f: v => `<b style="font-weight:600">${esc(v)}</b>` }, { k: "line", l: "Section" }, { k: "units", l: "Units", n: 1, f: nf }, { k: "share", l: "Mix", n: 1, f: v => pf(v * 100) }, { k: "avgPrice", l: "Avg paid", n: 1, f: $ }, { k: "unitCost", l: "Cost", n: 1, f: $ }, { k: "fcSold", l: "Pour cost %", n: 1, f: pf, cls: r => r.fcSold > t ? "pc-hi" : "" }, { k: "cmUnit", l: "Contribution", n: 1, f: $ }, { k: "cmTotal", l: "Total contribution", n: 1, f: $k }, { k: "quadrant", l: "Quadrant", f: v => v ? `<span class="flag" style="background:${QCOL[v]}22;color:${QCOL[v]}">${v}</span>` : "—" }, { k: "read", l: "Reading" }],
      R.itemList.filter(x => x.units > 0 && !x.addon).sort(CT.ui.salesSort === "units" ? (a, b) => b.units - a.units : CT.ui.salesSort === "cm" ? (a, b) => b.cmTotal - a.cmTotal : (a, b) => (b.fcSold || 0) - (a.fcSold || 0)), { title: "Every drink sold · popularity and contribution (food lines are left out)", name: "menu-engineering", maxh: 380, tools: `<div class="controls">${[["units", "Most sold"], ["cm", "Most contribution"], ["fc", "Highest pour cost"]].map(([k, l]) => `<button class="chip" data-act="ssort:${k}" aria-pressed="${CT.ui.salesSort === k}">${l}</button>`).join("")}</div>` });
    // well & call
    const byo = R.byo; const categories = [...new Set(byo.picks.map(p => p.category))];
    const pickBars = categories.map(st => { const ps = byo.picks.filter(p => p.category === st).slice(0, 8); const max = ps.length ? ps[0].byoPicks : 1; return `<div><div class="sub" style="margin:0 0 4px">${esc(st)} <span class="hint">${n1((byo.byStation.find(s => s.category === st) || { avgPerOrder: 0 }).avgPerOrder)} per order</span></div>${bars(ps.map(p => ({ ...p, tip: `<b>${esc(p.name)}</b>` + ttRows([["Picked in", pf(p.rate * 100) + " of well & call orders"], ["Orders", nf(p.byoPicks)], ["Call up-charge", p.upcharge ? $(p.upcharge) : "well (none)"], ["Pour cost", $(p.cost)], ["Menu drinks using it", p.menu]]) + srcTag() })), { k: p => p.byoPicks, label: p => p.name, max, color: p => `var(--f-${p.fam === "extras" ? "other" : p.fam})`, fmt: v => pf(v / (byo.orders || 1) * 100, 0) })}</div>`; }).join("");
    const buildsT = table("top-builds", [{ k: "n", l: "Orders", n: 1, f: nf }, { k: "label", l: "What was poured", f: (v, r) => `<span style="font-size:12.5px">${esc(v)}</span>` }, { k: "avgPrice", l: "Avg paid", n: 1, f: $ }, { k: "unitCost", l: "Cost", n: 1, f: $ }, { k: "fc", l: "Pour cost %", n: 1, f: pf, cls: r => r.fc > t ? "pc-hi" : "" }, { k: "nearest", l: "Nearest menu drink", f: (v, r) => v ? `${esc(v.name)} <span class="hint">${pf(r.sim * 100, 0)} alike</span>` : "—", raw: r => r.nearest ? r.nearest.name : "" }], byo.builds.slice(0, 20), { title: `Most common well & call orders · ${nf(byo.distinctBuilds)} distinct combinations in ${nf(byo.orders)} orders`, name: "top-well-call", maxh: 360 });
    const offT = table("off-menu", [{ k: "n", l: "Orders", n: 1, f: nf }, { k: "perStoreWeek", l: "Per restaurant-week", n: 1, f: n1 }, { k: "label", l: "What guests order at the bar", f: v => `<span style="font-size:12.5px">${esc(v)}</span>` }, { k: "avgPrice", l: "Avg paid", n: 1, f: $ }, { k: "unitCost", l: "Cost", n: 1, f: $ }, { k: "fc", l: "Pour cost %", n: 1, f: pf }, { k: "priceFor", l: `Price for ${t}%`, n: 1, f: $ }, { k: "nearest", l: "Closest on menu", f: (v, r) => v ? `${esc(v.name)} <span class="hint">${pf(r.sim * 100, 0)}</span>` : "—", raw: r => r.nearest ? r.nearest.name : "" }], byo.offMenu, { title: "Combinations not on the menu · frequent well & call orders no menu drink offers (less than 80% alike)", name: "off-menu-candidates", maxh: 360, note: "Candidates for the menu: guests already order them, the bottles are already on the back bar, and the cost is known." });
    const canT = table("cannibalization", [{ k: "name", l: "Menu drink" }, { k: "line", l: "Section" }, { k: "units", l: "Units sold", n: 1, f: nf }, { k: "lookalikes", l: "Look-alike orders", n: 1, f: nf }, { k: "ratio", l: "Overlap", n: 1, f: v => pf(v * 100, 0) }, { k: "read", l: "Reading" }], byo.cannibal, { title: "Cannibalization check · does each menu drink replace a near-identical well & call order?", name: "cannibalization", maxh: 320, note: "Look-alike orders share at least 75% of their ingredients with the menu spec. A high overlap means the drink mostly gives a name to what guests already order at the bar; a low one means it brings demand the well was not getting." });
    // attach rates
    const AL = R.attach.lines; const chs = ["all"].concat(M.channels); const ach = CT.ui.attachCh || "all";
    const heat = css("--heat");
    const attT = `<div class="ct-block"><div class="ct-head"><div class="sub">Food on the check · share of checks with this drink that also hold a small plate, entrée or dessert</div><div class="ct-tools"><div class="controls">${chs.map(c => `<button class="chip" data-act="ach:${c}" aria-pressed="${ach === c}">${c === "all" ? "All channels" : CH_LABEL[c]}</button>`).join("")}</div><button class="linkbtn" data-act="csv:attach">⤓ CSV</button></div></div>
      <div class="scroll"><table class="heat"><thead><tr><th>Drink</th><th>Checks</th>${AL.map(l => `<th>${esc(l)}</th>`).join("")}<th>Any food</th></tr></thead><tbody>${R.attach.drinks.slice(0, 16).map(a => { const src = ach === "all" ? { n: a.n, rates: a.rates } : (a.byChannel[ach] || { n: 0, rates: {} }); return `<tr><th>${esc(a.name)}</th><td style="font-family:var(--mono);font-size:11.5px">${nf(src.n)}</td>${AL.map(l => { const v = src.rates[l] || 0; return `<td ${tipAttr(`<b>${esc(a.name)} + ${esc(l)}</b>` + ttRows([["Checks with both", pf(v * 100)], ["Checks with the drink", nf(src.n)]]) + `<div class="tt-k" style="margin-top:4px">Most attached</div>` + ttList(a.top.map(x => `${esc(x.name)} <span class="tt-k">${pf(x.rate * 100, 0)}</span>`), 5) + srcTag())} style="background:rgba(${heat},${(0.06 + v * 1.6).toFixed(2)});color:${v > 0.4 ? "#fff" : "var(--ink)"}">${pf(v * 100, 0)}</td>`; }).join("")}<td style="font-family:var(--mono);font-size:11.5px">${ach === "all" ? pf(a.anyRate * 100, 0) : "—"}</td></tr>`; }).join("")}</tbody></table></div></div>`;
    CT.exports.set("attach", { name: "food-on-the-check", cols: [{ k: "name", l: "Drink" }, { k: "n", l: "Checks" }].concat(AL.map(l => ({ k: l, l }))).concat([{ k: "anyRate", l: "Any food" }]), rows: R.attach.drinks.map(a => Object.assign({ name: a.name, n: a.n, anyRate: a.anyRate }, Object.fromEntries(AL.map(l => [l, a.rates[l]])))) });
    // channel, daypart, dow
    const chT = table("channels", [{ k: "channel", l: "Channel", f: v => CH_LABEL[v] }, { k: "orders", l: "Orders", n: 1, f: nf }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "aov", l: "Avg order", n: 1, f: $ }, { k: "fc", l: "Pour cost %", n: 1, f: pf }, { k: "pkg", l: "Extras", n: 1, f: $k }, { k: "fcAll", l: "With extras", n: 1, f: pf }], R.byChannel, { title: "Channel split", name: "channel-split" });
    const cpT = R.channelPrices.length ? table("channel-prices", [{ k: "name", l: "Drink" }].concat(M.channels.map(c => ({ k: c, l: CH_LABEL[c], n: 1, f: (v, r) => v == null ? "—" : $(v) + (c !== "dine_in" && r.dine_in ? ` <span class="hint">${sgn((v - r.dine_in) / r.dine_in * 100, x => x.toFixed(0) + "%")}</span>` : "") }))), R.channelPrices.slice(0, 40), { title: "Price differences by channel · average paid per unit", name: "channel-prices", maxh: 260 }) : "";
    const dpT = R.byDaypart.length > 1 ? table("daypart", [{ k: "daypart", l: "Daypart", f: v => DP_LABEL[v] || cap(v) }, { k: "orders", l: "Checks", n: 1, f: nf }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "fc", l: "Pour cost %", n: 1, f: pf }, { k: "aov", l: "Avg order", n: 1, f: $ }], R.byDaypart, { title: "Daypart", name: "daypart" }) : `<p class="hint">No time column in sales, so dayparts are off.</p>`;
    const dowT = table("dow", [{ k: "dow", l: "Day" }, { k: "orders", l: "Orders", n: 1, f: nf }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "fc", l: "Pour cost %", n: 1, f: pf }, { k: "aov", l: "Avg order", n: 1, f: $ }], R.byDow, { title: "Day of week", name: "day-of-week" });
    const drT = table("drivers", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "n", l: "Orders", n: 1, f: nf }, { k: "aovWith", l: "Check with it", n: 1, f: $ }, { k: "aovWithout", l: "Without it", n: 1, f: $ }, { k: "lift", l: "Lift", n: 1, f: v => sgn(v, $), cls: r => r.lift < 0 ? "pc-hi" : "" }], R.drivers.slice(0, 15), { title: "Check lift · drinks whose checks are larger than the rest", name: "check-lift", maxh: 300, note: "Correlation, not cause: a $23 old fashioned sits on bigger checks partly because it costs more. Compare drinks of a similar price, and treat a lift as something to test, not a fact." });
    return `${kpis}
      <div class="controls seg" style="margin-top:4px">${[["mix", "Pour cost by restaurant"], ["me", "Menu engineering"], ["byo", "Well & call"], ["attach", "Food & checks"], ["channel", "Channel & daypart"]].map(([k, l]) => `<button class="chip" data-act="stab:${k}" aria-pressed="${(CT.ui.salesTab || "mix") === k}">${l}</button>`).join("")}</div>
      ${(CT.ui.salesTab || "mix") === "mix" ? smT + lineT + `<p class="hint">Theoretical pour cost = cost of every drink sold (the spec for menu drinks, the modifiers for well & call, at the bottle cost in force on the day) ÷ net beverage sales. Food lines are left out. The books will sit above this by the over-pour, spill and comp gap; the Reconcile tab measures it.</p>` : ""}
      ${CT.ui.salesTab === "me" ? `<div class="ops-two"><div>${chart("me-chart", "Menu engineering · popularity × contribution per drink", scatter, `Popular = at least 70% of an equal share of drink units (${nf(me.pop)}); profitable = contribution above the sales-weighted average (${$(me.cm)}). Kasavana & Smith's standard reading, on menu drinks; well & call and food are left out.`)}<div class="swatch-legend">${Object.entries(QCOL).map(([k, c]) => `<span><i class="dot" style="background:${c}"></i>${k}s ${qCount[k].length}</span>`).join("")}</div></div>${meT}</div>` : ""}
      ${CT.ui.salesTab === "byo" ? (byo.orders ? `<div class="ops-tiles">${tile(nf(byo.orders), "well & call orders")}${tile(n1(byo.avgComponents), "ingredients per order")}${tile(nf(byo.distinctBuilds), "distinct combinations")}${tile(pf(byo.builds.length ? byo.builds[0].n / byo.orders * 100 : null), "share of the single most common order")}</div><div class="ct-block"><div class="sub">Pick rates · share of well & call orders that include each bottle or mixer</div><div class="ct-pick-grid">${pickBars}</div></div>${buildsT}${offT}${canT}` : `<p class="empty">No well & call orders with modifiers in scope. Load modifiers.csv to see pick rates, the most common orders and menu candidates.</p>`) : ""}
      ${CT.ui.salesTab === "attach" ? attT + drT : ""}
      ${CT.ui.salesTab === "channel" ? chT + cpT + `<div class="ops-two">${dpT}${dowT}</div>` : ""}`;
  }

  /* ---------- Scenarios tab ---------- */
  function tabScenarios(R0, M) {
    const S = CT.scn; const scn = liveScn(); const R = scn ? results(scn) : R0;
    const t = R0.scope.target; const compsOpt = compOptions(M); const itemsOpt = itemOptions(M, i => !i.byo); const allItemsOpt = itemOptions(M);
    const name = cid => (M.comps.get(cid) || { name: cid }).name, iname = iid => (R.drinks.get(iid) || M.drinks.get(iid) || { name: iid }).name;
    const chip = (label, act) => `<span class="ct-chip">${label}<button class="linkbtn" data-act="${act}" aria-label="Remove">✕</button></span>`;
    const section = (key, title, body, count) => `<details class="ct-sec" ${CT.ui.open === key || count ? "open" : ""}><summary>${title}${count ? ` <span class="zp">${count}</span>` : ""}</summary><div class="ct-sec-body">${body}</div></details>`;
    const ups = [...M.comps.values()].filter(c => c.upcharge > 0 || S.upcharges[c.id] != null);
    const NI = CT.ui.newItem; const niCost = CM.costOf(M, NI.recipe, R0.refStore, R0.refDate, scn); const niPrice = +NI.price || 0; const cu = R0.crossUtil(NI.recipe);
    const editor = `<div class="ct-editor">
      <div class="ct-row"><input type="text" data-set="scnName" value="${esc(S.name)}" placeholder="Scenario name" style="flex:1"><button class="linkbtn" data-act="scnSave">Save</button><button class="linkbtn" data-act="scnReset">Reset</button></div>
      ${section("cost", "Bottle cost changes", `<div class="ct-row">${sel("costPick", [["", "— ingredient —"]].concat(compsOpt), CT.ui.costPick || "")}<input type="number" data-set="costVal" value="${CT.ui.costVal == null ? 15 : CT.ui.costVal}" step="1" style="width:70px" aria-label="Change">${sel("costMode", [["pct", "% change"], ["abs", "$ per pour"]], CT.ui.costMode || "pct")}<button class="linkbtn" data-act="costAdd">Add</button></div><div class="ct-chips">${Object.entries(S.costPct).map(([c, v]) => chip(`${esc(name(c))} ${sgn(v, x => x + "%")}`, `costRm:${c}`)).join("")}${Object.entries(S.costAbs).map(([c, v]) => chip(`${esc(name(c))} → ${$(v)}`, `costRmAbs:${c}`)).join("")}</div>`, Object.keys(S.costPct).length + Object.keys(S.costAbs).length)}
      ${section("price", "Repricing", `<div class="ct-row">${sel("pricePick", [["", "— drink —"]].concat(allItemsOpt), CT.ui.pricePick || "")}<input type="number" data-set="priceVal" value="${CT.ui.priceVal == null ? "" : CT.ui.priceVal}" step="0.05" style="width:80px" placeholder="new $" aria-label="New price"><button class="linkbtn" data-act="priceAdd">Add</button></div><div class="ct-chips">${Object.entries(S.prices).map(([i, v]) => chip(`${esc(iname(i))} ${$(M.itemPrice(i, R0.refStore))} → ${$(v)}`, `priceRm:${i}`)).join("")}</div>
        <div class="ct-row"><label class="hint">Demand response (elasticity)</label><input type="range" data-set="elasticity" min="-2" max="0" step="0.1" value="${S.elasticity}" style="width:120px"><output>${S.elasticity}</output></div><p class="hint">Units change by elasticity × price change: at −0.8, a 10% price rise loses 8% of units. Bar estimates run −0.5 to −1.5 (cocktails are less elastic than well drinks); set 0 to see the price effect alone.</p>`, Object.keys(S.prices).length)}
      ${section("up", "Up-charge changes", `<div class="ct-row">${sel("upPick", [["", "— ingredient —"]].concat(ups.map(c => [c.id, `${c.name} (now ${$(c.upcharge)})`])).concat([["__any", "Other ingredient…"]]), CT.ui.upPick || "")}${CT.ui.upPick === "__any" ? sel("upPick2", [["", "— ingredient —"]].concat(compsOpt), CT.ui.upPick2 || "") : ""}<input type="number" data-set="upVal" value="${CT.ui.upVal == null ? "" : CT.ui.upVal}" step="0.05" style="width:80px" placeholder="new $" aria-label="New up-charge"><button class="linkbtn" data-act="upAdd">Add</button></div><div class="ct-chips">${Object.entries(S.upcharges).map(([c, v]) => chip(`${esc(name(c))} ${$(M.comps.get(c).upcharge)} → ${$(v)}`, `upRm:${c}`)).join("")}</div>`, Object.keys(S.upcharges).length)}
      ${section("remove", "Remove drinks", `<div class="ct-row">${sel("rmPick", [["", "— drink —"]].concat(itemsOpt), CT.ui.rmPick || "")}<button class="linkbtn" data-act="rmAdd">Remove</button></div><div class="ct-chips">${S.remove.map(i => chip(esc(iname(i)), `rmRm:${i}`)).join("")}</div>
        <div class="ct-row"><label class="hint">Share of its volume that moves to other drinks in the section</label><input type="range" data-set="retention" min="0" max="1" step="0.05" value="${S.retention}" style="width:120px"><output>${Math.round(S.retention * 100)}%</output></div>`, S.remove.length)}
      ${section("swap", "Swap a ingredient", `<div class="ct-row">${sel("swapFrom", [["", "— replace —"]].concat(compsOpt), CT.ui.swapFrom || "")}<span class="hint">with</span>${sel("swapTo", [["", "— ingredient —"]].concat(compsOpt), CT.ui.swapTo || "")}<button class="linkbtn" data-act="swapAdd">Add</button></div><div class="ct-chips">${S.swaps.map((s, i) => chip(`${esc(name(s.from))} → ${esc(name(s.to))}`, `swapRm:${i}`)).join("")}</div><p class="hint">Applies to every spec and every well & call order that used it, keeping the pours.</p>`, S.swaps.length)}
      ${section("new", "New drink or limited-time offer", `<div class="ct-row"><input type="text" data-set="niName" value="${esc(NI.name)}" placeholder="Drink name" style="flex:1">${sel("niLine", M.lines.filter(l => !M.addonLines.has(l)).map(l => [l, l]), NI.line)}<input type="number" data-set="niPrice" value="${NI.price}" step="0.05" style="width:80px" aria-label="Price"></div>
        <div class="ct-row">${sel("niPick", [["", "— add a ingredient —"]].concat(compsOpt), "")}<input type="number" data-set="niQty" value="${CT.ui.niQty || 1}" step="0.25" min="0.25" style="width:64px" aria-label="Pours"><button class="linkbtn" data-act="niAdd">Add</button></div>
        <div class="ct-list">${NI.recipe.map((p, i) => `<div><span>${esc(name(p.cid))} <span class="hint">×${p.pours} · ${$(niCost.parts[i] ? niCost.parts[i].cost : 0)}</span></span><button class="linkbtn" data-act="niRm:${i}" aria-label="Remove">✕</button></div>`).join("") || `<p class="hint">Assemble it from existing ingredients, or add a new ingredient on the Data tab first.</p>`}</div>
        <div class="ct-mini">${tile($(niCost.food), "pour cost")}${tile(pf(niPrice ? niCost.food / niPrice * 100 : null), "pour cost % at " + $(niPrice), null, niPrice && niCost.food / niPrice * 100 > t ? "pc-hi" : "")}${tile($(CM.priceFor(niCost.food, t)), `price for ${t}%`)}${tile(cu.score == null ? "—" : pf(cu.score * 100, 0), "cross-utilization", `<b>Ingredients already at volume</b>` + ttRows([["At volume", `${cu.atVolume} of ${cu.ingredients}`], ["New prep load", cu.newLoad.length ? cu.newLoad.join(", ") : "none"]]))}</div>
        <div class="ct-row"><label class="hint">Expected units per restaurant-week</label><input type="number" data-set="niUnits" value="${NI.units}" min="0" style="width:70px"><label class="hint">pulled from the section</label><input type="number" data-set="niCannibal" value="${NI.cannibal}" min="0" max="100" style="width:60px"><span class="hint">%</span><label class="hint">LTO weeks</label><input type="number" data-set="niWeeks" value="${NI.weeks}" min="1" style="width:60px" placeholder="all"></div>
        <div class="ct-row"><button class="linkbtn" data-act="niAddItem" ${NI.recipe.length && NI.name ? "" : "disabled"}>Add to scenario</button><span class="hint">Volume beyond the pulled share is new demand. A limited-time drink runs for the weeks given, then stops.</span></div>
        <div class="ct-chips">${S.newItems.map((n, i) => chip(`${esc(n.name)} · ${$(n.price)} · ${n.unitsPerStoreWeek}/restaurant-week${n.weeks ? " · " + n.weeks + " wk" : ""}`, `niRmItem:${i}`)).join("")}</div>`, S.newItems.length)}
      ${section("unavail", "Supply disruption", `<div class="ct-row">${sel("unPick", [["", "— ingredient unavailable —"]].concat(compsOpt), CT.ui.unPick || "")}<button class="linkbtn" data-act="unAdd">Add</button></div><div class="ct-chips">${S.unavailable.map(c => chip(esc(name(c)), `unRm:${c}`)).join("")}</div>`, S.unavailable.length)}
    </div>`;
    // results
    const d = (a, b) => a - b; const T0 = R0.totals, T1 = R.totals;
    const kpi = (label, v0, v1, f, inv) => { const dv = v1 - v0; const good = inv ? dv < 0 : dv > 0; return tile(`${f(v1)}`, `${label} <span class="${Math.abs(dv) < 1e-9 ? "hint" : good ? "ct-up" : "ct-down"}">${f === pf ? pts(dv) : sgn(dv, f)}</span>`, `<b>${label}</b>` + ttRows([["Base", f(v0)], ["Scenario", f(v1)]])); };
    const resHead = scn ? `<div class="ops-tiles">${kpi("Net sales", T0.rev, T1.rev, $k)}${kpi("Pour cost", T0.cogs, T1.cogs, $k, true)}${kpi("Pour cost %", T0.fc, T1.fc, pf, true)}${kpi("Gross profit", T0.gp, T1.gp, $k)}${kpi("Units", T0.units, T1.units, nf)}</div>` : `<p class="hint">Add a change on the left to see its effect on every drink, the up-charges and the mix-weighted pour cost. The base is the current scope${R0.hasSales ? "" : " (no sales loaded, so volumes are not available)"}.</p>`;
    const rows = scn ? [...R.drinks.values()].map(x => { const b = R0.drinks.get(x.id); return { id: x.id, name: x.name + (x.isNew ? " (new)" : "") + (x.removed ? " (removed)" : ""), line: x.line, units0: b ? b.units : 0, units1: x.removed ? 0 : x.units, price0: b ? b.price : null, price1: x.price, food0: b ? b.food : null, food1: x.food, fc0: b ? b.fc : null, fc1: x.fc, gp0: b ? b.rev - b.cogs : 0, gp1: x.removed ? 0 : x.rev - x.cogs }; }).map(r => Object.assign(r, { dgp: r.gp1 - r.gp0, dfc: r.fc1 != null && r.fc0 != null ? r.fc1 - r.fc0 : null })).filter(r => Math.abs(r.dgp) > 0.5 || (r.dfc != null && Math.abs(r.dfc) > 0.05) || Math.abs(r.units1 - r.units0) > 0.5).sort((a, b) => Math.abs(b.dgp) - Math.abs(a.dgp)) : [];
    const itemT = scn ? table("scenario-drinks", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "price1", l: "Price", n: 1, f: (v, r) => r.price0 != null && Math.abs(r.price0 - v) > 0.001 ? `${$(r.price0)} → ${$(v)}` : $(v) }, { k: "food1", l: "Pour cost", n: 1, f: (v, r) => r.food0 != null && Math.abs(r.food0 - v) > 0.001 ? `${$(r.food0)} → ${$(v)}` : $(v) }, { k: "fc1", l: "Pour cost %", n: 1, f: (v, r) => `${pf(v)} <span class="hint">${pts(r.dfc)}</span>`, cls: r => r.fc1 > t ? "pc-hi" : "" }, { k: "units1", l: "Units", n: 1, f: (v, r) => `${nf(v)} <span class="hint">${sgn(v - r.units0, nf)}</span>` }, { k: "dgp", l: "Gross profit change", n: 1, f: v => sgn(v, $0), cls: r => r.dgp < 0 ? "pc-hi" : "" }], rows, { title: `Affected drinks · ${rows.length}`, name: "scenario-drinks", maxh: 380 }) : "";
    const upT = scn && R.upcharges.length ? table("scenario-up", [{ k: "name", l: "Up-charged ingredient" }, { k: "upcharge", l: "Up-charge", n: 1, f: $ }, { k: "incremental", l: "Incremental cost", n: 1, f: $ }, { k: "margin", l: "Margin per add", n: 1, f: (v, r) => { const b = R0.upcharges.find(u => u.cid === r.cid); return b && Math.abs(b.margin - v) > 0.001 ? `${$(b.margin)} → ${$(v)}` : $(v); }, cls: r => r.margin < 0 ? "pc-hi" : "" }, { k: "picks", l: "Picks", n: 1, f: nf }, { k: "marginTotal", l: "Margin in scope", n: 1, f: $0 }], R.upcharges, { title: "Up-charges after the change", name: "scenario-upcharges" }) : "";
    const disT = R.disruption ? R.disruption.map(dd => `<div class="ct-block"><div class="sub">If ${esc(dd.name)} is unavailable</div><div class="ops-tiles">${tile($k(dd.revAtRisk), "sales touching it")}${tile(pf(dd.share * 100), "share of sales in scope")}${tile(dd.drinks.length, "menu drinks using it")}${tile(nf(dd.byoOrders), "well & call orders picking it")}</div>${table("disruption-" + dd.cid, [{ k: "name", l: "Menu drink" }, { k: "units", l: "Units", n: 1, f: nf }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "share", l: "Share of sales", n: 1, f: v => pf(v * 100) }], dd.drinks, { name: "disruption-" + dd.cid })}</div>`).join("") : "";
    const ltoT = scn && S.newItems.length ? `<div class="ct-block"><div class="sub">New drinks in this scenario</div>${table("scenario-new", [{ k: "name", l: "Drink" }, { k: "price", l: "Price", n: 1, f: $ }, { k: "food", l: "Pour cost", n: 1, f: $ }, { k: "fc", l: "Pour cost %", n: 1, f: pf }, { k: "units", l: "Projected units", n: 1, f: nf }, { k: "weeks", l: "Weeks", n: 1, f: v => n1(v) }, { k: "cannibal", l: "Pulled from line", n: 1, f: v => pf(v * 100, 0) }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "gp", l: "Gross profit", n: 1, f: $k }], S.newItems.map(n => { const x = R.drinks.get(n.id); return x ? { name: x.name, price: x.price, food: x.food, fc: x.fc, units: x.units, weeks: x.weeks, cannibal: x.cannibal, rev: x.rev, gp: x.rev - x.cogs } : null; }).filter(Boolean), { name: "scenario-new-drinks" })}</div>` : "";
    // saved and compare
    const savedT = CT.saved.length ? `<div class="ct-block"><div class="ct-head"><div class="sub">Saved scenarios · tick up to three to compare</div><div class="ct-tools">${CT.compare.size ? `<button class="linkbtn" data-act="cmpCsv">⤓ Comparison CSV</button><button class="linkbtn" data-act="cmpJson">⤓ Scenarios JSON</button>` : ""}</div></div>
      <div class="ct-saved">${CT.saved.map((s, i) => `<label class="ct-chip"><input type="checkbox" data-set="cmp:${i}" ${CT.compare.has(i) ? "checked" : ""}> ${esc(s.name)}<button class="linkbtn" data-act="scnLoad:${i}">Open</button><button class="linkbtn" data-act="scnDel:${i}" aria-label="Delete">✕</button></label>`).join("")}</div>
      ${CT.compare.size ? compareTable(R0) : ""}</div>` : "";
    const ladderT = table("ladder", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "price", l: "Price", n: 1, f: $ }, { k: "formula", l: "Well & call formula", n: 1, f: (v, r) => `${$(v)} <span class="hint">${$(r.base)}${r.ups.map(u => " + " + $(u.up)).join("")}</span>` }, { k: "gap", l: "Gap", n: 1, f: v => sgn(v, $), cls: r => Math.abs(r.gap) >= 0.05 ? "pc-hi" : "" }, { k: "flag", l: "Reading", f: (v, r) => flag(v, v === "On the ladder" ? "ok" : "warn") + (r.overlap ? ` <span class="hint">same formula as ${esc(r.overlap.join(", "))}</span>` : "") }], R.ladder, { title: "Price ladder check · each menu drink against the well & call base plus the call up-charges of its spirits", name: "price-ladder", maxh: 320, note: "A menu drink below the ladder is cheaper than calling the same bottles at the well; above it carries a premium for the recipe, which is normal. Drinks with the same formula but different prices overlap." });
    return `<div class="ct-grid scn"><div>${editor}${savedT}</div><div>${resHead}${itemT}${ltoT}${upT}${disT}${ladderT}</div></div>`;
  }
  function compareTable(R0) {
    const cols = [{ name: "Base", R: R0 }].concat([...CT.compare].slice(0, 3).map(i => CT.saved[i]).filter(Boolean).map(s => ({ name: s.name, R: results(s.scn) })));
    const rows = [["Net sales", r => $k(r.totals.rev)], ["Pour cost", r => $k(r.totals.cogs)], ["Pour cost %", r => pf(r.totals.fc)], ["With extras", r => pf(r.totals.fcAll)], ["Gross profit", r => $k(r.totals.gp)], ["Units", r => nf(r.totals.units)], ["Drinks over target", r => r.itemList.filter(x => !x.addon && !x.byo && x.fc > r.scope.target).length], ["Call up-charges with negative margin", r => r.upcharges.filter(u => u.margin < 0).length]];
    CT.exports.set("compare", { name: "scenario-comparison", cols: [{ k: "metric", l: "Metric" }].concat(cols.map((c, i) => ({ k: "c" + i, l: c.name }))), rows: rows.map(([l, f]) => Object.assign({ metric: l }, Object.fromEntries(cols.map((c, i) => ["c" + i, f(c.R)])))) });
    return `<div class="scroll"><table class="mini gtable"><thead><tr><th></th>${cols.map(c => `<th class="n">${esc(c.name)}</th>`).join("")}</tr></thead><tbody>${rows.map(([l, f]) => `<tr><td>${l}</td>${cols.map(c => `<td class="n">${f(c.R)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  /* ---------- Operations tab ---------- */
  function tabOps(R, M) {
    const t = R.scope.target; const O = R.ops;
    const storeT = table("restaurants", [{ k: "name", l: "Restaurant", f: (v, r) => `<b style="font-weight:600">${esc(v)}</b> <span class="hint">${esc(r.region)}</span>` }, { k: "orders", l: "Orders", n: 1, f: nf }, { k: "rev", l: "Sales", n: 1, f: $k }, { k: "aov", l: "Avg order", n: 1, f: $ }, { k: "fc", l: "Pour cost %", n: 1, f: pf, cls: r => r.fc > t ? "pc-hi" : "" }, { k: "fcAll", l: "With extras", n: 1, f: pf }, { k: "gp", l: "Gross profit", n: 1, f: $k }, { k: "trend", l: "Pour cost by month", f: (v, r) => { const s = O.trend.restaurants.find(x => x.restaurant === r.restaurant); return s ? spark(s.points) : ""; }, raw: r => { const s = O.trend.restaurants.find(x => x.restaurant === r.restaurant); return s ? s.points.map(p => p == null ? "" : p.toFixed(1)).join(" | ") : ""; } }], R.byStore, { title: "Restaurants side by side", name: "restaurants" });
    const regT = O.regional.drinks.length ? table("regional-drinks", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "units", l: "Units", n: 1, f: nf }, { k: "restaurants", l: "Sold at", f: v => esc(v.join(", ")), raw: r => r.restaurants.join("; ") }], O.regional.drinks, { title: "Drinks sold at some restaurants only", name: "restaurant-drinks", maxh: 220 }) : "";
    const priceT = O.regional.prices.length ? table("restaurant-prices", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "base", l: "Default price", n: 1, f: $ }, { k: "restaurants", l: "Restaurant prices", f: v => v.map(s => `${esc(s.name)} ${$(s.price)}`).join(" · "), raw: r => r.restaurants.map(s => `${s.name}: ${s.price}`).join("; ") }], O.regional.prices, { title: "Restaurant pricing · drinks with a restaurant-specific price", name: "restaurant-prices", maxh: 260 }) : "";
    const prepT = table("prep-load", [{ k: "name", l: "Drink", f: (v, r) => `<b style="font-weight:600">${esc(v)}</b>${r.isNew ? ' <span class="zp">new</span>' : ""}` }, { k: "line", l: "Section" }, { k: "ingredients", l: "Ingredients", n: 1 }, { k: "categories", l: "Categories", n: 1 }, { k: "steps", l: "Prep steps", n: 1, f: nf }, { k: "crossUtil", l: "Cross-utilization", n: 1, f: v => pf(v * 100, 0) }, { k: "exclusive", l: "Only this drink needs", f: v => v.length ? esc(v.join(", ")) : "—", raw: r => r.exclusive.join("; ") }, { k: "units", l: "Units", n: 1, f: nf }], O.prep, { title: "Prep load per drink · what each drink makes the bar carry", name: "prep-load", maxh: 380, note: "Prep steps add up each ingredient's prep_steps (default 1): juicing, syrups, infusions. Cross-utilization is the share of a drink's ingredients that already move at volume elsewhere (on 2+ menu drinks, or at least 20 pours per restaurant-week at the well). “Only this drink needs” lists ingredients nothing else moves: the bottles and prep that disappear if the drink does." });
    const cuItem = CT.ui.crossItem ? R.drinks.get(CT.ui.crossItem) : null; const cu = cuItem ? R.crossUtil(cuItem.parts.map(p => ({ cid: p.cid, pours: p.pours }))) : null;
    const cuBox = `<div class="ct-block"><div class="sub">Cross-utilization check · any drink or candidate</div><div class="ct-row">${sel("crossItem", [["", "— pick an drink —"]].concat([...R.drinks.values()].filter(x => x.parts.length).map(x => [x.id, x.name + (x.isNew ? " (new)" : "")])), CT.ui.crossItem)}</div>${cu ? `<div class="ops-tiles">${tile(pf(cu.score * 100, 0), "of its ingredients already run at volume")}${tile(cu.atVolume + " of " + cu.ingredients, "ingredients at volume")}${tile(cu.newLoad.length, "new bottles or prep", cu.newLoad.length ? `<b>New to stock or prep</b>` + ttList(cu.newLoad.map(esc)) : "")}</div>` : `<p class="hint">Candidates built on the Scenarios tab show up here too.</p>`}</div>`;
    const wasteRows = O.waste.filter(w => w.wasteCost > 0 || (!O.hasWaste && w.perishable)).sort((a, b) => b.wasteCost - a.wasteCost || b.perStoreWeek - a.perStoreWeek);
    const wasteT = table("waste", [{ k: "name", l: "Ingredient" }, { k: "category", l: "Category" }, { k: "perishable", l: "Perishable", f: v => v ? "yes" : v === false ? "no" : "—" }, { k: "usage", l: "Theoretical use, pours", n: 1, f: nf }, { k: "wasteQty", l: "Wasted pours", n: 1, f: nf }, { k: "wastePct", l: "Waste %", n: 1, f: pf, cls: r => r.wastePct > 10 ? "pc-hi" : "" }, { k: "wasteCost", l: "Waste cost", n: 1, f: $0 }, { k: "wastePerWeek", l: "Per week", n: 1, f: $0 }, { k: "reasons", l: "Reasons", f: v => v.length ? v.slice(0, 3).map(([k, n]) => `${esc(k)} ${nf(n)}`).join(", ") : "—", raw: r => r.reasons.map(([k, n]) => k + ":" + n).join("; ") }], wasteRows, { title: O.hasWaste ? `Waste exposure · ${$0(O.wasteTotal)} logged in scope, ${pf(O.wastePctCogs)} of theoretical pour cost` : "Waste exposure · perishable ingredients (no waste log loaded)", name: "waste-exposure", maxh: 380, note: O.hasWaste ? "Waste cost = logged pours × pour cost at the time. Waste % is wasted ÷ (used + wasted). Dead juice, spoiled garnish, spills, breakage and comps all belong in the log." : "Load waste.csv (restaurant, date, ingredient, pours) to replace the flat waste assumption with what the bar actually pours out." });
    const lowT = table("low-movers", [{ k: "name", l: "Ingredient" }, { k: "category", l: "Category" }, { k: "rate", l: "Pick rate", n: 1, f: v => pf(v * 100) }, { k: "perStoreWeek", l: "Pours per restaurant-week", n: 1, f: n1 }, { k: "wasteCost", l: "Waste cost", n: 1, f: v => O.hasWaste ? $0(v) : "—" }, { k: "wastePct", l: "Waste %", n: 1, f: v => O.hasWaste ? pf(v) : "—" }], O.lowMovers, { title: "Low movers · bottles under a 3% pick rate that no menu drink uses", name: "low-movers", note: "Carrying cost shows when a waste log is loaded. These are the first bottles to delist, or to feature in a menu drink." });
    const tvaT = O.hasInventory ? table("theoretical-actual", [{ k: "name", l: "Ingredient" }, { k: "category", l: "Category" }, { k: "theoretical", l: "Theoretical use, pours", n: 1, f: nf }, { k: "actual", l: "Actual use, pours", n: 1, f: nf }, { k: "variance", l: "Variance", n: 1, f: v => sgn(v, nf) }, { k: "variancePct", l: "Variance %", n: 1, f: v => pf(v), cls: r => r.variancePct > 10 ? "pc-hi" : "" }, { k: "varianceCost", l: "At cost", n: 1, f: v => sgn(v, $0) }, { k: "read", l: "Reading" }], O.tva, { title: "Theoretical vs actual usage · pours implied by sales against inventory counts", name: "theoretical-vs-actual", maxh: 360, note: "Actual = beginning count + purchases − ending count, converted from bottles to pours. Over 10% above theoretical points at over-pouring, spillage or unlogged comps." }) : `<p class="hint">Load inventory.csv (begin, purchases, end per restaurant, month and ingredient, in bottles or pours) to compare usage implied by sales with what was actually poured.</p>`;
    const trendT = O.trend.drinks.length ? table("trend", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "cmFirst", l: `Contribution ${monthName(O.trend.months[0])}`, n: 1, f: $ }, { k: "cmLast", l: monthName(O.trend.months[O.trend.months.length - 1]), n: 1, f: $ }, { k: "cmDelta", l: "Change", n: 1, f: v => sgn(v, $), cls: r => r.slipping ? "pc-hi" : "" }, { k: "fcDelta", l: "Pour cost %", n: 1, f: (v, r) => `${pf(r.fcFirst)} → ${pf(r.fcLast)}` }, { k: "unitsLast", l: "Units", n: 1, f: (v, r) => `${nf(r.unitsFirst)} → ${nf(v)}` }, { k: "slipping", l: "", f: v => v ? flag("slipping", "warn") : "" }], O.trend.drinks, { title: `Trend · margin per drink, first month against last (${O.trend.drinks.filter(x => x.slipping).length} slipping)`, name: "margin-trend", maxh: 360, note: "Slipping = contribution down more than 10¢ or pour cost up more than 2 points. Cost versions and price changes both show here." }) : `<p class="hint">Trend needs at least two months in scope.</p>`;
    return `<div class="controls seg">${[["restaurants", "Restaurants & regions"], ["prep", "Prep load"], ["waste", "Waste & low movers"], ["tva", "Theoretical vs actual"], ["trend", "Trend"]].map(([k, l]) => `<button class="chip" data-act="otab:${k}" aria-pressed="${(CT.ui.opsTab || "restaurants") === k}">${l}</button>`).join("")}</div>
      ${(CT.ui.opsTab || "restaurants") === "restaurants" ? storeT + regT + priceT : ""}
      ${CT.ui.opsTab === "prep" ? prepT + cuBox : ""}
      ${CT.ui.opsTab === "waste" ? wasteT + lowT : ""}
      ${CT.ui.opsTab === "tva" ? tvaT : ""}
      ${CT.ui.opsTab === "trend" ? trendT : ""}`;
  }

  /* ---------- Reconcile tab ---------- */
  function tabRecon(R, M) {
    const rc = R.reconcile; const RC = CM.RECON;
    const tests = CM.selfTest(); const pass = tests.filter(x => x.ok).length;
    const verdictTile = tile(rc.overall || "—", `overall · ${rc.pass || 0} of ${rc.judged || 0} restaurant-months pass`, null, rc.overall === "Pass" ? "" : rc.overall === "Fail" ? "pc-hi" : "");
    const rows = rc.rows || [];
    const tbl = table("reconcile", [{ k: "name", l: "Restaurant" }, { k: "month", l: "Month", f: v => monthName(v) }, { k: "rev", l: "Sales (file)", n: 1, f: $0 }, { k: "books", l: "Sales (books)", n: 1, f: $0 }, { k: "coverage", l: "Costed", n: 1, f: v => v == null ? "—" : pf(v * 100) }, { k: "theo", l: "Theoretical %", n: 1, f: pf }, { k: "theoW", l: "+ logged waste", n: 1, f: pf }, { k: "actual", l: "Books %", n: 1, f: pf }, { k: "gap", l: "Gap", n: 1, f: pts, cls: r => r.verdict === "Fail" ? "pc-hi" : "" }, { k: "verdict", l: "Verdict", f: v => flag(v, VERDICT[v]) }, { k: "note", l: "Why", f: v => `<span class="hint">${esc(v || "")}</span>` }], rows, { title: "Theoretical pour cost against the books · by restaurant and month", name: "reconciliation", empty: rc.note || "Load actuals.csv (restaurant, month, beverage cost from the P&L) to run the test." });
    return `<div class="ops-tiles">${verdictTile}${tile(pf(R.totals.fc), "theoretical pour cost in scope")}${tile(pf(R.coverage * 100), "of beverage sales costed", `<b>Coverage</b><div class="tt-k">Drink lines with a spec or modifiers. Below ${RC.coverage * 100}% the test is not assessable.</div>`)}${tile(`${pass}/${tests.length}`, "hand-calculated test cases pass", `<b>Self-test</b>` + ttList(tests.map(x => `${x.ok ? "✓" : "✗"} ${esc(x.name)}`), 20), pass === tests.length ? "" : "pc-hi")}</div>
      ${tbl}
      <div class="ops-two">
        <div class="ct-block"><div class="sub">What counts as a pass · defined before the test</div>
          <ul class="ct-notes">
            <li><b>Coverage first.</b> At least ${RC.coverage * 100}% of the month's net beverage sales must be costed (every drink has a spec, every well & call line has its modifiers). Otherwise the result is “not assessable”, not a fail.</li>
            <li><b>Sales must agree.</b> The sales file and the books must be within ${RC.salesTol * 100}% of each other for the month; if not, fix the extract before judging cost.</li>
            <li><b>Pass:</b> books pour cost % is ${RC.pass[0]} to ${RC.pass[1]} points above theoretical. The books include over-pours, spills, comps and shrink; theoretical does not, so a positive gap is the expected result. Bars run a wider gap than kitchens.</li>
            <li><b>Review:</b> gap between ${RC.review[0]} and ${RC.pass[0]}, or between ${RC.pass[1]} and ${RC.review[1]} points. Check the waste log, free pouring, comps and whether purchases were cut off at month end.</li>
            <li><b>Fail:</b> theoretical above the books by more than ${-RC.review[0]} points (specs, pours or costs are overstated) or the books more than ${RC.review[1]} points above theoretical (something is missing from costs or specs, or there is a real over-pouring or shrink problem).</li>
            <li>With a waste log loaded, “+ logged waste” shows how much of the gap the log already explains.</li>
          </ul></div>
        <div class="ct-block"><div class="sub">Method, in one paragraph</div>
          <p class="hint">Every sales line is costed from its spec (menu drinks) or its modifiers (well & call) at the bottle cost in force on that day, after yield: pour cost = bottle cost ÷ (bottle size × yield) × pour size. Theoretical pour cost % = that cost ÷ net beverage sales; food lines are left out. Extras are tracked separately. Call up-charge margins compare a called brand with the well of its category. Scenarios re-run the same engine with changed costs, prices, specs or volumes. Formulas and assumptions are written up in <code>docs/methodology.md</code>; the hand-calculated cases above are in <code>tests/costmodel.test.js</code> and run after every change.</p>
          <p class="hint">${CT.src === "sample" ? "The sample books were generated 8–10% above theoretical, so eight restaurant-months pass by design and one (Zaytinya, September) was made to fail, to show what a fail looks like." : "Your actuals file drives this table."}</p>
        </div>
      </div>`;
  }

  /* ---------- JOBS ---------- */
  /* --- explanation layer: every figure can say where it comes from, and assumptions are flagged --- */
  const SRC = { cost: "ingredients.csv (bottle cost ÷ usable per bottle × pour) + recipes.csv / modifiers.csv", sales: "sales.csv", mods: "modifiers.csv", drinks: "drinks.csv", act: "actuals.csv", waste: "waste.csv", inv: "inventory.csv" };
  // X(value, {l: label, f: formula, v: [[name, value]], src, asm}) → a hoverable figure
  const X = (val, o) => `<span class="x${o.asm ? " x-asm" : ""}" tabindex="0" ${tipAttr(`<b>${esc(o.l || "")}</b>${o.f ? `<div class="x-f">${esc(o.f)}</div>` : ""}${o.v ? ttRows(o.v.map(([k, v]) => [esc(k), v])) : ""}${o.src ? `<div class="tt-k" style="margin-top:4px">From: ${esc(o.src)}</div>` : ""}${o.asm ? `<div class="x-note">Assumption: ${esc(o.asm)}</div>` : `<div class="tt-hint">Data, not an assumption</div>`}`)}>${val}</span>`;
  const reading = (html, kind) => `<p class="reading ${kind || ""}">${html}</p>`;
  const asmBadge = what => `<span class="asm-badge" tabindex="0" ${tipAttr(`<b>Assumption</b><div class="tt-k">${esc(what)}</div>`)}>assumption</span>`;
  const stepper = (steps, cur, prefix) => `<ol class="steps">${steps.map((st, i) => `<li class="${i + 1 === cur ? "cur" : i + 1 < cur ? "done" : ""}"><button data-act="${prefix}:step:${i + 1}"><span>${i + 1}</span>${esc(st)}</button></li>`).join("")}</ol>`;
  const stepNav = (prefix, cur, n, next) => `<div class="step-nav">${cur > 1 ? `<button class="linkbtn" data-act="${prefix}:step:${cur - 1}">← Back</button>` : ""}${cur < n ? `<button class="tour-next" data-act="${prefix}:step:${cur + 1}">${next || "Next"} →</button>` : ""}</div>`;
  const jobHead = (title, lede) => `<div class="job-head"><h2>${title}</h2><p class="hint">${lede}</p></div>`;
  const delta = (v, f, inv) => v == null || Math.abs(v) < 1e-9 ? `<span class="hint">no change</span>` : `<span class="${(inv ? v < 0 : v > 0) ? "ct-up" : "ct-down"}">${f === pf ? pts(v) : sgn(v, f)}</span>`;
  const lastMonths = (M, n) => M.months.slice(-n);
  const storeName = (M, id) => (M.restaurants.get(id) || { name: id }).name;
  const monthsLabel = ms => ms.length === 1 ? monthName(ms[0]) : ms.length ? `${monthName(ms[0])} to ${monthName(ms[ms.length - 1])}` : "all data";
  const fmtList = (arr, max) => arr.length <= max ? arr.join(", ") : arr.slice(0, max).join(", ") + ` and ${arr.length - max} more`;
  // one-page summary: shown in the drawer, printed (or saved as PDF) from there
  function printSummary() { const el = dEl("ct-print"); if (!el || !el.innerHTML) return; window.print(); }
  function showSummary(title, html) {
    let el = dEl("ct-print"); if (!el) { el = document.createElement("div"); el.id = "ct-print"; document.body.appendChild(el); }
    const stamp = `${D_LABEL()} · ${new Date().toISOString().slice(0, 10)}`;
    el.innerHTML = `<div class="sum"><h1>${esc(title)}</h1><div class="sum-meta">${esc(stamp)}</div>${html}</div>`;
    openDrawer({ type: "ct", title, html: `<div class="sum-tools"><button class="tour-next" data-act="print:sum">Print / save as PDF</button><span class="hint">${esc(stamp)}</span></div><div class="sum">${html}</div>` });
  }
  const D_LABEL = () => CT.src === "own" ? "Your data" : "Sample data (synthetic)";
  const sumTable = (cols, rows) => `<table class="sum-t"><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  function go(arg) {
    const [job, ...rest] = arg.split(":"); const a = rest.join(":");
    if (job === "price") { const f = CT.flow.price; if (rest[0] === "up" && rest[1]) { const c = data().M.comps.get(rest[1]); if (c) { f.ups[rest[1]] = c.upcharge; f.step = 2; } } else if (rest[0] === "drink" && rest[1]) { const p = data().M.itemPrice(rest[1], null); if (p != null) { f.prices[rest[1]] = p; f.step = 2; } } else f.step = 1; CT.job = "price"; }
    else if (job === "review") { CT.flow.review.step = +rest[0] || 1; CT.job = "review"; }
    else if (job === "menu") { CT.job = "menu"; if (rest[0]) { CT.flow.menu.type = rest[0]; CT.flow.menu.def = mcBlank(rest[0]); CT.flow.menu.step = 2; } }
    else if (job === "ideas") CT.job = "ideas";
    else if (job === "advise") { const f = CT.flow.advise; if (rest[0] === "cost" && rest[1]) { f.type = "cost"; f.cid = rest[1]; f.pct = +rest[2] || 15; } else if (rest[0] === "general") f.type = "general"; f.pick = null; f.step = rest[0] ? 2 : 1; if (!advTrigger(data().M)) f.step = 1; CT.job = "advise"; }
    else if (job === "explore") { CT.job = "explore"; CT.tab = rest[0] || "costs"; if (rest[1]) { if (CT.tab === "costs") CT.ui.costTab = rest[1]; if (CT.tab === "sales") CT.ui.salesTab = rest[1]; if (CT.tab === "ops") CT.ui.opsTab = rest[1]; } }
    else CT.job = job;
    render(); const spirit = dEl("main"); if (spirit) spirit.scrollTop = 0;
  }

  /* ---------- Home: what needs attention ---------- */
  function jobHome(M) {
    const t = CT.scope.target; const last = M.months[M.months.length - 1], prev = M.months[M.months.length - 2];
    if (!M.sales.length) return jobHead("Home", "No sales loaded yet, so there is nothing to flag.") + `<div class="job-cards">${jobCards(M)}</div>` + reading(`Load sales (and modifiers) on the <button class="linkbtn" data-act="job:data">Data</button> tab, or switch to the sample to see every job working.`);
    const Rl = resultsFor({ months: [last] }), Rp = prev ? resultsFor({ months: [prev] }) : null, Ra = resultsFor({});
    const over = Rl.byStore.filter(s => s.fc > t), restaurants = Rl.byStore.slice().sort((a, b) => b.fc - a.fc);
    const thin = Rl.upcharges.filter(u => u.margin < 0 || u.margin < 0.25 * u.upcharge).sort((a, b) => a.margin - b.margin);
    const slip = Ra.ops.trend.drinks.filter(x => x.slipping);
    const rec = Rl.reconcile.rows.filter(r => r.month === last); const recBad = rec.filter(r => r.verdict === "Fail" || r.verdict === "Review");
    const sug = CM.suggest(M, Ra, t).slice(0, 1)[0];
    let best = null; try { const key = "H|" + CT.src + "|" + last + "|" + t; best = CT.cache.get(key); if (!best) { best = CM.recommend(M, { months: new Set([last]), target: t }, { type: "general" }, { verify: false }); CT.cache.set(key, best); } } catch (e) { console.error(e); }
    const top = best && best.candidates[0];
    const fcX = X(pf(Rl.totals.fc), { l: `Theoretical pour cost · ${monthName(last)}`, f: "pour cost of everything sold ÷ net sales", v: [["Pour cost", $0(Rl.totals.cogs)], ["Net sales", $0(Rl.totals.rev)], ["Target", pf(t, 0)]], src: SRC.cost + " + " + SRC.sales });
    const card = (cls, title, big, text, link, label) => `<div class="flag-card ${cls}"><div class="fc-head">${title}</div><div class="fc-big">${big}</div><div class="fc-text">${text}</div><button class="card-link" data-act="${link}">${label} →</button></div>`;
    const cards = [
      card(over.length ? "warn" : "ok", `Pour cost vs ${pf(t, 0)} target · ${monthName(last)}`, fcX, over.length ? `${over.length} of ${Rl.byStore.length} restaurants over target: ${esc(fmtList(over.map(s => `${s.name} ${pf(s.fc)}`), 3))}.` : `Every restaurant under target${Rp ? `; ${pts(Rl.totals.fc - Rp.totals.fc)} vs ${monthName(prev)}` : ""}.`, "go:review:1", "Monthly review"),
      card(thin.length ? "warn" : "ok", "Call up-charges covering their cost", thin.length ? esc(thin[0].name) : "All covered", thin.length ? `${esc(thin[0].name)} earns ${X($(thin[0].margin), { l: "Margin per call", f: "up-charge − incremental cost", v: [["Up-charge", $(thin[0].upcharge)], ["Pour cost", $(thin[0].cost)], [thin[0].baseMain != null ? "Well it replaces" : "Pure add", thin[0].baseMain != null ? $(thin[0].baseMain) : "—"]], src: SRC.cost })} on a ${$(thin[0].upcharge)} call up-charge${thin.length > 1 ? `; ${thin.length - 1} more under 25% margin` : ""}.` : `Every call up-charge keeps at least 25% of what the guest pays.`, thin.length ? `go:price:up:${esc(thin[0].cid)}` : "go:price", thin.length ? "Test a new up-charge" : "Price change"),
      card(slip.length ? "warn" : "ok", "Drinks whose margin slipped", slip.length, Ra.ops.trend.months.length < 2 ? "Needs two months of sales." : slip.length ? `Contribution per unit down since ${monthName(Ra.ops.trend.months[0])}: ${esc(fmtList(slip.map(x => x.name), 3))}.` : "No drink lost more than 10¢ of contribution.", "go:review:3", "See where to look"),
      card(!rec.length ? "quiet" : recBad.length ? "bad" : "ok", `Reconciliation · ${monthName(last)}`, !rec.length ? "No books" : recBad.length ? recBad[0].verdict : "Pass", !rec.length ? "Load actuals.csv to check theoretical pour cost against the books." : recBad.length ? `${esc(fmtList(recBad.map(r => `${r.name} (${r.verdict}, ${pts(r.gap)})`), 2))}; ${rec.length - recBad.length} of ${rec.length} pass.` : `All ${rec.length} restaurant-months pass: the books sit ${pts(d3.mean(rec, r => r.gap))} above theoretical, inside the ${CM.RECON.pass[0]}–${CM.RECON.pass[1]} point band.`, "go:explore:recon", "Reconcile"),
      card(top ? "idea" : "quiet", "Best move right now", top ? sgn(top.dGp, $0) : "—", top ? `${esc(top.label)} · ${top.confidence === "data" ? "arithmetic on the data" : esc(top.assumes || "rests on the demand assumption")}${top.culinary ? "; needs bar-team sign-off" : ""}.` : "Nothing improves on today under the default rules.", "go:advise:general", "What to do"),
      card("idea", "Best new-drink candidate", sug ? `${sug.perStoreWeek.toFixed(0)}/restaurant-week` : "—", sug ? `${esc(sug.label)}: guests already order it ${sug.perStoreWeek.toFixed(0)} times per restaurant-week at the bar, ${pf(sug.fc)} pour cost at ${$(sug.avgPrice)}; nothing on the menu is more than ${Math.round(sug.sim * 100)}% alike.` : "Needs modifiers to see what guests call at the bar.", "go:ideas", "New drink ideas"),
    ];
    return jobHead("Home", `What needs attention in ${monthName(last)}, and where to go next. Hover any figure for the formula, the values and the source file; amber means an assumption.`) + `<div class="flag-cards">${cards.join("")}</div>
      <div class="sub">Start a job</div><div class="job-cards">${jobCards(M)}</div>
      ${reading(`<b>In a hurry?</b> To answer “should we raise the Casamigos call up-charge?”: Home → the up-charge card → set a new up-charge and a demand assumption → check the ladder → compare. About three minutes.`)}`;
  }
  const jobCards = M => [["advise", "What to do", "Describe a bottle cost change, a shortage, a new bottle or a planned price; get the best moves and a plan."], ["review", "Monthly review", "Where pour cost landed, what moved it, which restaurants and drinks to look at, one-page summary."], ["menu", "Evaluate a menu change", "New drink, limited-time drink, pour change, swap or removal: cost, margin, ripple across the menu and the back bar."], ["price", "Price change simulation", "New prices or call up-charges, volume impact under a stated demand assumption, ladder check, compare options."], ["ideas", "Suggest new menu drinks", "What guests already order at the bar, bottles you already stock, margin at a target price."]].map(([k, l, d]) => `<button class="job-card" data-act="go:${k}"><b>${l}</b><span>${d}</span></button>`).join("");

  /* ---------- Monthly review ---------- */
  function rvAct(arg) { const [k, v] = arg.split(":"); const f = CT.flow.review; if (k === "step") f.step = +v; if (k === "restaurant") { const all = [...data().M.restaurants.keys()]; const s = f.restaurants ? new Set(f.restaurants) : new Set(all); if (s.has(v)) { if (s.size > 1) s.delete(v); } else s.add(v); f.restaurants = s.size === all.length ? null : s; } if (k === "summary") rvSummary(); render(); }
  function rvSet(k, v) { if (k === "month") { CT.flow.review.month = v; render(); } }
  function rvScope(M) { const f = CT.flow.review; const month = f.month && M.months.includes(f.month) ? f.month : M.months[M.months.length - 1]; const i = M.months.indexOf(month); return { month, prev: i > 0 ? M.months[i - 1] : null, restaurants: f.restaurants, R: resultsFor({ months: [month], restaurants: f.restaurants ? [...f.restaurants] : null }), Rp: i > 0 ? resultsFor({ months: [M.months[i - 1]], restaurants: f.restaurants ? [...f.restaurants] : null }) : null, Ra: resultsFor({ restaurants: f.restaurants ? [...f.restaurants] : null }) };
  }
  function jobReview(M) {
    if (!M.sales.length) return jobHead("Monthly review", "Needs sales.") + reading("Load a sales file on the Data tab.");
    const f = CT.flow.review; const S = rvScope(M); const { month, prev, R, Rp, Ra } = S; const t = CT.scope.target;
    const head = jobHead("Monthly review", "Where pour cost landed, what moved it, and where to look. Four steps; export a one-page summary at the end.") + `<div class="ct-scope">${sel("rv:month", M.months.map(m => [m, monthName(m)]), month)}${[...M.restaurants.values()].length > 1 ? `<span class="label">Restaurants</span>${[...M.restaurants.values()].map(st => `<button class="chip" data-act="rv:restaurant:${esc(st.id)}" aria-pressed="${!f.restaurants || f.restaurants.has(st.id)}">${esc(st.name)}</button>`).join("")}` : ""}</div>` + stepper(["Where pour cost landed", "What moved it", "Where to look", "Summary"], f.step, "rv");
    let body = "";
    if (f.step === 1) {
      const rec = R.reconcile.rows.filter(r => r.month === month); const verdicts = rec.map(r => r.verdict);
      const vsT = R.totals.fc - t, vsP = Rp ? R.totals.fc - Rp.totals.fc : null;
      body = `<div class="ops-tiles">
        ${tile(X(pf(R.totals.fc), { l: "Theoretical pour cost", f: "pour cost of everything sold ÷ net sales", v: [["Pour cost", $0(R.totals.cogs)], ["Net sales", $0(R.totals.rev)]], src: SRC.cost + " + " + SRC.sales }), `pour cost, ${monthName(month)} ${delta(vsT, pf, true)} vs target`)}
        ${tile(Rp ? delta(vsP, pf, true) : "—", `vs ${prev ? monthName(prev) : "previous month"}`)}
        ${tile(X(pf(R.totals.fcAll), { l: "Food + extras", f: "(pour cost + extras) ÷ net sales", v: [["Extras", $0(R.totals.pkg)]], src: "extras.csv" }), "with extras")}
        ${tile(X($k(R.totals.gp), { l: "Gross profit", f: "net sales − pour cost − extras", v: [["Net sales", $0(R.totals.rev)], ["Food", $0(R.totals.cogs)], ["Extras", $0(R.totals.pkg)]], src: SRC.sales }), "gross profit after food & extras")}
        ${tile(rec.length ? (verdicts.every(v => v === "Pass") ? "Pass" : verdicts.includes("Fail") ? "Fail" : "Review") : "—", rec.length ? `books vs theoretical, ${rec.length} restaurant${rec.length === 1 ? "" : "s"}` : "no actuals for this month", null, rec.length && verdicts.includes("Fail") ? "pc-hi" : "")}
      </div>
      ${reading(`Pour cost landed at <b>${pf(R.totals.fc)}</b> in ${monthName(month)}, ${Math.abs(vsT) < 0.05 ? "on" : vsT > 0 ? `<b>${pts(vsT)}</b> above` : `${pts(-vsT).replace("+", "")} below`} the ${pf(t, 0)} target${Rp ? ` and ${Math.abs(vsP) < 0.05 ? "level with" : (vsP > 0 ? "up " : "down ") + Math.abs(vsP).toFixed(1) + " points from"} ${monthName(prev)}` : ""}.${rec.length ? ` The books ${verdicts.every(v => v === "Pass") ? "agree" : "do not fully agree"}: ${esc(fmtList(rec.map(r => `${r.name} ${r.verdict.toLowerCase()} (${pts(r.gap)})`), 3))}.` : ""}`, vsT > 0 ? "warn" : "ok")}
      ${table("rv-restaurants", [{ k: "name", l: "Restaurant", f: v => `<b style="font-weight:600">${esc(v)}</b>` }, { k: "fc", l: `Pour cost ${monthName(month)}`, n: 1, f: (v, r) => X(pf(v), { l: r.name, f: "pour cost ÷ net sales", v: [["Pour cost", $0(r.cogs)], ["Net sales", $0(r.rev)]], src: SRC.cost }), cls: r => r.fc > t ? "pc-hi" : "" }, { k: "prevFc", l: prev ? monthName(prev) : "Previous", n: 1, f: pf }, { k: "d", l: "Change", n: 1, f: v => delta(v, pf, true) }, { k: "vsT", l: "vs target", n: 1, f: v => delta(v, pf, true) }, { k: "gp", l: "Gross profit", n: 1, f: $k }, { k: "verdict", l: "Books", f: v => v ? flag(v, VERDICT[v]) : "—" }],
        R.byStore.map(s => { const p = Rp && Rp.byStore.find(x => x.restaurant === s.restaurant); const r = rec.find(x => x.restaurant === s.restaurant); return { name: s.name, fc: s.fc, cogs: s.cogs, rev: s.rev, prevFc: p ? p.fc : null, d: p ? s.fc - p.fc : null, vsT: s.fc - t, gp: s.gp, verdict: r ? r.verdict : null }; }).sort((a, b) => b.fc - a.fc), { title: "By restaurant", name: "review-restaurants" })}
      ${stepNav("rv", 1, 4, "What moved it")}`;
    } else if (f.step === 2) {
      if (!prev) body = reading(`${monthName(month)} is the first month in the data, so there is nothing to compare it with. Pick a later month above.`) + stepNav("rv", 2, 4, "Where to look");
      else {
        const d = decomposeFor(f.restaurants, prev, month);
        const ce = d.costEffect, me = d.mixEffect;
        body = `<div class="ops-tiles">
          ${tile(delta(d.total, pf, true), `change, ${monthName(prev)} → ${monthName(month)}`)}
          ${tile(X(pts(ce), { l: "Cost changes", f: `${monthName(prev)}'s sales re-costed at ${monthName(month)}'s ingredient costs, minus ${monthName(prev)}'s pour cost`, v: [[`${monthName(prev)} at its own costs`, pf(d.fcA)], [`${monthName(prev)} at ${monthName(month)} costs`, pf(d.fcA2)]], src: "ingredients.csv effective dates" }), "from ingredient cost changes", null, ce > 0.05 ? "pc-hi" : "")}
          ${tile(X(pts(me), { l: "Mix and prices", f: `${monthName(month)}'s pour cost minus ${monthName(prev)}'s sales at ${monthName(month)} costs`, v: [[`${monthName(month)}`, pf(d.fcB)], [`${monthName(prev)} at ${monthName(month)} costs`, pf(d.fcA2)]], src: SRC.sales }), "from what sold and what it sold for", null, me > 0.05 ? "pc-hi" : "")}
        </div>
        ${reading(`Pour cost moved <b>${pts(d.total)}</b>: <b>${pts(ce)}</b> from ingredient costs${d.ingredients.length ? ` (${esc(fmtList(d.ingredients.slice(0, 3).map(c => `${c.name} ${sgn(c.pct, v => v.toFixed(0) + "%")}`), 3))})` : " (no cost changed)"} and <b>${pts(me)}</b> from the mix and prices${d.mixB.premiumShare != null && d.mixA.premiumShare != null && Math.abs(d.mixB.premiumShare - d.mixA.premiumShare) > 0.005 ? ` (a called brand on ${pf(d.mixB.premiumShare * 100, 0)} of well & call orders, was ${pf(d.mixA.premiumShare * 100, 0)})` : ""}. The two parts add up to the total exactly.`, d.total > 0.05 ? "warn" : "ok")}
        <div class="ops-two">
          ${table("rv-comps", [{ k: "name", l: "Ingredient" }, { k: "before", l: monthName(prev), n: 1, f: $ }, { k: "after", l: monthName(month), n: 1, f: $ }, { k: "pct", l: "Change", n: 1, f: v => sgn(v, x => x.toFixed(1) + "%") }, { k: "dollars", l: `$ at ${monthName(month)} usage`, n: 1, f: v => sgn(v, $0) }, { k: "pts", l: "Points of pour cost", n: 1, f: v => pts(v), cls: r => r.pts > 0.05 ? "pc-hi" : "" }], d.ingredients, { title: "Bottle costs that changed", name: "review-cost-changes", empty: "No bottle cost changed between the two months." })}
          <div>${table("rv-mix", [{ k: "m", l: "Mix indicator" }, { k: "a", l: monthName(prev), n: 1 }, { k: "b", l: monthName(month), n: 1 }], [["Well & call, share of drinks", pf(d.mixA.byoShare * 100, 0), pf(d.mixB.byoShare * 100, 0)], ["Well & call orders calling a brand", pf(d.mixA.premiumShare == null ? null : d.mixA.premiumShare * 100, 0), pf(d.mixB.premiumShare == null ? null : d.mixB.premiumShare * 100, 0)], ["Checks with food", pf(d.mixA.addonShare == null ? null : d.mixA.addonShare * 100, 0), pf(d.mixB.addonShare == null ? null : d.mixB.addonShare * 100, 0)], ["Average paid per drink", $(d.mixA.avgPaid), $(d.mixB.avgPaid)], ["Average beverage check", $(d.mixA.aov), $(d.mixB.aov)]].map(([m, a, b]) => ({ m, a, b })), { title: "What sold", name: "review-mix" })}</div>
        </div>
        ${table("rv-drinks", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "pts", l: "Points of the change", n: 1, f: (v, r) => X(pts(v), { l: r.name, f: "its pour cost ÷ all sales, this month minus last", v: [[`Share of sales ${monthName(prev)} → ${monthName(month)}`, `${pf(r.shareA * 100)} → ${pf(r.shareB * 100)}`], ["Pour cost %", `${pf(r.fcA)} → ${pf(r.fcB)}`]], src: SRC.cost + " + " + SRC.sales }), cls: r => r.pts > 0.05 ? "pc-hi" : "" }, { k: "fcB", l: "Pour cost %", n: 1, f: (v, r) => `${pf(r.fcA)} → ${pf(v)}` }, { k: "unitsB", l: "Units", n: 1, f: (v, r) => `${nf(r.unitsA)} → ${nf(v)}` }], d.drinks.slice(0, 12), { title: "Drinks that moved it most · their points add up to the total change", name: "review-drink-movers" })}
        ${stepNav("rv", 2, 4, "Where to look")}`;
      }
    } else if (f.step === 3) {
      const overItems = R.itemList.filter(x => !x.addon && !x.byo && x.units > 0 && x.fcSold > t).sort((a, b) => b.rev - a.rev);
      const slip = Ra.ops.trend.drinks.filter(x => x.slipping);
      const thin = R.upcharges.filter(u => u.margin < 0.25 * u.upcharge).sort((a, b) => a.margin - b.margin);
      const waste = R.ops.hasWaste ? R.ops.waste.filter(w => w.wasteCost > 0).sort((a, b) => b.wasteCost - a.wasteCost).slice(0, 5) : [];
      const tva = R.ops.hasInventory ? R.ops.tva.filter(x => x.variancePct > 10).slice(0, 5) : [];
      const li = (h, link, label) => `<div class="look"><div>${h}</div><button class="card-link" data-act="${link}">${label} →</button></div>`;
      body = reading(`The lists below are ranked by money at stake. Each opens the view that explains it.`) + `<div class="looks">
        ${li(`<b>Restaurants</b> · ${esc(fmtList(R.byStore.slice().sort((a, b) => b.fc - a.fc).map(s => `${s.name} ${pf(s.fc)}${s.fc > t ? " (over)" : ""}`), 3))}`, "go:explore:ops:restaurants", "Restaurants side by side")}
        ${li(`<b>${overItems.length} drink${overItems.length === 1 ? "" : "s"} over the ${pf(t, 0)} target</b>${overItems.length ? ` · ${esc(fmtList(overItems.map(x => `${x.name} ${pf(x.fcSold)}`), 3))}` : ""}`, "go:explore:costs:drinks", "Drink costs")}
        ${li(`<b>${slip.length} drink${slip.length === 1 ? "" : "s"} losing margin</b>${slip.length ? ` · ${esc(fmtList(slip.map(x => `${x.name} ${sgn(x.cmDelta, $)}`), 3))}` : Ra.ops.trend.months.length < 2 ? " · needs two months" : ""}`, "go:explore:ops:trend", "Trend")}
        ${li(`<b>${thin.length} thin call up-charge${thin.length === 1 ? "" : "s"}</b>${thin.length ? ` · ${esc(fmtList(thin.map(u => `${u.name} ${$(u.margin)} on ${$(u.upcharge)}`), 3))}` : " · all keep at least 25% of the up-charge"}`, thin.length ? `go:price:up:${esc(thin[0].cid)}` : "go:price", "Test a price change")}
        ${R.ops.hasWaste ? li(`<b>Waste</b> · ${$0(R.ops.wasteTotal)} logged (${pf(R.ops.wastePctCogs)} of pour cost) · ${esc(fmtList(waste.map(w => `${w.name} ${$0(w.wasteCost)}`), 3))}`, "go:explore:ops:waste", "Waste & low movers") : li(`<b>Waste</b> · no waste log loaded`, "job:data", "Load waste.csv")}
        ${R.ops.hasInventory ? li(`<b>Usage above theoretical</b> · ${esc(fmtList(tva.map(x => `${x.name} ${sgn(x.variancePct, v => v.toFixed(0) + "%")}`), 3)) || "nothing over 10%"}`, "go:explore:ops:tva", "Theoretical vs actual") : ""}
      </div>` + stepNav("rv", 3, 4, "Summary");
    } else {
      body = reading(`One page: the headline, the restaurants, what moved pour cost and the list to look at. Print it or save it as a PDF from the panel.`) + `<div class="ct-row"><button class="tour-next" data-act="rv:summary">Open the summary</button><button class="linkbtn" data-act="csv:rv-restaurants">⤓ Restaurants CSV</button></div>` + stepNav("rv", 4, 4);
    }
    return head + body;
  }
  function rvSummary() {
    const M = data().M; const S = rvScope(M); const { month, prev, R, Rp } = S; const t = CT.scope.target; const rec = R.reconcile.rows.filter(r => r.month === month);
    const d = prev ? decomposeFor(CT.flow.review.restaurants, prev, month) : null;
    const overItems = R.itemList.filter(x => !x.addon && !x.byo && x.units > 0 && x.fcSold > t).sort((a, b) => b.rev - a.rev);
    const html = `<p class="sum-lead">Theoretical pour cost <b>${pf(R.totals.fc)}</b> (${pf(R.totals.fcAll)} with extras) against a ${pf(t, 0)} target${Rp ? `, ${sgn(R.totals.fc - Rp.totals.fc, v => v.toFixed(1) + " pts")} vs ${monthName(prev)}` : ""}. Net sales ${$0(R.totals.rev)}, gross profit ${$0(R.totals.gp)}.${rec.length ? ` Books: ${rec.map(r => `${r.name} ${r.verdict} (${pts(r.gap)})`).join("; ")}.` : ""}</p>
      <h3>By restaurant</h3>${sumTable(["Restaurant", "Pour cost", prev ? monthName(prev) : "Prev", "vs target", "Gross profit", "Books"], R.byStore.map(s => { const p = Rp && Rp.byStore.find(x => x.restaurant === s.restaurant); const r = rec.find(x => x.restaurant === s.restaurant); return [esc(s.name), pf(s.fc), p ? pf(p.fc) : "—", pts(s.fc - t), $0(s.gp), r ? r.verdict : "—"]; }))}
      ${d && d.ok ? `<h3>What moved it</h3><p>${pts(d.total)} in total: ${pts(d.costEffect)} from ingredient costs, ${pts(d.mixEffect)} from mix and prices.</p>${d.ingredients.length ? sumTable(["Ingredient", monthName(prev), monthName(month), "Change", "Points"], d.ingredients.slice(0, 8).map(c => [esc(c.name), $(c.before), $(c.after), sgn(c.pct, v => v.toFixed(1) + "%"), pts(c.pts)])) : ""}${sumTable(["Drink", "Points", "Pour cost %", "Units"], d.drinks.slice(0, 8).map(i => [esc(i.name), pts(i.pts), `${pf(i.fcA)} → ${pf(i.fcB)}`, `${nf(i.unitsA)} → ${nf(i.unitsB)}`]))}` : ""}
      <h3>Where to look</h3><ul>${overItems.length ? `<li>${overItems.length} drinks over target: ${esc(fmtList(overItems.map(x => `${x.name} ${pf(x.fcSold)}`), 5))}</li>` : "<li>No drink over target.</li>"}${R.upcharges.filter(u => u.margin < 0.25 * u.upcharge).map(u => `<li>${esc(u.name)} call up-charge earns ${$(u.margin)} on ${$(u.upcharge)}</li>`).join("")}${R.ops.hasWaste ? `<li>Waste logged ${$0(R.ops.wasteTotal)} (${pf(R.ops.wastePctCogs)} of pour cost)</li>` : ""}</ul>
      <p class="sum-foot">Theoretical pour cost = cost of every drink sold (the spec for menu drinks, the modifiers for well & call, at the bottle cost in force on the day) ÷ net beverage sales. Method: docs/methodology.md.</p>`;
    showSummary(`Monthly review · ${monthName(month)}`, html);
  }

  /* ---------- Price change simulation ---------- */
  function pcScope(M) { const f = CT.flow.price; return f.base === "all" ? {} : { months: lastMonths(M, 1) }; }
  function pcScn() { const f = CT.flow.price; return { name: f.name || "Price change", prices: Object.assign({}, f.prices), upcharges: Object.assign({}, f.ups), elasticity: f.elasticity }; }
  const pcHas = () => Object.keys(CT.flow.price.prices).length + Object.keys(CT.flow.price.ups).length > 0;
  function pcAct(arg) {
    const [k, ...r] = arg.split(":"); const v = r.join(":"); const f = CT.flow.price; const M = data().M;
    if (k === "step") f.step = +v;
    else if (k === "addUp") { const c = M.comps.get(v); if (c) { f.ups[v] = c.upcharge; f.step = 2; } }
    else if (k === "addItem") { const p = M.itemPrice(v, null); if (p != null) { f.prices[v] = p; f.step = 2; } }
    else if (k === "rmUp") delete f.ups[v];
    else if (k === "rmItem") delete f.prices[v];
    else if (k === "bump") { const [kind, id, amt] = r; const d = +amt; if (kind === "up") f.ups[id] = Math.max(0, Math.round((f.ups[id] + d) * 20) / 20); else f.prices[id] = Math.max(0, Math.round((f.prices[id] + d) * 20) / 20); }
    else if (k === "ladderFix") { const R = resultsFor(pcScope(M), pcScn()); R.ladder.filter(l => l.gap < -0.05).forEach(l => { f.prices[l.id] = Math.round((l.price - l.gap) * 20) / 20; }); }
    else if (k === "save") { const name = f.name.trim() || `Option ${f.options.length + 1}`; const i = f.options.findIndex(o => o.name === name); const rec = { name, scn: pcScn() }; if (i >= 0) f.options[i] = rec; else f.options.push(rec); f.name = ""; }
    else if (k === "load") { const o = f.options[+v]; if (o) { f.prices = Object.assign({}, o.scn.prices); f.ups = Object.assign({}, o.scn.upcharges); f.elasticity = o.scn.elasticity; f.name = o.name; } }
    else if (k === "del") f.options.splice(+v, 1);
    else if (k === "clear") { f.prices = {}; f.ups = {}; }
    else if (k === "summary") pcSummary();
    else if (k === "explore") { CT.scn = Object.assign(blankScn(), pcScn()); go("explore:scenarios"); return; }
    render();
  }
  function pcSet(a, b, value, el) {
    const f = CT.flow.price;
    if (a === "q") { f.q = value; return render(); } if (a === "base") { f.base = value; return render(); } if (a === "name") { f.name = value; return; }
    if (a === "el") { f.elasticity = +value; el.nextElementSibling && (el.nextElementSibling.textContent = value); return rerenderSoon(); }
    if (a === "up") { const v = +value; if (v >= 0) f.ups[b] = v; return rerenderSoon(); } if (a === "price") { const v = +value; if (v > 0) f.prices[b] = v; return rerenderSoon(); }
  }
  function jobPrice(M) {
    const f = CT.flow.price; const t = CT.scope.target; const sc = pcScope(M); const R0 = resultsFor(sc); const scn = pcHas() ? pcScn() : null; const R = scn ? resultsFor(sc, scn) : R0;
    const period = sc.months ? monthsLabel(sc.months) : monthsLabel(M.months);
    const head = jobHead("Price change simulation", "Set new prices or up-charges, see margin, pour cost and volume under a stated demand assumption, check the ladder still holds, compare options.") + `<div class="ct-scope"><span class="label">Base period</span>${sel("pc:base", [["last", `Latest month (${monthName(M.months[M.months.length - 1] || "")})`], ["all", `All months (${monthsLabel(M.months)})`]], f.base)}<span class="hint">Costs as of ${R0.refDate}.</span></div>` + stepper(["Pick what to change", "Set the new price", "Check the ladder", "Compare & export"], f.step, "pc");
    let body = "";
    if (f.step === 1) {
      const q = f.q.toLowerCase(); const drinks = R0.itemList.filter(x => !x.byo && (!q || x.name.toLowerCase().includes(q) || x.line.toLowerCase().includes(q))).sort((a, b) => b.units - a.units).slice(0, q ? 40 : 15);
      body = reading(`Call up-charges first: they are where the premium bottles are sold. ${R0.upcharges.length ? `The thinnest margin is <b>${esc(R0.upcharges.slice().sort((a, b) => a.margin - b.margin)[0].name)}</b> at ${$(R0.upcharges.slice().sort((a, b) => a.margin - b.margin)[0].margin)} per call.` : ""} Pick anything to change; you can add more later.`) +
        table("pc-ups", [{ k: "name", l: "Up-charged ingredient", f: (v, r) => `<b style="font-weight:600">${esc(v)}</b> <span class="hint">${esc(r.category)}</span>` }, { k: "upcharge", l: "Up-charge", n: 1, f: $ }, { k: "cost", l: "Pour cost", n: 1, f: $ }, { k: "margin", l: "Margin per call", n: 1, f: (v, r) => X($(v), { l: r.name, f: r.baseMain != null ? "up-charge − (pour cost − the well it replaces)" : "up-charge − pour cost", v: [["Up-charge", $(r.upcharge)], ["Pour cost", $(r.cost)], ...(r.baseMain != null ? [["Well", $(r.baseMain)]] : [])], src: SRC.cost }), cls: r => r.margin < 0.25 * r.upcharge ? "pc-hi" : "" }, { k: "perStoreWeek", l: "Calls per restaurant-week", n: 1, f: n1 }, { k: "cid", l: "", f: (v, r) => f.ups[v] != null ? flag("selected", "ok") : `<button class="linkbtn" data-act="pc:addUp:${esc(v)}">Change</button>`, raw: () => "" }], R0.upcharges.slice().sort((a, b) => a.margin - b.margin), { title: "Call up-charges", name: "price-upcharges" }) +
        table("pc-drinks", [{ k: "name", l: "Drink", f: (v, r) => `<b style="font-weight:600">${esc(v)}</b>` }, { k: "line", l: "Section" }, { k: "price", l: "Price", n: 1, f: $ }, { k: "fcSold", l: "Pour cost %", n: 1, f: pf, cls: r => r.fcSold > t ? "pc-hi" : "" }, { k: "cmUnit", l: "Contribution", n: 1, f: $ }, { k: "units", l: `Units, ${period}`, n: 1, f: nf }, { k: "quadrant", l: "Quadrant", f: v => v || "—" }, { k: "id", l: "", f: v => f.prices[v] != null ? flag("selected", "ok") : `<button class="linkbtn" data-act="pc:addItem:${esc(v)}">Change</button>`, raw: () => "" }], drinks, { title: "Drinks · most sold first", name: "price-drinks", maxh: 360, tools: `<input type="search" data-set="pc:q" value="${esc(f.q)}" placeholder="Find an drink" style="width:150px">` }) +
        (pcHas() ? stepNav("pc", 1, 4, "Set the new price") : "");
    } else if (f.step === 2) {
      if (!pcHas()) body = reading("Nothing selected yet.") + stepNav("pc", 2, 4);
      else {
        const T0 = R0.totals, T1 = R.totals;
        const rows = [];
        for (const [cid, nv] of Object.entries(f.ups)) { const b = R0.upcharges.find(u => u.cid === cid), a = R.upcharges.find(u => u.cid === cid); if (!b || !a) continue; const c = M.comps.get(cid); const pf_ = c.upcharge ? Math.max(0, Math.min(1.5, 1 + f.elasticity * (nv - c.upcharge) / c.upcharge)) : 1;
          rows.push(`<div class="pc-row"><div class="pc-what"><b>${esc(c.name)}</b> up-charge <span class="hint">now ${$(c.upcharge)}</span><button class="linkbtn" data-act="pc:rmUp:${esc(cid)}" aria-label="Remove">✕</button></div>
            <div class="ct-row"><input type="number" data-set="pc:up:${esc(cid)}" value="${nv}" step="0.05" min="0" style="width:84px" aria-label="New up-charge">${[0.25, 0.5, 1].map(d => `<button class="linkbtn" data-act="pc:bump:up:${esc(cid)}:${d}">+$${d.toFixed(2)}</button>`).join("")}<button class="linkbtn" data-act="pc:bump:up:${esc(cid)}:-0.25">−$0.25</button></div>
            <div class="ct-mini">${tile(`${$(b.margin)} → ${X($(a.margin), { l: "Margin per call", f: "new up-charge − incremental cost", v: [["New up-charge", $(nv)], ["Incremental cost", $(a.incremental)]], src: SRC.cost })}`, "margin per call")}${tile(`${nf(b.picks)} → ${X(nf(a.picks), { l: "Calls kept", f: "calls × (1 + elasticity × Δ ÷ old up-charge)", v: [["Calls before", nf(b.picks)], ["Change", sgn(nv - c.upcharge, $)], ["Elasticity", String(f.elasticity)], ["Share kept", pf(pf_ * 100, 0)]], src: SRC.mods, asm: `elasticity ${f.elasticity} (your setting)` })}`, "calls")}${tile(X(sgn(a.marginTotal - b.marginTotal, $0), { l: "Margin on this up-charge", f: "margin per call × calls kept", v: [["Before", $0(b.marginTotal)], ["After", $0(a.marginTotal)]], src: SRC.mods, asm: `elasticity ${f.elasticity}` }), "margin in the period")}</div>
            ${reading(Math.abs(nv - c.upcharge) < 0.001 ? `${esc(c.name)} is still at ${$(c.upcharge)}: type a new up-charge or use the buttons. Margin per call is <b>${$(b.margin)}</b> today.` : `${nv > c.upcharge ? "Raising" : "Lowering"} ${esc(c.name)} to ${$(nv)} ${a.margin >= b.margin ? "lifts" : "cuts"} margin per call to <b>${$(a.margin)}</b>${pf_ < 1 ? ` and, with ${pf((1 - pf_) * 100, 0)} fewer calls assumed, ` : pf_ > 1 ? ` and, with ${pf((pf_ - 1) * 100, 0)} more calls assumed, ` : "; "}margin on the up-charge ${a.marginTotal >= b.marginTotal ? "rises" : "falls"} ${sgn(a.marginTotal - b.marginTotal, $0)} in ${period}.`, Math.abs(nv - c.upcharge) < 0.001 ? "" : a.marginTotal >= b.marginTotal ? "ok" : "warn")}</div>`); }
        for (const [iid, nv] of Object.entries(f.prices)) { const b = R0.drinks.get(iid), a = R.drinks.get(iid); if (!b || !a) continue; const old = b.price; const fct = old ? Math.max(0, 1 + f.elasticity * (nv - old) / old) : 1;
          rows.push(`<div class="pc-row"><div class="pc-what"><b>${esc(b.name)}</b> <span class="hint">${esc(b.line)} · now ${$(old)}</span><button class="linkbtn" data-act="pc:rmItem:${esc(iid)}" aria-label="Remove">✕</button></div>
            <div class="ct-row"><input type="number" data-set="pc:price:${esc(iid)}" value="${nv}" step="0.05" min="0" style="width:84px" aria-label="New price">${[0.25, 0.5, 1].map(d => `<button class="linkbtn" data-act="pc:bump:drink:${esc(iid)}:${d}">+$${d.toFixed(2)}</button>`).join("")}<button class="linkbtn" data-act="pc:bump:drink:${esc(iid)}:-0.25">−$0.25</button></div>
            <div class="ct-mini">${tile(`${pf(b.fc)} → ${X(pf(a.fc), { l: "Pour cost % at the new price", f: "pour cost ÷ new price", v: [["Pour cost", $(a.food)], ["New price", $(nv)]], src: SRC.cost })}`, "pour cost %")}${tile(`${nf(b.units)} → ${X(nf(a.units), { l: "Units kept", f: "units × (1 + elasticity × Δprice ÷ old price)", v: [["Units before", nf(b.units)], ["Price change", sgn(nv - old, $)], ["Elasticity", String(f.elasticity)], ["Share kept", pf(fct * 100, 0)]], src: SRC.sales, asm: `elasticity ${f.elasticity} (your setting)` })}`, "units")}${tile(X(sgn(a.rev - a.cogs - (b.rev - b.cogs), $0), { l: "Contribution from this drink", f: "(price − pour cost) × units kept", v: [["Before", $0(b.rev - b.cogs)], ["After", $0(a.rev - a.cogs)]], src: SRC.sales, asm: `elasticity ${f.elasticity}` }), "contribution in the period")}</div>
            ${reading(Math.abs(nv - old) < 0.001 ? `${esc(b.name)} is still at ${$(old)}: type a new price or use the buttons.` : `${esc(b.name)} at ${$(nv)}: contribution per unit ${$(b.cmUnit)} → <b>${$(a.price - a.food)}</b>, ${pf((1 - fct) * 100, 0)} fewer units assumed, ${a.rev - a.cogs >= b.rev - b.cogs ? "a gain" : "a loss"} of ${sgn(a.rev - a.cogs - (b.rev - b.cogs), $0)} in ${period}.`, Math.abs(nv - old) < 0.001 ? "" : a.rev - a.cogs >= b.rev - b.cogs ? "ok" : "warn")}</div>`); }
        body = `<div class="pc-asm"><b>Demand assumption</b> ${asmBadge("How much volume changes when a price changes. −0.8 means a 10% price rise loses 8% of units or calls; bar estimates run −0.5 to −1.5. Set 0 to see the price effect with no volume loss.")}<input type="range" data-set="pc:el" min="-2" max="0" step="0.1" value="${f.elasticity}" style="width:160px"><output>${f.elasticity}</output><span class="hint">${f.elasticity === 0 ? "no demand response" : `a 10% price rise loses ${Math.round(-f.elasticity * 10)}% of volume`}</span></div>
          ${rows.join("")}
          <div class="ops-tiles">${tile(X(sgn(T1.rev - T0.rev, $k), { l: "Net sales", f: "Σ units kept × new prices", v: [["Before", $0(T0.rev)], ["After", $0(T1.rev)]], src: SRC.sales, asm: `elasticity ${f.elasticity}` }), "net sales")}${tile(`${pf(T0.fc)} → ${X(pf(T1.fc), { l: "Pour cost %", f: "pour cost ÷ net sales", v: [["Before", pf(T0.fc)], ["After", pf(T1.fc)]], src: SRC.cost })}`, "mix-weighted pour cost")}${tile(X(sgn(T1.gp - T0.gp, $k), { l: "Gross profit", f: "net sales − pour cost − extras", v: [["Before", $0(T0.gp)], ["After", $0(T1.gp)]], src: SRC.sales, asm: `elasticity ${f.elasticity}` }), `gross profit, ${period}`)}</div>
          ${stepNav("pc", 2, 4, "Check the ladder")}`;
      }
    } else if (f.step === 3) {
      const base = new Map(R0.ladder.map(l => [l.id, l])); const changed = R.ladder.filter(l => { const b = base.get(l.id); return !b || Math.abs(b.gap - l.gap) > 0.001 || Math.abs(l.gap) >= 0.05; });
      const below = R.ladder.filter(l => l.gap < -0.05); const over = R.itemList.filter(x => !x.addon && !x.byo && x.fc > t && (!R0.drinks.get(x.id) || R0.drinks.get(x.id).fc <= t));
      body = reading(below.length ? `<b>${below.length} menu drink${below.length === 1 ? "" : "s"} now sit${below.length === 1 ? "s" : ""} below well & call</b>: ${esc(fmtList(below.map(l => `${l.name} (${$(l.price)} vs ${$(l.formula)} to call the same bottles at the well)`), 3))}. Guests would get the same spirits cheaper by ordering the menu drink. Reprice them by the same amount, or accept the gap on purpose.` : changed.length ? `Every menu drink still sits on or above its well & call formula.` : `This change does not touch the ladder.`, below.length ? "warn" : "ok") +
        (below.length ? `<div class="ct-row"><button class="tour-next" data-act="pc:ladderFix">Reprice them to the ladder</button><span class="hint">adds a price change for each, to base + up-charges</span></div>` : "") +
        table("pc-ladder", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "price", l: "Price", n: 1, f: (v, r) => { const b = base.get(r.id); return b && Math.abs(b.price - v) > 0.001 ? `${$(b.price)} → ${$(v)}` : $(v); } }, { k: "formula", l: "Well & call formula", n: 1, f: (v, r) => X($(v), { l: "Base + call up-charges", f: "well & call base price + Σ call up-charges of its spirits", v: [["Base", $(r.base)], ...r.ups.map(u => [u.name, "+" + $(u.up)])], src: SRC.drinks + " + ingredients.csv upcharge" }) }, { k: "gap", l: "Gap", n: 1, f: v => sgn(v, $), cls: r => r.gap < -0.05 ? "pc-hi" : "" }, { k: "flag", l: "Reading", f: v => flag(v, v === "On the ladder" ? "ok" : v === "Below well & call" ? "bad" : "quiet") }], changed.length ? changed : R.ladder, { title: changed.length ? "Drinks whose place on the ladder changed" : "Price ladder", name: "price-ladder-check" }) +
        (over.length ? reading(`Also: ${esc(fmtList(over.map(x => x.name), 3))} ${over.length === 1 ? "goes" : "go"} over the ${pf(t, 0)} target after this change.`, "warn") : "") + stepNav("pc", 3, 4, "Compare & export");
    } else {
      body = `<div class="ct-row"><input type="text" data-set="pc:name" value="${esc(f.name)}" placeholder="Name this option (e.g. Casamigos +$0.50)" style="flex:1"><button class="linkbtn" data-act="pc:save" ${pcHas() ? "" : "disabled"}>Save as option</button><button class="linkbtn" data-act="pc:clear">Start another</button></div>
        ${pcCompare(M, sc, R0)}
        <div class="ct-row"><button class="tour-next" data-act="pc:summary">Open the summary</button><button class="linkbtn" data-act="csv:pc-compare">⤓ Comparison CSV</button><button class="linkbtn" data-act="pc:explore">Open in Explore → Scenarios</button></div>
        ${reading(`Pick the option with the best gross profit whose volume loss you believe, and whose ladder you can live with. Every volume figure rests on the demand assumption; margin per call and pour cost % at the new price do not.`)}` + stepNav("pc", 4, 4);
    }
    return head + body;
  }
  function pcCompare(M, sc, R0) {
    const f = CT.flow.price; const t = CT.scope.target;
    const cols = [{ name: "Base", R: R0, scn: null }].concat(pcHas() ? [{ name: f.name.trim() || "Current", R: resultsFor(sc, pcScn()), scn: pcScn() }] : []).concat(f.options.map(o => ({ name: o.name, R: resultsFor(sc, o.scn), scn: o.scn })));
    const upIds = [...new Set(cols.flatMap(c => c.scn ? Object.keys(c.scn.upcharges) : []))];
    const rows = [["Net sales", r => $k(r.totals.rev)], ["Gross profit", r => $k(r.totals.gp)], ["Pour cost %", r => pf(r.totals.fc)], ["Units", r => nf(r.totals.units)], ["Drinks below the ladder", r => r.ladder.filter(l => l.gap < -0.05).length], ["Drinks over target", r => r.itemList.filter(x => !x.addon && !x.byo && x.fc > t).length]].concat(upIds.map(cid => [`${M.comps.get(cid).name}: margin per call`, r => { const u = r.upcharges.find(x => x.cid === cid); return u ? $(u.margin) : "—"; }])).concat(upIds.map(cid => [`${M.comps.get(cid).name}: calls`, r => { const u = r.upcharges.find(x => x.cid === cid); return u ? nf(u.picks) : "—"; }]));
    CT.exports.set("pc-compare", { name: "price-options", cols: [{ k: "metric", l: "Metric" }].concat(cols.map((c, i) => ({ k: "c" + i, l: c.name }))), rows: rows.map(([l, fn]) => Object.assign({ metric: l }, Object.fromEntries(cols.map((c, i) => ["c" + i, fn(c.R)])))) });
    return `<div class="ct-block"><div class="sub">Options side by side · ${f.options.length ? `${f.options.length} saved` : "save the current change to keep it here"}</div><div class="scroll"><table class="mini gtable"><thead><tr><th></th>${cols.map((c, i) => `<th class="n">${esc(c.name)}${i > 0 && f.options.some(o => o.name === c.name) ? ` <button class="linkbtn" data-act="pc:load:${f.options.findIndex(o => o.name === c.name)}">open</button><button class="linkbtn" data-act="pc:del:${f.options.findIndex(o => o.name === c.name)}" aria-label="Delete">✕</button>` : ""}</th>`).join("")}</tr></thead><tbody>${rows.map(([l, fn]) => `<tr><td>${esc(l)}</td>${cols.map(c => `<td class="n">${fn(c.R)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="hint">Volume-dependent rows (sales, gross profit, units, picks) assume elasticity ${f.elasticity}; the others are arithmetic on the data.</p></div>`;
  }
  function pcSummary() {
    const M = data().M; const f = CT.flow.price; const sc = pcScope(M); const R0 = resultsFor(sc); const scn = pcHas() ? pcScn() : null; const R = scn ? resultsFor(sc, scn) : R0; const period = sc.months ? monthsLabel(sc.months) : monthsLabel(M.months);
    const changes = Object.entries(f.ups).map(([c, v]) => `${esc(M.comps.get(c).name)} up-charge ${$(M.comps.get(c).upcharge)} → ${$(v)}`).concat(Object.entries(f.prices).map(([i, v]) => `${esc(M.drinks.get(i).name)} ${$(M.itemPrice(i, null))} → ${$(v)}`));
    const html = `<p class="sum-lead">${changes.length ? changes.join("; ") : "No change"}. Base period ${esc(period)}, demand assumption elasticity ${f.elasticity}.</p>
      ${sumTable(["", "Base", "Scenario"], [["Net sales", $0(R0.totals.rev), $0(R.totals.rev)], ["Gross profit", $0(R0.totals.gp), $0(R.totals.gp)], ["Pour cost %", pf(R0.totals.fc), pf(R.totals.fc)], ["Units", nf(R0.totals.units), nf(R.totals.units)]])}
      ${Object.keys(f.ups).length ? `<h3>Up-charges</h3>${sumTable(["Bottle", "Call up-charge", "Margin per call", "Calls", "Margin in period"], Object.keys(f.ups).map(c => { const b = R0.upcharges.find(u => u.cid === c), a = R.upcharges.find(u => u.cid === c); return [esc(M.comps.get(c).name), `${$(b.upcharge)} → ${$(a.upcharge)}`, `${$(b.margin)} → ${$(a.margin)}`, `${nf(b.picks)} → ${nf(a.picks)}`, `${$0(b.marginTotal)} → ${$0(a.marginTotal)}`]; }))}` : ""}
      ${R.ladder.filter(l => l.gap < -0.05).length ? `<h3>Ladder</h3><p>Below well & call after the change: ${esc(R.ladder.filter(l => l.gap < -0.05).map(l => `${l.name} (${$(l.price)} vs ${$(l.formula)})`).join("; "))}.</p>` : "<p>Every menu drink stays on or above its well & call formula.</p>"}
      ${f.options.length ? `<h3>Options</h3>${sumTable(["Option", "Gross profit", "Pour cost %", "Units"], f.options.map(o => { const r = resultsFor(sc, o.scn); return [esc(o.name), $0(r.totals.gp), pf(r.totals.fc), nf(r.totals.units)]; }))}` : ""}
      <p class="sum-foot">Units and calls after a change = before × (1 + elasticity × price change ÷ old price). Margin per call = up-charge − (pour cost − the well it replaces). Method: docs/methodology.md.</p>`;
    showSummary("Price change · " + (f.name || changes[0] || "summary").replace(/<[^>]+>/g, ""), html);
  }

  /* ---------- Evaluate a menu change ---------- */
  const MC_TYPES = [["new", "New drink", "Assemble a candidate from the bottles you stock; cost, margin, prep and what it pulls from the menu."], ["lto", "Limited-time drink", "A new drink for a set number of weeks, with its pull from existing drinks."], ["pour", "Pour change", "Change the pours in an existing spec; see cost, margin and strength move."], ["swap", "Swap an ingredient", "Replace one bottle with another everywhere it is used."], ["remove", "Remove a drink", "Cut a drink; see where its volume goes and which bottles and prep disappear."]];
  function mcBlank(type) { return { name: "", line: "Cocktails", price: 16, recipe: [], units: 40, cannibal: 70, weeks: type === "lto" ? 6 : "", drink: "", swapFrom: "", swapTo: "", retention: 80 }; }
  function mcScn() { const f = CT.flow.menu; const d = f.def; if (!d) return null; const t = f.type; const s = { name: f.name || MC_TYPES.find(x => x[0] === t)[1], elasticity: -0.8 };
    if (t === "new" || t === "lto") { if (!d.recipe.length) return null; s.newItems = [{ id: "new-" + (CM.slug(d.name) || "drink"), name: d.name || "New drink", line: d.line, price: +d.price || 0, recipe: d.recipe.map(p => ({ ...p })), unitsPerStoreWeek: +d.units || 0, cannibal: Math.min(1, Math.max(0, (+d.cannibal || 0) / 100)), weeks: t === "lto" && d.weeks ? +d.weeks : null }]; }
    else if (t === "pour") { if (!d.drink || !d.recipe.length) return null; s.recipes = { [d.drink]: d.recipe.filter(p => p.pours > 0).map(p => ({ ...p })) }; }
    else if (t === "swap") { if (!d.swapFrom || !d.swapTo || d.swapFrom === d.swapTo) return null; s.swaps = [{ from: d.swapFrom, to: d.swapTo }]; }
    else if (t === "remove") { if (!d.drink) return null; s.remove = [d.drink]; s.retention = Math.min(1, Math.max(0, (+d.retention || 0) / 100)); }
    return s; }
  function mcAct(arg) {
    const [k, ...r] = arg.split(":"); const v = r.join(":"); const f = CT.flow.menu; const M = data().M;
    if (k === "step") f.step = +v;
    else if (k === "type") { f.type = v; f.def = mcBlank(v); f.step = 2; }
    else if (k === "add") { const c = CT.ui.mcPick; if (c && M.comps.has(c)) f.def.recipe.push({ cid: c, pours: +CT.ui.mcQty || 1 }); CT.ui.mcPick = ""; }
    else if (k === "rm") f.def.recipe.splice(+v, 1);
    else if (k === "pickItem") { const it = M.drinks.get(v); if (it) { f.def.drink = v; f.def.recipe = it.recipe.map(p => ({ ...p })); f.def.name = it.name; } }
    else if (k === "save") { const s = mcScn(); if (!s) return; const name = f.name.trim() || `Option ${f.options.length + 1}`; const i = f.options.findIndex(o => o.name === name); const rec = { name, scn: Object.assign(s, { name }), type: f.type, def: JSON.parse(JSON.stringify(f.def)) }; if (i >= 0) f.options[i] = rec; else f.options.push(rec); f.name = ""; }
    else if (k === "load") { const o = f.options[+v]; if (o) { f.type = o.type; f.def = JSON.parse(JSON.stringify(o.def)); f.name = o.name; f.step = 3; } }
    else if (k === "del") f.options.splice(+v, 1);
    else if (k === "summary") mcSummary();
    else if (k === "explore") { const s = mcScn(); if (s) { CT.scn = Object.assign(blankScn(), s); go("explore:scenarios"); } return; }
    render();
  }
  function mcSet(a, b, value, el) {
    const f = CT.flow.menu; const d = f.def || {};
    if (a === "name") { f.name = value; return; } if (a === "pick") { CT.ui.mcPick = value; return; } if (a === "qty") { CT.ui.mcQty = value; return; }
    if (a === "pours") { const p = d.recipe[+b]; if (p) p.pours = +value; return rerenderSoon(); }
    if (a === "drink") { mcAct("pickItem:" + value); return; }
    if (["units", "cannibal", "weeks", "price", "retention", "iname"].includes(a)) { d[a === "iname" ? "name" : a] = value; return rerenderSoon(); }
    if (a === "line" || a === "swapFrom" || a === "swapTo") { d[a] = value; return render(); }
  }
  function jobMenu(M) {
    const f = CT.flow.menu; const t = CT.scope.target; const sc = {}; const R0 = resultsFor(sc); const scn = mcScn(); const R = scn ? resultsFor(sc, scn) : R0; const d = f.def; const period = monthsLabel(M.months);
    const typeLabel = f.type ? MC_TYPES.find(x => x[0] === f.type)[1] : "";
    const head = jobHead("Evaluate a menu change", "Pick the change, define it, see its cost and margin, then the ripple across the menu and the prep line. Compare options and export.") + stepper(["Pick the change", "Define it", "Cost & margin", "Ripple", "Compare & export"], f.step, "mc");
    let body = "";
    if (f.step === 1 || !d) {
      body = `<div class="job-cards">${MC_TYPES.map(([k, l, dsc]) => `<button class="job-card ${f.type === k ? "on" : ""}" data-act="mc:type:${k}"><b>${l}</b><span>${dsc}</span></button>`).join("")}</div>` + reading(`Or start from a build guests already order: <button class="linkbtn" data-act="go:ideas">New drink ideas →</button>`);
    } else if (f.step === 2) {
      const compsOpt = compOptions(M); const menu = itemOptions(M, i => !i.byo && i.recipe.length);
      const cost = (f.type === "new" || f.type === "lto" || f.type === "pour") ? CM.costOf(M, d.recipe, R0.refStore, R0.refDate, null) : null;
      if (f.type === "new" || f.type === "lto") body = `<div class="ct-editor">
          <div class="ct-row"><input type="text" data-set="mc:iname" value="${esc(d.name)}" placeholder="Drink name" style="flex:1">${sel("mc:line", M.lines.filter(l => !M.addonLines.has(l)).map(l => [l, l]), d.line)}<label class="hint">Price</label><input type="number" data-set="mc:price" value="${d.price}" step="0.05" style="width:80px"></div>
          <div class="ct-row">${sel("mc:pick", [["", "— add a ingredient —"]].concat(compsOpt), CT.ui.mcPick || "")}<input type="number" data-set="mc:qty" value="${CT.ui.mcQty || 1}" step="0.25" min="0.25" style="width:64px" aria-label="Pours"><button class="linkbtn" data-act="mc:add">Add</button></div>
          <div class="ct-list">${d.recipe.map((p, i) => `<div><span>${esc(M.comps.get(p.cid).name)} <span class="hint">×${p.pours} · ${$(cost.parts[i] ? cost.parts[i].cost : 0)}</span></span><button class="linkbtn" data-act="mc:rm:${i}" aria-label="Remove">✕</button></div>`).join("") || `<p class="hint">Add the ingredients. Quantities are standard pours of each bottle (a 1 fl oz pour for spirits in the sample): 0.5 is a half pour, 2 is a double.</p>`}</div>
          <div class="ct-row"><label class="hint">Expected units per restaurant-week ${asmBadge("Your forecast. Everything in step 4 that depends on volume scales with it.")}</label><input type="number" data-set="mc:units" value="${d.units}" min="0" style="width:70px"><label class="hint">share pulled from drinks in the same section ${asmBadge("How much of the new drink's volume replaces existing drinks in its section rather than adding demand. 70% is a common planning figure for a like-for-like drink.")}</label><input type="number" data-set="mc:cannibal" value="${d.cannibal}" min="0" max="100" style="width:60px"><span class="hint">%</span>${f.type === "lto" ? `<label class="hint">Weeks on the menu</label><input type="number" data-set="mc:weeks" value="${d.weeks}" min="1" style="width:60px">` : ""}</div>
        </div>` + (d.recipe.length ? stepNav("mc", 2, 5, "Cost & margin") : "");
      else if (f.type === "pour") body = `<div class="ct-editor"><div class="ct-row">${sel("mc:drink", [["", "— pick an drink —"]].concat(menu), d.drink)}</div>
          ${d.drink ? `<div class="ct-list">${d.recipe.map((p, i) => { const it = M.drinks.get(d.drink); const orig = it.recipe.find(x => x.cid === p.cid); return `<div><span>${esc(M.comps.get(p.cid).name)} <span class="hint">${esc(M.comps.get(p.cid).category)} · was ×${orig ? orig.pours : "—"} · ${$(cost.parts[i] ? cost.parts[i].cost : 0)}</span></span><input type="number" data-set="mc:pours:${i}" value="${p.pours}" step="0.25" min="0" style="width:64px" aria-label="Pours"></div>`; }).join("")}</div><div class="ct-row">${sel("mc:pick", [["", "— add a ingredient —"]].concat(compsOpt), CT.ui.mcPick || "")}<input type="number" data-set="mc:qty" value="${CT.ui.mcQty || 1}" step="0.25" min="0.25" style="width:64px" aria-label="Pours"><button class="linkbtn" data-act="mc:add">Add</button></div><p class="hint">Set a pour to 0 to drop an ingredient.</p>` : `<p class="hint">Pick a menu drink; its spec appears here with editable pours.</p>`}
        </div>` + (d.drink ? stepNav("mc", 2, 5, "Cost & margin") : "");
      else if (f.type === "swap") body = `<div class="ct-editor"><div class="ct-row">${sel("mc:swapFrom", [["", "— replace —"]].concat(compsOpt), d.swapFrom)}<span class="hint">with</span>${sel("mc:swapTo", [["", "— ingredient —"]].concat(compsOpt), d.swapTo)}</div><p class="hint">Every spec and every well & call order that used the first bottle is costed and counted with the second, pours unchanged.</p></div>` + (d.swapFrom && d.swapTo && d.swapFrom !== d.swapTo ? stepNav("mc", 2, 5, "Cost & margin") : "");
      else body = `<div class="ct-editor"><div class="ct-row">${sel("mc:drink", [["", "— pick an drink —"]].concat(itemOptions(M, i => !i.byo)), d.drink)}</div><div class="ct-row"><label class="hint">Share of its volume that moves to other drinks in the section ${asmBadge("80% means four in five of its orders become another drink in the same section, in proportion to what already sells; the rest is lost.")}</label><input type="number" data-set="mc:retention" value="${d.retention}" min="0" max="100" style="width:60px"><span class="hint">%</span></div></div>` + (d.drink ? stepNav("mc", 2, 5, "Cost & margin") : "");
    } else if (f.step === 3) {
      if (!scn) body = reading("The change is not complete yet.") + stepNav("mc", 3, 5);
      else if (f.type === "new" || f.type === "lto") { const n = R.drinks.get(scn.newItems[0].id); const cu = R0.crossUtil(d.recipe);
        body = `<div class="ops-tiles">${tile(X($(n.food), { l: "Pour cost", f: "Σ pours × pour cost (after yield)", v: n.parts.map(p => [`${p.name} ×${p.pours}`, $(p.cost)]), src: SRC.cost }), "pour cost per unit")}${tile(X(pf(n.fc), { l: "Pour cost %", f: "pour cost ÷ price", v: [["Pour cost", $(n.food)], ["Price", $(n.price)]], src: SRC.cost }), `pour cost % at ${$(n.price)}`, null, n.fc > t ? "pc-hi" : "")}${tile(X($(n.priceFor), { l: `Price for ${pf(t, 0)}`, f: "pour cost ÷ target", v: [["Pour cost", $(n.food)], ["Target", pf(t, 0)]], src: SRC.cost }), `price for ${pf(t, 0)} pour cost`)}${tile($(n.cm), "contribution per unit")}${tile(cu.score == null ? "—" : pf(cu.score * 100, 0), "ingredients already at volume")}</div>
          ${reading(`<b>${esc(n.name)}</b> costs <b>${$(n.food)}</b> to make and sells at ${$(n.price)}: <b>${pf(n.fc)}</b> pour cost, ${n.fc <= t ? "under" : "over"} the ${pf(t, 0)} target${n.fc > t ? ` (${$(n.priceFor)} would hit it)` : ""}. ${cu.newLoad.length ? `It needs new bottles or prep for ${esc(cu.newLoad.join(", "))}.` : "Every ingredient already moves at volume."}`, n.fc <= t ? "ok" : "warn")}
          ${table("mc-parts", [{ k: "name", l: "Ingredient" }, { k: "category", l: "Category" }, { k: "qty", l: "Quantity", n: 1 }, { k: "unit", l: "Pour cost", n: 1, f: $ }, { k: "cost", l: "Cost", n: 1, f: $ }, { k: "cost", l: "Share", n: 1, f: v => pf(n.food ? v / n.food * 100 : null, 0) }], n.parts, { name: "new-drink-cost" })}` + stepNav("mc", 3, 5, "Ripple"); }
      else if (f.type === "pour") { const a = R.drinks.get(d.drink), b = R0.drinks.get(d.drink); const st = R.strength.find(x => x.id === d.drink), st0 = R0.strength.find(x => x.id === d.drink);
        body = `<div class="ops-tiles">${tile(`${$(b.food)} → ${X($(a.food), { l: "Pour cost after", f: "Σ new pours × pour cost", v: a.parts.map(p => [`${p.name} ×${p.pours}`, $(p.cost)]), src: SRC.cost })}`, "pour cost per unit")}${tile(`${pf(b.fc)} → ${pf(a.fc)}`, `pour cost % at ${$(a.price)}`, null, a.fc > t ? "pc-hi" : "")}${tile(`${$(b.cm)} → ${$(a.cm)}`, "contribution per unit")}${st && st0 && R.hasStrength ? tile(`${n1(st0.stdDrinks)} → ${n1(st.stdDrinks)}`, `standard drinks (${st.read.toLowerCase()})`) : ""}</div>
          ${reading(`${esc(a.name)}: pour cost ${$(b.food)} → <b>${$(a.food)}</b> (${sgn(a.food - b.food, $)}), contribution ${$(b.cm)} → <b>${$(a.cm)}</b> per unit${b.units ? `, ${sgn((a.cm - b.cm) * b.units, $0)} on ${nf(b.units)} units in ${period}` : ""}.`, a.food <= b.food ? "ok" : "warn")}
          ${table("mc-pour", [{ k: "name", l: "Ingredient" }, { k: "was", l: "Before", n: 1 }, { k: "qty", l: "After", n: 1 }, { k: "cost", l: "Cost after", n: 1, f: $ }], a.parts.map(p => { const bp = b.parts.find(x => x.cid === p.cid); return { name: p.name, was: bp ? bp.qty : "—", qty: p.qty, cost: p.cost }; }).concat(b.parts.filter(p => !a.parts.some(x => x.cid === p.cid)).map(p => ({ name: p.name, was: p.qty, qty: "0", cost: 0 }))), { name: "pour-change" })}` + stepNav("mc", 3, 5, "Ripple"); }
      else if (f.type === "swap") { const from = M.comps.get(d.swapFrom), to = M.comps.get(d.swapTo); const c0 = M.compCost(d.swapFrom, R0.refStore, R0.refDate), c1 = M.compCost(d.swapTo, R0.refStore, R0.refDate); const hit = [...R0.drinks.values()].filter(x => x.parts.some(p => p.cid === d.swapFrom)); const pk = R0.byo.picks.find(p => p.cid === d.swapFrom);
        body = `<div class="ops-tiles">${tile(`${$(c0)} → ${$(c1)}`, "pour cost, before → after")}${tile(hit.length, "menu drinks affected")}${tile(pk ? nf(pk.byoPicks) : 0, `well & call orders picking ${esc(from.name)}`)}</div>
          ${reading(`Swapping <b>${esc(from.name)}</b> for <b>${esc(to.name)}</b> changes the pour cost by ${sgn(c1 - c0, $)} everywhere it appears: ${hit.length} menu drink${hit.length === 1 ? "" : "s"} and ${pk ? nf(pk.byoPicks) : 0} well & call orders in ${period}.`, c1 <= c0 ? "ok" : "warn")}
          ${table("mc-swap", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "food0", l: "Pour cost before", n: 1, f: $ }, { k: "food1", l: "After", n: 1, f: $ }, { k: "fc1", l: "Pour cost %", n: 1, f: (v, r) => `${pf(r.fc0)} → ${pf(v)}`, cls: r => r.fc1 > t ? "pc-hi" : "" }], hit.map(x => { const a = R.drinks.get(x.id); return { name: x.name, line: x.line, food0: x.food, food1: a.food, fc0: x.fc, fc1: a.fc }; }), { name: "swap-drinks" })}` + stepNav("mc", 3, 5, "Ripple"); }
      else { const b = R0.drinks.get(d.drink); const pr = R0.ops.prep.find(p => p.id === d.drink);
        body = `<div class="ops-tiles">${tile(nf(b.units), `units in ${period}`)}${tile($k(b.rev), "net sales")}${tile($k(b.rev - b.cogs), "contribution")}${tile(b.quadrant || "—", b.read || "")}${tile(pr ? pr.exclusive.length : 0, "bottles only this drink needs")}</div>
          ${reading(`Removing <b>${esc(b.name)}</b> takes out ${$0(b.rev - b.cogs)} of contribution in ${period}; with ${d.retention}% of its volume assumed to move to other ${esc(b.line)} ${asmBadge("retention " + d.retention + "% (your setting)")}, the next step shows what comes back.${pr && pr.exclusive.length ? ` Bottles and prep that disappear with it: ${esc(pr.exclusive.join(", "))}.` : ""}`, "warn")}` + stepNav("mc", 3, 5, "Ripple"); }
    } else if (f.step === 4) {
      if (!scn) body = reading("The change is not complete yet.") + stepNav("mc", 4, 5);
      else { const T0 = R0.totals, T1 = R.totals; const rows = [...R.drinks.values()].map(x => { const b = R0.drinks.get(x.id); const gp0 = b ? b.rev - b.cogs : 0, gp1 = x.removed ? 0 : x.rev - x.cogs; return { id: x.id, name: x.name + (x.isNew ? " (new)" : "") + (x.removed ? " (removed)" : ""), line: x.line, units0: b ? b.units : 0, units1: x.removed ? 0 : x.units, fc0: b ? b.fc : null, fc1: x.fc, dgp: gp1 - gp0 }; }).filter(r => Math.abs(r.dgp) > 0.5 || Math.abs(r.units1 - r.units0) > 0.5 || (r.fc0 != null && r.fc1 != null && Math.abs(r.fc1 - r.fc0) > 0.05)).sort((a, b) => Math.abs(b.dgp) - Math.abs(a.dgp));
        const asmText = f.type === "new" || f.type === "lto" ? `${d.units} units per restaurant-week, ${d.cannibal}% pulled from the section${f.type === "lto" ? `, ${d.weeks} weeks` : ""}` : f.type === "remove" ? `${d.retention}% of its volume moves to the section` : null;
        const prep = (f.type === "new" || f.type === "lto") ? R.ops.prep.find(p => p.id === scn.newItems[0].id) : null; const cu = prep ? R0.crossUtil(d.recipe) : null;
        body = `<div class="ops-tiles">${tile(X(delta(T1.rev - T0.rev, $k), { l: "Net sales", f: "scenario − base", v: [["Base", $0(T0.rev)], ["Scenario", $0(T1.rev)]], src: SRC.sales, asm: asmText || undefined }), "net sales")}${tile(`${pf(T0.fc)} → ${X(pf(T1.fc), { l: "Mix-weighted pour cost", f: "pour cost ÷ net sales", v: [["Base", pf(T0.fc)], ["Scenario", pf(T1.fc)]], src: SRC.cost, asm: asmText || undefined })}`, "pour cost %")}${tile(X(delta(T1.gp - T0.gp, $k), { l: "Gross profit", f: "scenario − base", v: [["Base", $0(T0.gp)], ["Scenario", $0(T1.gp)]], src: SRC.sales, asm: asmText || undefined }), `gross profit, ${period}`)}${prep ? tile(`${prep.ingredients} · ${prep.categories}`, "ingredients · categories") : ""}${prep ? tile(X(nf(prep.steps), { l: "Prep steps", f: "Σ prep_steps of its ingredients (default 1)", src: "ingredients.csv prep_steps" }), "prep steps") : ""}${cu ? tile(cu.newLoad.length, "new bottles or prep", cu.newLoad.length ? `<b>New to stock or prep</b>` + ttList(cu.newLoad.map(esc)) : "") : ""}</div>
          ${reading(`Across the menu, ${T1.gp - T0.gp >= 0 ? "gross profit rises" : "gross profit falls"} <b>${sgn(T1.gp - T0.gp, $0)}</b> in ${period} and pour cost moves ${pts(T1.fc - T0.fc)}${asmText ? ` ${asmBadge(asmText)}` : ""}. ${rows.length} drink${rows.length === 1 ? "" : "s"} change.${prep ? ` Back bar: ${prep.ingredients} ingredients across ${prep.categories} categories${cu.newLoad.length ? `, new to stock or prep: ${esc(cu.newLoad.join(", "))}` : ", nothing new to stock"}.` : ""}`, T1.gp - T0.gp >= 0 ? "ok" : "warn")}
          ${table("mc-ripple", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "units1", l: "Units", n: 1, f: (v, r) => `${nf(r.units0)} → ${nf(v)}` }, { k: "fc1", l: "Pour cost %", n: 1, f: (v, r) => r.fc0 != null && Math.abs(r.fc0 - v) > 0.05 ? `${pf(r.fc0)} → ${pf(v)}` : pf(v), cls: r => r.fc1 > t ? "pc-hi" : "" }, { k: "dgp", l: "Gross profit change", n: 1, f: v => sgn(v, $0), cls: r => r.dgp < 0 ? "pc-hi" : "" }], rows, { title: "Affected drinks", name: "menu-change-ripple", maxh: 360, empty: "No drink changes." })}` + stepNav("mc", 4, 5, "Compare & export"); }
    } else {
      const cols = [{ name: "Base", R: R0 }].concat(scn ? [{ name: f.name.trim() || "Current", R }] : []).concat(f.options.map(o => ({ name: o.name, R: resultsFor(sc, o.scn), i: f.options.indexOf(o) })));
      const rows = [["Net sales", r => $k(r.totals.rev)], ["Gross profit", r => $k(r.totals.gp)], ["Pour cost %", r => pf(r.totals.fc)], ["Units", r => nf(r.totals.units)], ["Drinks over target", r => r.itemList.filter(x => !x.addon && !x.byo && x.fc > t).length], ["Ingredient uses across the menu", r => r.ops.prep.reduce((s, p) => s + p.ingredients, 0)]];
      CT.exports.set("mc-compare", { name: "menu-change-options", cols: [{ k: "metric", l: "Metric" }].concat(cols.map((c, i) => ({ k: "c" + i, l: c.name }))), rows: rows.map(([l, fn]) => Object.assign({ metric: l }, Object.fromEntries(cols.map((c, i) => ["c" + i, fn(c.R)])))) });
      body = `<div class="ct-row"><input type="text" data-set="mc:name" value="${esc(f.name)}" placeholder="Name this option" style="flex:1"><button class="linkbtn" data-act="mc:save" ${scn ? "" : "disabled"}>Save as option</button><button class="linkbtn" data-act="mc:step:1">Start another</button></div>
        <div class="ct-block"><div class="sub">Options side by side</div><div class="scroll"><table class="mini gtable"><thead><tr><th></th>${cols.map(c => `<th class="n">${esc(c.name)}${c.i != null ? ` <button class="linkbtn" data-act="mc:load:${c.i}">open</button><button class="linkbtn" data-act="mc:del:${c.i}" aria-label="Delete">✕</button>` : ""}</th>`).join("")}</tr></thead><tbody>${rows.map(([l, fn]) => `<tr><td>${esc(l)}</td>${cols.map(c => `<td class="n">${fn(c.R)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
        <div class="ct-row"><button class="tour-next" data-act="mc:summary" ${scn ? "" : "disabled"}>Open the summary</button><button class="linkbtn" data-act="csv:mc-compare">⤓ Comparison CSV</button><button class="linkbtn" data-act="mc:explore" ${scn ? "" : "disabled"}>Open in Explore → Scenarios</button></div>` + stepNav("mc", 5, 5);
    }
    return head + (f.type && f.step > 1 ? `<p class="hint" style="margin:-6px 0 4px">${esc(typeLabel)}${d && d.name ? ` · ${esc(d.name)}` : ""}</p>` : "") + body;
  }
  function mcSummary() {
    const M = data().M; const f = CT.flow.menu; const scn = mcScn(); if (!scn) return; const R0 = resultsFor({}), R = resultsFor({}, scn); const t = CT.scope.target; const d = f.def; const period = monthsLabel(M.months);
    const what = f.type === "new" || f.type === "lto" ? `${MC_TYPES.find(x => x[0] === f.type)[1]}: ${esc(d.name)} at ${$(+d.price)} (${d.recipe.map(p => esc(M.comps.get(p.cid).name) + " " + CM.fmtQty(M.comps.get(p.cid), p.pours)).join(", ")}); ${d.units} units per restaurant-week, ${d.cannibal}% pulled from the section${f.type === "lto" ? `, ${d.weeks} weeks` : ""}` : f.type === "pour" ? `Pour change: ${esc(d.name)} → ${d.recipe.map(p => esc(M.comps.get(p.cid).name) + " " + CM.fmtQty(M.comps.get(p.cid), p.pours)).join(", ")}` : f.type === "swap" ? `Swap ${esc(M.comps.get(d.swapFrom).name)} for ${esc(M.comps.get(d.swapTo).name)}` : `Remove ${esc(M.drinks.get(d.drink).name)}, ${d.retention}% of its volume moving to the section`;
    const n = scn.newItems ? R.drinks.get(scn.newItems[0].id) : null;
    const html = `<p class="sum-lead">${what}. Base: ${esc(period)}, costs as of ${R0.refDate}.</p>
      ${n ? sumTable(["Pour cost", "Price", "Pour cost %", `Price for ${pf(t, 0)}`, "Contribution"], [[$(n.food), $(n.price), pf(n.fc), $(n.priceFor), $(n.cm)]]) : ""}
      ${sumTable(["", "Base", "With the change"], [["Net sales", $0(R0.totals.rev), $0(R.totals.rev)], ["Gross profit", $0(R0.totals.gp), $0(R.totals.gp)], ["Pour cost %", pf(R0.totals.fc), pf(R.totals.fc)], ["Units", nf(R0.totals.units), nf(R.totals.units)]])}
      ${f.options.length ? `<h3>Options</h3>${sumTable(["Option", "Gross profit", "Pour cost %"], f.options.map(o => { const r = resultsFor({}, o.scn); return [esc(o.name), $0(r.totals.gp), pf(r.totals.fc)]; }))}` : ""}
      <p class="sum-foot">Volume figures rest on the stated assumptions (units per restaurant-week, share pulled from the section, retention). Costs and margins per unit are arithmetic on the data. Method: docs/methodology.md.</p>`;
    showSummary("Menu change · " + (d.name || MC_TYPES.find(x => x[0] === f.type)[1]), html);
  }

  /* ---------- Suggest new menu drinks ---------- */
  function idAct(arg) { const [k, v] = arg.split(":"); const f = CT.flow.ideas; const M = data().M; const list = CM.suggest(M, resultsFor({}), CT.scope.target);
    if (k === "open") f.open = f.open === v ? null : v;
    if (k === "eval") { const s = list.find(x => x.key === v); if (s) { CT.flow.menu.type = "new"; CT.flow.menu.def = Object.assign(mcBlank("new"), { name: (s.spirits.length ? s.spirits.join(" + ") : "Guest order") + " (listed)", line: "Cocktails", price: s.suggestedPrice, recipe: s.recipe.map(p => ({ ...p })), units: Math.max(1, Math.round(s.perStoreWeek)), cannibal: 70 }); CT.flow.menu.step = 3; CT.job = "menu"; } }
    render(); }
  function jobIdeas(M) {
    const R = resultsFor({}); const t = CT.scope.target; const list = CM.suggest(M, R, t).slice(0, 10); const f = CT.flow.ideas;
    if (!R.byo.orders) return jobHead("Suggest new menu drinks", "Needs well & call orders with modifiers.") + reading("Load modifiers.csv so the tool can see what guests order at the bar.");
    const puzzles = R.itemList.filter(x => x.quadrant === "Puzzle").sort((a, b) => b.cmUnit - a.cmUnit).slice(0, 5);
    return jobHead("Suggest new menu drinks", "Well & call orders guests already make that no menu drink offers, ranked by what they would earn: demand × contribution, favouring bottles already moving at volume and orders under the target pour cost.") +
      reading(`Scored on ${monthsLabel(M.months)}: ${X("score", { l: "Candidate score", f: "contribution per order × orders per restaurant-week × (0.5 + 0.5 × share of ingredients at volume) × min(1, target ÷ pour cost %)", src: SRC.mods + " + " + SRC.cost })} rewards orders that come in often, earn well at the price guests already pay, need no new bottle, and sit under the ${pf(t, 0)} target.`) +
      `<div class="ideas">${list.map((s, i) => `<div class="idea ${f.open === s.key ? "open" : ""}"><div class="idea-head"><span class="idea-rank">${i + 1}</span><div class="idea-title"><b>${esc(s.spirits.join(" + ") || "Guest order")}</b> <span class="hint">${esc(s.line)}</span><div class="idea-build">${esc(s.label)}</div></div>
          <div class="idea-nums">${tile(X(s.perStoreWeek.toFixed(0), { l: "Orders per restaurant-week", f: "orders of this exact combination ÷ restaurants ÷ weeks", v: [["Orders", nf(s.n)]], src: SRC.mods }), "per restaurant-week")}${tile(X($(s.suggestedPrice), { l: "Suggested price", f: "average paid for this order, rounded to 5¢", v: [["Average paid", $(s.avgPrice)], ["Price for " + pf(t, 0), $(s.priceFor)]], src: SRC.sales }), "price")}${tile(X(pf(s.fcAtPrice), { l: "Pour cost % at that price", f: "pour cost ÷ suggested price", v: [["Pour cost", $(s.unitCost)]], src: SRC.cost }), "pour cost", null, s.fcAtPrice > t ? "pc-hi" : "")}${tile(X($0(s.gpPerStoreWeek), { l: "Contribution per restaurant-week", f: "(price paid − cost) × orders per restaurant-week", src: SRC.sales }), "contribution / restaurant-week")}</div></div>
          <div class="idea-why"><div class="sub" style="margin:0 0 4px">Why</div><ul class="ct-notes">${s.why.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>
          <div class="ct-row"><button class="tour-next" data-act="id:eval:${esc(s.key)}">Evaluate as a new drink →</button><button class="linkbtn" data-act="go:explore:sales:byo">See the well & call orders</button></div></div>`).join("")}</div>
      ${puzzles.length ? `<div class="ct-block"><div class="sub">Also worth a look · profitable drinks few guests order (Puzzles)</div>${table("ideas-puzzles", [{ k: "name", l: "Drink" }, { k: "line", l: "Section" }, { k: "units", l: "Units", n: 1, f: nf }, { k: "cmUnit", l: "Contribution", n: 1, f: $ }, { k: "fcSold", l: "Pour cost %", n: 1, f: pf }, { k: "read", l: "Reading" }], puzzles, { name: "puzzles" })}</div>` : ""}`;
  }


  /* ---------- What to do: given a situation, the best course of action ---------- */
  const ADV_TYPES = [["general", "Improve pour cost", "Nothing changed; find the best moves on today's menu."], ["cost", "A bottle cost changed", "A distributor price moved, or is about to."], ["unavailable", "A bottle is unavailable", "An allocation, a shortage or a delisting: what replaces it?"], ["newComponent", "A new bottle is available", "A new product or distributor: where does it fit, and what does it earn?"], ["price", "A price change is planned", "What else should move with it?"]];
  function advBlank() { return { step: 1, type: "general", cid: "", pct: 15, iid: "", upId: "", value: "", comp: { name: "", category: "Agave", cost: "", upcharge: "" }, opts: { elasticity: -0.8, allowPortion: true, allowSwap: true, allowRemove: true, allowNew: true, maxStep: 1 }, pick: null, result: null, base: "last" }; }
  if (!CT.flow.advise) CT.flow.advise = advBlank();
  const advScope = M => CT.flow.advise.base === "all" ? {} : { months: lastMonths(M, 1) };
  function advTrigger(M) { const f = CT.flow.advise; if (f.type === "cost") return f.cid ? { type: "cost", cid: f.cid, pct: +f.pct || 0 } : null; if (f.type === "unavailable") return f.cid ? { type: "unavailable", cid: f.cid } : null; if (f.type === "newComponent") return f.comp.name && +f.comp.cost > 0 ? { type: "newComponent", comp: { name: f.comp.name, category: f.comp.category, cost: +f.comp.cost, upcharge: +f.comp.upcharge || 0 } } : null; if (f.type === "price") { if (f.upId) return +f.value >= 0 && f.value !== "" ? { type: "price", cid: f.upId, value: +f.value } : null; if (f.iid) return +f.value > 0 ? { type: "price", iid: f.iid, value: +f.value } : null; return null; } return { type: "general" }; }
  function advRun(M, pick) {
    const f = CT.flow.advise; const trig = advTrigger(M); if (!trig) return null;
    const sc = Object.assign({ target: CT.scope.target }, advScope(M)); const scope = { restaurants: null, months: sc.months ? new Set(sc.months) : null, channel: "all", target: CT.scope.target };
    const key = "A|" + CT.src + "|" + JSON.stringify([trig, f.opts, sc, pick ? [...pick] : null]);
    let r = CT.cache.get(key); if (r) return r;
    r = CM.recommend(M, scope, trig, Object.assign({}, f.opts, pick ? { pick } : {})); CT.cache.set(key, r); return r;
  }
  function advAct(arg) { const [k, ...r] = arg.split(":"); const v = r.join(":"); const f = CT.flow.advise; const M = data().M;
    if (k === "step") f.step = +v;
    else if (k === "type") { f.type = v; f.pick = null; }
    else if (k === "run") { f.pick = null; f.result = advRun(M); if (f.result) f.step = 2; }
    else if (k === "toggle") { const r = advRun(M, f.pick); if (!r) return; const set = new Set(f.pick || r.plan.map(p => p.id)); if (set.has(v)) set.delete(v); else set.add(v); f.pick = set; }
    else if (k === "reset") { f.pick = null; }
    else if (k === "explore") { const r = advRun(M, f.pick); if (r) { CT.scn = Object.assign(blankScn(), r.combined, { name: "What to do: " + advLabel(M) }); go("explore:scenarios"); } return; }
    else if (k === "price") { const r = advRun(M, f.pick); if (r) { const p = CT.flow.price; p.prices = Object.assign({}, r.combined.prices); p.ups = Object.assign({}, r.combined.upcharges); p.elasticity = f.opts.elasticity; p.base = f.base; p.step = 2; CT.job = "price"; } }
    else if (k === "menu") { const r = advRun(M, f.pick); const c = r && r.plan.find(p => p.kind === v); if (c) { const m = CT.flow.menu; if (c.kind === "new") { const n = c.scn.newItems[0]; m.type = "new"; m.def = Object.assign(mcBlank("new"), { name: n.name, line: n.line, price: n.price, recipe: n.recipe.map(p => ({ ...p })), units: n.unitsPerStoreWeek, cannibal: Math.round(n.cannibal * 100) }); } else if (c.kind === "pour") { const iid = Object.keys(c.scn.recipes)[0]; m.type = "pour"; m.def = Object.assign(mcBlank("pour"), { drink: iid, name: M.drinks.get(iid).name, recipe: c.scn.recipes[iid].map(p => ({ ...p })) }); } else if (c.kind === "swap" && c.scn.swaps) { m.type = "swap"; m.def = Object.assign(mcBlank("swap"), { swapFrom: c.scn.swaps[0].from, swapTo: c.scn.swaps[0].to }); } else if (c.kind === "remove") { m.type = "remove"; m.def = Object.assign(mcBlank("remove"), { drink: c.scn.remove[0], retention: Math.round(c.scn.retention * 100) }); } else return; m.step = 3; CT.job = "menu"; } }
    else if (k === "summary") advSummary();
    render(); }
  function advSet(a, b, value, el) { const f = CT.flow.advise;
    if (a === "cid") f.cid = value; else if (a === "pct") f.pct = value; else if (a === "iid") { f.iid = value; f.upId = ""; const M = data().M; if (value) f.value = M.itemPrice(value, null); } else if (a === "upId") { f.upId = value; f.iid = ""; const M = data().M; if (value) f.value = (M.comps.get(value) || {}).upcharge; } else if (a === "value") f.value = value; else if (a === "base") f.base = value;
    else if (a.startsWith("comp")) f.comp[a.slice(4).toLowerCase()] = value; else if (a === "el") { f.opts.elasticity = +value; el.nextElementSibling && (el.nextElementSibling.textContent = value); return; } else if (a === "maxStep") f.opts.maxStep = +value; else if (a.startsWith("allow")) f.opts[a] = !!el.checked;
    if (["iid", "upId", "base", "cid", "compStation", "maxStep"].includes(a) || a.startsWith("allow")) render(); else rerenderSoon(); }
  function advLabel(M) { const f = CT.flow.advise; const t = advTrigger(M); if (!t) return ""; if (t.type === "cost") return `${M.comps.get(t.cid).name} ${t.pct > 0 ? "+" : ""}${t.pct}%`; if (t.type === "unavailable") return `${M.comps.get(t.cid).name} unavailable`; if (t.type === "newComponent") return `${t.comp.name} available at ${$(t.comp.cost)}`; if (t.type === "price") return t.cid ? `${M.comps.get(t.cid).name} up-charge → ${$(t.value)}` : `${M.drinks.get(t.iid).name} → ${$(t.value)}`; return "improve pour cost"; }
  function jobAdvise(M) {
    const f = CT.flow.advise; const t = CT.scope.target;
    if (!M.sales.length) return jobHead("What to do", "Needs sales.") + reading("Load a sales file (and modifiers) on the Data tab so the advisor can weigh moves by what actually sells.");
    const head = jobHead("What to do", "Describe the situation; the tool tries every move it knows (repricing, call up-charges with the ladder, pour trims, bottle swaps, removals, new drinks from what guests already order at the bar), ranks them by gross profit with the rules applied, and assembles a plan you can edit and hand to the flows.") + stepper(["Describe the situation", "Best moves", "The plan"], f.step, "adv");
    const compsOpt = compOptions(M).filter(([id]) => !M.comps.get(id).transient); const menu = itemOptions(M, i => !i.byo);
    if (f.step === 1) {
      const trig = advTrigger(M);
      const form = f.type === "cost" ? `<div class="ct-row">${sel("adv:cid", [["", "— ingredient —"]].concat(compsOpt), f.cid)}<label class="hint">changes by</label><input type="number" data-set="adv:pct" value="${f.pct}" step="1" style="width:70px"><span class="hint">% (negative for a decrease)</span></div>`
        : f.type === "unavailable" ? `<div class="ct-row">${sel("adv:cid", [["", "— ingredient —"]].concat(compsOpt), f.cid)}</div>`
        : f.type === "newComponent" ? `<div class="ct-row"><input type="text" data-set="adv:compName" value="${esc(f.comp.name)}" placeholder="Name (e.g. Espolòn Blanco)" style="flex:1">${sel("adv:compStation", [...new Set([...M.comps.values()].map(c => c.category))].map(s => [s, s]), f.comp.category)}<label class="hint">cost per pour</label><input type="number" data-set="adv:compCost" value="${f.comp.cost}" step="0.05" min="0" style="width:80px" placeholder="$"><label class="hint">call up-charge</label><input type="number" data-set="adv:compUpcharge" value="${f.comp.upcharge}" step="0.05" min="0" style="width:80px" placeholder="$0"></div><p class="hint">Joins the model for this session as a bottle you can swap in or build with. To keep it, add it to ingredients.csv.</p>`
        : f.type === "price" ? `<div class="ct-row">${sel("adv:upId", [["", "— an up-charge —"]].concat([...M.comps.values()].filter(c => c.upcharge > 0).map(c => [c.id, `${c.name} up-charge (${$(c.upcharge)})`])), f.upId)}<span class="hint">or</span>${sel("adv:iid", [["", "— an drink —"]].concat(menu), f.iid)}<label class="hint">new</label><input type="number" data-set="adv:value" value="${f.value}" step="0.05" min="0" style="width:84px" placeholder="$"></div>` : `<p class="hint">Looks at drinks over target, thin call up-charges, Dogs and what guests already order at the bar.</p>`;
      return head + `<div class="adv-cards">${ADV_TYPES.map(([k, l, d]) => `<button class="job-card ${f.type === k ? "on" : ""}" data-act="adv:type:${k}"><b>${l}</b><span>${d}</span></button>`).join("")}</div>
        <div class="adv-form">${form}
          <div class="adv-opts"><span class="label">Base period</span>${sel("adv:base", [["last", `Latest month (${monthName(M.months[M.months.length - 1] || "")})`], ["all", `All months (${monthsLabel(M.months)})`]], f.base)}<span class="label">Demand ${asmBadge("Elasticity: how much volume moves when a price moves. −0.8: a 10% rise loses 8%.")}</span><input type="range" data-set="adv:el" min="-2" max="0" step="0.1" value="${f.opts.elasticity}" style="width:110px"><output>${f.opts.elasticity}</output><span class="label">Max price step</span>${sel("adv:maxStep", [[0.5, "$0.50"], [1, "$1.00"], [1.5, "$1.50"], [2, "$2.00"]], f.opts.maxStep)}
            <label><input type="checkbox" data-set="adv:allowPortion" ${f.opts.allowPortion ? "checked" : ""}> pour trims</label><label><input type="checkbox" data-set="adv:allowSwap" ${f.opts.allowSwap ? "checked" : ""}> bottle swaps</label><label><input type="checkbox" data-set="adv:allowRemove" ${f.opts.allowRemove ? "checked" : ""}> removals</label><label><input type="checkbox" data-set="adv:allowNew" ${f.opts.allowNew ? "checked" : ""}> new drinks</label></div>
          <div class="ct-row"><button class="tour-next" data-act="adv:run" ${trig ? "" : "disabled"}>Find the best moves →</button><span class="hint">${trig ? esc(advLabel(M)) : "Fill in the situation first."}</span></div>
        </div>`;
    }
    const r = advRun(M, f.pick); if (!r) { f.step = 1; return head + reading("The situation is incomplete; go back a step."); }
    const S = r.situation; const period = r.RT.scope.months.length === 1 ? monthName(r.RT.scope.months[0]) : monthsLabel(r.RT.scope.months);
    const sitTiles = S.kind === "cost" ? `<div class="ops-tiles">${tile(`${$(S.before)} → ${$(S.after)}`, `${esc(S.comps[0].name)} per pour`)}${tile(X(nf(S.usage), { l: "Pours used", f: "Σ pours in specs and modifiers of everything sold", src: SRC.cost }), `pours in ${period}`)}${tile(`${pf(S.fc0)} → ${pf(S.fc)}`, "pour cost %", null, S.fc > t ? "pc-hi" : "")}${tile(X(sgn(S.dGp, $0), { l: "Gross profit effect at current prices", f: "− pours used × cost change", v: [["Pours", nf(S.usage)], ["Change per pour", sgn(S.after - S.before, $)]], src: SRC.cost }), `gross profit, ${period}, if nothing changes`, null, S.dGp < 0 ? "pc-hi" : "")}${tile(S.drinks.length, "menu drinks use it")}</div>`
      : S.kind === "unavailable" ? `<div class="ops-tiles">${tile(S.lostItems.length, "menu drinks can't be made")}${tile(nf(S.picks.byoPicks), "well & call orders called it")}${tile(X(sgn(S.dGp, $0), { l: "If nothing is done", f: "those drinks come off the menu (with the retention assumption) and the picks pay no up-charge", src: SRC.sales, asm: `retention ${Math.round(r.opts.retention * 100)}%` }), `gross profit, ${period}, doing nothing`, null, "pc-hi")}${tile(`${pf(S.fc0)} → ${pf(S.fc)}`, "pour cost %")}</div>`
      : S.kind === "newComponent" ? `<div class="ops-tiles">${tile($(S.cost), `${esc(S.comps[0].name)} per pour`)}${tile($(S.included), "average well pour today")}${tile(S.comps[0].upcharge ? $(S.comps[0].upcharge) : "none", "planned call up-charge")}</div>`
      : S.kind === "price" ? `<div class="ops-tiles">${tile(`${pf(S.fc0)} → ${pf(S.fc)}`, "pour cost % with the planned change")}${tile(X(sgn(S.dGp, $0), { l: "Planned change on its own", f: "scenario − base", src: SRC.sales, asm: `elasticity ${r.opts.elasticity}` }), `gross profit, ${period}`)}${tile(r.RT.ladder.filter(l => l.gap < -0.05).length, "drinks it leaves below the ladder", null, r.RT.ladder.filter(l => l.gap < -0.05).length ? "pc-hi" : "")}</div>`
      : `<div class="ops-tiles">${tile(pf(S.fc0), "pour cost today", null, S.fc0 > t ? "pc-hi" : "")}${tile(r.R0.itemList.filter(x => !x.addon && !x.byo && x.fc > t).length, `drinks over the ${pf(t, 0)} target`)}${tile(r.R0.upcharges.filter(u => u.margin < 0.25 * u.upcharge).length, "thin call up-charges")}${tile($k(S.gp0), `gross profit, ${period}`)}</div>`;
    const sitRead = S.kind === "cost" ? reading(`<b>${esc(S.comps[0].name)} ${r.trigger.pct > 0 ? "up" : "down"} ${Math.abs(r.trigger.pct)}%</b>: ${$(S.before)} → ${$(S.after)} a pour. At current prices and volumes that is <b>${sgn(S.dGp, $0)}</b> of gross profit in ${period} and pour cost ${pf(S.fc0)} → ${pf(S.fc)}. It touches ${S.drinks.length} menu drink${S.drinks.length === 1 ? "" : "s"}${S.picks ? ` and ${nf(S.picks)} well & call calls` : ""}.`, S.dGp < 0 ? "warn" : "ok")
      : S.kind === "unavailable" ? reading(`Without <b>${esc(S.comps[0].name)}</b>, ${S.lostItems.length} menu drink${S.lostItems.length === 1 ? "" : "s"} (${esc(fmtList(S.lostItems.map(x => x.name), 4))}) cannot be made and ${nf(S.picks.byoPicks)} well & call orders lose their call. Doing nothing costs <b>${sgn(S.dGp, $0)}</b> in ${period}; the moves below are measured against that.`, "warn")
      : S.kind === "newComponent" ? reading(`<b>${esc(S.comps[0].name)}</b> at ${$(S.cost)} a pour${S.comps[0].upcharge ? ` with a ${$(S.comps[0].upcharge)} call up-charge` : ""}, in the ${esc(S.comps[0].category)} category. The moves below are where it earns the most: as a replacement in existing specs, or in a menu drink built from what guests already order with that category.`)
      : S.kind === "price" ? reading(`The planned change alone is worth <b>${sgn(S.dGp, $0)}</b> in ${period}${r.RT.ladder.filter(l => l.gap < -0.05).length ? ` but leaves ${r.RT.ladder.filter(l => l.gap < -0.05).length} menu drinks below their well & call price` : ""}. The moves below are what should go with it.`, r.RT.ladder.filter(l => l.gap < -0.05).length ? "warn" : "ok")
      : reading(`Pour cost is <b>${pf(S.fc0)}</b> against a ${pf(t, 0)} target in ${period}. The moves below are ranked by what they add to gross profit, discounted when they break a rule (over target, below the ladder, more than 15% volume at risk) or need bar-team sign-off.`);
    const picked = f.pick || new Set(r.plan.map(p => p.id));
    const moveCard = (c, i) => `<div class="move ${picked.has(c.id) ? "in" : ""}"><input type="checkbox" data-act="adv:toggle:${esc(c.id)}" ${picked.has(c.id) ? "checked" : ""} aria-label="Include in the plan"><div><div class="move-title">${i + 1}. ${esc(c.label)}</div><div class="move-meta"><span class="tag ${c.confidence === "data" ? "data" : "asm"}">${c.confidence === "data" ? "data" : "assumption"}</span>${c.culinary ? `<span class="tag cul">bar-team sign-off</span>` : ""}${c.overTarget ? flag("still over target", "warn") : ""}${c.volumeLoss > 0.15 ? flag(`${pf(c.volumeLoss * 100, 0)} volume at risk`, "warn") : ""}${c.fixesLadder ? flag("repairs the ladder", "ok") : ""}${c.assumes ? `<span>${esc(c.assumes)}</span>` : ""}</div><ul class="move-why">${c.reasons.filter(Boolean).map(w => `<li>${esc(w)}</li>`).join("")}</ul></div><div class="move-gain">${X(sgn(c.dGp, $0), { l: "Gross profit effect", f: c.kind === "price" ? "units kept × new contribution − units × old contribution" : c.kind === "upcharge" ? "calls kept × (Δ − lost up-charge share) + menu drinks moved" : c.kind === "pour" ? "units × pours trimmed × pour cost" : c.kind === "swap" ? "pours × (old cost − new cost)" : c.kind === "remove" ? "− its contribution + what moves to the section" : "units × contribution − what it pulls from the section", src: SRC.cost + " + " + SRC.sales, asm: c.assumes || undefined })}<small>${period}</small></div></div>`;
    if (f.step === 2) {
      return head + sitTiles + sitRead + `<div class="ct-head"><div class="sub">Moves, best first · ${r.candidates.length} considered · ticked ones make the plan</div><div class="ct-tools"><button class="linkbtn" data-act="adv:reset">Back to the suggested plan</button></div></div>
        <div class="moves">${r.candidates.map(moveCard).join("") || `<p class="empty">No move improves on ${S.kind === "unavailable" ? "doing nothing" : "today"} under these rules. Loosen the options on step 1 (a bigger price step, swaps, removals).</p>`}</div>
        ${stepNav("adv", 2, 3, "See the plan")}`;
    }
    // step 3: the plan, engine-verified
    const V = r.verified; const plan = r.plan;
    const planRead = !plan.length ? reading(`Nothing is ticked. Go back and include at least one move.`) : reading(`${plan.length === 1 ? "One move" : plan.length + " moves"}: ${esc(fmtList(plan.map(p => p.label), 3))}. Together they ${V && V.dGp >= 0 ? "add" : "cost"} <b>${V ? sgn(V.dGp, $0) : sgn(r.planDGp, $0)}</b> of gross profit in ${period} against ${S.kind === "unavailable" ? "doing nothing" : S.kind === "general" ? "today" : "leaving the change unanswered"}${V && S.kind !== "general" && S.kind !== "unavailable" ? ` (${sgn(V.dGp0, $0)} against today, before the ${S.kind === "cost" ? "cost change" : "change"})` : S.kind === "unavailable" && V ? ` (${sgn(V.dGp0, $0)} against today, with ${esc(S.comps[0].name)} still available)` : ""}; pour cost lands at <b>${V ? pf(V.fc) : "—"}</b>${V ? `, ${V.over} drink${V.over === 1 ? "" : "s"} over target${V.belowLadder ? ` and ${V.belowLadder} below the ladder` : ""}` : ""}. ${plan.some(p => p.confidence === "assumption") ? "Volume figures rest on the demand assumption; " : ""}${plan.some(p => p.culinary) ? "pour and spec moves need a taste test and the bar manager's sign-off." : ""}`, V && V.dGp >= 0 ? "ok" : "warn");
    const tiles = V ? `<div class="ops-tiles">${tile(X(sgn(V.dGp, $0), { l: "Gross profit change", f: "full engine run of the combined plan minus the baseline", v: [["Baseline", $0(r.RT.totals.gp)], ["With the plan", $0(V.gp)], ["Quick estimate (sum of moves)", sgn(r.planDGp, $0)]], src: SRC.cost + " + " + SRC.sales, asm: plan.some(p => p.assumes) ? plan.filter(p => p.assumes).map(p => p.assumes).join("; ") : undefined }), `gross profit, ${period}`, null, V.dGp < 0 ? "pc-hi" : "")}${tile(`${pf(r.RT.totals.fc)} → ${pf(V.fc)}`, "pour cost %", null, V.fc > t ? "pc-hi" : "")}${tile(`${V.over0} → ${V.over}`, "drinks over target")}${tile(V.belowLadder, "drinks below the ladder", null, V.belowLadder ? "pc-hi" : "")}${tile($k(V.rev - r.RT.totals.rev), "net sales change")}</div>` : "";
    const handoff = plan.length ? `<div class="ct-row">${plan.some(p => p.kind === "price" || p.kind === "upcharge") ? `<button class="linkbtn" data-act="adv:price">Open prices in Price change</button>` : ""}${["new", "pour", "swap", "remove"].filter(k => plan.some(p => p.kind === k && (k !== "swap" || p.scn.swaps))).map(k => `<button class="linkbtn" data-act="adv:menu:${k}">Open the ${k === "new" ? "new drink" : k === "pour" ? "pour change" : k === "swap" ? "swap" : "removal"} in Menu change</button>`).join("")}<button class="linkbtn" data-act="adv:explore">Open the whole plan in Explore → Scenarios</button><button class="tour-next" data-act="adv:summary">Open the summary</button></div>` : "";
    return head + reading(`<b>${esc(advLabel(M))}</b> · ${period}`) + tiles + planRead + `<div class="moves">${plan.map(moveCard).join("")}</div>` + handoff + stepNav("adv", 3, 3);
  }
  function advSummary() {
    const M = data().M; const f = CT.flow.advise; const r = advRun(M, f.pick); if (!r) return; const V = r.verified; const period = r.RT.scope.months.length === 1 ? monthName(r.RT.scope.months[0]) : monthsLabel(r.RT.scope.months);
    const html = `<p class="sum-lead">Situation: ${esc(advLabel(M))}. Base period ${esc(period)}, demand assumption elasticity ${f.opts.elasticity}.</p>
      ${V ? sumTable(["", "Baseline", "With the plan"], [["Gross profit", $0(r.RT.totals.gp), $0(V.gp)], ["Pour cost %", pf(r.RT.totals.fc), pf(V.fc)], ["Drinks over target", V.over0, V.over], ["Drinks below the ladder", r.RT.ladder.filter(l => l.gap < -0.05).length, V.belowLadder]]) : ""}
      <h3>The plan</h3><ol>${r.plan.map(p => `<li><b>${esc(p.label)}</b> (${sgn(p.dGp, $0)}; ${p.confidence}${p.culinary ? ", bar-team sign-off" : ""})<br><span class="hint">${esc(p.reasons.filter(Boolean).join(" · "))}</span></li>`).join("")}</ol>
      <h3>Other moves considered</h3><ul>${r.candidates.filter(c => !r.plan.includes(c)).slice(0, 8).map(c => `<li>${esc(c.label)} (${sgn(c.dGp, $0)})</li>`).join("") || "<li>none</li>"}</ul>
      <p class="sum-foot">Moves are scored with the same formulas as the scenario engine, then the chosen plan is verified with a full run. Volume effects rest on the demand assumption; cost effects are arithmetic on the data. Method: docs/methodology.md.</p>`;
    showSummary("What to do · " + advLabel(M), html);
  }

  /* ---------- wiring ---------- */
  function setUI(k, v) { CT.ui[k] = v; }
  function act(a, el) {
    const [cmd, ...rest] = a.split(":"); const arg = rest.join(":"); const M = data().M;
    const rerender = () => render();
    switch (cmd) {
      case "tab": CT.job = "explore"; CT.tab = arg; return rerender();
      case "job": CT.job = arg; if (arg === "explore" && !["costs", "sales", "scenarios", "ops", "recon"].includes(CT.tab)) CT.tab = "costs"; return rerender();
      case "go": return go(arg);
      case "rv": return rvAct(arg);
      case "pc": return pcAct(arg);
      case "mc": return mcAct(arg);
      case "id": return idAct(arg);
      case "adv": return advAct(arg);
      case "print": return printSummary(arg);
      case "src": CT.src = arg; CT.cache.clear(); CT.scope = { restaurants: null, months: null, channel: "all", target: CT.scope.target }; resetFlows(); return rerender();
      case "clear": if (confirm("Remove every loaded file, saved scenario and column mapping from this browser and go back to the sample data?")) clearAll(); return;
      case "restaurant": { const all = [...M.restaurants.keys()]; const s = CT.scope.restaurants ? new Set(CT.scope.restaurants) : new Set(all); if (s.has(arg)) { if (s.size > 1) s.delete(arg); } else s.add(arg); CT.scope.restaurants = s.size === all.length ? null : s; return rerender(); }
      case "month": { const all = M.months; const s = CT.scope.months ? new Set(CT.scope.months) : new Set(all); if (s.has(arg)) { if (s.size > 1) s.delete(arg); } else s.add(arg); CT.scope.months = s.size === all.length ? null : s; return rerender(); }
      case "tpl": return download(CM.TEMPLATES[arg].file, CM.templateCSV(arg));
      case "sample": { const S = ensureSample(); const rows = S.files[arg] || []; return download("sample-" + CM.TEMPLATES[arg].file, CM.toCSV(rows, CM.TEMPLATES[arg].cols.map(c => c.k))); }
      case "dict": return showDict(arg);
      case "map": { const f = CT.files[+arg]; if (f) f.showMap = !f.showMap; return rerender(); }
      case "rmfile": CT.files.splice(+arg, 1); return rerender();
      case "use": return useOwnData();
      case "csv": return exportCSV(arg);
      case "png": { const svg = document.querySelector("#" + arg + " svg"); if (svg) exportPNG(svg, arg); return; }
      case "drink": { const x = results(liveScn()).drinks.get(arg); if (x) showItem(x, M); return; }
      case "isort": setUI("itemSort", arg); return rerender();
      case "ssort": setUI("salesSort", arg); return rerender();
      case "ctab": setUI("costTab", arg); return rerender();
      case "stab": setUI("salesTab", arg); return rerender();
      case "otab": setUI("opsTab", arg); return rerender();
      case "ach": setUI("attachCh", arg); return rerender();
      case "byoAdd": { const cid = CT.ui.byoPick; if (cid && M.comps.has(cid)) { CT.ui.byoCalc.push({ cid, pours: +CT.ui.byoQty || 1 }); CT.ui.byoPick = ""; } return rerender(); }
      case "byoRm": CT.ui.byoCalc.splice(+arg, 1); return rerender();
      case "byoClear": CT.ui.byoCalc = []; return rerender();
      // scenario editor
      case "scnReset": CT.scn = blankScn(); return rerender();
      case "scnSave": { const name = CT.scn.name.trim() || "Scenario " + (CT.saved.length + 1); CT.scn.name = name; const i = CT.saved.findIndex(s => s.name === name); const rec = { name, scn: JSON.parse(JSON.stringify(CT.scn)), savedAt: new Date().toISOString() }; if (i >= 0) CT.saved[i] = rec; else CT.saved.push(rec); persistNow(); return rerender(); }
      case "scnLoad": CT.scn = JSON.parse(JSON.stringify(CT.saved[+arg].scn)); return rerender();
      case "scnDel": CT.saved.splice(+arg, 1); CT.compare.clear(); persistNow(); return rerender();
      case "cmpCsv": return exportCSV("compare");
      case "cmpJson": return download("scenarios.json", JSON.stringify([...CT.compare].map(i => CT.saved[i]).filter(Boolean), null, 2), "application/json");
      case "costAdd": { const c = CT.ui.costPick; if (!c) return; const v = +CT.ui.costVal; if (!Number.isFinite(v)) return; if ((CT.ui.costMode || "pct") === "pct") { CT.scn.costPct[c] = v; delete CT.scn.costAbs[c]; } else { CT.scn.costAbs[c] = v; delete CT.scn.costPct[c]; } CT.ui.open = "cost"; return rerender(); }
      case "costRm": delete CT.scn.costPct[arg]; return rerender();
      case "costRmAbs": delete CT.scn.costAbs[arg]; return rerender();
      case "priceAdd": { const i = CT.ui.pricePick; const v = +CT.ui.priceVal; if (!i || !(v > 0)) return; CT.scn.prices[i] = v; CT.ui.open = "price"; return rerender(); }
      case "priceRm": delete CT.scn.prices[arg]; return rerender();
      case "upAdd": { const c = CT.ui.upPick === "__any" ? CT.ui.upPick2 : CT.ui.upPick; const v = +CT.ui.upVal; if (!c || !(v >= 0)) return; CT.scn.upcharges[c] = v; CT.ui.open = "up"; return rerender(); }
      case "upRm": delete CT.scn.upcharges[arg]; return rerender();
      case "rmAdd": { const i = CT.ui.rmPick; if (i && !CT.scn.remove.includes(i)) CT.scn.remove.push(i); CT.ui.open = "remove"; return rerender(); }
      case "rmRm": CT.scn.remove = CT.scn.remove.filter(x => x !== arg); return rerender();
      case "swapAdd": { const f = CT.ui.swapFrom, t = CT.ui.swapTo; if (f && t && f !== t) CT.scn.swaps.push({ from: f, to: t }); CT.ui.open = "swap"; return rerender(); }
      case "swapRm": CT.scn.swaps.splice(+arg, 1); return rerender();
      case "niAdd": { const c = CT.ui.niPick; if (c && M.comps.has(c)) CT.ui.newItem.recipe.push({ cid: c, pours: +CT.ui.niQty || 1 }); CT.ui.niPick = ""; CT.ui.open = "new"; return rerender(); }
      case "niRm": CT.ui.newItem.recipe.splice(+arg, 1); return rerender();
      case "niAddItem": { const n = CT.ui.newItem; const id = "new-" + CM.slug(n.name) + "-" + (CT.scn.newItems.length + 1); CT.scn.newItems.push({ id, name: n.name, line: n.line, price: +n.price, recipe: n.recipe.map(p => ({ ...p })), unitsPerStoreWeek: +n.units || 0, cannibal: Math.min(1, Math.max(0, (+n.cannibal || 0) / 100)), weeks: n.weeks ? +n.weeks : null }); CT.ui.newItem = { name: "", line: n.line, price: n.price, recipe: [], units: n.units, cannibal: n.cannibal, weeks: n.weeks }; CT.ui.open = "new"; return rerender(); }
      case "niRmItem": CT.scn.newItems.splice(+arg, 1); return rerender();
      case "unAdd": { const c = CT.ui.unPick; if (c && !CT.scn.unavailable.includes(c)) CT.scn.unavailable.push(c); CT.ui.open = "unavail"; return rerender(); }
      case "unRm": CT.scn.unavailable = CT.scn.unavailable.filter(x => x !== arg); return rerender();
    }
  }
  function onSet(name, value, el) {
    const [k, a, b] = name.split(":");
    const rerender = () => render();
    switch (k) {
      case "channel": CT.scope.channel = value; return rerender();
      case "target": { const v = +value; if (v >= 5 && v <= 80) { CT.scope.target = v; CT.cache.clear(); rerender(); } return; }
      case "persist": CT.persist = !!el.checked; try { localStorage.setItem("ja-ct-persist", CT.persist ? "1" : "0"); } catch (e) {} if (CT.persist) persistNow(); else idb.clear(); return rerender();
      case "ftype": { const f = CT.files[+a]; if (f) { f.type = value || null; f.map = f.type ? CM.autoMap(f.type, f.headers) : {}; } return rerender(); }
      case "map": { const f = CT.files[+a]; if (f) f.map[b] = value || null; return rerender(); }
      case "itemQ": CT.ui.itemQ = value; return rerender();
      case "cmp": { if (el.checked) { if (CT.compare.size >= 3) { el.checked = false; return; } CT.compare.add(+a); } else CT.compare.delete(+a); return rerender(); }
      case "scnName": CT.scn.name = value; return;
      case "elasticity": CT.scn.elasticity = +value; el.nextElementSibling && (el.nextElementSibling.textContent = value); return rerenderSoon();
      case "retention": CT.scn.retention = +value; el.nextElementSibling && (el.nextElementSibling.textContent = Math.round(value * 100) + "%"); return rerenderSoon();
      case "niName": CT.ui.newItem.name = value; return rerenderSoon();
      case "niLine": CT.ui.newItem.line = value; return rerender();
      case "niPrice": CT.ui.newItem.price = value; return rerenderSoon();
      case "niUnits": CT.ui.newItem.units = value; return;
      case "niCannibal": CT.ui.newItem.cannibal = value; return;
      case "niWeeks": CT.ui.newItem.weeks = value; return;
      case "byoLine": CT.ui.byoLine = value; return rerender();
      case "crossItem": CT.ui.crossItem = value; return rerender();
      case "pc": return pcSet(a, b, value, el);
      case "mc": return mcSet(a, b, value, el);
      case "rv": return rvSet(a, value);
      case "adv": return advSet(a, b, value, el);
      default: CT.ui[k] = value; return;
    }
  }
  let timer = null; function rerenderSoon() { clearTimeout(timer); timer = setTimeout(render, 350); }
  function wireInputs(box) {
    const drop = box.querySelector("#ct-drop"), file = box.querySelector("#ct-file");
    if (file) file.onchange = () => { onFiles(file.files); file.value = ""; };
    if (drop) { ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); })); ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); })); drop.addEventListener("drop", e => onFiles(e.dataTransfer.files)); }
  }
  function showDict(type) {
    const t = CM.TEMPLATES[type];
    const html = `<p class="hint">${esc(t.desc)}</p><div class="scroll"><table class="mini"><thead><tr><th>Column</th><th>Required</th><th>Type</th><th>Meaning</th><th>Example</th></tr></thead><tbody>${t.cols.map(c => `<tr><td><code>${c.k}</code></td><td>${c.req ? "yes" : ""}</td><td>${c.type}${c.unit ? " · " + c.unit : ""}</td><td style="color:var(--muted)">${esc(c.desc)}</td><td style="font-family:var(--mono);font-size:11.5px">${esc(c.ex || "")}</td></tr>`).join("")}</tbody></table></div><p class="hint" style="margin-top:8px">Also recognised header names: ${t.cols.filter(c => c.aliases.length).map(c => `<b>${c.k}</b> (${c.aliases.slice(0, 5).join(", ")})`).join("; ")}.</p>`;
    openDrawer({ type: "ct", title: t.label + " · columns", html });
  }
  function showItem(x, M) {
    const html = `<div class="ops-tiles">${tile($(x.price), "price")}${tile($(x.food), "pour cost")}${tile(pf(x.fc), "pour cost %")}${tile($(x.cm), "contribution")}${tile($(x.priceFor), "price for " + CT.scope.target + "%")}</div>
      ${table("drink-" + x.id, [{ k: "name", l: "Ingredient" }, { k: "category", l: "Category" }, { k: "qty", l: "Quantity", n: 1 }, { k: "unit", l: "Pour cost", n: 1, f: $ }, { k: "cost", l: "Cost", n: 1, f: $ }, { k: "cost", l: "Share", n: 1, f: v => pf(x.food ? v / x.food * 100 : null, 0) }], x.parts, { name: "drink-" + x.id })}
      ${x.units ? `<div class="ops-tiles" style="margin-top:10px">${tile(nf(x.units), "units in scope")}${tile($(x.avgPrice), "avg paid")}${tile(pf(x.fcSold), "pour cost % as sold")}${tile($k(x.rev - x.cogs), "contribution in scope")}${x.quadrant ? tile(x.quadrant, x.read) : ""}</div>` : ""}
      <p class="hint" style="margin-top:8px">Extras: ${$(x.pkgIn)} in-house, ${$(x.pkgDig)} to-go. Costed at ${results().refDate}.</p>`;
    openDrawer({ type: "ct", title: x.name, html });
  }

  /* ---------- init ---------- */
  function init() {
    if (window.__ctInited || window.__noct) return; window.__ctInited = true; // __noct: make_og.py skips the tool so the share image renders without the sample boot
    const box = dEl("cost-out"); if (!box) return;
    box.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el || el.disabled || !box.contains(el)) return; if (el.tagName === "TR" && e.target.closest("button, select, input, a")) return; e.preventDefault(); act(el.dataset.act, el); });
    box.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-act]")) { e.preventDefault(); act(e.target.dataset.act, e.target); } });
    box.addEventListener("change", e => { const el = e.target.closest("[data-set]"); if (el && el.tagName !== "INPUT" || el && el.type === "checkbox") onSet(el.dataset.set, el.value, el); });
    box.addEventListener("input", e => { const el = e.target.closest("[data-set]"); if (el && el.tagName === "INPUT" && el.type !== "checkbox") onSet(el.dataset.set, el.value, el); });
    render();
    const boot = () => { if (CT.ready) return; try { ensureSample(); } catch (e) { console.error(e); dEl("cost-out").innerHTML = `<p class="empty">Could not build the sample dataset: ${esc(e.message)}</p>`; return; } CT.ready = true; restore().then(render, render); try { window.render && window.render(); } catch (e) {} };
    const sec = document.querySelector('.view[data-view="costs"]');
    if (sec && !sec.hidden) setTimeout(boot, 30); else { new MutationObserver(() => { if (!sec.hidden) setTimeout(boot, 30); }).observe(sec, { attributes: true, attributeFilter: ["hidden"] }); setTimeout(boot, 2500); }
  }
  window.ctSummary = () => { if (!CT.ready) return null; try { const M = data().M; if (!M.sales.length) return null; const last = M.months[M.months.length - 1]; const t = CT.scope.target; const R = resultsFor({ months: [last] }); const key = "H|" + CT.src + "|" + last + "|" + t; let best = CT.cache.get(key); if (!best) { best = CM.recommend(M, { months: new Set([last]), target: t }, { type: "general" }, { verify: false }); CT.cache.set(key, best); } const top = best.candidates[0]; return { src: CT.src, label: data().label, month: monthName(last), fc: pf(R.totals.fc), over: R.totals.fc > t, target: pf(t, 0), move: top ? `${top.label} (${sgn(top.dGp, $0)})` : null }; } catch (e) { return null; } };
  window.ctInit = init; window.CT = CT;
  init();
})();
