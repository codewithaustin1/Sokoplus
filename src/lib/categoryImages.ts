export const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "Local Crafts": "https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80",
  "Fashion": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
  "Fashion & Apparel": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
  "Electronics": "https://images.unsplash.com/photo-1498049860654-af1a5c566976?auto=format&fit=crop&w=800&q=80",
  "Electronics & Tech": "https://images.unsplash.com/photo-1498049860654-af1a5c566976?auto=format&fit=crop&w=800&q=80",
  "Beauty": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
  "Beauty & Personal Care": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
  "Beauty & Personal Care (Skincare, Haircare, Cosmetics)": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
  "Home & Office Décor": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
  "Home & Office Décor (Small Scale & Gadgets)": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
  "Pet Supplies": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80",
  "Pet Supplies (Toys, Collars, Accessories, Dry Kibble)": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80",
  "Restaurants": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
  "Shopping": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
  "Nightlife": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
  "Travel": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  "Services": "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80",
};

export const FALLBACK_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80";

/**
 * Returns the configured image for a category, or a high quality fallback.
 */
export function getCategoryImageUrl(
  categoryName: string,
  customCategoryImages?: Record<string, string>
): string {
  if (!categoryName) return FALLBACK_CATEGORY_IMAGE;
  const nameTrimmed = categoryName.trim();

  // 1. Check custom admin set image
  if (customCategoryImages && customCategoryImages[nameTrimmed] && customCategoryImages[nameTrimmed].trim()) {
    return customCategoryImages[nameTrimmed].trim();
  }

  // Check exact default match
  if (DEFAULT_CATEGORY_IMAGES[nameTrimmed]) {
    return DEFAULT_CATEGORY_IMAGES[nameTrimmed];
  }

  // Check partial key matches
  const lower = nameTrimmed.toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_CATEGORY_IMAGES)) {
    const keyLower = key.toLowerCase();
    if (lower.includes(keyLower) || keyLower.includes(lower)) {
      return val;
    }
  }

  // Keyword fallbacks
  if (lower.includes("craft") || lower.includes("sanaa")) {
    return DEFAULT_CATEGORY_IMAGES["Local Crafts"];
  }
  if (lower.includes("fashion") || lower.includes("apparel") || lower.includes("cloth")) {
    return DEFAULT_CATEGORY_IMAGES["Fashion"];
  }
  if (lower.includes("electr") || lower.includes("tech") || lower.includes("gadget")) {
    return DEFAULT_CATEGORY_IMAGES["Electronics"];
  }
  if (lower.includes("beauty") || lower.includes("skin") || lower.includes("cosmetic")) {
    return DEFAULT_CATEGORY_IMAGES["Beauty"];
  }
  if (lower.includes("decor") || lower.includes("home") || lower.includes("office")) {
    return DEFAULT_CATEGORY_IMAGES["Home & Office Décor"];
  }
  if (lower.includes("pet") || lower.includes("dog") || lower.includes("cat")) {
    return DEFAULT_CATEGORY_IMAGES["Pet Supplies"];
  }

  return FALLBACK_CATEGORY_IMAGE;
}
