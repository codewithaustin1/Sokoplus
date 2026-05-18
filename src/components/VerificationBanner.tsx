import React, { useState } from "react";
import { auth } from "../lib/firebase";
import { sendEmailVerification } from "firebase/auth";
import { AlertTriangle, Mail, Loader2, CheckCircle, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  email: string;
}

export default function VerificationBanner({ email }: Props) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setSent(true);
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  const handleReload = async () => {
    if (!auth.currentUser) return;
    setChecking(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        toast.success("Email verified! Refreshing your session...");
        window.location.reload();
      } else {
        toast.error("Email still not verified. Please check your inbox.");
      }
    } catch (error: any) {
      toast.error("Failed to refresh status.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-orange-50 border-b border-orange-100 py-3 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-left">
          <div className="bg-orange-100 p-2 rounded-xl text-orange-600 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-950 uppercase tracking-tight">Email Verification Required</p>
            <p className="text-xs text-orange-800">Please verify your email ({email}) to unlock all features like ordering and wishlist.</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleReload}
            disabled={checking}
            className="flex items-center space-x-2 bg-white border border-orange-200 text-orange-700 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-orange-100 transition-all disabled:opacity-50"
          >
            {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            <span>CHECK STATUS</span>
          </button>
          
          <button
            onClick={handleResend}
            disabled={loading || sent}
            className="flex items-center space-x-2 bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-black hover:bg-orange-700 transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : sent ? (
              <CheckCircle size={16} />
            ) : (
              <Mail size={16} />
            )}
            <span>{sent ? "SENT! CHECK INBOX" : "RESEND EMAIL"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
