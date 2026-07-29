// Regional Slang, Colloquialisms, Brand Typos & Fuzzy Match Utility

/**
 * Common regional slang, Sheng/Swahili colloquialisms, brand misspellings,
 * and category synonyms mapping to standard canonical search terms.
 */
export const SYNONYM_DICTIONARY: Record<string, string[]> = {
  // Phones & Mobile
  "phone": ["simu", "rununu", "fon", "fone", "mobile", "cellphone", "telepne", "samsang", "samson", "aiphone", "iphoen", "eyphone"],
  "samsung": ["samsang", "samson", "sumsung", "samsun"],
  "apple": ["iphone", "aiphone", "iphoen", "macbook", "ipad", "airpods"],
  
  // Laptops & Computing
  "laptop": ["lapi", "lap top", "kompyuta", "comp", "notebook", "maccbook", "hp", "dell", "lenovo"],
  "tv": ["tivi", "television", "palasma", "plasma", "screen", "smart tv", "hisense", "lg", "sony"],

  // Fashion & Apparel
  "shoes": ["viatu", "kiatu", "sneakers", "kicks", "ruba", "yeezy", "nikee", "nikes", "adida", "adidass"],
  "clothes": ["nguo", "pamba", "attire", "outfit", "wear", "dresses", "shirts"],
  "bag": ["mkoba", "begi", "handbag", "backpack", "tote", "purse"],
  "jacket": ["koti", "hoodie", "sweater", "coat", "jumper"],

  // Home & Household
  "kitchen": ["jiko", "cooker", "fridge", "blender", "pot", "pan", "utensils"],
  "furniture": ["iti", "kiti", "meza", "sofa", "bed", "kitanda", "couch"],

  // Artisan & Craft
  "artisan": ["juakali", "craft", "handcrafted", "handmade", "mbao", "shanga", "beads", "kikoi", "leso", "maasai"],
  
  // General / Vehicles
  "bike": ["nduthi", "baiskeli", "bodaboda", "motorcycle"]
};

/**
 * Reverse mapping for fast synonym lookup.
 */
const REVERSE_SYNONYM_MAP: Record<string, string> = {};
Object.entries(SYNONYM_DICTIONARY).forEach(([canonical, aliases]) => {
  aliases.forEach(alias => {
    REVERSE_SYNONYM_MAP[alias.toLowerCase()] = canonical;
  });
  // Also map canonical to itself
  REVERSE_SYNONYM_MAP[canonical.toLowerCase()] = canonical;
});

/**
 * Computes Levenshtein Distance between two strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

/**
 * Normalizes query string by resolving slang/synonyms and correcting known typos.
 */
export function normalizeSearchQuery(input: string): { normalized: string; isSlangOrCorrected: boolean; original: string; suggestedTerm?: string } {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { normalized: "", isSlangOrCorrected: false, original: input };

  const words = trimmed.split(/\s+/);
  let isSlangOrCorrected = false;
  let suggestedTerm: string | undefined = undefined;

  const normalizedWords = words.map(w => {
    // 1. Direct synonym match
    if (REVERSE_SYNONYM_MAP[w]) {
      if (REVERSE_SYNONYM_MAP[w] !== w) {
        isSlangOrCorrected = true;
        suggestedTerm = REVERSE_SYNONYM_MAP[w];
      }
      return REVERSE_SYNONYM_MAP[w];
    }

    // 2. Fuzzy match against all known dictionary keys and aliases (max distance 2 for short words)
    let bestMatch = w;
    let minDistance = Infinity;

    Object.keys(REVERSE_SYNONYM_MAP).forEach(term => {
      if (Math.abs(term.length - w.length) <= 2) {
        const dist = getLevenshteinDistance(w, term);
        if (dist <= 2 && dist < minDistance && term.length > 3) {
          minDistance = dist;
          bestMatch = REVERSE_SYNONYM_MAP[term];
        }
      }
    });

    if (bestMatch !== w) {
      isSlangOrCorrected = true;
      suggestedTerm = bestMatch;
      return bestMatch;
    }

    return w;
  });

  return {
    normalized: normalizedWords.join(" "),
    isSlangOrCorrected,
    original: input,
    suggestedTerm
  };
}

/**
 * Checks whether a target text matches the query string using fuzzy & slang matching.
 */
export function matchesFuzzyQuery(targetText: string, queryStr: string): boolean {
  if (!targetText || !queryStr) return false;
  const targetLower = targetText.toLowerCase();
  const queryLower = queryStr.toLowerCase();

  // 1. Direct substring match
  if (targetLower.includes(queryLower)) return true;

  // 2. Slang & synonym expanded query check
  const { normalized, suggestedTerm } = normalizeSearchQuery(queryStr);
  if (normalized && targetLower.includes(normalized)) return true;
  if (suggestedTerm && targetLower.includes(suggestedTerm)) return true;

  // 3. Token-level fuzzy match (e.g. "samsang galaxi" -> matches "Samsung Galaxy")
  const queryTokens = queryLower.split(/\s+/);
  const targetTokens = targetLower.split(/\s+/);

  return queryTokens.every(qToken => {
    if (qToken.length <= 2) return targetLower.includes(qToken);
    
    return targetTokens.some(tToken => {
      if (tToken.includes(qToken) || qToken.includes(tToken)) return true;
      const dist = getLevenshteinDistance(qToken, tToken);
      return dist <= 2 && qToken.length > 3;
    });
  });
}
