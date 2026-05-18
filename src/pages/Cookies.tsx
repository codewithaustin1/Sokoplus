import React from "react";
import SEO from "../components/SEO";
import { motion } from "motion/react";

export default function Cookies() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <SEO title="Cookie Policy" description="Cookie Policy for Sokoplus Kenya" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-16 border border-gray-100 shadow-sm space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">Cookie Policy</h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Last Updated: May 18, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">1. What Are Cookies</h2>
          <p className="text-gray-600 leading-relaxed">
            Cookies are small pieces of text sent by your web browser by a website you visit. A cookie file is stored in your web browser and allows the Service or a third-party to recognize you and make your next visit easier and the Service more useful to you.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">2. How we use cookies</h2>
          <p className="text-gray-600 leading-relaxed">
            When you use and access the Service, we may place a number of cookies files in your web browser. We use cookies for the following purposes:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>To enable certain functions of the Service.</li>
            <li>To provide analytics.</li>
            <li>To store your preferences.</li>
            <li>To enable advertisements delivery, including behavioral advertising.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">3. Types of cookies we use</h2>
          <p className="text-gray-600 leading-relaxed">
            We use both session and persistent cookies on the Service and we use different types of cookies to run the Service:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li><strong>Essential cookies:</strong> We may use essential cookies to authenticate users and prevent fraudulent use of user accounts.</li>
            <li><strong>Preferences cookies:</strong> We may use preferences cookies to remember information that changes the way the Service behaves or looks.</li>
            <li><strong>Analytics cookies:</strong> We may use analytics cookies to track information how the Service is used so that we can make improvements.</li>
          </ul>
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-8">
          <p className="text-sm text-gray-500">
            For any more information regarding our cookie policy, please reach out to: <span className="text-orange-600 font-bold">support@sokoplus.com</span>
          </p>
        </section>
      </motion.div>
    </div>
  );
}
