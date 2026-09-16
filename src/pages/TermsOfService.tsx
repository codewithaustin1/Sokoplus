import React from "react";
import SEO from "../components/SEO";
import { motion } from "motion/react";

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <SEO title="Terms of Service" description="Terms of Service for Sokoplus Kenya" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-16 border border-gray-100 shadow-sm space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Last Updated: May 18, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">1. Agreement to Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            By accessing or using Sokoplus, you agree to be bound by these Terms of Service. These Terms constitute a legally binding agreement between you and <strong>SOKOPLUS HORIZON</strong> (Business Registration No. BN-J9S6383Q, carrying on business as "Sokoplus", "we", "us", or "our"). If you disagree with any part of the terms, then you may not access the service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">2. Description of Service</h2>
          <p className="text-gray-600 leading-relaxed">
            SOKOPLUS HORIZON provides an online marketplace connecting Kenyan artisans and vendors with customers. We facilitate transactions but are not necessarily the seller of the actual goods unless specifically stated.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">3. User Accounts</h2>
          <p className="text-gray-600 leading-relaxed">
            When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">4. Intellectual Property</h2>
          <p className="text-gray-600 leading-relaxed">
            The Service and its original content, features, and functionality are and will remain the exclusive property of SOKOPLUS HORIZON and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of SOKOPLUS HORIZON.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">5. Limitation of Liability</h2>
          <p className="text-gray-600 leading-relaxed">
            In no event shall SOKOPLUS HORIZON, nor its proprietor, directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
          </p>
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-8">
          <h2 className="text-xl font-bold text-gray-900">6. Registered Business Details & Contacts</h2>
          <div className="text-sm text-gray-600 space-y-1.5">
            <p><strong>Registered Business Name:</strong> SOKOPLUS HORIZON</p>
            <p><strong>Registration Number:</strong> BN-J9S6383Q (The Registration of Business Names Act, Cap. 499, Section 14)</p>
            <p><strong>Registered Office:</strong> Floor: Ground Floor, Room: Door 2 Greenville, Mararo Road, Kiambu Kabete District, Wangige, P.O. Box 23070, 00604 - Lower Kabete, Kenya</p>
            <p className="pt-2 text-gray-500">
              Questions about the Terms of Service should be sent to us at: <span className="text-orange-600 font-bold">legal@sokoplus.co.ke</span>
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
