import React, { useState } from "react";
import SEO from "../components/SEO";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Search,
  MessageSquare,
  HelpCircle,
  Truck,
  UserCheck,
  RotateCcw,
  CreditCard,
  ShieldCheck,
  Store,
  Info
} from "lucide-react";
import { useSellerStudio } from "../lib/SellerStudioContext";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface CategoryConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

const CATEGORIES: CategoryConfig[] = [
  { id: "All", label: "All Questions", icon: HelpCircle },
  { id: "Shipping & Delivery", label: "Shipping", icon: Truck },
  { id: "Accounts & Security", label: "Accounts", icon: UserCheck },
  { id: "Returns & Refunds", label: "Returns", icon: RotateCcw },
  { id: "Payments & Billing", label: "Payments", icon: CreditCard },
  { id: "Privacy & Data Rights", label: "Privacy & Data", icon: ShieldCheck },
  { id: "Sellers & Artisans", label: "Sellers & Artisans", icon: Store },
  { id: "General", label: "General", icon: Info }
];

const FAQ_ITEMS: FAQItem[] = [
  // General
  {
    id: "g1",
    category: "General",
    question: "What is Sokoplus?",
    answer: "Sokoplus is a curated digital marketplace that connects talented Kenyan local artisans directly with global quality standards and customers. We showcase authentic creations made with passion in Nairobi and across Kenya."
  },
  {
    id: "g2",
    category: "General",
    question: "Do you have a physical store?",
    answer: "Currently, Sokoplus operates primarily as an online digital marketplace to keep overhead costs low and pass maximum earnings directly to our artisans. However, you can view high-resolution photos, artisan stories, and order securely via our storefront."
  },

  // Shipping & Delivery
  {
    id: "s1",
    category: "Shipping & Delivery",
    question: "How much is delivery and where do you ship?",
    answer: "We ship both locally within Kenya and internationally worldwide. Standard delivery within Nairobi takes 1-2 business days with flat affordable rates, while countrywide and international delivery is calculated at checkout based on location and weight."
  },
  {
    id: "s2",
    category: "Shipping & Delivery",
    question: "How can I track my order status?",
    answer: "Once authenticated, you can view your real-time order history, tracking updates, and dispatch statuses directly from your Profile page dashboard."
  },
  {
    id: "s3",
    category: "Shipping & Delivery",
    question: "Can I modify or cancel my shipping order?",
    answer: "As long as the package has not yet dispatched from our warehouse or artisan workshop, you can request delivery detail changes or cancellation. Please contact our support team on WhatsApp immediately for urgent modifications."
  },

  // Accounts & Security
  {
    id: "a1",
    category: "Accounts & Security",
    question: "How do I create an account or reset my password?",
    answer: "Click 'Sign In' at the top of the screen to create a new account using your email or Google account. If you forget your password, click 'Forgot Password?' on the login screen to receive a secure password reset link."
  },
  {
    id: "a2",
    category: "Accounts & Security",
    question: "How do I set up Two-Factor Authentication (2FA)?",
    answer: "You can enable Two-Factor Authentication (TOTP) from your Profile > Account Settings. Scan the QR code using any authenticator app (Google Authenticator, Authy, etc.) and input the 6-digit verification code to secure your account."
  },
  {
    id: "a3",
    category: "Accounts & Security",
    question: "How do I update my default delivery address?",
    answer: "Log in and navigate to your Profile page. Under the 'Personal Information & Addresses' section, update your county, city, street, and phone number, then save your changes."
  },

  // Returns & Refunds
  {
    id: "r1",
    category: "Returns & Refunds",
    question: "What is your return policy?",
    answer: "We offer a relaxed, user-friendly 7-day return policy for standard, non-customized products from the date of delivery. Items must be unused and in their original packaging."
  },
  {
    id: "r2",
    category: "Returns & Refunds",
    question: "Are custom or bespoke artisan items returnable?",
    answer: "For custom, made-to-order, or bespoke artisan items, returns are generally not accepted unless the package arrives damaged or defective. Reach out to customer care with photo evidence to initiate a replacement or claim."
  },
  {
    id: "r3",
    category: "Returns & Refunds",
    question: "How long do refunds take to process?",
    answer: "Once an approved returned item passes quality inspection, refunds are processed within 3-5 business days directly back to your original payment method or M-Pesa account."
  },

  // Payments & Billing
  {
    id: "p1",
    category: "Payments & Billing",
    question: "What payment systems are integrated?",
    answer: "We support secure digital payments through M-Pesa Express, Visa, Mastercard, and other debit/credit cards powered securely via encrypted checkout gateways."
  },
  {
    id: "p2",
    category: "Payments & Billing",
    question: "Is pay-on-delivery accepted?",
    answer: "To guarantee artisan commitment and facilitate raw material procurement for bespoke orders, we process payments online at checkout. Special arrangements can be discussed via our support line for corporate or bulk purchases."
  },

  // Privacy & Data Rights
  {
    id: "pd1",
    category: "Privacy & Data Rights",
    question: "How do I exercise my 'Right to Be Forgotten' (Data Erasure)?",
    answer: "Under section 40 of the Kenya Data Protection Act (KPDPA) and GDPR, you have the right to request erasure or anonymization of your data. You can submit a formal Data Erasure Request directly from our Privacy Policy page or Profile Settings."
  },
  {
    id: "pd2",
    category: "Privacy & Data Rights",
    question: "How is my personal information protected?",
    answer: "We employ strict multi-factor authentication, SSL encryption, and server-side secret management to ensure your identity, delivery addresses, and payment data remain confidential and secure."
  },

  // Sellers & Artisans
  {
    id: "sa1",
    category: "Sellers & Artisans",
    question: "How do I become a seller on Sokoplus?",
    answer: "Signed-up users can apply to become a vendor directly from their Profile Dashboard. Simply log in, navigate to 'Seller Studio', and submit your application with details about your craft or workshop. Once approved, you can publish creations, manage catalog inventory, and set custom prices."
  },
  {
    id: "sa2",
    category: "Sellers & Artisans",
    question: "What platform fees apply to seller sales?",
    answer: "A nominal flat platform fee of 5% applies exclusively to completed third-party vendor sales. Sokoplus manages platform maintenance, marketing exposure, and storage logistics."
  },
  {
    id: "sa3",
    category: "Sellers & Artisans",
    question: "How do local artisans benefit?",
    answer: "Sokoplus guarantees fair trade practices. Over 90% of order revenue goes directly to local artisans, empowering sustainable livelihoods and preserving traditional Kenyan craftsmanship."
  }
];

export default function FAQ() {
  const { sellerStudioEnabled } = useSellerStudio();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  // Filter out seller/artisan questions if seller studio is disabled
  const availableItems = FAQ_ITEMS.filter((item) => {
    if (!sellerStudioEnabled && item.category === "Sellers & Artisans") {
      return false;
    }
    return true;
  });

  const availableCategories = CATEGORIES.filter((cat) => {
    if (!sellerStudioEnabled && cat.id === "Sellers & Artisans") return false;
    return true;
  });

  const filteredFAQs = availableItems.filter((item) => {
    const matchesSearch =
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleAccordion = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  // Get item counts per category
  const getCategoryCount = (catId: string) => {
    if (catId === "All") return availableItems.length;
    return availableItems.filter((item) => item.category === catId).length;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
      <SEO title="FAQ & Help Center" description="Frequently Asked Questions - Sokoplus Kenya" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 sm:space-y-10"
      >
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 p-3.5 rounded-2xl mb-1 shadow-sm">
            <HelpCircle size={32} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-sm sm:text-base font-medium leading-relaxed">
            Find quick answers about shipping, user accounts, returns, M-Pesa payments, privacy rights, and selling on Sokoplus.
          </p>
        </div>

        {/* Search Bar & Categorization Filter Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by keyword, e.g. 'refund', 'delivery', 'M-Pesa', '2FA'..."
              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl pl-12 pr-5 py-4 text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all font-semibold text-gray-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Categorization Filter Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
              <span>Filter by Category</span>
              <span>Showing {filteredFAQs.length} {filteredFAQs.length === 1 ? "question" : "questions"}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {availableCategories.map((cat) => {
                const IconComponent = cat.icon;
                const count = getCategoryCount(cat.id);
                const isActive = activeCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setOpenIndex(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950 shadow-md scale-[1.02]"
                        : "bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800"
                    }`}
                  >
                    <IconComponent size={15} className={isActive ? "text-orange-400 dark:text-orange-600" : "text-gray-400"} />
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        isActive
                          ? "bg-white/20 dark:bg-black/20 text-white dark:text-gray-900"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* FAQ Accordions List */}
        <div className="space-y-3.5">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq) => {
              const isOpen = openIndex === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                    isOpen
                      ? "border-orange-200 dark:border-orange-900/40 ring-1 ring-orange-500/20"
                      : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between font-extrabold text-gray-900 dark:text-white cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 pr-4">
                      <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0">
                        {faq.category}
                      </span>
                      <span className="text-sm sm:text-base group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {faq.question}
                      </span>
                    </div>

                    <ChevronDown
                      size={18}
                      className={`text-gray-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-orange-600 dark:text-orange-400" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 border-t border-gray-50 dark:border-gray-800/80 pt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm text-gray-400 font-semibold space-y-2">
              <p className="text-base text-gray-700 dark:text-gray-300 font-bold">No matching questions found</p>
              <p className="text-xs text-gray-400">Try adjusting your search terms or selecting 'All Questions'.</p>
            </div>
          )}
        </div>

        {/* Footer Help Banner */}
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 dark:from-orange-950/30 dark:to-amber-950/20 rounded-3xl p-8 border border-orange-100 dark:border-orange-900/30 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <h3 className="font-extrabold text-gray-900 dark:text-white text-lg">Still have questions?</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
              Our customer experience team is active on WhatsApp to assist you in real time.
            </p>
          </div>
          <a
            href="https://wa.me/254740463021"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 bg-gray-950 dark:bg-white text-white dark:text-gray-950 px-6 py-3.5 rounded-2xl font-black hover:bg-orange-600 dark:hover:bg-orange-500 transition-all text-xs uppercase tracking-wider shadow-md active:scale-95 shrink-0"
          >
            <MessageSquare size={16} />
            <span>Chat With Us Directly</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
}

