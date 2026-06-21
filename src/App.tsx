/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CartProvider } from "./lib/CartContext";
import { CurrencyProvider } from "./lib/CurrencyContext";
import { LanguageProvider } from "./lib/LanguageContext";
import { ThemeProvider } from "./lib/ThemeContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { ProductCompareDrawer } from "./components/ProductCompareDrawer";
import Home from "./pages/Home";
import ProductDetails from "./pages/ProductDetails";
import Wishlist from "./pages/Wishlist";
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
import { onAuthStateChanged } from "firebase/auth";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from "firebase/firestore";
import { UserProfile } from "./types";
import { MessageCircle, ArrowUp, Database, AlertCircle, ExternalLink, ShieldAlert, X } from "lucide-react";
import toast from "react-hot-toast";
import SupportChat from "./components/SupportChat";
import VerificationBanner from "./components/VerificationBanner";
import AnalyticsTracker from "./components/AnalyticsTracker";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { OfflineNotifier } from "./components/OfflineNotifier";
import { NotificationManager } from "./components/NotificationManager";
import { motion, AnimatePresence } from "motion/react";



export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopBg, setScrollTopBg] = useState("rgb(234, 88, 12)"); // Dynamic background color
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);
  const [quotaExceededInfo, setQuotaExceededInfo] = useState<{ error: string; path: string | null } | null>(null);
  const lastScrollYRef = useRef(0);

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

  // Realtime listener for client support unread messages count
  useEffect(() => {
    if (!user?.uid) {
      setUnreadSupportCount(0);
      return;
    }

    const q = query(
      collection(db, "support_tickets"),
      where("userId", "==", user.uid)
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
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || data.email || null,
              phoneNumber: fbUser.phoneNumber || data.phoneNumber || null,
              displayName: fbUser.displayName || data.displayName || "User",
              loyaltyPoints: data.loyaltyPoints || 0,
              wishlist: data.wishlist || [],
              isAdmin,
              emailVerified: fbUser.emailVerified,
              photoURL: data.photoURL || fbUser.photoURL || null
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
              photoURL: fbUser.photoURL || null
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

  return (
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <CartProvider>
            <Router>
              <AnalyticsTracker />
            <div className="min-h-screen flex flex-col font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 selection:bg-orange-100 transition-colors duration-200">
            {quotaExceededInfo && (
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
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
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
                      onClick={() => setQuotaExceededInfo(null)}
                      className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-150 dark:hover:bg-amber-900/50 rounded-lg transition cursor-pointer"
                      title="Dismiss Alert"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {user && !user.emailVerified && <VerificationBanner email={user.email} />}
            <Navbar user={user} />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home user={user} />} />
                <Route path="/product/:id" element={<ProductDetails user={user} />} />
                <Route path="/wishlist" element={<Wishlist user={user} />} />
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
            <div className="fixed bottom-6 right-6 flex flex-col items-end space-y-4 z-[60]">
              <AnimatePresence>
                {showScrollTop && (
                  <motion.button
                    key="back-to-top"
                    initial={{ opacity: 0, scale: 0.8, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 15 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    onClick={scrollToTop}
                    style={{ backgroundColor: scrollTopBg }}
                    className="p-4 rounded-full shadow-2xl border border-white/10 text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center group"
                    title="Back to Top"
                    id="back-to-top-btn"
                  >
                    <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform" />
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
    </ThemeProvider>
  );
}
