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
import { MessageCircle, ArrowUp, Database, AlertCircle, ExternalLink, ShieldAlert, X, Key, LogOut, ShieldCheck, Clock, BarChart2, Sparkles } from "lucide-react";
import { verifyTOTP } from "./utils/totp";
import toast from "react-hot-toast";
import SupportChat from "./components/SupportChat";
import VerificationBanner from "./components/VerificationBanner";
import AnalyticsTracker from "./components/AnalyticsTracker";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { OfflineNotifier } from "./components/OfflineNotifier";
import { OfflineSyncQueueBanner } from "./components/OfflineSyncQueueBanner";
import { NotificationManager } from "./components/NotificationManager";
import { CacheWarmerNotifier } from "./components/CacheWarmerNotifier";
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

export interface BackoffOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Executes a Firestore asynchronous operation with exponential backoff and jitter
 * for rate-limiting (429), resource-exhausted (quota), and service unavailable errors.
 */
export async function executeWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 32000;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const errorMsg = err?.message || String(err);
      const isQuotaOrRateLimit =
        errorMsg.toLowerCase().includes("quota") ||
        errorMsg.toLowerCase().includes("resource_exhausted") ||
        errorMsg.toLowerCase().includes("429") ||
        errorMsg.toLowerCase().includes("rate limit") ||
        errorMsg.toLowerCase().includes("unavailable") ||
        err?.code === "resource-exhausted" ||
        err?.code === "unavailable";

      if (!isQuotaOrRateLimit || attempt > maxRetries) {
        throw err;
      }

      const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      const jitter = Math.random() * 0.2 * exponentialDelay;
      const delayMs = Math.min(maxDelayMs, Math.round(exponentialDelay + jitter));

      console.warn(`[App Backoff] Firestore operation rate-limited/quota error. Retrying attempt ${attempt}/${maxRetries} in ${delayMs}ms... Error:`, errorMsg);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
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
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
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
            href="https://console.firebase.google.com/project/ai-studio-8d476022-e7b3-48f3-98d2-317aae594cb7/firestore/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-black px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer uppercase tracking-tight"
            title="Open Firestore Usage Analytics Dashboard to identify high traffic collections & queries"
          >
            <BarChart2 size={14} />
            Usage Analytics
          </a>
          <a
            href="https://console.firebase.google.com/project/ai-studio-8d476022-e7b3-48f3-98d2-317aae594cb7/firestore/databases/ai-studio-8d476022-e7b3-48f3-98d2-317aae594cb7/data?openUpgradeDialog=true"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white text-xs font-black px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer uppercase tracking-tight"
          >
            <ExternalLink size={14} />
            Upgrade / Check Data
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
  const [showChatNotification, setShowChatNotification] = useState(false);
  const [chatNotifDismissed, setChatNotifDismissed] = useState(false);

  // Auto-trigger welcome chat notification after 1.5 seconds on website visit
  useEffect(() => {
    if (chatNotifDismissed || isSupportOpen) return;
    const timer = setTimeout(() => {
      setShowChatNotification(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [chatNotifDismissed, isSupportOpen]);
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

  // Realtime listener for client support unread messages count with Exponential Backoff
  useEffect(() => {
    if (!user?.uid) {
      setUnreadSupportCount(0);
      return;
    }

    let isCancelled = false;
    let unsubscribeFn: (() => void) | null = null;
    let retryTimeoutId: any = null;
    let attempt = 0;

    const connectSupportListener = () => {
      if (isCancelled) return;

      const q = query(
        collection(db, "support_tickets"),
        where("userId", "==", user.uid),
        limit(30)
      );

      unsubscribeFn = onSnapshot(
        q,
        (snapshot) => {
          attempt = 0; // Successful sync: reset exponential backoff attempt count
          let count = 0;
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            count += data.unreadCountClient || 0;
          });
          setUnreadSupportCount(count);
        },
        (error) => {
          if (isCancelled) return;
          attempt++;
          
          const errorMsg = error instanceof Error ? error.message : String(error);
          const isQuotaOrOffline =
            !navigator.onLine ||
            errorMsg.toLowerCase().includes("quota") ||
            errorMsg.toLowerCase().includes("resource_exhausted") ||
            errorMsg.toLowerCase().includes("unavailable") ||
            (error as any)?.code === "resource-exhausted" ||
            (error as any)?.code === "unavailable";

          if (unsubscribeFn) {
            unsubscribeFn();
            unsubscribeFn = null;
          }

          // If quota limit or offline status detected, pause polling until online/sync event
          if (isQuotaOrOffline) {
            console.warn(`[App Support Listener] Quota limit or offline status detected. Pausing automatic polling until network status changes or manual refresh.`);
            return;
          }

          const delayMs = Math.min(60000, Math.round(1500 * Math.pow(2, attempt - 1) + Math.random() * 500));
          console.warn(`[App Support Listener] Connection retry (attempt ${attempt}). Exponential backoff retry in ${delayMs}ms:`, error);

          retryTimeoutId = setTimeout(() => {
            if (!isCancelled) {
              connectSupportListener();
            }
          }, delayMs);
        }
      );
    };

    const handleSyncReset = () => {
      attempt = 0;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (unsubscribeFn) unsubscribeFn();
      connectSupportListener();
    };

    window.addEventListener("online", handleSyncReset);
    window.addEventListener("network-sync", handleSyncReset);

    connectSupportListener();

    return () => {
      isCancelled = true;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (unsubscribeFn) unsubscribeFn();
      window.removeEventListener("online", handleSyncReset);
      window.removeEventListener("network-sync", handleSyncReset);
    };
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
    const handleOpenSupport = () => {
      setIsSupportOpen(true);
      setShowChatNotification(false);
      setChatNotifDismissed(true);
    };
    window.addEventListener("open-support-chat", handleOpenSupport);
    return () => {
      window.removeEventListener("open-support-chat", handleOpenSupport);
    };
  }, []);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let userSubCancelled = false;
    let userSubRetryTimeout: any = null;
    let userSubAttempt = 0;
    let handleUserSyncReset: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Unsubscribe from previous user listener if exists
        if (unsubscribeUser) {
          unsubscribeUser();
          unsubscribeUser = null;
        }

        // Claim any guest orders linked to this session token or email with error tolerance
        if (fbUser.email) {
          claimGuestOrdersForUser(fbUser.uid, fbUser.email).catch((err) => {
            console.warn("[App] Auto-claim guest orders notice:", err);
          });
        }

        // Perform the admin check with exponential backoff
        let isAdmin = false;
        try {
          if (
            fbUser.uid === "qdeDtBfWIKNgWVjoUWHR3W3L7oa2" ||
            (fbUser.email && fbUser.email.toLowerCase() === "upfrontretaile@gmail.com")
          ) {
            isAdmin = true;
          } else {
            const adminDoc = await executeWithExponentialBackoff(() => getDoc(doc(db, "admins", fbUser.uid)), { maxRetries: 3 });
            isAdmin = adminDoc.exists();
          }

          // Auto-promote if not yet set up as admin but invited
          if (!isAdmin && fbUser.email) {
            const inviteDocId = fbUser.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
            const inviteRef = doc(db, "admin_invitations", inviteDocId);
            const inviteSnap = await executeWithExponentialBackoff(() => getDoc(inviteRef), { maxRetries: 3 });

            if (inviteSnap.exists()) {
              const inviteData = inviteSnap.data();
              if (inviteData && inviteData.status === "pending") {
                const adminRef = doc(db, "admins", fbUser.uid);
                await executeWithExponentialBackoff(() => setDoc(adminRef, {
                  email: fbUser.email!.toLowerCase(),
                  roleId: inviteData.roleId || "custom",
                  roleName: inviteData.roleName || "Custom Profile",
                  permissions: inviteData.permissions || [],
                  updatedAt: new Date().toISOString(),
                  updatedBy: inviteData.invitedBy || "Pre-authorized Invitation"
                }, { merge: true }), { maxRetries: 3 });

                await executeWithExponentialBackoff(() => setDoc(inviteRef, { status: "accepted" }, { merge: true }), { maxRetries: 3 });
                isAdmin = true;
                console.log(`[App] Auto-promoted preauthorized admin email: ${fbUser.email}`);
              }
            }
          }
        } catch (e) {
          console.warn("Admin check notice:", e);
        }

        // Listen to user document for real-time updates with Exponential Backoff re-subscription
        userSubCancelled = false;
        userSubAttempt = 0;

        const connectUserDocListener = () => {
          if (userSubCancelled) return;

          const userRef = doc(db, "users", fbUser.uid);
          unsubscribeUser = onSnapshot(
            userRef,
            (docSnap) => {
              userSubAttempt = 0; // Reset backoff attempt counter on success
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.deliveryCountry) localStorage.setItem("sokoplus_delivery_country", data.deliveryCountry);
                if (data.deliveryCounty) localStorage.setItem("sokoplus_delivery_county", data.deliveryCounty);
                if (data.deliveryCity) localStorage.setItem("sokoplus_delivery_city", data.deliveryCity);

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
            },
            (error) => {
              if (userSubCancelled) return;
              userSubAttempt++;

              const errorMsg = error instanceof Error ? error.message : String(error);
              const isQuota =
                errorMsg.toLowerCase().includes("quota") ||
                errorMsg.toLowerCase().includes("resource_exhausted") ||
                errorMsg.toLowerCase().includes("429") ||
                errorMsg.toLowerCase().includes("unavailable") ||
                (error as any)?.code === "resource-exhausted" ||
                (error as any)?.code === "unavailable";

              // Calculate exponential backoff delay with jitter (1.5s, 3s, 6s... up to 60s max)
              const delayMs = Math.min(60000, Math.round(1500 * Math.pow(2, userSubAttempt - 1) + Math.random() * 500));

              console.warn(`[App User Listener] Firestore rate-limited or quota error (attempt ${userSubAttempt}). Retrying sync via exponential backoff in ${delayMs}ms... Error:`, errorMsg);

              if (isQuota && typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("firestore-quota-exceeded", {
                    detail: { error: errorMsg, path: `users/${fbUser.uid}` }
                  })
                );
              }

              // Fallback user state so UI continues to function cleanly offline
              setUser((prevUser) => prevUser || {
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
              setLoading(false);

              if (unsubscribeUser) {
                unsubscribeUser();
                unsubscribeUser = null;
              }

              if (isQuota || !navigator.onLine) {
                console.warn(`[App User Listener] Quota limit or offline status detected. Pausing automatic background retries until network status changes or manual sync.`);
                return;
              }

              // Exponential backoff reconnect for transient glitches
              userSubRetryTimeout = setTimeout(() => {
                if (!userSubCancelled) {
                  connectUserDocListener();
                }
              }, delayMs);
            }
          );
        };

        handleUserSyncReset = () => {
          userSubAttempt = 0;
          if (userSubRetryTimeout) clearTimeout(userSubRetryTimeout);
          if (unsubscribeUser) {
            unsubscribeUser();
            unsubscribeUser = null;
          }
          if (!userSubCancelled) {
            connectUserDocListener();
          }
        };

        window.addEventListener("online", handleUserSyncReset);
        window.addEventListener("network-sync", handleUserSyncReset);

        connectUserDocListener();
      } else {
        userSubCancelled = true;
        if (userSubRetryTimeout) clearTimeout(userSubRetryTimeout);
        if (unsubscribeUser) {
          unsubscribeUser();
          unsubscribeUser = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      userSubCancelled = true;
      if (userSubRetryTimeout) clearTimeout(userSubRetryTimeout);
      if (handleUserSyncReset) {
        window.removeEventListener("online", handleUserSyncReset);
        window.removeEventListener("network-sync", handleUserSyncReset);
      }
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // Safety fallback: ensure loading screen dismisses after maximum 2.5 seconds even if network is stalled
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(safetyTimeout);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 font-sans gap-3">
        <div className="w-10 h-10 border-3 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 animate-pulse">Loading Sokoplus...</p>
      </div>
    );
  }

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
              <OfflineSyncQueueBanner />
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
                  id="support-chat-trigger"
                  className={`p-4 rounded-full shadow-2xl transition-all group flex items-center cursor-pointer relative ${isSupportOpen ? 'bg-orange-600 text-white rotate-90 scale-110' : 'bg-gray-900 text-white hover:bg-orange-600'}`}
                  onClick={() => {
                    const nextOpen = !isSupportOpen;
                    setIsSupportOpen(nextOpen);
                    if (nextOpen) {
                      setShowChatNotification(false);
                      setChatNotifDismissed(true);
                    }
                  }}
                >
                  <MessageCircle size={24} />
                  {!isSupportOpen && (
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                      Help & Support
                    </span>
                  )}
                  {!isSupportOpen && (showChatNotification || unreadSupportCount > 0) && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 animate-bounce shadow">
                      {showChatNotification ? 1 : unreadSupportCount}
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
              <CacheWarmerNotifier />
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
