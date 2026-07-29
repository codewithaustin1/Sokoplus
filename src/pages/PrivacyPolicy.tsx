import React, { useState } from "react";
import SEO from "../components/SEO";
import { motion } from "motion/react";
import { ShieldAlert, Trash2, ArrowRight } from "lucide-react";
import { UserDataErasureModal } from "../components/UserDataErasureModal";
import { auth } from "../lib/firebase";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  const [showErasureModal, setShowErasureModal] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <SEO title="Privacy Policy & Statutory Data Rights" description="Privacy Policy and Statutory Data Erasure Rights for Sokoplus Kenya" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 md:p-16 border border-gray-100 dark:border-gray-800 shadow-sm space-y-8 text-gray-900 dark:text-gray-100"
      >
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">Privacy Policy & Data Rights</h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Last Updated: July 29, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">1. Introduction</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Welcome to Sokoplus ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data under the Kenya Data Protection Act (KPDPA 2019) and global data protection regulations (GDPR).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">2. Data We Collect</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-300">
            <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
            <li><strong>Contact Data:</strong> includes billing address, delivery address, email address and telephone numbers.</li>
            <li><strong>Financial Data:</strong> includes payment transaction references.</li>
            <li><strong>Transaction Data:</strong> includes details about payments to and from you and other details of products purchased from us.</li>
            <li><strong>Technical Data:</strong> includes internet protocol (IP) address, login data, browser type and version.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">3. Your Statutory "Right to Be Forgotten" (Data Erasure)</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Under section 40 of the Kenya Data Protection Act (KPDPA 2019) and Article 17 of the General Data Protection Regulation (GDPR), you have the legally protected right to request the permanent erasure or anonymization of your personal data stored across our servers and database collections.
          </p>

          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 p-6 sm:p-8 rounded-3xl border border-red-100 dark:border-red-900/40 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <ShieldAlert size={24} />
              <span className="font-extrabold text-xs uppercase tracking-wider">Automated Statutory Compliance Queue</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
              When a request is submitted, our automated privacy engine queues your account for cascading data scrubbing across orders, support tickets, reviews, and profile records within our 30-day statutory deadline.
            </p>

            <div className="pt-2">
              {auth.currentUser ? (
                <button
                  onClick={() => setShowErasureModal(true)}
                  className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Trash2 size={16} />
                  Submit Personal Data Erasure Request
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-gray-950 dark:bg-white text-white dark:text-gray-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow transition-all"
                >
                  Sign In to Manage Data Rights
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-8">
          <p className="text-sm text-gray-500">
            If you have any questions about this privacy policy or our statutory data practices, please contact our Data Protection Officer at: <span className="text-orange-600 font-bold">privacy@sokoplus.co.ke</span>
          </p>
        </section>
      </motion.div>

      <UserDataErasureModal
        isOpen={showErasureModal}
        onClose={() => setShowErasureModal(false)}
        userProfile={null}
      />
    </div>
  );
}

