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

  return (
    <button
      onClick={handleClick}
      disabled={disabled || status === "loading"}
      className={`relative overflow-hidden transition-all duration-300 select-none flex items-center justify-center ${className} ${
        status === "added" ? "bg-green-600 hover:bg-green-700 text-white" : ""
      }`}
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
            <ShoppingBag className="shrink-0" size={18} />
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
            <Loader2 className="animate-spin text-white shrink-0" size={20} />
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
              transition={{ delay: 0.1, duration: 0.25 }}
              className="bg-white text-green-600 rounded-full p-0.5 shadow-sm flex items-center justify-center shrink-0"
            >
              <Check size={12} className="stroke-[3.5]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};
