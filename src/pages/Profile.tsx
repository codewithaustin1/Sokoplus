import { useEffect, useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, Order, Voucher } from "../types";
import { User, Mail, Award, Package, ArrowRight, ShoppingBag, Clock, LogOut, Phone, Download, Bell, CheckCircle, Store, Truck, Trash2, Camera, Upload, Settings, Sun, Moon, Globe, Coins, Gift, Copy, Check, Shield, ShieldCheck, ShieldAlert, QrCode, Key } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../lib/firebase";
import SEO from "../components/SEO";
import EmptyState from "../components/EmptyState";
import { downloadReceipt } from "../utils/pdfGenerator";
import { useLanguage } from "../lib/LanguageContext";
import { useTheme } from "../lib/ThemeContext";
import { useCurrency } from "../lib/CurrencyContext";
import toast from "react-hot-toast";
import SellerStudio from "../components/SellerStudio";
import { useSellerStudio } from "../lib/SellerStudioContext";
import { generateSecret, verifyTOTP } from "../utils/totp";

function getVoucherBgImage(voucherId: string, code: string): string {
  const id = (voucherId || "").toLowerCase();
  const c = (code || "").toLowerCase();
  if (id.includes("shipping") || c.includes("ship")) {
    return "/free_shipping_voucher.jpg"; // premium shipping voucher card recreated design
  }
  if (id.includes("points") || c.includes("multiply")) {
    return "/loyalty_points_voucher.jpg"; // premium loyalty points background
  }
  if (id.includes("voucher") || c.includes("vouch")) {
    return "/cash_voucher_bg.jpg"; // premium cash voucher background design
  }
  if (id.includes("pass") || c.includes("vip") || id.includes("artisan")) {
    return "/artisan_pass_bg.jpg"; // premium VIP artisan pass background design
  }
  return "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=600&auto=format&fit=crop"; // general fallback workbench
}

function VoucherCard({ voucher, language }: { voucher: Voucher; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(voucher.code);
    setCopied(true);
    toast.success(language === "sw" ? "Kodi ya vocha imenakiliwa!" : "Voucher code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const bgImage = getVoucherBgImage(voucher.id, voucher.code);
  const isShipping = (voucher.id || "").toLowerCase().includes("shipping") || (voucher.code || "").toLowerCase().includes("ship");
  const isPoints = (voucher.id || "").toLowerCase().includes("points") || (voucher.code || "").toLowerCase().includes("multiply");
  const isGift = (voucher.id || "").toLowerCase().includes("voucher") || (voucher.code || "").toLowerCase().includes("vouch");
  const isPass = (voucher.id || "").toLowerCase().includes("pass") || (voucher.code || "").toLowerCase().includes("vip") || (voucher.id || "").toLowerCase().includes("artisan");
  const isPremiumBg = isShipping || isPoints || isGift || isPass;

  return (
    <div className="group relative bg-gray-950 border border-gray-800/80 rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[220px]">
      {/* Background Image with Overlay */}
      <div 
        className={`absolute inset-0 bg-cover bg-center ${isPremiumBg ? "opacity-60" : "opacity-30 mix-blend-luminosity"} group-hover:scale-105 group-hover:opacity-75 transition-all duration-700 pointer-events-none`} 
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Premium dark gradient overlay for text legibility */}
      <div className={`absolute inset-0 bg-gradient-to-b ${isPremiumBg ? "from-gray-950/50 via-gray-950/70 to-gray-950/92" : "from-gray-950/75 via-gray-950/85 to-gray-950/98"} pointer-events-none z-0`} />

      {/* Ticket Cutouts */}
      <div className="absolute top-1/2 -left-3 w-6 h-6 bg-gray-50 dark:bg-gray-900 border-r border-gray-850 dark:border-gray-800 rounded-full -translate-y-1/2 z-10 pointer-events-none" />
      <div className="absolute top-1/2 -right-3 w-6 h-6 bg-gray-50 dark:bg-gray-900 border-l border-gray-850 dark:border-gray-800 rounded-full -translate-y-1/2 z-10 pointer-events-none" />

      {/* Top Section */}
      <div className="p-6 space-y-4 relative z-10">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 px-2.5 py-1 rounded-full border border-orange-500/25 backdrop-blur-md">
            {voucher.badge}
          </span>
          {voucher.unlockedAt && (
            <span 
              className="text-[10px] font-bold text-gray-400 flex flex-col items-end"
              title={(() => {
                const expiry = new Date(new Date(voucher.unlockedAt).getTime() + 21 * 24 * 60 * 60 * 1000);
                return language === "sw" 
                  ? `Muda unaisha: ${expiry.toLocaleDateString()}` 
                  : `Expires: ${expiry.toLocaleDateString()}`;
              })()}
            >
              <span className="text-orange-400 font-black animate-pulse">
                {(() => {
                  const expiry = new Date(new Date(voucher.unlockedAt).getTime() + 21 * 24 * 60 * 60 * 1000);
                  const diff = expiry.getTime() - new Date().getTime();
                  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                  return language === "sw" 
                    ? `Zimesalia siku ${days > 0 ? days : 0}` 
                    : `${days > 0 ? days : 0} days left`;
                })()}
              </span>
              <span className="text-[8px] text-gray-500 mt-0.5">
                {language === "sw" ? "Hadi " : "Until "}{new Date(new Date(voucher.unlockedAt).getTime() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </span>
            </span>
          )}
        </div>

        <div>
          <h3 className="text-lg font-black text-white leading-snug group-hover:text-orange-400 transition-colors duration-300">
            {voucher.title}
          </h3>
          <p className="text-gray-300 text-xs mt-1 leading-relaxed">
            {voucher.description}
          </p>
        </div>
      </div>

      {/* Dotted Divider line */}
      <div className="border-t border-dashed border-gray-800/80 relative mx-6 z-10 pointer-events-none" />

      {/* Bottom section with Code and Copy */}
      <div className="p-6 bg-gray-950/40 relative z-10 flex items-center justify-between gap-4">
        <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl font-mono text-xs font-bold text-orange-300 tracking-wider backdrop-blur-md">
          {voucher.code}
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            copied
              ? "bg-green-600 text-white shadow-lg shadow-green-900/35"
              : "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/40"
          }`}
        >
          {copied ? (
            <>
              <Check size={12} className="stroke-[3]" />
              <span>{language === "sw" ? "Imenakiliwa" : "Copied"}</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>{language === "sw" ? "Nakili" : "Copy"}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface ProfileProps {
  user: UserProfile | null;
}

export default function Profile({ user }: ProfileProps) {
  const { sellerStudioEnabled } = useSellerStudio();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"this-month" | "last-12-months" | "specific-month">("this-month");
  const [profileTab, setProfileTab] = useState<"orders" | "vouchers" | "seller" | "settings">("orders");
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    if (!sellerStudioEnabled && profileTab === "seller") {
      setProfileTab("orders");
    }
  }, [sellerStudioEnabled, profileTab]);
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();

  const [isConfiguring2FA, setIsConfiguring2FA] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [is2FAVerifying, setIs2FAVerifying] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disable2FACode, setDisable2FACode] = useState("");
  
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedClearLimit, setSelectedClearLimit] = useState<number | "all" | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeAndCompressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            resolve(dataUrl);
          } else {
            reject(new Error("Failed to get canvas 2D context"));
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const uploadProfileImage = async (file: File) => {
    if (!user) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error(
        language === "sw"
          ? "Tafadhali chagua faili la picha inayofaa."
          : "Please select a valid image file."
      );
      return;
    }

    setIsUploading(true);
    const uploadToastId = toast.loading(
      language === "sw" ? "Inapakia picha ya wasifu..." : "Uploading profile picture..."
    );

    try {
      const compressedBase64 = await resizeAndCompressImage(file);
      
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: compressedBase64,
        updatedAt: new Date().toISOString()
      });

      toast.success(
        language === "sw"
          ? "Picha ya wasifu imesasishwa kikamilifu!"
          : "Profile picture uploaded successfully!",
        { id: uploadToastId }
      );
    } catch (err) {
      console.error("Failed to upload profile picture:", err);
      toast.error(
        language === "sw"
          ? "Imefeli kusasisha picha ya wasifu."
          : "Failed to upload profile picture.",
        { id: uploadToastId }
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadProfileImage(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadProfileImage(file);
    }
  };

  const handleStart2FASetup = () => {
    const secret = generateSecret();
    setTotpSecret(secret);
    setTotpCode("");
    setIsConfiguring2FA(true);
  };

  const handleVerifyAndEnable2FA = async () => {
    if (!user?.uid || !user?.email) return;
    setIs2FAVerifying(true);
    try {
      const isValid = await verifyTOTP(totpSecret, totpCode);
      if (!isValid) {
        toast.error(language === "sw" ? "Msimbo si sahihi au umeisha muda wake. Tafadhali jaribu tena." : "Invalid or expired verification code. Please try again.");
        setIs2FAVerifying(false);
        return;
      }
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        twoFactorEnabled: true,
        twoFactorSecret: totpSecret,
      });
      toast.success(language === "sw" ? "Ulinzi wa 2FA umewezeshwa kikamilifu!" : "Two-Factor Authentication fully enabled successfully!");
      setIsConfiguring2FA(false);
      setTotpSecret("");
      setTotpCode("");
    } catch (error) {
      console.error("Failed to enable 2FA:", error);
      toast.error(language === "sw" ? "Hitilafu imetokea wakati wa kuwezesha 2FA." : "An error occurred while enabling 2FA.");
    } finally {
      setIs2FAVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user?.uid || !user?.twoFactorSecret) return;
    setIs2FAVerifying(true);
    try {
      const isValid = await verifyTOTP(user.twoFactorSecret, disable2FACode);
      if (!isValid) {
        toast.error(language === "sw" ? "Msimbo si sahihi au umeisha muda wake. Tafadhali jaribu tena." : "Invalid or expired verification code. Please try again.");
        setIs2FAVerifying(false);
        return;
      }
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
      toast.success(language === "sw" ? "Ulinzi wa 2FA umezimwa kikamilifu." : "Two-Factor Authentication successfully disabled.");
      setShowDisable2FAModal(false);
      setDisable2FACode("");
    } catch (error) {
      console.error("Failed to disable 2FA:", error);
      toast.error(language === "sw" ? "Hitilafu imetokea wakati wa kuzima 2FA." : "An error occurred while disabling 2FA.");
    } finally {
      setIs2FAVerifying(false);
    }
  };

  const clearOrders = async (limitNum: number | "all") => {
    if (!user) return;
    setIsClearing(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const userOrders = snap.docs.map(d => {
        const data = d.data();
        let orderDate: Date;
        if (data.createdAt?.toDate) {
          orderDate = data.createdAt.toDate();
        } else if (data.createdAt?.seconds) {
          orderDate = new Date(data.createdAt.seconds * 1000);
        } else if (data.createdAt) {
          orderDate = new Date(data.createdAt);
        } else {
          orderDate = new Date(0);
        }
        return { id: d.id, orderDate, ...data } as (Order & { orderDate: Date });
      });

      // Filter out those already cleared has clearedByClient === true
      const activeUserOrders = userOrders.filter(o => o.clearedByClient !== true);

      // Sort descending (most recent first)
      activeUserOrders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());

      let toDelete = activeUserOrders;
      if (limitNum !== "all") {
        toDelete = activeUserOrders.slice(0, limitNum);
      }

      if (toDelete.length === 0) {
        toast.error(language === "sw" ? "Hakuna agizo la kufuta." : "No orders found to clear.");
        setIsClearing(false);
        return;
      }

      // Soft clearance: update order docs with clearedByClient: true to preserve admin view records
      await Promise.all(toDelete.map(o => updateDoc(doc(db, "orders", o.id), { clearedByClient: true })));

      const deletedIds = new Set(toDelete.map(o => o.id));
      setOrders(prev => prev.filter(o => !deletedIds.has(o.id)));

      toast.success(
        language === "sw"
          ? `Agizo kiasi cha ${toDelete.length} zimefutwa kikamilifu.`
          : `Successfully cleared up to ${toDelete.length} ${toDelete.length === 1 ? "order" : "orders"}!`
      );
      setShowClearModal(false);
    } catch (err) {
      console.error("Failed to clear user order history:", err);
      toast.error(
        language === "sw"
          ? "Hitilafu imetokea wakati wa kufuta historia ya agizo."
          : "An error occurred while clearing your order history."
      );
    } finally {
      setIsClearing(false);
      setSelectedClearLimit(null);
    }
  };
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "denied";
  });

  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser notifications are not supported on this device.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result === "granted") {
        toast.success("Successfully subscribed to SokoPlus device alerts!", { icon: "🔔" });
      } else if (result === "denied") {
        toast.error("Alerts permission is blocked. Modify browser parameters to allow.", { icon: "🔕" });
      }
    } catch (e) {
      console.error("Error setting notification options:", e);
    }
  };
  
  // Initialize with current year and month
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(`${now.getFullYear()}-${now.getMonth()}`);

  const getMonthsList = () => {
    const list = [];
    const tempDate = new Date();
    for (let i = 0; i < 12; i++) {
      const monthName = tempDate.toLocaleString('default', { month: 'long' });
      const year = tempDate.getFullYear();
      const value = `${tempDate.getFullYear()}-${tempDate.getMonth()}`;
      list.push({ label: `${monthName} ${year}`, value });
      tempDate.setMonth(tempDate.getMonth() - 1);
    }
    return list;
  };
  const monthsList = getMonthsList();

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return;
      setLoading(true);
      try {
        let snap;
        try {
          // Attempt optimized date-bounded firestore query
          let q = query(
            collection(db, "orders"),
            where("userId", "==", user.uid)
          );

          const currentDate = new Date();
          if (timeFilter === "this-month") {
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
            q = query(q, where("createdAt", ">=", startOfMonth));
          } else if (timeFilter === "last-12-months") {
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
            twelveMonthsAgo.setHours(0, 0, 0, 0);
            q = query(q, where("createdAt", ">=", twelveMonthsAgo));
          } else if (timeFilter === "specific-month" && selectedMonth) {
            const [year, month] = selectedMonth.split("-").map(Number);
            const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
            const endOfMonth = new Date(year, month + 1, 1, 0, 0, 0, 0);
            q = query(q, where("createdAt", ">=", startOfMonth), where("createdAt", "<", endOfMonth));
          }

          q = query(q, orderBy("createdAt", "desc"), limit(50));
          snap = await getDocs(q);
        } catch (indexError: any) {
          console.warn("[Profile] Date-bounded index not ready, falling back to client-side filtering:", indexError.message);
          // Fallback query (already indexed)
          const fallbackQ = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(50)
          );
          snap = await getDocs(fallbackQ);
        }

        const allFetchedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        
        // Auto delete Delivered or Cancelled orders older than one year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const ordersToDelete: Order[] = [];
        const activeOrders: Order[] = [];
        
        allFetchedOrders.forEach(order => {
          if (order.clearedByClient === true) return;

          let orderDate: Date;
          if (order.createdAt?.toDate) {
            orderDate = order.createdAt.toDate();
          } else if (order.createdAt?.seconds) {
            orderDate = new Date(order.createdAt.seconds * 1000);
          } else if (order.createdAt) {
            orderDate = new Date(order.createdAt);
          } else {
            orderDate = new Date();
          }
          
          const isOlderThanOneYear = orderDate < oneYearAgo;
          if (isOlderThanOneYear && (order.status === 'delivered' || order.status === 'cancelled')) {
            ordersToDelete.push(order);
          } else {
            activeOrders.push(order);
          }
        });
        
        if (ordersToDelete.length > 0) {
          await Promise.all(ordersToDelete.map(order => deleteDoc(doc(db, "orders", order.id))));
          console.log(`Auto-deleted ${ordersToDelete.length} Delivered/Cancelled orders older than one year.`);
        }
        
        setOrders(activeOrders);
      } catch (error) {
        console.error("Error fetching user orders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [user, timeFilter, selectedMonth]);

  const getFilteredOrders = () => {
    const currentDate = new Date();
    return orders.filter(order => {
      let orderDate: Date;
      if (order.createdAt?.toDate) {
        orderDate = order.createdAt.toDate();
      } else if (order.createdAt?.seconds) {
        orderDate = new Date(order.createdAt.seconds * 1000);
      } else if (order.createdAt) {
        orderDate = new Date(order.createdAt);
      } else {
        orderDate = new Date();
      }
      
      if (timeFilter === "this-month") {
        return orderDate.getMonth() === currentDate.getMonth() && orderDate.getFullYear() === currentDate.getFullYear();
      }
      
      if (timeFilter === "last-12-months") {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        return orderDate >= twelveMonthsAgo;
      }
      
      if (timeFilter === "specific-month") {
        if (!selectedMonth) return false;
        const [year, month] = selectedMonth.split("-").map(Number);
        return orderDate.getMonth() === month && orderDate.getFullYear() === year;
      }
      
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <SEO title={t("My Profile")} />
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full -mr-32 -mt-32 opacity-50" />
        
        <div className="relative flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
          <div className="relative group/avatar">
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer overflow-hidden transition-all duration-300 select-none ${
                isDragging 
                  ? "bg-orange-500 scale-105 ring-4 ring-orange-500 rotate-0" 
                  : "bg-orange-600 hover:bg-orange-700 hover:scale-105"
              }`}
              title={language === "sw" ? "Bofya au buruta picha hapa ili kupakia" : "Click or drag/drop an image to upload"}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange} 
              />

              {isUploading ? (
                <div className="absolute inset-0 bg-orange-600/95 flex flex-col items-center justify-center text-white p-2">
                  <Upload size={24} className="animate-bounce" />
                  <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-center">
                    {language === "sw" ? "Inapakia" : "Uploading"}
                  </span>
                </div>
              ) : user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "Profile"} 
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-4xl font-black font-sans select-none uppercase">
                  {user.email ? user.email.charAt(0).toUpperCase() : (user.displayName ? user.displayName.charAt(0).toUpperCase() : <User size={40} />)}
                </span>
              )}

              {/* Edit overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white space-y-1 rounded-full">
                <Camera size={20} className="animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  {language === "sw" ? "Badili" : "Upload"}
                </span>
              </div>
            </div>

            {/* Remove profile picture button */}
            {user.photoURL && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (window.confirm(language === "sw" ? "Je, una uhakika unataka kufuta picha ya wasifu?" : "Are you sure you want to remove your profile picture?")) {
                    const removeToastId = toast.loading(language === "sw" ? "Inafuta picha..." : "Removing picture...");
                    try {
                      await updateDoc(doc(db, "users", user.uid), {
                        photoURL: null,
                        updatedAt: new Date().toISOString()
                      });
                      toast.success(language === "sw" ? "Picha imefutwa kikamilifu!" : "Profile picture removed successfully!", { id: removeToastId });
                    } catch (err) {
                      console.error("Failed to remove profile picture:", err);
                      toast.error(language === "sw" ? "Imefeli kufuta picha." : "Failed to remove profile picture.", { id: removeToastId });
                    }
                  }
                }}
                className="absolute bottom-0 right-0 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg border-2 border-white dark:border-gray-900 transition-all cursor-pointer hover:scale-110 z-10"
                title={language === "sw" ? "Futa picha" : "Remove photo"}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          
          <div className="flex-grow text-center md:text-left space-y-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-gray-900">{user.displayName}</h1>
              <p className="text-gray-500 flex items-center justify-center md:justify-start mt-1">
                {user.email ? <Mail size={16} className="mr-2" /> : <Phone size={16} className="mr-2" />}
                {user.email || user.phoneNumber || "No contact info"}
              </p>
            </div>
            
            <div className="flex items-center justify-center md:justify-start space-x-4">
              <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl flex items-center">
                <Award size={20} className="text-orange-600 mr-2" />
                <span className="font-bold text-orange-900">{user.loyaltyPoints} {t("Loyalty Points")}</span>
              </div>
              {user.isAdmin && (
                <Link 
                  to="/admin" 
                  className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-orange-600 transition-all text-sm"
                >
                  {t("Admin Panel")}
                </Link>
              )}
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-all text-sm flex items-center"
              >
                <LogOut size={16} className="mr-2" />
                {t("Sign Out")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Profile Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2 sm:gap-4 overflow-x-auto scrollbar-none select-none">
        <button
          onClick={() => setProfileTab("orders")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-black uppercase text-xs tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            profileTab === "orders"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Package size={16} />
          {t("Order History")}
        </button>
        <button
          onClick={() => setProfileTab("vouchers")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-black uppercase text-xs tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            profileTab === "vouchers"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Gift size={16} />
          {language === "sw" ? "Vocha Zangu" : "My Vouchers"}
        </button>
        {sellerStudioEnabled && (
          <button
            onClick={() => setProfileTab("seller")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-black uppercase text-xs tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              profileTab === "seller"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            <Store size={16} />
            {t("Seller Studio")}
          </button>
        )}
        <button
          onClick={() => setProfileTab("settings")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-black uppercase text-xs tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            profileTab === "settings"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Settings size={16} />
          {language === "sw" ? "Vipangilio" : "Settings"}
        </button>
      </div>

      {profileTab === "vouchers" ? (
        <div className="space-y-8 animate-fade-in mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 flex items-center">
                <Gift className="mr-3 text-orange-600" size={30} />
                {language === "sw" ? "Vocha Zangu Amilifu" : "My Active Vouchers"}
              </h2>
              <p className="text-gray-500 text-sm font-medium mt-1">
                {language === "sw"
                  ? "Tumia vocha hizi wakati wa kulipia ili kupata punguzo la kipekee."
                  : "Apply these vouchers during checkout to receive exclusive discounts."}
              </p>
            </div>
            <div className="text-sm font-bold text-orange-600 uppercase tracking-wider bg-orange-50 dark:bg-orange-950/20 px-4 py-2 rounded-full self-start sm:self-center">
              {language === "sw"
                ? `${user?.vouchers?.filter((v: any) => v.status === "active").length || 0} Amilifu`
                : `${user?.vouchers?.filter((v: any) => v.status === "active").length || 0} Active`}
            </div>
          </div>

          {!user?.vouchers || user.vouchers.filter((v: any) => v.status === "active").length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-150 shadow-sm max-w-md mx-auto space-y-4 my-8">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mx-auto">
                <Gift size={28} />
              </div>
              <h3 className="text-xl font-black text-gray-900">{language === "sw" ? "Hakuna vocha amilifu" : "No active vouchers"}</h3>
              <p className="text-gray-500 text-sm font-medium">
                {language === "sw"
                  ? "Bado huna vocha zozote amilifu. Ununue bidhaa upate nafasi ya kufungua sanduku la siri!"
                  : "You don't have any active vouchers yet. Place orders to unlock mystery box rewards!"}
              </p>
              <Link
                to="/"
                className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-6 py-3 rounded-2xl text-sm transition-all shadow-md shadow-orange-100 cursor-pointer"
              >
                {t("Start Shopping")}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {user.vouchers
                .filter((v: any) => v.status === "active")
                .map((voucher: any, index: number) => (
                  <VoucherCard key={`${voucher.id}-${index}`} voucher={voucher} language={language} />
                ))}
            </div>
          )}
        </div>
      ) : profileTab === "orders" ? (
        <>
          {/* Device Notifications Setup */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-30" />
        <div className="flex gap-4 items-start relative">
          <div className="p-3.5 bg-orange-50 text-orange-600 rounded-2xl border border-orange-100">
            <Bell size={24} />
          </div>
          <div className="space-y-1 max-w-xl">
            <h3 className="font-black text-lg text-gray-900 tracking-tight">{t("Delivery & Dispatch Alerts")}</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">
              {t("Enable native browser alerts to automatically receive real-time notifications about dispatch, routing, and delivered status of your SokoPlus order.")}
            </p>
          </div>
        </div>
        
        <div className="shrink-0 flex items-center gap-4 relative">
          <div className="flex flex-col items-end mr-1 hidden sm:flex">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">{t("Status")}</span>
            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 mt-1 rounded-full ${
              notificationPermission === "granted" ? "bg-green-50 text-green-700 border border-green-200" :
              notificationPermission === "denied" ? "bg-red-50 text-red-700 border border-red-200" :
              "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
            }`}>
              {notificationPermission === "granted" ? t("Active") :
               notificationPermission === "denied" ? t("Blocked") : t("Disabled")}
            </span>
          </div>

          {notificationPermission === "granted" ? (
            <div className="flex items-center gap-2 bg-green-50 text-green-800 border border-green-200 px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider">
              <CheckCircle size={16} />
              <span>{t("Permission Opt-In")}</span>
            </div>
          ) : (
            <button
              onClick={requestNotifications}
              className="bg-gray-900 hover:bg-orange-600 hover:scale-[1.01] active:scale-95 text-white font-black uppercase tracking-wider text-xs px-5 py-3.5 rounded-2xl shadow-md transition-all cursor-pointer flex items-center gap-2 animate-fade-in"
            >
              <Bell size={16} />
              <span>{t("Enable Browser Alerts")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Order History */}
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-3xl font-black tracking-tight text-gray-900 flex items-center">
            <Package className="mr-3 text-orange-600" size={32} />
            {t("Order History")}
          </h2>
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-full">
              {language === "sw" ? `Inaonyesha ${filteredOrders.length} kati ya ${orders.length}` : `Showing ${filteredOrders.length} of ${orders.length}`}
            </span>
            {orders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-black uppercase px-4 py-2.5 rounded-full text-[10px] tracking-wider transition-colors cursor-pointer border border-red-100/40"
              >
                <Trash2 size={13} />
                <span>{language === 'sw' ? 'Futa Historia' : 'Clear History'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Time Filter Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {(["this-month", "last-12-months", "specific-month"] as const).map((filterOpt) => {
              const labelMap = {
                "this-month": t("This Month"),
                "last-12-months": t("Last 12 Months"),
                "specific-month": t("Specific Month")
              };
              return (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => setTimeFilter(filterOpt)}
                  className={`px-4.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    timeFilter === filterOpt
                      ? "bg-orange-600 text-white shadow-lg shadow-orange-100 scale-[1.02]"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  }`}
                >
                  {labelMap[filterOpt]}
                </button>
              );
            })}
          </div>

          {timeFilter === "specific-month" && (
            <div className="flex items-center space-x-2 animate-fade-in">
              <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">{t("Select Month:")}</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-50 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState 
            icon={Package}
            title={t("No orders yet")}
            description={t("Ready to find something you love? Start exploring our curated collection of Kenyan excellence.")}
            actionLabel={t("Start Shopping")}
            actionPath="/"
          />
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mx-auto">
              <Package size={28} />
            </div>
            <h3 className="text-xl font-black text-gray-900">No orders found</h3>
            <p className="text-gray-500 text-sm font-medium">There are no orders matching the selected filter criteria for this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
              >
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{t("Order ID")}</p>
                      <p className="font-mono text-sm text-gray-900">#{order.id.slice(0, 8)}</p>
                    </div>
                    <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {t(order.status)}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Tracking Timeline */}
                    <div className="relative pt-2 pb-4">
                      <div className="absolute top-[22px] left-0 w-full h-0.5 bg-gray-100" />
                      <div 
                        className="absolute top-[22px] left-0 h-0.5 bg-orange-600 transition-all duration-500" 
                        style={{ 
                          width: order.status === 'pending' ? '0%' : 
                                 order.status === 'processing' ? '25%' : 
                                 order.status === 'shipped' ? '50%' : 
                                 order.status === 'delivered' ? '100%' : '0%' 
                        }} 
                      />
                      
                      <div className="relative flex justify-between">
                        {[
                          { label: t('Pending'), key: 'pending' },
                          { label: t('Processing'), key: 'processing' },
                          { label: t('Shipped'), key: 'shipped' },
                          { label: t('Delivered'), key: 'delivered' }
                        ].map((step, idx) => {
                          const statuses = ['pending', 'processing', 'shipped', 'delivered'];
                          const currentIdx = statuses.indexOf(order.status);
                          const isCompleted = currentIdx >= idx && order.status !== 'cancelled';
                          const isCurrent = currentIdx === idx && order.status !== 'cancelled';

                          return (
                            <div key={step.key} className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full border-2 bg-white z-10 transition-colors ${
                                isCompleted ? 'border-orange-600 bg-orange-600' : 'border-gray-200'
                              } ${isCurrent ? 'ring-4 ring-orange-100' : ''}`} />
                              <span className={`text-[8px] font-black uppercase tracking-tighter mt-2 ${
                                isCompleted ? 'text-orange-600' : 'text-gray-300'
                              }`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  <div className="flex items-center text-gray-500 text-sm">
                    <Clock size={16} className="mr-2" />
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Recent'}
                  </div>
                  
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{t("Total Amount")}</p>
                      <p className="text-xl font-black text-gray-900 leading-tight">
                        KES {order.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/track-order/${order.id}`}
                        className="inline-flex items-center space-x-1.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-3.5 py-2.5 rounded-2xl text-xs transition-transform hover:-translate-y-0.5 cursor-pointer shadow-sm shadow-orange-100"
                      >
                        <Truck size={14} />
                        <span>{language === 'sw' ? 'Fuatilia' : 'Track'}</span>
                      </Link>
                      <button
                        id={`download-receipt-${order.id}`}
                        type="button"
                        onClick={() => downloadReceipt(order, user)}
                        className="inline-flex items-center space-x-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold px-3.5 py-2.5 rounded-2xl text-xs transition-colors cursor-pointer border border-orange-100/50"
                      >
                        <Download size={14} />
                        <span>{t("Receipt")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
        </>
      ) : profileTab === "seller" ? (
        <SellerStudio user={user} />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-105 dark:border-gray-800 space-y-8 shadow-sm">
          {/* Settings Section Header */}
          <div className="space-y-1.5 border-b border-gray-100 dark:border-gray-800 pb-4">
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 tracking-tight">
              <Settings className="text-orange-600" size={24} />
              {language === "sw" ? "Vipangilio vya Programu" : "App Settings"}
            </h2>
            <p className="text-xs text-gray-405 font-semibold uppercase tracking-wider">
              {language === "sw" ? "Binafsisha mwonekano na utendaji wa SokoPlus" : "Personalize your SokoPlus experience, preferences & aesthetics"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Language Preference Card */}
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center font-bold">
                  <Globe size={20} />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-gray-100 pt-2">
                  {language === "sw" ? "Lugha ya Programu" : "App Language"}
                </h3>
                <p className="text-xs text-gray-400 font-medium">
                  {language === "sw" ? "Chagua lugha unayopendelea kutumia kwenye SokoPlus." : "Choose which language SokoPlus should display."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-4 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    language === "en"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "bg-white dark:bg-gray-800 text-gray-750 dark:text-gray-300 border border-gray-150 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-base mt-0.5">🇬🇧</span>
                  <span>English</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("sw")}
                  className={`px-4 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    language === "sw"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "bg-white dark:bg-gray-800 text-gray-750 dark:text-gray-300 border border-gray-150 dark:border-gray-700 hover:bg-gray-150/50 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-base mt-0.5">🇰🇪</span>
                  <span>Kiswahili</span>
                </button>
              </div>
            </div>

            {/* Dark & Light Theme Preference Card */}
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center font-bold">
                  {theme === "light" ? <Sun size={20} /> : <Moon size={20} />}
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-gray-100 pt-2">
                  {language === "sw" ? "Mandhari ya Mwonekano" : "Appearance Theme"}
                </h3>
                <p className="text-xs text-gray-400 font-medium">
                  {language === "sw" ? "Badilisha kati ya mwangaza au ya usiku." : "Toggle between light and eye-safe deep dark mode."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`px-4 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "bg-white dark:bg-gray-800 text-gray-750 dark:text-gray-300 border border-gray-150 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Sun size={14} />
                  <span>{language === "sw" ? "Mwangaza" : "Light"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`px-4 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "bg-white dark:bg-gray-800 text-gray-750 dark:text-gray-300 border border-gray-150 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Moon size={14} />
                  <span>{language === "sw" ? "Giza" : "Dark"}</span>
                </button>
              </div>
            </div>

            {/* Currency Preference Card */}
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 md:col-span-2 lg:col-span-1">
              <div className="space-y-1">
                <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center font-bold">
                  <Coins size={20} />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-gray-100 pt-2">
                  {language === "sw" ? "Mata ya Bei" : "Display Currency"}
                </h3>
                <p className="text-xs text-gray-400 font-medium">
                  {language === "sw" ? "Chagua sarafu utakayotumia kutazama bei za bidhaa kote sokoni." : "Select the preferred currency for browsing products and pricing."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency("KES")}
                  className={`px-4 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    currency === "KES"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "bg-white dark:bg-gray-800 text-gray-750 dark:text-gray-300 border border-gray-150 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>KES</span>
                  <span>{language === "sw" ? "Shilingi" : "Shilling"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={`px-4 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    currency === "USD"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "bg-white dark:bg-gray-800 text-gray-750 dark:text-gray-300 border border-gray-150 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>USD</span>
                  <span>{language === "sw" ? "Dola" : "Dollar"}</span>
                </button>
              </div>
            </div>

            {/* Two-Factor Authentication (2FA) Card */}
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 md:col-span-2 lg:col-span-1">
              <div className="space-y-1">
                <div className={`w-10 h-10 ${user?.twoFactorEnabled ? "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400" : "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"} rounded-xl flex items-center justify-center font-bold`}>
                  {user?.twoFactorEnabled ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100">
                    {language === "sw" ? "Uthibitishaji wa 2FA" : "Two-Factor Auth (2FA)"}
                  </h3>
                  {user?.twoFactorEnabled ? (
                    <span className="text-[10px] uppercase font-black tracking-wider bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                      {language === "sw" ? "Imewezeshwa" : "Enabled"}
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-black tracking-wider bg-gray-200 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                      {language === "sw" ? "Imezimwa" : "Disabled"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  {language === "sw" 
                    ? "Ongeza ulinzi wa ziada kwenye akaunti yako kwa kuhitaji nambari maalum ya usalama kutoka kwenye simu yako wakati wa kuingia." 
                    : "Add an extra layer of security to your account by requiring a temporary verification code from your Authenticator app during sign-in."}
                </p>
              </div>

              <div>
                {user?.twoFactorEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDisable2FACode("");
                      setShowDisable2FAModal(true);
                    }}
                    className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-100/50 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Shield size={14} />
                    <span>{language === "sw" ? "Zima Ulinzi wa 2FA" : "Disable Two-Factor Auth"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStart2FASetup}
                    className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-orange-600/10 flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck size={14} />
                    <span>{language === "sw" ? "Washa Ulinzi wa 2FA" : "Enable Two-Factor Auth"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl p-8 z-[110] shadow-2xl space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                  <LogOut size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900">{t("Sign Out?")}</h3>
                  <p className="text-gray-500 font-medium">{t("Are you sure you want to sign out of your account?")}</p>
                </div>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <button
                  onClick={() => {
                    auth.signOut();
                    setShowLogoutConfirm(false);
                  }}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg"
                >
                  {t("Yes, Sign Out")}
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-gray-50 text-gray-900 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  {t("Cancel")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Clear Order History Confirmation Modal */}
      <AnimatePresence>
        {showClearModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isClearing) {
                  setShowClearModal(false);
                  setSelectedClearLimit(null);
                }
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl p-8 z-[110] shadow-2xl space-y-6 text-left animate-fade-in"
            >
              {selectedClearLimit === null ? (
                <>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0 border border-red-100">
                      <Trash2 size={24} />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-xl font-black text-gray-900 leading-tight">
                        {language === "sw" ? "Futa Historia ya Agizo" : "Clear Order History"}
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">
                        {language === "sw"
                          ? "Chagua chaguo hapa chini ili kufuta baadhi au maagizo yako yote ya SokoPlus. Kitendo hiki hakiwezi kubatilishwa baada ya kukamilika."
                          : "Choose an option below to clear some or all of your SokoPlus order history. This action cannot be undone."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    {[
                      {
                        limit: 10,
                        title: language === "sw" ? "Hadi Maagizo 10 ya Mwisho" : "Up to Last 10 Orders",
                        desc: language === "sw" ? "Futa maagizo yako 10 ya hivi karibuni au chini ya hapo." : "Delete your 10 most recent orders or fewer.",
                      },
                      {
                        limit: 50,
                        title: language === "sw" ? "Hadi Maagizo 50 ya Mwisho" : "Up to Last 50 Orders",
                        desc: language === "sw" ? "Futa maagizo yako 50 ya hivi karibuni au chini ya hapo." : "Delete your 50 most recent orders or fewer.",
                      },
                      {
                        limit: "all" as const,
                        title: language === "sw" ? "Historia Yote (Wakati Wote)" : "All Time Order History",
                        desc: language === "sw" ? "Anza upya kwa kufuta historia ya maagizo yako yote ya nyuma." : "Wipe clean and clear your entire historical purchase record.",
                      }
                    ].map((option) => (
                      <button
                        key={option.limit}
                        type="button"
                        onClick={() => setSelectedClearLimit(option.limit)}
                        className="w-full text-left p-4 rounded-2xl border border-gray-200 hover:border-red-200 hover:bg-red-50/10 transition-all cursor-pointer disabled:opacity-50 group flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-gray-900 group-hover:text-red-700 transition-colors">
                            {option.title}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                            {option.desc}
                          </p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          {language === "sw" ? "Chagua" : "Select"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowClearModal(false);
                        setSelectedClearLimit(null);
                      }}
                      className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl text-xs cursor-pointer border-none transition-colors"
                    >
                      {language === "sw" ? "Funga" : "Close"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0 border border-rose-100 animate-pulse">
                      <Trash2 size={24} />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-xl font-black text-rose-600 leading-tight">
                        {language === "sw" ? "Thibitisha Ufutaji" : "Confirm Clear Request"}
                      </h3>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                        {selectedClearLimit === "all"
                          ? (language === "sw" ? "HISTORIA YOTE (WAKATI WOTE)" : "ALL TIME ORDER HISTORY")
                          : (language === "sw" ? `HADI MAAGIZO ${selectedClearLimit} YA MWISHO` : `UP TO LAST ${selectedClearLimit} ORDERS`)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-red-50/30 border border-red-100/50 p-4 rounded-2xl space-y-2">
                    <p className="text-xs text-gray-700 font-bold leading-relaxed">
                      {language === "sw"
                        ? "Je, una uhakika unataka kufuta kabisa historia hii ya agizo? Amri hizi zitafutwa milele kutoka kwenye mfumo wa SokoPlus."
                        : "Are you absolutely sure you want to permanently clear these purchase records? Once completed, this action is irreversible."}
                    </p>
                    <p className="text-[10px] text-red-600 font-extrabold uppercase tracking-wide">
                      {language === "sw" ? "KUMBUKA: Kitendo hiki hakiwezi kubatilishwa!" : "WARNING: This action cannot be undone!"}
                    </p>
                  </div>

                  <div className="flex gap-2.5 justify-end pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => setSelectedClearLimit(null)}
                      className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl text-xs cursor-pointer border-none transition-colors"
                    >
                      {language === "sw" ? "Rudi Nyuma" : "Go Back"}
                    </button>
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => clearOrders(selectedClearLimit)}
                      className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-rose-400 text-white font-black rounded-2xl text-xs cursor-pointer border-none transition-all shadow-md shadow-red-600/10"
                    >
                      {isClearing 
                        ? (language === "sw" ? "Inafuta..." : "Clearing...") 
                        : (language === "sw" ? "Ndio, Futa Sasa" : "Yes, Clear Now")}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}

        {/* 2FA Setup Modal */}
        {isConfiguring2FA && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsConfiguring2FA(false);
                setTotpSecret("");
                setTotpCode("");
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-6 rounded-3xl shadow-xl z-[101] space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center shrink-0 border border-orange-100 dark:border-orange-900/30">
                  <QrCode size={24} />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight">
                    {language === "sw" ? "Sanidi Ulinzi wa 2FA" : "Configure Two-Factor Auth"}
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                    {language === "sw" ? "Hatua ya 2 ya Ulinzi" : "Step 2 Account Protection"}
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <p className="leading-relaxed">
                  {language === "sw" 
                    ? "1. Skena msimbo huu wa QR ukitumia programu yako ya uthibitishaji (kama Google Authenticator, Microsoft Authenticator, au Authy)." 
                    : "1. Scan this QR code with your authenticator app (such as Google Authenticator, Microsoft Authenticator, or Authy)."}
                </p>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      `otpauth://totp/SokoPlus:${user?.email || "user"}?secret=${totpSecret}&issuer=SokoPlus`
                    )}`}
                    alt="2FA QR Code"
                    referrerPolicy="no-referrer"
                    className="w-40 h-40 object-contain rounded-lg border border-gray-150 dark:border-gray-850 bg-white"
                  />
                  <span className="text-[10px] text-gray-400 mt-2 font-mono">SokoPlus ({user?.email})</span>
                </div>

                <div className="space-y-2">
                  <p className="leading-relaxed">
                    {language === "sw" 
                      ? "Ikiwa huwezi kuskena, unaweza kuweka siri hii ya usalama kwa mkono kwenye programu yako ya uthibitishaji:" 
                      : "If you cannot scan the QR code, you can manually enter this secret key into your authenticator app:"}
                  </p>
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-xl font-mono text-xs select-all text-gray-800 dark:text-gray-200 justify-between">
                    <span>{totpSecret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        toast.success(language === "sw" ? "Msimbo ulinakiliwa!" : "Secret key copied!");
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-750 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="leading-relaxed">
                    {language === "sw" 
                      ? "2. Baada ya kuongeza akaunti, weka msimbo wa nambari 6 unaoonyeshwa kwenye programu yako ili kuhakiki na kuwezesha:" 
                      : "2. After adding the account, enter the temporary 6-digit verification code shown in your app to verify and activate:"}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Key size={14} />
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                        className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 focus:border-orange-500 rounded-xl text-center text-sm font-black tracking-widest text-gray-800 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfiguring2FA(false);
                    setTotpSecret("");
                    setTotpCode("");
                  }}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-black rounded-2xl text-xs cursor-pointer border-none transition-colors"
                >
                  {language === "sw" ? "Ghairi" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={totpCode.length !== 6 || is2FAVerifying}
                  onClick={handleVerifyAndEnable2FA}
                  className="px-5 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-black rounded-2xl text-xs cursor-pointer border-none transition-all shadow-md shadow-orange-600/10 flex items-center gap-1.5"
                >
                  {is2FAVerifying ? (
                    <span>{language === "sw" ? "Inahakiki..." : "Verifying..."}</span>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>{language === "sw" ? "Hakiki & Wezesha" : "Verify & Enable"}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}

        {/* 2FA Disable Modal */}
        {showDisable2FAModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDisable2FAModal(false);
                setDisable2FACode("");
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-6 rounded-3xl shadow-xl z-[101] space-y-6"
            >
              <div className="flex items-start gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0 border border-red-100 dark:border-red-900/30">
                  <ShieldAlert size={24} />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight">
                    {language === "sw" ? "Zima Ulinzi wa 2FA" : "Disable Two-Factor Auth"}
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                    {language === "sw" ? "Thibitisha Kitendo Hiki" : "Confirm Secure Action"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-red-50/30 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/20 p-4 rounded-2xl">
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-bold leading-relaxed">
                    {language === "sw"
                      ? "Je, una uhakika unataka kuzima ulinzi wa mambo mawili? Kiwango cha usalama wa akaunti yako kitapungua sana, kikirudi tu kwenye nenosiri lako la kawaida."
                      : "Are you absolutely sure you want to disable two-factor authentication? The security level of your account will be reduced back to password-only access."}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 leading-relaxed">
                    {language === "sw" 
                      ? "Ili kuendelea, weka msimbo wa sasa wa nambari 6 kutoka kwenye programu yako ya uthibitishaji:" 
                      : "To proceed, enter the current 6-digit verification code from your authenticator app:"}
                  </p>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Key size={14} />
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={disable2FACode}
                      onChange={(e) => setDisable2FACode(e.target.value.replace(/\D/g, ""))}
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 focus:border-orange-500 rounded-xl text-center text-sm font-black tracking-widest text-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowDisable2FAModal(false);
                    setDisable2FACode("");
                  }}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-black rounded-2xl text-xs cursor-pointer border-none transition-colors"
                >
                  {language === "sw" ? "Ghairi" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={disable2FACode.length !== 6 || is2FAVerifying}
                  onClick={handleDisable2FA}
                  className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-black rounded-2xl text-xs cursor-pointer border-none transition-all shadow-md shadow-red-600/10 flex items-center gap-1.5"
                >
                  {is2FAVerifying ? (
                    <span>{language === "sw" ? "Inapunguza..." : "Disabling..."}</span>
                  ) : (
                    <>
                      <Shield size={14} />
                      <span>{language === "sw" ? "Thibitisha & Zima" : "Confirm & Disable"}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
