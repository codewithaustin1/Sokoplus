import React, { useState, useEffect, useRef } from "react";
import { UserProfile, SupportTicket } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, limit, onSnapshot, where, updateDoc, doc } from "firebase/firestore";
import { Send, X, MessageSquare, Loader2, Sparkles, Mail, Trash2, MessageCircle, Activity, ArrowLeft, Clock, CheckCircle2, Check, CheckCheck } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import ReactMarkdown from "react-markdown";

interface SupportProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
}

export default function Support({ user, isOpen, onClose }: SupportProps) {
  // Tabs: "ai" for custom Gemini product assistant; "whatsapp" for direct live chat; "email" for Firestore ticketing helpdesk
  const [mode, setMode] = useState<"ai" | "whatsapp" | "email">("ai");
  
  // Traditional form states
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<SupportTicket["subject"]>("General Inquiry");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Outbound active ticket response inbox states
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [emailSubTab, setEmailSubTab] = useState<"new" | "inbox">("new");
  const [clientReplyText, setClientReplyText] = useState<{ [ticketId: string]: string }>({});
  const [activeOpenTicketId, setActiveOpenTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUserTickets([]);
      setEmailSubTab("new");
      return;
    }

    const q = query(
      collection(db, "support_tickets"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket);
      // Sort: updated descending, fallback to created descending
      docs.sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt;
        const bTime = b.updatedAt || b.createdAt;
        const aMs = aTime ? (aTime.toDate ? aTime.toDate().getTime() : new Date(aTime).getTime()) : 0;
        const bMs = bTime ? (bTime.toDate ? bTime.toDate().getTime() : new Date(bTime).getTime()) : 0;
        return bMs - aMs;
      });
      setUserTickets(docs);
      
      // If user has existing tickets, default to inbox tab, else new
      if (docs.length > 0) {
        setEmailSubTab("inbox");
      }
    }, (error) => {
      console.warn("Error listening to user tickets:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleReadTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), {
        unreadCountClient: 0
      });
    } catch (e) {
      console.warn("Failed to reset client unread count:", e);
    }
  };

  useEffect(() => {
    if (!activeOpenTicketId) return;
    const currentTicket = userTickets.find((t) => t.id === activeOpenTicketId);
    if (currentTicket && (currentTicket.unreadCountClient || 0) > 0) {
      handleReadTicket(activeOpenTicketId);
    }
  }, [activeOpenTicketId, userTickets]);

  const handleSendClientReply = async (e: React.FormEvent, ticketId: string, currentReplies: any[] = []) => {
    e.preventDefault();
    const replyText = clientReplyText[ticketId]?.trim();
    if (!replyText) return;

    try {
      const newReply = {
        sender: "user",
        message: replyText,
        createdAt: new Date().toISOString(),
        senderName: user?.displayName || "You",
      };

      const updatedReplies = [...(currentReplies || []), newReply];

      await updateDoc(doc(db, "support_tickets", ticketId), {
        replies: updatedReplies,
        unreadCountAdmin: (userTickets.find((t) => t.id === ticketId)?.unreadCountAdmin || 0) + 1,
        updatedAt: new Date().toISOString(),
        status: "open" // reopen / keep open
      });

      setClientReplyText((prev) => ({ ...prev, [ticketId]: "" }));
      toast.success("Message sent to Soplus Support.");
    } catch (error) {
      console.error("Error sending client reply:", error);
      toast.error("Failed to send message.");
    }
  };

  // Smart Chat states
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [aiMessages, setAiMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Habari! I am SokoSmart, your friendly customer care representative. Ask me anything about Sokoplus products, pricing, design materials, collections, or stock availability! Karibu."
    }
  ]);

  // Load products client side to supply chatbot context reliably (bypasses REST 403 & Admin SDK 7 Permission Denied issues)
  useEffect(() => {
    if (isOpen && products.length === 0) {
      const fetchProductsForAI = async () => {
        try {
          const q = query(collection(db, "products"), limit(50));
          const snap = await getDocs(q);
          const retrieved = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((p: any) => p.active !== false);
          setProducts(retrieved);
        } catch (error) {
          console.error("SupportChat client products fetch failed:", error);
        }
      };
      fetchProductsForAI();
    }
  }, [isOpen, products.length]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Auto scroll to chat bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (mode === "ai") {
      scrollToBottom();
    }
  }, [aiMessages, mode, aiLoading]);

  // Traditional feedback submission handler
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

  // AI Assistant message handler
  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || aiLoading) return;

    const userMsg: Message = {
      id: `m-user-${Date.now()}`,
      sender: "user",
      text: trimmedInput,
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setAiLoading(true);

    try {
      const response = await axios.post("/api/support-chat/ai", {
        messages: [...aiMessages, userMsg].map((m) => ({
          sender: m.sender,
          text: m.text,
        })),
        products: products,
      });

      const replyText = response.data?.text || "Pardon me, please check your connection and try asking that again.";
      setAiMessages((prev) => [
        ...prev,
        {
          id: `m-bot-${Date.now()}`,
          sender: "bot",
          text: replyText,
        },
      ]);
    } catch (err: any) {
      console.warn("AI proxy endpoint failed, attempting direct client-side fallback (Option B)...", err);
      
      const clientApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (clientApiKey) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const aiInstance = new GoogleGenAI({ apiKey: clientApiKey });
          
          const systemInstruction = `You are "SokoSmart", the intelligent, friendly, and helpful Customer Support Assistant for Sokoplus, a premier Kenyan e-commerce marketplace. 

Your objectives:
1. Provide accurate, context-aware information about the products in our storefront catalog.
2. Help users find suitable products, answer questions about product features, pricing (expressed in KES / Kenyan Shillings), availability/stock, and categories.
3. Be extremely polite and show genuine warm Kenyan hospitality. Use words like "Habari" (Hello), "Karibu" (Welcome), or "Asante" (Thank you) when welcoming or thanking the customer. Keep your responses primarily in English.
4. Keep answers nicely styled with clean markdown bullets, but concise and reader-friendly. Avoid overly long walls of text.
5. If a user asks about their specific order status or needs technical support, guide them to use our standard ticket form (available in the "Email Us" mode of the support window) or write a ticket, and our team will get in touch.
6. Return responses in standard Markdown. Do not include any private JSON data formats in the text.

Here is the current active Sokoplus product catalog:
${JSON.stringify(products.map(p => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  description: p.description,
  stock: p.stock,
  rating: p.rating || 5
})))}
`;

          const contents = [...aiMessages, userMsg].map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.text }],
          }));

          const fallbackResponse = await aiInstance.models.generateContent({
            model: "gemini-3.5-flash",
            contents: contents,
            config: {
              systemInstruction,
            },
          });

          const replyText = fallbackResponse.text || "Pardon me, please check your connection and try asking that again.";
          setAiMessages((prev) => [
            ...prev,
            {
              id: `m-bot-${Date.now()}`,
              sender: "bot",
              text: replyText,
            },
          ]);
          return;
        } catch (fallbackErr: any) {
          console.error("Direct client-side Gemini fallback failed:", fallbackErr);
        }
      }

      setAiMessages((prev) => [
        ...prev,
        {
          id: `m-err-${Date.now()}`,
          sender: "bot",
          text: `Habari! SokoSmart is currently experiencing extremely high traffic volume. 

To prevent any delay, feel free to browse our main collections directly on the home page, or tap the **WhatsApp** or **Email Ticket** tabs above to reach us directly! Asante sana for your patience.`,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end p-4 pointer-events-none">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md h-[650px] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border border-gray-100 dark:border-gray-800">
        
        {/* Chat Widget Header */}
        <div className="bg-gray-900 dark:bg-gray-950 p-6 text-white flex items-center justify-between border-b dark:border-gray-850">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-600 p-2 rounded-xl">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="font-bold">Customer Support</h3>
              <p className="text-xs text-gray-400">Usually replies instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all cursor-pointer bg-transparent border-none text-white outline-none">
            <X size={20} />
          </button>
        </div>

        {/* Support Modes Navigation Pills */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 p-2 bg-gray-50/50 dark:bg-gray-950/50 gap-1">
          <button
            type="button"
            id="support-tab-ai"
            onClick={() => setMode("ai")}
            className={`flex-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer border-none ${
              mode === "ai"
                ? "bg-white text-orange-600 shadow-sm border border-gray-100 dark:bg-gray-900 dark:text-orange-400 dark:border-gray-800"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-transparent"
            }`}
          >
            <Sparkles size={12} className={mode === "ai" ? "text-orange-600" : "text-gray-400"} />
            <span>SokoSmart Chat</span>
          </button>

          <button
            type="button"
            id="support-tab-whatsapp"
            onClick={() => setMode("whatsapp")}
            className={`flex-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer border-none ${
              mode === "whatsapp"
                ? "bg-white text-green-600 shadow-sm border border-gray-100 dark:bg-gray-900 dark:text-green-400 dark:border-gray-800"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-transparent"
            }`}
          >
            <MessageCircle size={12} className={mode === "whatsapp" ? "text-green-500" : "text-gray-400"} />
            <span>WhatsApp</span>
          </button>
          
          <button
            type="button"
            id="support-tab-email"
            onClick={() => setMode("email")}
            className={`flex-1 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer border-none relative ${
              mode === "email"
                ? "bg-white text-orange-600 shadow-sm border border-gray-100 dark:bg-gray-900 dark:text-orange-400 dark:border-gray-800"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-transparent"
            }`}
          >
            <Mail size={12} className={mode === "email" ? "text-orange-600" : "text-gray-400"} />
            <span>Email Ticket</span>
            {userTickets.reduce((acc, curr) => acc + (curr.unreadCountClient || 0), 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center animate-pulse">
                {userTickets.reduce((acc, curr) => acc + (curr.unreadCountClient || 0), 0)}
              </span>
            )}
          </button>
        </div>

        {/* Mode Meta/Details Bar */}
        {mode === "ai" && (
          <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 font-bold px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span>SokoSmart Live Assistant</span>
            </div>
            <button
              type="button"
              id="support-clear-chat-btn"
              onClick={() => setAiMessages([
                {
                  id: "welcome",
                  sender: "bot",
                  text: "Habari! I am SokoSmart, your friendly customer care representative. Ask me anything about Sokoplus products, pricing, design materials, collections, or stock availability! Karibu."
                }
              ])}
              className="hover:text-red-500 flex items-center space-x-1 transition-colors cursor-pointer bg-transparent border-none outline-none text-gray-400 dark:text-gray-500"
            >
              <Trash2 size={10} />
              <span>Clear Log</span>
            </button>
          </div>
        )}

        {/* Chat Widget Content Areas */}
        <div className="flex-grow overflow-y-auto min-h-0 bg-transparent">
          {mode === "ai" && (
            /* Smart Chat Log Area */
            <div className="p-4 space-y-4 flex flex-col h-full overflow-y-auto">
              {aiMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                  }`}
                >
                  <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mb-1 ml-1.5 uppercase tracking-wide">
                    {msg.sender === "user" ? "You" : "SokoSmart"}
                  </p>
                  <div
                    className={`rounded-3xl px-4 py-3 shadow-sm text-sm ${
                      msg.sender === "user"
                        ? "bg-orange-600 text-white rounded-tr-none font-medium"
                        : "bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                    }`}
                  >
                    {msg.sender === "user" ? (
                      msg.text
                    ) : (
                      <div className="markdown-body space-y-1 prose prose-sm leading-relaxed text-gray-800 dark:text-gray-200 dark:prose-invert">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {aiLoading && (
                <div className="flex items-start space-x-2.5 self-start max-w-[85%] animate-pulse">
                  <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-3xl rounded-bl-none p-3.5 shadow-sm text-xs font-bold text-gray-400 dark:text-gray-500 italic flex items-center space-x-2">
                    <Loader2 size={13} className="animate-spin text-orange-500" />
                    <span>Searching catalog...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {mode === "whatsapp" && (
            /* Premium Dedicated WhatsApp Hub Screen */
            <div className="p-6 space-y-6 animate-in fade-in duration-200">
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 rounded-2xl p-5 flex items-start space-x-3.5">
                <div className="bg-green-500 text-white p-2.5 rounded-xl mt-0.5 relative">
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-white rounded-full">
                    <span className="absolute top-0 left-0 w-2.5 h-2.5 bg-green-350 rounded-full animate-ping"></span>
                  </span>
                  <MessageCircle size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-green-950 dark:text-green-300">Live Support</h4>
                  <p className="text-xs text-green-800 dark:text-green-400 font-medium mt-0.5">Average response: &lt; 5 minutes</p>
                  <div className="flex items-center space-x-1.5 mt-2 bg-green-100/50 dark:bg-green-900/40 text-green-800 dark:text-green-300 py-0.5 px-2 rounded-lg text-[10px] font-black w-max tracking-wider uppercase">
                    <Activity size={10} className="animate-pulse text-green-600" />
                    <span>Active Now</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Ideal WhatsApp Topics</p>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-155 dark:border-gray-800 rounded-2xl p-4 transition-all">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">🌸</span>
                      <span className="font-bold text-xs text-gray-800 dark:text-gray-200">Customizations</span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 italic font-medium mt-1 pl-6">
                      Request custom fabrics, frame resizing, or custom-made Kenyan furniture.
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-155 dark:border-gray-800 rounded-2xl p-4 transition-all">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">🚚</span>
                      <span className="font-bold text-xs text-gray-800 dark:text-gray-200">Urgent Order Changes</span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 italic font-medium mt-1 pl-6">
                      Modify shipping addresses or expedite dispatch orders quickly before departure.
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-155 dark:border-gray-800 rounded-2xl p-4 transition-all">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">💳</span>
                      <span className="font-bold text-xs text-gray-800 dark:text-gray-200">M-Pesa Verification</span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 italic font-medium mt-1 pl-6">
                      Send transaction statements or offline payment screenshots for verification.
                    </p>
                  </div>
                </div>
              </div>

              <a 
                href="https://wa.me/254740463021" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-3 w-full bg-[#25D366] text-white py-4 px-6 rounded-2xl font-black shadow-lg shadow-green-150 dark:shadow-none text-xs hover:bg-[#128C7E] active:scale-95 transition-all group cursor-pointer border-none"
              >
                <MessageSquare size={16} className="group-hover:scale-110 transition-transform" />
                <span>LAUNCH SECURE WHATSAPP SESSION</span>
              </a>

              <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 font-medium leading-relaxed px-2">
                We will launch a secure dialogue frame within WhatsApp Messenger or web app. Your details are encrypted.
              </p>
            </div>
          )}

          {mode === "email" && (
            /* Traditional Helpdesk & Inbound Message inbox area */
            <div className="p-4 space-y-4 flex flex-col h-full overflow-y-auto">
              {/* If user is logged in, show Sub-Tabs: Inbox vs New Ticket */}
              {user && (
                <div className="flex border-b border-gray-100 dark:border-gray-800 p-1 bg-gray-50/50 dark:bg-gray-950/50 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailSubTab("inbox");
                      setActiveOpenTicketId(null);
                    }}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer border-none ${
                      emailSubTab === "inbox"
                        ? "bg-white text-orange-600 shadow-sm dark:bg-gray-900 dark:text-orange-400"
                        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 bg-transparent"
                    }`}
                  >
                    <span>My Inbox ({userTickets.length})</span>
                    {userTickets.some(t => t.unreadCountClient && t.unreadCountClient > 0) && (
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmailSubTab("new");
                      setActiveOpenTicketId(null);
                    }}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 cursor-pointer border-none ${
                      emailSubTab === "new"
                        ? "bg-white text-orange-600 shadow-sm dark:bg-gray-900 dark:text-orange-400"
                        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 bg-transparent"
                    }`}
                  >
                    <span>File New Ticket</span>
                  </button>
                </div>
              )}

              {/* VIEW A SPECIFIC OPEN TICKET CHAT CONVERSATION */}
              {emailSubTab === "inbox" && activeOpenTicketId && (
                (() => {
                  const activeTicket = userTickets.find(t => t.id === activeOpenTicketId);
                  if (!activeTicket) return <p className="text-xs text-gray-500">Ticket not found.</p>;
                  return (
                    <div className="space-y-4 flex flex-col flex-grow">
                      {/* Back button header */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-850">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveOpenTicketId(null);
                          }}
                          className="flex items-center text-xs text-gray-400 hover:text-gray-700 font-bold bg-transparent border-none cursor-pointer gap-1"
                        >
                          <ArrowLeft size={14} />
                          <span>Back to Inbox</span>
                        </button>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          activeTicket.status === "resolved" ? "bg-green-100 text-green-700" :
                          activeTicket.status === "in-progress" ? "bg-blue-150 text-blue-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {activeTicket.status}
                        </span>
                      </div>

                      {/* Chat feed container */}
                      <div className="flex-grow space-y-3 overflow-y-auto max-h-[350px] pr-1">
                        {/* Original Ticket Message */}
                        <div className="flex flex-col max-w-[85%] self-start items-start">
                          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1">
                            Your Ticket: {activeTicket.subject}
                          </p>
                          <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-950 dark:text-orange-200 rounded-3xl rounded-tl-none px-4 py-3 text-xs font-semibold border border-orange-100 dark:border-orange-900/40">
                            {activeTicket.message}
                          </div>
                          <span className="text-[8px] text-gray-400 mt-0.5 ml-2 flex items-center gap-1.5">
                            <span>
                              {activeTicket.createdAt?.toDate
                                ? activeTicket.createdAt.toDate().toLocaleString()
                                : String(activeTicket.createdAt)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              {(!activeTicket.unreadCountAdmin || activeTicket.unreadCountAdmin === 0) ? (
                                <span className="text-green-600 dark:text-green-400 font-extrabold flex items-center gap-0.5">
                                  <CheckCheck size={10} className="stroke-[3]" /> Read
                                </span>
                              ) : (
                                <span className="text-gray-400 font-semibold flex items-center gap-0.5">
                                  <Check size={10} className="stroke-[2]" /> Sent
                                </span>
                              )}
                            </span>
                          </span>
                        </div>

                        {/* Conversational replies */}
                        {activeTicket.replies && activeTicket.replies.map((rep, idx) => (
                          <div
                            key={idx}
                            className={`flex flex-col max-w-[85%] ${
                              rep.sender === "user" ? "self-end items-end ml-auto" : "self-start items-start mr-auto"
                            }`}
                          >
                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1 mx-1">
                              {rep.sender === "admin" ? "Soplus Team" : "You"}
                            </p>
                            <div className={`rounded-3xl px-4 py-3 text-xs ${
                              rep.sender === "user"
                                ? "bg-orange-600 text-white rounded-tr-none font-medium"
                                : "bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                            }`}>
                              {rep.message}
                            </div>
                            <span className="text-[8px] text-gray-400 mt-0.5 mx-2 flex items-center gap-1.5">
                              <span>
                                {rep.createdAt && typeof rep.createdAt === "string"
                                  ? new Date(rep.createdAt).toLocaleString()
                                  : String(rep.createdAt)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                {rep.sender === "user" ? (
                                  (!activeTicket.unreadCountAdmin || activeTicket.unreadCountAdmin === 0) ? (
                                    <span className="text-green-600 dark:text-green-400 font-extrabold flex items-center gap-0.5">
                                      <CheckCheck size={10} className="stroke-[3]" /> Read
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 font-semibold flex items-center gap-0.5">
                                      <Check size={10} className="stroke-[2]" /> Sent
                                    </span>
                                  )
                                ) : (
                                  <span className="text-blue-500 dark:text-blue-400 font-extrabold flex items-center gap-0.5">
                                    <CheckCheck size={10} className="stroke-[3]" /> Read
                                  </span>
                                )}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Form for user to write a message back to the support ticket */}
                      <form
                        onSubmit={(e) => handleSendClientReply(e, activeTicket.id, activeTicket.replies || [])}
                        className="flex items-center gap-2 mt-auto p-1 border-t border-gray-105 dark:border-gray-850 pt-3"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Type message to the care team..."
                          className="flex-grow p-3 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-850 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 font-bold text-xs"
                          value={clientReplyText[activeTicket.id] || ""}
                          onChange={(e) =>
                            setClientReplyText((prev) => ({
                              ...prev,
                              [activeTicket.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="submit"
                          className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-2xl transition-all shadow-md cursor-pointer border-none flex items-center justify-center whitespace-nowrap active:scale-95"
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </div>
                  );
                })()
              )}

              {/* TICKETS LISTING INSIDE CHAT INBOX TAB */}
              {emailSubTab === "inbox" && !activeOpenTicketId && (
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900 italic text-xs text-blue-800 dark:text-blue-305 leading-relaxed font-semibold animate-in fade-in duration-200">
                    "Habari! Select an active ticket below to view replies directly from your Soplus care coordinators or update your requests instantly."
                  </div>

                  {userTickets.length > 0 ? (
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {userTickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setActiveOpenTicketId(t.id);
                            handleReadTicket(t.id);
                          }}
                          className={`p-4 rounded-2.5xl border text-left cursor-pointer transition-all hover:border-orange-500 relative flex items-center justify-between ${
                            t.unreadCountClient && t.unreadCountClient > 0
                              ? "bg-green-50/70 border-green-200 dark:bg-green-950/15 dark:border-green-900"
                              : "bg-gray-50 dark:bg-gray-950 border-gray-100 dark:border-gray-850"
                          }`}
                        >
                          <div className="space-y-1 pr-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                                {t.subject}
                              </span>
                              <span className={`text-[8px] font-bold uppercase py-0.5 px-2 rounded-full ${
                                t.status === "resolved" ? "bg-green-100 text-green-700" :
                                t.status === "in-progress" ? "bg-blue-100 text-blue-700" :
                                "bg-orange-100 text-orange-700"
                              }`}>
                                {t.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 line-clamp-1 italic">
                              {t.replies && t.replies.length > 0
                                ? `Care Team: "${t.replies[t.replies.length - 1].message}"`
                                : `Original: "${t.message}"`}
                            </p>
                          </div>
                          
                          <div className="flex flex-col items-end shrink-0 gap-1.5">
                            {t.unreadCountClient && t.unreadCountClient > 0 ? (
                              <span className="bg-green-600 text-white font-bold text-[8px] px-2 py-0.5 rounded-full uppercase animate-bounce">
                                {t.unreadCountClient} New
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-400 font-semibold">
                                {t.updatedAt || t.createdAt ? (
                                  new Date((t.updatedAt || t.createdAt).toDate ? (t.updatedAt || t.createdAt).toDate() : (t.updatedAt || t.createdAt)).toLocaleDateString()
                                ) : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400 font-bold uppercase tracking-widest text-xs">
                      No tickets listed. Register below!
                    </div>
                  )}
                </div>
              )}

              {/* NEW TICKET FORM PANEL */}
              {emailSubTab === "new" && (
                <>
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900 italic text-xs text-blue-800 dark:text-blue-305 leading-relaxed font-medium animate-in fade-in duration-200">
                    "Habari! Use this official ticketing desk to register formal inquiries requiring catalog/account inspections. Our support technicians review tickets matching database records every 24 hours."
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 pb-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-1 underline decoration-orange-500/30">Your Registered Email</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="email@example.com"
                        className="w-full p-4 bg-gray-50 dark:bg-gray-950 text-gray-905 dark:text-white border border-gray-100 dark:border-gray-800 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium text-xs"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        readOnly={!!user?.email}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-1 underline decoration-orange-500/30">Subject Category</label>
                      <select 
                        className="w-full p-4 bg-gray-50 dark:bg-gray-950 text-gray-905 dark:text-white border border-gray-100 dark:border-gray-800 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium appearance-none text-xs"
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
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-1 underline decoration-orange-500/30">Detailed Message</label>
                      <textarea 
                        required
                        rows={4}
                        placeholder="Tell us what's happening..."
                        className="w-full p-4 bg-gray-50 dark:bg-gray-950 text-gray-905 dark:text-white border border-gray-100 dark:border-gray-800 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium resize-none shadow-inner text-xs"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      ></textarea>
                    </div>

                    <button 
                      disabled={loading}
                      type="submit" 
                      className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl hover:bg-orange-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-orange-600/20 dark:shadow-none disabled:opacity-50 cursor-pointer text-xs uppercase border-none"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Send size={15} />}
                      <span>{loading ? "SENDING..." : "REGISTER TICKET"}</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fixed Input Form for Smart mode at the absolute bottom */}
        {mode === "ai" && (
          <form onSubmit={handleSendAiMessage} className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center space-x-2">
            <input
              type="text"
              id="support-ai-input-field"
              placeholder="Ask SokoSmart about products, prices, etc..."
              required
              className="flex-grow p-4 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-850 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-bold text-xs"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={aiLoading}
            />
            <button
              type="submit"
              disabled={aiLoading || !chatInput.trim()}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white p-4 rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer border-none"
            >
              <Send size={15} />
            </button>
          </form>
        )}

        <div className="p-4 text-center border-t border-gray-50 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-950/50">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Powered by Sokoplus Support Engine v2.5</p>
        </div>
      </div>
    </div>
  );
}
