import { Link } from "react-router-dom";
import { Trash2, ShoppingBag, Plus, Minus, ArrowRight } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { motion } from "motion/react";

export default function Cart() {
  const { items, removeFromCart, addToCart, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 px-4">
        <div className="bg-gray-100 p-8 rounded-full mb-4">
          <ShoppingBag size={64} className="text-gray-300" />
        </div>
        <h2 className="text-3xl font-bold">Your cart is empty</h2>
        <p className="text-gray-500">Looks like you haven't added anything to your cart yet.</p>
        <Link to="/" className="bg-orange-600 text-white px-8 py-4 rounded-full font-bold hover:bg-orange-700 transition-all">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-black mb-12 tracking-tight">Your Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-6">
          {items.map((item) => (
            <motion.div 
              layout
              key={item.productId} 
              className="flex items-center space-x-6 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm"
            >
              <div className="w-24 h-24 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-200">
                    <ShoppingBag size={32} />
                  </div>
                )}
              </div>
              <div className="flex-grow">
                <h3 className="text-lg font-bold">{item.name}</h3>
                <p className="text-orange-600 font-bold">KES {item.price.toLocaleString()}</p>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center border border-gray-100 rounded-lg p-1 bg-gray-50">
                    <button 
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1 hover:text-orange-600 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="px-4 font-bold text-sm">{item.quantity}</span>
                    <button 
                      onClick={() => addToCart({ ...item, quantity: 1 })}
                      className="p-1 hover:text-orange-600 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.productId)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="text-right font-black text-xl">
                KES {(item.price * item.quantity).toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6 sticky top-24">
            <h2 className="text-2xl font-bold">Order Summary</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Shipping (Nairobi)</span>
                <span>KES 250</span>
              </div>
              <div className="border-t border-gray-100 pt-4 flex justify-between text-xl font-black text-gray-900">
                <span>Total</span>
                <span>KES {(total + 250).toLocaleString()}</span>
              </div>
            </div>
            <Link 
              to="/checkout"
              className="w-full block text-center bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 flex items-center justify-center"
            >
              Secure Checkout <ArrowRight size={20} className="ml-2" />
            </Link>
            <p className="text-[10px] text-gray-400 text-center">
              Payments secured via Paystack. Trusted across 47 counties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
