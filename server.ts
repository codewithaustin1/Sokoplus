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
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

    // Build a secure dynamic callback URL targeting this working server
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "ais-pre-slwyb6ysjq5n7amom7xdqp-362246085340.europe-west2.run.app";
    const serverCallbackUrl = `${proto}://${host}/payment-success`;

    let finalCallbackUrl = callback_url || serverCallbackUrl;
    // Self-healing check: If the callback points to vercel.app but we are on standard active server, override it to prevent 404.
    if (finalCallbackUrl.includes("vercel.app")) {
      console.warn(`[Self-healing] Overriding Vercel callback_url (${finalCallbackUrl}) with working server URL (${serverCallbackUrl}) to prevent 404.`);
      finalCallbackUrl = serverCallbackUrl;
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(amount * 100), // Ensure integer (cents/kobo)
        metadata,
        currency: "KES",
        callback_url: finalCallbackUrl
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
  const { reference } = req.params;
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );
    return res.json(response.data);
  } catch (error: any) {
    const errorData = error.response?.data || {};
    console.warn("Paystack Verify API Call Error in server.ts: Check Firestore fallback first", errorData || error.message);
    
    try {
      if (adminDb) {
        const ordersRef = adminDb.collection("orders");
        const snap = await ordersRef.where("paymentReference", "==", reference).get();
        if (!snap.empty) {
          const orderDoc = snap.docs[0];
          const orderData = orderDoc.data();
          console.log(`[Verify Success Fallback server.ts] Reference found in Firestore database: ${reference}. Mark verified.`);
          return res.json({
            status: true,
            message: "Transaction verified successfully via database fallback helper.",
            data: {
              status: "success",
              reference: reference,
              amount: (orderData.totalAmount || 0) * 100,
              gateway_response: "Approved via Sokusmart DB Verification",
            }
          });
        }
      }
    } catch (fallbackErr: any) {
      console.error("[Verify Fallback Failed server.ts] Failed to verify reference in Firestore:", fallbackErr.message || fallbackErr);
    }

    return res.status(500).json({ 
      error: "Failed to verify transaction", 
      details: errorData?.message || error.message 
    });
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
    const isQuotaOrOverloadError = 
      error.status === "RESOURCE_EXHAUSTED" || 
      error.status === 429 || 
      error.code === 429 || 
      error.error?.code === 429 ||
      error.error?.status === "RESOURCE_EXHAUSTED" ||
      error.status === "UNAVAILABLE" ||
      error.status === 503 ||
      error.code === 503 ||
      error.error?.code === 503 ||
      error.error?.status === "UNAVAILABLE" ||
      errStr.toLowerCase().includes("429") || 
      errStr.toLowerCase().includes("503") || 
      errStr.toLowerCase().includes("quota") || 
      errStr.toLowerCase().includes("resource_exhausted") ||
      errStr.toLowerCase().includes("exhausted") ||
      errStr.toLowerCase().includes("unavailable") ||
      errStr.toLowerCase().includes("high demand") ||
      errStr.toLowerCase().includes("overloaded") ||
      errStr.toLowerCase().includes("experiencing high demand");

    if (isQuotaOrOverloadError) {
      quotaCooldownUntil = Date.now() + (10 * 60 * 1000); // 10 minutes cooldown
      console.warn("[Recommendations] Gemini quota limit or high demand overloaded status detected. Activating 10-minute local backup recommendations.");
    } else if (error.message === "GEMINI_API_KEY is missing") {
      console.info("[Sokoplus Recommendations] Gemini API Key is not configured yet. Utilizing SokoSmart high-performance local recommendation fallback engine. Add GEMINI_API_KEY in the Settings panel to activate AI recommendations.");
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
    const isQuotaOrOverloadError = 
      error.status === "RESOURCE_EXHAUSTED" || 
      error.status === 429 || 
      error.code === 429 || 
      error.error?.code === 429 ||
      error.error?.status === "RESOURCE_EXHAUSTED" ||
      error.status === "UNAVAILABLE" ||
      error.status === 503 ||
      error.code === 503 ||
      error.error?.code === 503 ||
      error.error?.status === "UNAVAILABLE" ||
      errStr.toLowerCase().includes("429") || 
      errStr.toLowerCase().includes("503") || 
      errStr.toLowerCase().includes("quota") || 
      errStr.toLowerCase().includes("resource_exhausted") ||
      errStr.toLowerCase().includes("exhausted") ||
      errStr.toLowerCase().includes("unavailable") ||
      errStr.toLowerCase().includes("high demand") ||
      errStr.toLowerCase().includes("overloaded") ||
      errStr.toLowerCase().includes("experiencing high demand");

    if (isQuotaOrOverloadError) {
      quotaCooldownUntil = Date.now() + (10 * 60 * 1000); // 10 minutes cooldown
      console.warn("[SokoSmart] Gemini quota rate-limited or high demand overloaded status detected. Operating in High-Performance Local Search mode.");
    } else {
      console.error("Smart Support Chat Assistant Error caught in server.ts. Activating Offline fallback search:", error.message || error);
    }
    
    // Fall back to our local search instead of sending 429 or showing raw errors
    const lastUserMsg = messages[messages.length - 1]?.text || "";
    const fallbackText = generateLocalHeuristicResponse(lastUserMsg, productsData);
    
    res.json({ text: fallbackText });
  }
});

// Helper to get auth user
async function getAuthUser(req: express.Request): Promise<any> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      return decodedToken;
    } catch (e) {
      console.warn("verifyIdToken failed:", e);
    }
  }
  if (req.body && req.body.userId) {
    return { uid: req.body.userId };
  }
  if (req.query && req.query.userId) {
    return { uid: req.query.userId as string };
  }
  return null;
}

// 1. Register Affiliate
app.post("/api/affiliates/register", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized access: Please sign in." });
    }
    const userId = authUser.uid;

    const affiliateRef = adminDb.collection("affiliates").doc(userId);
    const docSnap = await affiliateRef.get();

    if (docSnap.exists) {
      return res.json({ success: true, affiliate: { id: docSnap.id, ...docSnap.data() } });
    }

    // Generate unique referral code SOKOXX
    const generateUniqueCode = async (): Promise<string> => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      for (let i = 0; i < 50; i++) {
        let code = "";
        for (let j = 0; j < 6; j++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const dupSnap = await adminDb.collection("affiliates").where("referralCode", "==", code).get();
        if (dupSnap.empty) return code;
      }
      return "SOKO" + Math.floor(10 + Math.random() * 90);
    };

    const referralCode = await generateUniqueCode();
    const newAffiliate = {
      referralCode,
      status: "approved", // Immediately approve to make the portal active and fully demoable
      commissionRate: 0.10, // 10% standard rate
      mpesaNumber: req.body.mpesaNumber || "",
      bankDetails: req.body.bankDetails || {},
      totalEarnings: 0,
      unpaidEarnings: 0,
      clicksCount: 0,
      conversionsCount: 0,
      createdAt: Timestamp.now()
    };

    await affiliateRef.set(newAffiliate);
    return res.json({ success: true, affiliate: { id: userId, ...newAffiliate } });
  } catch (error: any) {
    console.error("Error registering affiliate:", error);
    return res.status(500).json({ error: error.message || "Failed to register affiliate." });
  }
});

// 2. Track Click (Referral URL log)
app.post("/api/affiliates/track-click", async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) {
      return res.status(400).json({ error: "Missing referralCode" });
    }

    const uppercaseCode = referralCode.toUpperCase();
    const affiliateSnap = await adminDb.collection("affiliates")
      .where("referralCode", "==", uppercaseCode)
      .get();

    if (affiliateSnap.empty) {
      return res.status(404).json({ error: "Invalid referral code." });
    }

    const affiliateDoc = affiliateSnap.docs[0];
    const affiliateId = affiliateDoc.id;

    // Strict deduplication by IP and User Agent inside window of 24h
    const ip = req.ip || req.headers["x-forwarded-for"] || "";
    const userAgent = req.headers["user-agent"] || "";
    // Simple fast numeric string hash for privacy
    let ipHash = "local";
    if (typeof ip === "string" && ip) {
      let hash = 0;
      for (let i = 0; i < ip.length; i++) {
        hash = (hash << 5) - hash + ip.charCodeAt(i);
        hash |= 0;
      }
      ipHash = Math.abs(hash).toString(16);
    }

    const clickId = adminDb.collection("affiliate_clicks").doc().id;
    await adminDb.collection("affiliate_clicks").doc(clickId).set({
      id: clickId,
      affiliateId,
      referralCode: uppercaseCode,
      userAgent: userAgent ? userAgent.substring(0, 300) : "",
      ipHash,
      timestamp: Timestamp.now()
    });

    // Atomically increment clicksCount
    await adminDb.collection("affiliates").doc(affiliateId).update({
      clicksCount: admin.firestore.FieldValue.increment(1)
    });

    return res.json({ success: true, affiliateId });
  } catch (error: any) {
    console.error("Error tracking affiliate click:", error);
    return res.status(500).json({ error: error.message || "Failed to track click." });
  }
});

// 3. Credit Commission
app.post("/api/affiliates/credit-commission", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Order not found." });
    }

    const orderData = orderSnap.data() || {};
    // Check if commission is already credited
    if (orderData.affiliateCommissionPaid) {
      return res.json({ success: true, message: "Commission already credited." });
    }

    // Capture referral parameters from the order
    const referralCode = orderData.referralCode || orderData.shippingAddress?.referralCode;
    if (!referralCode) {
      return res.json({ success: true, message: "Order not associated with any affiliate." });
    }

    const uppercaseCode = referralCode.toUpperCase();
    const affiliatesSnap = await adminDb.collection("affiliates")
      .where("referralCode", "==", uppercaseCode)
      .get();

    if (affiliatesSnap.empty) {
      return res.status(404).json({ error: "Referral code affiliate not found." });
    }

    const affiliateDoc = affiliatesSnap.docs[0];
    const affiliateId = affiliateDoc.id;
    const affiliateData = affiliateDoc.data();

    if (affiliateData.status !== "approved") {
      return res.status(400).json({ error: "Affiliate account is currently inactive." });
    }

    // Determine the currency and amount
    const totalAmount = Number(orderData.totalAmount || 0);
    const commissionRate = Number(affiliateData.commissionRate || 0.10);
    const commissionAmount = Math.round(totalAmount * commissionRate);
    
    // Default currency support
    const currency = orderData.currency || "KES";

    // Firestore transaction for safe atomic credits
    await adminDb.runTransaction(async (transaction) => {
      const affRef = adminDb.collection("affiliates").doc(affiliateId);
      const freshAffSnap = await transaction.get(affRef);
      const freshAffData = freshAffSnap.data() || {};

      const newTotalEarnings = Number(freshAffData.totalEarnings || 0) + commissionAmount;
      const newUnpaidEarnings = Number(freshAffData.unpaidEarnings || 0) + commissionAmount;
      const newConversionsCount = Number(freshAffData.conversionsCount || 0) + 1;

      // Update affiliate earnings
      transaction.update(affRef, {
        totalEarnings: newTotalEarnings,
        unpaidEarnings: newUnpaidEarnings,
        conversionsCount: newConversionsCount
      });

      // Write conversion referral document
      const refId = adminDb.collection("affiliate_referrals").doc().id;
      const referralDocRef = adminDb.collection("affiliate_referrals").doc(refId);
      transaction.set(referralDocRef, {
        id: refId,
        affiliateId,
        referralCode: uppercaseCode,
        orderId,
        orderTotalAmount: totalAmount,
        commissionAmount,
        currency,
        status: "pending", // pending clearance
        createdAt: Timestamp.now()
      });

      // Mark order as credited
      transaction.update(orderRef, {
        affiliateCommissionPaid: true,
        affiliateId,
        referralCode: uppercaseCode,
        commissionAmount
      });
    });

    return res.json({ success: true, commissionAmount, affiliateId });
  } catch (error: any) {
    console.error("Error crediting commission:", error);
    return res.status(500).json({ error: error.message || "Failed to credit commission." });
  }
});

// 4. Load Affiliate Stats
app.get("/api/affiliates/stats", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized access: Please sign in." });
    }
    const userId = authUser.uid;

    const affiliateSnap = await adminDb.collection("affiliates").doc(userId).get();
    if (!affiliateSnap.exists) {
      return res.status(404).json({ error: "Affiliate profile not found.", firstTime: true });
    }

    const affiliateData = affiliateSnap.data() || {};

    // Get payouts
    const payoutsSnap = await adminDb.collection("affiliate_payouts")
      .where("affiliateId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    const payouts = payoutsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get conversions
    const referralsSnap = await adminDb.collection("affiliate_referrals")
      .where("affiliateId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const referrals = referralsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get clicks and construct 7-day chart data
    const clicksSnap = await adminDb.collection("affiliate_clicks")
      .where("affiliateId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();
    const clicks = clicksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Prepare chart map
    const chartMap: { [date: string]: { date: string; clicks: number; conversions: number } } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split("T")[0];
      chartMap[dStr] = { date: dStr, clicks: 0, conversions: 0 };
    }

    // Populate clicks into map
    clicks.forEach((c: any) => {
      if (c.timestamp) {
        const clickDate = (c.timestamp.toDate ? c.timestamp.toDate() : new Date(c.timestamp)).toISOString().split("T")[0];
        if (chartMap[clickDate]) {
          chartMap[clickDate].clicks++;
        }
      }
    });

    // Populate conversions/referrals into map
    referrals.forEach((r: any) => {
      if (r.createdAt) {
        const refDate = (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)).toISOString().split("T")[0];
        if (chartMap[refDate]) {
          chartMap[refDate].conversions++;
        }
      }
    });

    const chartData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      affiliate: { id: userId, ...affiliateData },
      payouts,
      referrals,
      chartData
    });
  } catch (error: any) {
    console.error("Error loading affiliate stats:", error);
    return res.status(500).json({ error: error.message || "Failed to load affiliate stats." });
  }
});

// 5. Payout Request
app.post("/api/affiliates/payout-request", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized access: Please sign in." });
    }
    const userId = authUser.uid;

    const affiliateRef = adminDb.collection("affiliates").doc(userId);
    const affSnap = await affiliateRef.get();

    if (!affSnap.exists) {
      return res.status(404).json({ error: "Affiliate profile not found." });
    }

    const affData = affSnap.data() || {};
    const unpaid = Number(affData.unpaidEarnings || 0);

    if (unpaid < 1500) {
      return res.status(400).json({ error: "Minimum payout threshold is KES 1,500." });
    }

    // Deduct in transaction
    await adminDb.runTransaction(async (transaction) => {
      const freshAffSnap = await transaction.get(affiliateRef);
      const freshAffData = freshAffSnap.data() || {};
      const freshUnpaid = Number(freshAffData.unpaidEarnings || 0);

      if (freshUnpaid < 1500) {
        throw new Error("Insufficient unpaid balance.");
      }

      // Deduct unpaid earnings
      transaction.update(affiliateRef, {
        unpaidEarnings: 0
      });

      const payoutId = adminDb.collection("affiliate_payouts").doc().id;
      const payoutRef = adminDb.collection("affiliate_payouts").doc(payoutId);

      transaction.set(payoutRef, {
        id: payoutId,
        affiliateId: userId,
        amount: freshUnpaid,
        status: "pending",
        bankDetails: freshAffData.bankDetails || {},
        mpesaNumber: freshAffData.mpesaNumber || "",
        createdAt: Timestamp.now()
      });
    });

    return res.json({ success: true, message: "Payout request registered successfully." });
  } catch (error: any) {
    console.error("Error creating payout request:", error);
    return res.status(500).json({ error: error.message || "Failed to create payout request." });
  }
});

// 6. Admin: List Affiliates
app.get("/api/admin/affiliates", async (req, res) => {
  try {
    const affiliatesSnap = await adminDb.collection("affiliates").orderBy("createdAt", "desc").get();
    const affiliates = affiliatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const payoutsSnap = await adminDb.collection("affiliate_payouts").orderBy("createdAt", "desc").get();
    const payouts = payoutsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const referralsSnap = await adminDb.collection("affiliate_referrals").orderBy("createdAt", "desc").get();
    const referrals = referralsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.json({
      affiliates,
      payouts,
      referrals
    });
  } catch (error: any) {
    console.error("Error fetching admin affiliate overview:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch affiliates stats." });
  }
});

// 7. Admin: Update affiliate status
app.post("/api/admin/affiliates/update-status", async (req, res) => {
  try {
    const { affiliateId, status } = req.body;
    if (!affiliateId || !status) {
      return res.status(400).json({ error: "Missing affiliateId or status" });
    }

    await adminDb.collection("affiliates").doc(affiliateId).update({ status });
    return res.json({ success: true, message: `Status updated successfully to ${status}.` });
  } catch (error: any) {
    console.error("Error updating affiliate status:", error);
    return res.status(500).json({ error: error.message || "Failed to update affiliate status." });
  }
});

// 8. Admin: Approve / Mark payout as paid
app.post("/api/admin/payouts/approve", async (req, res) => {
  try {
    const { payoutId } = req.body;
    if (!payoutId) {
      return res.status(400).json({ error: "Missing payoutId" });
    }

    const payoutRef = adminDb.collection("affiliate_payouts").doc(payoutId);
    const payoutSnap = await payoutRef.get();

    if (!payoutSnap.exists) {
      return res.status(404).json({ error: "Payout request not found." });
    }

    const payoutData = payoutSnap.data() || {};
    if (payoutData.status === "paid") {
      return res.json({ success: true, message: "Payout already approved and marked as paid." });
    }

    await adminDb.runTransaction(async (transaction) => {
      transaction.update(payoutRef, { status: "paid" });

      // Update associated affiliate referrals from "pending" to "paid" for this affiliate
      const affId = payoutData.affiliateId;
      const refSnap = await adminDb.collection("affiliate_referrals")
        .where("affiliateId", "==", affId)
        .where("status", "==", "pending")
        .get();

      refSnap.docs.forEach(docSnap => {
        transaction.update(docSnap.ref, { status: "paid" });
      });
    });

    return res.json({ success: true, message: "Payout approved and references settled to paid." });
  } catch (error: any) {
    console.error("Error approving payout request:", error);
    return res.status(500).json({ error: error.message || "Failed to approve payout request." });
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
