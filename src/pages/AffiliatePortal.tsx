import { useEffect, useState } from "react";
import { useLanguage } from "../lib/LanguageContext";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  TrendingUp, 
  Share2, 
  DollarSign, 
  Wallet, 
  Award, 
  Check, 
  Copy, 
  ChevronRight, 
  Banknote, 
  Clock, 
  AlertTriangle, 
  Info, 
  Lock,
  ArrowRight,
  Sparkles,
  Layers,
  HelpCircle,
  FileCheck
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from "recharts";
import toast from "react-hot-toast";

const pfTranslations = {
  en: {
    portalTitle: "SokoPlus Partner Hub",
    portalSubtitle: "Empower local artisans across Kenya. Recruit buyers and earn a standard 10% commission on every successful sale.",
    notLoggedInTitle: "Join the SokoPlus Affiliate Family",
    notLoggedInDesc: "Please sign in to register or manage your partner affiliate account.",
    signInBtn: "Go to Login Page",
    registerTitle: "Register as an Affiliate Partner",
    registerSubtitle: "Start earning commissions on referred purchases today! Approved accounts receive standard 10% payouts.",
    mpesaPlaceholder: "Enter Safaricom M-Pesa Number (e.g., 0712345678)",
    bankHolder: "Bank Account Holder Name",
    bankName: "Bank Name (e.g., KCB, Equity)",
    bankAcc: "Bank Account Number",
    becomingBtn: "Initialize Affiliate Account",
    savingInfo: "Saving configuration...",
    savePayments: "Update Payout Method",
    payoutDetailsTitle: "Your Disbursement Preferences",
    metricsClicks: "Ref Clicks",
    metricsConvs: "Conversions",
    metricsRate: "Commission",
    metricsEarnings: "Total Earnings",
    metricsUnpaid: "Unpaid Balance",
    payoutBtn: "Request Cashout",
    minNotice: "Minimum payout threshold is KES 1,500.",
    refLinkTitle: "Your Unique Affiliate Referral Link",
    copyBtn: "Copy Link",
    copiedText: "Copied!",
    chartTitle: "7-Day Traffic & Conversion Intelligence",
    tabStats: "Performance Metrics",
    tabReferrals: "Referrals & Conversions",
    tabPayouts: "Payouts History",
    tabClicks: "Clicks Stream",
    colDate: "Date",
    colOrder: "Order Code",
    colAmount: "Amount",
    colComm: "Commission Earned",
    colStatus: "Status",
    statusPending: "Pending Clearance",
    statusApproved: "Approved",
    statusPaid: "Disbursed",
    colIP: "IP Address Hash",
    colUA: "User Agent Details",
    noReferrals: "No recorded sales yet. Share your partner link to start converting!",
    noPayouts: "No payouts requested yet. Reach KES 1,500 to request standard clearance.",
    noClicks: "No clicks tracked yet. Share your link with friends to drive artisan sales!",
    paymentSaved: "Payment preferences updated successfully!",
    registerSuccess: "Welcome to SokoPlus Partner Hub!",
    payoutSuccess: "Cashout request logged! Admin will process within 48 hours."
  },
  sw: {
    portalTitle: "Kitovu cha Washirika",
    portalSubtitle: "Wawezeshe mafundi wa humu nchini Kenya. Alika wanunuzi na ujipatie tume ya kawaida ya 10% kwa kila mauzo.",
    notLoggedInTitle: "Jiunge na SokoPlus Washirika",
    notLoggedInDesc: "Tafadhali ingia kwenye akaunti yako ili kujiandikisha au kudhibiti washirika.",
    signInBtn: "Nenda kwenye Ukurasa wa Kuingia",
    registerTitle: "Jiandikishe kama Mshirika SokoPlus",
    registerSubtitle: "Anza kupata tume kwa kila ununuzi unaofanywa leo! Akaunti zilizoidhinishwa hupata tume ya 10%.",
    mpesaPlaceholder: "Nambari ya Safaricom M-Pesa (mfano, 0712345678)",
    bankHolder: "Jina la Mwenye Akaunti ya Benki",
    bankName: "Jina la Benki (mfano, KCB, Equity)",
    bankAcc: "Nambari ya Akaunti",
    becomingBtn: "Anzisha Akaunti ya Washirika",
    savingInfo: "Inahifadhi taarifa...",
    savePayments: "Sasisha Njia ya Malipo",
    payoutDetailsTitle: "Mapendekezo Yako ya Kulipwa",
    metricsClicks: "Mibofyo ya Rufaa",
    metricsConvs: "Mauzo ya Rufaa",
    metricsRate: "Kiwango cha Tume",
    metricsEarnings: "Jumla ya Tume",
    metricsUnpaid: "Tume Isiyolipwa",
    payoutBtn: "Omba Malipo",
    minNotice: "Kiwango cha chini cha kutoa ni KES 1,500.",
    refLinkTitle: "Kiungo Chako cha Kipekee cha Rufaa",
    copyBtn: "Nakili Kiungo",
    copiedText: "Imenakiliwa!",
    chartTitle: "Uchambuzi wa Siku 7 wa Trafiki na Mauzo",
    tabStats: "Takwimu za Utendaji",
    tabReferrals: "Mauzo na Tume",
    tabPayouts: "Historia ya Malipo",
    tabClicks: "Mibofyo Iliyorekodiwa",
    colDate: "Tarehe",
    colOrder: "Msimbo wa Agizo",
    colAmount: "Kiasi cha Mauzo",
    colComm: "Tume Ulizopata",
    colStatus: "Hali",
    statusPending: "Inasubiri Uhakiki",
    statusApproved: "Imeidhinishwa",
    statusPaid: "Imelipwa",
    colIP: "Anwani ya IP",
    colUA: "Maelezo ya Kivinjari",
    noReferrals: "Bado hakuna mauzo yaliyorekodiwa. Shiriki kiungo uanze kupata tume!",
    noPayouts: "Bado hujaomba malipo yoyote ya tume. Fikisha KES 1,500 kuomba malipo.",
    noClicks: "Bado hakuna mibofyo iliyonaswa. Shiriki kiungo chako ili kuvutia wateja!",
    paymentSaved: "Maelezo ya malipo yamehifadhiwa kikamilifu!",
    registerSuccess: "Karibu kwenye Kitovu cha Washirika cha SokoPlus!",
    payoutSuccess: "Ombi la malipo limepokelewa! Wasimamizi watalishughulikia ndani ya saa 48."
  }
};

export default function AffiliatePortal({ user: propUser }: { user: any }) {
  const { language } = useLanguage();
  const langKey = language === "sw" ? "sw" : "en";
  const text = pfTranslations[langKey];
  const navigate = useNavigate();

  const [fbUser, setFbUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "referrals" | "payouts" | "clicks">("stats");

  // State fields
  const [affiliate, setAffiliate] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Form fields
  const [mpesaNo, setMpesaNo] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankNameStr, setBankNameStr] = useState("");
  const [bankAccNo, setBankAccNo] = useState("");

  const [copied, setCopied] = useState(false);

  // Sound feedback trigger (acoustic hollow woodblock percussive sound)
  const triggerTickSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(360, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {
      console.debug("Tick sound bypassed", e);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (usr) => {
      setFbUser(usr);
      if (!usr) {
        setLoading(false);
      } else {
        fetchAffiliateStats(usr);
      }
    });
    return unsub;
  }, []);

  const fetchAffiliateStats = async (currentUser: any) => {
    try {
      setLoading(true);
      const idToken = await currentUser.getIdToken();
      const response = await axios.get("/api/affiliates/stats", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      
      const data = response.data;
      setAffiliate(data.affiliate);
      setReferrals(data.referrals || []);
      setPayouts(data.payouts || []);
      setChartData(data.chartData || []);

      // Populate bank / mpesa details
      if (data.affiliate) {
        setMpesaNo(data.affiliate.mpesaNumber || "");
        if (data.affiliate.bankDetails) {
          setBankHolderName(data.affiliate.bankDetails.holder || "");
          setBankNameStr(data.affiliate.bankDetails.bank || "");
          setBankAccNo(data.affiliate.bankDetails.acc || "");
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404 && error.response?.data?.firstTime) {
        setAffiliate(null);
      } else {
        console.error("Error loading partner dashboard data:", error);
        toast.error("Could not fetch affiliate statistics.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) return;
    setRegistering(true);
    triggerTickSound();

    try {
      const idToken = await fbUser.getIdToken();
      const response = await axios.post("/api/affiliates/register", {
        mpesaNumber: mpesaNo,
        bankDetails: {
          holder: bankHolderName,
          bank: bankNameStr,
          acc: bankAccNo
        }
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      if (response.data.success) {
        toast.success(text.registerSuccess, { icon: "🎉" });
        await fetchAffiliateStats(fbUser);
      }
    } catch (err: any) {
      console.error("Affiliate registration failure:", err);
      toast.error(err.response?.data?.error || "Failed to initialize affiliate account.");
    } finally {
      setRegistering(false);
    }
  };

  const updatePayoutPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) return;
    setSavingPayment(true);
    triggerTickSound();

    try {
      // Direct write operation adhering to strict write permission logic in Security Rules
      // Rules allow updating mpesaNumber and bankDetails if matching the authenticated UID
      const affDocRef = doc(db, "affiliates", fbUser.uid);
      await updateDoc(affDocRef, {
        mpesaNumber: mpesaNo,
        bankDetails: {
          holder: bankHolderName,
          bank: bankNameStr,
          acc: bankAccNo
        }
      });

      toast.success(text.paymentSaved, { icon: "💳" });
      // Reload details
      fetchAffiliateStats(fbUser);
    } catch (err: any) {
      console.error("Preferences write failed:", err);
      toast.error("Failed to commit disbursement details.");
    } finally {
      setSavingPayment(false);
    }
  };

  const requestPayout = async () => {
    if (!fbUser || !affiliate) return;
    if (affiliate.unpaidEarnings < 1500) {
      toast.error(text.minNotice);
      return;
    }

    triggerTickSound();
    const loadId = toast.loading("Processing disbursement request...");
    try {
      const idToken = await fbUser.getIdToken();
      await axios.post("/api/affiliates/payout-request", {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      toast.success(text.payoutSuccess, { id: loadId, icon: "💸" });
      fetchAffiliateStats(fbUser);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Disbursement clearance failed.", { id: loadId });
    }
  };

  const copyReferralLink = () => {
    if (!affiliate) return;
    const refLink = `${window.location.origin}?ref=${affiliate.referralCode}`;
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    triggerTickSound();
    toast.success("Affiliate referral link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">SokoPlus Hub</p>
        </div>
      </div>
    );
  }

  // Not logged in screen
  if (!fbUser) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-gray-150 rounded-2xl shadow-xl text-center font-sans">
        <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-black text-gray-950 tracking-tight mb-3">
          {text.notLoggedInTitle}
        </h2>
        <p className="text-gray-500 font-semibold text-sm mb-6 leading-relaxed">
          {text.notLoggedInDesc}
        </p>
        <button
          onClick={() => navigate("/login?redirect=affiliate-portal")}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 px-6 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
        >
          <span>{text.signInBtn}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  // Registration Form Screen (if not an affiliate yet)
  if (!affiliate) {
    return (
      <div className="max-w-2xl mx-auto my-12 px-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-150 rounded-2xl shadow-xl p-8 md:p-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-black uppercase tracking-widest bg-orange-50 text-orange-600 px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={12} />
              Partner Program
            </span>
          </div>

          <h2 className="text-3xl font-black text-gray-950 tracking-tight mb-2">
            {text.registerTitle}
          </h2>
          <p className="text-gray-500 font-medium mb-8 leading-relaxed">
            {text.registerSubtitle}
          </p>

          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-2">
                Safaricom M-Pesa Number
              </label>
              <input
                type="text"
                placeholder={text.mpesaPlaceholder}
                value={mpesaNo}
                onChange={(e) => setMpesaNo(e.target.value)}
                className="w-full border border-gray-250 bg-gray-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:bg-white transition-all font-mono"
              />
            </div>

            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl space-y-4">
              <span className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-orange-600" />
                Optional Bank Disbursement Details
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">
                    {text.bankHolder}
                  </label>
                  <input
                    type="text"
                    value={bankHolderName}
                    onChange={(e) => setBankHolderName(e.target.value)}
                    className="w-full border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">
                    {text.bankName}
                  </label>
                  <input
                    type="text"
                    value={bankNameStr}
                    onChange={(e) => setBankNameStr(e.target.value)}
                    className="w-full border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">
                  {text.bankAcc}
                </label>
                <input
                  type="text"
                  value={bankAccNo}
                  onChange={(e) => setBankAccNo(e.target.value)}
                  className="w-full border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={registering}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 text-sm flex items-center justify-center gap-2"
            >
              <span>{registering ? text.savingInfo : text.becomingBtn}</span>
              <ChevronRight size={18} />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Approved Partner Dashboard
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 relative font-sans text-gray-900 pb-28 md:pb-12">
      
      {/* Header and overview */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full inline-flex items-center gap-1 mb-3">
            <Award size={14} />
            SokoPlus Ambassador
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight italic text-gray-950">
            {text.portalTitle}
          </h1>
          <p className="text-gray-500 font-semibold text-sm max-w-2xl mt-1.5 leading-relaxed">
            {text.portalSubtitle}
          </p>
        </div>

        {/* Status Tag */}
        <div className="shrink-0 flex items-center gap-2 md:self-start bg-orange-500/10 border border-orange-500/15 py-2 px-4 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></div>
          <span className="text-xs font-black text-orange-700 uppercase tracking-widest">
            {affiliate.status === "approved" ? text.statusApproved : affiliate.status}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        
        <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{text.metricsClicks}</span>
            <Users size={16} />
          </div>
          <p className="text-2xl font-black font-mono">{Number(affiliate.clicksCount || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{text.metricsConvs}</span>
            <TrendingUp size={16} />
          </div>
          <p className="text-2xl font-black font-mono">{Number(affiliate.conversionsCount || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{text.metricsRate}</span>
            <Award size={16} />
          </div>
          <p className="text-2xl font-black font-mono">{(Number(affiliate.commissionRate || 0.10) * 100).toFixed(0)}%</p>
        </div>

        <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{text.metricsEarnings}</span>
            <DollarSign size={16} />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600">KES {Number(affiliate.totalEarnings || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm col-span-2 lg:col-span-1 border-orange-100 bg-orange-50/10">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-700">{text.metricsUnpaid}</span>
            <Wallet size={16} className="text-orange-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black font-mono text-orange-700">KES {Number(affiliate.unpaidEarnings || 0).toLocaleString()}</p>
            {affiliate.unpaidEarnings >= 1500 && (
              <button 
                onClick={requestPayout}
                className="text-[10px] font-black bg-orange-600 hover:bg-orange-700 text-white uppercase px-2 py-1 rounded inline-flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer"
              >
                <span>{text.payoutBtn}</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Referral link Box */}
      <div className="bg-white border-2 border-orange-100 p-6 rounded-2xl shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <Share2 size={16} className="text-orange-600 animate-pulse" />
            {text.refLinkTitle}
          </h3>
          <p className="text-xs text-gray-500 font-medium">Any purchaser arriving at Sokoplus using this link awards you 10% cash values!</p>
        </div>

        <div className="flex items-center gap-2 max-w-xl w-full md:w-auto">
          <input 
            type="text" 
            readOnly 
            value={`${window.location.origin}?ref=${affiliate.referralCode}`} 
            className="w-full bg-gray-50 border border-gray-250 font-mono text-xs rounded-xl px-4 py-3 text-gray-700 select-all focus:outline-none"
          />
          <button 
            onClick={copyReferralLink}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-5 rounded-xl transition-all shadow-md active:scale-95 relative overflow-hidden flex items-center gap-1.5 shrink-0 text-xs text-right cursor-pointer"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? text.copiedText : text.copyBtn}</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout (Stats Chart and settings) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Analytics line chart */}
        <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-sm lg:col-span-2">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-6 flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-500" />
            {text.chartTitle}
          </h3>

          <div className="h-64 h-min-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f5" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rbg(0,0,0,0.05)" }}
                />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#ea580c" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
                <Area type="monotone" dataKey="conversions" name="Conversions" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorConversions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* disbursement configuration */}
        <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Banknote size={16} className="text-gray-500" />
              {text.payoutDetailsTitle}
            </h3>

            <div className="text-xs text-orange-800 bg-orange-50 border border-orange-100 p-3 rounded-xl flex gap-2">
              <Info size={25} className="shrink-0 text-orange-600 mt-0.5" />
              <span>Earnings are accrued in Kenya Shillings (KES). Payouts are made directly to Safaricom M-Pesa or local bank wires upon requests.</span>
            </div>

            <form onSubmit={updatePayoutPreferences} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                  M-Pesa Payout Number
                </label>
                <input 
                  type="text" 
                  value={mpesaNo} 
                  onChange={(e) => setMpesaNo(e.target.value)} 
                  placeholder="07xxxxxxxx" 
                  className="w-full border border-gray-250 bg-gray-50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                  Bank Holder Name
                </label>
                <input 
                  type="text" 
                  value={bankHolderName} 
                  onChange={(e) => setBankHolderName(e.target.value)} 
                  className="w-full border border-gray-250 bg-gray-50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                    Bank Name
                  </label>
                  <input 
                    type="text" 
                    value={bankNameStr} 
                    onChange={(e) => setBankNameStr(e.target.value)} 
                    placeholder="e.g. Equity" 
                    className="w-full border border-gray-250 bg-gray-50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                    Account Number
                  </label>
                  <input 
                    type="text" 
                    value={bankAccNo} 
                    onChange={(e) => setBankAccNo(e.target.value)} 
                    className="w-full border border-gray-250 bg-gray-50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition-all font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={savingPayment}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest cursor-pointer mt-2"
              >
                {savingPayment ? text.savingInfo : text.savePayments}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Tabs list for logs */}
      <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Navigation buttons */}
        <div className="border-b border-gray-150 bg-gray-50 p-2 flex flex-wrap gap-1">
          <button 
            onClick={() => setActiveTab("stats")}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab==='stats' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            {text.tabStats}
          </button>
          <button 
            onClick={() => setActiveTab("referrals")}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab==='referrals' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            {text.tabReferrals}
          </button>
          <button 
            onClick={() => setActiveTab("payouts")}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab==='payouts' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            {text.tabPayouts}
          </button>
          <button 
            onClick={() => setActiveTab("clicks")}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab==='clicks' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            {text.tabClicks}
          </button>
        </div>

        {/* Tab Viewport */}
        <div className="p-6">
          
          <AnimatePresence mode="wait">
            
            {activeTab === "stats" && (
              <motion.div key="stats-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 border border-gray-150 rounded-xl space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ambassador Rules</span>
                      <h4 className="font-bold text-sm text-gray-800">10% Standard Commission Rate</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">Referral payouts are credited directly upon successful checkout payment. Commissions reside on a 7-day cleared hold window to prevent return/chargeback voids.</p>
                    </div>

                    <div className="p-5 border border-gray-150 rounded-xl space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Withdrawal Process</span>
                      <h4 className="font-bold text-sm text-gray-800">Disbursements limits</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">Once your unpaid commission balances cross KES 1,500, a standard Cashout Button activates on your dashboard allowing immediate transfer requests to M-Pesa or bank networks.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "referrals" && (
              <motion.div key="referrals-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {referrals.length === 0 ? (
                  <p className="text-center font-medium text-gray-400 text-xs py-8">{text.noReferrals}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-600">
                      <thead>
                        <tr className="border-b border-gray-150 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50">
                          <th className="py-3 px-4">{text.colDate}</th>
                          <th className="py-3 px-4">{text.colOrder}</th>
                          <th className="py-3 px-4">{text.colAmount}</th>
                          <th className="py-3 px-4">{text.colComm}</th>
                          <th className="py-3 px-4">{text.colStatus}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {referrals.map((r: any) => (
                          <tr key={r.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-4 font-mono font-medium">{r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)).toLocaleDateString() : ""}</td>
                            <td className="py-3 px-4 font-mono select-all">#{r.orderId.substring(0, 8).toUpperCase()}</td>
                            <td className="py-3 px-4 font-bold">{r.currency} {Number(r.orderTotalAmount).toLocaleString()}</td>
                            <td className="py-3 px-4 text-emerald-600 font-bold">{r.currency} {Number(r.commissionAmount).toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-block py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                r.status === "paid" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                r.status === "approved" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                                "bg-amber-50 text-amber-500 border border-amber-100"
                              }`}>
                                {r.status === "paid" ? text.statusPaid : r.status === "approved" ? text.statusApproved : text.statusPending}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "payouts" && (
              <motion.div key="payouts-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {payouts.length === 0 ? (
                  <p className="text-center font-medium text-gray-400 text-xs py-8">{text.noPayouts}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-600">
                      <thead>
                        <tr className="border-b border-gray-150 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50">
                          <th className="py-3 px-4">{text.colDate}</th>
                          <th className="py-3 px-4">Withdrawal ID</th>
                          <th className="py-3 px-4">Disbursed Amount</th>
                          <th className="py-3 px-4">{text.colStatus}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {payouts.map((p: any) => (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-4 font-mono font-medium">{p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)).toLocaleDateString() : ""}</td>
                            <td className="py-3 px-4 font-mono select-all">#{p.id.substring(0, 10).toUpperCase()}</td>
                            <td className="py-3 px-4 font-black text-orange-600">KES {Number(p.amount).toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-block py-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                {p.status === "paid" ? text.statusPaid : text.statusPending}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "clicks" && (
              <motion.div key="clicks-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {chartData.length === 0 ? (
                  <p className="text-center font-medium text-gray-400 text-xs py-8">{text.noClicks}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {chartData.map((day: any) => (
                        <div key={day.date} className="p-4 border border-gray-150 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="font-bold text-xs text-gray-800">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                            <p className="text-[10px] font-medium text-gray-400 font-mono">{day.date}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-orange-600 font-mono inline-block bg-orange-50 px-2 py-1 rounded">{day.clicks} Clicks</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </div>

    </div>
  );
}
