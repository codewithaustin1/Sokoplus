import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, X, Mic, MicOff, Clock, Trash2, ArrowRight,
  ShoppingBag, Layers, CornerDownLeft, ArrowUp, ArrowDown,
  Tag, CheckCircle2, ChevronRight, Store, Compass, Heart,
  ShieldCheck, HelpCircle, Sun, Moon, ExternalLink, PackageCheck, Zap,
  TrendingUp, Shirt, Smartphone, Palette, Armchair, PawPrint, Leaf, Folder,
  Volume2, Droplets, Lightbulb, Eye
} from "lucide-react";
import { Product } from "../types";
import { FastImage } from "./FastImage";
import { matchesFuzzyQuery, normalizeSearchQuery } from "../utils/searchFuzzy";
import { prefetchProductAssets } from "../utils/imagePrefetcher";
import { CATEGORIES_WITH_SUBCATEGORIES } from "../data/categories";
import { getCategoryImageUrl } from "../lib/categoryImages";
import { useLanguage } from "../lib/LanguageContext";
import { useCurrency } from "../lib/CurrencyContext";
import { useTheme } from "../lib/ThemeContext";
import toast from "react-hot-toast";

interface SpotlightSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: Product[];
  onProductSelect?: (productId: string) => void;
  onCategorySelect?: (category: string, subcategory?: string) => void;
}

const STORAGE_KEY = "sokoplus_recent_searches";

const TRENDING_SEARCHES = [
  "AirPods & Earbuds",
  "Maasai Necklaces",
  "Tecno Spark",
  "Gaming Headsets",
  "Kiondo Handbags",
  "Pure Shea Butter",
  "Smart Watches",
  "Kitenge Dresses",
  "Coffee Tables",
  "Power Banks",
  "Soapstone Carvings",
  "Samsung Galaxy"
];

// Refined Lucide SVG Icon mapping for product categories
export function getCategoryLucideIcon(categoryName: string, size = 16, className = "text-gray-500 dark:text-gray-400") {
  const norm = (categoryName || "").toLowerCase();
  if (norm.includes("fashion") || norm.includes("cloth") || norm.includes("apparel")) {
    return <Shirt size={size} className={className} />;
  }
  if (norm.includes("electr") || norm.includes("phone") || norm.includes("gadget")) {
    return <Smartphone size={size} className={className} />;
  }
  if (norm.includes("craft") || norm.includes("artisan") || norm.includes("handmade")) {
    return <Palette size={size} className={className} />;
  }
  if (norm.includes("beauty") || norm.includes("skin") || norm.includes("care") || norm.includes("cosmetic")) {
    return <Droplets size={size} className={className} />;
  }
  if (norm.includes("home") || norm.includes("decor") || norm.includes("furniture") || norm.includes("office")) {
    return <Armchair size={size} className={className} />;
  }
  if (norm.includes("pet") || norm.includes("dog") || norm.includes("cat")) {
    return <PawPrint size={size} className={className} />;
  }
  if (norm.includes("sustain") || norm.includes("eco") || norm.includes("green") || norm.includes("organic")) {
    return <Leaf size={size} className={className} />;
  }
  return <Folder size={size} className={className} />;
}

export function SpotlightSearchModal({
  isOpen,
  onClose,
  allProducts,
  onProductSelect,
  onCategorySelect,
}: SpotlightSearchModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { theme, setTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : ["Electronics", "Local Crafts", "Sneakers", "Smart Watch"];
    } catch {
      return ["Electronics", "Local Crafts", "Sneakers", "Smart Watch"];
    }
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<Product | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Lock body scroll when spotlight is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Save recent search helper
  const saveRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save recent search", e);
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearAllRecents = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Normalization / Typo feedback
  const queryNormalization = useMemo(() => {
    if (!query.trim()) return null;
    return normalizeSearchQuery(query);
  }, [query]);

  // Fuzzy Category Matching with subcategory breakdown
  const categoryResults = useMemo(() => {
    const queryStr = query.trim();
    const allCategoryKeys = Object.keys(CATEGORIES_WITH_SUBCATEGORIES);
    
    // Also include any categories found in products that might not be in the dictionary
    allProducts.forEach(p => {
      if (p.category && !allCategoryKeys.includes(p.category)) {
        allCategoryKeys.push(p.category);
      }
    });

    if (!queryStr) {
      // Return top 4 popular categories on empty query
      return allCategoryKeys.slice(0, 4).map(catName => {
        const subcats = CATEGORIES_WITH_SUBCATEGORIES[catName] || [];
        const matchingProducts = allProducts.filter(p => p.category === catName);
        return {
          name: catName,
          subcategories: subcats.slice(0, 5),
          matchingSubcategories: [],
          productCount: matchingProducts.length,
          previewProducts: matchingProducts.slice(0, 3),
          isDirectMatch: false
        };
      });
    }

    const matches: Array<{
      name: string;
      subcategories: string[];
      matchingSubcategories: string[];
      productCount: number;
      previewProducts: Product[];
      isDirectMatch: boolean;
    }> = [];

    allCategoryKeys.forEach(catName => {
      const isCatMatch = matchesFuzzyQuery(catName, queryStr);
      const subcats = CATEGORIES_WITH_SUBCATEGORIES[catName] || [];
      const matchingSubcats = subcats.filter(sub => matchesFuzzyQuery(sub, queryStr));
      
      const matchingProducts = allProducts.filter(p => 
        p.category === catName || 
        (p.subcategory && matchesFuzzyQuery(p.subcategory, queryStr))
      );

      if (isCatMatch || matchingSubcats.length > 0 || (matchingProducts.length > 0 && queryStr.length > 2)) {
        matches.push({
          name: catName,
          subcategories: subcats.slice(0, 6),
          matchingSubcategories: matchingSubcats,
          productCount: matchingProducts.length,
          previewProducts: matchingProducts.slice(0, 4),
          isDirectMatch: isCatMatch
        });
      }
    });

    return matches.slice(0, 4);
  }, [query, allProducts]);

  // Product Matching with fuzzy search
  const productResults = useMemo(() => {
    const queryStr = query.trim();
    if (!queryStr) return [];

    return allProducts.filter(p => 
      matchesFuzzyQuery(p.name, queryStr) || 
      (p.description && matchesFuzzyQuery(p.description, queryStr)) ||
      (p.category && matchesFuzzyQuery(p.category, queryStr)) ||
      (p.subcategory && matchesFuzzyQuery(p.subcategory, queryStr)) ||
      (p.sellerName && matchesFuzzyQuery(p.sellerName, queryStr)) ||
      (p.artisan && matchesFuzzyQuery(p.artisan, queryStr))
    ).slice(0, 8);
  }, [query, allProducts]);

  // Quick navigation items
  const quickActions = useMemo(() => {
    const actions = [
      { id: "action-deals", label: t("Browse Flash Deals & Discounts"), path: "/?filter=deals", icon: Zap, color: "text-amber-500" },
      { id: "action-track", label: t("Track My Active Order"), path: "/track-order", icon: PackageCheck, color: "text-blue-500" },
      { id: "action-wishlist", label: t("View Saved Wishlist"), path: "/wishlist", icon: Heart, color: "text-rose-500" },
      { id: "action-seller", label: t("Seller Studio / Open Shop"), path: "/profile", icon: Store, color: "text-emerald-500" },
      { id: "action-help", label: t("Help Center & Customer Care"), path: "/faq", icon: HelpCircle, color: "text-purple-500" },
    ];

    if (!query.trim()) {
      return actions.slice(0, 3);
    }

    return actions.filter(a => matchesFuzzyQuery(a.label, query.trim())).slice(0, 3);
  }, [query, t]);

  // Flattened items list for index-based keyboard navigation
  const flatSelectableItems = useMemo(() => {
    const list: Array<{
      type: "search" | "category" | "subcategory" | "product" | "action" | "recent";
      id: string;
      title: string;
      data?: any;
    }> = [];

    // 1. Search Query execution item (if query exists)
    if (query.trim()) {
      list.push({
        type: "search",
        id: "search-query-all",
        title: `Search all products for "${query.trim()}"`,
        data: query.trim()
      });
    }

    // 2. Categories
    categoryResults.forEach((cat) => {
      list.push({
        type: "category",
        id: `cat-${cat.name}`,
        title: cat.name,
        data: cat
      });
    });

    // 3. Products
    productResults.forEach((prod) => {
      list.push({
        type: "product",
        id: `prod-${prod.id}`,
        title: prod.name,
        data: prod
      });
    });

    // 4. Quick Actions
    quickActions.forEach((action) => {
      list.push({
        type: "action",
        id: action.id,
        title: action.label,
        data: action
      });
    });

    return list;
  }, [query, categoryResults, productResults, quickActions]);

  // Sync hovered preview to selected item
  useEffect(() => {
    const active = flatSelectableItems[selectedIndex];
    if (!active) return;

    if (active.type === "category") {
      setHoveredCategory(active.data.name);
      setHoveredProduct(null);
    } else if (active.type === "product") {
      setHoveredProduct(active.data);
      setHoveredCategory(active.data.category || null);
    }
  }, [selectedIndex, flatSelectableItems]);

  // Speech Recognition integration
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = language === "sw" ? "sw-KE" : "en-US";

      rec.onstart = () => setIsListening(true);
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0]?.transcript;
        if (transcript) {
          const clean = transcript.replace(/[.?!]/g, "").trim();
          setQuery(clean);
          saveRecentSearch(clean);
          toast.success(`${language === "sw" ? "Sauti imetambuliwa" : "Voice recognized"}: "${clean}"`, {
            id: "spotlight-voice",
          });
        }
      };
      rec.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== "no-speech" && event.error !== "aborted") {
          toast.error(language === "sw" ? "Hitilafu ya sauti." : "Microphone error.", { id: "spotlight-voice-err" });
        }
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, [language, saveRecentSearch]);

  const toggleVoiceSearch = () => {
    if (!recognitionRef.current) {
      toast.error(language === "sw" ? "Utambuzi wa sauti hautegemezwi." : "Voice search is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.lang = language === "sw" ? "sw-KE" : "en-US";
        recognitionRef.current.start();
        toast(language === "sw" ? "Ongea sasa..." : "Listening... Speak now", { id: "spotlight-voice-start" });
      } catch (err) {
        console.warn("Could not start speech recognition:", err);
      }
    }
  };

  // Execution Handlers
  const handleExecuteSearch = (searchQuery: string) => {
    const clean = searchQuery.trim();
    if (!clean) return;
    saveRecentSearch(clean);
    onClose();
    navigate(`/?search=${encodeURIComponent(clean)}`);
  };

  const handleSelectProduct = (product: Product) => {
    saveRecentSearch(product.name);
    prefetchProductAssets(product);
    onClose();
    if (onProductSelect) {
      onProductSelect(product.id);
    } else {
      navigate(`/product/${product.id}`, { state: { product } });
    }
  };

  const handleSelectCategory = (categoryName: string, subcategoryName?: string) => {
    saveRecentSearch(subcategoryName || categoryName);
    onClose();
    if (onCategorySelect) {
      onCategorySelect(categoryName, subcategoryName);
    } else {
      let target = `/?category=${encodeURIComponent(categoryName)}`;
      if (subcategoryName && subcategoryName !== "All") {
        target += `&subcategory=${encodeURIComponent(subcategoryName)}`;
      }
      navigate(target);
    }
  };

  const handleSelectAction = (action: typeof quickActions[0]) => {
    onClose();
    navigate(action.path);
  };

  // Keyboard navigation within the Spotlight Modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < flatSelectableItems.length ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : Math.max(0, flatSelectableItems.length - 1)));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const active = flatSelectableItems[selectedIndex];
      if (!active) {
        if (query.trim()) handleExecuteSearch(query);
        return;
      }

      switch (active.type) {
        case "search":
          handleExecuteSearch(active.data);
          break;
        case "category":
          handleSelectCategory(active.data.name);
          break;
        case "product":
          handleSelectProduct(active.data);
          break;
        case "action":
          handleSelectAction(active.data);
          break;
        default:
          if (query.trim()) handleExecuteSearch(query);
      }
    }
  };

  // Active Category Details for Preview Panel
  const activeCategoryDetail = useMemo(() => {
    const targetName = hoveredCategory || categoryResults[0]?.name;
    if (!targetName) return null;

    const subcats = CATEGORIES_WITH_SUBCATEGORIES[targetName] || [];
    const catProducts = allProducts.filter(p => p.category === targetName);
    const imageUrl = getCategoryImageUrl(targetName);

    return {
      name: targetName,
      subcategories: subcats,
      productCount: catProducts.length,
      previewProducts: catProducts.slice(0, 3),
      imageUrl,
    };
  }, [hoveredCategory, categoryResults, allProducts]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center p-3 sm:p-4 md:p-6 lg:p-12 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-950/70 backdrop-blur-md transition-opacity cursor-pointer"
          />

          {/* Spotlight Window Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            onKeyDown={handleKeyDown}
            className="relative w-full max-w-4xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10 font-sans"
          >
            {/* Top Search Input Row */}
            <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 bg-white dark:bg-gray-900 sticky top-0 z-20">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Search size={20} className="stroke-[2.5]" />
              </div>

              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder={
                    language === "sw"
                      ? "Tafuta bidhaa, vitengo, watengenezaji, au vifaa..."
                      : "Search products, categories, artisans, or gadgets..."
                  }
                  className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm sm:text-base font-semibold focus:outline-none tracking-tight pr-16"
                />

                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title={language === "sw" ? "Futa" : "Clear"}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Voice Search Button */}
              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20"
                    : "text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                }`}
                title={language === "sw" ? "Tafuta kwa sauti" : "Voice search"}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {/* Close Button & ESC Badge */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-gray-100 dark:border-gray-800">
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-2xs">
                  ESC
                </kbd>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Typo Correction or Slang Suggestion Banner */}
            {queryNormalization && queryNormalization.isSlangOrCorrected && queryNormalization.suggestedTerm && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/50 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lightbulb size={13} className="text-amber-500 shrink-0" />
                  <span>
                    {language === "sw" ? "Kutafsiri misimu/makosa: " : "Did you mean: "}
                    <strong className="underline cursor-pointer" onClick={() => setQuery(queryNormalization.suggestedTerm!)}>
                      {queryNormalization.suggestedTerm}
                    </strong>
                    {" "}({queryNormalization.original})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setQuery(queryNormalization.suggestedTerm!)}
                  className="font-bold text-[11px] hover:underline"
                >
                  {language === "sw" ? "Tumia neno hili" : "Apply"}
                </button>
              </div>
            )}

            {/* Body Content - Split Bento Layout on Desktop */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-150 dark:divide-gray-800">
              
              {/* Left Column: Results & Suggestions (7 cols) */}
              <div 
                ref={scrollContainerRef}
                className="lg:col-span-7 overflow-y-auto p-3 sm:p-4 space-y-5 max-h-[60vh] lg:max-h-[65vh]"
              >
                {/* 1. Direct Search Action when Query is present */}
                {query.trim() && (
                  <div
                    onClick={() => handleExecuteSearch(query)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                      flatSelectableItems[selectedIndex]?.id === "search-query-all"
                        ? "bg-amber-500 text-black font-bold shadow-sm"
                        : "bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Search size={16} className={flatSelectableItems[selectedIndex]?.id === "search-query-all" ? "text-black" : "text-amber-500"} />
                      <span className="text-xs sm:text-sm truncate">
                        {language === "sw" ? "Tafuta matokeo yote ya" : "Search all results for"} <strong className="underline">"{query.trim()}"</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] opacity-75 font-mono shrink-0">
                      <span>↵ Enter</span>
                    </div>
                  </div>
                )}

                {/* 2. Fuzzy Matching Categories (The Core Feature Requested) */}
                {categoryResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                        <Layers size={12} className="text-amber-500" />
                        {query.trim() ? t("Matching Categories") : t("Explore Categories")}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {categoryResults.length} {t("categories")}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categoryResults.map((cat) => {
                        const isSelected = flatSelectableItems[selectedIndex]?.id === `cat-${cat.name}`;
                        return (
                          <div
                            key={cat.name}
                            onClick={() => handleSelectCategory(cat.name)}
                            onMouseEnter={() => {
                              setHoveredCategory(cat.name);
                              setHoveredProduct(null);
                            }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 text-left group ${
                              isSelected
                                ? "bg-amber-500/10 border-amber-500/50 shadow-sm dark:bg-amber-500/15"
                                : "bg-white dark:bg-gray-850/60 border-gray-150 dark:border-gray-800 hover:border-amber-400/40 hover:bg-gray-50 dark:hover:bg-gray-800/80"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
                                  {getCategoryLucideIcon(cat.name, 14, "text-gray-600 dark:text-gray-300 group-hover:text-amber-500 transition-colors stroke-[1.75]")}
                                </div>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-amber-500 transition-colors">
                                  {cat.name}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                {cat.productCount} {t("items")}
                              </span>
                            </div>

                            {/* Subcategories preview tags */}
                            {cat.subcategories.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {cat.subcategories.slice(0, 3).map((sub) => {
                                  const isSubMatch = cat.matchingSubcategories.includes(sub);
                                  return (
                                    <button
                                      key={sub}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectCategory(cat.name, sub);
                                      }}
                                      className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border transition-colors ${
                                        isSubMatch
                                          ? "bg-amber-400 text-black border-amber-500 font-bold"
                                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200/60 dark:border-gray-700/60 hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-amber-950/60 dark:hover:text-amber-300"
                                      }`}
                                    >
                                      {sub}
                                    </button>
                                  );
                                })}
                                {cat.subcategories.length > 3 && (
                                  <span className="text-[9px] font-mono text-gray-400 px-1 py-0.5">
                                    +{cat.subcategories.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Product Results */}
                {productResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                        <ShoppingBag size={12} className="text-orange-500" />
                        {t("Products")} ({productResults.length})
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {t("Instant Preview")}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {productResults.map((product) => {
                        const isSelected = flatSelectableItems[selectedIndex]?.id === `prod-${product.id}`;
                        return (
                          <div
                            key={product.id}
                            onClick={() => handleSelectProduct(product)}
                            onMouseEnter={() => {
                              setHoveredProduct(product);
                              setHoveredCategory(product.category || null);
                              prefetchProductAssets(product);
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group ${
                              isSelected
                                ? "bg-orange-500/10 border-orange-500/50 shadow-sm dark:bg-orange-500/15"
                                : "bg-white dark:bg-gray-850/60 border-gray-150 dark:border-gray-800 hover:border-orange-400/40 hover:bg-gray-50 dark:hover:bg-gray-800/80"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 border border-gray-200/60 dark:border-gray-700/60">
                                <FastImage
                                  src={product.images?.filter(Boolean)[0] || ""}
                                  alt={product.name}
                                  fallbackIconSize={16}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                    {product.name}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-400 mt-0.5">
                                  {product.category && (
                                    <span className="truncate max-w-[120px] font-medium text-gray-500 dark:text-gray-400">
                                      {product.category}
                                    </span>
                                  )}
                                  {product.condition && (
                                    <>
                                      <span>•</span>
                                      <span className="uppercase font-mono text-[9px] px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                        {product.condition.replace("_", " ")}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0 pl-2">
                              <span className="text-xs font-black text-gray-950 dark:text-white tabular-nums">
                                {formatPrice(product.price)}
                              </span>
                              {product.stock === 0 ? (
                                <span className="text-[9px] font-bold text-rose-500">
                                  {t("Out of stock")}
                                </span>
                              ) : product.stock <= 5 ? (
                                <span className="text-[9px] font-bold text-amber-500">
                                  {product.stock} {t("left")}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-500">
                                  {t("In stock")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Empty Search State: Recent & Trending */}
                {!query.trim() && (
                  <div className="space-y-4">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                            <Clock size={12} className="text-blue-500" />
                            {t("Recent Searches")}
                          </span>
                          <button
                            type="button"
                            onClick={clearAllRecents}
                            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium cursor-pointer"
                          >
                            {t("Clear All")}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {recentSearches.map((term) => (
                            <div
                              key={term}
                              onClick={() => handleExecuteSearch(term)}
                              className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 hover:bg-amber-400 hover:text-black dark:hover:bg-amber-400 dark:hover:text-black border border-gray-150 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all cursor-pointer"
                            >
                              <span>{term}</span>
                              <button
                                type="button"
                                onClick={(e) => removeRecentSearch(e, term)}
                                className="opacity-40 group-hover:opacity-100 hover:text-red-600 p-0.5 rounded"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trending Searches */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                          <TrendingUp size={12} className="text-gray-400 dark:text-gray-500" />
                          {t("Trending Searches")}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {TRENDING_SEARCHES.map((trend) => (
                          <button
                            key={trend}
                            type="button"
                            onClick={() => handleExecuteSearch(trend)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-850 hover:border-gray-300 dark:hover:border-gray-700 border border-gray-150 dark:border-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Search size={11} className="text-gray-400 dark:text-gray-500 shrink-0" />
                            <span>{trend}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Quick Actions */}
                {quickActions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">
                      {t("Quick Actions & Navigation")}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {quickActions.map((action) => {
                        const Icon = action.icon;
                        const isSelected = flatSelectableItems[selectedIndex]?.id === action.id;
                        return (
                          <div
                            key={action.id}
                            onClick={() => handleSelectAction(action)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer text-xs font-semibold ${
                              isSelected
                                ? "bg-amber-500/15 border-amber-500/50 text-gray-900 dark:text-white"
                                : "bg-gray-50/70 dark:bg-gray-850/40 border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                          >
                            <Icon size={15} className={action.color} />
                            <span className="truncate">{action.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Zero Results State */}
                {query.trim() && productResults.length === 0 && categoryResults.length === 0 && (
                  <div className="text-center py-10 px-4 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-gray-400">
                      <Search size={22} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {language === "sw" ? "Hakuna matokeo kwa" : "No results for"} "{query}"
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        {language === "sw"
                          ? "Jaribu kutafuta kwa jina la jumla, kitengo au msamiati mwingine."
                          : "Try searching with broader terms, categories, or colloquial keywords."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExecuteSearch(query)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <span>{t("Search Entire Catalog Anyway")}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Live Fuzzy Category Preview & Product Inspector (5 cols, Desktop) */}
              <div className="hidden lg:flex lg:col-span-5 bg-gray-50/50 dark:bg-gray-950/40 p-4 flex-col justify-between overflow-y-auto max-h-[65vh]">
                {hoveredProduct ? (
                  /* Live Product Inspector */
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      <Eye size={11} className="text-orange-500" />
                      {t("Product Preview")}
                    </div>

                    <div className="aspect-square w-full rounded-2xl bg-white dark:bg-gray-900 overflow-hidden border border-gray-200/80 dark:border-gray-800 shadow-sm relative group">
                      <FastImage
                        src={hoveredProduct.images?.filter(Boolean)[0] || ""}
                        alt={hoveredProduct.name}
                        fallbackIconSize={48}
                      />
                      {hoveredProduct.originalPrice && hoveredProduct.originalPrice > hoveredProduct.price && (
                        <div className="absolute top-2.5 right-2.5 bg-gray-900 text-white dark:bg-white dark:text-gray-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs">
                          -{Math.round(((hoveredProduct.originalPrice - hoveredProduct.price) / hoveredProduct.originalPrice) * 100)}%
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {hoveredProduct.category && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                            {hoveredProduct.category}
                          </span>
                        )}
                        {hoveredProduct.artisan && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                            {t("Artisan Crafted")}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-gray-900 dark:text-white leading-snug line-clamp-2">
                        {hoveredProduct.name}
                      </h3>

                      {hoveredProduct.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {hoveredProduct.description}
                        </p>
                      )}

                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-lg font-black text-gray-950 dark:text-white">
                          {formatPrice(hoveredProduct.price)}
                        </span>
                        {hoveredProduct.originalPrice && hoveredProduct.originalPrice > hoveredProduct.price && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatPrice(hoveredProduct.originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectProduct(hoveredProduct)}
                      className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <span>{t("View Product Details")}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : activeCategoryDetail ? (
                  /* Live Category & Subcategory Preview */
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      <Layers size={11} className="text-amber-500" />
                      {t("Category Spotlight")}
                    </div>

                    <div className="relative h-28 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm bg-gray-900 group">
                      <img
                        src={activeCategoryDetail.imageUrl}
                        alt={activeCategoryDetail.name}
                        className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent p-3 flex flex-col justify-end">
                        <div className="flex items-center gap-2 text-white">
                          <div className="w-6 h-6 rounded-md bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0">
                            {getCategoryLucideIcon(activeCategoryDetail.name, 14, "text-white stroke-[1.75]")}
                          </div>
                          <span className="font-extrabold text-sm tracking-tight">{activeCategoryDetail.name}</span>
                        </div>
                        <span className="text-[11px] text-gray-300">
                          {activeCategoryDetail.productCount} {t("active products in stock")}
                        </span>
                      </div>
                    </div>

                    {/* Subcategories grid */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t("Subcategories & Filters")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeCategoryDetail.subcategories.map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => handleSelectCategory(activeCategoryDetail.name, sub)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-gray-850 hover:bg-amber-400 hover:text-black dark:hover:bg-amber-400 dark:hover:text-black border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer text-left"
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category Top Preview Products */}
                    {activeCategoryDetail.previewProducts.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-gray-200/60 dark:border-gray-800/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {t("Popular in this category")}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {activeCategoryDetail.previewProducts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleSelectProduct(p)}
                              className="bg-white dark:bg-gray-850 p-1.5 rounded-xl border border-gray-150 dark:border-gray-800 cursor-pointer hover:border-amber-400 transition-all group"
                            >
                              <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden mb-1">
                                <FastImage
                                  src={p.images?.filter(Boolean)[0] || ""}
                                  alt={p.name}
                                  fallbackIconSize={14}
                                />
                              </div>
                              <p className="text-[10px] font-bold truncate text-gray-800 dark:text-gray-200 group-hover:text-amber-500">
                                {p.name}
                              </p>
                              <p className="text-[10px] font-black text-gray-950 dark:text-white tabular-nums">
                                {formatPrice(p.price)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSelectCategory(activeCategoryDetail.name)}
                      className="w-full py-2 px-3 bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      <span>{t("Explore all in")} {activeCategoryDetail.name}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6 space-y-2">
                    <Compass size={32} className="opacity-40" />
                    <p className="text-xs font-semibold">
                      {language === "sw"
                        ? "Pitia vitengo au bidhaa ili kuona muhtasari wa haraka hapa."
                        : "Hover over categories or products to preview instant details."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Keyboard Shortcuts & Help Bar */}
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border-t border-gray-150 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded shadow-2xs font-bold text-gray-700 dark:text-gray-300">
                    ↑
                  </kbd>
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded shadow-2xs font-bold text-gray-700 dark:text-gray-300">
                    ↓
                  </kbd>
                  <span className="hidden sm:inline">{language === "sw" ? "Chagua" : "to navigate"}</span>
                </span>

                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded shadow-2xs font-bold text-gray-700 dark:text-gray-300">
                    ↵ Enter
                  </kbd>
                  <span className="hidden sm:inline">{language === "sw" ? "Fungua" : "to open"}</span>
                </span>

                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded shadow-2xs font-bold text-gray-700 dark:text-gray-300">
                    ESC
                  </kbd>
                  <span className="hidden sm:inline">{language === "sw" ? "Funga" : "to close"}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 font-medium">
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  <Search size={11} /> Spotlight Search
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
