"""Generate synthetic Indian Food Knowledge Graph ontology fixture (Tier M).

Based on the Indian Food Knowledge Graph reference design:
Classes:
    Recipe, Ingredient, Dish, Region, Diet, Cuisine, FoodProduct,
    NutritionalInfo, CookingMethod, Course, MealType

Object Properties:
    hasIngredient, hasCuisine, hasRegion, belongsToDiet, hasCookingMethod,
    isCourseof, servedAs, hasMealType, hasNutritionalInfo, contains, pairsWellWith

Data Properties:
    calories, protein, fat, carbohydrates, preparationTime,
    servingSize, isVegetarian, isVegan, spiceLevel

Output:
    fixtures/food_ontology.owl (RDF/XML)
    fixtures/food_profile.json
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import pyoxigraph as ox

BASE_IRI = "http://foodkg.org/ontology/food#"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"
XSD = "http://www.w3.org/2001/XMLSchema#"

# Prefixes dictionary
PREFIXES = {
    "food": BASE_IRI,
    "rdf": RDF,
    "rdfs": RDFS,
    "owl": OWL,
    "xsd": XSD,
}

CUISINES = [
    "North Indian", "South Indian", "Mughlai", "Chettinad", "Bengali", "Gujarati",
    "Kashmiri", "Goan", "Awadhi", "Rajasthani", "Maharashtrian", "Malabar",
    "Udupi", "Hyderabadi", "Punjabi", "Assamese", "Odia", "Bihari",
    "Mangalorean", "Sindhi", "Parsi", "Konkani", "Bhojpuri", "Naga",
    "Manipuri", "Mizo", "Kumaoni", "Garhwali", "Haryanvi", "Himachali",
    "Ladakhi", "Andhra", "Telangana", "Rayalaseema", "Kerala Traditional",
    "Tamil Nadu Brahmin", "Kannada", "Coorgi", "Saurashtra", "Malvani",
    "Kolhapuri", "Vidarbha", "Khandeshi", "Marwari", "Shekhawati",
    "Mewari", "Dhundhari", "Hadoti", "Braj", "Bundelkhandi"
]

REGIONS = [
    "Punjab", "Tamil Nadu", "Kerala", "West Bengal", "Gujarat", "Maharashtra",
    "Rajasthan", "Jammu and Kashmir", "Andhra Pradesh", "Uttar Pradesh", "Goa",
    "Karnataka", "Odisha", "Assam", "Telangana", "Bihar", "Himachal Pradesh",
    "Uttarakhand", "Madhya Pradesh", "Haryana", "Delhi", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Tripura", "Sikkim", "Ladakh", "Puducherry", "Chandigarh"
]

DIETS = [
    ("Vegetarian", True, False),
    ("Vegan", True, True),
    ("Jain", True, True),
    ("Lacto-Vegetarian", True, False),
    ("Ovo-Vegetarian", True, False),
    ("Keto", False, False),
    ("Gluten-Free", True, False),
    ("Satvik", True, False),
    ("Halal", False, False),
    ("Diabetic-Friendly", True, False),
]

COOKING_METHODS = [
    "Dum", "Tadka", "Tandoor", "Bhunao", "Talna", "Steam", "Ferment", "Roast",
    "Simmer", "Deep-Fry", "Shallow-Fry", "Bake", "Slow-Cook", "Grate",
    "Marinate", "Saute", "Blanch", "Pickle", "Smoke", "Temper"
]

COURSES = [
    "Appetizer", "Main Course", "Side Dish", "Dessert", "Beverage",
    "Soup", "Salad", "Bread", "Rice Dish", "Snack"
]

MEAL_TYPES = [
    "Breakfast", "Brunch", "Lunch", "High Tea", "Dinner",
    "Midnight Snack", "Festival Meal", "Fasting Meal"
]

INGREDIENTS = [
    # Spices & Herbs (50)
    "Basmati Rice", "Cumin Seeds", "Mustard Seeds", "Turmeric Powder", "Red Chilli Powder",
    "Garam Masala", "Coriander Seeds", "Asafoetida (Hing)", "Fenugreek Seeds", "Fennel Seeds",
    "Cardamom Pods", "Black Cardamom", "Cloves", "Cinnamon Bark", "Bay Leaves",
    "Star Anise", "Nutmeg", "Mace", "Black Pepper", "Ginger",
    "Garlic", "Green Chillies", "Curry Leaves", "Fresh Coriander", "Mint Leaves",
    "Kasuri Methi", "Chaat Masala", "Sambar Powder", "Rasam Powder", "Pav Bhaji Masala",
    "Biryani Masala", "Panch Phoron", "Amchur (Dry Mango)", "Anardana (Pomegranate)", "Carom Seeds (Ajwain)",
    "Black Salt (Kala Namak)", "Kashmiri Mirch", "Degi Mirch", "Dry Ginger (Saunth)", "White Pepper",
    "Kalpasi (Stone Flower)", "Marathi Moggu", "Kewra Water", "Rose Water", "Saffron Strands",
    "Kokum", "Tamarind Pulp", "Citric Acid", "Kalonji (Nigella)", "Poppy Seeds (Khus Khus)",
    # Oils, Fats & Dairy (25)
    "Desi Ghee", "Mustard Oil", "Coconut Oil", "Sesame Oil", "Groundnut Oil",
    "Sunflower Oil", "Paneer (Cottage Cheese)", "Curd (Dahi)", "Khoya (Mawa)", "Whole Milk",
    "Fresh Cream", "White Butter (Makhan)", "Clarified Butter", "Chenna", "Hung Curd",
    "Buttermilk (Chaas)", "Condensed Milk", "Cheddar Cheese", "Malai", "Skimmed Milk",
    "Yak Butter", "Goat Milk", "Buffalo Milk", "Almond Milk", "Soy Milk",
    # Lentils, Pulses & Legumes (25)
    "Moong Dal", "Toor Dal (Arhar)", "Urad Dal", "Chana Dal", "Masoor Dal",
    "Rajma (Kidney Beans)", "Kabuli Chana", "Kala Chana", "Black Eyed Peas (Lobia)", "Green Moong (Sabut)",
    "Horse Gram (Kulthi)", "Moth Beans", "White Peas (Safed Vatana)", "Soybeans", "Dry Green Peas",
    "Roasted Gram (Chana)", "Yellow Split Peas", "Urad Chilka Dal", "Moong Chilka Dal", "Whole Masoor",
    "Sprouted Moong", "Sprouted Chana", "Field Beans (Avarai)", "Bengal Gram", "Red Lentils",
    # Flours & Grains (25)
    "Whole Wheat Flour (Atta)", "Refined Flour (Maida)", "Chickpea Flour (Besan)", "Rice Flour", "Semolina (Sooji)",
    "Ragi Flour (Finger Millet)", "Bajra Flour (Pearl Millet)", "Jowar Flour (Sorghum)", "Makki Atta (Cornmeal)", "Singhare Ka Atta",
    "Kuttu Ka Atta (Buckwheat)", "Poha (Flattened Rice)", "Sabudana (Tapioca Pearls)", "Idli Rice", "Brown Rice",
    "Broken Wheat (Dalia)", "Barley (Jau)", "Amaranth (Rajgira)", "Barnyard Millet (Sanwa)", "Foxtail Millet (Kangni)",
    "Kodo Millet", "Little Millet", "Proso Millet", "Cornstarch", "Breadcrumbs",
    # Vegetables & Produce (45)
    "Red Onion", "Potato (Aloo)", "Roma Tomato", "Cauliflower (Gobi)", "Green Peas (Matar)",
    "Spinach (Palak)", "Fenugreek Leaves (Methi)", "Bitter Gourd (Karela)", "Bottle Gourd (Lauki)", "Eggplant (Brinjal)",
    "Okra (Bhindi)", "Ridge Gourd (Turai)", "Colocasia (Arbi)", "White Radish (Mooli)", "Carrot (Gajar)",
    "Beetroot (Chukandar)", "Cabbage (Patta Gobi)", "Green Bell Pepper", "Red Bell Pepper", "Yellow Bell Pepper",
    "Raw Mango (Kaccha Aam)", "Drumsticks (Sahjan)", "Fresh Coconut", "Desiccated Coconut", "Lemon",
    "Lime", "Sweet Potato (Shakarkand)", "Ivy Gourd (Kundru)", "Pointed Gourd (Parwal)", "Ash Gourd (Petha)",
    "Snake Gourd (Chichinda)", "Cluster Beans (Gwar Phali)", "French Beans", "Pumpkin (Kaddu)", "Turnip (Shalgam)",
    "Mushroom (Button)", "Mushroom (Shiitake)", "Lotus Stem (Kamal Kakdi)", "Elephant Foot Yam (Jimikand)", "Raw Banana (Kaccha Kela)",
    "Banana Flower (Kele Ka Phool)", "Plantain Stem", "Amaranth Greens (Chaulai)", "Mustard Greens (Sarson)", "Bathua Leaves",
    # Nuts, Seeds & Sweeteners (30)
    "Cashew Nuts (Kaju)", "Almonds (Badam)", "Pistachios (Pista)", "Golden Raisins (Kishmish)", "Walnuts (Akhrot)",
    "Peanuts (Moongphali)", "White Sesame Seeds (Til)", "Black Sesame Seeds", "Watermelon Seeds (Magaz)", "Muskmelon Seeds",
    "Sunflower Seeds", "Chia Seeds", "Flaxseeds", "Jaggery (Gud)", "Organic Cane Sugar",
    "Brown Sugar", "Palm Jaggery", "Bura Sugar", "Honey", "Rock Sugar (Mishri)",
    "Dates (Khajoor)", "Dry Figs (Anjeer)", "Dry Coconut (Kopra)", "Chironji Seeds", "Lotus Seeds (Makhana)",
    "Dry Dates (Chhuara)", "Apricots (Jardalu)", "Coconut Sugar", "Molasses", "Stevia Leaves"
]

DISHES = [
    # Rice & Biryani (10)
    "Hyderabadi Dum Biryani", "Lucknowi Biryani", "Jeera Rice", "Curd Rice", "Lemon Rice",
    "Bisi Bele Bath", "Khichdi", "Pulao Matar", "Vangi Bath", "Kashmiri Pulao",
    # Breads & Roti (10)
    "Tandoori Roti", "Garlic Naan", "Butter Naan", "Rumali Roti", "Lachha Paratha",
    "Aloo Paratha", "Bhatura", "Puri", "Missi Roti", "Bhakri",
    # Curries & Gravies (20)
    "Butter Chicken", "Rogan Josh", "Paneer Tikka Masala", "Dal Makhani", "Palak Paneer",
    "Chana Masala", "Kadhai Paneer", "Sambar", "Rasam", "Dal Tadka",
    "Korma Navratan", "Malai Kofta", "Bhindi Do Pyaza", "Baingan Bharta", "Aloo Gobi",
    "Rajma Masala", "Fish Curry Malabar", "Chicken Chettinad", "Lauki Kofta", "Dum Aloo Kashmiri",
    # South Indian Tiffin (10)
    "Masala Dosa", "Plain Idli", "Medu Vada", "Rava Upma", "Ven Pongal",
    "Appam", "Idiyappam", "Pesarattu", "Uttapam", "Set Dosa",
    # Street Food & Chaat (15)
    "Pani Puri", "Sev Puri", "Bhel Puri", "Vada Pav", "Pav Bhaji",
    "Dahi Puri", "Aloo Tikki", "Samosa", "Kachori", "Dhokla",
    "Khandvi", "Misal Pav", "Ragda Pattice", "Dabeli", "Papdi Chaat",
    # Regional Specialties (15)
    "Litti Chokha", "Dal Baati Churma", "Gatte Ki Sabzi", "Undhiyu", "Shukto",
    "Kosha Mangsho", "Pork Vindaloo", "Bebinca", "Thukpa", "Momos",
    "Sarson Ka Saag", "Makki Di Roti", "Hyderabadi Haleem", "Pothichoru", "Avial",
    # Desserts & Sweets (15)
    "Gulab Jamun", "Jalebi", "Rasgulla", "Kaju Katli", "Mysore Pak",
    "Gajar Ka Halwa", "Rasmalai", "Sandesh", "Payasam", "Shrikhand",
    "Modak", "Peda Mathura", "Besan Ladoo", "Kheer", "Phirni",
    # Beverages (5)
    "Masala Chai", "Filter Coffee", "Mango Lassi", "Thandai", "Sol Kadhi"
]

FOOD_PRODUCTS = [
    ("MDH Garam Masala Pack", ["Garam Masala", "Coriander Seeds", "Cumin Seeds", "Black Pepper", "Cardamom Pods"]),
    ("Everest Turmeric Powder", ["Turmeric Powder"]),
    ("Tata Sampann Toor Dal", ["Toor Dal (Arhar)"]),
    ("Tata Sampann Chana Dal", ["Chana Dal"]),
    ("Amul Pure Cow Ghee", ["Desi Ghee"]),
    ("Aashirvaad Superior MP Atta", ["Whole Wheat Flour (Atta)"]),
    ("Fortune Sunlite Sunflower Oil", ["Sunflower Oil"]),
    ("India Gate Basmati Rice Feast", ["Basmati Rice"]),
    ("Everest Kasmiri Lal Chilli", ["Kashmiri Mirch", "Red Chilli Powder"]),
    ("Catch Black Salt Sprinkler", ["Black Salt (Kala Namak)"]),
    ("MDH Chana Masala Blend", ["Garam Masala", "Amchur (Dry Mango)", "Coriander Seeds"]),
    ("MDH Pav Bhaji Masala", ["Pav Bhaji Masala", "Coriander Seeds", "Cumin Seeds"]),
    ("MTR Sambar Powder Mix", ["Sambar Powder", "Coriander Seeds", "Toor Dal (Arhar)"]),
    ("MTR Rasam Powder Authentic", ["Rasam Powder", "Black Pepper", "Cumin Seeds"]),
    ("Haldiram's Ready Gulab Jamun", ["Khoya (Mawa)", "Whole Wheat Flour (Atta)", "Organic Cane Sugar", "Desi Ghee"]),
    ("Haldiram's Rasgulla Tin", ["Chenna", "Organic Cane Sugar", "Rose Water"]),
    ("Bikaji Bhujia Sev", ["Chickpea Flour (Besan)", "Moth Beans", "Groundnut Oil", "Black Salt (Kala Namak)"]),
    ("Amul Taaza Homogenised Milk", ["Whole Milk"]),
    ("Amul Fresh Cream Carton", ["Fresh Cream"]),
    ("Mother Dairy Classic Curd", ["Curd (Dahi)"]),
    ("Britannia Cow Cheese Block", ["Cheddar Cheese", "Whole Milk"]),
    ("Dabur 100% Pure Honey", ["Honey"]),
    ("Patanjali Jaggery Cubes", ["Jaggery (Gud)"]),
    ("Organic Tattva Poha Raw", ["Poha (Flattened Rice)"]),
    ("Tata Sampann Moong Dal Split", ["Moong Dal"]),
    ("Fortune Premium Kachi Ghani Mustard Oil", ["Mustard Oil"]),
    ("Parachute 100% Pure Coconut Oil", ["Coconut Oil"]),
    ("Pilsbury Chakki Fresh Atta", ["Whole Wheat Flour (Atta)"]),
    ("MTR Ready to Eat Palak Paneer", ["Paneer (Cottage Cheese)", "Spinach (Palak)", "Desi Ghee", "Roma Tomato"]),
    ("Gits Instant Idli Breakfast Mix", ["Rice Flour", "Urad Dal"]),
    ("Gits Instant Gulab Jamun Mix", ["Refined Flour (Maida)", "Whole Milk", "Khoya (Mawa)"]),
    ("Everest Chaat Masala Box", ["Chaat Masala", "Amchur (Dry Mango)", "Black Salt (Kala Namak)"]),
    ("Catch Hing Compounded Powder", ["Asafoetida (Hing)", "Refined Flour (Maida)"]),
    ("24 Mantra Organic Turmeric", ["Turmeric Powder"]),
    ("24 Mantra Organic Basmati Rice", ["Basmati Rice"]),
    ("Lipton Pure Green Tea Box", ["Mint Leaves"]),
    ("Brooke Bond Red Label Natural Care", ["Ginger", "Cardamom Pods", "Cloves"]),
    ("Tata Tea Gold Leaf Pack", ["Cardamom Pods"]),
    ("Nestle Everyday Dairy Whitener", ["Whole Milk", "Organic Cane Sugar"]),
    ("Kissan Fresh Tomato Ketchup", ["Roma Tomato", "Organic Cane Sugar", "Citric Acid"]),
    ("Mother's Recipe Mango Pickle", ["Raw Mango (Kaccha Aam)", "Mustard Oil", "Fenugreek Seeds", "Mustard Seeds"]),
    ("Mother's Recipe Lime Pickle", ["Lemon", "Mustard Oil", "Fenugreek Seeds"]),
    ("Priya Ginger Garlic Paste", ["Ginger", "Garlic", "Sunflower Oil"]),
    ("Dabur Hommade Tamarind Paste", ["Tamarind Pulp"]),
    ("Saffola Gold Pro Healthy Blend", ["Rice Flour", "Sunflower Oil"]),
    ("Nutrela Soya Chunks Maxi Pack", ["Soybeans"]),
    ("MDH Kasuri Methi Dried Box", ["Kasuri Methi"]),
    ("Keya Saffron Super Negin Box", ["Saffron Strands"]),
    ("Bambino Roasted Vermicelli", ["Refined Flour (Maida)", "Semolina (Sooji)"]),
    ("MTR Badam Drink Powder", ["Almonds (Badam)", "Whole Milk", "Saffron Strands", "Cardamom Pods"]),
]


def create_iri(name: str) -> ox.NamedNode:
    clean = "".join(c if c.isalnum() else "_" for c in name.strip()).strip("_")
    return ox.NamedNode(f"{BASE_IRI}{clean}")


def add_triple(store: ox.Store, s: ox.NamedNode | ox.BlankNode, p: ox.NamedNode, o: ox.NamedNode | ox.Literal) -> None:
    store.add(ox.Quad(s, p, o, ox.DefaultGraph()))


def main() -> None:
    random.seed(42)
    store = ox.Store()

    rdf_type = ox.NamedNode(f"{RDF}type")
    rdfs_label = ox.NamedNode(f"{RDFS}label")
    rdfs_comment = ox.NamedNode(f"{RDFS}comment")
    rdfs_domain = ox.NamedNode(f"{RDFS}domain")
    rdfs_range = ox.NamedNode(f"{RDFS}range")
    owl_class = ox.NamedNode(f"{OWL}Class")
    owl_object_property = ox.NamedNode(f"{OWL}ObjectProperty")
    owl_datatype_property = ox.NamedNode(f"{OWL}DatatypeProperty")
    owl_ontology = ox.NamedNode(f"{OWL}Ontology")

    # 1. Ontology declaration
    ont_node = ox.NamedNode("http://foodkg.org/ontology/food")
    add_triple(store, ont_node, rdf_type, owl_ontology)
    add_triple(store, ont_node, rdfs_label, ox.Literal("Indian Food Knowledge Graph Ontology", language="en"))
    add_triple(store, ont_node, rdfs_comment, ox.Literal("Comprehensive OWL ontology of Indian culinary traditions, dishes, recipes, diets, and ingredients.", language="en"))

    # 2. Classes
    class_names = [
        "Recipe", "Ingredient", "Dish", "Region", "Diet", "Cuisine",
        "FoodProduct", "NutritionalInfo", "CookingMethod", "Course", "MealType"
    ]
    class_nodes = {}
    for cname in class_names:
        cnode = create_iri(cname)
        class_nodes[cname] = cnode
        add_triple(store, cnode, rdf_type, owl_class)
        add_triple(store, cnode, rdfs_label, ox.Literal(cname, language="en"))
        add_triple(store, cnode, rdfs_comment, ox.Literal(f"Ontology class representing {cname}.", language="en"))

    # 3. Object Properties
    obj_props = [
        ("hasIngredient", "Recipe", "Ingredient"),
        ("hasCuisine", "Recipe", "Cuisine"),
        ("hasRegion", "Recipe", "Region"),
        ("belongsToDiet", "Recipe", "Diet"),
        ("hasCookingMethod", "Recipe", "CookingMethod"),
        ("isCourseof", "Recipe", "Course"),
        ("servedAs", "Recipe", "Dish"),
        ("hasMealType", "Recipe", "MealType"),
        ("hasNutritionalInfo", "Recipe", "NutritionalInfo"),
        ("contains", "FoodProduct", "Ingredient"),
        ("pairsWellWith", "Dish", "Dish"),
    ]
    prop_nodes = {}
    for pname, dom, ran in obj_props:
        pnode = create_iri(pname)
        prop_nodes[pname] = pnode
        add_triple(store, pnode, rdf_type, owl_object_property)
        add_triple(store, pnode, rdfs_label, ox.Literal(pname, language="en"))
        add_triple(store, pnode, rdfs_domain, class_nodes[dom])
        add_triple(store, pnode, rdfs_range, class_nodes[ran])

    # 4. Data Properties
    data_props = [
        ("calories", "Recipe", f"{XSD}integer"),
        ("protein", "Recipe", f"{XSD}decimal"),
        ("fat", "Recipe", f"{XSD}decimal"),
        ("carbohydrates", "Recipe", f"{XSD}decimal"),
        ("preparationTime", "Recipe", f"{XSD}integer"),
        ("servingSize", "Recipe", f"{XSD}string"),
        ("isVegetarian", "Recipe", f"{XSD}boolean"),
        ("isVegan", "Recipe", f"{XSD}boolean"),
        ("spiceLevel", "Recipe", f"{XSD}string"),
    ]
    for dname, dom, ran in data_props:
        dnode = create_iri(dname)
        prop_nodes[dname] = dnode
        add_triple(store, dnode, rdf_type, owl_datatype_property)
        add_triple(store, dnode, rdfs_label, ox.Literal(dname, language="en"))
        add_triple(store, dnode, rdfs_domain, class_nodes[dom])
        add_triple(store, dnode, rdfs_range, ox.NamedNode(ran))

    # 5. Populate Cuisines (50)
    cuisine_nodes = []
    for c in CUISINES:
        node = create_iri(f"Cuisine_{c}")
        cuisine_nodes.append(node)
        add_triple(store, node, rdf_type, class_nodes["Cuisine"])
        add_triple(store, node, rdfs_label, ox.Literal(c, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Traditional {c} culinary style and flavor profile.", language="en"))

    # 6. Populate Regions (30)
    region_nodes = []
    for r in REGIONS:
        node = create_iri(f"Region_{r}")
        region_nodes.append(node)
        add_triple(store, node, rdf_type, class_nodes["Region"])
        add_triple(store, node, rdfs_label, ox.Literal(r, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Geographic culinary region of {r}, India.", language="en"))

    # 7. Populate Diets (10)
    diet_nodes = []
    diet_info = {}
    for dname, is_veg, is_vgn in DIETS:
        node = create_iri(f"Diet_{dname}")
        diet_nodes.append(node)
        diet_info[dname] = (node, is_veg, is_vgn)
        add_triple(store, node, rdf_type, class_nodes["Diet"])
        add_triple(store, node, rdfs_label, ox.Literal(dname, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Dietary restriction or preference: {dname}.", language="en"))

    # 8. Populate Cooking Methods (20)
    method_nodes = []
    for m in COOKING_METHODS:
        node = create_iri(f"CookingMethod_{m}")
        method_nodes.append(node)
        add_triple(store, node, rdf_type, class_nodes["CookingMethod"])
        add_triple(store, node, rdfs_label, ox.Literal(m, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Traditional Indian culinary technique: {m}.", language="en"))

    # 9. Populate Courses (10)
    course_nodes = []
    for crs in COURSES:
        node = create_iri(f"Course_{crs}")
        course_nodes.append(node)
        add_triple(store, node, rdf_type, class_nodes["Course"])
        add_triple(store, node, rdfs_label, ox.Literal(crs, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Dining course: {crs}.", language="en"))

    # 10. Populate Meal Types (8)
    meal_nodes = []
    for mt in MEAL_TYPES:
        node = create_iri(f"MealType_{mt}")
        meal_nodes.append(node)
        add_triple(store, node, rdf_type, class_nodes["MealType"])
        add_triple(store, node, rdfs_label, ox.Literal(mt, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Meal occasion: {mt}.", language="en"))

    # 11. Populate Ingredients (200)
    ingredient_nodes = []
    for ing in INGREDIENTS:
        node = create_iri(f"Ingredient_{ing}")
        ingredient_nodes.append(node)
        add_triple(store, node, rdf_type, class_nodes["Ingredient"])
        add_triple(store, node, rdfs_label, ox.Literal(ing, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Culinary ingredient: {ing}.", language="en"))

    # 12. Populate Dishes (100)
    dish_nodes = []
    for i, d in enumerate(DISHES):
        node = create_iri(f"Dish_{d}")
        dish_nodes.append(node)
        add_triple(store, node, rdf_type, class_nodes["Dish"])
        add_triple(store, node, rdfs_label, ox.Literal(d, language="en"))
        add_triple(store, node, rdfs_comment, ox.Literal(f"Classic Indian dish: {d}.", language="en"))

        # Pairings between dishes
        paired_dish = dish_nodes[random.randint(0, i)] if i > 0 else None
        if paired_dish and paired_dish != node:
            add_triple(store, node, prop_nodes["pairsWellWith"], paired_dish)

    # 13. Populate Food Products (50)
    for prod_name, ingredients_contained in FOOD_PRODUCTS:
        pnode = create_iri(f"Product_{prod_name}")
        add_triple(store, pnode, rdf_type, class_nodes["FoodProduct"])
        add_triple(store, pnode, rdfs_label, ox.Literal(prod_name, language="en"))
        add_triple(store, pnode, rdfs_comment, ox.Literal(f"Packaged Indian food item: {prod_name}.", language="en"))

        for ing_name in ingredients_contained:
            ing_node = create_iri(f"Ingredient_{ing_name}")
            add_triple(store, pnode, prop_nodes["contains"], ing_node)

    # 14. Populate Recipes (500)
    spice_levels = ["Mild", "Medium", "Spicy", "Very Spicy", "Extremely Fiery"]
    recipe_nodes = []

    for idx in range(1, 501):
        dish = random.choice(DISHES)
        cuisine_node = random.choice(cuisine_nodes)
        region_node = random.choice(region_nodes)
        _diet_name, (diet_node, is_veg, is_vgn) = random.choice(list(diet_info.items()))
        method_node = random.choice(method_nodes)
        course_node = random.choice(course_nodes)
        meal_node = random.choice(meal_nodes)
        dish_node = create_iri(f"Dish_{dish}")

        recipe_name = f"Authentic {dish} Recipe #{idx}"
        rnode = create_iri(f"Recipe_{idx}_{dish}")
        recipe_nodes.append(rnode)

        add_triple(store, rnode, rdf_type, class_nodes["Recipe"])
        add_triple(store, rnode, rdfs_label, ox.Literal(recipe_name, language="en"))
        add_triple(store, rnode, rdfs_comment, ox.Literal(f"Step-by-step preparation for {dish} with regional seasoning.", language="en"))

        # Relationships
        add_triple(store, rnode, prop_nodes["servedAs"], dish_node)
        add_triple(store, rnode, prop_nodes["hasCuisine"], cuisine_node)
        add_triple(store, rnode, prop_nodes["hasRegion"], region_node)
        add_triple(store, rnode, prop_nodes["belongsToDiet"], diet_node)
        add_triple(store, rnode, prop_nodes["hasCookingMethod"], method_node)
        add_triple(store, rnode, prop_nodes["isCourseof"], course_node)
        add_triple(store, rnode, prop_nodes["hasMealType"], meal_node)

        # 4 to 8 ingredients per recipe
        num_ings = random.randint(4, 8)
        chosen_ings = random.sample(ingredient_nodes, num_ings)
        for ing_node in chosen_ings:
            add_triple(store, rnode, prop_nodes["hasIngredient"], ing_node)

        # Pairing
        if idx > 1:
            random_partner = random.choice(recipe_nodes[:-1])
            add_triple(store, rnode, prop_nodes["pairsWellWith"], random_partner)

        # NutritionalInfo node
        nut_node = create_iri(f"Nutrition_Recipe_{idx}")
        add_triple(store, nut_node, rdf_type, class_nodes["NutritionalInfo"])
        add_triple(store, nut_node, rdfs_label, ox.Literal(f"Nutrition for Recipe #{idx}", language="en"))
        add_triple(store, rnode, prop_nodes["hasNutritionalInfo"], nut_node)

        calories_val = random.randint(180, 850)
        protein_val = round(random.uniform(4.0, 38.0), 1)
        fat_val = round(random.uniform(2.0, 42.0), 1)
        carbs_val = round(random.uniform(15.0, 95.0), 1)
        prep_time = random.choice([15, 20, 25, 30, 40, 45, 60, 75, 90, 120])
        servings = f"{random.choice([2, 4, 6])} servings"
        spiciness = random.choice(spice_levels)

        # Add data properties
        add_triple(store, rnode, prop_nodes["calories"], ox.Literal(str(calories_val), datatype=ox.NamedNode(f"{XSD}integer")))
        add_triple(store, rnode, prop_nodes["protein"], ox.Literal(str(protein_val), datatype=ox.NamedNode(f"{XSD}decimal")))
        add_triple(store, rnode, prop_nodes["fat"], ox.Literal(str(fat_val), datatype=ox.NamedNode(f"{XSD}decimal")))
        add_triple(store, rnode, prop_nodes["carbohydrates"], ox.Literal(str(carbs_val), datatype=ox.NamedNode(f"{XSD}decimal")))
        add_triple(store, rnode, prop_nodes["preparationTime"], ox.Literal(str(prep_time), datatype=ox.NamedNode(f"{XSD}integer")))
        add_triple(store, rnode, prop_nodes["servingSize"], ox.Literal(servings))
        add_triple(store, rnode, prop_nodes["isVegetarian"], ox.Literal("true" if is_veg else "false", datatype=ox.NamedNode(f"{XSD}boolean")))
        add_triple(store, rnode, prop_nodes["isVegan"], ox.Literal("true" if is_vgn else "false", datatype=ox.NamedNode(f"{XSD}boolean")))
        add_triple(store, rnode, prop_nodes["spiceLevel"], ox.Literal(spiciness))

    # Serialize output to fixtures/food_ontology.owl
    fixtures_dir = Path(__file__).resolve().parent.parent / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    owl_path = fixtures_dir / "food_ontology.owl"

    with open(owl_path, "wb") as f:
        store.dump(f, ox.RdfFormat.RDF_XML, from_graph=ox.DefaultGraph(), prefixes=PREFIXES)

    total_triples = len(list(store))
    print(f"Generated {total_triples} triples.")
    print(f"Saved RDF/XML ontology to: {owl_path}")

    # Generate fixtures/food_profile.json
    profile_data = {
        "package_id": "fkg-food",
        "version": "1.0.0",
        "title": "Indian Food Knowledge Graph",
        "description": "Indian Food ontology, recipes, cuisines, and regional gastronomy knowledge graph.",
        "ontology_iris": ["http://foodkg.org/ontology/food"],
        "sources": [
            {
                "path": "food_ontology.owl",
                "format": "rdf-xml",
                "graph": "urn:fkg:graph:asserted"
            }
        ],
        "imports": {
            "mode": "disabled",
            "allowlist": []
        },
        "prefixes": {
            "base_iri": "http://foodkg.org/ontology/food#",
            "prefixes": {
                "food": "http://foodkg.org/ontology/food#",
                "owl": "http://www.w3.org/2002/07/owl#",
                "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
                "xsd": "http://www.w3.org/2001/XMLSchema#"
            }
        },
        "languages": {
            "preferred_languages": ["en", "hi", "ANY"]
        },
        "labels": {
            "label_predicates": ["rdfs:label"],
            "description_predicates": ["rdfs:comment"]
        },
        "search": {
            "searchable_classes": [
                "food:Recipe",
                "food:Dish",
                "food:Ingredient",
                "food:Cuisine",
                "food:Region",
                "food:FoodProduct"
            ]
        },
        "predicates": {
            "traversable_predicates": [
                "hasIngredient",
                "hasCuisine",
                "hasRegion",
                "belongsToDiet",
                "hasCookingMethod",
                "isCourseof",
                "servedAs",
                "hasMealType",
                "hasNutritionalInfo",
                "contains",
                "pairsWellWith"
            ]
        },
        "categories": {
            "Recipe": {
                "class_iris": ["food:Recipe"],
                "label": "Recipe",
                "color": "#e65100"
            },
            "Dish": {
                "class_iris": ["food:Dish"],
                "label": "Dish",
                "color": "#b83c50"
            },
            "Ingredient": {
                "class_iris": ["food:Ingredient"],
                "label": "Ingredient",
                "color": "#2e7d32"
            },
            "Cuisine": {
                "class_iris": ["food:Cuisine"],
                "label": "Cuisine",
                "color": "#d7972f"
            },
            "Region": {
                "class_iris": ["food:Region"],
                "label": "Region",
                "color": "#0277bd"
            },
            "Diet": {
                "class_iris": ["food:Diet"],
                "label": "Diet",
                "color": "#6a1b9a"
            },
            "CookingMethod": {
                "class_iris": ["food:CookingMethod"],
                "label": "Cooking Method",
                "color": "#ad1457"
            },
            "Course": {
                "class_iris": ["food:Course"],
                "label": "Course",
                "color": "#00838f"
            },
            "MealType": {
                "class_iris": ["food:MealType"],
                "label": "Meal Type",
                "color": "#ef6c00"
            },
            "FoodProduct": {
                "class_iris": ["food:FoodProduct"],
                "label": "Food Product",
                "color": "#4527a0"
            },
            "NutritionalInfo": {
                "class_iris": ["food:NutritionalInfo"],
                "label": "Nutritional Info",
                "color": "#558b2f"
            }
        },
        "reasoning": {
            "profile_name": "none"
        },
        "limits": {
            "max_depth": 2,
            "max_nodes": 5000,
            "max_edges": 10000
        }
    }

    profile_path = fixtures_dir / "food_profile.json"
    with open(profile_path, "w", encoding="utf-8") as f:
        json.dump(profile_data, f, indent=2)

    print(f"Saved semantic profile to: {profile_path}")


if __name__ == "__main__":
    main()
