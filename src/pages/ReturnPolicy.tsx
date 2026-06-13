import React, { useState } from "react";
import SEO from "../components/SEO";
import { motion, AnimatePresence } from "motion/react";
import { 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle, 
  ChevronDown, 
  Truck, 
  Calendar, 
  RotateCcw, 
  ArrowRight,
  ShieldCheck,
  Mail,
  MessageSquare
} from "lucide-react";

export default function ReturnPolicy() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqItems = [
    {
      q: "Who covers the cost of return shipping?",
      a: "If the return is due to a product defect, damaged goods, or the wrong item, Sokoplus covers 100% of return transit costs. For standard change-of-mind returns, the return dispatch to our Nairobi Hub is covered by the customer."
    },
    {
      q: "How fast will I receive my refund?",
      a: "Once your item is received and inspected (typically within 2 business days), we immediately process refunds. M-Pesa refunds take under 24 hours, while bank card payments resolve in 3–5 business days."
    },
    {
      q: "Are handmade or custom items returnable?",
      a: "Ready-made items are fully returnable. However, custom commissions made to your unique dimensions/designs cannot be returned unless they arrive with physical defects. We offer complimentary modification or adjustment assistance for these custom orders instead."
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 sm:py-20 font-sans">
      <SEO title="Return & Refund Policy" description="Simple, transparent, and fair return & exchange guidelines at Sokoplus." />

      {/* Header and Hero Block */}
      <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-4">
        <div className="inline-flex items-center space-x-2 bg-orange-50 text-orange-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-orange-100/50">
          <RefreshCw size={13} className="animate-spin duration-3000" />
          <span>Sokoplus Fair Guarantee</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
          Returns & <span className="text-orange-600">Exchanges</span> Shared Fairly
        </h1>
        <p className="text-gray-500 font-medium text-sm sm:text-base leading-relaxed">
          We want you to love your purchase. If something is not quite right, our transparent return process is designed to protect your peace of mind while supporting our independent local brands, merchants, and makers.
        </p>
      </div>

      {/* Core Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col space-y-4">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">14-Day Return Window</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Return ready-made items within <strong>14 calendar days</strong> of receiving delivery. Items must be unworn, unwashed, and in original packaging.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col space-y-4">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <Truck size={20} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">Defect Cover</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Product defect or design fault? We cover 100% of return courier costs and dispatch a fresh replacement immediately.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col space-y-4">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <RotateCcw size={20} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">Hassle-Free Payouts</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Get your money back exactly how you paid. M-Pesa reimbursements are processed instantly upon inspection validation.
          </p>
        </div>
      </div>

      {/* Simplified Process Steps Section */}
      <div className="bg-gray-50 border border-gray-100 rounded-[2.5rem] p-6 sm:p-12 mb-16">
        <div className="max-w-xl mb-10">
          <span className="text-xs font-black uppercase text-orange-600 tracking-wider">How It Works</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">Our Simple 3-Step Process</h2>
          <p className="text-gray-500 text-sm mt-2">Returning an item takes less than five minutes of your time.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center">1</div>
            <h4 className="text-base font-bold text-gray-905">Initialize Request</h4>
            <p className="text-sm text-gray-500 leading-relaxed">
              Drop an email to <a href="mailto:returns@sokoplus.co.ke" className="text-orange-600 hover:underline">returns@sokoplus.co.ke</a> with your order number and simple photos of the product.
            </p>
          </div>

          <div className="space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center">2</div>
            <h4 className="text-base font-bold text-gray-905">Pack & Dispatch</h4>
            <p className="text-sm text-gray-500 leading-relaxed">
              Wrap your item in its original box. Deliver it to our central Nairobi Hub, or we can assist in organizing a local partner courier.
            </p>
          </div>

          <div className="space-y-3 relative">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center">3</div>
            <h4 className="text-base font-bold text-gray-905">Inspect & Refund</h4>
            <p className="text-sm text-gray-500 leading-relaxed">
              Within 2 working days of dropoff, our team approves the refund or organizes an exchange. Refund is sent instantly over M-Pesa.
            </p>
          </div>
        </div>
      </div>

      {/* Exclusions Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg font-extrabold text-gray-950 mb-3 flex items-center space-x-2">
            <CheckCircle2 size={18} className="text-green-500" />
            <span>Fully Eligible Items</span>
          </h3>
          <ul className="space-y-2.5 text-sm text-gray-550">
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Standard fashion, clothes, and apparel</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Sisal baskets, standard pottery, and clay crafts</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Electronics, smartphone accessories, and home items</span>
            </li>
          </ul>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg font-extrabold text-gray-950 mb-3 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-700">Non-Returnable Exclusions</span>
          </h3>
          <ul className="space-y-2.5 text-sm text-gray-550">
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              <span>Custom custom-made name engravings or furniture sizing</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              <span>Opened personal cosmetics or sanitary products</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              <span>Fresh food, groceries, and perishables</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="space-y-4 max-w-3xl mx-auto mb-16">
        <h3 className="text-xl font-extrabold text-gray-900 text-center flex items-center justify-center space-x-2 mb-6">
          <HelpCircle className="text-orange-500" size={20} />
          <span>Return Questions FAQ</span>
        </h3>

        <div className="space-y-2.5">
          {faqItems.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx} 
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left px-5 py-4 focus:outline-none"
                >
                  <span className="text-sm font-extrabold text-gray-900 pr-4">{item.q}</span>
                  <ChevronDown 
                    size={16} 
                    className={`text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-orange-600' : ''}`} 
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-1 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Help Card */}
      <div className="bg-orange-600 text-white rounded-[2rem] p-8 text-center max-w-3xl mx-auto space-y-6 shadow-xl relative overflow-hidden">
        <div className="space-y-2">
          <h3 className="text-2xl font-black">Still have queries or ready to return?</h3>
          <p className="text-orange-100 text-sm max-w-md mx-auto">
            Our friendly customer service team stands ready to solve any questions you might have about refunds, exchanges, or partner support requests.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
          <a
            href="mailto:returns@sokoplus.co.ke"
            className="flex items-center space-x-2 bg-white text-orange-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-orange-50 transition-colors w-full sm:w-auto justify-center"
          >
            <Mail size={16} />
            <span>Email returns@sokoplus.co.ke</span>
          </a>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}
            className="flex items-center space-x-2 bg-orange-700/50 text-white border border-orange-400/30 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-orange-700 transition-colors w-full sm:w-auto justify-center cursor-pointer"
          >
            <MessageSquare size={16} />
            <span>Open Live Concierge Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
