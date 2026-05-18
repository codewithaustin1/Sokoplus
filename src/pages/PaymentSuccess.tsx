import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { CheckCircle, XCircle, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { doc, updateDoc, collection, query, where, getDocs, increment, writeBatch } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const { clearCart } = useCart();
  const reference = searchParams.get("reference");

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setStatus("error");
        return;
      }

      try {
        const response = await axios.get(`/api/paystack/verify/${reference}`);
        if (response.data.data.status === "success") {
          // Update order in Firestore
          const q = query(collection(db, "orders"), where("paymentReference", "==", reference));
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            const orderDoc = snap.docs[0];
            const orderData = orderDoc.data();

            // Prevent double-processing
            if (orderData.paymentStatus === "paid") {
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
              const pointsEarned = Math.floor(orderData.totalAmount / 100);
              batch.update(userRef, {
                loyaltyPoints: increment(pointsEarned)
              });
            }

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

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-bold">Verifying your payment...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 px-4 text-center">
        <XCircle size={80} className="text-red-500" />
        <h1 className="text-4xl font-black">Payment Failed</h1>
        <p className="text-gray-500 max-w-md">We couldn't verify your transaction. If money was deducted, please contact support@sokoplus.co.ke</p>
        <Link to="/checkout" className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold">Try Again</Link>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 px-4 text-center">
      <CheckCircle size={80} className="text-green-500" />
      <h1 className="text-4xl font-black">Asante! Payment Successful</h1>
      <p className="text-gray-500 max-w-md">Your order is being processed. We've sent a confirmation email to you.</p>
      <div className="flex space-x-4">
        <Link to="/" className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all">
          Continue Shopping <ArrowRight className="ml-2" size={20} />
        </Link>
      </div>
    </div>
  );
}
