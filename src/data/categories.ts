export interface CategoryDefinition {
  id: string;
  name: string;
  subcategories: string[];
}

export const CATEGORIES_WITH_SUBCATEGORIES: Record<string, string[]> = {
  "Fashion": [
    "Men's Clothing",
    "Women's Clothing",
    "Traditional & Kitenge",
    "Shoes & Footwear",
    "Bags & Purses",
    "Jewelry & Accents",
    "Watches & Eyewear",
    "Children & Baby Wear",
  ],
  "Electronics": [
    "Smartphones & Mobile",
    "Laptops & Computers",
    "Audio & Headphones",
    "Smart Watches & Wearables",
    "TV & Home Entertainment",
    "Cameras & Photography",
    "Power Banks & Chargers",
    "Computer Accessories & Storage",
  ],
  "Local Crafts": [
    "Maasai Beadwork & Adornments",
    "Handwoven Baskets & Kiondos",
    "Soapstone & Wood Carvings",
    "Pottery & Ceramic Crafts",
    "Batik & African Paintings",
    "Traditional Musical Instruments",
    "Artisan Leather Crafts",
  ],
  "Beauty & Personal Care": [
    "Organic Skincare & Oils",
    "Natural Haircare & Butters",
    "Perfumes & Fragrances",
    "Cosmetics & Makeup",
    "Men's Grooming & Beard Care",
    "Handmade Soaps & Bath",
  ],
  "Home & Office Décor": [
    "Wall Art & Sculptures",
    "Cushions, Throws & Mats",
    "Handcrafted Lamps & Lighting",
    "Desk Organizers & Office Gadgets",
    "Kitchenware & Table Accents",
    "Planters & Botanical Decor",
    "Candles & Aromatherapy",
  ],
  "Pet Supplies": [
    "Dog Food & Kibble",
    "Cat Care & Treats",
    "Collars, Leashes & Harnesses",
    "Pet Beds & Carriers",
    "Toys & Training Gear",
    "Pet Grooming & Hygiene",
  ],
  "Home Decor": [
    "Rugs & Floor Mats",
    "Vases & Tabletop Decor",
    "Wall Clocks & Mirrors",
    "Curtains & Textiles",
  ],
  "Sustainable": [
    "Eco-Friendly Utensils",
    "Upcycled & Recycled Crafts",
    "Organic Cotton & Linen",
    "Solar & Clean Energy Gear",
  ],
  "Gifts & Souvenirs": [
    "Kenyan Gift Hampers",
    "Custom Engraved Keepsakes",
    "Postcards & Prints",
    "Souvenir Trinkets",
  ],
  "Accessories": [
    "Belts & Buckles",
    "Hats, Caps & Headwear",
    "Sunglasses & Eyewear",
    "Wallets & Cardholders",
    "Scarves & Shawls",
  ],
};

export const STANDARD_CATEGORY_NAMES: string[] = Object.keys(CATEGORIES_WITH_SUBCATEGORIES);

export function getSubcategoriesForCategory(categoryName: string): string[] {
  if (!categoryName) return [];
  // Direct match
  if (CATEGORIES_WITH_SUBCATEGORIES[categoryName]) {
    return CATEGORIES_WITH_SUBCATEGORIES[categoryName];
  }
  // Case-insensitive match
  const foundKey = Object.keys(CATEGORIES_WITH_SUBCATEGORIES).find(
    (k) => k.toLowerCase() === categoryName.toLowerCase()
  );
  if (foundKey) {
    return CATEGORIES_WITH_SUBCATEGORIES[foundKey];
  }
  // Partial substring match (e.g. "Beauty & Personal Care (Skincare, Haircare, Cosmetics)" -> "Beauty & Personal Care")
  const partialKey = Object.keys(CATEGORIES_WITH_SUBCATEGORIES).find(
    (k) => categoryName.toLowerCase().startsWith(k.toLowerCase()) || k.toLowerCase().startsWith(categoryName.toLowerCase())
  );
  return partialKey ? CATEGORIES_WITH_SUBCATEGORIES[partialKey] : [];
}
