/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CartProvider } from "./lib/CartContext";
import { CurrencyProvider } from "./lib/CurrencyContext";
import { LanguageProvider } from "./lib/LanguageContext";
import { ThemeProvider } from "./lib/ThemeContext";
import { SellerStudioProvider } from "./lib/SellerStudioContext";
import Navbar from "./components/Navbar";
import BottomNavigation from "./components/BottomNavigation";
import Footer from "./components/Footer";
import AudioPlayer from "./components/AudioPlayer";
import { ProductCompareDrawer } from "./components/ProductCompareDrawer";
import Home from "./pages/Home";
import ProductDetails from "./pages/ProductDetails";
import Wishlist from "./pages/Wishlist";
import SharedWishlist from "./pages/SharedWishlist";
import Profile from "./pages/Profile";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Admin from "./pages/Admin";
import Blog from "./pages/Blog";
import Login from "./pages/Login";
import PaymentSuccess from "./pages/PaymentSuccess";
import TrackOrder from "./pages/TrackOrder";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Cookies from "./pages/Cookies";
import FAQ from "./pages/FAQ";
import ReturnPolicy from "./pages/ReturnPolicy";
import Shipping from "./pages/Shipping";
import Careers from "./pages/Careers";
import { useEffect, useState, useRef } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, limit } from "firebase/firestore";
import { useSettings } from "./lib/SettingsContext";
import { UserProfile } from "./types";
import { MessageCircle, ArrowUp, Database, AlertCircle, ExternalLink, ShieldAlert, X, Key, LogOut, ShieldCheck, Clock } from "lucide-react";
import { verifyTOTP } from "./utils/totp";
import toast from "react-hot-toast";
import SupportChat from "./components/SupportChat";
import VerificationBanner from "./components/VerificationBanner";
import AnalyticsTracker from "./components/AnalyticsTracker";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { OfflineNotifier } from "./components/OfflineNotifier";
import { NotificationManager } from "./components/NotificationManager";
import { motion, AnimatePresence } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { claimGuestOrdersForUser } from "./utils/guestSession";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache stale duration
      gcTime: 1000 * 60 * 15,    // 15 minutes garbage collection duration
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface QuotaBannerWrapperProps {
  quotaExceededInfo: { error: string; path: string | null } | null;
  onClear: () => void;
}

function QuotaBannerWrapper({ quotaExceededInfo, onClear }: QuotaBannerWrapperProps) {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin");
  const [secondsLeft, setSecondsLeft] = useState(7);
  const [keepShowing, setKeepShowing] = useState(false);

  // Reset local state when a new quota exceeded warning is triggered
  useEffect(() => {
    if (quotaExceededInfo) {
      setSecondsLeft(7);
      setKeepShowing(false);
    }
  }, [quotaExceededInfo]);

  // Handle the auto-dismiss timer countdown
  useEffect(() => {
    if (!quotaExceededInfo || keepShowing) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quotaExceededInfo, keepShowing]);

  // Cleanly trigger onClear side-effect in a separate useEffect once countdown hits 0
  useEffect(() => {
    if (quotaExceededInfo && !keepShowing && secondsLeft === 0) {
      onClear();
    }
  }, [secondsLeft, quotaExceededInfo, keepShowing, onClear]);

  if (!quotaExceededInfo || !isAdminPath) return null;

  const getLastSyncDisplay = () => {
    const stored = localStorage.getItem("sokoplus_last_sync_time") || localStorage.getItem("sokoplus_last_successful_sync");
    if (stored) {
      try {
        const d = new Date(stored);
        if (!isNaN(d.getTime())) {
          return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} on ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      } catch (err) {
        console.error("Failed to parse sync timestamp:", err);
      }
    }
    const fallback = new Date();
    return `${fallback.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} on ${fallback.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div id="firestore-quota-warning-banner" className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 px-4 py-3 select-none">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-3 items-start">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
            <Database size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              Firestore Free-Tier Quota Limit Reached
              <span className="text-[10px] uppercase font-black tracking-wider bg-amber-200 dark:bg-amber-900 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-200">
                Offline Cache Active
              </span>
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
              The Firestore daily free-tier read quota metric for this project has been fully exhausted because of high usage. 
              SokoPlus is operating seamlessly via local database queries and IndexedDB offline cache fallbacks.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100/90 dark:bg-amber-900/50 border border-amber-300/60 dark:border-amber-800/80 text-xs font-semibold text-amber-950 dark:text-amber-200">
              <Clock size={13} className="text-amber-700 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Last successful sync:</strong> {getLastSyncDisplay()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
          {!keepShowing && (
            <button
              onClick={() => setKeepShowing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs font-black rounded-lg transition cursor-pointer active:scale-95 uppercase tracking-tight"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
              </span>
              Keep showing ({secondsLeft}s)
            </button>
          )}
          <a
            href="https://console.firebase.google.com/project/gen-lang-client-0489491426/firestore/databases/ai-studio-8d476022-e7b3-48f3-98d2-317aae594cb7/data?openUpgradeDialog=true"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white text-xs font-black px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer uppercase tracking-tight"
          >
            <ExternalLink size={14} />
            Upgrade/Check Database
          </a>
          <button
            onClick={onClear}
            className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-150 dark:hover:bg-amber-900/50 rounded-lg transition cursor-pointer"
            title="Dismiss Alert"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopBg, setScrollTopBg] = useState("rgb(234, 88, 12)"); // Dynamic background color
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);
  const [quotaExceededInfo, setQuotaExceededInfo] = useState<{ error: string; path: string | null } | null>(null);
  const { settings } = useSettings();
  const showAudioBubble = settings.showAudioBubble;
  const lastScrollYRef = useRef(0);

  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [is2FAVerifying, setIs2FAVerifying] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.twoFactorEnabled) {
        const verified = sessionStorage.getItem("sokoplus_2fa_verified_" + user.uid) === "true";
        setIs2FAVerified(verified);
      } else {
        setIs2FAVerified(true);
      }
    } else {
      setIs2FAVerified(false);
    }
    setTwoFactorCode("");
  }, [user]);

  const handleVerifyGlobal2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !user.twoFactorSecret) return;
    setIs2FAVerifying(true);
    try {
      const isValid = await verifyTOTP(user.twoFactorSecret, twoFactorCode);
      if (isValid) {
        sessionStorage.setItem("sokoplus_2fa_verified_" + user.uid, "true");
        setIs2FAVerified(true);
        toast.success("Security verification successful! Welcome back.");
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
    } catch (err) {
      console.error("2FA global verification failed:", err);
      toast.error("Verification error occurred. Please try again.");
    } finally {
      setIs2FAVerifying(false);
    }
  };

  const handleGlobalLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully.");
    } catch (err) {
      console.error("Logout failed:", err);
      toast.error("Failed to sign out.");
    }
  };

  // Monitor inactive user sessions globally to securely log them out after a period of idle status
  useInactivityLogout(user);

  // Firestore Quota Exceeded Global Trap
  useEffect(() => {
    const handleQuotaExceeded = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setQuotaExceededInfo({
          error: customEvent.detail.error,
          path: customEvent.detail.path || null,
        });
      }
    };
    window.addEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    return () => {
      window.removeEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    };
  }, []);

  // Event handler for optimistic user state modifications (e.g., instant wishlist count, etc.)
  useEffect(() => {
    const handleOptimisticUserUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setUser((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            ...customEvent.detail,
          };
        });
      }
    };
    window.addEventListener("optimistic-user-update", handleOptimisticUserUpdate);
    return () => {
      window.removeEventListener("optimistic-user-update", handleOptimisticUserUpdate);
    };
  }, []);

  // Realtime listener for client support unread messages count
  useEffect(() => {
    if (!user?.uid) {
      setUnreadSupportCount(0);
      return;
    }

    const q = query(
      collection(db, "support_tickets"),
      where("userId", "==", user.uid),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        count += data.unreadCountClient || 0;
      });
      setUnreadSupportCount(count);
    }, (error) => {
      console.warn("Failed to listen to support tickets unread counts:", error);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isBelowThreshold = currentScrollY > 600;
      const isScrollingUp = currentScrollY < lastScrollYRef.current;

      if (isBelowThreshold) {
        if (isScrollingUp) {
          setShowScrollTop(true);
        } else {
          // Hide when scrolling down
          setShowScrollTop(false);
        }

        // Dynamically compute the color transition based on proximity to threshold/top
        const minScroll = 600;
        const maxScroll = 1200;
        const scrollVal = Math.min(maxScroll, Math.max(minScroll, currentScrollY));
        const ratio = (scrollVal - minScroll) / (maxScroll - minScroll); // 0 at 600, 1 at 1200+
        
        // Interpolate between Gray (75, 85, 99) and Orange (234, 88, 12)
        const r = Math.round(75 + (234 - 75) * ratio);
        const g = Math.round(85 + (88 - 85) * ratio);
        const b = Math.round(99 + (12 - 99) * ratio);
        setScrollTopBg(`rgb(${r}, ${g}, ${b})`);
      } else {
        // Below threshold, always hide
        setShowScrollTop(false);
      }

      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handleOpenSupport = () => setIsSupportOpen(true);
    window.addEventListener("open-support-chat", handleOpenSupport);
    return () => {
      window.removeEventListener("open-support-chat", handleOpenSupport);
    };
  }, []);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Unsubscribe from previous user if exists
        if (unsubscribeUser) unsubscribeUser();

        // Claim any guest orders linked to this session token or email
        if (fbUser.email) {
          claimGuestOrdersForUser(fbUser.uid, fbUser.email).catch((err) => {
            console.warn("[App] Failed to auto-claim guest orders:", err);
          });
        }

        // Perform the admin check once on authentication change, rather than inside every snapshot update trigger
        let isAdmin = false;
        try {
          if (
            fbUser.uid === "qdeDtBfWIKNgWVjoUWHR3W3L7oa2" ||
            (fbUser.email && fbUser.email.toLowerCase() === "upfrontretaile@gmail.com")
          ) {
            isAdmin = true;
          } else {
            const adminDoc = await getDoc(doc(db, "admins", fbUser.uid));
            isAdmin = adminDoc.exists();
          }

          // Auto-promote if not yet set up as admin but invited
          if (!isAdmin && fbUser.email) {
            const inviteDocId = fbUser.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
            const inviteRef = doc(db, "admin_invitations", inviteDocId);
            const inviteSnap = await getDoc(inviteRef);

            if (inviteSnap.exists()) {
              const inviteData = inviteSnap.data();
              if (inviteData && inviteData.status === "pending") {
                const adminRef = doc(db, "admins", fbUser.uid);
                await setDoc(adminRef, {
                  email: fbUser.email.toLowerCase(),
                  roleId: inviteData.roleId || "custom",
                  roleName: inviteData.roleName || "Custom Profile",
                  permissions: inviteData.permissions || [],
                  updatedAt: new Date().toISOString(),
                  updatedBy: inviteData.invitedBy || "Pre-authorized Invitation"
                }, { merge: true });

                await setDoc(inviteRef, { status: "accepted" }, { merge: true });
                isAdmin = true;
                console.log(`[App] Auto-promoted preauthorized admin email: ${fbUser.email}`);
              }
            }
          }
        } catch (e) {
          console.warn("Admin check failed:", e);
        }

        // Listen to user document for real-time updates (like wishlist)
        const userRef = doc(db, "users", fbUser.uid);
        unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.deliveryCountry) {
              localStorage.setItem("sokoplus_delivery_country", data.deliveryCountry);
            }
            if (data.deliveryCounty) {
              localStorage.setItem("sokoplus_delivery_county", data.deliveryCounty);
            }
            if (data.deliveryCity) {
              localStorage.setItem("sokoplus_delivery_city", data.deliveryCity);
            }

            setUser({
              uid: fbUser.uid,
              email: fbUser.email || data.email || null,
              phoneNumber: fbUser.phoneNumber || data.phoneNumber || null,
              displayName: fbUser.displayName || data.displayName || "User",
              loyaltyPoints: data.loyaltyPoints || 0,
              wishlist: data.wishlist || [],
              isAdmin,
              emailVerified: fbUser.emailVerified,
              photoURL: data.photoURL || fbUser.photoURL || null,
              twoFactorEnabled: data.twoFactorEnabled || false,
              twoFactorSecret: data.twoFactorSecret || null,
              deliveryCountry: data.deliveryCountry || undefined,
              deliveryCounty: data.deliveryCounty || undefined,
              deliveryCity: data.deliveryCity || undefined,
              deliveryAddress: data.deliveryAddress || undefined,
              vouchers: (data.vouchers || []).filter((v: any) => {
                if (!v.unlockedAt) return true;
                const unlockedTime = new Date(v.unlockedAt).getTime();
                if (isNaN(unlockedTime)) return true;
                const diffTime = new Date().getTime() - unlockedTime;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return diffDays <= 21;
              })
            });
          } else {
            // Document might not exist yet if just signed up, wait for Login page to create it
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || null,
              phoneNumber: fbUser.phoneNumber || null,
              displayName: fbUser.displayName || "User",
              loyaltyPoints: 0,
              wishlist: [],
              isAdmin,
              emailVerified: fbUser.emailVerified,
              photoURL: fbUser.photoURL || null,
              vouchers: []
            });
          }
          setLoading(false);
        }, (error) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const isQuota = errorMsg.toLowerCase().includes("quota");
          if (isQuota) {
            console.warn("User doc listener quota limit warning:", errorMsg);
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("firestore-quota-exceeded", {
                  detail: { error: errorMsg, path: `users/${fbUser.uid}` }
                })
              );
            }
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || null,
              phoneNumber: fbUser.phoneNumber || null,
              displayName: fbUser.displayName || "User",
              loyaltyPoints: 100,
              wishlist: [],
              isAdmin: fbUser.uid === "qdeDtBfWIKNgWVjoUWHR3W3L7oa2" || fbUser.email?.toLowerCase() === "upfrontretaile@gmail.com",
              emailVerified: fbUser.emailVerified,
              photoURL: fbUser.photoURL || null
            });
          } else {
            console.error("User doc listener error:", error);
          }
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) unsubscribeUser();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center font-sans">Loading Soplus...</div>;

  if (user && user.twoFactorEnabled && !is2FAVerified) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-gray-950 px-4 py-12 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 p-8 md:p-10 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-850 relative overflow-hidden text-center space-y-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-950/10 rounded-full -mr-16 -mt-16 opacity-50" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-50 dark:bg-orange-950/10 rounded-full -ml-12 -mb-12 opacity-50" />

            <div className="flex justify-center">
              <div className="w-16 h-16 bg-[#E14D2A] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/10 animate-bounce">
                <ShieldCheck className="text-white" size={32} />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">Two-Factor Verification</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Secure Portal Access</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                This account is protected with Two-Factor Authentication (2FA). Please enter the 6-digit verification code from your authenticator app to proceed.
              </p>
            </div>

            <form onSubmit={handleVerifyGlobal2FA} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Key size={18} />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 focus:border-orange-500 rounded-2xl text-center text-lg font-black tracking-widest text-gray-850 dark:text-gray-100 placeholder-gray-300 animate-pulse"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleGlobalLogout}
                  className="flex-1 px-5 py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
                <button
                  type="submit"
                  disabled={twoFactorCode.length !== 6 || is2FAVerifying}
                  className="flex-1 px-5 py-3.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-black rounded-2xl text-xs transition-all shadow-md shadow-orange-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {is2FAVerifying ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Verify Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          <Toaster position="bottom-right" />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SellerStudioProvider>
          <LanguageProvider>
            <CurrencyProvider>
              <CartProvider>
              <Router>
                <AnalyticsTracker />
              <div className="min-h-screen flex flex-col font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 selection:bg-orange-100 transition-colors duration-200">
              <QuotaBannerWrapper
                quotaExceededInfo={quotaExceededInfo}
                onClear={() => setQuotaExceededInfo(null)}
              />
              {user && !user.emailVerified && <VerificationBanner email={user.email} />}
              <Navbar user={user} />
              <BottomNavigation user={user} />
              <main className="flex-grow pb-20 md:pb-0">
                <Routes>
                  <Route path="/" element={<Home user={user} />} />
                  <Route path="/product/:id" element={<ProductDetails user={user} />} />
                  <Route path="/wishlist" element={<Wishlist user={user} />} />
                  <Route path="/wishlist/shared/:shareId" element={<SharedWishlist />} />
                  <Route path="/profile" element={<Profile user={user} />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout user={user} />} />
                  <Route path="/admin/*" element={<Admin user={user} />} />
                  <Route path="/blog" element={<Blog user={user} />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/track-order/:id" element={<TrackOrder />} />
                  <Route path="/track-order" element={<TrackOrder />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/cookies" element={<Cookies />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/returns" element={<ReturnPolicy />} />
                  <Route path="/shipping" element={<Shipping />} />
                  <Route path="/careers" element={<Careers user={user} />} />
                </Routes>
              </main>
              <Footer />
              <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 flex flex-col items-end space-y-4 z-[60]">
                <AnimatePresence>
                  {showScrollTop && (
                    <motion.button
                      key="back-to-top"
                      initial={{ opacity: 0, scale: 0.4, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.4, y: 20 }}
                      whileHover={{ scale: 1.1, y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.25)" }}
                      whileTap={{ scale: 0.92, y: 0 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 22
                      }}
                      onClick={scrollToTop}
                      style={{ backgroundColor: scrollTopBg }}
                      className="p-4 rounded-full shadow-2xl border border-white/10 text-white hover:brightness-110 transition-all duration-300 ease-in-out cursor-pointer flex items-center justify-center group"
                      title="Back to Top"
                      id="back-to-top-btn"
                    >
                      <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform duration-300" />
                    </motion.button>
                  )}
                </AnimatePresence>

                <button 
                  id="unified-support-trigger-btn"
                  className={`p-4 rounded-full shadow-2xl transition-all group flex items-center cursor-pointer relative ${isSupportOpen ? 'bg-orange-600 text-white rotate-90 scale-110' : 'bg-gray-900 text-white hover:bg-orange-600'}`}
                  onClick={() => setIsSupportOpen(!isSupportOpen)}
                >
                  <MessageCircle size={24} />
                  {!isSupportOpen && (
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                      Help & Support
                    </span>
                  )}
                  {!isSupportOpen && unreadSupportCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-white animate-bounce shadow">
                      {unreadSupportCount}
                    </span>
                  )}
                </button>
              </div>

              <SupportChat user={user} isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
              {showAudioBubble && <AudioPlayer />}
              <CookieConsentBanner />
              <ProductCompareDrawer />
              <OfflineNotifier />
              <NotificationManager user={user} />
              <Toaster position="bottom-right" />
              </div>
            </Router>
          </CartProvider>
          </CurrencyProvider>
        </LanguageProvider>
        </SellerStudioProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
