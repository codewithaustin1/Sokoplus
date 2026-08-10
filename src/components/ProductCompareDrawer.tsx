import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, GitCompare, HelpCircle, Star, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useCurrency } from "../lib/CurrencyContext";
import { useCart } from "../lib/CartContext";
import { getCompareList, removeFromCompare, clearCompareList } from "../utils/compare";
import { Product } from "../types";
import { FastImage } from "./FastImage";
import { trackEvent } from "../lib/analytics";
import toast from "react-hot-toast";

export const ProductCompareDrawer: React.FC = () => {
  const [items, setItems] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const [addingMap, setAddingMap] = useState<Record<string, "idle" | "loading" | "added">>({});

  // Sync with compare list events
  useEffect(() => {
    const handleUpdate = () => {
      setItems(getCompareList());
    };

    // Initialize
    handleUpdate();

    window.addEventListener("sokoplus_compare_changed", handleUpdate);
    return () => {
      window.removeEventListener("sokoplus_compare_changed", handleUpdate);
    };
  }, []);

  if (items.length === 0) return null;

  const handleRemove = (id: string, name: string) => {
    removeFromCompare(id);
  };

  const handleAddToCart = (p: Product) => {
    if (p.stock === 0) {
      toast.error("This product is out of stock!");
      return;
    }
    setAddingMap((prev) => ({ ...prev, [p.id]: "loading" }));
    addToCart({
      productId: p.id,
      name: p.name,
      price: p.price,
      quantity: 1,
      image: p.images?.filter((img) => !!img && img.trim() !== "")[0] || "",
    });
    trackEvent("add_to_cart", {
      items: [
        {
          item_id: p.id,
          item_name: p.name,
          price: p.price,
          quantity: 1,
          item_category: p.category,
        },
      ],
    });

    setTimeout(() => {
      setAddingMap((prev) => ({ ...prev, [p.id]: "added" }));
      toast.success("Added to cart!");
      setTimeout(() => {
        setAddingMap((prev) => {
          const updated = { ...prev };
          delete updated[p.id];
          return updated;
        });
      }, 1500);
    }, 800);
  };

  return (
    <>
      {/* 1. FLOATING COMPARISON BAR (BOTTM STICKY) */}
      <div 
        id="compare-floating-bar"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl bg-white/95 backdrop-blur-md border border-orange-200 rounded-2xl shadow-xl shadow-orange-950/10 px-4 py-3.5 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-305"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-xl shrink-0">
            <GitCompare size={20} className="animate-pulse" />
          </div>
          <div>
            <span className="text-gray-900 font-black text-sm flex items-center gap-1.5">
              Compare Products
              <span className="bg-orange-550 text-white rounded-full text-[10px] font-black px-2 py-0.5">
                {items.length} / 3
              </span>
            </span>
            <p className="text-[10px] text-gray-500 font-bold hidden sm:block mt-0.5">
              Compare details, rating, custom pricing and select best match
            </p>
          </div>
        </div>

        {/* Selected Items Thumbnails list */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 select-none scrollbar-none max-w-[180px] sm:max-w-[240px]">
          {items.map((item) => (
            <div key={item.id} className="relative group shrink-0">
              <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-150 overflow-hidden">
                <FastImage 
                  src={item.images?.filter((img) => !!img && img.trim() !== "")[0] || ""} 
                  alt={item.name} 
                />
              </div>
              <button
                onClick={() => handleRemove(item.id, item.name)}
                className="absolute -top-1.5 -right-1.5 bg-red-550 hover:bg-red-650 text-white p-0.5 rounded-full border border-white hover:scale-110 transition-transform cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsOpen(true)}
            id="compare-open-btn"
            className="px-4 py-2 text-xs font-black text-white bg-gray-900 hover:bg-orange-600 transition-colors rounded-xl shadow-sm cursor-pointer select-none flex items-center gap-1"
          >
            Compare <ArrowRight size={13} />
          </button>
          <button
            onClick={clearCompareList}
            className="text-[10px] font-bold text-gray-400 hover:text-red-550 hover:underline transition-colors focus:outline-none cursor-pointer"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* 2. FULL SCREEN SIDE-BY-SIDE COMPARISON BOARD */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-950/40 backdrop-blur-sm z-55 flex items-end md:items-center justify-center p-0 md:p-6 lg:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 50 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="bg-white w-full md:max-w-5xl h-[90vh] md:h-auto md:max-h-[85vh] rounded-t-[2.25rem] md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border-t md:border border-gray-150/60 dark:border-gray-800"
            >
              {/* Header */}
              <div className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                    <GitCompare size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base md:text-lg font-black text-gray-900">Side-by-Side Product Comparison</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-0.5">Specifications, prices and features compared directly</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all rounded-full cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Grid content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Mobile scroll indicator / instructions */}
                {items.length > 1 && (
                  <div className="flex items-center justify-between md:hidden bg-orange-50/70 py-2.5 px-4 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-1.5 text-[11px] text-orange-950 font-bold">
                      <span className="inline-block w-1.5 h-1.5 bg-orange-550 rounded-full animate-ping" />
                      Swipe left/right to compare
                    </div>
                    <span className="text-[10px] text-orange-600 font-extrabold uppercase tracking-widest">
                      {items.length} Products
                    </span>
                  </div>
                )}

                <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 snap-x snap-mandatory scrollbar-thin">
                  {/* Column for each product */}
                  {items.map((product, index) => {
                    const status = addingMap[product.id] || "idle";
                    
                    return (
                      <div 
                        key={product.id} 
                        className={`space-y-4 flex flex-col justify-between shrink-0 w-[280px] sm:w-[320px] md:w-auto snap-center bg-gray-50/50 md:bg-transparent p-4 md:p-0 rounded-2.5xl md:rounded-none border border-gray-150/60 md:border-0 relative ${index > 0 ? "md:pl-6 md:border-l md:border-gray-100" : ""}`}
                      >
                        {/* Box 1: Image, Category, Title & Close Button */}
                        <div className="space-y-4 relative">
                          <button
                            onClick={() => handleRemove(product.id, product.name)}
                            className="absolute top-0 right-0 p-1.5 bg-white md:bg-transparent rounded-full shadow-sm md:shadow-none text-gray-450 hover:text-red-550 transition-all cursor-pointer z-10 border border-gray-100 md:border-0"
                            title="Remove from comparison"
                          >
                            <X size={14} />
                          </button>

                          <div className="aspect-square w-full rounded-2xl bg-white overflow-hidden border border-gray-100 max-h-[140px] sm:max-h-[180px] select-none flex items-center justify-center shadow-inner">
                            <FastImage 
                              src={product.images?.filter((img) => !!img && img.trim() !== "")[0] || ""} 
                              alt={product.name} 
                            />
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-sm md:text-base font-black text-gray-900 line-clamp-1 mt-1">
                              {product.name}
                            </h4>
                          </div>
                        </div>

                        {/* Specs Table List */}
                        <div className="space-y-3 flex-1 py-3 border-t border-b border-gray-100/90">
                          {/* Row: Pricing */}
                          <div className="flex justify-between items-baseline py-1 border-b border-dashed border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Price</span>
                            <div className="text-right">
                              <span className="text-sm md:text-base font-black text-gray-900">{formatPrice(product.price)}</span>
                              {product.originalPrice && product.originalPrice > product.price && (
                                <span className="block text-[10px] sm:text-xs text-gray-400 line-through">
                                  {formatPrice(product.originalPrice)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Row: Artisan / Location */}
                          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Artisan</span>
                            <span className="text-xs font-extrabold text-gray-700">
                              {product.artisan || "Verified Partner"}
                            </span>
                          </div>

                          {/* Row: Rating */}
                          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Rating</span>
                            <div className="flex items-center gap-1">
                              <Star size={13} className="text-yellow-450 fill-yellow-450 shrink-0" />
                              <span className="text-xs font-black text-gray-800">{product.rating || 4.5}</span>
                              <span className="text-[10px] font-bold text-gray-450">({product.reviewCount || 12})</span>
                            </div>
                          </div>

                          {/* Row: Stock status */}
                          <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Availability</span>
                            <div>
                              {product.stock === 0 ? (
                                <span className="text-[9px] sm:text-[10px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                  Out of Stock
                                </span>
                              ) : product.stock <= 5 ? (
                                <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                  Low ({product.stock})
                                </span>
                              ) : (
                                <span className="text-[9px] sm:text-[10px] font-extrabold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                  {product.stock} In Stock
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Row: Description */}
                          <div className="space-y-1 py-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Description</span>
                            <p className="text-[11px] text-gray-500 font-medium leading-relaxed line-clamp-3">
                              {product.description}
                            </p>
                          </div>
                        </div>

                        {/* Interactive actions */}
                        <div className="space-y-2">
                          <button
                            disabled={product.stock === 0 || status === "loading" || status === "added"}
                            onClick={() => handleAddToCart(product)}
                            className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all outline-none ${
                              product.stock === 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200/50"
                                : status === "added"
                                ? "bg-green-600 text-white"
                                : "bg-gray-900 hover:bg-orange-600 text-white cursor-pointer shadow-sm shadow-gray-950/5"
                            }`}
                          >
                            <ShoppingBag size={13} />
                            <span>
                              {status === "loading"
                                ? "Adding..."
                                : status === "added"
                                ? "Added to Cart"
                                : product.stock === 0
                                ? "Sold Out"
                                : "Add to Cart"}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty fill-in state slots if < 3 items compared */}
                  {Array.from({ length: 3 - items.length }).map((_, i) => (
                    <div 
                      key={`empty-${i}`} 
                      className="hidden md:flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl p-6 text-center space-y-3 min-h-[400px] pl-6 ml-6"
                    >
                      <div className="w-12 h-12 rounded-full border border-gray-150 flex items-center justify-center text-gray-400 bg-gray-50/50">
                        <HelpCircle size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-gray-500 uppercase tracking-wider">Empty Comparison Slot</h5>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-bold leading-relaxed max-w-[160px] mx-auto">
                          Select another product on SokoPlus to compare specifications directly
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* View detail page redirect info footer */}
              <div className="bg-gray-50 px-5 py-4 border-t border-gray-150/40 text-center">
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">
                  💡 Tip: Comparing items helps review local shipping tiers and pricing to optimize order sizes!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
