import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "sw";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navbar & Search
    searchPlaceholder: "Search products in Kenya...",
    home: "Home",
    blog: "Blog",
    admin: "Admin",
    cart: "Cart",
    profile: "Profile",
    login: "Login",
    logout: "Logout",
    wishlist: "Wishlist",
    navSlogan: "Authentic Kenyan Handcrafts",

    // Hero Section / Homepage
    heroBadge: "SokoPlus Kenya • 100% Authentic Handcrafts",
    heroTitle: "Quality Goods, Kenyan Soul.",
    heroSubtitle: "Discover verified Kenyan crafts and daily goods delivered straight to your door. Safely checkout with M-Pesa & track your delivery from workshop to home.",
    shopCollect: "Shop Collection",
    learnStory: "Learn Our Story",
    categoriesTitle: "Curated Categories",
    categoriesSub: "Handcrafted, sourced sustainably from direct Kenyan artisans.",
    featuredTitle: "Trending Masterpieces",
    featuredSub: "Most loved designs, verified for quality and authentic origins.",
    foundProductsBefore: "Found",
    foundProductsAfter: "authentic products",
    allCategories: "All Categories",
    highToLow: "Price: High to Low",
    lowToHigh: "Price: Low to High",
    noProducts: "No products matched your criteria.",
    offlineCacheView: "Offline Cache View",

    // Product Card
    addToCart: "Add to Cart",
    outOfStock: "Out of Stock",
    earnPoints: "Earn points on every purchase across all local categories.",

    // Cart Page
    yourCartEmpty: "Your cart is empty",
    yourCartEmptySub: "Looks like you haven't added anything to your cart yet.",
    continueShopping: "Continue Shopping",
    cartSummary: "Order Summary",
    subtotal: "Subtotal",
    taxVat: "Standard VAT/Tax included",
    checkoutButton: "Proceed to Checkout",
    remove: "Remove",
    loyaltyApplied: "SokoPlus Loyalty XP Reward Points",

    // Profile Page
    loyaltyPoints: "Loyalty Points",
    userProfile: "User Profile",
    personalStats: "Personal Statistics",
    deviceAlerts: "Delivery & Dispatch Alerts",
    deviceAlertsSub: "Enable native browser alerts to automatically receive real-time notifications about dispatch, routing, and delivered status of your SokoPlus order.",
    enableAlerts: "Enable Browser Alerts",
    activeAlerts: "Permission Opt-In",
    active: "Active",
    blocked: "Blocked",
    disabled: "Disabled",
    status: "Status",
    orderHistory: "Order History",
    filterMonth: "This Month",
    filter12Months: "Last 12 Months",
    filterSpecific: "Specific Month",
    noOrders: "No orders found in this selection.",

    // Footer
    aboutTitle: "About SokoPlus",
    aboutDesc: "SokoPlus connects authentic Kenyan workshops directly to global and local buyers, with transparent logistics and verification.",
    quickLinks: "Quick Links",
    customerSupport: "Customer Support",
    copyright: "All rights reserved. Sourced direct from Kenyan creators."
  },
  sw: {
    // Navbar & Search
    searchPlaceholder: "Tafuta bidhaa na kazi safi za mikono sokoni...",
    home: "Nyumbani (Karibu)",
    blog: "Hadithi Zetu",
    admin: "Usimamizi wa Soko",
    cart: "Kikapu Chako",
    profile: "Wasifu Wako",
    login: "Ingia (Karibu)",
    logout: "Ondoka Salama",
    wishlist: "Vipendavyo Moyoni",
    navSlogan: "Kazi Safi ya Mikono, Nafsi ya Kenya",

    // Hero Section / Homepage
    heroBadge: "SokoPlus Kenya • Kazi Maalum na Bidhaa 100% Halisi za Kienyeji",
    heroTitle: "Bidhaa Bora, Nafsi ya Kenya.",
    heroSubtitle: "Gundua sanaa asilia kamilifu na bidhaa bora zilizoundwa kwa upendo na mafundi wetu kote nchini. Lipa salama kupitia M-Pesa na upokee mzigo mlangoni pako kwa uaminifu na amani ya akili.",
    shopCollect: "Anza Kununua Sasa",
    learnStory: "Jifunze Historia Yetu",
    categoriesTitle: "Vitengo Vilivyoteuliwa kwa Makini",
    categoriesSub: "Kazi safi za mikono, zilizosafirishwa moja kwa moja kutoka kwa mafundi shupavu wa Kenya.",
    featuredTitle: "Kazi Kubwa za Sanaa Zinazovuma",
    featuredSub: "Miundo maarufu inayopendwa zaidi, iliyohakikiwa kwa ubora mkuu na asili yake halisi.",
    foundProductsBefore: "Tumefanikiwa kupata bidhaa",
    foundProductsAfter: "halisi na thabiti sokoni",
    allCategories: "Vitengo Vyote",
    highToLow: "Bei: Juu hadi Chini",
    lowToHigh: "Bei: Chini hadi Juu",
    noProducts: "Hakuna bidhaa zilizolingana na vigezo vyako.",
    offlineCacheView: "Mwonekano wa Cache ya Nje ya Mtandao",

    // Product Card
    addToCart: "Weka Kwenye Kikapu",
    outOfStock: "Mali imeisha kwa sasa",
    earnPoints: "Vuna alama za uaminifu na upate zawadi maalum kwa kila ununuzi kote sokoni.",

    // Cart Page
    yourCartEmpty: "Kikapu chako kiko tupu kwa sasa",
    yourCartEmptySub: "Inaonekana bado hujaweka ununuzi wowote kwenye kikapu chako. Karibu utazame bidhaa zetu kupata unachoipenda.",
    continueShopping: "Rudi Sokoni / Endelea Kununua",
    cartSummary: "Muhtasari wa Ununuzi wako",
    subtotal: "Jumla Ndogo (Gharama)",
    taxVat: "Imeshatolewa kodi yote ya VAT ya kawaida",
    checkoutButton: "Lipia sasa kupitia M-Pesa kwa urahisi",
    remove: "Ondoa mbali",
    loyaltyApplied: "Alama za Zawadi ya SokoPlus Loyalty zimetumika kwa mafanikio",

    // Profile Page
    loyaltyPoints: "Alama Zako za Uaminifu",
    userProfile: "Wasifu wa Mwanasoko",
    personalStats: "Takwimu Zako za Ununuzi",
    deviceAlerts: "Arifa za Wakati Real Kuhusu Safari ya Mzigo",
    deviceAlertsSub: "Washa arifa za kivinjari ili kupata ujumbe kiotomatiki wakati mzigo wako unapoondoka karakana hadi unapokaribia mlangoni pako.",
    enableAlerts: "Washa Arifa za Safari ya Mzigo",
    activeAlerts: "Ruhusa Zimekubaliwa",
    active: "Inafanya Kazi vyema",
    blocked: "Imezuiwa",
    disabled: "Imezimwa",
    status: "Hali",
    orderHistory: "Historia ya Maagizo Yako",
    filterMonth: "Mwezi Huu",
    filter12Months: "Miezi 12 Iliyopita",
    filterSpecific: "Mwezi Maalum",
    noOrders: "Bado hujaagiza katika kundi hili.",

    // Footer
    aboutTitle: "Kuhusu SokoPlus Kenya",
    aboutDesc: "SokoPlus inaandaa soko la kidijitali linalounganisha warsha na mafundi hodari wa Kenya moja kwa moja na mioyo ya wanunuzi kote duniani, kwa uwazi kamili na urahisi.",
    quickLinks: "Viungo vya Haraka",
    customerSupport: "Tuko Hapa Kukusaidia (Msaada)",
    copyright: "Haki zote zimehifadhiwa © SokoPlus. Kazi za dhati kutoka kwa mafundi shupavu wa Kenya."
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sokoplus_language");
      if (saved === "en" || saved === "sw") {
        return saved;
      }
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("sokoplus_language", lang);
    }
  };

  const t = (key: string): string => {
    // Resolve key safely with fallback to english or raw key
    const val = translations[language]?.[key] || translations["en"]?.[key] || key;
    return val;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
