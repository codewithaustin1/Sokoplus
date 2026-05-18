import React, { useState, useEffect } from "react";
import { UserProfile, SupportTicket } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Send, X, MessageSquare, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface SupportProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Support({ user, isOpen, onClose }: SupportProps) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<SupportTicket["subject"]>("General Inquiry");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "support_tickets"), {
        userId: user?.uid || null,
        email,
        subject,
        message,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Support ticket submitted! We'll get back to you soon.");
      setMessage("");
      onClose();
    } catch (error) {
       console.error("Support submission error:", error);
       toast.error("Failed to submit ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end p-4 pointer-events-none">
      <div className="bg-white w-full max-w-md h-[600px] max-h-[80vh] rounded-3xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border border-gray-100">
        <div className="bg-gray-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-600 p-2 rounded-xl">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="font-bold">Customer Support</h3>
              <p className="text-xs text-gray-400">Offline • Typically replies in 2h</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 italic text-sm text-blue-800">
            "Habari! How can we help you today? Leave us a message and our team will get back to you via email."
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1 underline decoration-orange-500/30">Your Registered Email</label>
              <input 
                type="email" 
                required 
                placeholder="email@example.com"
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!user?.email}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1 underline decoration-orange-500/30">Subject Category</label>
              <select 
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium appearance-none"
                value={subject}
                onChange={(e) => setSubject(e.target.value as SupportTicket["subject"])}
              >
                <option value="Technical Support">Technical Support</option>
                <option value="Billing/Invoices">Billing/Invoices</option>
                <option value="Order Status">Order Status</option>
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1 underline decoration-orange-500/30">Detailed Message</label>
              <textarea 
                required
                rows={4}
                placeholder="Tell us what's happening..."
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              ></textarea>
            </div>

            <button 
              disabled={loading}
              type="submit" 
              className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl hover:bg-orange-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-orange-600/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
              <span>{loading ? "SENDING..." : "SEND MESSAGE"}</span>
            </button>
          </form>
        </div>

        <div className="p-4 text-center border-t border-gray-50 bg-gray-50/50">
          <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Powered by Sokoplus Support Engine v2.4</p>
        </div>
      </div>
    </div>
  );
}
