# Menu sources

Each restaurant's own online beverage menu, read on the dates below. No aggregators. Drink counts are after the exclusions in the README (no wine or beer by the glass, pitchers, flights, straight pours).

## José Andrés Group (read Oct 13, 2026)

- Oyamel, Jaleo, Zaytinya, China Chilcano: each restaurant's website beverage menu.
- Bazaar Meat: listed on The Bazaar's DC page.
- barmini: no cocktail menu published online; not included.

## Fabio Trabocchi Restaurants — menu sources

Captured 2026-10-14. All menus read from the restaurants' own Squarespace sites (linked from fabiotrabocchi.com). No third-party aggregators or PDFs were used for cocktails; the wine lists are hosted on binwise.com and were not needed.

## Fiola — 20 drinks
- URL: https://www.fioladc.com/beverages
- Tabbed page (Cocktails / Aperitivo / Mocktails / Wine by the Glass); read via browser accessibility tree since the hidden tab panels are not in the default page text.
- Sections: Cocktails (10), Aperitivo Cocktails (3, all $20, price given once as a section header), Zero Proof Cocktails (4, $16 section header), Mocktails (3, $16 section header). The last two both live under the "Mocktails" tab.
- Nothing odd: every drink has a price and an ingredient line. "Apricot Liquor" and other spellings kept as written.

## Fiola Mare — 18 drinks
- URL: https://www.fiolamaredc.com/beverages
- Tabbed page; each cocktail tab was clicked in the browser and read with get_page_text (prices are rendered only in the active tab).
- Sections: Signatures (3, $34), Low ABV / Spritz (2), Cocktail D'Autore (6), Classic Martinis (4, $22), Zero-Proof Cocktails (3, $19).
- Odd: "Espresso Negroni" lists no real ingredients, only the tagline "Classic, Infused with a Kick" (kept verbatim). "Ice Cold Classic Martini" ingredient line begins "50:50 Style - Gin" (kept). Typos on the menu kept ("Extra Vigin", "Frose'"). Casino Royale lists "Roll of the Dice" as if an ingredient/garnish; kept.

## Del Mar — 12 drinks
- URL: https://www.delmardc.com/beverages
- Single-page section (Cocktails + Beer tab shown by default); read with get_page_text.
- Sections: Gin & Tonics (2), Signature Cocktails (4), Del Mar Classics (4), Non-Alcoholic (2).
- Odd: the two sangrias and the Sangria Iced Tea are priced "Glass (6 oz) $25 | Carafe (5 glasses) $98" and "$15 | $40"; the glass price was used and the carafe dropped. Sangrias are wine-based but listed in the cocktail section, so included. Menu typos kept ("Grand Marinier", "Kahlua Coffe Liqueur"). Coffee-menu Carajillo ($16, rum or brandy) excluded as a duplicate of the Del Mar Classics Carajillo (different spec, but same name; the cocktail-section one was kept).

## Sfoglina — 12 drinks
- URL: https://sfoglinapasta.com/cocktails-wine (one Cocktails + Wine page covers Van Ness, Downtown and Rosslyn; only wine lists differ by location). Rosslyn is in VA; the page is shared, so it is used as the DC menu.
- Plain page; read with get_page_text.
- Sections: Spritz (3), Negroni (3), Classic (3), Zero Proof (3). Page notes "menu subject to change".
- Nothing odd beyond the drink name "Cool as a…" (ellipsis is part of the name).

## Excluded everywhere
Wine by the glass, beer, cider, after-dinner wines, spirits-by-the-pour, coffee and tea.

Total: 62 drinks.


## STARR Restaurants (Washington, DC) — menu sources

Captured 2026-10-14. All menus read from the restaurants' own sites (WordPress sites under starr-restaurants). Total: 96 drinks.

## Le Diplomate — 9 drinks
- URL: https://lediplomatedc.com/ (menu section, in-page HTML; "Cocktails" list)
- Sections: Cocktails (9)
- Notes: No zero-proof / mocktail section exists; only sodas, juices and an NA beer. A "Weekend Menu" link exists but has no separate cocktail list. Wine list is a PDF (not used).

## St. Anselm — 23 drinks
- URLs: https://stanselmdc.com/wp-content/uploads/2026/10/SADC-beverage-100526.pdf (Beverage PDF, dated 10/05/26; main cocktail list + Non-Alcoholic Mocktails) and https://stanselmdc.com/ (in-page Cocktail Hour, Lunch and Brunch menus)
- Sections: Cocktails (14, PDF), Cocktails & Martinis (Cocktail Hour) (1), Lunch Cocktails (3), Brunch Cocktails (3), Non-Alcoholic Mocktails (2)
- Notes: PDF text extracted with pypdf (no poppler on this machine). Drinks appearing on more than one menu were kept once at the main-list price: Manhattan, Cosmopolitan/Cosmo, Espresso Martini/Espresso Cocktail, Dirty Martini/Dirty Cocktail ($9 Cocktail Hour versions dropped), Vodka & Bubbles, Gold Rush, Espresso Cocktail, Sherry Cobbler, Americano, Iced Irish Coffee, Lavender Lemonade. Excluded: Mimosa Service $65 (bottle + carafe for the table), "Sparkling Rosé" under Non-Alcoholic Favorites (an NA wine), NA beer/wines and sodas.

## The Occidental — 17 drinks
- URL: https://theoccidentaldc.com/ (menu section, in-page HTML). Note: occidentaldc.com returns 502 / expired cert; the live site is theoccidentaldc.com.
- Sections: Cocktails (8), Martinis (6), Non-Alcoholic Cocktails (3)
- Notes: Excluded "The Rickhouse" $63 (served in a stacked decanter, for two — not a by-the-glass price). Two NA cocktails (Saint Agrestis Phony Negroni, Lyre's Amalfi Spritz) list no ingredients; rows left with empty ingredients. The page header for NA cocktails is typeset "nON-aLCOHOLIC COCKTAILS"; normalised to "Non-Alcoholic Cocktails". NA wines excluded.

## Pastis (DC) — 16 drinks
- URL: https://pastisdc.com/wp-content/uploads/2026/10/PASTISDC-beverage-100926.pdf (Beverage PDF, dated 100926); also https://pastisdc.com/ in-page "Nightcaps"
- Sections: Cocktails (12), Non-Alcoholic (4)
- Notes: PDF only for the main list. "Franc" carries a "(royale +4)" upgrade; base price $15 recorded. Lavender Lemonade and St. Agrestis Phony Negroni list no ingredients. Excluded from Non-Alcoholic: Fever Tree Cucumber Tonic $7 (bottled mixer) and NA wines. Nightcaps: Cafe Pastis is a duplicate of the PDF's Café Pastis; La Bonbonne $27 (mas amiel 1980) is a straight pour, excluded.

## El Presidente — 31 drinks
- URL: https://elpresidentedc.com/wp-content/uploads/2026/09/ELDENTE-beverage-091426-website.pdf (Beverage PDF, dated 09/14/26); also https://elpresidentedc.com/ in-page Brunch, Dessert and Happy Hour menus
- Sections: Specialty Cocktails (10), Featured Cocktails (5), Margaritas (7), Zero Proof Mocktail (3), Cocktails (Brunch) (3), Cocktails (Dessert) (1), Drinks (Happy Hour) (2)
- Notes: The PDF renders one word of two drink names as an image, so text extraction drops it; recorded as "Big [?] Margarita" ($28, "the margarita, but big AF") and "The [?] In The Room" ($15). Verify these names visually. Excluded: Cocina Sink $42 (shareable punch bowl), Margarita Pitchers, Roja Sangria Pitcher, Mimosa Flight, "Tecate & A Shot Of Tequila", Dessert Sippers (straight pours), happy-hour duplicates (Mini Wolf Spritzer, The Margarita $10, Frozen Pineapple Margarita $10) and the brunch Carajillo duplicate. Ms. She-La-La and My-My Chamoy-Moy are beer-based cocktails (michelada / gose), included as listed under Specialty Cocktails.

## Method
- WebFetch summaries paraphrased ingredients, so raw HTML was downloaded with curl and converted to text (scratchpad/menus/html2txt.py); PDFs extracted with pypdf (scratchpad/menus/pdf2txt.py). Raw downloads are in scratchpad/menus/dl/.
- Ingredient wording kept as printed on the menus (lowercase, menu spellings such as "demarara", "barcardi", "bahnez" preserved).

Name check (Claude, Oct 14): the two image-words in the El Presidente PDF are a donkey and an elephant, so the drinks are "Big Ass Margarita" and "The Elephant In The Room".
