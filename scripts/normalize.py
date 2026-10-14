import csv, json, re, itertools, collections, sys

# (regex on lowercased raw ingredient, canonical name, category). First match wins. None = drop.
RULES = [
    # technique / non-ingredients
    (r"liquid nitrogen|bubbles|highball|aromatic cloud", None, None),
    (r"kas lim", "Soda water", "Mixers"),
    (r"^lemongrass$", "Lemongrass", "Herbs & spices"),
    # agave
    (r"mezcal|espad[ií]n|bosscal|montelobos", "Mezcal", "Agave"),
    (r"sotol", "Sotol", "Agave"),
    (r"reposado", "Reposado tequila", "Agave"),
    (r"tequila|milagro|hornitos|espol[oó]n|olmeca|dobel", "Blanco tequila", "Agave"),
    # whiskey
    (r"rye|sir davis", "Rye whiskey", "Whiskey"),
    (r"bourbon|elijah craig", "Bourbon", "Whiskey"),
    (r"toki|j\. rieger whiskey|whisky|whiskey", "Whiskey", "Whiskey"),
    # gin
    (r"gin\b|las californias|nord[eé]s|hendrick", "Gin", "Gin"),
    # vodka
    (r"vodka", "Vodka", "Vodka"),
    # rum & cane
    (r"charanda|don q|bacardi|cilantro rum|\brum\b", "Rum", "Rum & cane"),
    (r"cacha[cç]a", "Cachaça", "Rum & cane"),
    # brandy / pisco / grape
    (r"pisco", "Pisco", "Brandy & pisco"),
    (r"metaxa|brandy|torres|cognac", "Brandy", "Brandy & pisco"),
    (r"tsipouro", "Tsipouro", "Brandy & pisco"),
    (r"ouzo", "Ouzo", "Other spirits"),
    (r"shochu", "Shochu", "Other spirits"),
    (r"sake", "Sake", "Other spirits"),
    (r"absinthe", "Absinthe", "Other spirits"),
    # liqueurs & amari
    (r"magdala|orange liqueur|grand marnier", "Orange liqueur", "Liqueurs & amari"),
    (r"aperol", "Aperol", "Liqueurs & amari"),
    (r"campari", "Campari", "Liqueurs & amari"),
    (r"cynar", "Cynar", "Liqueurs & amari"),
    (r"amaro", "Amaro", "Liqueurs & amari"),
    (r"green chartreuse", "Green Chartreuse", "Liqueurs & amari"),
    (r"yellow chartreuse", "Yellow Chartreuse", "Liqueurs & amari"),
    (r"mastiha", "Mastiha", "Liqueurs & amari"),
    (r"benedictine", "Bénédictine", "Liqueurs & amari"),
    (r"elderflower", "Elderflower liqueur", "Liqueurs & amari"),
    (r"apricot liqueur", "Apricot liqueur", "Liqueurs & amari"),
    (r"licor 43", "Licor 43", "Liqueurs & amari"),
    (r"mr\. black", "Coffee liqueur", "Liqueurs & amari"),
    (r"falernum", "Velvet Falernum", "Liqueurs & amari"),
    (r"sangue morlacco|cherry liqueur", "Cherry liqueur", "Liqueurs & amari"),
    (r"allspice dram", "Allspice dram", "Liqueurs & amari"),
    (r"damiana", "Mezcal", "Agave"),
    (r"artonic|melon aperitif", "Melon aperitif", "Liqueurs & amari"),
    (r"lyre|seedlip|kentucky 74|ghia", "NA spirit", "Zero-proof spirits"),
    # vermouth & fortified
    (r"vermouth|yzaguirre|dolin|vermut", "Vermouth", "Vermouth & fortified"),
    (r"oloroso|amontillado|sherry|\bpx\b", "Sherry", "Vermouth & fortified"),
    (r"mavrodaphne", "Mavrodaphne", "Vermouth & fortified"),
    # wine & beer
    (r"red wine|tempranillo|sangr[ií]a roja|^red wine sangr", "Red wine", "Wine & beer"),
    (r"non-alcoholic sangr", "NA sangría", "Zero-proof spirits"),
    (r"cava", "Cava", "Wine & beer"),
    (r"ros[eé] sangr", "Rosé", "Wine & beer"),
    (r"tecate|lager", "Beer", "Wine & beer"),
    # citrus
    (r"blood orange", "Blood orange", "Citrus"),
    (r"lime|lim[oó]n", "Lime", "Citrus"),
    (r"lemon verbena", "Lemon verbena", "Herbs & spices"),
    (r"lemon", "Lemon", "Citrus"),
    (r"grapefruit", "Grapefruit", "Citrus"),
    (r"mandarin|orange zest|marmalade|orange-thyme|^orange$", "Orange", "Citrus"),
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
    (r"tomate|tomato|tomatillo", "Tomato / tomatillo", "Fruit"),
    (r"purple corn", "Purple corn", "Fruit"),
    # sweeteners
    (r"honey", "Honey", "Sweeteners"),
    (r"sugar", "Sugar", "Sweeteners"),
    (r"maple", "Maple", "Sweeteners"),
    (r"vanilla", "Vanilla", "Sweeteners"),
    (r"chai syrup", "Chai", "Herbs & spices"),
    # bitters
    (r"angostura", "Angostura bitters", "Bitters"),
    (r"orange bitters", "Orange bitters", "Bitters"),
    (r"bitters", "Other bitters", "Bitters"),
    # herbs & spices
    (r"mint|tisane", "Mint", "Herbs & spices"),
    (r"thyme", "Thyme", "Herbs & spices"),
    (r"bay leaf", "Bay leaf", "Herbs & spices"),
    (r"rosemary", "Rosemary", "Herbs & spices"),
    (r"cilantro", "Cilantro", "Herbs & spices"),
    (r"lemongrass", "Lemongrass", "Herbs & spices"),
    (r"oregano|za.atar", "Oregano / za'atar", "Herbs & spices"),
    (r"hoja santa|banana leaf", "Leaf (hoja santa, banana)", "Herbs & spices"),
    (r"juniper", "Juniper", "Herbs & spices"),
    (r"lavender|rose petal", "Floral (rose, lavender)", "Herbs & spices"),
    (r"orange blossom", "Floral (rose, lavender)", "Herbs & spices"),
    (r"cumin", "Cumin", "Herbs & spices"),
    (r"cardamom", "Cardamom", "Herbs & spices"),
    (r"allspice|five spice|nutmeg|spices", "Baking spice", "Herbs & spices"),
    (r"serrano|habañero|habanero|picante|rocoto|arbol|chile", "Chile", "Herbs & spices"),
    (r"chocolate|molito", "Chocolate", "Herbs & spices"),
    (r"espresso", "Coffee", "Herbs & spices"),
    (r"celery", "Celery", "Herbs & spices"),
    # mixers
    (r"tonic", "Tonic", "Mixers"),
    (r"ginger ale|ginger", "Ginger", "Mixers"),
    (r"coca-cola|cola", "Cola", "Mixers"),
    (r"soda|sparkling water|kas", "Soda water", "Mixers"),
    (r"^water$", None, None),
    # dairy & egg
    (r"egg white", "Egg white", "Dairy & egg"),
    (r"yogurt|labneh|dairy", "Dairy", "Dairy & egg"),
    # savory
    (r"salt|sal de gusano", "Salt / salt air", "Savory"),
    (r"maggi|worcestershire", "Savory sauce", "Savory"),
    (r"olive oil", "Olive oil", "Savory"),
    (r"lime air", "Lime", "Citrus"),
    (r"aromatic cloud", None, None),
]

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
            parts.append([raw.strip(), canon(raw)[0] or ""])
            name, cat = canon(raw)
            if name and name not in [i["name"] for i in ings]:
                ings.append({"name": name, "cat": cat, "raw": raw.strip()})
        drinks.append({
            "restaurant": row["restaurant"], "section": row["section"], "drink": row["drink"],
            "price": float(row["price"]), "zero": row["section"] == "Zero-proof",
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
