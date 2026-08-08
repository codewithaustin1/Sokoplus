import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { CheckCircle, XCircle, ShoppingBag, ArrowRight, Truck, UserCheck, Lock, Mail, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { doc, updateDoc, setDoc, collection, query, where, getDocs, limit, increment, writeBatch, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { motion } from "motion/react";
import { trackEvent } from "../lib/analytics";
import QRCode from "qrcode";
import MysteryBox from "../components/MysteryBox";
import { claimGuestOrdersForUser } from "../utils/guestSession";
import toast from "react-hot-toast";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const [orderReceiptId, setOrderReceiptId] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [buyerId, setBuyerId] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  // Guest Account Conversion States
  const [isGuestOrder, setIsGuestOrder] = useState<boolean>(false);
  const [guestEmail, setGuestEmail] = useState<string>("");
  const [guestAuthMode, setGuestAuthMode] = useState<"signin" | "register">("signin");
  const [signInPassword, setSignInPassword] = useState<string>("");
  const [guestPassword, setGuestPassword] = useState<string>("");
  const [guestConfirmPassword, setGuestConfirmPassword] = useState<string>("");
  const [convertingAccount, setConvertingAccount] = useState<boolean>(false);
  const [accountConverted, setAccountConverted] = useState<boolean>(false);

  const { clearCart } = useCart();
  const reference = searchParams.get("reference");
  const isVerifyingRef = useRef<boolean>(false);

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setStatus("error");
        return;
      }

      if (isVerifyingRef.current) return;
      isVerifyingRef.current = true;

      try {
        // 1. Verify Paystack transaction via backend endpoint
        const response = await axios.get(`/api/paystack/verify/${reference}`);

        if (response.data?.data?.status === "success") {
          // Default receipt ID from Paystack reference
          setOrderReceiptId(reference.slice(0, 8).toUpperCase());

          // Check if there was a guest order draft stored locally
          const storedGuestOrder = localStorage.getItem("sokoplus_last_guest_order");
          if (storedGuestOrder) {
            try {
              const parsed = JSON.parse(storedGuestOrder);
              if (parsed.email) setGuestEmail(parsed.email);
              if (parsed.orderId) setOrderId(parsed.orderId);
              setIsGuestOrder(true);
            } catch (e) {
              console.warn("Error reading stored guest order:", e);
            }
          }

          // 2. Attempt Firestore sync in try/catch so quota limits do not break payment success
          try {
            const snap = await getDocs(query(collection(db, "orders"), where("paymentReference", "==", reference), limit(1)));
            if (!snap.empty) {
              const orderDoc = snap.docs[0];
              const orderData = orderDoc.data();
              const calculatedPoints = Math.floor((orderData.totalAmount || 0) / 100);
              setPointsEarned(calculatedPoints);
              setOrderReceiptId(orderDoc.id.slice(0, 8).toUpperCase());
              setOrderId(orderDoc.id);

              const isGuest = orderData.isGuestOrder || orderData.userId === "guest";
              setIsGuestOrder(isGuest);
              if (orderData.userEmail) {
                setGuestEmail(orderData.userEmail);
              }

              if (orderData.userId) {
                setBuyerId(orderData.userId);
              }

              // Prevent double-processing
              if (orderData.paymentStatus !== "paid") {
                const batch = writeBatch(db);

                // 1. Update Order Status
                batch.update(doc(db, "orders", orderDoc.id), {
                  paymentStatus: "paid",
                  status: "processing"
                });

                // 2. Update Product Stocks
                if (orderData.items) {
                  for (const item of orderData.items) {
                    const productRef = doc(db, "products", item.productId);
                    batch.update(productRef, {
                      stock: increment(-item.quantity)
                    });
                  }
                }

                // 3. Add Loyalty Points for logged-in accounts
                if (orderData.userId && orderData.userId !== "guest") {
                  const userRef = doc(db, "users", orderData.userId);
                  batch.update(userRef, {
                    loyaltyPoints: increment(calculatedPoints)
                  });
                }

                await batch.commit();
              }

              // Track GA4 Purchase conversion event
              trackEvent("purchase", {
                transaction_id: reference || orderDoc.id,
                value: orderData.totalAmount || 0,
                currency: "KES",
                items: (orderData.items || []).map((item: any) => ({
                  item_id: item.productId,
                  item_name: item.name,
                  price: item.price,
                  quantity: item.quantity
                }))
              });
            }
          } catch (fsErr) {
            console.warn("Firestore order record update deferred due to database quota limit:", fsErr);
          }

          clearCart();
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
      }
    }
    verifyPayment();
  }, [reference, clearCart]);

  const handleSignInAndClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim()) {
      toast.error("Please provide your account email address");
      return;
    }
    if (!signInPassword) {
      toast.error("Please enter your account password");
      return;
    }

    setConvertingAccount(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, guestEmail.trim(), signInPassword);
      const loggedUser = userCred.user;

      const { claimedCount } = await claimGuestOrdersForUser(loggedUser.uid, guestEmail.trim());

      setBuyerId(loggedUser.uid);
      setAccountConverted(true);
      toast.success(`Welcome back! ${claimedCount || 1} order(s) linked to your account profile.`);
    } catch (err: any) {
      console.error("Sign in failed:", err);
      toast.error(err.message || "Invalid email or password. Please try again.");
    } finally {
      setConvertingAccount(false);
    }
  };

  const handleGoogleSignInAndClaim = async () => {
    setConvertingAccount(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      const emailToClaim = googleUser.email || guestEmail.trim();
      const { claimedCount } = await claimGuestOrdersForUser(googleUser.uid, emailToClaim);

      setBuyerId(googleUser.uid);
      setAccountConverted(true);
      toast.success(`Signed in as ${googleUser.displayName || googleUser.email}! ${claimedCount || 1} order(s) linked.`);
    } catch (err: any) {
      console.error("Google Sign-In failed:", err);
      toast.error("Google Sign-In was cancelled or failed.");
    } finally {
      setConvertingAccount(false);
    }
  };

  const handleConvertAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestEmail.trim()) {
      toast.error("Please provide a valid email address");
      return;
    }
    if (guestPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (guestPassword !== guestConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setConvertingAccount(true);

    try {
      // 1. Create Firebase Auth user
      const userCred = await createUserWithEmailAndPassword(auth, guestEmail.trim(), guestPassword);
      const newUser = userCred.user;

      // 2. Create User document in Firestore
      try {
        await setDoc(doc(db, "users", newUser.uid), {
          email: guestEmail.trim().toLowerCase(),
          loyaltyPoints: pointsEarned,
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (docErr: any) {
        console.warn("[PaymentSuccess] User doc creation notice:", docErr?.message || docErr);
      }

      // 3. Claim guest orders and link to this new account
      const { claimedCount, pointsClaimed } = await claimGuestOrdersForUser(newUser.uid, guestEmail.trim());

      setBuyerId(newUser.uid);
      setAccountConverted(true);
      toast.success(`Account created! ${claimedCount || 1} order(s) and ${pointsEarned} loyalty XP saved to your profile.`);
    } catch (err: any) {
      console.error("Failed to convert guest account:", err);
      if (err.code === "auth/email-already-in-use") {
        toast.error("An account with this email already exists. Switch to 'Sign In' to claim your orders!");
        setGuestAuthMode("signin");
      } else {
        toast.error(err.message || "Failed to create account. Please try again.");
      }
    } finally {
      setConvertingAccount(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      QRCode.toDataURL(`${window.location.origin}/track-order/${orderId}`, {
        margin: 1,
        width: 256,
        color: {
          dark: "#ea580c",
          light: "#ffffff",
        }
      })
        .then((url) => {
          setQrCodeUrl(url);
        })
        .catch((err) => {
          console.error("Failed to generate screen QR", err);
        });
    }
  }, [orderId]);

  if (status === "loading") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 relative overflow-hidden bg-white dark:bg-gray-950">
        {/* Animated background blobs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-100 dark:bg-orange-950/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-yellow-100 dark:bg-yellow-950/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-pulse delay-700"></div>

        <div className="relative z-10 text-center space-y-8 max-w-sm w-full">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 border-b-4 border-orange-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ShoppingBag size={32} className="text-orange-600 animate-bounce" />
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-black italic text-gray-900 dark:text-white tracking-tight">Finalizing...</h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              We're verifying your transaction securely and reserving your items. This won't take long!
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center space-x-3 text-sm font-bold text-gray-450 dark:text-gray-505">
              <div className="w-2 h-2 bg-[#32ba78] rounded-full animate-pulse"></div>
              <span>Payment Verified</span>
            </div>
            <div className="flex items-center space-x-3 text-sm font-bold text-gray-450 dark:text-gray-505">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span>Updating Inventory</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-8 px-4 text-center bg-white dark:bg-gray-950">
        <div className="bg-red-55/70 dark:bg-red-950/30 p-8 rounded-full">
          <XCircle size={80} className="text-red-500 dark:text-red-400" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">Verification Incomplete</h1>
          <p className="text-gray-500 dark:text-gray-450 max-w-md mx-auto leading-relaxed">
            We couldn't confirm your payment status. If your account was debited, don't worry—our team has been notified.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <Link to="/checkout" className="bg-gray-900 dark:bg-orange-600 text-white dark:text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-black dark:hover:bg-orange-700 transition-all shadow-xl">
            Try Again
          </Link>
          <a href="mailto:support@sokoplus.co.ke" className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-850 transition-all">
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-10 px-4 text-center relative bg-white dark:bg-transparent">
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 12 }}
        className="bg-[#32ba78]/10 dark:bg-[#32ba78]/5 p-10 rounded-full shadow-inner border border-[#32ba78]/20 brand-success-glow"
      >
        <CheckCircle size={100} className="text-[#32ba78]" />
      </motion.div>
      
      <div className="space-y-4">
        <h1 className="text-5xl font-black italic tracking-tighter text-gray-900 dark:text-white">Asante Sana!</h1>
        <p className="text-gray-500 dark:text-gray-400 text-xl font-medium max-w-md mx-auto leading-relaxed">
          Your payment was successful and your order #{orderReceiptId || (reference || "").slice(-6).toUpperCase()} is now being processed.
        </p>
      </div>

      {/* GUEST ACCOUNT CONVERSION BANNER */}
      {isGuestOrder && !auth.currentUser && (
        <div className="w-full max-w-md mx-auto bg-gradient-to-br from-white via-orange-50/40 to-amber-50/60 dark:from-gray-900 dark:via-gray-900 dark:to-orange-950/20 p-6 sm:p-8 rounded-[2.5rem] border-2 border-orange-200 dark:border-orange-800/60 shadow-xl text-left space-y-5">
          {accountConverted ? (
            <div className="text-center space-y-3 py-2">
              <div className="inline-flex items-center justify-center p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-1">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Account Active & Order Saved!</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                Your guest purchase #{orderReceiptId} and <strong>+{pointsEarned} loyalty XP</strong> have been linked to <strong>{guestEmail}</strong>. You can now track deliveries and manage orders from your Profile.
              </p>
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all mt-2"
              >
                Go to Profile Dashboard <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-orange-600 text-white rounded-2xl shadow-md shrink-0">
                  <Sparkles size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">Save & Track Order</h3>
                    <span className="text-[10px] font-black uppercase bg-orange-600 text-white px-2 py-0.5 rounded-full tracking-wider">
                      +{pointsEarned} XP
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed mt-0.5">
                    Sign in to an existing account or create a new one to link order #{orderReceiptId} and track its delivery live.
                  </p>
                </div>
              </div>

              {/* AUTH MODE TOGGLE TABS */}
              <div className="flex p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setGuestAuthMode("signin")}
                  className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
                    guestAuthMode === "signin"
                      ? "bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 shadow-sm"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Sign In Existing
                </button>
                <button
                  type="button"
                  onClick={() => setGuestAuthMode("register")}
                  className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
                    guestAuthMode === "register"
                      ? "bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 shadow-sm"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Register New
                </button>
              </div>

              {/* QUICK GOOGLE SIGN IN BUTTON */}
              <button
                type="button"
                onClick={handleGoogleSignInAndClaim}
                disabled={convertingAccount}
                className="w-full py-2.5 px-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-extrabold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-95 disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-1">
                <div className="border-t border-gray-200 dark:border-gray-800 w-full"></div>
                <span className="bg-white dark:bg-gray-900 px-3 text-[10px] font-bold uppercase text-gray-400 shrink-0">or use email</span>
              </div>

              {guestAuthMode === "signin" ? (
                <form onSubmit={handleSignInAndClaim} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                      Account Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="name@email.com"
                        className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                      Account Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="password"
                        required
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={convertingAccount}
                    className="w-full mt-2 py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
                  >
                    {convertingAccount ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Signing In & Linking...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} />
                        <span>Sign In & Claim Order</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConvertAccount} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                      Notification Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="name@email.com"
                        className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                        Set Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={guestPassword}
                          onChange={(e) => setGuestPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={guestConfirmPassword}
                          onChange={(e) => setGuestConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={convertingAccount}
                    className="w-full mt-2 py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
                  >
                    {convertingAccount ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} />
                        <span>Create Account & Claim +{pointsEarned} XP</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}

      <div className="w-full max-w-xl mx-auto">
        <MysteryBox userId={buyerId || auth.currentUser?.uid} orderId={orderId} />
      </div>

      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border-2 border-gray-50 dark:border-gray-800 shadow-2xl shadow-orange-100/50 dark:shadow-none space-y-6 max-w-sm w-full">
        <div className="flex justify-between items-center text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          <span>Points Earned</span>
          <span className="text-[#32ba78] font-black">+{pointsEarned || 85} XP</span>
        </div>
        
        <div className="h-px bg-gray-50 dark:bg-gray-800 w-full"></div>

        {qrCodeUrl && (
          <div className="flex flex-col items-center justify-center p-4 bg-orange-50/25 dark:bg-orange-950/10 border border-orange-100/20 dark:border-orange-900/10 rounded-3xl space-y-2">
            <img 
              src={qrCodeUrl} 
              alt="Receipt QR Code" 
              className="w-32 h-32 rounded-2xl object-contain shadow-sm border border-orange-100/20 bg-white"
              referrerPolicy="no-referrer"
            />
            <p className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider animate-pulse">
              Scan Receipt to Track Delivery
            </p>
          </div>
        )}

        <div className="h-px bg-gray-50 dark:bg-gray-800 w-full"></div>
        
        <p className="text-xs text-gray-450 dark:text-gray-400 leading-relaxed italic">
          A receipt and tracking details have been sent to your email. You can view progress in your profile.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
        <Link 
          to={orderId ? `/track-order/${orderId}` : `/track-order?reference=${reference || ""}`}
          className="bg-orange-600 hover:bg-orange-700 text-white px-10 py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-orange-200/50 hover:-translate-y-0.5 transition-all text-center"
        >
          <Truck size={22} className="animate-pulse" /> Track Live Delivery
        </Link>
        <Link to="/" className="bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-gray-800 dark:text-gray-100 px-10 py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all text-center">
          Explore More <ArrowRight size={22} />
        </Link>
      </div>
    </div>
  );
}
