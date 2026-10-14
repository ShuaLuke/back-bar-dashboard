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


## NRG menu sources (read 2026-10-14)

All menus are Wix-hosted PDFs linked from each restaurant's homepage (no HTML menu pages; /menus returns 404). PDFs were downloaded to scratchpad/menus/pdfs/.

## ChurchKey — 11 drinks
- https://www.churchkeydc.com/_files/ugd/e9c881_9aac0857f392404cbd8448bee44db334.pdf ("Drafts + Drinks", Fall; page 2 "CKDC Wines + Cocktails") — 8 cocktails
- https://www.churchkeydc.com/_files/ugd/5c8ca5_73dd61e85a324b9f95e91e2656f6e36a.pdf (Happy Hour M-F 4-6) — 3 added (Daquiri, Old Fashioned, Manhattan at $8); HH Martini skipped as duplicate of Classic Martini
- "Alcohol Free" section is NA beer/kombucha only — excluded. No zero-proof cocktails.

## Birch & Barley — not captured
- Closed July 2024; replaced by Mallard (https://www.mallarddc.com/) in the same space. Not on neighborhoodrestaurantgroup.com/ourbrands. Skipped.

## The Sovereign — 16 drinks
- https://www.thesovereigndc.com/_files/ugd/422236_0e6d2639b48c4e6ea41262c0f6489b95.pdf (Wine & cocktails) — 8 "Spirited" + 2 "Free-Spirited" (zero-proof)
- https://www.thesovereigndc.com/_files/ugd/422236_20b0fc53f57c4d08a910ae1dd9665492.pdf (Brunch) — 4 brunch cocktails; build-your-own mimosa/spritz bars (serve 4-6) excluded as pitchers
- https://www.thesovereigndc.com/_files/ugd/422236_2d9536fbeaaa483796a6f61b557859d4.pdf (Happy hour) — Americano and Pastis Spritz at $6, no ingredients listed; Belgian Sour and Getting Alsace-y already captured

## Iron Gate — 12 drinks
- https://www.irongaterestaurantdc.com/_files/ugd/41d8eb_7e032fa9ea8349f582cd38b26b50ad22.pdf (Dinner; cocktails + "Spirit Free Drinks" on the menu) — 8 cocktails, 4 spirit-free
- Wine PDF (ea7e5d_abed9b50f1604e94830f40226f869d42.pdf) is a 20-page wine book, not read.

## Bluejacket / The Arsenal — 0 drinks (no cocktail menu online)
- Site button "whiskeys, wines & cocktails" links to https://www.bluejacketdc.com/_files/ugd/ea7e5d_58ee9dcafa9e4e8a9753cda6c753eb0a.pdf, which is the same file as "retail offerings": PDF title "Bluejacket Retail Can Menu 10.9.26", contents are beer to-go + merch only. The cocktail menu appears to be mislinked on the site.
- Dinner PDF https://www.bluejacketdc.com/_files/ugd/ea7e5d_58fc54a3b8534ec19197e4b8291a10ad.pdf read: food and dessert only, no drinks.
- Brunch PDF (ea7e5d_7085c2a18b1f44f3838838d8bf5ba8ac.pdf): food only. Drafts PDF (ea7e5d_808023c79edc4dc4ba60793e534b381a.pdf): beer only.
- The Arsenal has no separate website or cocktail list (only appears in the OpenTable slug). Skipped.
