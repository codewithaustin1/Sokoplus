import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus, Trash2, Loader2, Check } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useLanguage } from "../lib/LanguageContext";

export interface AddToCartButtonProps {
  productId?: string;
  product?: {
    id: string;
    name: string;
    price: number;
    image?: string;
    images?: string[];
    stock?: number;
    category?: string;
    sellerId?: string;
    sellerName?: string;
    customizations?: any;
    isDigital?: boolean;
    digitalFormat?: "pdf" | "video" | "audio" | "zip" | "ebook" | "software" | "other";
    digitalFileUrl?: string;
  };
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  successLabel?: string;
  customizations?: any;
  size?: "sm" | "md" | "lg";
}

export const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  productId,
  product,
  onClick,
  disabled = false,
  className = "",
  label,
  successLabel = "Added",
  customizations,
  size = "md",
}) => {
  const { items, addToCart, updateQuantity, removeFromCart } = useCart();
  const { language } = useLanguage();

  const targetProductId = productId || product?.id;
  const targetStock = product?.stock;

  // Find if this product is already in the cart
  const cartItem = targetProductId
    ? items.find((i) => {
        if (i.productId !== targetProductId) return false;
        if (!customizations && !i.customizations) return true;
        if (customizations && i.customizations) {
          return (
            customizations.color === i.customizations.color &&
            customizations.material === i.customizations.material
          );
        }
        return false;
      })
    : undefined;

  const currentQuantity = cartItem ? cartItem.quantity : 0;

  const defaultAddLabel = language === "sw" ? "Weka Kwenye Kikapu" : "Add to cart";
  const displayLabel = label || defaultAddLabel;

  const handleInitialAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || (targetStock !== undefined && targetStock <= 0)) return;

    if (onClick) {
      onClick();
    } else if (product || targetProductId) {
      const itemToAdd = {
        productId: targetProductId!,
        name: product?.name || "Product",
        price: product?.price || 0,
        quantity: 1,
        image:
          product?.image ||
          product?.images?.filter((img) => !!img && img.trim() !== "")[0] ||
          "",
        isDigital: product?.isDigital || false,
        digitalFormat: product?.digitalFormat,
        digitalFileUrl: product?.digitalFileUrl,
        sellerId: product?.sellerId,
        sellerName: product?.sellerName,
        customizations,
      };
      addToCart(itemToAdd);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!targetProductId) return;
    if (targetStock !== undefined && currentQuantity >= targetStock) return;

    updateQuantity(targetProductId, currentQuantity + 1, customizations);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!targetProductId) return;

    if (currentQuantity <= 1) {
      removeFromCart(targetProductId, customizations);
    } else {
      updateQuantity(targetProductId, currentQuantity - 1, customizations);
    }
  };

  // Clean up conflicting background/hover classes from parent calls if provided
  const cleanClassName = className
    .split(" ")
    .filter((c) => {
      const lower = c.toLowerCase().trim();
      if (!lower) return false;
      if (
        lower.includes("bg-") ||
        lower.includes("text-white") ||
        lower.includes("text-black") ||
        lower.includes("border-")
      ) {
        return false;
      }
      if (
        lower.includes("text-") &&
        !lower.includes("text-lg") &&
        !lower.includes("text-sm") &&
        !lower.includes("text-xs") &&
        !lower.includes("text-xl") &&
        !lower.includes("text-md") &&
        !lower.includes("text-2xl") &&
        !lower.includes("text-3xl")
      ) {
        return false;
      }
      if (
        lower.includes("hover:bg-") ||
        lower.includes("hover:shadow-") ||
        lower.includes("brand-success-")
      ) {
        return false;
      }
      return true;
    })
    .join(" ");

  const isOutOfStock = disabled || (targetStock !== undefined && targetStock <= 0);

  // If item is in cart (quantity >= 1), render the Amazon-style inline quantity pill
  if (currentQuantity >= 1 && !isOutOfStock) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={`relative overflow-hidden rounded-full border-2 border-[#FFD814] bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-between px-2 shadow-sm font-extrabold select-none ${cleanClassName}`}
        style={{ minHeight: size === "lg" ? "3.25rem" : size === "sm" ? "2.25rem" : "2.5rem" }}
      >
        {/* Left button: Trash icon if quantity is 1, Minus icon if quantity > 1 */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.85 }}
          onClick={handleDecrement}
          title={currentQuantity === 1 ? "Remove from cart" : "Decrease quantity"}
          className="p-1.5 rounded-full text-gray-800 dark:text-gray-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
        >
          {currentQuantity === 1 ? (
            <Trash2 size={size === "lg" ? 18 : 15} className="text-gray-900 dark:text-gray-100 stroke-[2.2]" />
          ) : (
            <Minus size={size === "lg" ? 18 : 15} className="text-gray-900 dark:text-gray-100 stroke-[2.5]" />
          )}
        </motion.button>

        {/* Center label: "X in cart" */}
        <motion.span
          key={currentQuantity}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white px-2 whitespace-nowrap text-center"
        >
          {language === "sw"
            ? `${currentQuantity} kwenye kikapu`
            : `${currentQuantity} in cart`}
        </motion.span>

        {/* Right button: Plus icon */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.85 }}
          onClick={handleIncrement}
          disabled={targetStock !== undefined && currentQuantity >= targetStock}
          title="Increase quantity"
          className={`p-1.5 rounded-full text-gray-800 dark:text-gray-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
            targetStock !== undefined && currentQuantity >= targetStock ? "opacity-40 cursor-not-allowed" : ""
          }`}
        >
          <Plus size={size === "lg" ? 18 : 15} className="text-gray-900 dark:text-gray-100 stroke-[2.5]" />
        </motion.button>
      </motion.div>
    );
  }

  // Initial state: Yellow solid "Add to cart" button
  return (
    <motion.button
      type="button"
      onClick={handleInitialAdd}
      disabled={isOutOfStock}
      whileHover={isOutOfStock ? {} : { scale: 1.01 }}
      whileTap={isOutOfStock ? {} : { scale: 0.96 }}
      className={`relative overflow-hidden transition-all duration-200 select-none flex items-center justify-center rounded-full font-bold px-4 py-2 text-xs sm:text-sm ${cleanClassName} ${
        isOutOfStock
          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-700"
          : "bg-[#FFD814] text-gray-900 hover:bg-[#F7CA18] shadow-md shadow-yellow-500/10 cursor-pointer border border-transparent"
      }`}
      style={{ minHeight: size === "lg" ? "3.25rem" : size === "sm" ? "2.25rem" : "2.5rem" }}
    >
      <span>{isOutOfStock ? (language === "sw" ? "Imekwisha" : "Out of Stock") : displayLabel}</span>
    </motion.button>
  );
};
