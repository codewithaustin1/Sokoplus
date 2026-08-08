/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from "jspdf";
import { Order, UserProfile } from "../types";
import QRCode from "qrcode";

export async function downloadReceipt(order: Order, user: UserProfile) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2); // 170mm

  // Colors
  const orangeColor = { r: 234, g: 88, b: 12 }; // SokoPlus Core Orange (#EA580C)
  const charcoalColor = { r: 24, g: 24, b: 27 }; // Deep Charcoal (#18181B)
  const mutedColor = { r: 113, g: 113, b: 122 }; // Zinc Muted (#71717A)
  const lightBgColor = { r: 244, g: 244, b: 245 }; // Zinc Light (#F4F4F5)
  const borderColor = { r: 228, g: 228, b: 231 }; // Border (#E4E4E7)

  // Helpers
  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;
  
  const formatDate = (dateVal: any) => {
    if (!dateVal) return "Recent";
    // If Firebase Timestamp
    if (dateVal.toDate) {
      return dateVal.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
    // If standard Date
    if (dateVal instanceof Date) {
      return dateVal.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
    // If string/number
    return new Date(dateVal).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  // Generate tracking QR code
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.sokoplus.co.ke";
  const trackingUrl = `${origin}/track-order/${order.id}`;
  let qrCodeDataUrl = "";
  try {
    qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
      margin: 1,
      width: 150,
      color: {
        dark: "#ea580c", // Brand orange matching SokoPlus theme
        light: "#ffffff",
      }
    });
  } catch (err) {
    console.error("Failed to generate QR Code for receipt PDF", err);
  }

  let currentY = 20;

  // 1. Draw Custom Header Logo
  // Small orange box (10x10) for brand visual
  doc.setFillColor(orangeColor.r, orangeColor.g, orangeColor.b);
  doc.roundedRect(margin, currentY, 10, 10, 2, 2, "F");
  
  // "S" text in logo box
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("S", margin + 3.8, currentY + 6.8);

  // Brand Name
  doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Sokoplus", margin + 12, currentY + 6);

  // Brand Sub-label
  doc.setTextColor(orangeColor.r, orangeColor.g, orangeColor.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("MARKETPLACE", margin + 12, currentY + 9);

  // Title on Right
  doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("OFFICIAL RECEIPT", pageWidth - margin, currentY + 6, { align: "right" });

  // Receipt meta details below Title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text(`Receipt ID: #${order.id.slice(0, 8).toUpperCase()}`, pageWidth - margin, currentY + 11, { align: "right" });

  // Divider
  currentY += 18;
  doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // 2. Metadata: Dates, Invoice Statuses, and Payment Details
  doc.setFillColor(lightBgColor.r, lightBgColor.g, lightBgColor.b);
  doc.roundedRect(margin, currentY, contentWidth, 20, 3, 3, "F");

  doc.setFontSize(8);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  
  // Columns
  doc.text("DATE ISSUED", margin + 8, currentY + 6);
  doc.text("PAYMENT STATUS", margin + 54, currentY + 6);
  doc.text("DELIVERY STATUS", margin + 100, currentY + 6);
  doc.text("PAYMENT METHOD", margin + 140, currentY + 6);

  doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(formatDate(order.createdAt), margin + 8, currentY + 13);
  
  // Set badge-like color for Paid Status
  if (order.paymentStatus === "paid") {
    doc.setTextColor(22, 101, 52); // green status
  } else {
    doc.setTextColor(194, 65, 12); // yellow/orange status
  }
  doc.text(order.paymentStatus.toUpperCase(), margin + 54, currentY + 13);

  // Delivery status
  if (order.status === "delivered") {
    doc.setTextColor(22, 101, 52);
  } else if (order.status === "cancelled") {
    doc.setTextColor(185, 28, 28);
  } else {
    doc.setTextColor(194, 65, 12);
  }
  doc.text(order.status.toUpperCase(), margin + 100, currentY + 13);

  doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
  doc.text("SokoPay Gateway", margin + 140, currentY + 13);

  currentY += 28;

  // 3. Billing & Shipping Address Split Info Column
  // Let's safe-read the shippingAddress fields
  const addr = (order as any).shippingAddress || {};
  const customerName = user.displayName || "Valued Customer";
  const customerPhone = addr.phone || user.phoneNumber || "No contact phone";
  const customerEmail = addr.email || order.userEmail || user.email || "No contact email";

  const hasShipping = !!addr.county;

  // Column 1: Customer Details
  doc.setFontSize(9);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.setFont("helvetica", "bold");
  doc.text("BILLED TO:", margin, currentY);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
  doc.setFontSize(10);
  doc.text(customerName, margin, currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text(`Email: ${customerEmail}`, margin, currentY + 11);
  doc.text(`Phone: ${customerPhone}`, margin, currentY + 16);

  // Column 2: Shipping / Delivery Details
  if (hasShipping) {
    doc.setFontSize(9);
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.setFont("helvetica", "bold");
    doc.text("SHIPPED TO:", margin + 85, currentY);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
    doc.setFontSize(10);
    doc.text(`${addr.county}`, margin + 85, currentY + 6);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.text(`City/Town: ${addr.city}`, margin + 85, currentY + 11);
    if (addr.street) {
      doc.text(`Street details: ${addr.street}`, margin + 85, currentY + 16);
    }
  } else {
    // Default fallback (e.g., if local pick-up or vintage format)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.setFont("helvetica", "bold");
    doc.text("SHIPPED TO:", margin + 85, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
    doc.setFontSize(10);
    doc.text("Nairobi, Kenya (Standard Delivery)", margin + 85, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.text("Delivery status compiled matching checkout County profiles.", margin + 85, currentY + 11);
  }

  currentY += 28;

  // 4. Products Table Headers
  doc.setFillColor(orangeColor.r, orangeColor.g, orangeColor.b);
  doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("ITEMS IN COMPLETED TRANSACTION", margin + 4, currentY + 5.5);
  doc.text("PRICE", margin + 110, currentY + 5.5, { align: "right" });
  doc.text("QTY", margin + 135, currentY + 5.5, { align: "center" });
  doc.text("TOTAL", pageWidth - margin - 4, currentY + 5.5, { align: "right" });

  currentY += 8;

  // Table rows iterator
  const itemHeight = 12;
  let itemsSubtotal = 0;

  order.items.forEach((item, index) => {
    // Check if drawing goes over the typical footer position (starts around 230Y)
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
      
      // Draw sub-headers on new page
      doc.setFillColor(orangeColor.r, orangeColor.g, orangeColor.b);
      doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, "F");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("ITEMS IN COMPLETED TRANSACTION (CONTINUED)", margin + 4, currentY + 5.5);
      doc.text("PRICE", margin + 110, currentY + 5.5, { align: "right" });
      doc.text("QTY", margin + 135, currentY + 5.5, { align: "center" });
      doc.text("TOTAL", pageWidth - margin - 4, currentY + 5.5, { align: "right" });
      
      currentY += 8;
    }

    const rowTotal = item.price * item.quantity;
    itemsSubtotal += rowTotal;

    // Row zebra background
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, currentY, contentWidth, itemHeight, "F");
    }

    // Fine divider line underneath
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + itemHeight, pageWidth - margin, currentY + itemHeight);

    // Render Text content
    doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    // Draw product name (with slice to protect overflowing text bounds)
    const displayName = item.name.length > 45 ? `${item.name.slice(0, 42)}...` : item.name;
    doc.text(displayName, margin + 4, currentY + 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(formatCurrency(item.price), margin + 110, currentY + 7.5, { align: "right" });
    doc.text(String(item.quantity), margin + 135, currentY + 7.5, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(rowTotal), pageWidth - margin - 4, currentY + 7.5, { align: "right" });

    currentY += itemHeight;
  });

  // 5. Total Summaries Breakdown Card (Aligned Bottom Right)
  currentY += 6;

  // Let's derive shippingFee from overall totalAmount minus item sums
  const derivedShipping = Math.max(0, order.totalAmount - itemsSubtotal);

  // Box on right side for totals summary
  const totalBoxWidth = 80;
  const totalBoxX = pageWidth - margin - totalBoxWidth;
  
  doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
  doc.setLineWidth(0.3);
  doc.rect(totalBoxX, currentY, totalBoxWidth, 28);

  doc.setFontSize(8.5);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.setFont("helvetica", "normal");
  
  doc.text("Subtotal:", totalBoxX + 4, currentY + 6.5);
  doc.text("Shipping Fee:", totalBoxX + 4, currentY + 12.5);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(orangeColor.r, orangeColor.g, orangeColor.b);
  doc.text("Amount Paid:", totalBoxX + 4, currentY + 21);

  // Amounts
  doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(formatCurrency(itemsSubtotal), pageWidth - margin - 4, currentY + 6.5, { align: "right" });
  
  if (derivedShipping === 0) {
    doc.setTextColor(22, 101, 52); // green free label
    doc.text("FREE", pageWidth - margin - 4, currentY + 12.5, { align: "right" });
  } else {
    doc.text(formatCurrency(derivedShipping), pageWidth - margin - 4, currentY + 12.5, { align: "right" });
  }

  doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
  doc.setFontSize(11);
  doc.text(formatCurrency(order.totalAmount), pageWidth - margin - 4, currentY + 21, { align: "right" });

  // 16% VAT subtle statement
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text("Prices are inclusive of 16% VAT.", pageWidth - margin - 4, currentY + 31, { align: "right" });

  currentY += 40;

  // Render Official Seal / Safe Stamps decoration at bottom (if space permits)
  if (currentY < pageHeight - 50) {
    const bannerTop = pageHeight - 48;
    
    // Grey bottom footer accent bar
    doc.setFillColor(lightBgColor.r, lightBgColor.g, lightBgColor.b);
    doc.roundedRect(margin, bannerTop, contentWidth, 24, 4, 4, "F");
    
    // Support Details Left
    doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("NEED LOGISTICS SUPPORT OR HELP?", margin + 8, bannerTop + 8);
    
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Reach our customer support instantly via live email hello@sokoplus.co.ke or start a Support Ticket directly inside our chat portal.", margin + 8, bannerTop + 14);

    // QR Code / Seal Right (Sokoplus Secure Check)
    if (qrCodeDataUrl) {
      // Draw white background card for QR Code
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - margin - 22, bannerTop + 3, 18, 18, 1.5, 1.5, "F");
      doc.addImage(qrCodeDataUrl, "PNG", pageWidth - margin - 21, bannerTop + 4, 16, 16);
      
      // Label text next to QR Code
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(charcoalColor.r, charcoalColor.g, charcoalColor.b);
      doc.text("SCAN TO TRACK", pageWidth - margin - 25, bannerTop + 10, { align: "right" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      doc.text("Instant Live Delivery", pageWidth - margin - 25, bannerTop + 14, { align: "right" });
    } else {
      doc.setDrawColor(orangeColor.r, orangeColor.g, orangeColor.b, 30);
      doc.setLineWidth(0.4);
      const stampX = pageWidth - margin - 15;
      const stampY = bannerTop + 12;
      doc.circle(stampX, stampY, 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(orangeColor.r, orangeColor.g, orangeColor.b);
      doc.text("SAFE", stampX, stampY - 1, { align: "center" });
      doc.text("ORDER", stampX, stampY + 2, { align: "center" });
    }
  }

  // Footer text
  doc.setFont("helvetica", "oblique");
  doc.setFontSize(7.5);
  doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  doc.text("This is a digitally generated copy of the completed transaction receipt. Certified secure by Sokoplus Kenya.", pageWidth / 2, pageHeight - 12, { align: "center" });

  // Out save
  doc.save(`Sokoplus-Receipt-${order.id.slice(0, 8).toUpperCase()}.pdf`);
}
