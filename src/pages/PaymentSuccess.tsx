import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { CheckCircle, XCircle, ShoppingBag, ArrowRight, Truck } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { doc, updateDoc, collection, query, where, getDocs, increment, writeBatch } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { motion } from "motion/react";
import { trackEvent } from "../lib/analytics";
import QRCode from "qrcode";
import MysteryBox from "../components/MysteryBox";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const [orderReceiptId, setOrderReceiptId] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [buyerId, setBuyerId] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const { clearCart } = useCart();
  const reference = searchParams.get("reference");

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setStatus("error");
        return;
      }

      try {
        // Optimize load time by fetching Paystack verification and the corresponding Firestore order in parallel
        const [response, snap] = await Promise.all([
          axios.get(`/api/paystack/verify/${reference}`),
          getDocs(query(collection(db, "orders"), where("paymentReference", "==", reference)))
        ]);

        if (response.data.data.status === "success") {
          if (!snap.empty) {
            const orderDoc = snap.docs[0];
            const orderData = orderDoc.data();
            const calculatedPoints = Math.floor((orderData.totalAmount || 0) / 100);
            setPointsEarned(calculatedPoints);
            setOrderReceiptId(orderDoc.id.slice(0, 8).toUpperCase());
            setOrderId(orderDoc.id);
            if (orderData.userId) {
              setBuyerId(orderData.userId);
            }

            // Prevent double-processing
            if (orderData.paymentStatus === "paid") {
              setOrderId(orderDoc.id);
              clearCart();
              setStatus("success");
              return;
            }

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

            // 3. Add Loyalty Points (1 point per 100 KES)
            if (orderData.userId) {
              const userRef = doc(db, "users", orderData.userId);
              batch.update(userRef, {
                loyaltyPoints: increment(calculatedPoints)
              });
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

            await batch.commit();
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
              We're verifying your transaction with Paystack and securing your items. This won't take long!
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center space-x-3 text-sm font-bold text-gray-450 dark:text-gray-505">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
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
        className="bg-green-50 dark:bg-green-950/20 p-10 rounded-full shadow-inner border border-green-105/30"
      >
        <CheckCircle size={100} className="text-green-550 dark:text-green-400" />
      </motion.div>
      
      <div className="space-y-4">
        <h1 className="text-5xl font-black italic tracking-tighter text-gray-900 dark:text-white">Asante Sana!</h1>
        <p className="text-gray-500 dark:text-gray-400 text-xl font-medium max-w-md mx-auto leading-relaxed">
          Your payment was successful and your order #{orderReceiptId || (reference || "").slice(-6).toUpperCase()} is now being processed.
        </p>
      </div>

      <div className="w-full max-w-xl mx-auto">
        <MysteryBox userId={buyerId || auth.currentUser?.uid} orderId={orderId} />
      </div>

      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border-2 border-gray-50 dark:border-gray-800 shadow-2xl shadow-orange-100/50 dark:shadow-none space-y-6 max-w-sm w-full">
        <div className="flex justify-between items-center text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          <span>Points Earned</span>
          <span className="text-green-600 dark:text-green-400">+{pointsEarned || 85} XP</span>
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
