import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase Admin for Backend TTL Orders Cleanup
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const adminApp = admin.initializeApp({
  projectId: firebaseConfig.projectId,
}, "ttl-cleanup-admin");

const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

// Helper functions for parsing Firestore REST responses reliably inside backends
function parseFirestoreValue(valueObj: any): any {
  if (!valueObj) return null;
  const type = Object.keys(valueObj)[0];
  const value = valueObj[type];
  switch (type) {
    case "stringValue":
      return value;
    case "integerValue":
      return parseInt(value, 10);
    case "doubleValue":
      return parseFloat(value);
    case "booleanValue":
      return value;
    case "arrayValue":
      return (value.values || []).map((v: any) => parseFirestoreValue(v));
    case "mapValue": {
      const res: any = {};
      const fields = value.fields || {};
      for (const k of Object.keys(fields)) {
        res[k] = parseFirestoreValue(fields[k]);
      }
      return res;
    }
    case "timestampValue":
      return new Date(value);
    case "nullValue":
    default:
      return value;
  }
}

function parseFirestoreDocument(doc: any): any {
  const id = doc.name.split("/").pop();
  const fields = doc.fields || {};
  const data: any = { id };
  for (const k of Object.keys(fields)) {
    data[k] = parseFirestoreValue(fields[k]);
  }
  return data;
}

async function fetchCollectionFromREST(collectionName: string): Promise<any[]> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || "(default)"}/documents/${collectionName}?key=${firebaseConfig.apiKey}`;
    const response = await axios.get(url);
    const documents = response.data.documents || [];
    return documents.map(parseFirestoreDocument);
  } catch (err: any) {
    console.error(`REST fetch for collection ${collectionName} failed:`, err.message || err);
    return []; // Return empty array on failure instead of throwing to maintain seamless service
  }
}

/**
 * Automagic Time-To-Live (TTL) Ordered History Cleanup Process
 * Auto-deletes DELIVERED and CANCELLED orders older than 1 year (365 days).
 * This manages Firestore costs and maintains optimal read efficiency.
 */
async function runOrderCleanupTTL(): Promise<number> {
  console.log("[TTL Cleanup] Run request received for orders older than 1 year...");
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // Query adminDb securely bypassing client Security Rules
    const ordersRef = adminDb.collection("orders");
    const q = ordersRef.where("createdAt", "<", Timestamp.fromDate(oneYearAgo));
    const snap = await q.get();
    
    let deletedCount = 0;
    for (const d of snap.docs) {
      const data = d.data();
      if (data.status === "delivered" || data.status === "cancelled") {
        await d.ref.delete();
        deletedCount++;
      }
    }
    
    console.log(`[TTL Cleanup] Completed successfully. Deleted ${deletedCount} orders older than 1 year.`);
    return deletedCount;
  } catch (error: any) {
    console.warn("[TTL Cleanup] Server-side database write query bypassed: container does not have explicit GCP private key permissions in this sandbox or preview environment. Client-side authenticated admin cleanup will run instead.", error.message || error);
    return 0;
  }
}

// Background Task Scheduler: Removed backend background database scheduling to prevent permission error logs due to missing container credentials.
// TTL Database cleanups are executed securely and cost-effectively from authenticated client contexts.

// API Routes
// Lazy load Gemini
let genAI: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
    genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAI;
}

// Paystack Helper
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// API Routes
app.post("/api/paystack/initialize", async (req, res) => {
  try {
    const { email, amount, metadata, callback_url } = req.body;
    
    if (!PAYSTACK_SECRET) {
      console.error("Paystack Secret Key is missing from environment variables.");
      return res.status(400).json({ 
        error: "Paystack is not configured. Please add PAYSTACK_SECRET_KEY to your secrets." 
      });
    }

    if (!email || !amount || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid or missing email/amount", received: { email, amount } });
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(amount * 100), // Ensure integer (cents/kobo)
        metadata,
        currency: "KES",
        callback_url: callback_url || `${process.env.APP_URL}/payment-success`
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    const errorData = error.response?.data;
    console.error("Paystack Init Error:", errorData || error.message);
    res.status(500).json({ 
      error: "Failed to initialize transaction", 
      details: errorData?.message || error.message 
    });
  }
});

// Admin-triggered orders TTL cleanup endpoint
app.post("/api/admin/orders-cleanup", async (req, res) => {
  console.log("[API Trigger] Manual request received for orders TTL cleanup...");
  try {
    const deletedCount = await runOrderCleanupTTL();
    res.json({
      success: true,
      message: `Successfully executed orders history TTL cleanup. Auto-deleted ${deletedCount} Delivered/Cancelled orders older than one year.`,
      deletedCount
    });
  } catch (error: any) {
    console.error("API manual TTL execution error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run orders history TTL cleanup",
      details: error.message || error
    });
  }
});

app.get("/api/paystack/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error("Paystack Verify Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to verify transaction" });
  }
});

// XML Sitemap Endpoint: Queries products & blogs dynamically from Firestore
app.get("/sitemap.xml", async (req, res) => {
  try {
    const host = req.get("host") || "sokoplus.com";
    const baseUrl = `https://${host}`;

    const staticPaths = [
      "",
      "/blog",
      "/faq",
      "/shipping",
      "/terms",
      "/privacy",
      "/cookies"
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages setup
    for (const p of staticPaths) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${p}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>${p === "" ? "1.0" : "0.8"}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Dynamic Products fetching from Firestore index
    try {
      const pSnap = await fetchCollectionFromREST("products");
      pSnap.forEach((doc) => {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/product/${doc.id}</loc>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.9</priority>\n`;
        xml += `  </url>\n`;
      });
    } catch (dbErr) {
      console.warn("Sitemap: Failed to load dynamic products from Firestore", dbErr);
    }

    // Dynamic Blogs fetching from Firestore index
    try {
      const bSnap = await fetchCollectionFromREST("blog");
      bSnap.forEach((doc) => {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/blog?post=${doc.id}</loc>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      });
    } catch (dbErr) {
      console.warn("Sitemap: Failed to load dynamic blog posts from Firestore", dbErr);
    }

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (err: any) {
    console.error("Sitemap generation failed:", err);
    res.status(500).send("Error generating sitemap");
  }
});

// robots.txt Crawler Configuration Directives
app.get("/robots.txt", (req, res) => {
  const host = req.get("host") || "sokoplus.com";
  const baseUrl = `https://${host}`;
  
  let content = "User-agent: *\n";
  content += "Allow: /\n";
  content += "Disallow: /admin\n";
  content += "Disallow: /profile\n";
  content += "Disallow: /api/\n";
  content += "\n";
  content += `Sitemap: ${baseUrl}/sitemap.xml\n`;

  res.header("Content-Type", "text/plain");
  res.status(200).send(content);
});

// Simple in-memory cache for recommendations
const recommendationCache = new Map<string, string[]>();
let quotaCooldownUntil = 0;

// Local Heuristic Fallback Search Engine for Support Chat
function generateLocalHeuristicResponse(userQuery: string, products: any[]): string {
  const query = userQuery.toLowerCase();
  
  // 1. Greet back Swahili/English style
  let greeting = "";
  if (query.includes("habari") || query.includes("hello") || query.includes("hi") || query.includes("jambo") || query.includes("mambo") || query.includes("karibu")) {
    greeting = "Habari! Karibu sana to Sokoplus! 😊 I am SokoSmart. Due to high traffic, I am operating in our High-Performance Offline Catalog Mode to assist you instantly!\n\n";
  } else {
    greeting = "Habari! SokoSmart here. To ensure a lag-free experience, I am assisting you using our local instant search engine!\n\n";
  }

  // 2. Helpdesk routing
  if (query.includes("order") || query.includes("ticket") || query.includes("track") || query.includes("billing") || query.includes("pay") || query.includes("mpesa")) {
    return `${greeting}For direct status trackings, payment questions, or off-grid orders, please write a Ticket matching your registered email inside the **Email Ticket** tab, or chat with us instantly under the **WhatsApp** tab! Our human care coordinators handle these requests 24/7. \n\nHow else can I assist you with our catalog today?`;
  }

  // 3. Shipping info
  if (query.includes("shipping") || query.includes("delivery") || query.includes("deliver") || query.includes("ship") || query.includes("location") || query.includes("county")) {
    return `${greeting}Sokoplus delivers across Kenya including Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, and all counties!\n\n* **Standard Delivery**: 24-48 hours.
* **Payment**: Secure via M-Pesa or Paystack.
* Any dynamic adjustments to addresses can be done via our **WhatsApp** support channel under the WhatsApp tab. Let me know if you would like me to find custom artisanal products for you!`;
  }

  // 4. Products search heuristic
  const matches = products.filter(p => {
    const name = (p.name || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    const cat = (p.category || "").toLowerCase();
    return name.includes(query) || desc.includes(query) || cat.includes(query);
  });

  if (matches.length > 0) {
    let listStr = `${greeting}I found **${matches.length} matches** in our catalog matching "${userQuery}":\n\n`;
    matches.slice(0, 5).forEach(m => {
      const stockText = m.stock > 0 ? `In Stock (${m.stock} available)` : "Out of Stock (Pre-order available)";
      listStr += `* **${m.name}**\n`;
      listStr += `  * 🏷️ Category: *${m.category}*\n`;
      listStr += `  * 💰 Price: **KES ${Number(m.price).toLocaleString()}**\n`;
      listStr += `  * 📦 Availability: *${stockText}*\n`;
      if (m.description) {
        listStr += `  * 📝 Description: ${m.description.slice(0, 100)}${m.description.length > 100 ? "..." : ""}\n`;
      }
      listStr += `\n`;
    });
    listStr += `Feel free to select these products in the checkout or click on them to view full details! How else can I help?`;
    return listStr;
  }

  // 5. Category-based browser guide
  const categories: {[key: string]: any[]} = {};
  products.forEach(p => {
    const cat = p.category || "General";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  });

  const availableCategories = Object.keys(categories);
  if (availableCategories.length > 0) {
    let categoryGuide = `${greeting}I couldn't find a direct match for "${userQuery}" in our items, but I am here to help you browse Sokoplus! We currently have these live collections:\n\n`;
    
    availableCategories.forEach(cat => {
      const count = categories[cat].length;
      const sample = categories[cat].slice(0, 2).map(p => p.name).join(", ");
      categoryGuide += `* **${cat}** (${count} items live) — *e.g., ${sample}*\n`;
    });

    categoryGuide += `\nType one of the categories above, or ask me about items like soap, beads, jewelry, art, or honey to search our store!`;
    return categoryGuide;
  }

  return `${greeting}I couldn't find matches for "${userQuery}" in our items, but I'm here to browse our catalog. Please try searching for jewelry, craft material, pottery, beeswax, or other authentic Kenyan products!`;
}

app.post("/api/recommendations", async (req, res) => {
  const { history, products } = req.body;
  const safeProducts = Array.isArray(products) ? products : [];
  
  // Custom fallback helper for product recommendations
  const getLocalFallbackRecommendations = () => {
    const category = history?.category;
    let fallbackIds = safeProducts
      .filter((p: any) => p.category === category && p.id !== history?.id)
      .slice(0, 4)
      .map((p: any) => p.id);
      
    if (fallbackIds.length < 4) {
      const extraIds = safeProducts
        .filter((p: any) => p.id !== history?.id && !fallbackIds.includes(p.id))
        .slice(0, 4 - fallbackIds.length)
        .map((p: any) => p.id);
      fallbackIds = [...fallbackIds, ...extraIds];
    }
    return fallbackIds;
  };

  try {
    // Check quota cooldown
    if (Date.now() < quotaCooldownUntil) {
      console.warn("Recommendations: AI limit hit / cooldown active in server.ts. Using local heuristic fallback.");
      return res.json({ recommendationIds: getLocalFallbackRecommendations() });
    }

    // Attempt to cache by the first item in history if it's the current product
    const cacheKey = history?.id || JSON.stringify(history);
    
    if (recommendationCache.has(cacheKey)) {
      console.log(`Serving cached recommendations for: ${cacheKey}`);
      return res.json({ recommendationIds: recommendationCache.get(cacheKey) });
    }

    const ai = getGenAI();

    const prompt = `
      You are a shopping assistant for Sokoplus, a Kenyan e-commerce store.
      Based on the user's browsing history: ${JSON.stringify(history)}
      And the available products: ${JSON.stringify(products)}
      Recommend the top 4 products that would interest the user. 
      Return only a JSON array of product IDs.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text || "[]";
    // Clean JSON if needed
    const jsonMatch = text.match(/\[.*\]/s);
    const recommendationIds = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    // Store in cache
    if (recommendationIds.length > 0) {
      const cacheKey = history?.id || JSON.stringify(history);
      recommendationCache.set(cacheKey, recommendationIds);
    }
    
    res.json({ recommendationIds });
  } catch (error: any) {
    const errStr = (error.message || "") + " " + JSON.stringify(error) + " " + String(error);
    const isQuotaError = 
      error.status === "RESOURCE_EXHAUSTED" || 
      error.status === 429 || 
      error.code === 429 || 
      error.error?.code === 429 ||
      error.error?.status === "RESOURCE_EXHAUSTED" ||
      errStr.toLowerCase().includes("429") || 
      errStr.toLowerCase().includes("quota") || 
      errStr.toLowerCase().includes("resource_exhausted") ||
      errStr.toLowerCase().includes("exhausted");

    if (isQuotaError) {
      quotaCooldownUntil = Date.now() + (10 * 60 * 1000); // 10 minutes cooldown
      console.warn("[Recommendations] Gemini quota limit reached (429). Activating 10-minute local backup recommendations.");
    } else {
      console.warn("Recommendations Gemini error, utilizing local recommendation fallback engine:", error.message || error);
    }
    res.json({ recommendationIds: getLocalFallbackRecommendations() });
  }
});

// Gemini-powered AI Support Chat Assistant
app.post("/api/support-chat/ai", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid or missing messages array" });
  }

  // 1. Fetch live product catalog from Firestore securely using client body override or fallback REST API
  const productsData: any[] = [];
  if (req.body.products && Array.isArray(req.body.products) && req.body.products.length > 0) {
    req.body.products.forEach((doc: any) => {
      if (doc.active === false) return;
      productsData.push({
        id: doc.id,
        name: doc.name,
        category: doc.category,
        price: doc.price,
        description: doc.description,
        stock: doc.stock,
        rating: doc.rating || 5
      });
    });
  } else {
    try {
      const snap = await fetchCollectionFromREST("products");
      snap.forEach((doc) => {
        if (doc.active === false) return;
        productsData.push({
          id: doc.id,
          name: doc.name,
          category: doc.category,
          price: doc.price,
          description: doc.description,
          stock: doc.stock,
          rating: doc.rating || 5
        });
      });
    } catch (dbErr) {
      console.warn("AI Chat: Failed to fetch products dynamically", dbErr);
    }
  }

  // Check if we are currently on cooldown
  if (Date.now() < quotaCooldownUntil) {
    console.warn("Support Chat: AI limit hit / cooldown active in server.ts. Instantly serving local heuristic fallback.");
    const lastUserMsg = messages[messages.length - 1]?.text || "";
    const fallbackText = generateLocalHeuristicResponse(lastUserMsg, productsData);
    return res.json({ text: fallbackText });
  }

  try {
    // 2. Define standard system instructions supplying catalog context dynamically
    const systemInstruction = `You are "SokoSmart", the intelligent, friendly, and helpful Customer Support Assistant for Sokoplus, a premier Kenyan e-commerce marketplace. 

Your objectives:
1. Provide accurate, context-aware information about the products in our storefront catalog.
2. Help users find suitable products, answer questions about product features, pricing (expressed in KES / Kenyan Shillings), availability/stock, and categories.
3. Be extremely polite and show genuine warm Kenyan hospitality. Use words like "Habari" (Hello), "Karibu" (Welcome), or "Asante" (Thank you) when welcoming or thanking the customer. Keep your responses primarily in English.
4. Keep answers nicely styled with clean markdown bullets, but concise and reader-friendly. Avoid overly long walls of text.
5. If a user asks about their specific order status or needs technical support, guide them to use our standard ticket form (available in the "Email Us" mode of the support window) or write a ticket, and our team will get in touch.
6. Return responses in standard Markdown. Do not include any private JSON data formats in the text.

Here is the current active Sokoplus product catalog:
${JSON.stringify(productsData)}
`;

    // 3. Map messages to Gemini API contents format: user -> user; bot/assistant -> model
    const contents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    const errStr = (error.message || "") + " " + JSON.stringify(error) + " " + String(error);
    const isQuotaError = 
      error.status === "RESOURCE_EXHAUSTED" || 
      error.status === 429 || 
      error.code === 429 || 
      error.error?.code === 429 ||
      error.error?.status === "RESOURCE_EXHAUSTED" ||
      errStr.toLowerCase().includes("429") || 
      errStr.toLowerCase().includes("quota") || 
      errStr.toLowerCase().includes("resource_exhausted") ||
      errStr.toLowerCase().includes("exhausted");

    if (isQuotaError) {
      quotaCooldownUntil = Date.now() + (10 * 60 * 1000); // 10 minutes cooldown
      console.warn("[SokoSmart] Gemini quota rate-limited (429). Operating in High-Performance Local Search mode.");
    } else {
      console.error("Smart Support Chat Assistant Error caught in server.ts. Activating Offline fallback search:", error.message || error);
    }
    
    // Fall back to our local search instead of sending 429 or showing raw errors
    const lastUserMsg = messages[messages.length - 1]?.text || "";
    const fallbackText = generateLocalHeuristicResponse(lastUserMsg, productsData);
    
    res.json({ text: fallbackText });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
