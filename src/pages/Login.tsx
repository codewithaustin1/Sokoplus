import { useState, useEffect } from "react";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  User
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { ShoppingBag, Mail, Lock, ChevronRight, UserPlus, LogIn, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
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

    // Automatically check for pre-authorized admin invitations if user has an email
    if (user.email) {
      try {
        const inviteDocId = user.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const inviteRef = doc(db, "admin_invitations", inviteDocId);
        const inviteSnap = await getDoc(inviteRef);

        if (inviteSnap.exists()) {
          const inviteData = inviteSnap.data();
          if (inviteData && inviteData.status === "pending") {
            // Found a pending invite! Auto-promote to admin
            const adminRef = doc(db, "admins", user.uid);
            await setDoc(adminRef, {
              email: user.email.toLowerCase(),
              roleId: inviteData.roleId || "custom",
              roleName: inviteData.roleName || "Custom Profile",
              permissions: inviteData.permissions || [],
              updatedAt: new Date().toISOString(),
              updatedBy: inviteData.invitedBy || "Pre-authorized Invitation"
            }, { merge: true });

            // Mark invitation as accepted
            await setDoc(inviteRef, { status: "accepted" }, { merge: true });
            
            toast.success(`Welcome back ${user.displayName || user.email}! Admin access activated successfully per invitation!`, {
              duration: 6000
            });
          }
        }
      } catch (invError) {
        console.warn("Could not check or claim pre-authorized invitation:", invError);
      }
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

  useEffect(() => {
    // Process redirect sign-in result automatically on mount
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          setLoading(true);
          await handleProfileSync(result.user);
          toast.success(`Welcome back, ${result.user.displayName || 'Customer'}!`);
          navigate("/");
        }
      } catch (error: any) {
        console.error("Redirect login result handler failed:", error);
      } finally {
        setLoading(false);
      }
    };
    handleRedirectResult();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    
    // Proactive iframe/sandbox detection: use Redirect style immediately for friction-free sign-in
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      try {
        toast.loading("Establishing secure session in sandbox. Redirecting to Google account sign-in...", { duration: 4000 });
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectErr: any) {
        console.error("Proactive Google redirect failed, falling back to popup flow:", redirectErr);
      }
    }

    try {
      const result = await signInWithPopup(auth, provider);
      await handleProfileSync(result.user);
      toast.success(`Welcome back, ${result.user.displayName || 'Customer'}!`);
      navigate("/");
    } catch (error: any) {
      console.error("Login popup failed:", error);
      if (
        error.code === "auth/popup-closed-by-user" || 
        error.code === "auth/popup-blocked" || 
        error.code === "auth/cancelled-popup-request" ||
        error.message?.includes("iframe")
      ) {
        try {
          toast.loading("Google Popup blocked/closed in browser. Redirecting to Google Account Sign-In instead...", { duration: 4000 });
          await signInWithRedirect(auth, provider);
        } catch (fallbackRedirectErr: any) {
          console.error("Fallback redirect sign-in failed:", fallbackRedirectErr);
          toast.error("Google sign-in is blocked in this browser orientation. Please sign in using Email and Password below.");
        }
      } else {
        toast.error("Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      toast.error("Please enter your email address.");
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast.error("Please enter a valid email address format (e.g., user@example.com).");
      return;
    }
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      toast.success("Password reset link sent to your email!");
      setIsForgotPassword(false); // Return to standard sign in automatically
    } catch (error: any) {
      console.error("Reset error:", error);
      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email address.");
      } else {
        toast.error("Failed to send reset link. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const cleanPassword = password; // Do not trim passwords as spaces can be intentional

    if (!trimmedEmail || !cleanPassword || loading) return;

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast.error("Please enter a valid email address format (e.g., user@example.com).");
      return;
    }

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
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm text-gray-800">This email is already associated with an account.</span>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                setResetEmail(trimmedEmail);
                setIsForgotPassword(true);
                setIsSignUp(false);
              }}
              className="text-xs font-black uppercase tracking-wider text-orange-600 hover:text-orange-700 underline text-left border-none bg-transparent cursor-pointer p-0"
            >
              Reset your password instead?
            </button>
          </div>
        ), { duration: 8000 });
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-gray-950 px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 p-8 md:p-10 rounded-[2rem] shadow-[0_15px_50px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-950/10 rounded-full -mr-16 -mt-16 opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-50 dark:bg-orange-950/10 rounded-full -ml-12 -mb-12 opacity-50" />

        <div className="text-center space-y-3 relative mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#E14D2A] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/10">
              <ShoppingBag className="text-white" size={32} />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white italic">Sokoplus</h1>
            <p className="text-gray-400 dark:text-gray-500 font-medium text-sm">
              {isForgotPassword 
                ? "Reset your password" 
                : "Welcome back"}
            </p>
          </div>
        </div>

        <div className="relative min-h-[340px]">
          <AnimatePresence mode="wait">
            {isForgotPassword ? (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                  <p className="text-sm text-gray-500 dark:text-gray-450 leading-relaxed font-medium">
                    Enter your email address below and we'll send a password reset link to your inbox.
                  </p>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-900 dark:text-gray-200">
                      EMAIL ADDRESS
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 focus:border-orange-500 dark:focus:border-orange-500 rounded-xl py-3.5 pl-12 pr-4 text-sm transition-all outline-none"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-none shadow-sm uppercase tracking-wider"
                  >
                    <span>{loading ? "SENDING..." : "SEND RESET LINK"}</span>
                    {!loading && <ChevronRight size={16} />}
                  </button>

                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="text-xs font-bold text-gray-500 dark:text-gray-450 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer bg-transparent border-none outline-none"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="auth-fields"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-800 w-full mb-6">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(false); }}
                    className={`flex-1 pb-3 text-center font-bold text-sm transition-all relative cursor-pointer ${
                      !isSignUp
                        ? "text-gray-950 dark:text-white font-black"
                        : "text-gray-400 hover:text-gray-600 dark:text-gray-500"
                    }`}
                  >
                    Sign In
                    {!isSignUp && (
                      <motion.div 
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E14D2A]"
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); }}
                    className={`flex-1 pb-3 text-center font-bold text-sm transition-all relative cursor-pointer ${
                      isSignUp
                        ? "text-gray-950 dark:text-white font-black"
                        : "text-gray-400 hover:text-gray-600 dark:text-gray-500"
                    }`}
                  >
                    New Account
                    {isSignUp && (
                      <motion.div 
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E14D2A]"
                      />
                    )}
                  </button>
                </div>

                {/* Google Sign In */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  type="button"
                  className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 py-3.5 px-4 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all cursor-pointer select-none"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 shrink-0" />
                  <span>Sign In with Google Account</span>
                </button>

                {/* Divider */}
                <div className="relative my-6 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
                  </div>
                  <div className="relative bg-white dark:bg-gray-900 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 select-none">
                    OR USE NATIVE LOGIN
                  </div>
                </div>

                {/* Native Login Form */}
                <form onSubmit={handleEmailAuth} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-900 dark:text-gray-200">
                      EMAIL ADDRESS
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={(e) => {
                          const target = e.target;
                          setTimeout(() => {
                            target.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 150);
                        }}
                        className="w-full bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 focus:border-orange-500 dark:focus:border-orange-500 rounded-xl py-3.5 pl-12 pr-4 text-sm transition-all outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-900 dark:text-gray-200">
                        PASSWORD
                      </label>
                      {!isSignUp && (
                        <button 
                          type="button"
                          onClick={() => {
                            setResetEmail(email);
                            setIsForgotPassword(true);
                          }}
                          className="text-[11px] font-bold text-[#E14D2A] hover:underline cursor-pointer bg-transparent border-none outline-none"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder=""
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={(e) => {
                          const target = e.target;
                          setTimeout(() => {
                            target.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 150);
                        }}
                        className="w-full bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 focus:border-orange-500 dark:focus:border-orange-500 rounded-xl py-3.5 pl-12 pr-12 text-sm transition-all outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white focus:outline-none transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Real-time Password Strength Visual Indicator */}
                    {password.length > 0 && (
                      <PasswordStrengthIndicator password={password} showRequirements={isSignUp} />
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-none shadow-sm uppercase tracking-wider"
                  >
                    <span>{loading ? "PROCESSING..." : (isSignUp ? "CREATE ACCOUNT" : "SIGN IN")}</span>
                    {!loading && (isSignUp ? <UserPlus size={15} /> : <LogIn size={15} className="stroke-[2.5]" />)}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[11px] text-gray-500 dark:text-gray-450 text-center leading-relaxed mt-8">
          By continuing, you agree to the updated{" "}
          <Link to="/terms" className="underline font-semibold text-gray-700 dark:text-gray-350 hover:text-gray-950 dark:hover:text-white transition-colors">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline font-semibold text-gray-700 dark:text-gray-350 hover:text-gray-950 dark:hover:text-white transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
