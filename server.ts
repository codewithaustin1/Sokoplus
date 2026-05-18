import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

// Simple in-memory cache for recommendations
const recommendationCache = new Map<string, string[]>();
let quotaCooldownUntil = 0;

app.post("/api/recommendations", async (req, res) => {
  try {
    const { history, products } = req.body;
    
    // Check quota cooldown
    if (Date.now() < quotaCooldownUntil) {
      return res.status(429).json({ 
        error: "Quota reached", 
        message: "AI is on cooldown",
        type: "QUOTA_EXCEEDED"
      });
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
      model: "gemini-3-flash-preview",
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
    // Check for quota exceeded error
    if (error.status === "RESOURCE_EXHAUSTED" || error.code === 429 || (error.message && error.message.includes("quota"))) {
      console.warn("Gemini Quota Exceeded. Entering 5-minute cooldown.");
      quotaCooldownUntil = Date.now() + (5 * 60 * 1000); // 5 minutes cooldown
      
      return res.status(429).json({ 
        error: "AI limit reached", 
        message: "The AI recommendation engine is currently busy due to high demand. Please try again in a few minutes.",
        type: "QUOTA_EXCEEDED"
      });
    }

    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
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
