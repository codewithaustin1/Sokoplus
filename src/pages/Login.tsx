import { useState } from "react";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  User
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Mail, Lock, ChevronRight, UserPlus, LogIn, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const handleProfileSync = async (user: User) => {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email || null,
        displayName: user.displayName || email.split('@')[0] || "Valued Customer",
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
      }
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleProfileSync(result.user);
      toast.success(`Welcome back, ${result.user.displayName || 'Customer'}!`);
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === "auth/popup-closed-by-user") {
        toast.error("Login cancelled. Please try again.");
      } else if (error.code === "auth/popup-blocked") {
        toast.error("Popup blocked! Please allow popups for this site or open the app in a new tab.", { duration: 6000 });
      } else {
        toast.error("Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Please enter your email address first.");
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      toast.success("Password reset link sent to your email!");
    } catch (error: any) {
      console.error("Reset error:", error);
      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email address.");
      } else {
        toast.error("Failed to send reset link. Please try again.");
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const cleanPassword = password; // Do not trim passwords as spaces can be intentional

    if (!trimmedEmail || !cleanPassword || loading) return;

    if (isSignUp && cleanPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, trimmedEmail, cleanPassword);
        await handleProfileSync(result.user);
        await sendEmailVerification(result.user);
        toast.success("Account created! Please check your email for verification.", { duration: 6000 });
      } else {
        const result = await signInWithEmailAndPassword(auth, trimmedEmail, cleanPassword);
        await handleProfileSync(result.user);
        toast.success(`Welcome back!`);
      }
      navigate("/");
    } catch (error: any) {
      console.error("Auth error:", error);
      const errorCode = error.code;
      
      if (errorCode === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else if (errorCode === "auth/user-not-found" || errorCode === "auth/wrong-password" || errorCode === "auth/invalid-credential") {
        toast.error(isSignUp ? "Account creation failed. Please ensure your email is correct." : "Email or password incorrect. Please try again or use 'Forgot Password'.");
      } else if (errorCode === "auth/email-already-in-use") {
        toast.error("This email is already associated with an account.");
      } else if (errorCode === "auth/weak-password") {
        toast.error("Password is too weak. Try a stronger one.");
      } else if (errorCode === "auth/operation-not-allowed") {
        toast.error("Native login is currently disabled in system settings.");
      } else {
        toast.error(error.message || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-gray-100 space-y-10 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-50 rounded-full -ml-12 -mb-12 opacity-50" />

        <div className="text-center space-y-6 relative">
          <div className="flex justify-center">
            <div className="bg-orange-600 p-5 rounded-3xl shadow-xl shadow-orange-200 rotate-3">
              <ShoppingBag className="text-white" size={40} />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-gray-900 italic">Sokoplus</h1>
            <p className="text-gray-500 font-medium">{isSignUp ? "Create your account" : "Welcome back"}</p>
          </div>
        </div>

        <div className="space-y-8 relative">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-600 focus:bg-white rounded-2xl py-4 pl-14 pr-6 font-bold transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Password</label>
                  {!isSignUp && (
                    <button 
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] font-bold text-orange-600 hover:underline uppercase tracking-tighter"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-600 focus:bg-white rounded-2xl py-4 pl-14 pr-14 font-bold transition-all outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl hover:shadow-orange-200 disabled:opacity-50 flex items-center justify-center space-x-2 group"
            >
              <span>{loading ? "Processing..." : (isSignUp ? "Join Sokoplus" : "Sign In")}</span>
              {!loading && (isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />)}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-white px-4 text-gray-400 font-bold">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-4 bg-white border-2 border-gray-100 py-4 px-6 rounded-2xl font-black hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            <span>Google Account</span>
          </button>

          <div className="text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors"
            >
              {isSignUp ? "Already have an account? Sign In" : "New to Sokoplus? Create an account"}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center leading-relaxed font-medium">
          By continuing, you agree to Sokoplus's <br />
          <span className="underline decoration-gray-200 hover:text-gray-900 cursor-pointer transition-colors">Terms of Service</span> and <span className="underline decoration-gray-200 hover:text-gray-900 cursor-pointer transition-colors">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
