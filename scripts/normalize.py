import csv, json, re, itertools, collections, sys

# (regex on lowercased raw ingredient, canonical name, category). First match wins. None = drop.
RULES = [
    # technique / non-ingredients
    (r"liquid nitrogen|bubbles|highball|aromatic cloud", None, None),
    (r"roll of the dice|infused with a kick|organic botanicals|exotic floral|^fresh fruit$|^fruit juice$|superfruit|barrel aged (negroni|manhattan)|^boba$|^ice$|^garnish|^gummy|but big af", None, None),
    (r"kas lim", "Soda water", "Mixers"),
    (r"^lemongrass$", "Lemongrass", "Herbs & spices"),
    # agave
    (r"mezcal|espad[ií]n|bosscal|montelobos", "Mezcal", "Agave"),
    (r"sotol", "Sotol", "Agave"),
    (r"reposado", "Reposado tequila", "Agave"),
    (r"tequila|milagro|hornitos|espol[oó]n|olmeca|dobel|codigo|patr[oó]n|casamigos|don julio|fortaleza|siete leguas|cazadores", "Blanco tequila", "Agave"),
    # whiskey
    (r"rye|sir davis|rittenhouse|old overholt", "Rye whiskey", "Whiskey"),
    (r"laphroaig|lagavulin|ardbeg|scotch|islay|macallan|glenlivet|glenfiddich|talisker|monkey shoulder|johnnie walker|dewar", "Scotch", "Whiskey"),
    (r"irish whiskey|jameson|redbreast|teeling|bushmills|tullamore", "Irish whiskey", "Whiskey"),
    (r"bourbon|elijah craig|buffalo trace|maker.s mark|woodford|four roses|wild turkey|eagle rare|knob creek|old forester|weller|larceny|bowman|evan williams", "Bourbon", "Whiskey"),
    (r"toki|j\. rieger whiskey|whisky|whiskey", "Whiskey", "Whiskey"),
    # gin
    (r"genever", "Genever", "Gin"),
    (r"gins?\b|las californias|nord[eé]s|hendrick|tanqueray|beefeater|bombay|plymouth|monkey 47|botanist|roku|empress|aviation|fords|sipsmith|london dry", "Gin", "Gin"),
    # vodka
    (r"vodka|ketel one|tito.s|grey goose|belvedere|absolut|chopin", "Vodka", "Vodka"),
    # rum & cane
    (r"charanda|don q|bacardi|cilantro rum|\brum\b|rhum|agricole|appleton|smith & cross|plantation|diplomatico|flor de ca[ñn]a|mount gay|facundo|\brums\b", "Rum", "Rum & cane"),
    (r"cacha[cç]a", "Cachaça", "Rum & cane"),
    # brandy / pisco / grape
    (r"pisco", "Pisco", "Brandy & pisco"),
    (r"metaxa|brandy|torres|cognac|calvados|armagnac|poire|eau de vie|grappa|hennessy|r[eé]my|martell|pierre ferrand|laird", "Brandy", "Brandy & pisco"),
    (r"tsipouro|rakomelo|raki", "Tsipouro", "Brandy & pisco"),
    (r"ouzo", "Ouzo", "Other spirits"),
    (r"shochu", "Shochu", "Other spirits"),
    (r"sake", "Sake", "Other spirits"),
    (r"absinthe", "Absinthe", "Other spirits"),
    # liqueurs & amari
    (r"magdala|orange liqueur|grand marnier|grand marin|cointreau|triple sec|cura[çc]ao|combier|orange cordial", "Orange liqueur", "Liqueurs & amari"),
    (r"aperol", "Aperol", "Liqueurs & amari"),
    (r"campari|red bitter", "Campari", "Liqueurs & amari"),
    (r"cynar", "Cynar", "Liqueurs & amari"),
    (r"amaro|montenegro|nonino|averna|meletti|lucano|ramazzotti|braulio|fernet|sfumato|zucca|underberg|china-china|picon|cloisterbitter|capasso", "Amaro", "Liqueurs & amari"),
    (r"green chartreuse", "Green Chartreuse", "Liqueurs & amari"),
    (r"yellow chartreuse", "Yellow Chartreuse", "Liqueurs & amari"),
    (r"mastiha", "Mastiha", "Liqueurs & amari"),
    (r"benedictine", "Bénédictine", "Liqueurs & amari"),
    (r"elderflower", "Elderflower liqueur", "Liqueurs & amari"),
    (r"apricot liqu", "Apricot liqueur", "Liqueurs & amari"),
    (r"licor 43", "Licor 43", "Liqueurs & amari"),
    (r"mr\. black|kahl[uú]a|coffee liqueur|tia maria|borghetti", "Coffee liqueur", "Liqueurs & amari"),
    (r"falernum", "Velvet Falernum", "Liqueurs & amari"),
    (r"sangue morlacco|cherry liqueur", "Cherry liqueur", "Liqueurs & amari"),
    (r"allspice dram", "Allspice dram", "Liqueurs & amari"),
    (r"damiana", "Mezcal", "Agave"),
    (r"artonic|melon aperitif", "Melon aperitif", "Liqueurs & amari"),
    (r"italicus|bergamot", "Italicus (bergamot)", "Liqueurs & amari"),
    (r"aperitivo select|select aperitivo|1920 select|cappelletti|ambrosia|mezzodi", "Select / Cappelletti", "Liqueurs & amari"),
    (r"ancho reyes|chile liqueur", "Chile liqueur", "Liqueurs & amari"),
    (r"red fruit liqueur|raspberry liqueur|cassis|chambord|creme de mure|cr[eè]me de m[uû]re|framboise", "Berry liqueur", "Liqueurs & amari"),
    (r"rose liqueur|violet|cr[eè]me de violette|sakura liqueur", "Floral liqueur", "Liqueurs & amari"),
    (r"peach liqueur|creme de peche|cr[eè]me de p[eê]che", "Peach liqueur", "Liqueurs & amari"),
    (r"maraschino(?! cherr)|luxardo", "Maraschino liqueur", "Liqueurs & amari"),
    (r"strega|galliano", "Strega / Galliano", "Liqueurs & amari"),
    (r"finocchietto|fennel liqueur|sambuca|anisette|pastis|ricard|pernod", "Anise liqueur", "Liqueurs & amari"),
    (r"suze|gentian|salers|av[eè]ze", "Gentian (Suze)", "Liqueurs & amari"),
    (r"pimm", "Pimm's", "Liqueurs & amari"),
    (r"drambuie|st[-.]? ?germain", "Elderflower liqueur", "Liqueurs & amari"),
    (r"frangelico|noyaux|hazelnut liqueur|nocino|amaretto|disaronno", "Nut liqueur", "Liqueurs & amari"),
    (r"centerbe|alpine herbal|herbal liqueur|g[eé]n[eé]pi|zirbenz|j[äa]germeister|br[aá]ucol|chartreuse|mirto", "Herbal liqueur", "Liqueurs & amari"),
    (r"creme de cacao|cr[eè]me de cacao|cacao liqueur|dark cacao", "Chocolate", "Herbs & spices"),
    (r"banana liqueur|cr[eè]me de banane", "Banana liqueur", "Liqueurs & amari"),
    (r"limoncello", "Limoncello", "Liqueurs & amari"),
    (r"lyre|seedlip|kentucky 74|ghia|dry london spirit|apl[oò]s|n/a aperitivo|non-?alcoholic (spirit|aperitif|gin|whiskey|bitter)|spirit-?free|ritual zero|monday gin|pentire|wilderton|\bna aperitivo|floreal|phony negroni|saint agrestis|undone", "NA spirit", "Zero-proof spirits"),
    # vermouth & fortified
    (r"vermouth|yzaguirre|dolin|vermut", "Vermouth", "Vermouth & fortified"),
    (r"oloroso|amontillado|sherry|\bpx\b", "Sherry", "Vermouth & fortified"),
    (r"mavrodaphne", "Mavrodaphne", "Vermouth & fortified"),
    (r"lillet|cocchi|cap corse|quinquina|kina|byrrh|dubonnet|americano|bonal", "Aperitif wine", "Vermouth & fortified"),
    (r"\bport\b|madeira|marsala|banyuls", "Port / Madeira", "Vermouth & fortified"),
    # wine & beer
    (r"red wine|tempranillo|sangr[ií]a roja|^red wine sangr", "Red wine", "Wine & beer"),
    (r"non-alcoholic sangr", "NA sangría", "Zero-proof spirits"),
    (r"non-?alcoholic (prosecco|sparkling|wine|ros)|n/a (prosecco|sparkling)", "NA sparkling", "Zero-proof spirits"),
    (r"cava|prosecco|champagne|sparkling wine|^sparkling$|lambrusco|franciacorta|cr[eé]mant", "Sparkling wine", "Wine & beer"),
    (r"ros[eé] wine|provence ros|^ros[eé]$", "Rosé", "Wine & beer"),
    (r"white wine|sauvignon|chardonnay|riesling|albari[ñn]o|verdejo", "White wine", "Wine & beer"),
    (r"cider", "Cider", "Wine & beer"),
    (r"ros[eé] sangr", "Rosé", "Wine & beer"),
    (r"tecate|lager|\bbeer\b|\bipa\b|stout|pilsner|saison|(?<!ginger )\bale\b|corona|modelo|pacifico|high life|michelada|kriek|lambic", "Beer", "Wine & beer"),
    # citrus
    (r"blood orange", "Blood orange", "Citrus"),
    (r"lime|lim[oó]n", "Lime", "Citrus"),
    (r"lemon verbena", "Lemon verbena", "Herbs & spices"),
    (r"lemon", "Lemon", "Citrus"),
    (r"grapefruit", "Grapefruit", "Citrus"),
    (r"yuzu|calamansi", "Yuzu", "Citrus"),
    (r"kumquat", "Kumquat", "Citrus"),
    (r"pomelo", "Grapefruit", "Citrus"),
    (r"mandarin|orange zest|marmalade|orange-thyme|^orange$|orange juice|clementine", "Orange", "Citrus"),
    (r"verjus", "Verjus", "Citrus"),
    (r"citrus", "Citrus (mixed)", "Citrus"),
    # fruit
    (r"passion ?fruit|chinola|maracuy", "Passion fruit", "Fruit"),
    (r"pineapple", "Pineapple", "Fruit"),
    (r"tamarind", "Tamarind", "Fruit"),
    (r"pomegranate|grenadine", "Pomegranate", "Fruit"),
    (r"cucumber", "Cucumber", "Fruit"),
    (r"strawberry", "Strawberry", "Fruit"),
    (r"watermelon", "Watermelon", "Fruit"),
    (r"honeydew", "Honeydew", "Fruit"),
    (r"lychee", "Lychee", "Fruit"),
    (r"peach", "Peach", "Fruit"),
    (r"cherry", "Cherry", "Fruit"),
    (r"coconut", "Coconut", "Fruit"),
    (r"apple", "Apple", "Fruit"),
    (r"tomate|tomato|tomatillo|bloody (mary )?mix", "Tomato / tomatillo", "Fruit"),
    (r"rhubarb", "Rhubarb", "Fruit"),
    (r"bell pepper", "Bell pepper", "Fruit"),
    (r"purple corn", "Purple corn", "Fruit"),
    (r"prickly pear", "Prickly pear", "Fruit"),
    (r"raspberry|blackberry|blueberry|cranberry|red fruit|mixed berr|berries", "Berry", "Fruit"),
    (r"\bpear\b", "Pear", "Fruit"),
    (r"\bfig\b", "Fig", "Fruit"),
    (r"banana(?! leaf)", "Banana", "Fruit"),
    (r"mango", "Mango", "Fruit"),
    (r"\bgrape\b", "Grape", "Fruit"),
    (r"melon", "Melon", "Fruit"),
    (r"guava", "Guava", "Fruit"),
    (r"plum|umeshu", "Plum", "Fruit"),
    (r"quince", "Quince", "Fruit"),
    (r"beet", "Beet", "Fruit"),
    (r"carrot", "Carrot", "Fruit"),
    # sweeteners
    (r"honey", "Honey", "Sweeteners"),
    (r"sugar|dem[ae]rara|simple syrup|cane syrup|^simple$|^syrup$|rich syrup|gomme|^cordial$", "Sugar", "Sweeteners"),
    (r"^agave( nectar| syrup)?$|agave nectar|agave syrup", "Agave nectar", "Sweeteners"),
    (r"vincotto|saba", "Vincotto / saba", "Sweeteners"),
    (r"orgeat|almond|hazelnut", "Nut (orgeat, hazelnut)", "Sweeteners"),
    (r"maple", "Maple", "Sweeteners"),
    (r"vanill", "Vanilla", "Sweeteners"),
    (r"chai syrup", "Chai", "Herbs & spices"),
    # bitters
    (r"angostura", "Angostura bitters", "Bitters"),
    (r"orange bitters", "Orange bitters", "Bitters"),
    (r"bitters", "Other bitters", "Bitters"),
    # herbs & spices
    (r"mint|tisane", "Mint", "Herbs & spices"),
    (r"basil", "Basil", "Herbs & spices"),
    (r"green tea|black tea|lapsang|earl grey|matcha|\btea\b", "Tea", "Herbs & spices"),
    (r"thyme", "Thyme", "Herbs & spices"),
    (r"bay leaf", "Bay leaf", "Herbs & spices"),
    (r"rosemary", "Rosemary", "Herbs & spices"),
    (r"cilantro", "Cilantro", "Herbs & spices"),
    (r"lemongrass", "Lemongrass", "Herbs & spices"),
    (r"oregano|za.atar", "Oregano / za'atar", "Herbs & spices"),
    (r"hoja santa|banana leaf", "Leaf (hoja santa, banana)", "Herbs & spices"),
    (r"juniper", "Juniper", "Herbs & spices"),
    (r"lavender|rose petal|rose water|hibiscus|chamomile|sakura|jasmine|elderflower cordial|floral", "Floral (rose, lavender)", "Herbs & spices"),
    (r"orange blossom", "Floral (rose, lavender)", "Herbs & spices"),
    (r"cumin", "Cumin", "Herbs & spices"),
    (r"cardamom", "Cardamom", "Herbs & spices"),
    (r"allspice|five spice|nutmeg|spices?|cinnamon|clove|star anise|spice foam|black pepper|pepper$", "Baking spice", "Herbs & spices"),
    (r"serrano|habañero|habanero|picante|rocoto|arbol|chile|chili|jalape|poblano|chipotle|spicy|shishito", "Chile", "Herbs & spices"),
    (r"chamoy|taj[ií]n", "Chamoy / Tajín", "Savory"),
    (r"chocolate|molito|cacao|cocoa", "Chocolate", "Herbs & spices"),
    (r"espresso|coffee|cold brew|la colombe", "Coffee", "Herbs & spices"),
    (r"celery", "Celery", "Herbs & spices"),
    (r"saffron|turmeric|sage|tarragon|dill|shiso|lemon balm|fennel|herb[es]* de provence", "Herb / spice (other)", "Herbs & spices"),
    # mixers
    (r"tonic", "Tonic", "Mixers"),
    (r"ginger ale|ginger|jengibre", "Ginger", "Mixers"),
    (r"gatorade|sports drink", "Sports drink", "Mixers"),
    (r"coca-cola|cola", "Cola", "Mixers"),
    (r"soda|sparkling water|kas|seltzer", "Soda water", "Mixers"),
    (r"kombucha", "Kombucha", "Mixers"),
    (r"^water$", None, None),
    # dairy & egg
    (r"egg white", "Egg white", "Dairy & egg"),
    (r"yogurt|labneh|dairy|cream|milk|half & half|butter|horchata", "Dairy", "Dairy & egg"),
    (r"whole egg|egg yolk|^egg$", "Egg", "Dairy & egg"),
    # savory
    (r"brine|pickle", "Brine / pickles", "Savory"),
    (r"salt|sal de gusano", "Salt / salt air", "Savory"),
    (r"olive(?! oil)", "Olive", "Savory"),
    (r"maggi|worcestershire", "Savory sauce", "Savory"),
    (r"olive oil", "Olive oil", "Savory"),
    (r"lime air", "Lime", "Citrus"),
    (r"aromatic cloud", None, None),
]

ZERO_SECTION = re.compile(r"zero|non-?alcoholic|spirit-?free|alcohol-?free|mocktail|\bn/?a\b|temperance", re.I)

def canon(raw):
    s = raw.strip().lower()
    for pat, name, cat in RULES:
        if re.search(pat, s):
            return name, cat
    return "UNMAPPED:" + raw, "?"

drinks = []
with open(sys.argv[1], newline="") as f:
    for row in csv.DictReader(f, delimiter="\t"):
        ings = []
        parts = []
        for raw in row["ingredients"].split(";"):
            if not raw.strip():
                continue
            parts.append([raw.strip(), canon(raw)[0] or ""])
            name, cat = canon(raw)
            if name and name not in [i["name"] for i in ings]:
                ings.append({"name": name, "cat": cat, "raw": raw.strip()})
        price = row["price"].strip()
        drinks.append({
            "group": row.get("group") or "José Andrés Group",
            "restaurant": row["restaurant"], "section": row["section"], "drink": row["drink"],
            "price": float(price) if price else None,  # None = menu lists no price
            "zero": bool(ZERO_SECTION.search(row["section"])),
            "ings": ings, "parts": parts,
        })

unm = [i["raw"] for d in drinks for i in d["ings"] if i["name"].startswith("UNMAPPED")]
if unm:
    print("UNMAPPED:", unm); sys.exit(1)

json.dump(drinks, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
cnt = collections.Counter(i["name"] for d in drinks for i in d["ings"])
pairs = collections.Counter()
for d in drinks:
    for a, b in itertools.combinations(sorted(i["name"] for i in d["ings"]), 2):
        pairs[(a, b)] += 1
print(len(drinks), "drinks,", len(cnt), "ingredients")
print("top ingredients:", cnt.most_common(15))
print("top pairs:", pairs.most_common(15))
