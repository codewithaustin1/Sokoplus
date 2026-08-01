import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  LayoutGrid, 
  ShoppingCart, 
  User, 
  X, 
  ChevronRight, 
  Search, 
  Sparkles, 
  Shirt, 
  Apple, 
  Smartphone, 
  Scissors, 
  Home as HomeIcon, 
  PawPrint, 
  Tag, 
  ArrowRight, 
  Layers, 
  Store,
  Check,
  ScanLine
} from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useLanguage } from "../lib/LanguageContext";
import { useSettings } from "../lib/SettingsContext";
import { getCategoryImageUrl } from "../lib/categoryImages";
import { UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../lib/firebase";
import { collection, query, limit, getDocs } from "firebase/firestore";

interface BottomNavigationProps {
  user: UserProfile | null;
}

const DEFAULT_CATEGORIES = [
  { name: "Local Crafts", labelEn: "Local Crafts", labelSw: "Sanaa za Mikono", icon: Sparkles, desc: "Authentic handmade Kenyan crafts & gifts" },
  { name: "Fashion", labelEn: "Fashion & Apparel", labelSw: "Mavazi na Mitindo", icon: Shirt, desc: "Modern wear & artisanal textiles" },
  { name: "Groceries", labelEn: "Groceries & Fresh Food", labelSw: "Bidhaa za Vyakula", icon: Apple, desc: "Farm-fresh produce & daily essentials" },
  { name: "Electronics", labelEn: "Electronics & Tech", labelSw: "Kielektroniki na Vifaa", icon: Smartphone, desc: "Smart devices & tech accessories" },
  { name: "Beauty & Personal Care (Skincare, Haircare, Cosmetics)", labelEn: "Beauty & Personal Care", labelSw: "Urembo na Vipodozi", icon: Scissors, desc: "Organic skincare, haircare & cosmetics" },
  { name: "Home & Office Décor (Small Scale & Gadgets)", labelEn: "Home & Office Décor", labelSw: "Mapambo ya Nyumbani na Ofisini", icon: HomeIcon, desc: "Interior accessories & workspace gadgets" },
  { name: "Pet Supplies (Toys, Collars, Accessories, Dry Kibble)", labelEn: "Pet Supplies", labelSw: "Vifaa vya Wanyama", icon: PawPrint, desc: "Pet toys, collars & nutrition" },
];

export default function BottomNavigation({ user }: BottomNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { items } = useCart();
  const { language } = useLanguage();
  const { settings } = useSettings();
  const [imgError, setImgError] = useState(false);

  // Categories drawer state
  const [isCategoriesDrawerOpen, setIsCategoriesDrawerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [dbCategoryNames, setDbCategoryNames] = useState<string[]>([]);
  const [categoryItemCounts, setCategoryItemCounts] = useState<Record<string, number>>({});

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const getItemFallbackCount = (name: string): number => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    return 12 + (Math.abs(hash) % 25);
  };

  // Lock body scroll when categories drawer is open
  useEffect(() => {
    if (isCategoriesDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCategoriesDrawerOpen]);

  // Fetch unique categories & item counts from Firestore products
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const q = query(collection(db, "products"), limit(250));
        const snap = await getDocs(q);
        const setOfCats = new Set<string>();
        const counts: Record<string, number> = {};

        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.active !== false && (!data.approvalStatus || data.approvalStatus === "approved") && data.category) {
            const cat = data.category.trim();
            setOfCats.add(cat);
            counts[cat] = (counts[cat] || 0) + 1;
          }
        });

        if (isMounted) {
          setCategoryItemCounts(counts);
          if (setOfCats.size > 0) {
            setDbCategoryNames(Array.from(setOfCats));
          } else {
            // Default active categories fallback if DB query yields no products
            setDbCategoryNames(["Local Crafts", "Fashion", "Groceries", "Electronics", "Beauty & Personal Care", "Home & Office Décor", "Pet Supplies"]);
          }
        }
      } catch (err) {
        console.warn("Categories fetch notice:", err);
        if (isMounted) {
          setDbCategoryNames(["Local Crafts", "Fashion", "Groceries", "Electronics", "Beauty & Personal Care", "Home & Office Décor", "Pet Supplies"]);
        }
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Reset image error if user photo URL changes
  useEffect(() => {
    setImgError(false);
  }, [user?.photoURL]);

  // Current selected category from URL search params
  const currentCategoryParam = new URLSearchParams(location.search).get("category") || "All";

  // Determine active states
  const isCategoriesActive = isCategoriesDrawerOpen || (location.pathname === "/" && (location.search.includes("category") || location.search.includes("collection") || location.search.includes("categories")));
  const isHomeActive = location.pathname === "/" && !isCategoriesActive && !location.search.includes("search");
  const isProfileActive = location.pathname === "/profile";
  const isCartActive = location.pathname === "/cart";

  // Generate initials for logged-in user without custom avatar
  const userInitials = user?.displayName
    ? user.displayName.split(" ").filter(Boolean).map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : null;

  // Matching helper to check if a category has actively listed products in Firestore
  const isMatchingProductCategory = (dcName: string, activeDbCats: string[]) => {
    if (!activeDbCats || activeDbCats.length === 0) return false;
    const targetLower = dcName.toLowerCase().trim();
    return activeDbCats.some(dbCat => {
      const dbLower = dbCat.toLowerCase().trim();
      if (!dbLower) return false;
      if (dbLower === targetLower) return true;
      if (targetLower.includes(dbLower) || dbLower.includes(targetLower)) return true;
      const dbWord = dbLower.split(/[\s&()/,-]+/)[0];
      const targetWord = targetLower.split(/[\s&()/,-]+/)[0];
      if (dbWord && targetWord && dbWord.length >= 3 && targetWord.length >= 3 && dbWord === targetWord) {
        return true;
      }
      return false;
    });
  };

  // Build unified categories list containing ONLY active categories with listed products
  const allCategoryList = (() => {
    const activeDefaultList = DEFAULT_CATEGORIES.filter(dc => 
      isMatchingProductCategory(dc.name, dbCategoryNames)
    ).map(dc => ({
      name: dc.name,
      label: language === "sw" ? dc.labelSw : dc.labelEn,
      icon: dc.icon,
      desc: dc.desc
    }));

    // Custom DB categories with active products not covered in DEFAULT_CATEGORIES
    const extraNames = dbCategoryNames.filter(
      catName => !DEFAULT_CATEGORIES.some(dc => isMatchingProductCategory(dc.name, [catName]))
    );

    const extraList = extraNames.map(catName => {
      const lower = catName.toLowerCase();
      let IconComp = Tag;
      if (lower.includes("craft") || lower.includes("sanaa")) IconComp = Sparkles;
      else if (lower.includes("fashion") || lower.includes("clothing") || lower.includes("mavazi")) IconComp = Shirt;
      else if (lower.includes("grocer") || lower.includes("food") || lower.includes("vyakula")) IconComp = Apple;
      else if (lower.includes("electr") || lower.includes("tech") || lower.includes("kielektroniki")) IconComp = Smartphone;
      else if (lower.includes("beauty") || lower.includes("care") || lower.includes("urembo")) IconComp = Scissors;
      else if (lower.includes("home") || lower.includes("decor") || lower.includes("mapambo")) IconComp = HomeIcon;
      else if (lower.includes("pet") || lower.includes("wanyama")) IconComp = PawPrint;

      return {
        name: catName,
        label: catName,
        icon: IconComp,
        desc: language === "sw" ? "Mkusanyiko Maalum" : "Specialized artisan collection"
      };
    });

    return [...activeDefaultList, ...extraList];
  })();

  // Filtered categories based on search input inside the drawer
  const filteredCategories = allCategoryList.filter(c => {
    if (!categorySearch.trim()) return true;
    const q = categorySearch.toLowerCase().trim();
    return c.name.toLowerCase().includes(q) || c.label.toLowerCase().includes(q) || (c.desc && c.desc.toLowerCase().includes(q));
  });

  const handleSelectCategory = (categoryName: string) => {
    setIsCategoriesDrawerOpen(false);
    setCategorySearch("");
    
    if (categoryName === "All") {
      navigate("/");
    } else {
      navigate(`/?category=${encodeURIComponent(categoryName)}`);
    }

    // Smooth scroll to products section if on home page
    setTimeout(() => {
      const section = document.getElementById("products-section") || document.getElementById("home-categories-section");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);
  };

  const navItems = [
    {
      id: "home",
      label: language === "sw" ? "Nyumbani" : "Home",
      icon: Home,
      isActive: isHomeActive,
      onClick: () => {
        setIsCategoriesDrawerOpen(false);
        if (location.pathname === "/" && !location.search) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          navigate("/");
        }
      },
    },
    {
      id: "categories",
      label: language === "sw" ? "Jamii" : "Categories",
      icon: LayoutGrid,
      isActive: isCategoriesActive,
      onClick: () => {
        setIsCategoriesDrawerOpen(prev => !prev);
      },
    },
    {
      id: "profile",
      label: language === "sw" ? "Wasifu" : "Profile",
      icon: User,
      isActive: isProfileActive,
      onClick: () => {
        setIsCategoriesDrawerOpen(false);
        navigate("/profile");
      },
      avatar: user?.photoURL || undefined,
    },
    {
      id: "cart",
      label: language === "sw" ? "Kikapu" : "Cart",
      icon: ShoppingCart,
      isActive: isCartActive,
      onClick: () => {
        setIsCategoriesDrawerOpen(false);
        navigate("/cart");
      },
      badge: itemCount > 0 ? itemCount : undefined,
    },
  ];

  return (
    <>
      {/* MOBILE CATEGORIES FULL-SCREEN OVERLAY / MODAL */}
      <AnimatePresence>
        {isCategoriesDrawerOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsCategoriesDrawerOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-[140] md:hidden"
            />

            {/* Mobile View Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 top-0 bg-gray-50 dark:bg-gray-950 z-[150] md:hidden flex flex-col overflow-hidden"
            >
              {/* Header & Search Bar */}
              <div className="p-4 pb-3 bg-white dark:bg-gray-900 border-b border-gray-150 dark:border-gray-800 space-y-3 shrink-0 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  {/* Search categories bar with left search icon and right scan icon */}
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Search size={18} />
                    </span>
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder={language === "sw" ? "Tafuta kitengo..." : "Search categories..."}
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-100 dark:bg-gray-800 border border-transparent dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/50 text-sm font-medium transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {categorySearch ? (
                        <button
                          onClick={() => setCategorySearch("")}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      ) : (
                        <ScanLine size={18} className="text-gray-400 hover:text-orange-500 cursor-pointer" />
                      )}
                    </div>
                  </div>

                  {/* Close Modal Button */}
                  <button
                    onClick={() => setIsCategoriesDrawerOpen(false)}
                    className="p-2.5 text-gray-500 hover:text-orange-600 bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700 cursor-pointer shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Section Title */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    {language === "sw" ? "Vitengo" : "Categories"}
                  </h1>
                  <span className="text-xs font-semibold text-gray-400">
                    {filteredCategories.length} {language === "sw" ? "Aina" : "Available"}
                  </span>
                </div>
              </div>

              {/* Scrollable Categories Grid */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-120px)]">
                {/* Feature Card: All Products */}
                {!categorySearch.trim() && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectCategory("All")}
                    className={`w-full p-4 rounded-[22px] border text-left transition-all duration-200 flex items-center justify-between group cursor-pointer relative overflow-hidden shadow-2xs ${
                      currentCategoryParam === "All"
                        ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500"
                        : "bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-900 dark:text-white hover:border-orange-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 z-10">
                      <div className={`p-3 rounded-2xl ${
                        currentCategoryParam === "All"
                          ? "bg-white/20 text-white"
                          : "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400"
                      }`}>
                        <Layers size={22} />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold leading-tight">
                          {language === "sw" ? "Vitengo Vyote na Ofa" : "All Collections"}
                        </h3>
                        <span className={`text-xs block mt-0.5 font-medium ${
                          currentCategoryParam === "All" ? "text-white/80" : "text-gray-400"
                        }`}>
                          {language === "sw" ? "Tazama bidhaa zote sokoni" : "Explore full marketplace"}
                        </span>
                      </div>
                    </div>

                    <div className="z-10">
                      {currentCategoryParam === "All" ? (
                        <Check size={20} className="text-white font-bold" />
                      ) : (
                        <ChevronRight size={20} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </div>
                  </motion.button>
                )}

                {/* 2-Column Responsive Card Grid matching requested UI */}
                {filteredCategories.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400 font-medium">
                    {language === "sw" ? "Hakuna kitengo kilichopatikana" : "No matching categories found"}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3.5 sm:gap-4 pb-16">
                    {filteredCategories.map((cat) => {
                      const bgImg = getCategoryImageUrl(cat.name, settings?.categoryImages);
                      const realCount = categoryItemCounts[cat.name] || categoryItemCounts[cat.label];
                      const itemCountText = realCount !== undefined ? `${realCount} items` : `${getItemFallbackCount(cat.name)} items`;

                      return (
                        <motion.button
                          key={cat.name}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleSelectCategory(cat.name)}
                          className="relative w-full rounded-[22px] overflow-hidden aspect-[1/1.08] shadow-sm border border-gray-150/60 dark:border-gray-800 group cursor-pointer text-left focus:outline-none"
                        >
                          {/* Image Background */}
                          <img
                            src={bgImg}
                            alt={cat.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80";
                            }}
                          />

                          {/* Dark Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

                          {/* Text Overlay at bottom left */}
                          <div className="absolute bottom-0 left-0 right-0 p-3.5 sm:p-4 text-white z-10 flex flex-col justify-end">
                            <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight drop-shadow-xs">
                              {cat.label}
                            </h3>
                            <span className="text-xs font-medium text-white/85 mt-0.5 block">
                              {itemCountText}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* BOTTOM NAVIGATION BAR */}
      <div 
        id="mobile-bottom-navigation" 
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-150/70 dark:border-gray-800/80 md:hidden shadow-[0_-6px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_-6px_20px_rgba(0,0,0,0.4)] pb-safe-bottom select-none"
      >
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-3">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <motion.button
                key={item.id}
                onClick={item.onClick}
                whileTap={{ scale: 0.94 }}
                className="relative flex flex-col items-center justify-center flex-1 h-13 py-1 text-center group cursor-pointer focus:outline-none bg-transparent border-none"
              >
                {/* Active Soft Orange Capsule Pill */}
                {item.isActive && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-x-1 sm:inset-x-2 top-0.5 bottom-0.5 bg-[#FFF3EB] dark:bg-orange-950/50 rounded-2xl border border-orange-200/50 dark:border-orange-800/30 -z-10 shadow-xs"
                  />
                )}

                <div className="relative flex items-center justify-center">
                  {/* Profile Avatar / Custom Badge or Placeholder */}
                  {item.id === "profile" ? (
                    user?.photoURL && !imgError ? (
                      <motion.img
                        src={user.photoURL}
                        alt={user.displayName || "Profile"}
                        onError={() => setImgError(true)}
                        animate={item.isActive ? { scale: 1.08 } : { scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`w-5.5 h-5.5 rounded-full object-cover transition-all duration-200 ring-2 ${
                          item.isActive
                            ? "ring-orange-500"
                            : "ring-gray-300 dark:ring-gray-700"
                        }`}
                        referrerPolicy="no-referrer"
                      />
                    ) : userInitials ? (
                      <motion.div
                        animate={item.isActive ? { scale: 1.08 } : { scale: 1 }}
                        transition={{ type: "spring", stiffness: 450, damping: 22 }}
                        className={`w-5.5 h-5.5 rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-black text-[9px] tracking-tight transition-all ring-1.5 ${
                          item.isActive
                            ? "ring-orange-500 text-orange-400"
                            : "ring-gray-300 dark:ring-gray-700 text-slate-200"
                        }`}
                      >
                        {userInitials}
                      </motion.div>
                    ) : (
                      <motion.div
                        animate={item.isActive ? { scale: 1.08 } : { scale: 1 }}
                        transition={{ type: "spring", stiffness: 450, damping: 22 }}
                        className={`w-5.5 h-5.5 rounded-full flex items-center justify-center transition-all ring-1.5 ${
                          item.isActive
                            ? "bg-orange-500 text-white ring-orange-500"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-gray-400 ring-slate-300 dark:ring-gray-700"
                        }`}
                      >
                        <User size={13} className="stroke-[2.2]" />
                      </motion.div>
                    )
                  ) : (
                    <motion.div
                      animate={item.isActive ? { scale: 1.08, y: -0.5 } : { scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 450, damping: 22 }}
                    >
                      <IconComponent
                        size={21}
                        className={`transition-colors duration-200 ${
                          item.isActive
                            ? "text-orange-600 dark:text-orange-500 stroke-[2.2]"
                            : "text-slate-400 dark:text-gray-400 group-hover:text-slate-600 dark:group-hover:text-gray-200 stroke-[1.8]"
                        }`}
                      />
                    </motion.div>
                  )}

                  {/* Cart Badge */}
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2 bg-orange-600 text-white text-[9px] font-black min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-gray-950 shadow-xs tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Tab Label Text */}
                <span
                  className={`text-[11px] mt-0.5 tracking-tight transition-all duration-200 ${
                    item.isActive
                      ? "text-orange-600 dark:text-orange-500 font-bold"
                      : "text-slate-500 dark:text-gray-400 font-medium group-hover:text-slate-700 dark:group-hover:text-gray-200"
                  }`}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </>
  );
}


