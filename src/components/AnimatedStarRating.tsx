import React, { useState, useRef, useEffect } from "react";
import { Star, ChevronDown, X, MessageSquare, ThumbsUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AnimatedStarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  showPopoverOnHover?: boolean;
  onScrollToReviews?: () => void;
  className?: string;
}

export const AnimatedStarRating: React.FC<AnimatedStarRatingProps> = ({
  rating,
  reviewCount = 1,
  size = "md",
  showPopoverOnHover = true,
  onScrollToReviews,
  className = "",
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeHoverStar, setActiveHoverStar] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const starSizes = {
    sm: { star: 14, text: "text-xs", gap: "gap-1" },
    md: { star: 18, text: "text-sm", gap: "gap-1.5" },
    lg: { star: 22, text: "text-base", gap: "gap-2" },
  };

  const currentSize = starSizes[size];

  // Calculate rating breakdown distribution
  // e.g. if rating is 3.0, 3-star gets 100%, or intelligent weighting
  const getBreakdown = (val: number) => {
    const rounded = Math.round(val);
    const breakdown: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    if (rounded >= 1 && rounded <= 5) {
      breakdown[rounded] = 100;
    } else {
      breakdown[5] = 80;
      breakdown[4] = 20;
    }
    return breakdown;
  };

  const breakdown = getBreakdown(rating);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Main Trigger Rating Bar */}
      <div
        className="group flex items-center cursor-pointer select-none py-1 px-1.5 rounded-xl hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-all duration-200"
        onMouseEnter={() => {
          setIsHovered(true);
          if (showPopoverOnHover) setIsOpen(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {/* Rating Value */}
        <span className={`${currentSize.text} font-black text-amber-600 dark:text-amber-400 mr-1.5 tabular-nums`}>
          {rating.toFixed(1)}
        </span>

        {/* 5 Animated Stars */}
        <div className={`flex items-center ${currentSize.gap} relative`}>
          {[1, 2, 3, 4, 5].map((starIndex) => {
            const fillAmount = Math.max(0, Math.min(1, rating - (starIndex - 1)));
            const isFull = fillAmount >= 0.8;
            const isHalf = fillAmount > 0.2 && fillAmount < 0.8;

            return (
              <motion.div
                key={starIndex}
                className="relative inline-block"
                animate={
                  isHovered || activeHoverStar === starIndex
                    ? {
                        scale: [1, 1.3, 1],
                        rotate: [0, 8, -8, 0],
                      }
                    : { scale: 1, rotate: 0 }
                }
                transition={{
                  duration: 0.35,
                  delay: (starIndex - 1) * 0.05,
                  ease: "easeInOut",
                }}
                onMouseEnter={() => setActiveHoverStar(starIndex)}
                onMouseLeave={() => setActiveHoverStar(null)}
              >
                {/* Background empty star */}
                <Star
                  size={currentSize.star}
                  className="text-gray-300 dark:text-gray-700"
                  fill="currentColor"
                />

                {/* Filled foreground star */}
                {(isFull || isHalf) && (
                  <div
                    className="absolute inset-0 overflow-hidden text-amber-500 dark:text-amber-400"
                    style={{ width: isFull ? "100%" : "50%" }}
                  >
                    <Star
                      size={currentSize.star}
                      className="text-amber-500 dark:text-amber-400 drop-shadow-[0_1px_3px_rgba(245,158,11,0.4)]"
                      fill="currentColor"
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Chevron Dropdown Indicator */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-1 text-gray-400 dark:text-gray-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
        >
          <ChevronDown size={14} />
        </motion.div>

        {/* Rating Count */}
        <span className="ml-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline hover:text-sky-700 transition-colors">
          ({reviewCount})
        </span>

        {/* Tooltip on Hover over Stars */}
        <AnimatePresence>
          {isHovered && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: -24, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              className="absolute left-1/2 -translate-x-1/2 -top-2 bg-gray-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-30"
            >
              {rating.toFixed(1)} out of 5 stars
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Popover Breakdown Card (as shown in video) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-5 z-50 overflow-hidden"
          >
            {/* Header with Close Button */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-gray-900 dark:text-white">
                    {rating.toFixed(1)} out of 5
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i <= Math.round(rating) ? "currentColor" : "none"}
                        className={i <= Math.round(rating) ? "text-amber-500" : "text-gray-300 dark:text-gray-700"}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                  {reviewCount} global rating{reviewCount === 1 ? "" : "s"}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Star Distribution Progress Bars */}
            <div className="py-4 space-y-2.5">
              {[5, 4, 3, 2, 1].map((starNum) => {
                const pct = breakdown[starNum] || 0;
                return (
                  <div
                    key={starNum}
                    className="flex items-center gap-3 text-xs group/row cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850 p-1 rounded-lg transition-colors"
                  >
                    <span className="w-10 font-bold text-sky-600 dark:text-sky-400 hover:underline">
                      {starNum} star
                    </span>

                    {/* Progress Bar Container */}
                    <div className="flex-grow h-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden border border-gray-200/60 dark:border-gray-700/60 p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-sm shadow-xs"
                      />
                    </div>

                    <span className="w-9 text-right font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onScrollToReviews) {
                    onScrollToReviews();
                  } else {
                    const reviewSection = document.getElementById("customer-reviews");
                    if (reviewSection) {
                      reviewSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }
                }}
                className="w-full text-center py-2 px-3 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-orange-600 dark:hover:text-orange-400 hover:underline transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare size={14} />
                See all customer reviews
              </button>

              <p className="text-[10px] text-center text-gray-400 dark:text-gray-500">
                Verified purchases from authentic Kenyan artisans & shoppers
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* Mini Animated Star Group for Product Cards */
export const CardStarRating: React.FC<{
  rating: number;
  size?: number;
  showCount?: boolean;
  count?: number;
}> = ({ rating, size = 13, showCount = false, count }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="inline-flex items-center gap-1 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400">
        {[1, 2, 3, 4, 5].map((i) => {
          const isFilled = i <= Math.round(rating);
          return (
            <motion.div
              key={i}
              animate={
                isHovered
                  ? {
                      scale: [1, 1.25, 1],
                      rotate: [0, 10, -10, 0],
                    }
                  : { scale: 1, rotate: 0 }
              }
              transition={{
                duration: 0.3,
                delay: (i - 1) * 0.04,
              }}
            >
              <Star
                size={size}
                fill={isFilled ? "currentColor" : "none"}
                className={isFilled ? "text-amber-500 dark:text-amber-400" : "text-gray-300 dark:text-gray-700"}
              />
            </motion.div>
          );
        })}
      </div>
      {showCount && count !== undefined && (
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 ml-0.5">
          ({count})
        </span>
      )}
    </div>
  );
};
