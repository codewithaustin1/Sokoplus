import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          loyaltyPoints: 0,
          createdAt: new Date().toISOString(),
        });
      }

      // Automatically promote certain email to admin for testing
      if (user.email === "upfrontretaile@gmail.com") {
        try {
          const adminRef = doc(db, "admins", user.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, { email: user.email });
          }
        } catch (e) {
          console.warn("Could not register admin profile:", e);
          // Don't fail the whole login if admin promotion fails
        }
      }
      
      toast.success(`Welcome back, ${user.displayName}!`);
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === "auth/popup-closed-by-user") {
        toast.error("Login cancelled. Please try again.");
      } else {
        toast.error("Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center space-y-8">
        <div className="flex justify-center">
          <div className="bg-orange-600 p-4 rounded-2xl shadow-lg">
            <ShoppingBag className="text-white" size={40} />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Welcome to Sokoplus</h1>
          <p className="text-gray-500">Sign in to manage your orders, wishlist, and get personalized recommendations.</p>
        </div>
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-200 py-4 px-6 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          )}
          <span>{loading ? "Signing in..." : "Sign in with Google"}</span>
        </button>

        <p className="text-xs text-gray-400">
          By signing in, you agree to our <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
