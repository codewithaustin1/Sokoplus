import React, { useState } from "react";
import SEO from "../components/SEO";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search, MessageSquare, HelpCircle } from "lucide-react";
import { useSellerStudio } from "../lib/SellerStudioContext";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    category: "General",
    question: "What is Sokoplus?",
    answer: "Sokoplus is a curated digital marketplace that connects talented Kenyan local artisans directly with global quality standards and customers. We showcase authentic creations made with passion in Nairobi and across Kenya."
  },
  {
    category: "General",
    question: "How do I become a seller on Sokoplus?",
    answer: "Signed-up users can apply to become a seller directly from their Profile Dashboard. Simply log in, navigate to 'Become a Seller' or 'Seller Studio', and submit your application with details about your craft or workshop. Once the SokoPlus admin team reviews and approves your seller profile, you will gain access to your Seller Studio to publish creations, set custom categories and prices, and input custom product descriptions with support for formatted Markdown. A nominal flat platform fee of 5% applies exclusively to third-party vendor sales, and Sokoplus takes care of the storage and physical logistics of your items!"
  },
  {
    category: "General",
    question: "Do you have a physical shop?",
    answer: "Currently, we operate as an online marketplace to keep overhead costs low and pass maximum earnings directly to our artisans. However, you can view high-quality images, read artisan stories, and buy from our secure digital storefront."
  },
  {
    category: "Orders & Shipping",
    question: "How much is delivery and where do you ship?",
    answer: "We ship both locally within Kenya and internationally. Standard delivery within Nairobi takes 1-2 business days with flat rates, while international shipping is calculated at checkout based on package weight and destination."
  },
  {
    category: "Orders & Shipping",
    question: "How can I track my order?",
    answer: "Once authenticated, you can view your order history and track the current status of your purchases directly from your Profile page dashboard."
  },
  {
    category: "Orders & Shipping",
    question: "Can I cancel or modify my order?",
    answer: "As long as the artisan has not dispatched of your package, you can request changes or a cancellation. Please reach out to us instantly via our WhatsApp support for urgent order modifications."
  },
  {
    category: "Payments",
    question: "What payment systems are integrated?",
    answer: "We support secure payments through M-Pesa, Visa, Mastercard, and other global payment methods powered securely by Stack integrations."
  },
  {
    category: "Payments",
    question: "Is pay-on-delivery accepted?",
    answer: "To secure artisan commitment and ensure raw material procurement for bespoke orders, we generally process payments upon checkout. Reach out to our line if you need special arrangements."
  },
  {
    category: "Artisans & Support",
    question: "How do local artisans benefit?",
    answer: "Sokoplus ensures fair trade standards. A large majority of each sale returns directly to the respective artisan to bolster their sustainable livelihoods and support local craft preservation."
  },
  {
    category: "Artisans & Support",
    question: "What is your refund policy?",
    answer: "We offer a relaxed, user-friendly 7-day return policy for standard, non-custom orders from the date of delivery. Items must be in their original condition. For custom or bespoke artisan pieces, returns are generally not accepted unless they arrive damaged or defective. Feel free to contact customer support to initiate a claim or exchange."
  }
];

export default function FAQ() {
  const { sellerStudioEnabled } = useSellerStudio();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const categories = sellerStudioEnabled
    ? ["All", "General", "Orders & Shipping", "Payments", "Artisans & Support"]
    : ["All", "General", "Orders & Shipping", "Payments", "Support"];

  const filteredFAQs = FAQ_ITEMS.filter((item) => {
    if (!sellerStudioEnabled) {
      const qLower = item.question.toLowerCase();
      const aLower = item.answer.toLowerCase();
      if (
        qLower.includes("seller") ||
        qLower.includes("artisan") ||
        aLower.includes("seller") ||
        aLower.includes("artisan")
      ) {
        return false;
      }
    }

    const matchesSearch = 
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase());

    const mappedItemCategory = !sellerStudioEnabled && item.category === "Artisans & Support" ? "Support" : item.category;
    const matchesCategory = activeCategory === "All" || mappedItemCategory === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <SEO title="FAQ" description="Frequently Asked Questions - Sokoplus Kenya" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-10"
      >
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center bg-orange-50 text-orange-600 p-3 rounded-2xl mb-2">
            <HelpCircle size={28} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">FAQ</h1>
          <p className="text-gray-500 max-w-lg mx-auto font-medium">
            {sellerStudioEnabled 
              ? "Find instant answers to common questions about SokoPlus products, delivery, secure payment, and artisanal trade."
              : "Find instant answers to common questions about SokoPlus products, delivery, secure payment, and customer support."
            }
          </p>
        </div>

        {/* Search & Tabs Controls */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Search questions or keywords..."
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 text-sm outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium text-gray-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  setOpenIndex(null);
                }}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeCategory === cat
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-orange-55 hover:text-orange-600 border border-gray-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordions List */}
        <div className="space-y-4">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(idx)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between font-bold text-gray-900 duration-200"
                  >
                    <span className="pr-4">{faq.question}</span>
                    <ChevronDown 
                      size={18} 
                      className={`text-gray-450 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180 text-orange-600" : ""}`} 
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 border-t border-gray-50 pt-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-medium">
              No matching FAQs found. Try searching with other terms.
            </div>
          )}
        </div>

        {/* Footer info card */}
        <div className="bg-orange-50/50 rounded-3xl p-8 border border-orange-100 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h3 className="font-bold text-gray-900">Still have questions?</h3>
            <p className="text-sm text-gray-500 font-medium">Our customer experience team is always active to assist you.</p>
          </div>
          <a 
            href="https://wa.me/254740463021" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 bg-gray-900 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-orange-600 transition-all text-sm shadow-md shadow-gray-900/10"
          >
            <MessageSquare size={16} />
            <span>Chat With Us Directly</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
}
