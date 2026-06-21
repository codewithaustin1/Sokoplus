import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
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
  Zap
} from "lucide-react";
import { calculateDelivery, DeliveryPrediction } from "../utils/delivery";

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

  // Simulation mode states
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedStage, setSimulatedStage] = useState<number>(0); 
  const [countdownMinutes, setCountdownMinutes] = useState<number>(45);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const autoSimInterval = useRef<NodeJS.Timeout | null>(null);

  // Swahili translations helper
  const isSw = language === "sw";
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

  // Timeline list of stages with custom copy in English/Swahili
  const stages = [
    {
      title: isSw ? "Agizo Limepokelewa" : "Order Received",
      desc: isSw ? "Agizo lako limethibitishwa na malipo kupokelewa salama." : "Order verified and payment cleared. Allocation of your artisan items completed.",
      estDuration: isSw ? "Dakika chache zilizopita" : "A few minutes ago",
      color: "border-orange-500 text-orange-600"
    },
    {
      title: isSw ? "Inafungashwa kwa Usafiri" : "Packaged for Dispatch",
      desc: isSw ? "Bidhaa zinakaguliwa ubora na kufungwa kwa lebo na vifuniko salama vyenye kufungwa maalum." : "Items undergo premium safety checks and are packed with SokoPlus tamper-evident security tape.",
      estDuration: isSw ? "Inatayarishwa" : "Ready for Departure",
      color: "border-blue-500 text-blue-600"
    },
    {
      title: isSw ? "Imekabidhiwa Msafirishaji" : "Assigned to Local Courier",
      desc: isSw ? "Mwendesha bodaboda au msafirishaji wa SokoPlus amekabidhiwa kifurushi chako jijini." : "Handed over to a dedicated SokoPlus express courier rider representing Kenya local logistics network.",
      estDuration: isSw ? "Imepangiwa" : "Courier Dispatched",
      color: "border-indigo-500 text-indigo-600"
    },
    {
      title: isSw ? "Njia Kuelekea Kwako" : "Out for Delivery",
      desc: isSw ? "Rider wetu yuko barabarani sasa akifuata mawasiliano ya ramani kuelekea kwako." : "The courier rider is in transit and navigating directly to your exact address. Keep your line on!",
      estDuration: isSw ? "Inawasili hivi sasa" : "In Transit",
      color: "border-pink-500 text-pink-600"
    },
    {
      title: isSw ? "Imefikishwa Kikamilifu" : "Delivered Successfully",
      desc: isSw ? "Kifurushi kimekabidhiwa mikononi mwako salama. Asante sana kwa kuunga mkono wasanii wa Kenya!" : "Delivered safely onto your hands. Thank you for empowering local Kenyan craftsmanship and communities!",
      estDuration: isSw ? "Kazi Imekamilika" : "Delivered",
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
      <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 bg-white dark:bg-gray-950 text-center space-y-8">
        <div className="bg-red-50 dark:bg-red-950/25 p-6 rounded-full border border-red-100 dark:border-red-900/50">
          <BadgeAlert size={56} className="text-red-500 dark:text-red-400" />
        </div>
        <div className="space-y-3 max-w-sm">
          <h1 className="text-3xl font-black italic text-gray-900 dark:text-white">{str.notFound}</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
            {str.notFoundDesc}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 min-w-[240px]">
          <Link to="/" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider text-xs px-6 py-4 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 text-center">
            {str.backButton}
          </Link>
          <Link to="/profile" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-black uppercase tracking-wider text-xs px-6 py-4 rounded-2xl hover:bg-gray-100 transition-colors text-center">
            {str.profileButton}
          </Link>
        </div>
      </div>
    );
  }

  // Derived location values
  const destCounty = order.shippingAddress?.county || "Nairobi City County";
  const destCity = order.shippingAddress?.city || "Nairobi CBD";
  const destAddress = order.shippingAddress?.addressLine || "Nairobi Central";
  const prediction: DeliveryPrediction = calculateDelivery(destCounty, destCity);

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
    </div>
  );
}
