import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Mail, ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path,
    };
    console.error("Firestore Rule Error: ", JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    // Direct client validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    const docPath = "newsletter_subscribers";
    
    try {
      await addDoc(collection(db, docPath), {
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        userId: auth.currentUser?.uid || null,
      });

      setStatus("success");
      setEmail("");
      toast.success("Subscribed successfully!");
    } catch (error: any) {
      console.error("Newsletter submission failed:", error);
      setStatus("error");
      toast.error("Subscription failed. Please try again.");
      try {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      } catch (finalErr) {
        // Suppress or log re-thrown standard err info
      }
    }
  };

  return (
    <div className="newsletter-card relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-950 to-orange-950 rounded-3xl p-8 md:p-12 text-white border border-gray-800 shadow-xl">
      {/* Decorative ambient background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-650/10 rounded-full blur-3xl -z-5 pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-orange-850/5 rounded-full blur-3xl -z-5 pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success-state"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-6 flex flex-col items-center justify-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-orange-900/40 text-orange-400 border border-orange-500/35 flex items-center justify-center shadow-lg shadow-orange-500/10">
                <CheckCircle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight text-white flex items-center justify-center">
                  You're Subscriber No. 1! <Sparkles size={18} className="ml-2 text-orange-400 animate-pulse" />
                </h3>
                <p className="text-gray-450 text-sm max-w-sm md:max-w-md mx-auto leading-relaxed">
                  Thank you for subscribing to SokoPlus Chronicles. We are excited to share deep artisan stories, local craft guides, and premium marketplace digests with you soon.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setStatus("idle")}
                className="mt-2 text-xs font-black uppercase tracking-widest text-orange-450 border border-orange-500/30 bg-orange-950/20 px-5 py-2.5 rounded-xl hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-all cursor-pointer"
              >
                Subscribe Another Email
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="signup-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <span className="inline-flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-950/50 border border-orange-900/50 px-3.5 py-1.5 rounded-full">
                <Mail size={12} />
                <span>Keep in touch</span>
              </span>

              <div className="space-y-2">
                <h2 className="text-2xl md:text-3.5xl font-black tracking-tight text-white">
                  Join SokoPlus Chronicles
                </h2>
                <p className="text-gray-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed font-semibold">
                  Subscribe for beautiful stories of Kenyan craft, upcoming hand-made collections, and exclusive marketplace community digests.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    required
                    disabled={status === "submitting"}
                    placeholder="Enter your email address..."
                    className="w-full bg-gray-900/80 border border-gray-800 rounded-2xl pl-11 pr-4 py-3 text-xs outline-none focus:ring-1 focus:ring-orange-500 transition-all font-semibold text-white placeholder-gray-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={status === "submitting" || !email.trim()}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-orange-600/10 disabled:opacity-50"
                >
                  <span>{status === "submitting" ? "Subscribing..." : "Join Newsletter"}</span>
                  <ArrowRight size={14} />
                </motion.button>
              </form>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-tighter">
                🔒 We protect your privacy. Zero spam, unsubscribe at any time.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
