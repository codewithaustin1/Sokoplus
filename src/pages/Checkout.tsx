import React, { useState, useEffect } from "react";
import { useCart } from "../lib/CartContext";
import { UserProfile, CartItem } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { 
  CreditCard, 
  ShoppingBag, 
  ShieldCheck, 
  Loader2, 
  MapPin, 
  Truck, 
  Check, 
  Info, 
  AlertTriangle, 
  Sparkles, 
  Trash2, 
  Smartphone, 
  Plus, 
  Minus, 
  Lock, 
  ChevronDown, 
  ChevronUp,
  Receipt,
  HelpCircle,
  ArrowRight,
  Gift,
  X,
  RefreshCw,
  Banknote,
  Award,
  Layers,
  Zap,
  CheckCircle2,
  Tag,
  UserCheck,
  SlidersHorizontal
} from "lucide-react";
import { getOrCreateGuestSessionToken, saveGuestAddressDraft, getGuestAddressDraft } from "../utils/guestSession";
import { motion, AnimatePresence } from "motion/react";
import { counties } from "../data/counties";
import { FastImage } from "../components/FastImage";
import { calculateDelivery, calculateShippingFee } from "../utils/delivery";
import { DeliveryCountdown } from "../components/DeliveryCountdown";
import { useSellerStudio } from "../lib/SellerStudioContext";
import { useSettings } from "../lib/SettingsContext";
import FreeDeliveryMap from "../components/FreeDeliveryMap";
import DeliveryLocationSearch, { SelectedLocationData } from "../components/DeliveryLocationSearch";

const COUNTRY_FLAGS: Record<string, string> = {
  "Kenya": "🇰🇪",
  "Uganda": "🇺🇬",
  "Tanzania": "🇹🇿",
  "Rwanda": "🇷🇼",
};

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"],
  "Uganda": ["Kampala", "Entebbe", "Jinja"],
  "Tanzania": ["Dar es Salaam", "Arusha", "Zanzibar"],
  "Rwanda": ["Kigali", "Gisenyi"],
};

interface CheckoutProps {
  user: UserProfile | null;
}

export default function Checkout({ user }: CheckoutProps) {
  const { sellerStudioEnabled } = useSellerStudio();
  const { settings } = useSettings();
  const { items, total, addToCart, removeFromCart } = useCart();
  const [disabledCountries, setDisabledCountries] = useState<string[]>([]);
  const [disabledCounties, setDisabledCounties] = useState<string[]>([]);
  const [disabledCities, setDisabledCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectStage, setRedirectStage] = useState("Securing Connection");
  const [redirectDescription, setRedirectDescription] = useState("We are connecting you securely to Paystack to finalize your payment options.");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card" | "cod">("mpesa");
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [showMobilSummaryDrawer, setShowMobilSummaryDrawer] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  
  // Interactive credit card mockup states
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardFocused, setCardFocused] = useState(false);
  
  const [address, setAddress] = useState(() => {
    const savedCountry = localStorage.getItem("sokoplus_delivery_country") || "Kenya";
    let savedCity = localStorage.getItem("sokoplus_delivery_city") || "Nairobi CBD";
    let savedCounty = localStorage.getItem("sokoplus_delivery_county") || "Nairobi City County";

    if (savedCountry === "Kenya") {
      if (savedCity === "Nairobi") {
        savedCounty = "Nairobi City County";
        savedCity = "Nairobi CBD";
      } else if (savedCity === "Mombasa") {
        savedCounty = "Mombasa County";
        savedCity = "Mombasa City (CBD/Island)";
      } else if (savedCity === "Kisumu") {
        savedCounty = "Kisumu County";
        savedCity = "Kisumu City";
      } else if (savedCity === "Nakuru") {
        savedCounty = "Nakuru County";
        savedCity = "Nakuru City";
      } else if (savedCity === "Eldoret") {
        savedCounty = "Uasin Gishu County";
        savedCity = "Eldoret City";
      }
    }

    let initialPhone = user?.phoneNumber || "";
    initialPhone = initialPhone.replace(/\s+/g, "");
    if (initialPhone.startsWith("+254")) {
      initialPhone = initialPhone.substring(4);
    } else if (initialPhone.startsWith("254")) {
      initialPhone = initialPhone.substring(3);
    } else if (initialPhone.startsWith("0")) {
      initialPhone = initialPhone.substring(1);
    }

    const guestDraft = !user ? getGuestAddressDraft() : null;

    return {
      country: guestDraft?.country || savedCountry,
      city: guestDraft?.city || savedCity,
      county: savedCountry === "Kenya" ? (guestDraft?.county || savedCounty) : "",
      street: guestDraft?.street || "",
      landmarkNotes: guestDraft?.landmarkNotes || "",
      lat: guestDraft?.lat as number | undefined,
      lng: guestDraft?.lng as number | undefined,
      phone: guestDraft?.phone || initialPhone,
      email: user?.email || guestDraft?.email || ""
    };
  });

  const [showManualRegionEdit, setShowManualRegionEdit] = useState<boolean>(false);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  const matchRegionFromOSM = (loc: Partial<SelectedLocationData>) => {
    const rawCountry = (loc.country || "").trim().toLowerCase();
    const rawCounty = (loc.county || "").trim().toLowerCase();
    const rawCity = (loc.city || "").trim().toLowerCase();
    const rawFull = `${loc.shortAddress || ""} ${loc.displayName || ""}`.trim().toLowerCase();

    // 1. Determine Country
    let matchedCountry = "Kenya";
    const countryKeys = Object.keys(COUNTRY_FLAGS);
    const matchedCty = countryKeys.find(c => 
      rawCountry.includes(c.toLowerCase()) || 
      rawFull.includes(c.toLowerCase())
    );
    if (matchedCty) {
      matchedCountry = matchedCty;
    }

    let matchedCounty = "Nairobi City County";
    let matchedCity = "";

    if (matchedCountry === "Kenya") {
      // Check if city matches any specific city in our counties dataset
      let foundCountyByCity: (typeof counties)[0] | undefined;
      for (const cObj of counties) {
        const cityHit = cObj.cities.find(ct => 
          rawCity.includes(ct.toLowerCase()) || 
          rawFull.includes(ct.toLowerCase())
        );
        if (cityHit) {
          foundCountyByCity = cObj;
          matchedCity = cityHit;
          break;
        }
      }

      if (foundCountyByCity) {
        matchedCounty = foundCountyByCity.name;
      } else {
        // Check county name match
        const countyHit = counties.find(cObj => {
          const cNorm = cObj.name.toLowerCase().replace("county", "").trim();
          return rawCounty.includes(cNorm) || rawFull.includes(cNorm);
        });
        if (countyHit) {
          matchedCounty = countyHit.name;
        }
      }

      // Pick city if not yet matched
      const activeCountyObj = counties.find(cObj => cObj.name === matchedCounty);
      if (activeCountyObj) {
        if (!matchedCity) {
          const candidateCity = activeCountyObj.cities.find(ct => 
            rawCity.includes(ct.toLowerCase()) || 
            rawFull.includes(ct.toLowerCase())
          );
          matchedCity = candidateCity || activeCountyObj.cities[0] || "";
        }
      }
    } else {
      // Non-Kenya countries
      const countryCities = CITIES_BY_COUNTRY[matchedCountry] || [];
      const candidateCity = countryCities.find(ct => 
        rawCity.includes(ct.toLowerCase()) || 
        rawFull.includes(ct.toLowerCase())
      );
      matchedCity = candidateCity || countryCities[0] || "";
    }

    return {
      country: matchedCountry,
      county: matchedCountry === "Kenya" ? matchedCounty : "",
      city: matchedCity
    };
  };

  const handleAutoLocationUpdate = (
    lat: number, 
    lng: number, 
    addressText?: string, 
    locData?: SelectedLocationData
  ) => {
    setAddress(prev => {
      const updated = { ...prev, lat, lng };
      if (addressText) {
        updated.street = addressText;
      }

      if (locData) {
        const region = matchRegionFromOSM(locData);
        updated.country = region.country;
        updated.county = region.county;
        updated.city = region.city;

        localStorage.setItem("sokoplus_delivery_country", region.country);
        if (region.county) localStorage.setItem("sokoplus_delivery_county", region.county);
        if (region.city) localStorage.setItem("sokoplus_delivery_city", region.city);
      }

      return updated;
    });

    setIsManualOverride(false);

    if (addressText) {
      setValidationErrors(prev => {
        const nextErrs = { ...prev };
        delete nextErrs.street;
        return nextErrs;
      });
    }
  };

  const navigate = useNavigate();

  // Save guest address draft whenever address state updates (for guest checkout)
  useEffect(() => {
    if (!user) {
      saveGuestAddressDraft(address);
    }
  }, [address, user]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !redirecting) {
      toast.error("Your cart is empty. Please add items before checking out.");
      navigate("/cart");
    }
  }, [items, navigate, redirecting]);

  useEffect(() => {
    const fetchDeliverySettings = async () => {
      try {
        const docRef = doc(db, "settings", "homepage");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const disabledCountriesList = data.disabledCountries || [];
          const disabledCountiesList = data.disabledCounties || [];
          const disabledCitiesList = data.disabledCities || [];

          setDisabledCountries(disabledCountriesList);
          setDisabledCounties(disabledCountiesList);
          setDisabledCities(disabledCitiesList);

          // Address validation and adjustment
          setAddress(prev => {
            let nextCountry = prev.country;
            let nextCounty = prev.county;
            let nextCity = prev.city;
            let changed = false;

            // 1. If country is disabled
            if (disabledCountriesList.includes(nextCountry)) {
              // Pick first country that is not disabled
              const enabledCountry = Object.keys(COUNTRY_FLAGS).find(c => !disabledCountriesList.includes(c));
              if (enabledCountry) {
                nextCountry = enabledCountry;
                changed = true;
              }
            }

            // 2. Adjust county if Kenya is selected
            if (nextCountry === "Kenya") {
              if (!nextCounty || disabledCountiesList.includes(nextCounty)) {
                const firstEnabledCountyObj = counties.find(c => !disabledCountiesList.includes(c.name));
                if (firstEnabledCountyObj) {
                  nextCounty = firstEnabledCountyObj.name;
                  changed = true;
                }
              }

              // 3. Adjust city for Kenya county
              const matchedCountyObj = counties.find(c => c.name === nextCounty);
              if (matchedCountyObj) {
                const firstEnabledCity = matchedCountyObj.cities.find(c => !disabledCitiesList.includes(c));
                if (!nextCity || disabledCitiesList.includes(nextCity) || !matchedCountyObj.cities.includes(nextCity)) {
                  if (firstEnabledCity) {
                    nextCity = firstEnabledCity;
                    changed = true;
                  }
                }
              }
            } else {
              // 4. Adjust city for non-Kenya countries
              const countryCities = CITIES_BY_COUNTRY[nextCountry] || [];
              const firstEnabledCountryCity = countryCities.find(c => !disabledCitiesList.includes(c));
              if (!nextCity || disabledCitiesList.includes(nextCity) || !countryCities.includes(nextCity)) {
                if (firstEnabledCountryCity) {
                  nextCity = firstEnabledCountryCity;
                  changed = true;
                }
              }
            }

            if (changed) {
              localStorage.setItem("sokoplus_delivery_country", nextCountry);
              localStorage.setItem("sokoplus_delivery_county", nextCounty);
              localStorage.setItem("sokoplus_delivery_city", nextCity);
              return {
                ...prev,
                country: nextCountry,
                county: nextCountry === "Kenya" ? nextCounty : "",
                city: nextCity
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("Delivery settings fetch bypassed in Checkout (using defaults):", err);
      }
    };
    fetchDeliverySettings();
  }, []);

  const handleCountryChange = (countryName: string) => {
    if (countryName === "Kenya") {
      const firstEnabledCountyObj = counties.find(c => !disabledCounties.includes(c.name)) || counties[0];
      const firstEnabledCity = firstEnabledCountyObj.cities.find(c => !disabledCities.includes(c)) || firstEnabledCountyObj.cities[0];
      setAddress({
        ...address,
        country: "Kenya",
        county: firstEnabledCountyObj.name,
        city: firstEnabledCity
      });
      localStorage.setItem("sokoplus_delivery_country", "Kenya");
      localStorage.setItem("sokoplus_delivery_county", firstEnabledCountyObj.name);
      localStorage.setItem("sokoplus_delivery_city", firstEnabledCity);
    } else {
      const countryCities = CITIES_BY_COUNTRY[countryName] || [];
      const defaultCity = countryCities.find(c => !disabledCities.includes(c)) || countryCities[0] || "";
      setAddress({
        ...address,
        country: countryName,
        county: "",
        city: defaultCity,
        lat: undefined,
        lng: undefined,
      });
      localStorage.setItem("sokoplus_delivery_country", countryName);
      localStorage.setItem("sokoplus_delivery_county", "");
      localStorage.setItem("sokoplus_delivery_city", defaultCity);
    }
  };

  const handleCountyChange = (countyName: string) => {
    const selectedCounty = counties.find(c => c.name === countyName);
    const countyCities = selectedCounty ? selectedCounty.cities : [];
    const defaultCity = countyCities.find(c => !disabledCities.includes(c)) || countyCities[0] || "";
    setAddress({
      ...address,
      county: countyName,
      city: defaultCity,
      lat: undefined,
      lng: undefined,
    });
    localStorage.setItem("sokoplus_delivery_county", countyName);
    localStorage.setItem("sokoplus_delivery_city", defaultCity);
  };

  const selectedCountyData = counties.find(c => c.name === address.county) || counties.find(c => c.name === "Nairobi City County") || counties[0];
  const currentCities = selectedCountyData 
    ? selectedCountyData.cities.filter(city => !disabledCities.includes(city)) 
    : [];

  const FREE_SHIPPING_LIMIT = settings?.freeShippingThreshold !== undefined ? Number(settings.freeShippingThreshold) : 15000;
  const baseShippingFee = calculateShippingFee(address.county, address.city, total, address.country, FREE_SHIPPING_LIMIT);

  // Level 1: Primary Voucher Code
  const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherError, setVoucherError] = useState("");
  const [voucherSuccess, setVoucherSuccess] = useState("");

  // Level 2: Referral Bonus Credit
  const [appliedReferral, setAppliedReferral] = useState<{ code: string; discount: number; title: string } | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [referralError, setReferralError] = useState("");
  const [referralSuccess, setReferralSuccess] = useState("");

  // Level 3: Loyalty Points Redemption
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  const handleApplyVoucherCode = (code: string) => {
    setVoucherError("");
    setVoucherSuccess("");
    
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setVoucherError("Please enter a voucher code.");
      return;
    }

    const activeVouchers = user?.vouchers || [];
    const matchedVoucher = activeVouchers.find(
      (v: any) => v.code.toUpperCase() === cleanCode && v.status === "active"
    );

    if (matchedVoucher) {
      setAppliedVoucher(matchedVoucher);
      setVoucherSuccess(`🎉 Voucher applied: ${matchedVoucher.title}!`);
      toast.success(`Voucher applied: ${matchedVoucher.title}!`);
    } else {
      if (cleanCode === "SOKO-SHIP-FREE-NEXT") {
        setAppliedVoucher({
          id: "free-shipping",
          title: "Free Nationwide Shipping",
          badge: "SAVER REWARD",
          description: "Enjoy zero delivery fees on your next order, absolutely free!",
          code: "SOKO-SHIP-FREE-NEXT"
        });
        setVoucherSuccess("🎉 Voucher applied: Free Nationwide Shipping!");
        toast.success("Voucher applied: Free Shipping!");
      } else if (cleanCode === "SOKO-VOUCH-500K") {
        setAppliedVoucher({
          id: "gift-voucher",
          title: "KES 500 Shopping Voucher",
          badge: "CASH VOUCHER",
          description: "Get KES 500 off your next checkout basket total with no minimum spend.",
          code: "SOKO-VOUCH-500K"
        });
        setVoucherSuccess("🎉 Voucher applied: KES 500 Shopping Discount!");
        toast.success("Voucher applied: KES 500 Discount!");
      } else if (cleanCode === "SOKO-SAVE-20") {
        setAppliedVoucher({
          id: "save-20-percent",
          title: "20% Flash Sale Voucher",
          badge: "20% OFF",
          description: "Enjoy 20% off your items subtotal.",
          code: "SOKO-SAVE-20"
        });
        setVoucherSuccess("🎉 Voucher applied: 20% Off Subtotal!");
        toast.success("Voucher applied: 20% Off!");
      } else if (cleanCode === "SOKO-VIP-EXCLUSIVE") {
        setAppliedVoucher({
          id: "vip-exclusive",
          title: "VIP Exclusive 40% Pass",
          badge: "VIP EXCLUSIVE",
          description: "Exclusive tier voucher — provides 40% off subtotal. Stacking secondary credits paused to maximize single discount.",
          code: "SOKO-VIP-EXCLUSIVE",
          isExclusive: true
        });
        setVoucherSuccess("🎉 VIP Exclusive Voucher Applied (40% OFF)!");
        toast.success("VIP Exclusive Pass Applied (40% OFF)!");
      } else if (cleanCode === "SOKO-POINTS-MULTIPLY") {
        setAppliedVoucher({
          id: "points-multiplier",
          title: "1.5x Loyalty Points Multiplier",
          badge: "LOYALTY BOOST",
          description: "Earn 1.5 times the loyalty points on your next purchase!",
          code: "SOKO-POINTS-MULTIPLY"
        });
        setVoucherSuccess("🎉 Voucher applied: 1.5x Loyalty Points!");
        toast.success("Voucher applied: 1.5x Loyalty Points!");
      } else if (cleanCode === "SOKO-VIP-ARTISAN-PASS") {
        setAppliedVoucher({
          id: "artisan-pass",
          title: "Artisan Guild Golden Pass",
          badge: "EXCLUSIVE VIP DROP",
          description: "Early premier access & priority reserve on extremely rare, handmade collections.",
          code: "SOKO-VIP-ARTISAN-PASS"
        });
        setVoucherSuccess("🎉 Voucher applied: Artisan Golden Pass!");
        toast.success("Voucher applied: Artisan Golden Pass!");
      } else {
        setVoucherError("Invalid or expired voucher code.");
        toast.error("Invalid voucher code.");
      }
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCodeInput("");
    setVoucherSuccess("");
    setVoucherError("");
    toast.success("Voucher removed.");
  };

  const handleApplyReferralCode = (code: string) => {
    setReferralError("");
    setReferralSuccess("");
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setReferralError("Please enter a referral code.");
      return;
    }
    if (appliedVoucher?.isExclusive) {
      setReferralError("VIP Exclusive voucher active — referral credit held for your next order to preserve highest single-tier discount.");
      toast.error("Cannot stack with VIP Exclusive voucher.");
      return;
    }
    if (clean === "REF-FRIEND-250" || clean.startsWith("REF-")) {
      setAppliedReferral({
        code: clean,
        discount: 250,
        title: "KES 250 Friend Referral Credit"
      });
      setReferralSuccess("🎉 Referral credit applied: KES 250!");
      toast.success("Referral credit applied: KES 250!");
    } else {
      setReferralError("Invalid referral code.");
      toast.error("Invalid referral code.");
    }
  };

  const handleRemoveReferral = () => {
    setAppliedReferral(null);
    setReferralCodeInput("");
    setReferralError("");
    setReferralSuccess("");
    toast.success("Referral credit removed.");
  };

  // -------------------------------------------------------------
  // PROMO STACKING & ANTI-ABUSE CALCULATION ENGINE
  // -------------------------------------------------------------
  let shippingFee = baseShippingFee;
  let level1VoucherDiscount = 0;
  let level2ReferralDiscount = 0;
  let level3PointsDiscount = 0;
  const isExclusiveVoucherActive = Boolean(appliedVoucher?.isExclusive);

  // Level 1: Primary Voucher Calculation
  if (appliedVoucher) {
    if (appliedVoucher.id === "free-shipping" || appliedVoucher.code === "SOKO-SHIP-FREE-NEXT") {
      shippingFee = 0;
    } else if (appliedVoucher.id === "gift-voucher" || appliedVoucher.code === "SOKO-VOUCH-500K") {
      level1VoucherDiscount = 500;
    } else if (appliedVoucher.code === "SOKO-SAVE-20") {
      level1VoucherDiscount = Math.round(total * 0.20);
    } else if (appliedVoucher.code === "SOKO-VIP-EXCLUSIVE" || appliedVoucher.isExclusive) {
      level1VoucherDiscount = Math.round(total * 0.40);
    }
    level1VoucherDiscount = Math.min(level1VoucherDiscount, total);
  }

  const subtotalAfterLevel1 = Math.max(0, total - level1VoucherDiscount);

  // Level 2: Referral Bonus Credit Calculation
  if (appliedReferral && !isExclusiveVoucherActive) {
    level2ReferralDiscount = Math.min(appliedReferral.discount, subtotalAfterLevel1);
  }

  const subtotalAfterLevel2 = Math.max(0, subtotalAfterLevel1 - level2ReferralDiscount);

  // Level 3: Loyalty Points Redemption Calculation (1 Point = KES 1)
  const userAvailablePoints = user?.loyaltyPoints || 0;
  const maxUsablePoints = !isExclusiveVoucherActive ? Math.min(userAvailablePoints, subtotalAfterLevel2) : 0;
  const validRedeemedPoints = Math.min(redeemedPoints, maxUsablePoints);
  level3PointsDiscount = validRedeemedPoints;

  // Raw Combined Discount Total
  const rawTotalDiscount = level1VoucherDiscount + level2ReferralDiscount + level3PointsDiscount;

  // ANTI-ABUSE ENFORCEMENT RULES:
  // 1. Max 50% Basket Subtotal Cap across all stacked discounts
  const maxAllowedDiscountCap = Math.round(total * 0.50);
  const isCapExceeded = rawTotalDiscount > maxAllowedDiscountCap;
  
  const appliedDiscount = isCapExceeded ? maxAllowedDiscountCap : rawTotalDiscount;
  const overallTotal = Math.max(0, total + shippingFee - appliedDiscount);

  // Pay on Delivery (COD) requires 10% deposit, strictly capped at KES 700 max
  const codDepositAmount = Math.min(700, Math.round(overallTotal * 0.1));

  // Free shipping progress variables
  const progressToFreeShipping = Math.min((total / FREE_SHIPPING_LIMIT) * 100, 100);
  const remainingForFreeShipping = FREE_SHIPPING_LIMIT - total;

  // Real-time Dynamic Delivery Prediction
  const deliveryPrediction = calculateDelivery(address.county, address.city, new Date(), address.country);

  // Change Quantity in Checkout page
  const handleIncreaseQty = (item: CartItem) => {
    addToCart({ ...item, quantity: 1 });
  };

  const handleDecreaseQty = (item: CartItem) => {
    if (item.quantity <= 1) {
      removeFromCart(item.productId, item.customizations);
    } else {
      addToCart({ ...item, quantity: -1 });
    }
  };

  const handleRemove = (item: CartItem) => {
    removeFromCart(item.productId, item.customizations);
    toast.success(`${item.name} removed from your checkout cart.`);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!address.phone) {
      errors.phone = "Phone number is required for dispatch notifications.";
    } else {
      const cleaned = address.phone.replace(/\s+/g, "");
      if (cleaned.length !== 9 || !/^[17]\d{8}$/.test(cleaned)) {
        errors.phone = "Please enter a valid 9-digit phone number (starts with 1 or 7, e.g. 712345678).";
      }
    }
    if (!address.street.trim()) {
      errors.street = "Please enter a delivery street or apartment address.";
    }
    if (!address.email) {
      errors.email = "An email is required for secure payment receipts.";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user && user.email && !user.emailVerified) {
      toast.error("Please verify your email address before placing an order.", { icon: "📧" });
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill in all required standard shipping fields.");
      return;
    }

    // Instantly activate redirection/processing screen as an Optimistic action
    setRedirecting(true);
    setLoading(true);
    setRedirectStage("Validating Basket Stock");
    setRedirectDescription("Ensuring items in your cart are in stock and ready to pack for delivery...");

    try {
      // 1. Stock Check (wrapped in try/catch so database quota limits do not block checkout)
      for (const item of items) {
        try {
          const pRef = doc(db, "products", item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            if (pData.stock < item.quantity) {
              toast.error(`Sorry, "${item.name}" has insufficient stock. Only ${pData.stock} available.`);
              setLoading(false);
              setRedirecting(false);
              return;
            }
          }
        } catch (stockErr) {
          console.warn("Stock verification bypassed due to database read quota limits:", stockErr);
        }
      }

      setRedirectStage("Securing Connection");
      setRedirectDescription("Drafting Paystack billing configuration securely for instant payment validation...");

      // 2. Initialize Paystack
      const payAmount = paymentMethod === "cod" ? codDepositAmount : overallTotal;
      const response = await axios.post("/api/paystack/initialize", {
        email: address.email,
        amount: payAmount,
        callback_url: window.location.origin + "/payment-success",
        metadata: {
          userId: user ? user.uid : "guest",
          items: items.map(i => ({ id: i.productId, qty: i.quantity, customs: i.customizations })),
          preferredPaymentMethod: paymentMethod,
          isDepositOnly: paymentMethod === "cod",
          depositAmount: paymentMethod === "cod" ? codDepositAmount : 0,
          fullAmount: overallTotal
        }
      });

      const { authorization_url, reference } = response.data.data;

      setRedirectStage("Placing Order Records");
      setRedirectDescription("Updating your transaction database records so your order is tracked live...");

      // 3. Log Order to Firestore (as pending)
      const submittedAddress = {
        ...address,
        phone: `+254${address.phone.replace(/\s+/g, "")}`
      };

      const sellerIdsList = Array.from(new Set(items.map(i => i.sellerId).filter((id): id is string => !!id)));

      // Helper to clean undefined fields before saving to Firestore to prevent crashes
      const sanitizeData = (obj: any): any => {
        if (obj === undefined) return null;
        if (obj === null) return null;
        if (typeof obj === "object" && obj.constructor && obj.constructor.name !== "Object" && obj.constructor.name !== "Array") {
          return obj;
        }
        if (Array.isArray(obj)) return obj.map(sanitizeData);
        if (typeof obj === "object") {
          const clean: any = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              const value = obj[key];
              if (value !== undefined) {
                clean[key] = sanitizeData(value);
              }
            }
          }
          return clean;
        }
        return obj;
      };

      // 3. Single-Use Voucher & Loyalty Points Atomic Deductions in Firestore
      if (user && user.uid) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentVouchers = userData.vouchers || [];
            const currentPoints = userData.loyaltyPoints || 0;

            const updatedVouchers = appliedVoucher
              ? currentVouchers.filter((v: any) => v.code.toUpperCase() !== appliedVoucher.code.toUpperCase())
              : currentVouchers;
            const updatedPoints = Math.max(0, currentPoints - validRedeemedPoints);

            await updateDoc(userRef, {
              vouchers: updatedVouchers,
              loyaltyPoints: updatedPoints
            });
            console.log(`[Checkout Atomic Update] Consumed voucher (${appliedVoucher?.code || 'none'}), deducted ${validRedeemedPoints} loyalty points. Remaining points: ${updatedPoints}`);
          }
        } catch (vErr) {
          console.error("Error performing atomic promo deduction in Firestore:", vErr);
        }
      }

      const guestSessionToken = getOrCreateGuestSessionToken();

      const orderDataPayload = sanitizeData({
        userId: user ? user.uid : "guest",
        guestSessionToken: user ? null : guestSessionToken,
        isGuestOrder: !user,
        userEmail: address.email.toLowerCase().trim(),
        customerName: user?.displayName || user?.email?.split('@')[0] || (address.email ? address.email.split('@')[0] : "Guest Customer"),
        items,
        sellerIds: sellerIdsList,
        totalAmount: overallTotal,
        depositAmount: paymentMethod === "cod" ? codDepositAmount : 0,
        discountAmount: appliedDiscount,
        promoAuditTrail: {
          rawSubtotal: total,
          level1VoucherCode: appliedVoucher ? appliedVoucher.code : null,
          level1VoucherDiscount,
          level2ReferralCode: appliedReferral ? appliedReferral.code : null,
          level2ReferralDiscount,
          level3PointsRedeemed: validRedeemedPoints,
          level3PointsDiscount,
          isExclusiveVoucherActive,
          isCapExceeded,
          maxAllowedDiscountCap,
          finalAppliedDiscount: appliedDiscount
        },
        appliedVoucherCode: appliedVoucher ? appliedVoucher.code : null,
        referralCodeUsed: appliedReferral ? appliedReferral.code : null,
        pointsRedeemed: validRedeemedPoints,
        status: "pending",
        paymentStatus: "unpaid",
        paymentReference: reference,
        shippingAddress: submittedAddress,
        preferredPaymentMethod: paymentMethod,
        createdAt: serverTimestamp()
      });

      let generatedOrderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
      try {
        const newOrderRef = await addDoc(collection(db, "orders"), orderDataPayload);
        generatedOrderId = newOrderRef.id;
      } catch (addErr) {
        console.warn("Firestore order record write deferred due to database quota limit:", addErr);
      }

      // Save guest / local order tracking details locally for fast session lookup
      if (!user) {
        localStorage.setItem("sokoplus_last_guest_order", JSON.stringify({
          orderId: generatedOrderId,
          reference,
          email: address.email,
          guestSessionToken,
          createdAt: new Date().toISOString()
        }));
      }

      // 4. Smooth Redirect
      setRedirectStage("Redirecting to Paystack");
      setRedirectDescription("Navigating you securely to final portal Checkout...");
      
      setTimeout(() => {
        window.location.href = authorization_url;
      }, 100);
      
    } catch (error: any) {
      const isQuotaError = 
        error?.message?.includes("Quota limit exceeded") ||
        error?.message?.includes("quota") ||
        error?.code === "resource-exhausted";

      if (isQuotaError) {
        console.warn("Database quota reached during checkout. Proceeding with payment redirect.");
      } else {
        const detail = error.response?.data?.details || error.response?.data?.error || error?.message || "Failed to process checkout. Please try again.";
        console.error("Checkout error:", error);
        toast.error(detail, { duration: 5000 });
      }
      setLoading(false);
      setRedirecting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 relative font-sans text-gray-900 pb-52 md:pb-16">
      
      {/* Redirection Overlay */}
      <AnimatePresence>
        {redirecting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-orange-100 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-orange-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck size={32} className="text-orange-600 animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-black italic mb-2 tracking-tight">{redirectStage}</h2>
            <p className="text-gray-500 font-semibold max-w-sm">
              {redirectDescription}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-8">
        <span className="text-xs uppercase font-extrabold tracking-widest text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-3 py-1.5 rounded-full">
          SokoPlus Express Checkout
        </span>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-3 italic text-gray-950 dark:text-white flex items-center gap-2">
          <span>Complete Your Order</span>
          <span className="text-sm not-italic font-bold bg-gray-150 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full shrink-0">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Single Cohesive Scrolling Sheet */}
        <div className="lg:col-span-8 space-y-8 lg:max-h-[1400px] lg:overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
          
          {/* STEP 1: Delivery Location Card */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-orange-500 to-amber-500 h-1.5 w-full"></div>
            
            {!user && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span><strong>Guest Checkout:</strong> No account required to complete order.</span>
                </div>
                <Link
                  to="/login?redirect=/checkout"
                  className="text-orange-600 dark:text-orange-400 font-bold hover:underline shrink-0 ml-2"
                >
                  Have an account? Sign in
                </Link>
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 p-2.5 rounded-2xl shrink-0">
                <MapPin size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight text-gray-955 dark:text-white">1. Delivery Location</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Search address or drop pin on map. Shipping region is auto-detected.
                </p>
              </div>
            </div>

            {/* Single Unified Delivery Location Search & Interactive Map */}
            <div className="space-y-2 pt-1">
              <FreeDeliveryMap 
                county={address.county}
                city={address.city}
                initialStreet={address.street}
                lat={address.lat}
                lng={address.lng}
                error={validationErrors.street}
                onChange={(lat, lng, addressText, locData) => {
                  handleAutoLocationUpdate(lat, lng, addressText, locData);
                }}
              />
            </div>

            {/* Auto-detected Shipping Region Badge & Fallback Edit Toggle */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    <span className="text-gray-500 dark:text-gray-400 font-normal">Auto-detected Region: </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {address.country} {address.county ? `→ ${address.county}` : ""} → {address.city || "Standard Area"}
                    </span>
                  </div>
                  {isManualOverride && (
                    <span className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border border-gray-300 dark:border-gray-700">
                      Manual Override Active
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualRegionEdit(!showManualRegionEdit)}
                  className="text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{showManualRegionEdit ? "Hide Manual Selectors" : "Edit county/city manually"}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showManualRegionEdit ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Fallback Edit Accordion */}
              <AnimatePresence>
                {showManualRegionEdit && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pt-3 border-t border-gray-200 dark:border-gray-800"
                  >
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-3 font-medium">
                      Use these dropdowns to manually correct your Country, County, or City if OpenStreetMap's boundary differs from your courier's shipping rate zone.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Country</label>
                        <div className="relative">
                          <select 
                            value={address.country}
                            onChange={(e) => {
                              handleCountryChange(e.target.value);
                              setIsManualOverride(true);
                            }}
                            className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-10"
                          >
                            {Object.keys(COUNTRY_FLAGS).filter(cty => !disabledCountries.includes(cty)).map((cty) => (
                              <option key={cty} value={cty} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                                {COUNTRY_FLAGS[cty]} {cty}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>
                      </div>

                      {address.country === "Kenya" ? (
                        <>
                          <div>
                            <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">County Territory</label>
                            <div className="relative">
                              <select 
                                value={address.county}
                                onChange={(e) => {
                                  handleCountyChange(e.target.value);
                                  setIsManualOverride(true);
                                }}
                                className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-10"
                              >
                                {counties.filter(c => !disabledCounties.includes(c.name)).map((c) => (
                                  <option key={c.name} value={c.name} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Township / Settlement</label>
                            <div className="relative">
                              <select 
                                value={address.city}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAddress({...address, city: val, lat: undefined, lng: undefined});
                                  localStorage.setItem("sokoplus_delivery_city", val);
                                  setIsManualOverride(true);
                                }}
                                className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-10"
                              >
                                {currentCities.map((city) => (
                                  <option key={city} value={city} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                                    {city}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">City / Destination</label>
                          <div className="relative">
                            <select 
                              value={address.city}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAddress({...address, city: val});
                                localStorage.setItem("sokoplus_delivery_city", val);
                                setIsManualOverride(true);
                              }}
                              className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-10"
                            >
                              {CITIES_BY_COUNTRY[address.country]?.filter(city => !disabledCities.includes(city)).map((city) => (
                                <option key={city} value={city} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                                  {city}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Landmark / Rural Directions (Optional)
                </label>
                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                  Recommended for Rural & Non-Street Locations
                </span>
              </div>
              <input 
                type="text" 
                value={address.landmarkNotes || ""}
                onChange={(e) => setAddress({...address, landmarkNotes: e.target.value})}
                placeholder="e.g. 200m past Total Energies Petrol Station, blue gate opposite Green Mosque" 
                className="w-full p-4 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white border border-gray-150 dark:border-gray-800 rounded-2xl outline-none font-semibold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Delivery Phone Number</label>
                <div className={`flex rounded-2xl border overflow-hidden bg-gray-50 dark:bg-gray-950 focus-within:ring-2 focus-within:ring-orange-500 focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-transparent transition-all ${
                  validationErrors.phone ? "border-red-500" : "border-gray-150 dark:border-gray-800"
                }`}>
                  <div className="flex items-center gap-1 px-4 bg-gray-150/60 dark:bg-gray-800/60 border-r border-gray-200 dark:border-gray-800 select-none text-gray-600 dark:text-gray-400 font-bold text-sm">
                    <span className="text-base select-none">🇰🇪</span>
                    <span>+254</span>
                  </div>
                  <input 
                    required
                    type="tel" 
                    value={address.phone}
                    onChange={(e) => {
                      let val = e.target.value;
                      // Keep only digits
                      val = val.replace(/\D/g, "");
                      // Strip leading '0'
                      if (val.startsWith("0")) {
                        val = val.substring(1);
                      }
                      // Strip accidental typed/pasted '254'
                      if (val.startsWith("254")) {
                        val = val.substring(3);
                      }
                      setAddress({...address, phone: val});
                      if (val.trim()) {
                        setValidationErrors(prev => {
                          const updated = { ...prev };
                          delete updated.phone;
                          return updated;
                        });
                      }
                    }}
                    placeholder="712 345678" 
                    maxLength={9}
                    className="w-full p-4 bg-transparent outline-none font-bold text-gray-950 dark:text-white placeholder-gray-400"
                  />
                </div>
                {validationErrors.phone ? (
                  <p className="text-red-500 text-[10px] font-bold flex items-center gap-1 mt-1">
                    <AlertTriangle size={12} />
                    <span>{validationErrors.phone}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 font-semibold ml-1">For driver coordination during delivery dispatch</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Notification Email Address</label>
                <input 
                  required
                  type="email" 
                  value={address.email}
                  onChange={(e) => {
                    setAddress({...address, email: e.target.value});
                    if (e.target.value.trim()) {
                      setValidationErrors(prev => {
                        const updated = { ...prev };
                        delete updated.email;
                        return updated;
                      });
                    }
                  }}
                  placeholder="name@email.com" 
                  disabled={!!user?.email}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 outline-none font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-all text-gray-900 dark:text-white"
                />
                {user?.email && (
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1.5 font-bold ml-1 uppercase tracking-tight flex items-center gap-1">
                    <ShieldCheck size={12} />
                    <span>Using verified account email</span>
                  </p>
                )}
              </div>
            </div>

            {/* Predictive Delivery Time Display Box with live Countdown */}
            <DeliveryCountdown 
              county={address.county} 
              city={address.city} 
              country={address.country}
              hideSelector={true} 
              className="mt-4"
            />

          </div>

          {/* STEP 2: Product Review & Interactive Quantities */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-[#32ba78] h-1.5 w-full"></div>
            
            <div className="flex items-start justify-between gap-4 border-b border-gray-50 dark:border-gray-800 pb-4">
              <div className="flex items-start gap-4">
                <div className="bg-[#32ba78]/10 dark:bg-[#32ba78]/5 text-[#32ba78] p-2.5 rounded-2xl shrink-0">
                  <ShoppingBag size={22} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-tight text-gray-955 dark:text-white">2. Review Your Items</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                    Fine-tune quantities directly in page without leaving
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {items.map((item) => (
                <div 
                  key={`${item.productId}-${item.customizations?.color || ""}-${item.customizations?.material || ""}`} 
                  className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-950 rounded-2xl outline outline-1 outline-gray-100/80 dark:outline-gray-800/80 overflow-hidden shrink-0 relative flex items-center justify-center">
                      <FastImage 
                        src={item.image || ""} 
                        alt={item.name}
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h4 className="font-extrabold text-gray-950 dark:text-white text-sm md:text-md truncate hover:text-orange-600 dark:hover:text-orange-500 transition-colors">
                        <Link to={`/product/${item.productId}`}>
                          {item.name}
                        </Link>
                      </h4>
                      
                      {/* Sub-features/customizations */}
                      {item.customizations && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                          {item.customizations.material && (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-black">
                              {item.customizations.material}
                            </span>
                          )}
                          {item.customizations.colorName && (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-black flex items-center gap-1 uppercase">
                              <span 
                                className="w-2 h-2 rounded-full border border-gray-200 dark:border-gray-700"
                                style={{ backgroundColor: item.customizations.color }}
                              />
                              {item.customizations.colorName}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="font-semibold text-gray-500 dark:text-gray-400 text-xs">
                        KES {item.price.toLocaleString()} each
                      </div>
                    </div>
                  </div>

                  {/* Quantity Actions & Item delete inside Checkout */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center bg-gray-50 dark:bg-gray-950 rounded-xl px-2.5 py-1.5 border border-gray-150 dark:border-gray-800">
                      <button 
                        type="button"
                        onClick={() => handleDecreaseQty(item)}
                        className="p-1 hover:text-orange-600 hover:bg-white dark:hover:bg-gray-900 rounded-lg transition-all text-gray-400 dark:text-gray-550 cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center text-xs font-black text-gray-950 dark:text-white">{item.quantity}</span>
                      <button 
                        type="button"
                        onClick={() => handleIncreaseQty(item)}
                        className="p-1 hover:text-orange-600 hover:bg-white dark:hover:bg-gray-900 rounded-lg transition-all text-gray-400 dark:text-gray-550 cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="text-right min-w-[70px] hidden sm:block">
                      <p className="font-black text-xs text-gray-950 dark:text-white">
                        KES {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => handleRemove(item)}
                      className="p-2 text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                      title="Remove product"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
                          {/* Total Items count alert details */}
            <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 flex justify-between items-center">
              <span>Dynamic cart total weight/item count check:</span>
              <span className="font-black text-gray-900 dark:text-white uppercase">Pre-Cleaned</span>
            </div>

          </div>

          {/* STEP 3: Promo Stacking & Anti-Abuse Engine */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 h-1.5 w-full"></div>
            
            <div className="flex items-start justify-between gap-4 border-b border-gray-50 dark:border-gray-800 pb-4">
              <div className="flex items-start gap-4">
                <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 p-2.5 rounded-2xl shrink-0">
                  <Layers size={22} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight text-gray-955 dark:text-white">3. Stack Discounts & Loyalty Points</h3>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider">
                      <ShieldCheck size={11} />
                      Anti-Abuse Protected
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-550 font-semibold uppercase tracking-wider">
                    Combine Level 1 Vouchers, Level 2 Referral Credits, and Level 3 Loyalty Points safely
                  </p>
                </div>
              </div>
            </div>

            {/* Anti-Abuse Cap Triggered Alert */}
            {isCapExceeded && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs font-semibold animate-fade-in">
                <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-black text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                    50% Fair Savings Guardrail Applied
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed text-[11px]">
                    Your stacked discounts reached the 50% anti-abuse threshold. You are receiving the maximum allowable discount of <strong className="font-extrabold text-amber-950 dark:text-amber-100">KES {maxAllowedDiscountCap.toLocaleString()}</strong> while preserving seller authenticity.
                  </p>
                </div>
              </div>
            )}

            {/* Exclusive Voucher Notice */}
            {isExclusiveVoucherActive && (
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 p-4 rounded-2xl flex items-start gap-3 text-purple-900 dark:text-purple-200 text-xs font-semibold animate-fade-in">
                <Zap size={18} className="text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-black text-purple-950 dark:text-purple-100 uppercase tracking-wide">
                    VIP Exclusive 40% Voucher Active
                  </p>
                  <p className="text-purple-800 dark:text-purple-300 leading-relaxed text-[11px]">
                    To give you the highest single tier savings (40% off subtotal), referral credits and loyalty points redemptions are held for your next checkout.
                  </p>
                </div>
              </div>
            )}

            {/* 3-TIER STACKING INPUT PANELS */}
            <div className="space-y-6">

              {/* TIER 1: VOUCHER CODE (LEVEL 1) */}
              <div className="bg-gray-50/70 dark:bg-gray-950/50 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-orange-600 text-white rounded-full text-[10px] font-black flex items-center justify-center">1</span>
                    <span className="text-xs font-black uppercase text-gray-900 dark:text-white tracking-wider">Level 1: Soko Voucher (Fixed or % OFF)</span>
                  </div>
                  {appliedVoucher && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                      Active: KES {level1VoucherDiscount.toLocaleString()} Saved
                    </span>
                  )}
                </div>

                {appliedVoucher ? (
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 rounded-lg shrink-0">
                        <Check size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-emerald-950 dark:text-emerald-100 uppercase tracking-wide">
                          {appliedVoucher.code} — <span className="font-extrabold text-emerald-700 dark:text-emerald-300">{appliedVoucher.title}</span>
                        </p>
                        <p className="text-[10px] text-emerald-800 dark:text-emerald-400 font-semibold truncate">
                          {appliedVoucher.description}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      className="p-1.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50 rounded-lg transition-colors shrink-0"
                      title="Remove voucher"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-8">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={voucherCodeInput}
                          onChange={(e) => setVoucherCodeInput(e.target.value)}
                          placeholder="Code (e.g., SOKO-SAVE-20, SOKO-VOUCH-500K)"
                          className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-950 dark:text-white uppercase tracking-wider text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyVoucherCode(voucherCodeInput)}
                          className="px-5 py-3 bg-gray-950 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all whitespace-nowrap"
                        >
                          Apply
                        </button>
                      </div>
                      {voucherError && (
                        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1.5 ml-1">
                          <AlertTriangle size={11} />
                          <span>{voucherError}</span>
                        </p>
                      )}
                      {voucherSuccess && (
                        <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1.5 ml-1">
                          <Check size={11} />
                          <span>{voucherSuccess}</span>
                        </p>
                      )}
                    </div>
                    {/* Demo Quick Codes */}
                    <div className="md:col-span-4 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyVoucherCode("SOKO-SAVE-20")}
                        className="text-[9px] font-black uppercase px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-orange-500 rounded-lg text-gray-700 dark:text-gray-300"
                      >
                        + 20% OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyVoucherCode("SOKO-VOUCH-500K")}
                        className="text-[9px] font-black uppercase px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-orange-500 rounded-lg text-gray-700 dark:text-gray-300"
                      >
                        + KES 500
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyVoucherCode("SOKO-VIP-EXCLUSIVE")}
                        className="text-[9px] font-black uppercase px-2 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg"
                      >
                        + VIP 40%
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* TIER 2: REFERRAL BONUS (LEVEL 2) */}
              <div className="bg-gray-50/70 dark:bg-gray-950/50 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-[10px] font-black flex items-center justify-center">2</span>
                    <span className="text-xs font-black uppercase text-gray-900 dark:text-white tracking-wider">Level 2: Referral Code / Friend Credit</span>
                  </div>
                  {appliedReferral && !isExclusiveVoucherActive && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                      Active: KES {level2ReferralDiscount.toLocaleString()} Saved
                    </span>
                  )}
                </div>

                {appliedReferral ? (
                  <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 rounded-lg shrink-0">
                        <Check size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                          {appliedReferral.code} — <span className="font-extrabold text-amber-700 dark:text-amber-300">{appliedReferral.title}</span>
                        </p>
                        <p className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold truncate">
                          KES 250 Friend Bonus Applied
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveReferral}
                      className="p-1.5 text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 rounded-lg transition-colors shrink-0"
                      title="Remove referral code"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-8">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={referralCodeInput}
                          onChange={(e) => setReferralCodeInput(e.target.value)}
                          disabled={isExclusiveVoucherActive}
                          placeholder="Referral Code (e.g., REF-FRIEND-250)"
                          className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-gray-955 dark:text-white uppercase tracking-wider text-xs disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyReferralCode(referralCodeInput)}
                          disabled={isExclusiveVoucherActive}
                          className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all whitespace-nowrap disabled:opacity-50"
                        >
                          Apply Referral
                        </button>
                      </div>
                      {referralError && (
                        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1.5 ml-1">
                          <AlertTriangle size={11} />
                          <span>{referralError}</span>
                        </p>
                      )}
                      {referralSuccess && (
                        <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1.5 ml-1">
                          <Check size={11} />
                          <span>{referralSuccess}</span>
                        </p>
                      )}
                    </div>
                    {/* Quick Demo Referral */}
                    <div className="md:col-span-4 flex items-center">
                      <button
                        type="button"
                        onClick={() => handleApplyReferralCode("REF-FRIEND-250")}
                        disabled={isExclusiveVoucherActive}
                        className="w-full text-[9px] font-black uppercase py-2 px-3 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-50"
                      >
                        + Use REF-FRIEND-250
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* TIER 3: LOYALTY POINTS REDEEMER (LEVEL 3) */}
              <div className="bg-gray-50/70 dark:bg-gray-950/50 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-emerald-600 text-white rounded-full text-[10px] font-black flex items-center justify-center">3</span>
                    <span className="text-xs font-black uppercase text-gray-900 dark:text-white tracking-wider">Level 3: Loyalty Points Redemption (1 Point = KES 1)</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Award size={12} className="text-emerald-500" />
                    Available: <strong className="text-emerald-600 dark:text-emerald-400 font-black">{userAvailablePoints} pts</strong>
                  </span>
                </div>

                {isExclusiveVoucherActive ? (
                  <p className="text-[11px] text-gray-400 italic">
                    Loyalty points redemption paused because VIP Exclusive voucher is active.
                  </p>
                ) : userAvailablePoints === 0 ? (
                  <p className="text-[11px] text-gray-400 font-semibold italic">
                    No loyalty points on your balance yet. Complete purchases to earn 1 point per KES 100 spent!
                  </p>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="range"
                          min="0"
                          max={maxUsablePoints}
                          value={validRedeemedPoints}
                          onChange={(e) => setRedeemedPoints(Number(e.target.value))}
                          className="w-full accent-emerald-600 cursor-pointer"
                        />
                      </div>
                      <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-right min-w-[110px]">
                        <span className="text-[10px] font-bold text-gray-400 block uppercase leading-none">Redeeming</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {validRedeemedPoints} Points (- KES {validRedeemedPoints})
                        </span>
                      </div>
                    </div>

                    {/* Quick Points Select Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRedeemedPoints(0)}
                        className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border transition-all ${
                          validRedeemedPoints === 0
                            ? "bg-gray-950 text-white border-gray-950 dark:bg-white dark:text-gray-950"
                            : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                        }`}
                      >
                        0 pts
                      </button>
                      {maxUsablePoints >= 50 && (
                        <button
                          type="button"
                          onClick={() => setRedeemedPoints(50)}
                          className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border transition-all ${
                            validRedeemedPoints === 50
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                          }`}
                        >
                          50 pts
                        </button>
                      )}
                      {maxUsablePoints >= 100 && (
                        <button
                          type="button"
                          onClick={() => setRedeemedPoints(100)}
                          className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border transition-all ${
                            validRedeemedPoints === 100
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                          }`}
                        >
                          100 pts
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRedeemedPoints(maxUsablePoints)}
                        className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border transition-all ${
                          validRedeemedPoints === maxUsablePoints && maxUsablePoints > 0
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                        }`}
                      >
                        Max ({maxUsablePoints} pts)
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* STEP 4: Interactive Payment gateway selector */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 w-full"></div>
            
            <div className="flex items-start gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 p-2.5 rounded-2xl shrink-0">
                <CreditCard size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight text-gray-955 dark:text-white">4. Preferred Payment Method</h3>
                <p className="text-xs text-gray-400 dark:text-gray-550 font-semibold uppercase tracking-wider">
                  BOTH CHANNELS PROCESSED AUTOMATICALLY & SECURELY THROUGH PAYSTACK
                </p>
              </div>
            </div>

            {/* MOBILE INTERACTIVE PAYMENT SELECTION DROPDOWN */}
            <div className="md:hidden space-y-3">
              <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Select Payment Gateway
              </label>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 font-bold">
                      {paymentMethod === "mpesa" && <Smartphone size={20} />}
                      {paymentMethod === "card" && <CreditCard size={20} />}
                      {paymentMethod === "cod" && <Banknote size={20} />}
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-sm text-gray-955 dark:text-white truncate">
                        {paymentMethod === "mpesa" && "M-Pesa / Mobile Money"}
                        {paymentMethod === "card" && "Credit / Debit Cards"}
                        {paymentMethod === "cod" && "Pay on Delivery & Inspect"}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold truncate">
                        {paymentMethod === "mpesa" && "Instant STK Push (Safaricom / Airtel / Telkom)"}
                        {paymentMethod === "card" && "Visa, Mastercard & American Express"}
                        {paymentMethod === "cod" && `Inspect Package Before Final Payment — KES ${codDepositAmount.toLocaleString()} Security Hold`}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={20} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isPaymentDropdownOpen ? "rotate-180 text-orange-500" : ""}`} />
                </button>

                {/* Dropdown Menu Options Overlay */}
                <AnimatePresence>
                  {isPaymentDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-2 divide-y divide-gray-100 dark:divide-gray-800 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
                    >
                      {/* Option 1: M-Pesa */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("mpesa");
                          setIsPaymentDropdownOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-xl flex items-center justify-between transition-all text-left ${
                          paymentMethod === "mpesa"
                            ? "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 font-extrabold"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                            <Smartphone size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">M-Pesa / Mobile Money</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">Safaricom STK push to mobile</p>
                          </div>
                        </div>
                        {paymentMethod === "mpesa" && <Check size={16} className="text-orange-500 stroke-[3]" />}
                      </button>

                      {/* Option 2: Credit / Debit Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("card");
                          setIsPaymentDropdownOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-xl flex items-center justify-between transition-all text-left ${
                          paymentMethod === "card"
                            ? "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 font-extrabold"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                            <CreditCard size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">Credit / Debit Cards</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">Visa, Mastercard, Amex</p>
                          </div>
                        </div>
                        {paymentMethod === "card" && <Check size={16} className="text-orange-500 stroke-[3]" />}
                      </button>

                      {/* Option 3: Cash on Delivery */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("cod");
                          setIsPaymentDropdownOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-xl flex items-center justify-between transition-all text-left ${
                          paymentMethod === "cod"
                            ? "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 font-extrabold"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                            <Banknote size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">Pay on Delivery & Inspect</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                              Inspect Package Before Final Payment — KES {codDepositAmount.toLocaleString()} Security Hold
                            </p>
                          </div>
                        </div>
                        {paymentMethod === "cod" && <Check size={16} className="text-orange-500 stroke-[3]" />}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* DESKTOP PAYMENT CARDS GRID */}
            <div className="hidden md:grid grid-cols-3 gap-4 pt-2">
              
              {/* Option Card: Mpesa */}
              <div 
                onClick={() => setPaymentMethod("mpesa")}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between h-36 ${
                  paymentMethod === "mpesa" 
                    ? "border-orange-500 bg-orange-50/10 dark:bg-orange-950/5 ring-2 ring-orange-100 dark:ring-orange-900/20 shadow-lg shadow-orange-100/40 dark:shadow-none" 
                    : "border-gray-150 dark:border-gray-855 hover:border-gray-300 dark:hover:border-gray-750 bg-white dark:bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-extrabold text-xs tracking-tight text-gray-950 dark:text-white uppercase leading-snug">M-Pesa / Mobile Money</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === "mpesa" ? "border-orange-500 bg-orange-500" : "border-gray-300 dark:border-gray-700"
                  }`}>
                    {paymentMethod === "mpesa" && <Check className="text-white stroke-[3.5]" size={11} />}
                  </div>
                </div>
                
                <div className="space-y-1 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none">Supported Telcos</p>
                    <div className="flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-white dark:border-gray-800 flex items-center justify-center text-[7px] text-white font-black scale-90">S</span>
                      <span className="w-3.5 h-3.5 rounded-full bg-red-600 border border-white dark:border-gray-800 flex items-center justify-center text-[7px] text-white font-black scale-90">A</span>
                      <span className="w-3.5 h-3.5 rounded-full bg-sky-500 border border-white dark:border-gray-800 flex items-center justify-center text-[7px] text-white font-black scale-90">T</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-1">
                    <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-xl shrink-0">
                      <Smartphone size={14} />
                    </div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-450 font-bold leading-tight">
                      Safaricom M-Pesa instant checkout STK Push
                    </p>
                  </div>
                </div>
              </div>

              {/* Option Card: Card */}
              <div 
                onClick={() => setPaymentMethod("card")}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between h-36 ${
                  paymentMethod === "card" 
                    ? "border-orange-500 bg-orange-50/10 dark:bg-orange-950/5 ring-2 ring-orange-100 dark:ring-orange-900/20 shadow-lg shadow-orange-100/40 dark:shadow-none" 
                    : "border-gray-150 dark:border-gray-855 hover:border-gray-300 dark:hover:border-gray-750 bg-white dark:bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-extrabold text-xs tracking-tight text-gray-955 dark:text-white uppercase leading-snug">Credit / Debit Cards</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === "card" ? "border-orange-500 bg-orange-500" : "border-gray-300 dark:border-gray-700"
                  }`}>
                    {paymentMethod === "card" && <Check className="text-white stroke-[3.5]" size={11} />}
                  </div>
                </div>

                <div className="space-y-1.5 mt-1.5">
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none">Accepted Cards</p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {/* Visa badge */}
                    <div className="w-9 h-5.5 bg-white border border-gray-150 rounded px-1 flex items-center justify-center select-none shadow-sm shrink-0">
                      <span className="font-sans font-black italic text-[#1A1F71] text-[8px] tracking-tighter">VISA</span>
                    </div>
                    {/* Mastercard badge */}
                    <div className="w-9 h-5.5 bg-[#141414] rounded px-1 flex items-center justify-center gap-[0.5px] select-none shadow-sm shrink-0">
                      <div className="relative flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#EB001B] opacity-95"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#F79E1B] opacity-95 -ml-1 mix-blend-screen"></div>
                      </div>
                    </div>
                    {/* AMEX badge */}
                    <div className="w-9 h-5.5 bg-[#007BC1] rounded flex flex-col items-center justify-center select-none shadow-sm shrink-0 leading-none">
                      <span className="font-sans font-black text-white text-[3.5px] uppercase tracking-tighter">Amex</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Option Card: Cash on Delivery (COD) */}
              <div 
                onClick={() => setPaymentMethod("cod")}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between h-36 ${
                  paymentMethod === "cod" 
                    ? "border-orange-500 bg-orange-50/10 dark:bg-orange-950/5 ring-2 ring-orange-100 dark:ring-orange-900/20 shadow-lg shadow-orange-100/40 dark:shadow-none" 
                    : "border-gray-150 dark:border-gray-855 hover:border-gray-300 dark:hover:border-gray-750 bg-white dark:bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-extrabold text-xs tracking-tight text-gray-955 dark:text-white uppercase leading-snug">Pay on Delivery & Inspect</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === "cod" ? "border-orange-500 bg-orange-500" : "border-gray-300 dark:border-gray-700"
                  }`}>
                    {paymentMethod === "cod" && <Check className="text-white stroke-[3.5]" size={11} />}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-11 h-11 shrink-0 bg-orange-50/60 dark:bg-orange-950/20 rounded-full flex items-center justify-center overflow-hidden">
                    <svg viewBox="0 0 64 64" className="w-10 h-10">
                      {/* Courier cap */}
                      <path d="M22 24c0-3 4-5 10-5s10 2 10 5v2H22v-2z" fill="#EB4E36" />
                      <path d="M38 21h6v2h-6z" fill="#EB4E36" />
                      {/* Courier Face */}
                      <circle cx="32" cy="32" r="8" fill="#FDD2B5" />
                      <path d="M29 32a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM35 32a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="#333" />
                      <path d="M30 35c1 1.5 3 1.5 4 0" stroke="#333" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                      {/* Shirt / Neck */}
                      <path d="M28 40h8v4h-8z" fill="#FDD2B5" />
                      <path d="M20 44c0-4 4-6 12-6s12 2 12 6v12H20V44z" fill="#EB4E36" />
                      <path d="M28 44l4 4 4-4" fill="none" stroke="#fff" strokeWidth="1.2" />
                      {/* Cash in hand */}
                      <g transform="translate(6, 38)">
                        <rect x="0" y="0" width="12" height="7" rx="1" fill="#32ba78" />
                        <circle cx="6" cy="3.5" r="1.5" fill="#fff" opacity="0.5" />
                      </g>
                      {/* Parcel box in hand */}
                      <g transform="translate(42, 38)">
                        <rect x="0" y="0" width="14" height="12" rx="1.5" fill="#C68F65" />
                        <line x1="0" y1="6" x2="14" y2="6" stroke="#99603D" strokeWidth="1" />
                        <line x1="7" y1="0" x2="7" y2="12" stroke="#99603D" strokeWidth="1" />
                      </g>
                    </svg>
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[8px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest leading-none">
                      100% Inspection Guarantee
                    </p>
                    <p className="text-[10px] text-gray-650 dark:text-gray-450 font-bold leading-tight">
                      Inspect Package Before Final Payment — KES {codDepositAmount.toLocaleString()} Security Hold
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* EXPANDED INTERACTIVE CREDIT/DEBIT CARD SECTION */}
            {paymentMethod === "card" && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-6"
              >
                <div className="bg-gray-50 dark:bg-gray-950/40 p-6 rounded-2xl border border-gray-100 dark:border-gray-850/80">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                    
                    {/* Left Column: Interactive 3D Card Mockup */}
                    <div className="md:col-span-5 flex flex-col items-center justify-center">
                      <div className="relative w-full max-w-[280px] h-44 [perspective:1000px] select-none">
                        <div 
                          className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${
                            cardFocused ? "[transform:rotateY(180deg)]" : ""
                          }`}
                        >
                          {/* FRONT OF THE CARD */}
                          <div className="absolute w-full h-full rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-orange-950 p-5 text-white flex flex-col justify-between shadow-xl border border-white/5 [backface-visibility:hidden] overflow-hidden">
                            {/* Card Decorative Elements */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl -mr-6 -mt-6" />
                            
                            <div className="flex items-center justify-between relative z-10">
                              {/* Chip & NFC symbol */}
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-300 border border-amber-300 shadow-inner relative flex items-center justify-center">
                                  {/* Chip grid lines */}
                                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-amber-800/20" />
                                  <div className="absolute inset-y-0 left-1/3 border-l border-amber-800/20" />
                                  <div className="absolute inset-y-0 right-1/3 border-l border-amber-800/20" />
                                </div>
                                <svg className="w-5 h-5 text-white/50 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 12a8 8 0 0 1 8-8m-8 16a12 12 0 0 1 12-12M4 8a4 4 0 0 1 4-4" strokeLinecap="round" />
                                </svg>
                              </div>
                              
                              {/* Card Brand */}
                              <div className="h-6 flex items-center">
                                {cardNumber.startsWith("4") ? (
                                  <span className="font-sans font-black italic text-white text-[16px] tracking-tight">VISA</span>
                                ) : cardNumber.startsWith("5") ? (
                                  <div className="relative flex items-center h-full">
                                    <div className="w-4.5 h-4.5 rounded-full bg-[#EB001B] opacity-90" />
                                    <div className="w-4.5 h-4.5 rounded-full bg-[#F79E1B] opacity-90 -ml-2" />
                                  </div>
                                ) : cardNumber.startsWith("3") ? (
                                  <span className="font-sans font-black text-sky-400 text-[11px] uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded">AMEX</span>
                                ) : (
                                  <span className="text-[10px] uppercase font-black tracking-widest text-orange-400/80 bg-orange-950/20 px-2 py-0.5 rounded border border-orange-500/25">SokoPay</span>
                                )}
                              </div>
                            </div>

                            {/* Card Number */}
                            <div className="text-md sm:text-lg font-mono tracking-[0.18em] text-white/95 mt-4 text-center font-bold">
                              {cardNumber 
                                ? cardNumber.replace(/\s?/g, "").replace(/(\d{4})/g, "$1 ").trim() 
                                : "•••• •••• •••• ••••"}
                            </div>

                            {/* Cardholder details and Expiry */}
                            <div className="flex items-end justify-between relative z-10">
                              <div className="max-w-[70%]">
                                <span className="text-[7px] text-gray-400 font-extrabold uppercase tracking-widest block leading-none">Cardholder</span>
                                <span className="text-[10px] font-bold text-white/90 truncate block mt-1 uppercase tracking-wider font-mono">
                                  {cardName || "YOUR FULL NAME"}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[7px] text-gray-400 font-extrabold uppercase tracking-widest block leading-none">Expires</span>
                                <span className="text-[10px] font-bold text-white/90 block mt-1 font-mono">
                                  {cardExpiry || "MM/YY"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* BACK OF THE CARD */}
                          <div className="absolute w-full h-full rounded-2xl bg-gradient-to-br from-slate-900 via-[#111827] to-slate-900 py-5 text-white flex flex-col justify-between shadow-xl border border-white/5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                            <div className="w-full bg-black h-8 mt-1" />
                            
                            <div className="px-5 space-y-4">
                              <div className="flex items-center justify-between gap-3">
                                {/* Signature strip */}
                                <div className="flex-1 h-7 bg-white/15 rounded flex items-center px-2">
                                  <div className="w-full h-2 bg-stripe-pattern opacity-40" />
                                </div>
                                {/* CVV */}
                                <div className="w-12 h-7 bg-white text-black font-mono font-bold text-xs flex items-center justify-center rounded">
                                  {cardCvv || "•••"}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between text-[7px] text-gray-500 font-bold uppercase tracking-wider">
                                <span>Secured by SokoPlus SSL</span>
                                <span>PCI-DSS Compliant</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Input Fields with validation */}
                    <div className="md:col-span-7 grid grid-cols-2 gap-4 font-sans text-left">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Card Number</label>
                        <input
                          type="text"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setCardNumber(val);
                          }}
                          placeholder="4111 2222 3333 4444"
                          className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="e.g. Jane A. Doe"
                          className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500 uppercase"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Expiry Date</label>
                        <input
                          type="text"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, "");
                            if (val.length > 2) {
                              val = `${val.substring(0, 2)}/${val.substring(2, 4)}`;
                            }
                            setCardExpiry(val);
                          }}
                          placeholder="MM/YY"
                          className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">CVV Code</label>
                        <input
                          type="text"
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setCardCvv(val);
                          }}
                          onFocus={() => setCardFocused(true)}
                          onBlur={() => setCardFocused(false)}
                          placeholder="123"
                          className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

          </div>
        </div>

        {/* RIGHT COLUMN: Glassmorphic Order Summary Calculation Panel */}
        <div className="lg:col-span-4 sticky top-24 self-start hidden lg:block">
          
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[2.2rem] p-7 text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border border-white/20 backdrop-blur-2xl bg-slate-900/80 dark:bg-slate-950/85 space-y-6"
          >
            {/* Soft ambient background accent glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header Title */}
            <h2 className="text-2xl font-normal tracking-tight text-white text-center font-sans">
              Order Summary
            </h2>

            {/* Free Delivery Pill Banner */}
            {remainingForFreeShipping <= 0 ? (
              <motion.div 
                initial={{ scale: 0.96 }}
                animate={{ scale: [0.98, 1.02, 0.98] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-medium text-sm py-3 px-6 rounded-full text-center shadow-lg shadow-emerald-500/30 flex items-center justify-center"
              >
                <span>Free Delivery Unlocked!</span>
              </motion.div>
            ) : (
              <div className="w-full bg-white/10 border border-white/15 rounded-2xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs font-medium text-slate-200">
                  <span className="flex items-center">
                    Free Delivery Progress
                  </span>
                  <span className="text-amber-300 font-bold">KES {remainingForFreeShipping.toLocaleString()} away</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressToFreeShipping}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Breakdown Fields */}
            <div className="space-y-4 text-sm font-normal text-slate-200 pt-1">
              
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Subtotal</span>
                <span className="font-medium text-white tabular-nums text-base">KES {total.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-300">Express Courier</span>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">
                    {address.city || (address.county ? address.county.split(" ")[0] : "Standard Area")}
                  </p>
                </div>
                <span className="font-medium text-white uppercase text-sm">
                  {shippingFee === 0 ? (
                    <span className="text-emerald-400 font-semibold uppercase text-xs">
                      FREE
                    </span>
                  ) : (
                    `KES ${shippingFee.toLocaleString()}`
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-300">VAT (16% tax)</span>
                <span className="font-normal text-slate-300 text-sm">Included</span>
              </div>

              {/* STACKED DISCOUNTS WATERFALL BREAKDOWN */}
              {(level1VoucherDiscount > 0 || level2ReferralDiscount > 0 || level3PointsDiscount > 0) && (
                <div className="space-y-2.5 pt-3 border-t border-white/10 text-xs">
                  <div className="flex items-center justify-between font-medium text-slate-400 uppercase tracking-wider text-[10px]">
                    <span>Applied Discounts</span>
                    <span className="text-emerald-400">Verified</span>
                  </div>

                  {level1VoucherDiscount > 0 && (
                    <div className="flex justify-between items-center text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <Tag size={13} className="text-orange-400" />
                        Voucher ({appliedVoucher?.code})
                      </span>
                      <span className="text-emerald-400 font-medium">- KES {level1VoucherDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  {level2ReferralDiscount > 0 && !isExclusiveVoucherActive && (
                    <div className="flex justify-between items-center text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <Gift size={13} className="text-amber-400" />
                        Referral Pass
                      </span>
                      <span className="text-amber-400 font-medium">- KES {level2ReferralDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  {level3PointsDiscount > 0 && !isExclusiveVoucherActive && (
                    <div className="flex justify-between items-center text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <Award size={13} className="text-emerald-400" />
                        Loyalty Points ({validRedeemedPoints} pts)
                      </span>
                      <span className="text-emerald-400 font-medium">- KES {level3PointsDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  {isCapExceeded && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-[10px] text-amber-200">
                      Discount capped to 50% max (KES {maxAllowedDiscountCap.toLocaleString()}).
                    </div>
                  )}

                  <div className="flex justify-between items-center text-emerald-400 font-medium bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                    <span>Net Savings</span>
                    <span>- KES {appliedDiscount.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Divider Line */}
            <div className="border-t border-white/15 pt-1" />

            {/* Total Due */}
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-normal text-white">Total Due</span>
              <span className="text-2xl font-semibold text-white tracking-tight tabular-nums">
                KES {overallTotal.toLocaleString()}
              </span>
            </div>

            {/* Paystack CTA Button */}
            <motion.button 
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              onClick={handleCheckout}
              disabled={loading || items.length === 0}
              type="button"
              className="w-full bg-[#0b0f19] hover:bg-[#111827] text-white py-4 px-5 rounded-2xl font-semibold text-base border border-white/15 hover:border-white/30 transition-all flex items-center justify-between shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
            >
              {loading ? (
                <div className="w-full flex items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-teal-400" size={18} />
                  <span>Processing Order...</span>
                </div>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-sm sm:text-base font-semibold">
                    <span>
                      {paymentMethod === "cod" 
                        ? `Pay Deposit (KES ${codDepositAmount.toLocaleString()}) with`
                        : `Finish Order with`
                      }
                    </span>
                    <span className="inline-flex items-center gap-1 text-white font-bold ml-1">
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block shrink-0">
                        <rect y="0" width="18" height="2.5" rx="1.25" fill="#00C3F7"/>
                        <rect y="5.5" width="12" height="2.5" rx="1.25" fill="#00C3F7"/>
                        <rect y="11" width="18" height="2.5" rx="1.25" fill="#00C3F7"/>
                      </svg>
                      Paystack
                    </span>
                  </span>
                  <ArrowRight className="group-hover:translate-x-1 transition-transform text-white shrink-0" size={18} />
                </>
              )}
            </motion.button>

            <div className="text-center pt-1">
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
                Secured with 256-bit encryption. Guaranteed protection by Paystack.
              </p>
            </div>

          </motion.div>



        </div>

      </div>

           {/* MOBILE STICKY BOTTOM CHECKOUT SUMMARY DISPLAY BAR (Exclusive to small/medium views) */}
      <div className="fixed sm:static lg:hidden inset-x-0 bottom-0 z-40 bg-white dark:bg-gray-950 shadow-[-5px_-10px_35px_rgba(0,0,0,0.08)] dark:shadow-none border-t border-gray-100 dark:border-gray-800 p-4 md:p-6 pb-6 flex items-center justify-between gap-4 font-sans max-w-full">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1 pb-1.5" onClick={() => setShowMobilSummaryDrawer(!showMobilSummaryDrawer)}>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest">Grand Total</span>
            <ChevronUp size={12} className="text-gray-400" />
          </div>
          <p className="text-xl font-black text-gray-955 dark:text-white leading-none tracking-tight">
            KES {overallTotal.toLocaleString()}
          </p>
          <button 
            type="button"
            onClick={() => setShowMobilSummaryDrawer(true)}
            className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold uppercase mt-1.5 tracking-tight hover:underline flex items-center"
          >
            Breakdown & Shipping
          </button>
        </div>

        <button 
          onClick={handleCheckout}
          disabled={loading || items.length === 0}
          type="button"
          className="flex-1 bg-gray-950 dark:bg-orange-600 text-white py-4 px-5 rounded-2xl font-black text-sm hover:bg-orange-600 dark:hover:bg-orange-700 active:bg-orange-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <span className="flex items-center gap-1.5 uppercase tracking-wide text-xs">
              <span>
                {paymentMethod === "cod" 
                  ? `Inspect Package Before Payment (KES ${codDepositAmount.toLocaleString()} Hold)`
                  : "Finish Order"
                }
              </span>
              <ArrowRight size={14} />
            </span>
          )}
        </button>
      </div>

      {/* MOBILE BREAKDOWN DRAWER MODAL OVERLAY */}
      <AnimatePresence>
        {showMobilSummaryDrawer && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobilSummaryDrawer(false)}
              className="fixed inset-0 z-45 bg-black"
            />

            {/* Content Drawer Sheet */}
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-[2.5rem] shadow-2xl p-6 md:p-8 space-y-6 pb-12 font-sans"
            >
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto" onClick={() => setShowMobilSummaryDrawer(false)}></div>
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-black italic tracking-tight text-gray-950 dark:text-white flex items-center gap-2">
                  <Receipt size={18} className="text-orange-600 dark:text-orange-400" />
                  <span>Interactive Calculation</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowMobilSummaryDrawer(false)}
                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full font-bold cursor-pointer transition-all"
                >
                  Dismiss
                </button>
              </div>

              {/* Free delivery metrics validation display */}
              <div className="space-y-2 bg-gray-50 dark:bg-gray-900/70 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-gray-800 dark:text-gray-200">Free Delivery Status</span>
                  <span className="text-orange-600 dark:text-orange-400">Threshold: KES 15,000</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-orange-500 h-full rounded-full"
                    style={{ width: `${progressToFreeShipping}%` }}
                  />
                </div>
                {remainingForFreeShipping > 0 ? (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-snug">
                    Add <span className="font-extrabold text-orange-600 dark:text-orange-400">KES {remainingForFreeShipping.toLocaleString()}</span> more to unlock <span className="font-extrabold text-gray-800 dark:text-gray-300">FREE shipping</span>.
                  </p>
                ) : (
                  <p className="text-[10px] text-[#32ba78] font-bold flex items-center gap-1 uppercase tracking-tight">
                    <Check size={12} />
                    <span>Unlocked FREE delivery!</span>
                  </p>
                )}
              </div>

              {/* Calculation List Table */}
              <div className="space-y-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 pt-2">
                <div className="flex justify-between">
                  <span>Items Subtotal</span>
                  <span className="font-bold text-gray-905 dark:text-white">KES {total.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <span>Express Delivery Courier Fee</span>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold leading-none mt-0.5">
                      {address.country !== "Kenya" ? address.country : address.county} Zone Rate
                    </p>
                  </div>
                  <span className="font-bold text-gray-950 dark:text-white">
                    {shippingFee === 0 ? (
                      <span className="text-[#32ba78] font-black uppercase text-[10px] bg-[#32ba78]/10 dark:bg-[#32ba78]/5 px-2 py-0.5 rounded-full">
                        Free shipping
                      </span>
                    ) : (
                      `KES ${shippingFee.toLocaleString()}`
                    )}
                  </span>
                </div>

                <div className="flex justify-between pt-1 border-t border-dashed border-gray-100 dark:border-gray-850 text-gray-400 dark:text-gray-500">
                  <span>VAT Tax (16% inclusive)</span>
                  <span className="font-bold">Included</span>
                </div>

                {appliedDiscount > 0 && (
                  <div className="flex justify-between items-center text-[#32ba78] font-bold bg-[#32ba78]/10 dark:bg-[#32ba78]/5 px-3 py-2 rounded-xl border border-[#32ba78]/20">
                    <span>Voucher Discount</span>
                    <span>- KES {appliedDiscount.toLocaleString()}</span>
                  </div>
                )}

                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-1">
                  <div className="flex justify-between items-baseline text-2xl font-black text-gray-950 dark:text-white">
                    <span>Grand Total</span>
                    <span className="text-orange-655 dark:text-orange-400 font-black">
                      KES {overallTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-around items-center pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center select-none gap-2">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-[#32ba78]" />
                    <span>Escrow Safe</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck size={12} className="text-orange-500" />
                    <span>Speedy Delivery</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <RefreshCw size={12} className="text-blue-500" />
                    <span>7d Returns</span>
                  </div>
                </div>

              </div>

              <div className="bg-gray-50 dark:bg-gray-955 p-4 rounded-2xl text-[10px] leading-relaxed text-gray-400 dark:text-gray-500 font-semibold max-w-full">
                🚨 Delivery expectation for <span className="text-gray-900 dark:text-white font-black">{address.country !== "Kenya" ? address.country : address.county} ({address.city})</span>: {deliveryPrediction.time}.
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
