import { useEffect, useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, Order } from "../types";
import { User, Mail, Award, Package, ArrowRight, ShoppingBag, Clock, LogOut, Phone, Download, Bell, CheckCircle, Store, Truck, Trash2, Camera, Upload, Settings, Sun, Moon, Globe, Coins } from "lucide-react";
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

interface ProfileProps {
  user: UserProfile | null;
}

export default function Profile({ user }: ProfileProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"this-month" | "last-12-months" | "specific-month">("this-month");
  const [profileTab, setProfileTab] = useState<"orders" | "seller" | "settings">("orders");
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  
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

          q = query(q, orderBy("createdAt", "desc"));
          snap = await getDocs(q);
        } catch (indexError: any) {
          console.warn("[Profile] Date-bounded index not ready, falling back to client-side filtering:", indexError.message);
          // Fallback query (already indexed)
          const fallbackQ = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
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
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setProfileTab("orders")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-black uppercase text-xs tracking-wider transition-all cursor-pointer ${
            profileTab === "orders"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Package size={16} />
          {t("Order History")}
        </button>
        <button
          onClick={() => setProfileTab("seller")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-black uppercase text-xs tracking-wider transition-all cursor-pointer ${
            profileTab === "seller"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Store size={16} />
          {t("Seller Studio")}
        </button>
        <button
          onClick={() => setProfileTab("settings")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-black uppercase text-xs tracking-wider transition-all cursor-pointer ${
            profileTab === "settings"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-gray-400 hover:text-gray-900"
          }`}
        >
          <Settings size={16} />
          {language === "sw" ? "Vipangilio" : "Settings"}
        </button>
      </div>

      {profileTab === "orders" ? (
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
      </AnimatePresence>
    </div>
  );
}
