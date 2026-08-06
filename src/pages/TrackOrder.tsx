import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useLanguage } from "../lib/LanguageContext";
import { useCurrency } from "../lib/CurrencyContext";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Truck, 
  CheckCircle2, 
  Package, 
  ShieldCheck, 
  User, 
  Phone, 
  AlertCircle,
  Play,
  Share2,
  Copy,
  ChevronRight,
  ExternalLink,
  Map,
  BadgeAlert,
  HelpCircle,
  Compass,
  Zap,
  QrCode,
  Edit3,
  PlusCircle,
  XCircle,
  Sliders,
  X,
  ShoppingBag
} from "lucide-react";
import { calculateDelivery, DeliveryPrediction } from "../utils/delivery";
import QRScannerModal from "../components/QRScannerModal";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
}

interface OrderData {
  id: string;
  userId: string;
  userEmail?: string;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "unpaid" | "paid";
  paymentReference?: string;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    addressLine: string;
    county: string;
    city: string;
    postalCode?: string;
  };
  createdAt?: any;
}

export default function TrackOrder() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { formatPrice } = useCurrency();

  // Determine Order ID from either route params or query params (like Paystack redirect)
  const orderId = id || searchParams.get("id") || searchParams.get("orderId") || "";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [searchOrderIdInput, setSearchOrderIdInput] = useState("");

  // Simulation mode states
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedStage, setSimulatedStage] = useState<number>(0); 
  const [countdownMinutes, setCountdownMinutes] = useState<number>(45);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const autoSimInterval = useRef<NodeJS.Timeout | null>(null);

  // Swahili translations helper
  const isSw = language === "sw";

  // Post-Purchase Self-Service Control States
  const [selfServiceSecondsLeft, setSelfServiceSecondsLeft] = useState<number>(1800); // 30-min window
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAddItemsModalOpen, setIsAddItemsModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSubmittingSelfService, setIsSubmittingSelfService] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [addressForm, setAddressForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    addressLine: "",
    city: "",
    county: ""
  });

  const quickAddons = [
    {
      productId: "addon-tote-bag",
      name: "SokoPlus Organic Cotton Tote Bag",
      price: 350,
      category: "Accessories",
      desc: "Heavy-duty reusable Kenyan canvas tote with double-stitched reinforced handles."
    },
    {
      productId: "addon-priority-pass",
      name: "Express Priority Dispatch Pass",
      price: 250,
      category: "Service",
      desc: "Bypasses order queue & guarantees top priority same-day rider dispatch."
    },
    {
      productId: "addon-gift-packaging",
      name: "Deluxe Eco Gift Packaging & Note",
      price: 200,
      category: "Packaging",
      desc: "Artisan Kenyan gift wrap with a personalized handwritten greeting card."
    },
    {
      productId: "addon-warranty-protect",
      name: "1-Year All-Inclusive Damage Protection",
      price: 500,
      category: "Protection",
      desc: "Hassle-free 100% instant product replacement for accidental drops or defects."
    }
  ];

  // Pre-fill address form & calculate self-service window remaining time
  useEffect(() => {
    if (order?.shippingAddress) {
      setAddressForm({
        firstName: order.shippingAddress.firstName || "",
        lastName: order.shippingAddress.lastName || "",
        phone: order.shippingAddress.phone || "",
        addressLine: order.shippingAddress.addressLine || "",
        city: order.shippingAddress.city || "",
        county: order.shippingAddress.county || ""
      });
    }

    if (order?.createdAt) {
      let createdTimeMillis = Date.now();
      if (order.createdAt?.toMillis) {
        createdTimeMillis = order.createdAt.toMillis();
      } else if (order.createdAt?.seconds) {
        createdTimeMillis = order.createdAt.seconds * 1000;
      } else if (typeof order.createdAt === "number") {
        createdTimeMillis = order.createdAt;
      } else if (typeof order.createdAt === "string") {
        createdTimeMillis = new Date(order.createdAt).getTime();
      }
      const elapsedSeconds = Math.floor((Date.now() - createdTimeMillis) / 1000);
      const remaining = Math.max(0, 1800 - elapsedSeconds);
      setSelfServiceSecondsLeft(remaining > 0 ? remaining : 1800);
    }
  }, [order]);

  // Self-service 30-min countdown ticker
  useEffect(() => {
    if (selfServiceSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSelfServiceSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [selfServiceSecondsLeft]);

  const formatSelfServiceCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSaveShippingAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !order) return;
    setIsSubmittingSelfService(true);
    try {
      const updatedAddress = {
        ...order.shippingAddress,
        ...addressForm
      };
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { shippingAddress: updatedAddress });
      setOrder({ ...order, shippingAddress: updatedAddress as any });
      setActionFeedback({
        type: "success",
        msg: isSw ? "Anwani ya uwasilishaji imesasishwa kwa mafanikio!" : "Delivery address updated in real-time! Courier rider notified."
      });
      setIsAddressModalOpen(false);
    } catch (err) {
      console.error("Error updating shipping address:", err);
      setActionFeedback({
        type: "error",
        msg: isSw ? "Imeshindwa kusasisha anwani." : "Failed to update address. Please try again."
      });
    } finally {
      setIsSubmittingSelfService(false);
    }
  };

  const handle1ClickAddItem = async (addon: { name: string; price: number; productId: string; category?: string }) => {
    if (!order || !orderId) return;
    setIsSubmittingSelfService(true);
    try {
      const newItem: OrderItem = {
        productId: addon.productId,
        name: addon.name,
        price: addon.price,
        quantity: 1,
        category: addon.category || "Add-on"
      };
      const updatedItems = [...(order.items || []), newItem];
      const updatedTotal = (order.totalAmount || 0) + addon.price;

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        items: updatedItems,
        totalAmount: updatedTotal
      });

      setOrder({
        ...order,
        items: updatedItems,
        totalAmount: updatedTotal
      });

      setActionFeedback({
        type: "success",
        msg: isSw 
          ? `Bidhaa "${addon.name}" imeongezwa kwa mguso 1!` 
          : `Added "${addon.name}" to your order in 1 click!`
      });
      setIsAddItemsModalOpen(false);
    } catch (err) {
      console.error("Error adding item to order:", err);
      setActionFeedback({
        type: "error",
        msg: isSw ? "Imeshindwa kuongeza bidhaa." : "Failed to add item to order."
      });
    } finally {
      setIsSubmittingSelfService(false);
    }
  };

  const handle1ClickCancelOrder = async () => {
    if (!orderId || !order) return;
    setIsSubmittingSelfService(true);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: "cancelled" });
      setOrder({ ...order, status: "cancelled" });
      setActionFeedback({
        type: "success",
        msg: isSw ? "Agizo limefutwa. Rejesho la pesa linafanyiwa kazi." : "Order cancelled successfully. Full refund initiated."
      });
      setIsCancelModalOpen(false);
    } catch (err) {
      console.error("Error cancelling order:", err);
      setActionFeedback({
        type: "error",
        msg: isSw ? "Imeshindwa kufuta agizo." : "Failed to cancel order."
      });
    } finally {
      setIsSubmittingSelfService(false);
    }
  };
  const str = {
    title: isSw ? "Ufuatiliaji wa Mzigo" : "Live Delivery Tracking",
    subtitle: isSw ? "Fuatilia agizo lako kwa wakati halisi kutoka duka letu hadi mlango wako" : "Track your order in real-time from our fulfillment center to your doorstep.",
    orderIdLabel: isSw ? "Kitambulisho cha Agizo" : "Order ID",
    statusLabel: isSw ? "Hali ya Agizo" : "Order Status",
    etaLabel: isSw ? "Muda wa Kufika" : "Estimated Arrival",
    paymentLabel: isSw ? "Hali ya Malipo" : "Payment Status",
    paidLabel: isSw ? "Imelipwa" : "Paid Securely",
    unpaidLabel: isSw ? "Haijalipwa" : "Pending Payment",
    deliveryTo: isSw ? "Inapelekwa Kwa" : "Delivery Destination",
    phoneLabel: isSw ? "Nambari ya Simu" : "Contact Phone",
    summaryTitle: isSw ? "Muhtasari wa Ununuzi" : "Order Summary",
    itemsCount: (count: number) => isSw ? `${count} bidhaa` : `${count} item(s)`,
    totalPaid: isSw ? "Jumla ya Malipo" : "Total Amount Paid",
    simTitle: isSw ? "Simulisha Safari ya Uwasilishaji" : "Interactive Delivery Simulator",
    simDesc: isSw 
      ? "Jaribu mfumo wa ufuatiliaji kuona jinsi gari letu linavyosafiri kuelekea kibanda chako kwa safari ya majaribio!" 
      : "Trigger simulated delivery updates to preview how tracking behaves when live riders dispatch. Great for testing!",
    simButtonPlay: isSw ? "Anza Simulizi" : "Run Auto-Simulation",
    simButtonStop: isSw ? "Simamisha Simulizi" : "Stop Auto-Simulation",
    simManualStep: isSw ? "Hatua Inayofuata" : "Manual Next Step",
    simRestart: isSw ? "Anza Upya" : "Reset Simulator",
    notFound: isSw ? "Agizo halikupatikana" : "Order Not Found",
    notFoundDesc: isSw 
      ? "Tafadhali kagua nambari ya agizo uliyoweka au rudi kwenye ukurasa wa akaunti."
      : "We couldn't locate this order code in SokoPlus database. Double check and try again.",
    backButton: isSw ? "Rudi Nyumbani" : "Back to Home",
    profileButton: isSw ? "Maagizo Yangu" : "My Orders History",
    copySuccess: isSw ? "Imesahihishwa!" : "Copied ID!",
    countyDefault: isSw ? "Wilaya" : "County",
    estimatedCount: isSw ? "Muda Unaosalia kufika" : "Estimated Delivery Countdown"
  };

  // Location helpers for customer-centric status
  const destCounty = order?.shippingAddress?.county || "Nairobi City County";
  const destCity = order?.shippingAddress?.city || "Nairobi CBD";
  const prediction: DeliveryPrediction = calculateDelivery(destCounty, destCity);

  // Timeline list of stages focused on customer destination and arrival
  const stages = [
    {
      title: isSw ? "Agizo Limethibitishwa" : "Order Confirmed",
      desc: isSw ? `Agizo lako limethibitishwa na linatayarishwa kuletwa ${destCity}.` : `Your order is confirmed and being prepared for delivery to ${destCity}.`,
      estDuration: isSw ? "Muda mfupi" : "Confirmed",
      color: "border-orange-500 text-orange-600"
    },
    {
      title: isSw ? "Inatayarishwa kwa Safari" : "Packing Your Items",
      desc: isSw ? `Bidhaa zako zinakaguliwa na kufungwa kwa makini kwa ajili ya safari ya kwenda ${destCity}.` : `Your items are carefully verified and packed to ensure safe arrival in ${destCity}.`,
      estDuration: isSw ? "Inatayarishwa" : "Preparing",
      color: "border-blue-500 text-blue-600"
    },
    {
      title: isSw ? `Njia Kuelekea ${destCity}` : `On Its Way to ${destCity}`,
      desc: isSw ? `Mzigo wako uko njiani kuelekea ${destCity} — unatarajiwa kuwasili ${prediction.time}.` : `Your package is on its way to ${destCity} — rider arrival expected by ${prediction.time}.`,
      estDuration: isSw ? "Safarini" : "On Its Way",
      color: "border-indigo-500 text-indigo-600"
    },
    {
      title: isSw ? `Rider Anakaribia ${destCity}` : `Rider Approaching ${destCity}`,
      desc: isSw ? `Rider wetu yuko karibu na eneo lako huko ${destCity}. Tafadhali weka simu yako wazi!` : `Our courier rider is navigating to your address in ${destCity}. Please keep your phone reachable!`,
      estDuration: isSw ? "Anawasili hivi sasa" : "Arriving Soon",
      color: "border-pink-500 text-pink-600"
    },
    {
      title: isSw ? "Imekabidhiwa Mikononi Mwako" : "Delivered to You",
      desc: isSw ? `Mzigo wako umefika salama ${destCity}. Asante sana kwa kuweka agizo na SokoPlus!` : `Your package has been delivered safely to you in ${destCity}. Thank you for shopping with SokoPlus!`,
      estDuration: isSw ? "Imekamilika" : "Delivered",
      color: "border-green-500 text-green-600"
    }
  ];

  // Fetch Order with listener
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("No Order ID provided.");
      return;
    }

    const docRef = doc(db, "orders", orderId);
    
    // Setup Firestore listener (onSnapshot) to support real-time post-purchase status dashboard changes
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as OrderData;
        setOrder({
          id: docSnap.id,
          ...data
        });
        
        // Match live state with default stages to initialize simulation stage if not customized
        if (!simulationActive) {
          const fsStatus = data.status;
          if (fsStatus === "pending") setSimulatedStage(0);
          else if (fsStatus === "processing") setSimulatedStage(1);
          else if (fsStatus === "shipped") setSimulatedStage(2);
          else if (fsStatus === "delivered") setSimulatedStage(4);
        }

        aliasCountdownTime(data);
        setError(null);
      } else {
        // Retry once on standard query fallback in case doc ID is uppercase reference
        fetchByReference(orderId);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching live tracking order:", err);
      setError("Could not establish live tracking link.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId, simulationActive]);

  const fetchByReference = async (refVal: string) => {
    try {
      // Fallback: search by paymentReference
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const q = query(collection(db, "orders"), where("paymentReference", "==", refVal));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const first = snap.docs[0];
        const data = first.data() as OrderData;
        setOrder({
          id: first.id,
          ...data
        });
        // Match live index
        const fsStatus = data.status;
        if (fsStatus === "pending") setSimulatedStage(0);
        else if (fsStatus === "processing") setSimulatedStage(1);
        else if (fsStatus === "shipped") setSimulatedStage(2);
        else if (fsStatus === "delivered") setSimulatedStage(4);
        
        aliasCountdownTime(data);
        setError(null);
      } else {
        setError("Invalid Order Token or Reference.");
      }
    } catch (e) {
      setError("Failed to fetch tracking details.");
    }
  };

  // Helper to dynamically set standard ETA countdown
  const aliasCountdownTime = (data: OrderData) => {
    const county = data.shippingAddress?.county || "Nairobi City County";
    const city = data.shippingAddress?.city || "Nairobi CBD";
    const predValue = calculateDelivery(county, city);
    // Standard simulated courier delivery: 45 minutes for Express, 120 minutes otherwise
    const duration = county.toLowerCase().includes("nairobi") ? 45 : 120;
    setCountdownMinutes(duration);
  };

  // Setup simulation countdown ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prevSec) => {
        if (prevSec > 0) {
          return prevSec - 1;
        } else {
          setCountdownMinutes((prevMin) => {
            if (prevMin > 0) {
              return prevMin - 1;
            } else {
              clearInterval(timer);
              return 0;
            }
          });
          return 59;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [simulatedStage]);

  // Handle Automatic Simulation Sequence Toggle
  const toggleAutoSimulation = () => {
    if (simulationActive) {
      stopAutoSim();
    } else {
      setSimulationActive(true);
      // Auto transition every 4.5 seconds to next stage with audio click/beep placeholder logs
      autoSimInterval.current = setInterval(() => {
        setSimulatedStage((prev) => {
          if (prev >= 4) {
            stopAutoSim();
            return 4;
          }
          return prev + 1;
        });
      }, 4500);
    }
  };

  const stopAutoSim = () => {
    setSimulationActive(false);
    if (autoSimInterval.current) {
      clearInterval(autoSimInterval.current);
      autoSimInterval.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (autoSimInterval.current) clearInterval(autoSimInterval.current);
    };
  }, []);

  const copyOrderId = () => {
    if (order?.id) {
      navigator.clipboard.writeText(order.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-orange-550 border-t-transparent rounded-full animate-spin"></div>
          <Compass className="absolute inset-0 m-auto text-orange-600 animate-pulse" size={24} />
        </div>
        <p className="mt-4 text-xs font-black uppercase text-gray-400 tracking-widest leading-relaxed">
          {isSw ? "Tunamulika anwani ya usafiri..." : "Connecting Direct Logistics Link..."}
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 bg-gray-50/50 dark:bg-gray-950 text-center py-12">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-8 rounded-[2.5rem] shadow-xl space-y-8">
          <div className="bg-orange-50 dark:bg-orange-950/20 p-6 rounded-full border border-orange-100 dark:border-orange-900/30 w-fit mx-auto relative">
            <Truck size={48} className="text-orange-600 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2.5xl font-black tracking-tight text-gray-950 dark:text-white">
              {isSw ? "Soma kadi au Tafuta Agizo" : "Track Your Order"}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
              {isSw 
                ? "Tafadhali weka kitambulisho cha agizo au soma msimbo wa barua ili kufuatilia mzigo wako kwa muda halisi."
                : "Enter your order reference code or scan a receipt QR code to instantly track dispatch milestones."}
            </p>
          </div>

          {/* Interactive Search Field and QR Scanner Trigger */}
          <div className="space-y-3.5 pt-2">
            <div className="relative">
              <input
                type="text"
                placeholder={isSw ? "Mfano: SOKO_ORDER_123..." : "Enter Order Reference ID..."}
                value={searchOrderIdInput}
                onChange={(e) => setSearchOrderIdInput(e.target.value)}
                className="w-full pl-5 pr-12 py-4 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-bold placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setIsQRModalOpen(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
                title={isSw ? "Soma msimbo wa QR" : "Scan receipt QR"}
              >
                <QrCode size={20} />
              </button>
            </div>

            <button
              onClick={() => {
                const cleanedId = searchOrderIdInput.trim().replace(/^#/, "");
                if (cleanedId) {
                  navigate(`/track-order/${cleanedId}`);
                }
              }}
              disabled={!searchOrderIdInput.trim()}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-black uppercase tracking-wider text-xs py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              {isSw ? "Tafuta na Ufuatilie" : "Locate & Track Order"}
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-150 dark:border-gray-800"></div>
            <span className="flex-shrink mx-4 text-[10px] text-gray-400 uppercase font-black tracking-widest">Or</span>
            <div className="flex-grow border-t border-gray-150 dark:border-gray-800"></div>
          </div>

          <div className="flex gap-4">
            <Link to="/" className="w-full py-4.5 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 border border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-black uppercase tracking-wider text-[10px] rounded-2xl transition-all hover:bg-gray-100 text-center">
              {str.backButton}
            </Link>
            <Link to="/profile" className="w-full py-4.5 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 border border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-black uppercase tracking-wider text-[10px] rounded-2xl transition-all hover:bg-gray-100 text-center">
              {str.profileButton}
            </Link>
          </div>
        </div>

        <QRScannerModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          language={language === "sw" ? "sw" : "en"}
        />
      </div>
    );
  }

  // Derived location values
  const destAddress = order.shippingAddress?.addressLine || "Nairobi Central";

  // Math countdown remaining variables
  const getSimulatedMinutes = () => {
    if (simulatedStage === 4) return 0;
    if (simulatedStage === 3) return Math.min(countdownMinutes, 15);
    if (simulatedStage === 2) return Math.min(countdownMinutes, 30);
    return countdownMinutes;
  };

  const getSimulatedSeconds = () => {
    if (simulatedStage === 4) return 0;
    return countdownSeconds;
  };

  const currentActiveStageIndex = simulatedStage;

  return (
    <div className="min-h-screen bg-gray-50/40 dark:bg-gray-950/20 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* TOP COHESIVE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-2">
            <button 
              onClick={() => navigate(-1)} 
              className="group inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 hover:text-orange-600 transition-colors cursor-pointer mb-2"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              {isSw ? "Nyuma" : "Back"}
            </button>
            <h1 className="text-3.5xl font-black italic tracking-tighter text-gray-900 dark:text-white font-sans leading-none flex items-center gap-3">
              <Truck className="text-orange-600 animate-bounce" size={32} />
              {str.title}
            </h1>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-450 max-w-lg leading-relaxed">
              {str.subtitle}
            </p>
          </div>

          {/* Quick Stats Badge Container */}
          <div className="flex flex-wrap sm:flex-col items-start gap-4 p-5 bg-gray-50/50 dark:bg-gray-950/30 rounded-3xl border border-gray-100/60 dark:border-gray-800/80 min-w-[220px]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{str.orderIdLabel}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-sm font-extrabold text-gray-900 dark:text-orange-400 select-all">
                  #{order.id.slice(0, 12).toUpperCase()}
                </span>
                <button 
                  onClick={copyOrderId} 
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-orange-600 transition-all cursor-pointer"
                  title="Copy Code"
                >
                  {copied ? <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">{str.copySuccess}</span> : <Copy size={13} />}
                </button>
                <button 
                  onClick={() => setIsQRModalOpen(true)} 
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-orange-600 transition-all cursor-pointer"
                  title={isSw ? "Soma agizo lingine" : "Scan another order QR"}
                >
                  <QrCode size={13} />
                </button>
              </div>
            </div>
            
            <div className="w-full h-px bg-gray-150/40 dark:bg-gray-800" />

            <div className="flex items-center justify-between w-full">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">{str.statusLabel}</p>
                <div className="text-xs font-black tracking-tight text-orange-600 dark:text-orange-500 uppercase mt-1">
                  {stages[currentActiveStageIndex].title}
                </div>
              </div>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
            </div>
          </div>
        </div>

        {/* MAIN SPLIT GRID layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT: TIMELINE PROGRESSION LIST (2 Cols) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* REAL-TIME STEPS CONTAINER */}
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-[0_4px_25px_rgba(0,0,0,0.02)] space-y-8">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800/60 pb-5">
                <h2 className="text-xl font-black text-gray-900 dark:text-white font-sans tracking-tight">
                  {isSw ? "Matukio ya Uwasilishaji" : "Delivery Milestones"}
                </h2>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-full border border-green-105-20 text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck size={12} />
                  {isSw ? "Imehakikiwa" : "Live Feed Connected"}
                </div>
              </div>

              {/* Customer-Centric Live Delivery Status Banner */}
              <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-orange-500/10 border border-orange-200/60 dark:border-orange-800/40 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Truck size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                      {isSw ? "Hali ya Mzigo Wako" : "Customer Arrival Guarantee"}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-gray-900 dark:text-white mt-0.5">
                      {isSw 
                        ? `Mzigo wako uko njiani kuelekea ${destCity} — Rider ataagiza kabla ya ${prediction.time}` 
                        : `Your package is on its way to ${destCity} — Rider standard arrival by ${prediction.time}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* POST-PURCHASE SELF-SERVICE CONTROL PANEL */}
              {order && order.status !== "cancelled" && order.status !== "delivered" && (
                <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-indigo-500/10 border-2 border-orange-200/80 dark:border-orange-800/60 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-md">
                        <Sliders size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest bg-orange-100 dark:bg-orange-950/60 px-2.5 py-0.5 rounded-md border border-orange-200/50">
                            {isSw ? "Udhibiti wa Agizo la Wateja" : "Post-Purchase Self-Service Control"}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1 leading-snug">
                          {isSw 
                            ? "Je, unahitaji kubadilisha kitu? Unayo dakika 30 kurekebisha anwani yako au kuongeza bidhaa kwa mguso 1." 
                            : "Need to change something? You have 30 minutes to edit your delivery address or add items in 1 click."}
                        </h4>
                      </div>
                    </div>

                    {/* Countdown timer badge */}
                    {selfServiceSecondsLeft > 0 && (
                      <div className="flex items-center gap-2 bg-orange-600 text-white px-3.5 py-2 rounded-2xl shadow-sm shrink-0 self-start sm:self-auto">
                        <Clock size={16} className="animate-pulse" />
                        <div className="text-right">
                          <p className="text-[8px] uppercase tracking-wider font-bold opacity-80">{isSw ? "Muda Unaosalia" : "Self-Service Window"}</p>
                          <p className="text-xs font-mono font-black">{formatSelfServiceCountdown(selfServiceSecondsLeft)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Self-Service Action Buttons */}
                  {selfServiceSecondsLeft > 0 ? (
                    <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-orange-200/40 dark:border-orange-900/30">
                      <button
                        type="button"
                        onClick={() => setIsAddressModalOpen(true)}
                        className="px-4 py-2.5 bg-white dark:bg-gray-900 hover:bg-orange-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                      >
                        <Edit3 size={15} className="text-orange-600" />
                        {isSw ? "Badilisha Anwani" : "Edit Delivery Address"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsAddItemsModalOpen(true)}
                        className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <PlusCircle size={15} />
                        {isSw ? "Ongeza Bidhaa (Mguso 1)" : "Add Items in 1 Click"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCancelModalOpen(true)}
                        className="px-4 py-2.5 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer ml-auto"
                      >
                        <XCircle size={15} />
                        {isSw ? "Futa Agizo" : "Cancel Order"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 font-medium pt-1">
                      {isSw 
                        ? "Dirisha la kujihudumia limeshafungwa kwani mzigo uko njiani kufungwa na kusafirishwa. Tafadhali wasiliana na rider wako moja kwa moja hapo chini." 
                        : "Self-service modification window has closed as rider dispatch is in progress. Please contact your courier rider directly below."}
                    </p>
                  )}

                  {/* Action Feedback Toast */}
                  {actionFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
                        actionFeedback.type === "success" 
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200" 
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        {actionFeedback.msg}
                      </span>
                      <button onClick={() => setActionFeedback(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}
                </div>
              )}

              {/* VERTICAL DESIGN PROGRESS TRACKING */}
              <div className="relative pl-6 sm:pl-10 space-y-10">
                {/* Connector strip background */}
                <div className="absolute left-[13px] sm:left-[21px] top-1.5 bottom-1.5 w-[3px] bg-gray-100 dark:bg-gray-800 rounded-full" />
                
                {/* Active connecting strip overlay fill */}
                <div 
                  className="absolute left-[13px] sm:left-[21px] top-1.5 w-[3px] bg-gradient-to-b from-orange-550 to-orange-400 rounded-full transition-all duration-700 ease-in-out" 
                  style={{
                    height: `${(currentActiveStageIndex / (stages.length - 1)) * 95}%`
                  }}
                />

                {stages.map((stg, index) => {
                  const isPast = index < currentActiveStageIndex;
                  const isActive = index === currentActiveStageIndex;
                  const isFuture = index > currentActiveStageIndex;

                  return (
                    <motion.div 
                      key={index} 
                      className={`relative flex items-start gap-4 sm:gap-6 group transition-all duration-300 ${isFuture ? "opacity-45" : "opacity-100"}`}
                      initial={false}
                      animate={{
                        scale: isActive ? 1.01 : 1,
                      }}
                    >
                      {/* Step index badge indicator / check-offs */}
                      <div className="absolute -left-[27px] sm:-left-[35px] top-0 z-20 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          {isPast ? (
                            <motion.div 
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] bg-green-500 rounded-full text-white flex items-center justify-center shadow-md shadow-green-100 dark:shadow-none"
                            >
                              <CheckCircle2 size={16} className="text-white" />
                            </motion.div>
                          ) : isActive ? (
                            <motion.div 
                              key="active"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] bg-orange-600 rounded-full text-white flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-none ring-4 ring-orange-100 dark:ring-orange-950/40 relative"
                            >
                              <Truck size={14} className="text-white relative z-10 animate-pulse" />
                              <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-60 pointer-events-none" />
                            </motion.div>
                          ) : (
                            <motion.div 
                              key="future"
                              className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-full text-gray-300 text-xs font-black flex items-center justify-center"
                            >
                              {index + 1}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Timeline contents */}
                      <div className="space-y-1.5 flex-grow">
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                          <h3 className={`text-sm sm:text-lg font-black tracking-tight ${isActive ? "text-orange-650 dark:text-orange-500" : "text-gray-900 dark:text-white"}`}>
                            {stg.title}
                          </h3>
                          <span className={`text-[10px] font-mono tracking-tight font-black uppercase ${isActive ? "text-orange-500" : "text-gray-400"}`}>
                            {isActive ? (isSw ? "Hali hii" : "Active Stage") : stg.estDuration}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                          {stg.desc}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Simulated Map Visual representation */}
              <div className="mt-6 pt-5 border-t border-gray-50 dark:border-gray-800/70 space-y-4">
                <div className="flex items-center justify-between text-xs text-gray-455">
                  <span className="font-bold flex items-center gap-1.5"><Map size={13} /> SokoPlus Fleet Route Monitoring</span>
                  <span className="font-mono text-gray-400 font-medium">GPS Signal Verified</span>
                </div>
                
                {/* Creative CSS Route Map illustration with animated vehicle moving along path */}
                <div className="h-44 rounded-3xl bg-slate-50 dark:bg-gray-950 border border-gray-150/40 dark:border-gray-800 relative overflow-hidden flex items-center justify-center select-none">
                  {/* Grid overlay lines to mock physical map scales */}
                  <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

                  {/* Curved visual tracks */}
                  <div className="absolute w-[80%] h-12 border-b-2 border-dashed border-gray-300 dark:border-gray-700 rounded-b-[40px] pointer-events-none" />

                  {/* Origin Hub Indicator */}
                  <div className="absolute left-[12%] bottom-[20%] z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 flex items-center justify-center shadow-xs">
                      <Package size={14} className="text-orange-600" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-tight text-gray-400 mt-1">Nairobi Hub</span>
                  </div>

                  {/* Destination Point Indicator */}
                  <div className="absolute right-[12%] bottom-[20%] z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-105-30 border border-green-200 dark:border-green-900/50 flex items-center justify-center shadow-xs animate-bounce">
                      <MapPin size={14} className="text-green-600" />
                    </div>
                    <span className="text-[9px] font-big font-black uppercase tracking-tight text-gray-400 mt-1">
                      {destCity.slice(0, 11)}
                    </span>
                  </div>

                  {/* Moving courier vehicle according to selected active stage */}
                  <motion.div 
                    className="absolute z-20 flex flex-col items-center justify-center"
                    animate={{
                      left: `${12 + (currentActiveStageIndex * 19)}%`,
                      bottom: currentActiveStageIndex === 0 ? "20%" : currentActiveStageIndex === 1 ? "18%" : currentActiveStageIndex === 2 ? "12%" : currentActiveStageIndex === 3 ? "14%" : "20%"
                    }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                  >
                    <div className="p-2.5 bg-orange-600 text-white rounded-full shadow-lg border-2 border-white ring-4 ring-orange-100 dark:ring-orange-950/20">
                      <Truck size={16} className={`${currentActiveStageIndex > 0 && currentActiveStageIndex < 4 ? "animate-bounce" : ""}`} />
                    </div>
                    {currentActiveStageIndex > 0 && currentActiveStageIndex < 4 && (
                      <span className="text-[8px] bg-orange-500 text-white font-extrabold px-1 py-0.5 rounded-md uppercase tracking-tight scale-90 mt-1">
                        In Transit
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>

            </div>

            {/* PREVIEW SIMULATOR CONTROLS */}
            <div className="bg-orange-50/25 dark:bg-orange-950/10 border-2 border-orange-100/40 dark:border-orange-900/40 rounded-[2.5rem] p-6 sm:p-8 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 rounded-2xl shrink-0 border border-orange-200/50">
                  <Zap size={18} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-orange-950 dark:text-orange-400">
                    {str.simTitle}
                  </h3>
                  <p className="text-xs text-orange-900/70 dark:text-orange-505 leading-relaxed font-semibold">
                    {str.simDesc}
                  </p>
                </div>
              </div>

              {/* CONTROLS */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button 
                  onClick={toggleAutoSimulation} 
                  className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    simulationActive 
                      ? "bg-red-500 hover:bg-red-655 text-white shadow-lg" 
                      : "bg-orange-650 hover:bg-orange-700 text-white shadow-md"
                  }`}
                >
                  <Play size={13} fill="currentColor" className={simulationActive ? "animate-spin" : ""} />
                  {simulationActive ? str.simButtonStop : str.simButtonPlay}
                </button>

                <button 
                  onClick={() => {
                    stopAutoSim();
                    setSimulatedStage((prev) => Math.min(prev + 1, 4));
                  }}
                  disabled={simulatedStage >= 4}
                  className="px-5 py-3 bg-white hover:bg-gray-50 border border-gray-150 rounded-2xl text-xs font-black uppercase tracking-wider text-gray-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight size={14} />
                  {str.simManualStep}
                </button>

                <button 
                  onClick={() => {
                    stopAutoSim();
                    setSimulatedStage(0);
                    aliasCountdownTime(order);
                  }}
                  className="px-5 py-3 bg-white hover:bg-gray-50 border border-gray-150 rounded-2xl text-xs font-black uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  {str.simRestart}
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: RECIPIENT COUNTDOWN, ORDER CONTENTS & CTAs (1 Col) */}
          <div className="space-y-8">
            
            {/* EST COUNTDOWN CONTAINER */}
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-[0_4px_25px_rgba(0,0,0,0.02)] space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="space-y-1 pb-4 border-b border-gray-50 dark:border-gray-800/60 w-full">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                  <Clock size={12} className="text-orange-550 animate-pulse" />
                  {str.estimatedCount}
                </span>
                <h4 className="text-sm font-black text-gray-900 dark:text-gray-150">
                  {isSw ? "Makadirio ya kuwasili" : "Expected Delivery Goal"}
                </h4>
              </div>

              {simulatedStage === 4 ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600 border border-green-200">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h5 className="text-lg font-black text-gray-900 dark:text-white">{isSw ? "Mzigo Umewasilishwa!" : "Delivered Today!"}</h5>
                    <p className="text-xs text-gray-450 mt-1">{isSw ? "Tayari umeshapokea bidhaa zako kwa mafanikio." : "Package successfully accepted at delivery address."}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-5 bg-orange-50/30 dark:bg-orange-950/20 border border-orange-100/30 dark:border-orange-900/30 rounded-3xl">
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-4xl font-black text-orange-650 tracking-tight">
                        {getSimulatedMinutes().toString().padStart(2, "0")}
                      </span>
                      <span className="text-xs font-bold text-orange-450 uppercase">Min</span>
                      <span className="text-3xl font-black text-gray-700 dark:text-gray-300">
                        {getSimulatedSeconds().toString().padStart(2, "0")}
                      </span>
                      <span className="text-xs font-bold text-gray-400 uppercase">Sec</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-semibold text-gray-500 leading-relaxed text-center">
                    <p>
                      {isSw ? "Inapelekwa kuelekea:" : "Transiting dynamically via express courier to:"}
                    </p>
                    <p className="font-extrabold text-gray-900 dark:text-white font-sans flex items-center justify-center gap-1">
                      <MapPin size={12} className="text-orange-600" /> {destAddress}, {destCity}
                    </p>
                  </div>
                </div>
              )}

              {/* Detailed courier profile mockup */}
              {simulatedStage >= 2 && (
                <div className="bg-gray-55 dark:bg-gray-950 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black text-sm">
                    SK
                  </div>
                  <div className="flex-grow space-y-0.5 min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Your SokoPlus Courier</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">Sammy Kiprop</p>
                    <span className="text-[9px] bg-green-50 text-green-700 font-extrabold px-1.5 py-0.5 rounded-md border border-green-200 flex items-center w-fit gap-1 select-none">
                      <ShieldCheck size={10} /> Verified Rider
                    </span>
                  </div>
                  <a href="tel:+254700000000" className="p-2.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-2xl border border-orange-100 shrink-0 transition-colors">
                    <Phone size={15} />
                  </a>
                </div>
              )}
            </div>

            {/* SHIPPING INFO */}
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-[0_4px_25px_rgba(0,0,0,0.02)] space-y-4">
              <h4 className="text-sm font-black uppercase text-gray-400 tracking-wider">
                {str.deliveryTo}
              </h4>
              
              <div className="space-y-3.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <User size={15} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white leading-tight">
                      {order.shippingAddress?.firstName} {order.shippingAddress?.lastName}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                      {order.shippingAddress?.addressLine}
                    </p>
                    <p className="text-gray-500 font-bold text-xs mt-0.5">
                      {destCity}, {destCounty}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Phone size={15} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase">{str.phoneLabel}</p>
                    <p className="font-mono font-bold text-gray-900 dark:text-gray-250 mt-0.5">
                      {order.shippingAddress?.phone}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* PAYMENT SUCCESS BILL */}
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 md:p-8 border border-gray-100 dark:border-gray-800 inset-y-0 shadow-[0_4px_25px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800/60 pb-3">
                <h4 className="text-sm font-black uppercase text-gray-400 tracking-wider">
                  {str.summaryTitle}
                </h4>
                <p className="text-xs text-gray-450 font-bold">
                  {str.itemsCount(order.items?.length || 0)}
                </p>
              </div>

              {/* Loop order items */}
              <div className="max-h-48 overflow-y-auto space-y-3 pr-1 divide-y divide-gray-50 dark:divide-gray-800/40">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 text-sm pt-3 first:pt-0">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-extrabold text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400 font-bold">
                        Qty: {item.quantity} × {formatPrice(item.price)}
                      </p>
                    </div>
                    <span className="font-extrabold text-gray-900 dark:text-gray-100 shrink-0">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="h-px bg-gray-150/40 dark:bg-gray-800" />

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-gray-550 font-semibold">{str.estimatedCount} Status</span>
                <span className={`text-xs px-2.5 py-0.5 font-black uppercase rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700'}`}>
                  {order.paymentStatus === "paid" ? str.paidLabel : str.unpaidLabel}
                </span>
              </div>

              {/* Bottom overall total billing paid */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs font-black uppercase text-gray-400">{str.totalPaid}</p>
                <p className="text-lg font-black text-orange-600 dark:text-orange-500">
                  {formatPrice(order.totalAmount)}
                </p>
              </div>
            </div>

            {/* CONTEXT DIRECT QUICK PAGE ACCESS */}
            <div className="flex flex-col gap-3.5">
              <Link to="/" className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-widest text-center rounded-2.5xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2">
                {str.backButton} <ChevronRight size={14} />
              </Link>
              <Link to="/profile" className="w-full py-4 bg-white hover:bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-200 font-black text-xs uppercase tracking-widest text-center rounded-2.5xl transition-colors">
                {str.profileButton}
              </Link>
            </div>

          </div>

        </div>

      </div>

      {/* EDIT DELIVERY ADDRESS MODAL */}
      <AnimatePresence>
        {isAddressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-100 dark:bg-orange-950 text-orange-600 rounded-xl">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                      {isSw ? "Badilisha Anwani ya Mzigo" : "Edit Delivery Address"}
                    </h3>
                    <p className="text-xs text-gray-400 font-semibold">
                      {isSw ? "Sasisha anwani yako bure ndani ya dakika 30" : "Real-time post-purchase address modification"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddressModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveShippingAddress} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={addressForm.firstName}
                      onChange={(e) => setAddressForm({ ...addressForm, firstName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={addressForm.lastName}
                      onChange={(e) => setAddressForm({ ...addressForm, lastName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">Street Address / Building / Landmark</label>
                  <input
                    type="text"
                    required
                    value={addressForm.addressLine}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">City / Town</label>
                    <input
                      type="text"
                      required
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">County</label>
                    <input
                      type="text"
                      required
                      value={addressForm.county}
                      onChange={(e) => setAddressForm({ ...addressForm, county: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(false)}
                    className="w-1/2 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold text-xs uppercase rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSelfService}
                    className="w-1/2 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmittingSelfService ? "Saving..." : "Save & Notify Rider"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD ITEMS IN 1 CLICK MODAL */}
      <AnimatePresence>
        {isAddItemsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-100 dark:bg-orange-950 text-orange-600 rounded-xl">
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                      {isSw ? "Ongeza Bidhaa kwa Mguso 1" : "Add Items in 1 Click"}
                    </h3>
                    <p className="text-xs text-gray-400 font-semibold">
                      {isSw ? "Sasa bidhaa moja kwa moja kwenye agizo hili kabla halijatoka" : "Seamlessly append add-ons to your package before rider dispatch"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddItemsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                {quickAddons.map((addon) => (
                  <div 
                    key={addon.productId}
                    className="p-4 bg-gray-50 dark:bg-gray-800/60 border border-gray-150 dark:border-gray-700/60 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/50 px-2 py-0.5 rounded-md">
                        {addon.category}
                      </span>
                      <p className="font-extrabold text-xs text-gray-900 dark:text-white truncate mt-1">
                        {addon.name}
                      </p>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        {addon.desc}
                      </p>
                      <p className="font-black text-xs text-gray-900 dark:text-white pt-1">
                        {formatPrice(addon.price)}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmittingSelfService}
                      onClick={() => handle1ClickAddItem(addon)}
                      className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase shrink-0 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      Add
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  No extra shipping fee added • Consolidates with current package
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CANCEL ORDER MODAL */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl relative text-center"
            >
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <XCircle size={28} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  {isSw ? "Je, una uhakika wa kufuta agizo hili?" : "Cancel Order Self-Service?"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  {isSw 
                    ? "Ufutiliaji ni wa papo hapo. Pesa zako zitarudishwa moja kwa moja bila kuhitaji kupigia huduma kwa wateja simu." 
                    : "Self-service cancellation is immediate. Your full payment refund will be initiated instantly without needing to contact vendor support."}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="w-1/2 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold text-xs uppercase rounded-xl transition-colors cursor-pointer"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={isSubmittingSelfService}
                  onClick={handle1ClickCancelOrder}
                  className="w-1/2 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isSubmittingSelfService ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <QRScannerModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        language={language === "sw" ? "sw" : "en"}
      />
    </div>
  );
}
