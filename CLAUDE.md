# Project notes

Static, single-page dashboard. No framework, no bundler. D3 v7.8.5 is loaded from cdnjs.

- Edit `src/template.html`, then run `python3 scripts/build.py` to regenerate `index.html`. Never edit `index.html` by hand.
- Data changes: edit `data/drinks_raw.tsv`, then run `scripts/normalize.py` before building. Add a rule to `RULES` in normalize.py for any new ingredient wording. The script fails loudly on unmapped ingredients.
- Each drink in drinks.json has `ings` (deduped canonical ingredients with `cat`) and `parts` (every menu ingredient line as `[raw, canonical]`, used for display).
- Categories (`cat`) roll up to 9 families via `CAT2FAM` in the template. Family colors are the `--f-*` CSS tokens.
- Light theme only, by design. Brand: "Back Bar" (placeholder name), aperitivo orange `--accent`, teal `--teal`, fonts Geist + Geist Mono.
- Main JS entry points: `render()` re-renders everything on filter change; `setView(name)` switches views (`overview`, `ingredients`, `matrix`, `map`, `prep`, `price`, `gaps`, `costs`, `about`). `renderChord`, `renderOps`, `renderOverview` and `renderCosts` each own one view.
- `og.png` (link preview, 1200x630) is rendered by `scripts/make_og.py` from `src/og-card.html` plus a screenshot of the built page. Re-run it after visible Overview or data changes. og:image URLs point at https://shualuke.github.io/back-bar-dashboard/.
- Template content above `<!--BODY-->` is emitted into `<head>` by build.py.
- Tooltips: give any element `data-tip="<html>"` (use `tipAttr()`, `ttRows()`, `ttList()`). One delegated handler does hover on desktop, tap-to-show / tap-again-to-open on touch, and focus for keyboard.
- The `costs` view uses made-up, adjustable per-ingredient-type costs (`COST_DEFAULT`). Keep it labeled as assumed, never as real restaurant costs.
- Overview must fit one desktop screen (no page scroll) at 1280×720 and up; check this after layout changes.
- Good next steps: split the template into css/js modules, add Vite, and add a monthly menu re-scrape to track changes.
