import React, { useState } from "react";
import SEO from "../components/SEO";
import { motion, AnimatePresence } from "motion/react";
import { 
  Truck, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  HelpCircle, 
  ChevronDown, 
  Info,
  Gift,
  Mail,
  MessageSquare
} from "lucide-react";

export default function Shipping() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const shippingRates = [
    {
      destination: "Nairobi Central Areas",
      coverage: "CBD, Westlands, Lavington, Kilimani, Kileleshwa, Parklands, Ngara, Hurlingham, Highridge",
      fee: "KES 150",
      time: "Same Day / Next Day"
    },
    {
      destination: "Nairobi Suburbs",
      coverage: "All other locations within Nairobi City County borders",
      fee: "KES 200",
      time: "1 - 2 Business Days"
    },
    {
      destination: "Nairobi Metropolitan",
      coverage: "Kiambu, Kajiado, and Machakos County suburbs",
      fee: "KES 250",
      time: "1 - 2 Business Days"
    },
    {
      destination: "Major Upcountry City Centres",
      coverage: "Mombasa City (CBD/Island), Kisumu City, Nakuru City, Eldoret City",
      fee: "KES 350",
      time: "2 - 3 Business Days"
    },
    {
      destination: "Remote & Other Upcountry Locations",
      coverage: "All other Kenyan counties, rural zones, and off-centre towns",
      fee: "KES 450",
      time: "3 - 5 Business Days"
    }
  ];

  const shippingFaqs = [
    {
      q: "How do I qualify for Free Shipping?",
      a: "All orders across Kenya with a subtotal value of KES 15,000 or greater automatically qualify for free standard shipping! No discount codes required; the discount is applied directly during the checkout process."
    },
    {
      q: "Can I track my delivery status in real-time?",
      a: "Yes! Once your order has been prepared and handed over to our dispatch partners, you will receive an SMS and Email notification with tracking details. You can also view live order logs and transition history inside your Profile page order tracking panel."
    },
    {
      q: "Do you ship internationally?",
      a: "Currently, our website is optimized for deliveries within Kenya. However, we do facilitate custom international shipping via DHL or FedEx. Please reach out to our team at hello@sokoplus.com or start a live support chat to arrange custom international quotes."
    },
    {
      q: "What couriers do you work with?",
      a: "We only partner with trusted and safe courier services, including G4S Security Services, Wells Fargo, and certified independent Nairobi delivery riders to ensure package safety and on-time drop-offs."
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 sm:py-20 font-sans">
      <SEO title="Shipping & Delivery Information" description="Transparent, secure, and affordable shipping services across Kenya by Sokoplus." />

      {/* Hero Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-4">
        <div className="inline-flex items-center space-x-2 bg-orange-50 text-orange-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-orange-100/50">
          <Truck size={13} className="animate-bounce" />
          <span>Sokoplus Safe Shipping</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
          Transparent <span className="text-orange-600">Shipping</span> & Logistics
        </h1>
        <p className="text-gray-500 font-medium text-sm sm:text-base leading-relaxed">
          We bring the very best local custom handicrafts, designs, and essentials straight to your doorstep. We charge clean, location-based rates that ensure fair courier compensation and speedy arrival.
        </p>
      </div>

      {/* Rewards callout banner */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100/60 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 mb-16 shadow-sm">
        <div className="w-14 h-14 bg-orange-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-100">
          <Gift size={28} />
        </div>
        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-lg font-black text-gray-950">Free Delivery on Big Orders!</h3>
          <p className="text-gray-500 text-sm font-medium">
            Spend KES 15,000 or more in one transaction and we cover 100% of your shipping fees automatically, no matter your county in Kenya.
          </p>
        </div>
      </div>

      {/* Interactive Shipping Rates Table Card */}
      <div className="bg-white border border-gray-100 rounded-[2.5rem] p-6 sm:p-10 shadow-sm mb-16 overflow-hidden">
        <div className="mb-8">
          <span className="text-xs font-black uppercase text-orange-600 tracking-wider">Pricing Structures</span>
          <h2 className="text-2xl font-extrabold text-gray-900 mt-1">Sokoplus Delivery Matrix</h2>
          <p className="text-gray-500 text-sm mt-1">Rates are dynamically configured based on your chosen county and city at Checkout step.</p>
        </div>

        <div className="overflow-x-auto -mx-6 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[600px] px-6 sm:px-0">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-black uppercase text-gray-400 tracking-wider">
                <th className="py-4 px-6 md:px-4">Destination Zone</th>
                <th className="py-4 px-6 md:px-4">Key Coverage & Examples</th>
                <th className="py-4 px-6 md:px-4">Standard Rate</th>
                <th className="py-4 px-6 md:px-4">Est. Delivery Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shippingRates.map((rate, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6 md:px-4 font-extrabold text-gray-900 text-sm">{rate.destination}</td>
                  <td className="py-4 px-6 md:px-4 text-xs font-medium text-gray-500 leading-relaxed max-w-xs">{rate.coverage}</td>
                  <td className="py-4 px-6 md:px-4 text-sm font-black text-orange-600">{rate.fee}</td>
                  <td className="py-4 px-6 md:px-4 text-xs font-semibold text-gray-650 flex items-center space-x-1.5 mt-3 border-0">
                    <Clock size={12} className="text-gray-400" />
                    <span>{rate.time}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipping Process & Key Values Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col space-y-4">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">Swift Processing</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            All ready-made vendor parcels are compiled and ready for dispatch in under <strong>24 working hours</strong> of placing your order.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col space-y-4">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">Insured Packages</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Should an item get lost or suffer physical damages in transit, we guarantee complete refunds or instant custom duplicates.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col space-y-4">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <MapPin size={20} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">National Delivery</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            We deliver to standard central city centers, residential homes, business compounds, or specific country G4S offices safely.
          </p>
        </div>
      </div>

      {/* Delivery FAQ Accordion */}
      <div className="space-y-4 max-w-3xl mx-auto mb-16">
        <h3 className="text-xl font-extrabold text-gray-900 text-center flex items-center justify-center space-x-2 mb-6">
          <HelpCircle className="text-orange-500" size={20} />
          <span>Shipping Logistics FAQ</span>
        </h3>

        <div className="space-y-2.5">
          {shippingFaqs.map((faq, idx) => {
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
                  <span className="text-sm font-extrabold text-gray-900 pr-4">{faq.q}</span>
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
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Support help callout banner */}
      <div className="bg-orange-600 text-white rounded-[2rem] p-8 text-center max-w-3xl mx-auto space-y-6 shadow-xl relative overflow-hidden">
        <div className="space-y-2">
          <h3 className="text-2xl font-black">Want custom delivery services?</h3>
          <p className="text-orange-100 text-sm max-w-md mx-auto">
            Our delivery partners are extremely flexible. If you have any special requirements, timeline goals, or urgent cargo tasks, talk to us.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
          <a
            href="mailto:hello@sokoplus.com"
            className="flex items-center space-x-2 bg-white text-orange-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-orange-50 transition-colors w-full sm:w-auto justify-center"
          >
            <Mail size={16} />
            <span>Email hello@sokoplus.com</span>
          </a>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}
            className="flex items-center space-x-2 bg-orange-700/50 text-white border border-orange-400/30 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-orange-700 transition-colors w-full sm:w-auto justify-center cursor-pointer"
          >
            <MessageSquare size={16} />
            <span>Open Customer Concierge Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
