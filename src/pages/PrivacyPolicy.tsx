import React from "react";
import SEO from "../components/SEO";
import { motion } from "motion/react";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <SEO title="Privacy Policy" description="Privacy Policy for Sokoplus Kenya" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-16 border border-gray-100 shadow-sm space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Last Updated: May 18, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">1. Introduction</h2>
          <p className="text-gray-600 leading-relaxed">
            Welcome to Sokoplus ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">2. Data We Collect</h2>
          <p className="text-gray-600 leading-relaxed">
            We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
            <li><strong>Contact Data:</strong> includes billing address, delivery address, email address and telephone numbers.</li>
            <li><strong>Financial Data:</strong> includes payment card details.</li>
            <li><strong>Transaction Data:</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
            <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">3. How We Use Your Data</h2>
          <p className="text-gray-600 leading-relaxed">
            We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600">
            <li>To register you as a new customer.</li>
            <li>To process and deliver your order.</li>
            <li>To manage our relationship with you.</li>
            <li>To enable you to partake in a prize draw, competition or complete a survey.</li>
            <li>To improve our website, products/services, marketing or customer relationships.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">4. Data Security</h2>
          <p className="text-gray-600 leading-relaxed">
            We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
          </p>
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-8">
          <p className="text-sm text-gray-500">
            If you have any questions about this privacy policy or our privacy practices, please contact us at: <span className="text-orange-600 font-bold">privacy@sokoplus.co.ke</span>
          </p>
        </section>
      </motion.div>
    </div>
  );
}
