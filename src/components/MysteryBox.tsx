import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Gift, Truck, Key, Check, Copy, RefreshCw, Star, Percent } from "lucide-react";
import { doc, arrayUnion, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import toast from "react-hot-toast";

interface MysteryBoxProps {
  userId?: string | null;
  orderId?: string;
}

interface Reward {
  id: string;
  title: string;
  badge: string;
  description: string;
  code: string;
  icon: "truck" | "points" | "gift" | "star";
  color: string;
  bgGradient: string;
}

const REWARDS_POOL: Reward[] = [
  {
    id: "free-shipping",
    title: "Free Nationwide Shipping",
    badge: "SAVER REWARD",
    description: "Enjoy zero delivery fees on your next order, absolutely free!",
    code: "SOKO-SHIP-FREE-NEXT",
    icon: "truck",
    color: "from-blue-500 to-cyan-500",
    bgGradient: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/10"
  },
  {
    id: "points-multiplier",
    title: "1.5x Loyalty Points Multiplier",
    badge: "LOYALTY BOOST",
    description: "Earn 1.5 times the loyalty points on your next purchase!",
    code: "SOKO-POINTS-MULTIPLY",
    icon: "points",
    color: "from-amber-500 to-orange-500",
    bgGradient: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10"
  },
  {
    id: "gift-voucher",
    title: "KES 500 Shopping Voucher",
    badge: "CASH VOUCHER",
    description: "Get KES 500 off your next checkout basket total with no minimum spend.",
    code: "SOKO-VOUCH-500K",
    icon: "gift",
    color: "from-emerald-500 to-teal-500",
    bgGradient: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/10"
  },
  {
    id: "artisan-pass",
    title: "Artisan Guild Golden Pass",
    badge: "EXCLUSIVE VIP DROP",
    description: "Early premier access & priority reserve on extremely rare, handmade collections.",
    code: "SOKO-VIP-ARTISAN-PASS",
    icon: "star",
    color: "from-purple-500 to-pink-500",
    bgGradient: "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/10"
  }
];

function getVoucherBgImage(voucherId: string, code: string): string {
  const id = (voucherId || "").toLowerCase();
  const c = (code || "").toLowerCase();
  if (id.includes("shipping") || c.includes("ship")) {
    return "/free_shipping_voucher.jpg"; // premium shipping voucher card recreated design
  }
  if (id.includes("points") || c.includes("multiply")) {
    return "/loyalty_points_voucher.jpg"; // premium loyalty points background
  }
  if (id.includes("voucher") || c.includes("vouch")) {
    return "/cash_voucher_bg.jpg"; // premium cash voucher background design
  }
  if (id.includes("pass") || c.includes("vip") || id.includes("artisan")) {
    return "/artisan_pass_bg.jpg"; // premium VIP artisan pass background design
  }
  return "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=600&auto=format&fit=crop"; // general fallback workbench
}

export default function MysteryBox({ userId, orderId }: MysteryBoxProps) {
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [revealPhase, setRevealPhase] = useState<"idle" | "shaking" | "opened">("idle");
  const [revealedReward, setRevealedReward] = useState<Reward | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Box hover state tracks for each box index
  const [hoveredBox, setHoveredBox] = useState<number | null>(null);

  const handleBoxClick = async (boxIdx: number) => {
    if (selectedBox !== null) return; // Prevent double trigger

    setSelectedBox(boxIdx);
    setRevealPhase("shaking");

    // Randomize winning selection but make it feel incredibly personalized
    const randomIndex = Math.floor(Math.random() * REWARDS_POOL.length);
    const reward = REWARDS_POOL[randomIndex];

    // Shake for 1.5 seconds, then explode and open!
    setTimeout(async () => {
      setRevealPhase("opened");
      setRevealedReward(reward);

      // Save to localStorage
      localStorage.setItem("sokoplus_unlocked_reward", JSON.stringify(reward));

      // If user is authenticated, save it to their Firestore document to ensure durability
      if (userId) {
        setSaving(true);
        try {
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, {
            vouchers: arrayUnion({
              ...reward,
              unlockedAt: new Date().toISOString(),
              orderId: orderId || "direct",
              status: "active"
            })
          });
          toast.success("Reward secured to your SokoPlus profile! 🏆");
        } catch (err) {
          console.error("Error storing voucher to Firestore:", err);
        } finally {
          setSaving(false);
        }
      }
    }, 1500);
  };

  const copyCode = () => {
    if (!revealedReward) return;
    navigator.clipboard.writeText(revealedReward.code);
    setCopied(true);
    toast.success("Promo code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="w-full bg-slate-50 dark:bg-gray-900/40 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-6 sm:p-10 space-y-8 relative overflow-hidden flex flex-col items-center"
      id="gamified-mystery-container"
    >
      {/* Absolute Confetti Nodes during unlocked phase */}
      {revealPhase === "opened" && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => {
            const size = Math.random() * 8 + 6;
            const delay = Math.random() * 0.4;
            const xOffset = Math.random() * 400 - 200;
            const colors = ["#f97316", "#eab308", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];

            return (
              <motion.div
                key={i}
                initial={{ opacity: 1, scale: 0.5, x: "50%", y: "60%" }}
                animate={{
                  opacity: [1, 1, 0],
                  scale: [0.5, 1.2, 0.4],
                  x: `calc(50% + ${xOffset}px)`,
                  y: ["60%", "20%", "90%"],
                  rotate: [0, 360, 720]
                }}
                transition={{
                  duration: Math.random() * 1.5 + 1.2,
                  delay: delay,
                  ease: "easeOut"
                }}
                className="absolute w-3 h-3 rounded-md"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: randomColor,
                  left: "50%",
                  top: "20%"
                }}
              />
            );
          })}
        </div>
      )}

      {/* Decorative background grid effects */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-orange-200/20 dark:bg-orange-950/5 rounded-full filter blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-yellow-200/20 dark:bg-yellow-950/5 rounded-full filter blur-2xl pointer-events-none"></div>

      {/* Main Title Banner */}
      <div className="text-center max-w-lg space-y-3 relative z-10">
        <div className="mx-auto bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest w-fit flex items-center gap-1.5 shadow-sm border border-orange-200/20 animate-bounce">
          <Sparkles size={12} className="text-orange-600" />
          Guaranteed Winner
        </div>
        <h2 className="text-3xl sm:text-4xl font-black italic tracking-tight text-gray-900 dark:text-white">
          {revealPhase === "opened" ? "You Just Won! 🎉" : "The Soko Mystery Box!"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium px-4">
          {revealPhase === "opened" 
            ? "Your instant loyal customer benefit has been generated and unlocked successfully."
            : "Every purchase earns an exclusive, instant post-purchase prize. Tap any box below to claim your guaranteed reward for your next visit!"}
        </p>
      </div>

      {/* Interactive Phase Container */}
      <div className="w-full max-w-xl flex justify-center py-4 relative z-10">
        <AnimatePresence mode="wait">
          {revealPhase !== "opened" ? (
            /* BOX SELECTION GRID */
            <motion.div 
              key="box-selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-3 gap-4 sm:gap-8 w-full px-2"
            >
              {[0, 1, 2].map((idx) => {
                const isThisSelected = selectedBox === idx;
                const isAnySelected = selectedBox !== null;
                const isHovered = hoveredBox === idx;

                return (
                  <motion.button
                    key={idx}
                    onClick={() => handleBoxClick(idx)}
                    onMouseEnter={() => !isAnySelected && setHoveredBox(idx)}
                    onMouseLeave={() => !isAnySelected && setHoveredBox(null)}
                    disabled={isAnySelected}
                    animate={
                      isThisSelected && revealPhase === "shaking"
                        ? {
                            x: [0, -12, 12, -12, 12, -8, 8, -4, 4, 0],
                            y: [0, -4, 4, -4, 4, -2, 2, -1, 1, 0],
                            rotate: [0, -8, 8, -8, 8, -4, 4, -2, 2, 0],
                            scale: 1.15
                          }
                        : isAnySelected && !isThisSelected
                        ? { opacity: 0.3, scale: 0.85, filter: "blur(1px)" }
                        : isHovered
                        ? { y: -15, scale: 1.08 }
                        : { y: 0, scale: 1 }
                    }
                    transition={
                      isThisSelected && revealPhase === "shaking"
                        ? { duration: 1.5, ease: "easeInOut", repeat: Infinity }
                        : { type: "spring", stiffness: 300, damping: 15 }
                    }
                    className={`relative p-6 sm:p-8 rounded-[2rem] aspect-square flex flex-col items-center justify-center transition-all shadow-lg select-none cursor-pointer ${
                      isThisSelected
                        ? "bg-gradient-to-b from-orange-550 to-orange-650 text-white shadow-orange-300/50 border-4 border-orange-400"
                        : "bg-white dark:bg-gray-800 hover:shadow-orange-100 dark:hover:shadow-none border border-gray-150 dark:border-gray-755 text-gray-800 dark:text-white"
                    }`}
                  >
                    {/* Floating Glow backdrop on hovered item */}
                    {isHovered && !isAnySelected && (
                      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 to-yellow-500/10 rounded-[2rem] animate-pulse blur-md" />
                    )}

                    {/* Soko Gift Box Graphic */}
                    <svg
                      viewBox="0 0 100 100"
                      className={`w-16 h-16 sm:w-24 sm:h-24 object-contain ${
                        isThisSelected && revealPhase === "shaking" ? "animate-pulse" : ""
                      }`}
                    >
                      {/* Box bottom */}
                      <rect 
                        x="20" 
                        y="45" 
                        width="60" 
                        height="40" 
                        rx="8" 
                        fill={isThisSelected ? "#ffffff" : "#f97316"} 
                        opacity={isThisSelected ? "0.9" : "1"}
                      />
                      {/* Lid */}
                      <rect 
                        x="15" 
                        y="35" 
                        width="70" 
                        height="14" 
                        rx="4" 
                        fill={isThisSelected ? "#fed7aa" : "#ea580c"}
                      />
                      {/* Ribbon / Knot */}
                      <path 
                        d="M 50,35 C 40,20 40,15 50,35 C 60,15 60,20 50,35 Z" 
                        fill={isThisSelected ? "#ffffff" : "#facc15"} 
                        stroke={isThisSelected ? "#ea580c" : "#ca8a04"} 
                        strokeWidth="3"
                      />
                      {/* vertical stripe */}
                      <rect 
                        x="46" 
                        y="35" 
                        width="8" 
                        height="50" 
                        fill={isThisSelected ? "#ea580c" : "#facc15"} 
                        rx="2"
                      />
                    </svg>

                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-4 leading-none">
                      {isThisSelected && revealPhase === "shaking" ? "UNBOXING..." : "CHOOSE BOX"}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            /* REVEALED PRIZE CARD */
            (() => {
              const isShipping = (revealedReward?.id || "").toLowerCase().includes("shipping") || (revealedReward?.code || "").toLowerCase().includes("ship");
              const isPoints = (revealedReward?.id || "").toLowerCase().includes("points") || (revealedReward?.code || "").toLowerCase().includes("multiply");
              const isGift = (revealedReward?.id || "").toLowerCase().includes("voucher") || (revealedReward?.code || "").toLowerCase().includes("vouch");
              const isPass = (revealedReward?.id || "").toLowerCase().includes("pass") || (revealedReward?.code || "").toLowerCase().includes("vip") || (revealedReward?.id || "").toLowerCase().includes("artisan");
              const isPremiumBg = isShipping || isPoints || isGift || isPass;
              return (
                <motion.div
                  key="prize-reveal"
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className="w-full bg-gray-950 p-6 sm:p-8 rounded-[2.5rem] border border-gray-800 text-center flex flex-col items-center space-y-6 shadow-2xl relative overflow-hidden text-white"
                >
                  {/* Background Image with Overlay */}
                  <div 
                    className={`absolute inset-0 bg-cover bg-center ${isPremiumBg ? "opacity-60" : "opacity-25 mix-blend-luminosity"} animate-pulse pointer-events-none`} 
                    style={{ backgroundImage: `url(${getVoucherBgImage(revealedReward?.id || "", revealedReward?.code || "")})` }}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-b ${isPremiumBg ? "from-gray-950/50 via-gray-950/70 to-gray-950/92" : "from-gray-950/80 via-gray-950/85 to-gray-950/98"} pointer-events-none z-0`} />

                  {/* Shiny Ambient Sparkles Backdrop */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(249,115,22,0.15),transparent_60%)] pointer-events-none z-0" />

                  {/* Reward Icon Wrapper */}
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                    className={`p-5 rounded-3xl bg-gradient-to-br ${revealedReward?.color} text-white shadow-xl shadow-orange-500/10 flex items-center justify-center shrink-0 relative z-10`}
                  >
                    {revealedReward?.icon === "truck" && <Truck size={36} className="animate-pulse" />}
                    {revealedReward?.icon === "points" && <Percent size={36} className="animate-pulse" />}
                    {revealedReward?.icon === "gift" && <Gift size={36} className="animate-pulse" />}
                    {revealedReward?.icon === "star" && <Star size={36} className="animate-pulse" fill="currentColor" />}
                  </motion.div>

                  {/* Title & Badge */}
                  <div className="space-y-2 relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 px-3 py-1 bg-orange-550/15 border border-orange-500/25 rounded-full backdrop-blur-md">
                      {revealedReward?.badge}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      {revealedReward?.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-300 font-medium px-4 leading-relaxed max-w-sm mx-auto">
                      {revealedReward?.description}
                    </p>
                  </div>

                  {/* Copyable Promo Code block */}
                  <div className="w-full max-w-sm space-y-2 relative z-10">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-left pl-1">
                      Claim Code
                    </p>
                    <div className="bg-gray-950/60 p-2 rounded-2xl border border-white/10 flex items-center justify-between shadow-inner backdrop-blur-md">
                      <span className="font-mono text-xs sm:text-sm font-black text-orange-300 select-all pl-3">
                        {revealedReward?.code}
                      </span>
                      <button
                        onClick={copyCode}
                        className="bg-orange-600 text-white hover:bg-orange-500 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-orange-950/40"
                      >
                        {copied ? (
                          <>
                            <Check size={14} className="stroke-[3]" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={14} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* User Sync Status feedback line */}
                  <div className="text-[11px] text-gray-400 font-bold flex items-center gap-1 relative z-10">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {userId 
                      ? "Voucher added to your personal profile wallet" 
                      : "Saved locally — log in to sync dynamically"}
                  </div>
                </motion.div>
              );
            })()
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
