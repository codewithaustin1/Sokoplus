export interface TypographyPreset {
  id: string;
  name: string; // Assigned name of the typography
  headingFont: string; // e.g. "'Playfair Display', serif"
  bodyFont: string; // e.g. "'Plus Jakarta Sans', sans-serif"
  headingFontName: string; // "Playfair Display"
  bodyFontName: string; // "Plus Jakarta Sans"
  googleFontsUrl: string;
  category: "Artisan & Heritage" | "Modern & Minimalist" | "Editorial & Classic" | "Expressive & Display" | "Handcrafted & Warm";
  description: string;
  tags: string[];
}

export const DEFAULT_TYPOGRAPHY_ID = "modern-african-craft";

export const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: "modern-african-craft",
    name: "Modern African Craft (Plus Jakarta Sans & Playfair Display)",
    headingFont: "'Playfair Display', serif",
    bodyFont: "'Plus Jakarta Sans', sans-serif",
    headingFontName: "Playfair Display",
    bodyFontName: "Plus Jakarta Sans",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap",
    category: "Artisan & Heritage",
    description: "The signature SokoPlus typography pairing elegant high-contrast serif headlines with crystal-clear geometric body text.",
    tags: ["Signature", "Heritage", "Serif Headlines", "High Legibility"]
  },
  {
    id: "clean-minimalist-sans",
    name: "Clean Minimalist Sans (Inter & Outfit)",
    headingFont: "'Outfit', sans-serif",
    bodyFont: "'Inter', sans-serif",
    headingFontName: "Outfit",
    bodyFontName: "Inter",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300..900;1,300..900&family=Outfit:wght@400..900&display=swap",
    category: "Modern & Minimalist",
    description: "Sleek geometric typography optimized for fast catalog navigation, dense product specifications, and high-tech clarity.",
    tags: ["Minimalist", "Sans-Serif", "Tech", "Ultra Clean"]
  },
  {
    id: "heritage-luxury-serif",
    name: "Serif Heritage Luxury (Cormorant Garamond & DM Sans)",
    headingFont: "'Cormorant Garamond', serif",
    bodyFont: "'DM Sans', sans-serif",
    headingFontName: "Cormorant Garamond",
    bodyFontName: "DM Sans",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400..700;1,400..700&family=DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900&display=swap",
    category: "Editorial & Classic",
    description: "Regal luxury aesthetic featuring stately calligraphic serif titles paired with balanced geometric body typography.",
    tags: ["Luxury", "Boutique", "Editorial", "Serif"]
  },
  {
    id: "expressive-avant-garde",
    name: "Expressive Avant-Garde (Syne & Plus Jakarta Sans)",
    headingFont: "'Syne', sans-serif",
    bodyFont: "'Plus Jakarta Sans', sans-serif",
    headingFontName: "Syne",
    bodyFontName: "Plus Jakarta Sans",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Syne:wght@500..800&display=swap",
    category: "Expressive & Display",
    description: "Bold, high-impact wide headlines combined with effortless body readability for contemporary art and fashion showcases.",
    tags: ["Contemporary", "Bold Display", "Artistic", "Avant-Garde"]
  },
  {
    id: "editorial-classic",
    name: "Editorial Classic (Newsreader & Inter)",
    headingFont: "'Newsreader', serif",
    bodyFont: "'Inter', sans-serif",
    headingFontName: "Newsreader",
    bodyFontName: "Inter",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300..900;1,300..900&family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&display=swap",
    category: "Editorial & Classic",
    description: "Timeless magazine-style typography pairing warm news serif headers with crisp structured sans body text.",
    tags: ["Journalistic", "Literary", "High Contrast", "Editorial"]
  },
  {
    id: "handcrafted-artisan",
    name: "Handcrafted Warmth (Caveat & Plus Jakarta Sans)",
    headingFont: "'Caveat', cursive",
    bodyFont: "'Plus Jakarta Sans', sans-serif",
    headingFontName: "Caveat",
    bodyFontName: "Plus Jakarta Sans",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap",
    category: "Handcrafted & Warm",
    description: "Warm human touch with expressive handwritten script headings for story titles and clean sans body font for details.",
    tags: ["Handwritten", "Warm", "Artisan Story", "Charming"]
  },
  {
    id: "futuristic-sora",
    name: "Futuristic Modern (Space Grotesk & Sora)",
    headingFont: "'Space Grotesk', sans-serif",
    bodyFont: "'Sora', sans-serif",
    headingFontName: "Space Grotesk",
    bodyFontName: "Sora",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@300..800&family=Space+Grotesk:wght@500..700&display=swap",
    category: "Modern & Minimalist",
    description: "Digital tech-craft aesthetic featuring grotesque display titles and soft rounded modern body text.",
    tags: ["Futuristic", "Grotesque", "Tech", "Digital"]
  },
  {
    id: "literary-lora",
    name: "Warm Literary (Lora & Poppins)",
    headingFont: "'Lora', serif",
    bodyFont: "'Poppins', sans-serif",
    headingFontName: "Lora",
    bodyFontName: "Poppins",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500..700;1,400..700&family=Poppins:ital,wght@0,300..800;1,300..800&display=swap",
    category: "Handcrafted & Warm",
    description: "Warm calligraphic serif titles paired with friendly rounded geometric body typography for comfortable reading.",
    tags: ["Friendly", "Warm Serif", "Geometric", "Literary"]
  }
];

export function getTypographyById(id: string): TypographyPreset {
  return TYPOGRAPHY_PRESETS.find((p) => p.id === id) || TYPOGRAPHY_PRESETS[0];
}

/**
 * Dynamically applies the chosen typography across the entire platform.
 * 1. Updates Google Fonts link in document.head
 * 2. Sets CSS variables on document.documentElement
 * 3. Applies data attributes for scope styling
 */
export function applyTypography(preset: TypographyPreset): void {
  if (typeof window === "undefined" || !document || !document.head) return;

  const fontLinkId = "sokoplus-dynamic-typography-fonts";
  let linkEl = document.getElementById(fontLinkId) as HTMLLinkElement | null;

  if (!linkEl) {
    linkEl = document.createElement("link");
    linkEl.id = fontLinkId;
    linkEl.rel = "stylesheet";
    document.head.appendChild(linkEl);
  }

  if (linkEl.href !== preset.googleFontsUrl) {
    linkEl.href = preset.googleFontsUrl;
  }

  const root = document.documentElement;
  root.style.setProperty("--font-heading", preset.headingFont);
  root.style.setProperty("--font-body", preset.bodyFont);
  root.style.setProperty("--font-sans", preset.bodyFont);
  root.setAttribute("data-typography-id", preset.id);

  // Also apply direct font style overrides to root for instant render guarantees
  let styleEl = document.getElementById("sokoplus-typography-overrides") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "sokoplus-typography-overrides";
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    :root {
      --font-heading: ${preset.headingFont};
      --font-body: ${preset.bodyFont};
      --font-sans: ${preset.bodyFont};
    }
    h1, h2, h3, h4, h5, h6, .font-heading, .font-serif {
      font-family: var(--font-heading), serif !important;
    }
    body, html, input, button, select, textarea, .font-sans {
      font-family: var(--font-body), sans-serif !important;
    }
  `;
}
