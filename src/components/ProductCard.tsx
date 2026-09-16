import React, { memo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Heart, GitCompare, Star } from "lucide-react";
import { Product } from "../types";
import { FastImage } from "./FastImage";
import { AddToCartButton } from "./AddToCartButton";
import { useLanguage } from "../lib/LanguageContext";
import { prefetchProductAssets } from "../utils/imagePrefetcher";
import { addToCompare, removeFromCompare, isInCompareList } from "../utils/compare";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import toast from "react-hot-toast";

interface ProductCardProps {
  product: Product;
  formatPrice: (price: number) => string;
  onToggleWishlist?: (productId: string, e: React.MouseEvent) => void;
  isWishlisted?: boolean;
  className?: string;
  aspectRatio?: string;
  showAddToCart?: boolean;
}

export const ProductCard = memo(function ProductCard({
  product,
  formatPrice,
  onToggleWishlist,
  isWishlisted: propIsWishlisted,
  className = "",
  aspectRatio = "aspect-square",
  showAddToCart = true,
}: ProductCardProps) {
  const { t } = useLanguage();
  const [isCompared, setIsCompared] = useState(() => isInCompareList(product.id));

  // Sync comparison state with global storage events
  useEffect(() => {
    const handleCompareUpdate = () => {
      setIsCompared(isInCompareList(product.id));
    };
    window.addEventListener("sokoplus_compare_changed", handleCompareUpdate);
    return () => {
      window.removeEventListener("sokoplus_compare_changed", handleCompareUpdate);
    };
  }, [product.id]);

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(product.id, e);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error(t("Please sign in to save items to your wishlist"));
      return;
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      if (propIsWishlisted) {
        await updateDoc(userRef, { wishlist: arrayRemove(product.id) });
        toast.success(t("Removed from wishlist"));
      } else {
        await updateDoc(userRef, { wishlist: arrayUnion(product.id) });
        toast.success(t("Saved to wishlist"));
      }
    } catch (err) {
      console.error("Failed to update wishlist:", err);
      toast.error(t("Could not update wishlist"));
    }
  };

  const handleCompareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCompared) {
      removeFromCompare(product.id);
    } else {
      addToCompare(product);
    }
  };

  // Primary image
  const primaryImage =
    product.images?.filter((img) => !!img && img.trim() !== "")[0] ||
    (product as any).image ||
    "";

  // Discount percentage calculation
  const discountPercent =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  // Normalized condition label
  const conditionLabel = product.condition
    ? product.condition.replace(/_/g, " ").toLowerCase()
    : null;

  const isWishlisted = !!propIsWishlisted;

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`group relative bg-white dark:bg-gray-900/95 border border-gray-150/80 dark:border-gray-800/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between ${className}`}
    >
      {/* Visual & Image Frame */}
      <div>
        <Link
          to={`/product/${product.id}`}
          state={{ product }}
          onMouseEnter={() => prefetchProductAssets(product)}
          onTouchStart={() => prefetchProductAssets(product)}
          className={`block ${aspectRatio} bg-gray-50/80 dark:bg-gray-950/70 rounded-xl overflow-hidden mb-3 relative group/img shrink-0`}
        >
          {/* Subtle contrast backdrop overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/4 dark:group-hover/img:bg-white/4 transition-colors z-1" />

          <FastImage
            src={primaryImage}
            alt={product.name}
            fallbackIconSize={36}
            className="w-full h-full object-cover group-hover/img:scale-[1.03] transition-transform duration-500 ease-out"
          />

          {/* Minimalist Discount Pill */}
          {discountPercent !== null && discountPercent > 0 && (
            <div className="absolute top-2.5 right-2.5 z-10 bg-gray-950/90 dark:bg-white/95 text-white dark:text-gray-950 font-mono text-[10px] font-medium tracking-wider px-2 py-0.5 rounded-full shadow-2xs backdrop-blur-xs border border-white/10 dark:border-black/10">
              -{discountPercent}%
            </div>
          )}

          {/* Action Icons: Wishlist & Compare */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 opacity-90 group-hover/img:opacity-100 transition-opacity">
            <motion.button
              type="button"
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.88 }}
              onClick={handleWishlistClick}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs backdrop-blur-xs transition-colors cursor-pointer ${
                isWishlisted
                  ? "bg-rose-50 dark:bg-rose-950/70 text-rose-500 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50"
                  : "bg-white/90 dark:bg-gray-900/90 text-gray-400 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 border border-gray-200/50 dark:border-gray-800/60"
              }`}
            >
              <Heart
                size={13}
                className="stroke-[1.75]"
                fill={isWishlisted ? "currentColor" : "none"}
              />
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.88 }}
              onClick={handleCompareClick}
              aria-label="Compare specifications"
              title="Compare Product"
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs backdrop-blur-xs transition-colors cursor-pointer ${
                isCompared
                  ? "bg-orange-50 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/50"
                  : "bg-white/90 dark:bg-gray-900/90 text-gray-400 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 border border-gray-200/50 dark:border-gray-800/60"
              }`}
            >
              <GitCompare size={13} className="stroke-[1.75]" />
            </motion.button>
          </div>
        </Link>

        {/* Card Body Information */}
        <div className="space-y-1.5">
          {/* Subtle condition pill & Subcategory */}
          <div className="flex items-center gap-1.5 flex-wrap min-h-[20px]">
            {conditionLabel && (
              <span className="inline-flex items-center text-[9px] uppercase font-mono font-medium tracking-wider text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200/60 dark:border-gray-700/60">
                {conditionLabel}
              </span>
            )}
            {product.subcategory ? (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide truncate max-w-[120px]">
                {product.subcategory}
              </span>
            ) : product.category ? (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide truncate max-w-[120px]">
                {product.category}
              </span>
            ) : null}
          </div>

          {/* Clean, high-legibility Title */}
          <Link
            to={`/product/${product.id}`}
            state={{ product }}
            className="block text-xs sm:text-[13px] font-semibold text-gray-900 dark:text-gray-100 hover:text-orange-600 dark:hover:text-orange-400 transition-colors line-clamp-1 leading-snug tracking-tight"
          >
            {product.name}
          </Link>

          {/* Rating & Stock status metadata */}
          <div className="flex items-center justify-between pt-0.5 text-[11px]">
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Star size={11} className="text-amber-500 fill-amber-500 stroke-[1.5]" />
              <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300 text-[11px]">
                {(product.rating || 4.5).toFixed(1)}
              </span>
            </div>

            <div>
              {product.stock === 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-rose-600 dark:text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>{t("Sold Out")}</span>
                </span>
              ) : product.stock <= 5 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-amber-600 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>
                    {product.stock} {t("left")}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{t("In Stock")}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Price & Action Section */}
      <div className="pt-2.5 mt-2 border-t border-gray-100/90 dark:border-gray-800/80">
        <div className="flex items-baseline justify-between gap-1 mb-2">
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="text-sm sm:text-base font-bold text-gray-950 dark:text-white leading-none tabular-nums tracking-tight">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 line-through font-mono font-normal select-none tabular-nums">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
        </div>

        {showAddToCart && (
          <div className="w-full">
            <AddToCartButton product={product} className="w-full" size="sm" />
          </div>
        )}
      </div>
    </motion.article>
  );
});
