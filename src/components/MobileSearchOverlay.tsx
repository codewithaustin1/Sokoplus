import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Search, X, Mic, MicOff, Clock, Trash2, 
  Flame, Sparkles, ChevronRight, ShoppingBag, Layers, 
  Store, CheckCircle2, TrendingUp 
} from "lucide-react";
import { Product } from "../types";
import { FastImage } from "./FastImage";
import { matchesFuzzyQuery } from "../utils/searchFuzzy";
import { prefetchProductAssets } from "../utils/imagePrefetcher";

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: Product[];
  language: "en" | "sw";
  onSearch: (query: string) => void;
  onProductSelect: (productId: string) => void;
  onCategorySelect: (category: string) => void;
  isListening?: boolean;
  toggleVoiceSearch?: () => void;
  formatPrice: (val: number) => string;
}

const STORAGE_KEY = "sokoplus_recent_searches";

const TRENDING_SEARCHES = [
  "AirPods & Earbuds",
  "Maasai Necklaces",
  "Tecno Spark",
  "Gaming Headsets",
  "Kiondo Bags",
  "Pure Shea Butter",
  "Smart Watches",
  "Kitenge Dresses",
  "Coffee Tables",
  "Power Banks",
  "Soapstone Carvings",
  "Samsung Galaxy"
];

const KNOWN_BRANDS: Array<{
  name: string;
  aliases: string[];
  category: string;
  tagline: string;
  icon: string;
  isArtisan?: boolean;
}> = [
  {
    name: "Apple",
    aliases: ["apple", "iphone", "ipad", "macbook", "airpods", "ipho"],
    category: "Electronics",
    tagline: "Official Apple iPhones, iPads & Accessories",
    icon: "🍎"
  },
  {
    name: "Samsung",
    aliases: ["samsung", "galaxy", "samsu", "samsang"],
    category: "Electronics",
    tagline: "Samsung Galaxy Smartphones, Tablets & Buds",
    icon: "📱"
  },
  {
    name: "Tecno",
    aliases: ["tecno", "spark", "camon", "phantom"],
    category: "Electronics",
    tagline: "Tecno Spark, Camon & HiOS Devices",
    icon: "⚡"
  },
  {
    name: "Poco",
    aliases: ["poco", "poco phones", "poco c85", "poco x8"],
    category: "Electronics",
    tagline: "POCO Speed-Class Smartphones",
    icon: "🚀"
  },
  {
    name: "Xiaomi",
    aliases: ["xiaomi", "redmi"],
    category: "Electronics",
    tagline: "Xiaomi & Redmi Smart Tech",
    icon: "🟠"
  },
  {
    name: "Maasai Artisan Guild",
    aliases: ["maasai", "masai", "bead", "beadwork", "shuka"],
    category: "Local Crafts",
    tagline: "Handcrafted Authentic Kenyan Maasai Jewelry & Shukas",
    icon: "🇰🇪",
    isArtisan: true
  },
  {
    name: "Kiondo Heritage",
    aliases: ["kiondo", "sisal", "basket", "handwoven", "tote"],
    category: "Local Crafts",
    tagline: "Handwoven Kenyan Sisal & Cowhide Baskets",
    icon: "🧺",
    isArtisan: true
  },
  {
    name: "Pure Shea & Marula",
    aliases: ["shea", "marula", "butter", "skincare", "lotion", "serum"],
    category: "Beauty & Personal Care (Skincare, Haircare, Cosmetics)",
    tagline: "Cold-Pressed Organic African Botanicals",
    icon: "🌿",
    isArtisan: true
  }
];

export const MobileSearchOverlay: React.FC<MobileSearchOverlayProps> = ({
  isOpen,
  onClose,
  allProducts,
  language,
  onSearch,
  onProductSelect,
  onCategorySelect,
  isListening,
  toggleVoiceSearch,
  formatPrice,
}) => {
  const [queryText, setQueryText] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage on mount/open
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed.slice(0, 10));
          }
        }
      } catch (err) {
        console.warn("Failed to parse recent searches:", err);
      }

      // Lock body scroll
      document.body.style.overflow = "hidden";

      // Focus input with slight delay for smooth transition
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // Save new search term to localStorage
  const saveRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    try {
      const updated = [clean, ...recentSearches.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 10);
      setRecentSearches(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to save recent search:", err);
    }
  };

  // Remove a single recent search
  const removeRecentSearch = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter((item) => item !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to update recent searches:", err);
    }
  };

  // Clear all recent searches
  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to clear recent searches:", err);
    }
  };

  // Execute a search
  const handleExecuteSearch = (searchTerm: string) => {
    const clean = searchTerm.trim();
    if (!clean) return;
    saveRecentSearch(clean);
    onSearch(clean);
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryText.trim()) {
      handleExecuteSearch(queryText);
    }
  };

  // Match brand or artisan entity
  const matchedBrand = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q || q.length < 2) return null;
    return KNOWN_BRANDS.find(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.aliases.some((alias) => q.includes(alias) || alias.startsWith(q))
    );
  }, [queryText]);

  // Dynamic Typeahead / Autocomplete Phrases
  const typeaheadSuggestions = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const suggestions = new Set<string>();

    // 1. Check known brand extensions (e.g., "iphone" -> "iphone 13", "iphone 17 pro max")
    if (q.includes("iph") || q.includes("apple")) {
      suggestions.add("iphone");
      suggestions.add("iphone 17 pro max");
      suggestions.add("iphone 13");
      suggestions.add("iphone 12");
      suggestions.add("iphone x");
    } else if (q.includes("poco")) {
      suggestions.add("poco phones");
      suggestions.add("poco c85");
      suggestions.add("poco x8 pro");
      suggestions.add("poco c71");
    } else if (q.includes("tecno")) {
      suggestions.add("tecno spark 50 256gb");
      suggestions.add("tecno camon 30");
      suggestions.add("tecno pop 8");
    } else if (q.includes("maasai") || q.includes("bead")) {
      suggestions.add("maasai beaded necklace");
      suggestions.add("maasai wedding shuka");
      suggestions.add("maasai handcrafted bracelet");
    } else if (q.includes("kiondo") || q.includes("basket")) {
      suggestions.add("kiondo sisal basket");
      suggestions.add("kiondo tote bag with cowhide");
    }

    // 2. Extract matching phrases from all products
    allProducts.forEach((p) => {
      if (matchesFuzzyQuery(p.name, q)) {
        suggestions.add(p.name.toLowerCase());
      }
      if (p.subcategory && matchesFuzzyQuery(p.subcategory, q)) {
        suggestions.add(p.subcategory.toLowerCase());
      }
    });

    return Array.from(suggestions).slice(0, 7);
  }, [queryText, allProducts]);

  // Matched products list
  const matchedProducts = useMemo(() => {
    const q = queryText.trim();
    if (!q) return [];
    return allProducts
      .filter(
        (p) =>
          matchesFuzzyQuery(p.name, q) ||
          (p.category && matchesFuzzyQuery(p.category, q)) ||
          (p.subcategory && matchesFuzzyQuery(p.subcategory, q)) ||
          (p.description && matchesFuzzyQuery(p.description, q))
      )
      .slice(0, 6);
  }, [queryText, allProducts]);

  // Matched categories list
  const matchedCategories = useMemo(() => {
    const q = queryText.trim();
    if (!q) return [];
    const catSet = new Set<string>();
    allProducts.forEach((p) => {
      if (p.category && matchesFuzzyQuery(p.category, q)) {
        catSet.add(p.category);
      }
    });
    return Array.from(catSet).slice(0, 4);
  }, [queryText, allProducts]);

  const trendingCategories = [
    {
      name: "Electronics",
      label: language === "sw" ? "Vifaa vya Kidijitali" : "Electronics & Phones",
      icon: "📱",
      badge: "HOT"
    },
    {
      name: "Fashion",
      label: language === "sw" ? "Mitindo na Mavazi" : "Fashion & Apparel",
      icon: "👗",
      badge: "POPULAR"
    },
    {
      name: "Local Crafts",
      label: language === "sw" ? "Sanaa za Mikono" : "Artisan Crafts & Baskets",
      icon: "🏺",
      badge: "KENYA MADE"
    },
    {
      name: "Beauty & Personal Care (Skincare, Haircare, Cosmetics)",
      label: language === "sw" ? "Urembo na Vipodozi" : "Beauty & Skincare",
      icon: "✨",
      badge: "ORGANIC"
    },
    {
      name: "Home & Office Décor (Small Scale & Gadgets)",
      label: language === "sw" ? "Mapambo ya Nyumbani" : "Home & Living",
      icon: "🛋️",
      badge: "TRENDING"
    },
    {
      name: "Pet Supplies (Toys, Collars, Accessories, Dry Kibble)",
      label: language === "sw" ? "Vifaa vya Wanyama" : "Pet Supplies",
      icon: "🐾",
      badge: "DEALS"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="mobile-search-overlay"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-[200] bg-white dark:bg-gray-950 flex flex-col md:hidden text-gray-900 dark:text-gray-100 overflow-hidden"
        >
          {/* 1. Top Search Header Bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-950 shrink-0 shadow-2xs">
            {/* Back Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
              aria-label={language === "sw" ? "Rudi nyuma" : "Go back"}
            >
              <ArrowLeft size={22} className="stroke-[2.2]" />
            </button>

            {/* Search Input Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 flex items-center relative">
              <div className="relative w-full flex items-center">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Search size={18} className="stroke-[2.2]" />
                </span>

                <input
                  ref={inputRef}
                  type="text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder={
                    language === "sw" 
                      ? "Tafuta bidhaa, chapa na vitengo..." 
                      : "Search products, brands and categories..."
                  }
                  className="w-full h-11 pl-10 pr-20 bg-gray-100 dark:bg-gray-900 rounded-full text-sm font-semibold text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 border-none transition-all"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />

                {/* Right Input Controls: Clear & Voice Search */}
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
                  {queryText && (
                    <button
                      type="button"
                      onClick={() => setQueryText("")}
                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full cursor-pointer"
                      title={language === "sw" ? "Futa" : "Clear"}
                    >
                      <X size={16} className="stroke-[2.5]" />
                    </button>
                  )}

                  {toggleVoiceSearch && (
                    <button
                      type="button"
                      onClick={toggleVoiceSearch}
                      className={`p-1.5 rounded-full transition-all cursor-pointer ${
                        isListening
                          ? "text-red-600 bg-red-100 dark:bg-red-950/60 animate-pulse scale-110"
                          : "text-gray-500 dark:text-gray-400 hover:text-amber-500"
                      }`}
                      title={language === "sw" ? "Tafuta kwa sauti" : "Voice search"}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-850 pb-20 overscroll-contain">
            {/* ZERO-STATE: User has not typed anything */}
            {!queryText.trim() ? (
              <div className="space-y-5 p-4">
                {/* A. RECENT SEARCHES */}
                {recentSearches.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <Clock size={13} className="text-amber-500" />
                        <span>{language === "sw" ? "Utafutaji wa Hivi Karibuni" : "Recent Searches"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={clearAllRecentSearches}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        {language === "sw" ? "Futa Yote" : "Clear All"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {recentSearches.map((term) => (
                        <div
                          key={term}
                          onClick={() => handleExecuteSearch(term)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gray-100 dark:bg-gray-850 text-gray-800 dark:text-gray-200 text-xs font-semibold hover:bg-amber-100 hover:text-black dark:hover:bg-amber-950/40 dark:hover:text-amber-300 transition-all cursor-pointer border border-gray-200/60 dark:border-gray-800 active:scale-95 shadow-2xs"
                        >
                          <span>{term}</span>
                          <button
                            type="button"
                            onClick={(e) => removeRecentSearch(e, term)}
                            className="text-gray-400 hover:text-red-500 p-0.5 rounded-full transition-colors"
                            aria-label="Remove item"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* B. TRENDING SEARCHES / HOT KEYWORDS */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <Flame size={14} className="text-orange-500" />
                    <span>{language === "sw" ? "Zinazovuma Zaidi" : "Trending Searches"}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {TRENDING_SEARCHES.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleExecuteSearch(tag)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs font-bold border border-gray-200 dark:border-gray-800 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <TrendingUp size={12} className="text-amber-500" />
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* C. POPULAR CATEGORIES */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>{language === "sw" ? "Gundua Vitengo" : "Popular Categories"}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {trendingCategories.map((cat) => (
                      <div
                        key={cat.name}
                        onClick={() => {
                          onCategorySelect(cat.name);
                          onClose();
                        }}
                        className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-amber-500 transition-all cursor-pointer flex items-center justify-between active:scale-[0.98] shadow-2xs group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">{cat.icon}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-gray-900 dark:text-gray-100 truncate">{cat.label}</p>
                            <span className="text-[9px] font-extrabold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                              {cat.badge}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-gray-400 shrink-0 group-hover:text-amber-500 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* LIVE QUERY STATE: User is typing */
              <div className="divide-y divide-gray-100 dark:divide-gray-850">
                {/* 1. Verified Brand / Artisan Store Entity Header Card */}
                {matchedBrand && (
                  <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/40">
                    <div
                      onClick={() => handleExecuteSearch(matchedBrand.name)}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 rounded-2xl border border-amber-300 dark:border-amber-700/60 shadow-sm cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xl shrink-0 font-black shadow-2xs">
                          {matchedBrand.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-gray-950 dark:text-gray-50">{matchedBrand.name}</span>
                            <CheckCircle2 size={13} className="text-amber-500 fill-amber-100 dark:fill-amber-950 shrink-0" />
                            {matchedBrand.isArtisan && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 uppercase">
                                Verified Artisan
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{matchedBrand.tagline}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mr-1" />
                    </div>
                  </div>
                )}

                {/* 2. Typeahead Query Auto-completions */}
                {typeaheadSuggestions.length > 0 && (
                  <div className="py-2">
                    {typeaheadSuggestions.map((suggestion) => (
                      <div
                        key={suggestion}
                        onClick={() => handleExecuteSearch(suggestion)}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer active:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Search size={15} className="text-gray-400 shrink-0" />
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize truncate">
                            {suggestion}
                          </span>
                        </div>
                        <ChevronRight size={15} className="text-gray-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Category matches */}
                {matchedCategories.length > 0 && (
                  <div className="p-3 bg-gray-50/50 dark:bg-gray-900/50 space-y-2">
                    <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5 px-1">
                      <Layers size={11} className="text-amber-500" />
                      <span>{language === "sw" ? "Vitengo Vilivyolingana" : "Matching Categories"}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matchedCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            onCategorySelect(cat);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-amber-400 hover:text-black transition-all cursor-pointer shadow-2xs"
                        >
                          <span>📁</span>
                          <span>{cat}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Instant Matched Products Previews */}
                {matchedProducts.length > 0 ? (
                  <div className="p-3 space-y-2">
                    <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5 px-1">
                      <ShoppingBag size={11} className="text-orange-500" />
                      <span>{language === "sw" ? "Bidhaa Zinazolingana" : "Live Product Previews"}</span>
                    </div>

                    <div className="space-y-1">
                      {matchedProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            saveRecentSearch(p.name);
                            onProductSelect(p.id);
                            onClose();
                          }}
                          onTouchStart={() => prefetchProductAssets(p)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors active:scale-[0.99]"
                        >
                          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-850 overflow-hidden flex-shrink-0 border border-gray-200/60 dark:border-gray-700/60">
                            <FastImage src={p.images?.[0] || ""} alt={p.name} fallbackIconSize={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                                {formatPrice(p.price)}
                              </span>
                              {p.category && (
                                <span className="text-[10px] text-gray-400 truncate">
                                  • {p.category}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-gray-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  typeaheadSuggestions.length === 0 && (
                    <div className="py-12 text-center px-4 space-y-2">
                      <Search size={32} className="mx-auto text-gray-300 dark:text-gray-700" />
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {language === "sw" ? `Hakuna matokeo ya "${queryText}"` : `No direct items for "${queryText}"`}
                      </p>
                      <p className="text-xs text-gray-400 max-w-xs mx-auto">
                        {language === "sw"
                          ? "Jaribu kutafuta kwa maneno ya jumla kama 'simu', 'mikufu', 'kiondo' au chapa."
                          : "Try searching with broader terms like 'phones', 'necklace', 'kiondo' or brand names."}
                      </p>
                    </div>
                  )
                )}

                {/* 5. Sticky Bottom CTA "Search all results for..." */}
                <div
                  onClick={() => handleExecuteSearch(queryText)}
                  className="p-4 bg-amber-400 hover:bg-amber-500 text-black font-extrabold text-xs flex items-center justify-between cursor-pointer transition-colors sticky bottom-0 z-10 shadow-lg"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Search size={16} className="shrink-0 stroke-[2.5]" />
                    <span>
                      {language === "sw" ? "Tafuta matokeo yote ya" : "Search all results for"}{" "}
                      <strong className="underline">"{queryText}"</strong>
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 stroke-[2.5]" />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default MobileSearchOverlay;
