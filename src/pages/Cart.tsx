import { Link } from "react-router-dom";
import { Trash2, ShoppingBag, Plus, Minus, ArrowRight } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useLanguage } from "../lib/LanguageContext";
import { motion } from "motion/react";
import { trackEvent } from "../lib/analytics";

export default function Cart() {
  const { items, removeFromCart, updateQuantity, addToCart, total } = useCart();
  const { t } = useLanguage();

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 px-4">
        <div className="bg-gray-100 p-8 rounded-full mb-4">
          <ShoppingBag size={64} className="text-gray-300" />
        </div>
        <h2 className="text-3xl font-bold">{t("Your cart is empty")}</h2>
        <p className="text-gray-500">{t("Looks like you haven't added anything to your cart yet.")}</p>
        <Link to="/" className="bg-orange-600 text-white px-8 py-4 rounded-full font-bold hover:bg-orange-700 transition-all">
          {t("Start Shopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-black mb-12 tracking-tight">{t("Your Cart")}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const uniqueKey = `${item.productId}-${item.customizations?.material || "default"}-${item.customizations?.color || "default"}`;
            return (
              <motion.div 
                layout
                key={uniqueKey} 
                className="flex items-start space-x-3 sm:space-x-6 p-3 sm:p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm min-w-0"
              >
                {/* Image */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 dark:bg-gray-950 rounded-xl overflow-hidden flex-shrink-0 self-center">
                  {item.image && item.image.trim() !== "" ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200 dark:text-gray-750">
                      <ShoppingBag size={24} className="sm:hidden" />
                      <ShoppingBag size={32} className="hidden sm:block" />
                    </div>
                  )}
                </div>

                {/* Info & Action Area */}
                <div className="flex-grow min-w-0 flex flex-col justify-between self-stretch">
                  <div>
                    {/* Header Row: Title & Remove button */}
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white leading-snug line-clamp-1 sm:line-clamp-2">
                        {item.name}
                      </h3>
                      <button 
                        onClick={() => removeFromCart(item.productId, item.customizations)}
                        className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer flex-shrink-0 p-1 -m-1"
                        title="Remove all"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                    {/* Unit Price */}
                    <p className="text-xs sm:text-sm font-semibold text-orange-600 mt-0.5 tabular-nums">
                      KES {item.price.toLocaleString()} {t("each")}
                    </p>

                    {/* Customization Details (Highly compact on mobile) */}
                    {item.customizations && (
                      <div className="mt-1.5 p-2 bg-orange-50/20 dark:bg-orange-950/10 rounded-xl border border-orange-100/30 dark:border-orange-900/20 flex flex-col space-y-0.5 text-[10px] sm:text-xs">
                        <div className="flex items-center space-x-1.5">
                          <span 
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-gray-200 dark:border-gray-700 flex-shrink-0" 
                            style={{ backgroundColor: item.customizations.color }}
                          ></span>
                          <span className="text-gray-500 dark:text-gray-400">{t("Color:")} <strong className="text-gray-800 dark:text-gray-200 font-semibold">{item.customizations.colorName}</strong></span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">{t("Material & Hardwood:")} <strong className="text-gray-800 dark:text-gray-200 font-semibold">{item.customizations.material}</strong></span>
                        {item.customizations.notes && (
                          <span className="text-orange-700 dark:text-orange-400 italic mt-0.5 font-medium line-clamp-1">{item.customizations.notes}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity and Subtotal Row */}
                  <div className="flex items-center justify-between gap-4 mt-2 pt-1 border-t border-gray-50 dark:border-gray-800 sm:border-t-0 sm:pt-0">
                    {/* Quantity selectors */}
                    <div className="flex items-center border border-gray-100 dark:border-gray-800 rounded-lg p-0.5 bg-gray-50 dark:bg-gray-950">
                      <button 
                        onClick={() => updateQuantity(item.productId, item.quantity - 1, item.customizations)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors cursor-pointer"
                        title="Decrease"
                      >
                        <Minus size={12} className="sm:hidden" />
                        <Minus size={16} className="hidden sm:block" />
                      </button>
                      <span className="px-2 sm:px-4 font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200 select-none tabular-nums">
                        {item.quantity}
                      </span>
                      <button 
                        onClick={() => addToCart({ ...item, quantity: 1 })}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors cursor-pointer"
                        title="Increase"
                      >
                        <Plus size={12} className="sm:hidden" />
                        <Plus size={16} className="hidden sm:block" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right font-black text-sm sm:text-lg text-gray-900 dark:text-white tabular-nums">
                      KES {(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 sticky top-24">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t("Order Summary")}</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>{t("Subtotal")}</span>
                <span className="tabular-nums font-semibold">KES {total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t("Shipping fee will be calculated at checkout after resolving your delivery location.")}
              </p>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex justify-between text-xl font-black text-gray-900 dark:text-white">
                <span>{t("Total")}</span>
                <span className="tabular-nums">KES {total.toLocaleString()}</span>
              </div>
            </div>
            <Link 
              to="/checkout"
              onClick={() => {
                trackEvent("begin_checkout", {
                  value: total,
                  currency: "KES",
                  items: items.map(t => ({
                    item_id: t.productId,
                    item_name: t.name,
                    price: t.price,
                    quantity: t.quantity
                  }))
                });
              }}
              className="w-full block text-center bg-[#101828] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#1a2333] transition-all shadow-lg shadow-gray-200 dark:shadow-none flex items-center justify-center"
            >
              {t("Next")} <ArrowRight size={20} className="ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
