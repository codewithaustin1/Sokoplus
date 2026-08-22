import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowUpDown, 
  Filter, 
  Check, 
  X, 
  Star, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Layers
} from "lucide-react";
import { Product } from "../types";

export type SortOptionType = "newest" | "price-low" | "price-high" | "rating";

interface MobileSortFilterBarProps {
  // Sorting state
  sortBy: SortOptionType;
  onSortChange: (val: SortOptionType) => void;
  isSortOpen: boolean;
  setIsSortOpen: (open: boolean) => void;

  // Filter state
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
  activeFilterCount: number;

  // Filters data
  activeCategories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;

  selectedSubcategory: string;
  onSelectSubcategory: (sub: string) => void;

  minPrice: number | "";
  maxPrice: number | "";
  onMinPriceChange: (val: number | "") => void;
  onMaxPriceChange: (val: number | "") => void;
  sliderMax: number;

  minRating: number;
  onMinRatingChange: (val: number) => void;

  onlyInStock: boolean;
  onOnlyInStockChange: (val: boolean) => void;

  onResetFilters: () => void;

  // Formatting & counts
  currency: string;
  totalFilteredCount: number;
  language: "en" | "sw";
}

const SORT_OPTIONS: Array<{ id: SortOptionType; labelEn: string; labelSw: string; subtitleEn: string; subtitleSw: string }> = [
  { 
    id: "newest", 
    labelEn: "Newest Arrivals", 
    labelSw: "Zilizoingia Hivi Karibuni",
    subtitleEn: "Fresh additions from across Kenya",
    subtitleSw: "Bidhaa mpya zilizoongezwa"
  },
  { 
    id: "price-low", 
    labelEn: "Price: Low to High", 
    labelSw: "Bei: Chini hadi Juu",
    subtitleEn: "Budget friendly first",
    subtitleSw: "Kuanzia bei nafuu"
  },
  { 
    id: "price-high", 
    labelEn: "Price: High to Low", 
    labelSw: "Bei: Juu hadi Chini",
    subtitleEn: "Premium & luxury first",
    subtitleSw: "Kuanzia bei ya juu"
  },
  { 
    id: "rating", 
    labelEn: "Customer Rating", 
    labelSw: "Kiwango cha Wateja",
    subtitleEn: "Highest rated & most loved",
    subtitleSw: "Zilizopendwa zaidi na wateja"
  },
];

export const MobileSortFilterBar: React.FC<MobileSortFilterBarProps> = ({
  sortBy,
  onSortChange,
  isSortOpen,
  setIsSortOpen,
  isFilterOpen,
  setIsFilterOpen,
  activeFilterCount,
  activeCategories,
  selectedCategory,
  onSelectCategory,
  selectedSubcategory,
  onSelectSubcategory,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  sliderMax,
  minRating,
  onMinRatingChange,
  onlyInStock,
  onOnlyInStockChange,
  onResetFilters,
  currency,
  totalFilteredCount,
  language,
}) => {
  const currentSortLabel = SORT_OPTIONS.find((s) => s.id === sortBy);
  const tempMin = minPrice === "" ? 0 : Number(minPrice);
  const tempMax = maxPrice === "" ? sliderMax : Number(maxPrice);

  return (
    <>
      {/* 1. STICKY FLOATING BOTTOM ACTION BAR (Mobile Only - sits just above bottom nav at ~64px) */}
      <div 
        id="mobile-sticky-sort-filter-bar"
        className="fixed bottom-[64px] left-0 right-0 z-30 md:hidden px-4 pointer-events-none pb-1"
      >
        <div className="max-w-md mx-auto pointer-events-auto bg-gray-950/92 dark:bg-gray-900/95 backdrop-blur-md text-white rounded-full p-1.5 shadow-2xl border border-white/10 flex items-center justify-between gap-1.5 ring-1 ring-black/20">
          {/* SORT BUTTON */}
          <button
            type="button"
            onClick={() => {
              setIsSortOpen(true);
              setIsFilterOpen(false);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-full text-xs font-black transition-all cursor-pointer active:scale-95 ${
              isSortOpen ? "bg-white text-gray-950 shadow-sm" : "text-gray-200 hover:text-white hover:bg-white/10"
            }`}
          >
            <ArrowUpDown size={15} className="text-amber-400 stroke-[2.4]" />
            <span className="truncate">
              {language === "sw" ? "Panga" : "Sort by"}
              {currentSortLabel && (
                <span className="opacity-60 text-[10px] ml-1 font-semibold hidden xs:inline">
                  • {language === "sw" ? currentSortLabel.labelSw.split(":")[0] : currentSortLabel.labelEn.split(":")[0]}
                </span>
              )}
            </span>
          </button>

          <div className="h-4 w-px bg-white/20 shrink-0" />

          {/* FILTER BUTTON */}
          <button
            type="button"
            onClick={() => {
              setIsFilterOpen(true);
              setIsSortOpen(false);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-full text-xs font-black transition-all cursor-pointer relative active:scale-95 ${
              isFilterOpen ? "bg-white text-gray-950 shadow-sm" : "text-gray-200 hover:text-white hover:bg-white/10"
            }`}
          >
            <SlidersHorizontal size={15} className="text-orange-400 stroke-[2.4]" />
            <span className="truncate">{language === "sw" ? "Chuja" : "Filter"}</span>
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-orange-600 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-xs">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. "SORT BY" SMOOTH SPRING ANIMATED BOTTOM SHEET */}
      <AnimatePresence>
        {isSortOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSortOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Bottom Sheet Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-950 rounded-t-[2rem] shadow-2xl border-t border-gray-150 dark:border-gray-800 max-h-[85vh] flex flex-col overflow-hidden pb-8"
            >
              {/* Drag Pill Handle */}
              <div className="pt-3 pb-1 flex justify-center">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
              </div>

              {/* Sheet Header */}
              <div className="px-6 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-850">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                    <ArrowUpDown size={16} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-gray-50">
                      {language === "sw" ? "Panga Matokeo" : "Sort Results"}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {totalFilteredCount} {language === "sw" ? "bidhaa zimepatikana" : "products available"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSortOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Sort Radio Choices */}
              <div className="p-4 space-y-2 overflow-y-auto">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        onSortChange(opt.id);
                        setTimeout(() => setIsSortOpen(false), 150);
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600/60 shadow-xs"
                          : "bg-gray-50/60 dark:bg-gray-900/60 border-transparent hover:bg-gray-100 dark:hover:bg-gray-850"
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <p className={`text-sm font-bold ${isSelected ? "text-amber-900 dark:text-amber-200" : "text-gray-900 dark:text-gray-100"}`}>
                          {language === "sw" ? opt.labelSw : opt.labelEn}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {language === "sw" ? opt.subtitleSw : opt.subtitleEn}
                        </p>
                      </div>

                      {/* Custom Radio Circle */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                        isSelected
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-gray-300 dark:border-gray-600 bg-transparent"
                      }`}>
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. FULL FILTER DRAWER WITH DUAL-RANGE PRICE SLIDER & DYNAMIC "SHOW (N)" CTA */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Slide-over Filter Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 240 }}
              className="absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-950 shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 px-5 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-gray-900/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 rounded-xl">
                    <Filter size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-gray-50 text-base flex items-center gap-2">
                      {language === "sw" ? "Vichujio vya Bidhaa" : "Filter Catalog"}
                      {activeFilterCount > 0 && (
                        <span className="bg-orange-600 text-white rounded-full text-[10px] font-black px-2 py-0.5">
                          {activeFilterCount} {language === "sw" ? "imewashwa" : "active"}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {totalFilteredCount} {language === "sw" ? "bidhaa zimepatikana" : "matching items"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-6 flex-1 overscroll-contain">
                {/* 1. Category Chips */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      <Layers size={13} className="text-amber-500" />
                      <span>{language === "sw" ? "Kitengo" : "Category"}</span>
                    </label>
                    {selectedCategory !== "All" && (
                      <button
                        type="button"
                        onClick={() => onSelectCategory("All")}
                        className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline"
                      >
                        {language === "sw" ? "Onyesha Zote" : "Show All"}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeCategories.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => onSelectCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                              : "bg-gray-100 dark:bg-gray-850 text-gray-700 dark:text-gray-300 border-gray-200/60 dark:border-gray-800 hover:border-orange-400"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Price Range (Dual-Handle Slider & Number Inputs) */}
                <div className="space-y-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {language === "sw" ? "Kiwango cha Bei" : "Price Range"} ({currency})
                    </label>
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-100/70 dark:bg-orange-950/60 px-2.5 py-1 rounded-lg">
                      {currency === "USD" ? "$" : "KES "}
                      {Math.round(tempMin).toLocaleString()} – {currency === "USD" ? "$" : "KES "}
                      {Math.round(tempMax).toLocaleString()}
                    </span>
                  </div>

                  {/* Dual Range Track */}
                  <div className="relative h-6 flex items-center select-none pt-2">
                    <div className="absolute left-0 right-0 h-2 bg-gray-200 dark:bg-gray-800 rounded-full" />
                    <div
                      className="absolute h-2 bg-orange-600 dark:bg-orange-500 rounded-full"
                      style={{
                        left: `${sliderMax > 0 ? (tempMin / sliderMax) * 100 : 0}%`,
                        right: `${sliderMax > 0 ? 100 - (tempMax / sliderMax) * 100 : 0}%`
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={sliderMax}
                      value={tempMin}
                      onChange={(e) => {
                        const val = Math.min(Number(e.target.value), tempMax - (sliderMax * 0.05));
                        onMinPriceChange(val);
                      }}
                      className="absolute left-0 right-0 w-full appearance-none bg-transparent pointer-events-none focus:outline-none [-webkit-appearance:none] h-2 cursor-pointer"
                      style={{ zIndex: tempMin > sliderMax / 2 ? 15 : 14 }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={sliderMax}
                      value={tempMax}
                      onChange={(e) => {
                        const val = Math.max(Number(e.target.value), tempMin + (sliderMax * 0.05));
                        onMaxPriceChange(val);
                      }}
                      className="absolute left-0 right-0 w-full appearance-none bg-transparent pointer-events-none focus:outline-none [-webkit-appearance:none] h-2 cursor-pointer"
                      style={{ zIndex: tempMin > sliderMax / 2 ? 14 : 15 }}
                    />
                  </div>

                  {/* Numeric Min / Max Inputs */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-1 uppercase">Min ({currency})</span>
                      <input
                        type="number"
                        min={0}
                        max={tempMax}
                        value={minPrice}
                        onChange={(e) => onMinPriceChange(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                        className="w-full h-9 px-3 text-xs font-bold rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-1 uppercase">Max ({currency})</span>
                      <input
                        type="number"
                        min={tempMin}
                        max={sliderMax}
                        value={maxPrice}
                        onChange={(e) => onMaxPriceChange(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={sliderMax.toString()}
                        className="w-full h-9 px-3 text-xs font-bold rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Minimum Rating */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                    {language === "sw" ? "Kiwango cha Chini cha Nyota" : "Minimum Rating"}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => onMinRatingChange(minRating === star ? 0 : star)}
                        className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          minRating >= star
                            ? "bg-amber-500 text-white shadow-md shadow-amber-500/20 font-bold"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-amber-500"
                        }`}
                      >
                        <Star size={14} fill={minRating >= star ? "currentColor" : "none"} />
                        <span className="text-xs font-black">{star}★</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Stock Availability Toggle */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                    {language === "sw" ? "Upatikanaji" : "Availability"}
                  </label>
                  <button
                    type="button"
                    onClick={() => onOnlyInStockChange(!onlyInStock)}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                      onlyInStock
                        ? "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300 font-bold"
                        : "bg-gray-50 dark:bg-gray-850 border-gray-200/80 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium"
                    }`}
                  >
                    <span className="text-xs font-bold">
                      {language === "sw" ? "Bidhaa Zilizopo Pekee" : "In Stock Items Only"}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        onlyInStock
                          ? "bg-orange-600 border-orange-600 text-white"
                          : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {onlyInStock && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* 5. Dynamic Footer with "Show (X items)" CTA */}
              <div className="p-4 border-t border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col gap-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-orange-600/25 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>
                    {language === "sw" ? `Onyesha Matokeo (${totalFilteredCount})` : `Show (${totalFilteredCount.toLocaleString()} items)`}
                  </span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={onResetFilters}
                  className="w-full py-2 px-3 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>{language === "sw" ? "Futa Vichujio Vyote" : "Reset All Filters"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
export default MobileSortFilterBar;
