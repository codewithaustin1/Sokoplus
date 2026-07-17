import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, Loader2, Check } from "lucide-react";

interface AddToCartButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  successLabel?: string;
}

export const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  onClick,
  disabled = false,
  className = "",
  label = "Add to Cart",
  successLabel = "Added",
}) => {
  const [status, setStatus] = useState<"idle" | "loading" | "added">("idle");

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== "idle" || disabled) return;

    setStatus("loading");
    
    // Call the original cart action
    onClick();

    // Elegant timeout duration for loader spinner to turn
    setTimeout(() => {
      setStatus("added");
      
      // Return to original state after a pleasant feedback duration
      setTimeout(() => {
        setStatus("idle");
      }, 1500);
    }, 850);
  };

  // Clean up conflicting background/text/hover classes from parent files
  const cleanClassName = className
    .split(" ")
    .filter((c) => {
      const lower = c.toLowerCase().trim();
      if (!lower) return false;
      if (lower.includes("bg-") || lower.includes("text-white") || lower.includes("text-black")) {
        return false;
      }
      if (lower.includes("text-") && !lower.includes("text-lg") && !lower.includes("text-sm") && !lower.includes("text-xs") && !lower.includes("text-xl") && !lower.includes("text-md") && !lower.includes("text-2xl") && !lower.includes("text-3xl")) {
        return false;
      }
      if (lower.includes("hover:bg-") || lower.includes("hover:shadow-") || lower.includes("brand-success-")) {
        return false;
      }
      return true;
    })
    .join(" ");

  const getButtonStyles = () => {
    if (disabled) {
      return "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed";
    }
    if (status === "added") {
      return "bg-green-600 text-white shadow-md shadow-green-600/10";
    }
    if (status === "loading") {
      return "bg-[#FFD814] text-gray-900 shadow-md shadow-yellow-500/10 cursor-wait";
    }
    return "bg-[#FFD814] text-gray-900 hover:bg-[#F7CA18] shadow-md shadow-yellow-500/10 cursor-pointer";
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled || status === "loading"}
      whileHover={disabled ? {} : { scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={`relative overflow-hidden transition-all duration-300 select-none flex items-center justify-center ${cleanClassName} ${getButtonStyles()}`}
      style={{ minHeight: "2.75rem" }}
    >
      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex items-center justify-center w-full h-full gap-2.5"
          >
            <span>{label}</span>
          </motion.div>
        )}

        {status === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex items-center justify-center w-full h-full"
          >
            <Loader2 className="animate-spin text-gray-900 shrink-0" size={20} />
          </motion.div>
        )}

        {status === "added" && (
          <motion.div
            key="added"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 350, damping: 15 }}
            className="flex items-center justify-center w-full h-full gap-2"
          >
            <span className="font-bold">{successLabel}</span>
            <motion.div
              initial={{ scale: 0.2 }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ delay: 0.1, duration: 0.25, type: "keyframes", ease: "easeInOut" }}
              className="bg-white text-green-600 rounded-full p-0.5 shadow-sm flex items-center justify-center shrink-0"
            >
              <Check size={12} className="stroke-[3.5]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
