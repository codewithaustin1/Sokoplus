/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CartProvider } from "./lib/CartContext";
import { CurrencyProvider } from "./lib/CurrencyContext";
import { LanguageProvider } from "./lib/LanguageContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
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
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Cookies from "./pages/Cookies";
import FAQ from "./pages/FAQ";
import ReturnPolicy from "./pages/ReturnPolicy";
import Shipping from "./pages/Shipping";
import { useEffect, useState, useRef } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { UserProfile } from "./types";
import { MessageCircle, ArrowUp } from "lucide-react";
import toast from "react-hot-toast";
import SupportChat from "./components/SupportChat";
import VerificationBanner from "./components/VerificationBanner";
import AnalyticsTracker from "./components/AnalyticsTracker";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { OfflineNotifier } from "./components/OfflineNotifier";
import { NotificationManager } from "./components/NotificationManager";
import { motion, AnimatePresence } from "motion/react";

/**
 * Synthesizes a subtle, high-quality browser-native acoustic "tok" sound
 * simulating a physical hollow woodblock percussive tap using Web Audio API.
 */
function playTok(type: "appear" | "disappear") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Frequencies: slightly higher pitched tight 'tok' for appear, lower hollower for disappear
    const baseFreq = type === "appear" ? 340 : 240;
    const clickDuration = 0.012;
    const toneDuration = 0.10;

    // Principal acoustic gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.001); // snappy physical impulse
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + toneDuration);

    // Primary clean resonance (sine) - simulates the hollow cavity
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(baseFreq, now);
    // Slight pitch drop over duration to mimic genuine physical percussion impact
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + toneDuration);

    // Secondary wooden harmonic (triangle) - provides the warm wood acoustic timbre
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now); // perfect fifth harmonic
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.5 * 0.85, now + toneDuration * 0.6);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.08, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + toneDuration * 0.5);

    // Snappy strike click transient (noise burst) for the contact mallet feel
    const bufferSize = ctx.sampleRate * clickDuration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1100; // woody resonant midrange
    noiseFilter.Q.value = 4.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + clickDuration);

    // Connect audio node matrix
    osc1.connect(gainNode);
    osc2.connect(harmonicGain);
    harmonicGain.connect(gainNode);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    gainNode.connect(ctx.destination);

    // Dispatch physical sound trigger
    osc1.start(now);
    osc2.start(now);
    noiseSource.start(now);

    osc1.stop(now + toneDuration + 0.05);
    osc2.stop(now + toneDuration + 0.05);
    noiseSource.stop(now + clickDuration + 0.05);

    // Prevent memory leaks / close inactive AudioContexts
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, (toneDuration + 0.15) * 1000);
  } catch (error) {
    // Fail silently to safeguard page lifecycle
    console.debug("Acoustic tok play skipped:", error);
  }
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopBg, setScrollTopBg] = useState("rgb(234, 88, 12)"); // Dynamic background color
  const isFirstMount = useRef(true);
  const lastScrollYRef = useRef(0);

  // Trigger browser-native acoustic tok sound when back-to-top appears / disappears
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    playTok(showScrollTop ? "appear" : "disappear");
  }, [showScrollTop]);

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
          const adminDoc = await getDoc(doc(db, "admins", fbUser.uid));
          isAdmin = adminDoc.exists();
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
              emailVerified: fbUser.emailVerified
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
              emailVerified: fbUser.emailVerified
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("User doc listener error:", error);
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
    <LanguageProvider>
      <CurrencyProvider>
        <CartProvider>
          <Router>
            <AnalyticsTracker />
          <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-gray-900 selection:bg-orange-100">
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
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/returns" element={<ReturnPolicy />} />
                <Route path="/shipping" element={<Shipping />} />
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
                className={`p-4 rounded-full shadow-2xl transition-all group flex items-center cursor-pointer ${isSupportOpen ? 'bg-orange-600 text-white rotate-90 scale-110' : 'bg-gray-900 text-white hover:bg-orange-600'}`}
                onClick={() => setIsSupportOpen(!isSupportOpen)}
              >
                <MessageCircle size={24} />
                {!isSupportOpen && (
                  <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                    Help & Support
                  </span>
                )}
              </button>
            </div>

            <SupportChat user={user} isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
            <CookieConsentBanner />
            <OfflineNotifier />
            <NotificationManager user={user} />
            <Toaster position="bottom-right" />
          </div>
        </Router>
      </CartProvider>
      </CurrencyProvider>
    </LanguageProvider>
  );
}
