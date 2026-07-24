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
  Banknote
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { counties } from "../data/counties";
import { FastImage } from "../components/FastImage";
import { calculateDelivery, calculateShippingFee } from "../utils/delivery";
import { DeliveryCountdown } from "../components/DeliveryCountdown";
import { useSellerStudio } from "../lib/SellerStudioContext";
import FreeDeliveryMap from "../components/FreeDeliveryMap";

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

    return {
      country: savedCountry,
      city: savedCity,
      county: savedCountry === "Kenya" ? savedCounty : "",
      street: "",
      phone: initialPhone,
      email: user?.email || ""
    };
  });

  const navigate = useNavigate();

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
        console.error("Error fetching delivery settings in checkout:", err);
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
        city: defaultCity
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
      city: defaultCity
    });
    localStorage.setItem("sokoplus_delivery_county", countyName);
    localStorage.setItem("sokoplus_delivery_city", defaultCity);
  };

  const selectedCountyData = counties.find(c => c.name === address.county) || counties.find(c => c.name === "Nairobi City County") || counties[0];
  const currentCities = selectedCountyData 
    ? selectedCountyData.cities.filter(city => !disabledCities.includes(city)) 
    : [];

  const baseShippingFee = calculateShippingFee(address.county, address.city, total, address.country);

  const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherError, setVoucherError] = useState("");
  const [voucherSuccess, setVoucherSuccess] = useState("");

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

  let appliedDiscount = 0;
  let shippingFee = baseShippingFee;

  if (appliedVoucher) {
    if (appliedVoucher.id === "free-shipping" || appliedVoucher.code === "SOKO-SHIP-FREE-NEXT") {
      shippingFee = 0;
    } else if (appliedVoucher.id === "gift-voucher" || appliedVoucher.code === "SOKO-VOUCH-500K") {
      appliedDiscount = 500;
    }
  }

  const overallTotal = Math.max(0, total + shippingFee - appliedDiscount);

  // Free shipping progress variables
  const FREE_SHIPPING_LIMIT = 15000;
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
    if (!user) {
      toast.error("Please sign in to complete your checkout.");
      navigate("/login");
      return;
    }

    if (user.email && !user.emailVerified) {
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
      // 1. Stock Check
      for (const item of items) {
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
      }

      setRedirectStage("Securing Connection");
      setRedirectDescription("Drafting Paystack billing configuration securely for instant payment validation...");

      // 2. Initialize Paystack
      const payAmount = paymentMethod === "cod" ? Math.round(overallTotal * 0.1) : overallTotal;
      const response = await axios.post("/api/paystack/initialize", {
        email: address.email,
        amount: payAmount,
        callback_url: window.location.origin + "/payment-success",
        metadata: {
          userId: user.uid,
          items: items.map(i => ({ id: i.productId, qty: i.quantity, customs: i.customizations })),
          preferredPaymentMethod: paymentMethod,
          isDepositOnly: paymentMethod === "cod",
          depositAmount: paymentMethod === "cod" ? Math.round(overallTotal * 0.1) : 0,
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

      // If a voucher is applied, we must remove it from the user's vouchers array in Firestore to enforce single-use!
      if (appliedVoucher) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentVouchers = userData.vouchers || [];
            // Filter out the matching voucher
            const updatedVouchers = currentVouchers.filter((v: any) => v.code.toUpperCase() !== appliedVoucher.code.toUpperCase());
            await updateDoc(userRef, {
              vouchers: updatedVouchers
            });
            console.log(`[Checkout] Successfully consumed voucher: ${appliedVoucher.code}`);
          }
        } catch (vErr) {
          console.error("Error consuming voucher from Firestore:", vErr);
        }
      }

      await addDoc(collection(db, "orders"), sanitizeData({
        userId: user.uid,
        userEmail: address.email,
        items,
        sellerIds: sellerIdsList,
        totalAmount: overallTotal,
        depositAmount: paymentMethod === "cod" ? Math.round(overallTotal * 0.1) : 0,
        discountAmount: appliedDiscount,
        appliedVoucherCode: appliedVoucher ? appliedVoucher.code : null,
        status: "pending",
        paymentStatus: "unpaid",
        paymentReference: reference,
        shippingAddress: submittedAddress,
        preferredPaymentMethod: paymentMethod,
        createdAt: serverTimestamp()
      }));

      // 4. Smooth Redirect
      setRedirectStage("Redirecting to Paystack");
      setRedirectDescription("Navigating you securely to final portal Checkout...");
      
      setTimeout(() => {
        window.location.href = authorization_url;
      }, 100);
      
    } catch (error: any) {
      const detail = error.response?.data?.details || error.response?.data?.error || "Failed to process checkout. Please try again.";
      console.error("Checkout error:", error);
      toast.error(detail, { duration: 5000 });
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
            
            <div className="flex items-start gap-4">
              <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 p-2.5 rounded-2xl shrink-0">
                <MapPin size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight text-gray-955 dark:text-white">1. Delivery Location</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Select your exact shipping destination {address.country === "Kenya" ? "inside Kenya" : `in ${address.country}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Country</label>
                <div className="relative">
                  <select 
                    value={address.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-955 border border-gray-150 dark:border-gray-800 rounded-2xl outline-none text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all appearance-none cursor-pointer pr-10"
                  >
                    {Object.keys(COUNTRY_FLAGS).filter(cty => !disabledCountries.includes(cty)).map((cty) => (
                      <option key={cty} value={cty} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                        {COUNTRY_FLAGS[cty]} {cty}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              {address.country === "Kenya" ? (
                <>
                  <div>
                    <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">County Territory</label>
                    <div className="relative">
                      <select 
                        value={address.county}
                        onChange={(e) => handleCountyChange(e.target.value)}
                        className="w-full p-4 bg-gray-50 dark:bg-gray-955 border border-gray-150 dark:border-gray-800 rounded-2xl outline-none text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all appearance-none cursor-pointer pr-10"
                      >
                        {counties.filter(c => !disabledCounties.includes(c.name)).map((c) => (
                          <option key={c.name} value={c.name} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Township / Settlement</label>
                    <div className="relative">
                      <select 
                        value={address.city}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddress({...address, city: val});
                          localStorage.setItem("sokoplus_delivery_city", val);
                        }}
                        className="w-full p-4 bg-gray-50 dark:bg-gray-955 border border-gray-150 dark:border-gray-800 rounded-2xl outline-none text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all appearance-none cursor-pointer pr-10"
                      >
                        {currentCities.map((city) => (
                          <option key={city} value={city} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                            {city}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">City / Destination</label>
                  <div className="relative">
                    <select 
                      value={address.city}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddress({...address, city: val});
                        localStorage.setItem("sokoplus_delivery_city", val);
                      }}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-955 border border-gray-150 dark:border-gray-800 rounded-2xl outline-none text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all appearance-none cursor-pointer pr-10"
                    >
                      {CITIES_BY_COUNTRY[address.country]?.filter(city => !disabledCities.includes(city)).map((city) => (
                        <option key={city} value={city} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                          {city}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  </div>
                </div>
              )}
            </div>

            {/* Free OpenStreetMap Interactive Pin-drop */}
            <FreeDeliveryMap 
              county={address.county}
              city={address.city}
              onChange={(lat, lng, addressText) => {
                setAddress(prev => {
                  const updated = { ...prev, lat, lng };
                  if (addressText) {
                    updated.street = addressText;
                  }
                  return updated;
                });
                if (addressText) {
                  setValidationErrors(prev => {
                    const updated = { ...prev };
                    delete updated.street;
                    return updated;
                  });
                }
              }}
            />

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Detailed Street Address / Apartment / Estate</label>
              <input 
                required
                type="text" 
                value={address.street}
                onChange={(e) => {
                  setAddress({...address, street: e.target.value});
                  if (e.target.value.trim()) {
                    setValidationErrors(prev => {
                      const updated = { ...prev };
                      delete updated.street;
                      return updated;
                    });
                  }
                }}
                placeholder="e.g. Apartment A14, Pine Breeze Estate, 3rd Avenue" 
                className={`w-full p-4 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white border rounded-2xl outline-none font-semibold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all ${
                  validationErrors.street ? "border-red-500 focus:ring-red-400" : "border-gray-150 dark:border-gray-800"
                }`}
              />
              {validationErrors.street && (
                <p className="text-red-500 text-[10px] font-bold flex items-center gap-1 mt-1">
                  <AlertTriangle size={12} />
                  <span>{validationErrors.street}</span>
                </p>
              )}
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
              <span className="font-black text-gray-900 dark:text-white uppercase font-black">Pre-Cleaned</span>
            </div>

          </div>

          {/* STEP 3: Promo Voucher Application (Optional) */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-orange-500 to-amber-500 h-1.5 w-full"></div>
            
            <div className="flex items-start justify-between gap-4 border-b border-gray-50 dark:border-gray-800 pb-4">
              <div className="flex items-start gap-4">
                <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 p-2.5 rounded-2xl shrink-0">
                  <Gift size={22} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-tight text-gray-955 dark:text-white">3. Apply Soko Voucher (Optional)</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-550 font-semibold uppercase tracking-wider">
                    Redeem special mystery box rewards or type a coupon code
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {appliedVoucher ? (
                <div className="bg-[#32ba78]/10 dark:bg-[#32ba78]/5 border border-[#32ba78]/30 p-5 rounded-2xl flex items-center justify-between gap-4 animate-fade-in brand-success-glow">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#32ba78]/20 dark:bg-[#32ba78]/10 text-[#32ba78] rounded-xl">
                      <Check size={20} />
                    </div>
                    <div>
                      <p className="font-black text-sm text-[#32ba78] dark:text-gray-100">
                        Voucher Applied: <span className="font-extrabold uppercase bg-[#32ba78]/20 dark:bg-[#32ba78]/25 text-[#32ba78] px-2.5 py-1 rounded-lg text-xs tracking-wider">{appliedVoucher.code}</span>
                      </p>
                      <p className="text-xs text-[#32ba78]/90 dark:text-[#32ba78] mt-1 font-semibold leading-relaxed">
                        {appliedVoucher.title} — {appliedVoucher.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    className="p-2 bg-[#32ba78]/10 dark:bg-[#32ba78]/10 hover:bg-[#32ba78]/20 dark:hover:bg-[#32ba78]/20 text-[#32ba78] rounded-xl transition-all cursor-pointer"
                    title="Remove voucher"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  <div className="md:col-span-8">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voucherCodeInput}
                        onChange={(e) => setVoucherCodeInput(e.target.value)}
                        placeholder="Type or paste voucher code (e.g., SOKO-VOUCH-500K)"
                        className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 outline-none font-bold text-gray-950 dark:text-white uppercase tracking-wide placeholder-gray-400 text-xs sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyVoucherCode(voucherCodeInput)}
                        className="px-6 py-4 bg-gray-950 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer whitespace-nowrap"
                      >
                        Apply Code
                      </button>
                    </div>

                    {voucherError && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-2 ml-1">
                        <AlertTriangle size={12} />
                        <span>{voucherError}</span>
                      </p>
                    )}

                    {voucherSuccess && (
                      <p className="text-[10px] text-[#32ba78] font-bold flex items-center gap-1 mt-2 ml-1">
                        <Check size={12} />
                        <span>{voucherSuccess}</span>
                      </p>
                    )}
                  </div>

                  {/* ACTIVE VOUCHERS QUICK SELECT */}
                  <div className="md:col-span-4 space-y-2 bg-gray-50/70 dark:bg-gray-950/40 p-4 rounded-2xl border border-gray-150 dark:border-gray-800">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-none">
                      Your Available Vouchers
                    </p>
                    {!user ? (
                      <p className="text-[10px] text-gray-400 font-semibold italic">Sign in to apply saved vouchers.</p>
                    ) : !user.vouchers || user.vouchers.filter((v: any) => v.status === "active").length === 0 ? (
                      <p className="text-[10px] text-gray-400 font-semibold italic leading-relaxed">No active rewards on your profile yet. Order & win mystery boxes!</p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-36 overflow-y-auto no-scrollbar">
                        {user.vouchers
                          .filter((v: any) => v.status === "active")
                          .map((voucher: any, idx: number) => (
                            <button
                              key={`${voucher.id}-${idx}`}
                              type="button"
                              onClick={() => handleApplyVoucherCode(voucher.code)}
                              className="w-full text-left p-2.5 bg-white dark:bg-gray-900 hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-gray-200 dark:border-gray-800 rounded-xl transition-colors cursor-pointer group flex items-center justify-between"
                            >
                              <div className="min-w-0 pr-1.5">
                                <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white group-hover:text-orange-600 tracking-wider">
                                  {voucher.code}
                                </p>
                                <p className="text-[8px] text-gray-400 truncate max-w-[150px]">
                                  {voucher.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {voucher.unlockedAt && (
                                  <span className="text-[8px] bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-extrabold px-1.5 py-0.5 rounded">
                                    {(() => {
                                      const expiry = new Date(new Date(voucher.unlockedAt).getTime() + 21 * 24 * 60 * 60 * 1000);
                                      const diff = expiry.getTime() - new Date().getTime();
                                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                      return `${days > 0 ? days : 0}d left`;
                                    })()}
                                  </span>
                                )}
                                <Plus size={10} className="text-gray-400 group-hover:text-orange-600 shrink-0" />
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                        {paymentMethod === "cod" && "Cash on Delivery (COD)"}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold truncate">
                        {paymentMethod === "mpesa" && "Instant STK Push (Safaricom / Airtel / Telkom)"}
                        {paymentMethod === "card" && "Visa, Mastercard & American Express"}
                        {paymentMethod === "cod" && `10% Deposit (KES ${Math.round(overallTotal * 0.1).toLocaleString()})`}
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
                            <p className="text-xs font-black uppercase tracking-tight">Cash on Delivery (COD)</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">10% Deposit (KES {Math.round(overallTotal * 0.1).toLocaleString()})</p>
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
                  <span className="font-extrabold text-xs tracking-tight text-gray-955 dark:text-white uppercase leading-snug">Cash on Delivery</span>
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
                    <p className="text-[8px] text-gray-400 dark:text-gray-550 font-black uppercase tracking-widest leading-none">Requires 10% deposit</p>
                    <p className="text-[10px] text-gray-650 dark:text-gray-450 font-bold leading-tight">
                      Requires 10% deposit of total cart value (KES {Math.round(overallTotal * 0.1).toLocaleString()})
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

            <div className="bg-[#32ba78]/10 dark:bg-[#32ba78]/5 p-4 rounded-2xl border border-[#32ba78]/25 flex items-center gap-3 text-xs text-gray-700 dark:text-gray-300 font-semibold justify-between mt-2">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-[#32ba78]" />
                <span className="font-extrabold text-[#32ba78] uppercase tracking-wide text-[10px]">100% Secure Checkout powered by Paystack.</span>
              </div>
              <span className="text-[10px] bg-white dark:bg-gray-900 border border-[#32ba78]/30 text-[#32ba78] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider shadow-sm shrink-0">
                PCI-DSS Compliant
              </span>
            </div>

          </div>   </div>

               {/* RIGHT COLUMN: Sticky Predictive Calculation Summary Panel */}
        <div className="lg:col-span-4 sticky top-24 self-start hidden lg:block">
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6">
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-50 dark:border-gray-800">
              <h2 className="text-md font-black uppercase tracking-wider text-gray-955 dark:text-white flex items-center gap-2">
                <Receipt size={16} className="text-orange-600 dark:text-orange-400" />
                <span>Calculation Summary</span>
              </h2>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase">Dynamic predictions</span>
            </div>

            {/* Predictive Free Shipping progress tracker */}
            <div className="space-y-2 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/10 dark:to-amber-950/10 p-4 rounded-2xl border border-orange-100/30 dark:border-orange-900/20">
              <div className="flex items-center justify-between text-xs font-bold leading-none">
                <span className="text-orange-850 dark:text-orange-300 flex items-center gap-1.5 uppercase font-black text-[10px] tracking-wider">
                  <Sparkles size={12} className="text-orange-600 dark:text-orange-400" />
                  Free delivery test
                </span>
                <span className="text-orange-600 dark:text-orange-400 font-black text-[10px] uppercase">
                  Threshold: KES 15,000
                </span>
              </div>

              {/* Progress gauge */}
              <div className="w-full bg-orange-100/30 dark:bg-orange-950/40 rounded-full h-2 overflow-hidden mt-1.5">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressToFreeShipping}%` }}
                />
              </div>

              {remainingForFreeShipping > 0 ? (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed mt-1">
                  Add <span className="font-extrabold text-orange-600 dark:text-orange-400">KES {remainingForFreeShipping.toLocaleString()}</span> more to unlock <span className="font-extrabold">FREE shipping</span>.
                </p>
              ) : (
                <p className="text-[10px] text-[#32ba78] font-bold flex items-center gap-1 mt-1 uppercase tracking-tight">
                  <Check size={12} />
                  <span>Unbelievable! You've unlocked FREE Delivery.</span>
                </p>
              )}
            </div>

            {/* Breakdown fields */}
            <div className="space-y-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
              
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-black text-gray-900 dark:text-white">KES {total.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <span>Express Courier Fee</span>
                  <p className="text-[9px] text-gray-450 dark:text-gray-400 font-bold mt-0.5 leading-none uppercase">
                    {address.country !== "Kenya" ? address.country : address.county.split(" ")[0]} Area Rate
                  </p>
                </div>
                <span className="font-black text-gray-900 dark:text-white">
                  {shippingFee === 0 ? (
                    <span className="text-[#32ba78] font-black uppercase text-[10px] bg-[#32ba78]/10 dark:bg-[#32ba78]/5 px-2 py-0.5 rounded-full">
                      Free shipping
                    </span>
                  ) : (
                    `KES ${shippingFee.toLocaleString()}`
                  )}
                </span>
              </div>

              <div className="flex justify-between pt-1 border-t border-dashed border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500">
                <span>Value Added Tax (16% VAT)</span>
                <span className="font-bold">Included</span>
              </div>

              {appliedDiscount > 0 && (
                <div className="flex justify-between items-center text-[#32ba78] font-black bg-[#32ba78]/10 dark:bg-[#32ba78]/5 px-3 py-2 rounded-xl border border-[#32ba78]/20">
                  <span>Voucher Discount</span>
                  <span>- KES {appliedDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-1">
                <div className="flex justify-between items-baseline text-2xl font-black text-gray-950 dark:text-white">
                  <span>Grand Total</span>
                  <span className="text-orange-655 dark:text-orange-400 font-black">
                    KES {overallTotal.toLocaleString()}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 dark:text-gray-550 text-right font-medium leading-none">
                  Fully transparent pricing details.
                </p>
              </div>

            </div>

            <button 
              onClick={handleCheckout}
              disabled={loading || items.length === 0}
              type="button"
              className="w-full bg-gray-900 dark:bg-orange-600 text-white py-5 rounded-3xl font-black text-md hover:bg-orange-600 dark:hover:bg-orange-700 focus:bg-orange-650 focus:bg-orange-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group shadow-lg shadow-gray-100 dark:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-3 animate-spin" />
                  Finalizing Order...
                </>
              ) : (
                <>
                  {paymentMethod === "cod" 
                    ? `Pay 10% Deposit (KES ${Math.round(overallTotal * 0.1).toLocaleString()})`
                    : "Secure Payment with Paystack"
                  }
                  <ArrowRight className="ml-2.5 group-hover:translate-x-1 transition-transform" size={16} />
                </>
              )}
            </button>

            <div className="text-center">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold leading-relaxed">
                By clicking pay, you will be redirected to the secure gateway channel. Guaranteed protection by Paystack.
              </p>
            </div>

          </div>

          {/* SokoPlus Buyer Protection Assurance Panel */}
          <div className="bg-gradient-to-br from-[#32ba78]/10 via-[#32ba78]/5 to-transparent border border-[#32ba78]/30 rounded-3xl p-6 space-y-4 shadow-sm mt-6">
            <div className="flex items-center space-x-3 text-[#32ba78]">
              <ShieldCheck size={22} className="shrink-0" />
              <h4 className="font-extrabold text-sm uppercase tracking-wider text-gray-950 dark:text-white">Buyer Protection Guarantee</h4>
            </div>
            <ul className="space-y-3.5 text-xs text-gray-600 dark:text-gray-400 font-semibold leading-relaxed">
              <li className="flex items-start gap-2.5 text-left">
                <div className="w-1.5 h-1.5 rounded-full bg-[#32ba78] mt-1.5 shrink-0" />
                <span>
                  {sellerStudioEnabled ? (
                    <>
                      <strong className="text-gray-900 dark:text-white">Direct-to-Artisan support:</strong> 100% of purchase goes to the certified craft maker with fair-wage protection.
                    </>
                  ) : (
                    <>
                      <strong className="text-gray-900 dark:text-white">Direct Quality Sourcing:</strong> 100% genuine products sourced directly from trusted workshops with quality assurances.
                    </>
                  )}
                </span>
              </li>
              {sellerStudioEnabled && (
                <li className="flex items-start gap-2.5 text-left">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#32ba78] mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-gray-900 dark:text-white">Escrow Payment Protection:</strong> Payments are safely held in escrow and only released to sellers after dispatch confirmation.
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2.5 text-left">
                <div className="w-1.5 h-1.5 rounded-full bg-[#32ba78] mt-1.5 shrink-0" />
                <span>
                  <strong className="text-gray-900 dark:text-white">7-Day Free Returns:</strong> Simple, hassle-free replacement or full refund if you're not completely in love.
                </span>
              </li>
            </ul>
            <div className="border-t border-gray-150 dark:border-gray-800/60 pt-3 flex items-center justify-between text-[10px] text-gray-400 font-extrabold uppercase">
              <span>{sellerStudioEnabled ? "Verified Artisan Seller Guild" : "Verified Quality Guarantee"}</span>
              <span className="text-[#32ba78]">● Active Protection</span>
            </div>
          </div>

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
                  ? `Pay Deposit (KES ${Math.round(overallTotal * 0.1).toLocaleString()})`
                  : "Checkout"
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
              <div className="space-y-2 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/10 dark:to-amber-950/10 p-4 rounded-2xl border border-orange-100/30 dark:border-orange-900/10">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-orange-800 dark:text-orange-300">Free delivery test</span>
                  <span className="text-orange-600 dark:text-orange-400">Threshold: KES 15,000</span>
                </div>
                <div className="w-full bg-orange-100/30 dark:bg-orange-950/40 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full"
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
