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

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "na", "ya", "wa", "kwa", "katika", "za", "la", "cha", "vya"
]);

/**
 * Normalizes query string by resolving slang/synonyms and correcting known typos.
 */
export function normalizeSearchQuery(input: string): { normalized: string; isSlangOrCorrected: boolean; original: string; suggestedTerm?: string } {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { normalized: "", isSlangOrCorrected: false, original: input };

  const words = trimmed.split(/\s+/).filter(Boolean);
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

    // Skip short words or stop words for fuzzy dictionary correction to prevent false matches
    if (w.length <= 3 || STOP_WORDS.has(w)) {
      return w;
    }

    // 2. High-precision fuzzy match against known dictionary terms
    let bestMatch = w;
    let minDistance = Infinity;
    const maxAllowedDist = w.length >= 7 ? 2 : 1; // Strict distance limit

    Object.keys(REVERSE_SYNONYM_MAP).forEach(term => {
      if (Math.abs(term.length - w.length) <= maxAllowedDist) {
        const dist = getLevenshteinDistance(w, term);
        if (dist <= maxAllowedDist && dist < minDistance && term.length >= 4) {
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
 * Checks whether a target text matches the query string using high-precision fuzzy & slang matching.
 */
export function matchesFuzzyQuery(targetText: string, queryStr: string): boolean {
  if (!targetText || !queryStr) return false;
  const targetLower = targetText.toLowerCase().trim();
  const queryLower = queryStr.toLowerCase().trim();
  if (!targetLower || !queryLower) return false;

  // For very short queries (length <= 2), avoid blind substring matching across targetText
  // (which matches any product containing the letter 'a', 'in', etc.)
  if (queryLower.length <= 2) {
    // If it is a stopword and not a brand like "tv" / "lg" / "hp", ignore
    if (STOP_WORDS.has(queryLower)) return false;
    const tokens = targetLower.replace(/[^\w\s-]/g, " ").split(/\s+/).filter(Boolean);
    return tokens.some(t => t === queryLower || (queryLower.length === 2 && t.startsWith(queryLower)));
  }

  // 1. Direct whole-query substring match (only for queries length >= 3)
  if (targetLower.includes(queryLower)) return true;

  // 2. Slang & synonym expanded query check
  const { normalized, suggestedTerm } = normalizeSearchQuery(queryStr);
  if (normalized && normalized !== queryLower && targetLower.includes(normalized)) return true;
  if (suggestedTerm && suggestedTerm !== queryLower && targetLower.includes(suggestedTerm)) return true;

  // 3. Token-level precision matching
  const rawQueryTokens = queryLower.split(/\s+/).filter(Boolean);
  // Only filter stop words if there are multiple words
  const queryTokens = rawQueryTokens.length > 1
    ? rawQueryTokens.filter(t => !STOP_WORDS.has(t))
    : rawQueryTokens;

  if (queryTokens.length === 0) return false;

  const targetTokens = targetLower
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 0);

  return queryTokens.every(qToken => {
    // Stopwords inside multi-word queries are already filtered out
    if (STOP_WORDS.has(qToken) && queryTokens.length > 1) return true;

    // Exact token match or prefix match on target words
    return targetTokens.some(tToken => {
      if (tToken === qToken) return true;
      // Meaningful prefix match (e.g. "bead" matches "beaded" or "beadwork")
      if (qToken.length >= 3 && tToken.startsWith(qToken)) return true;
      if (tToken.length >= 4 && qToken.startsWith(tToken)) return true;

      // Tight Levenshtein tolerance for typos only on longer words
      if (qToken.length >= 5 && tToken.length >= 5) {
        const dist = getLevenshteinDistance(qToken, tToken);
        const maxDist = qToken.length >= 8 && tToken.length >= 8 ? 2 : 1;
        return dist <= maxDist;
      }

      return false;
    });
  });
}
