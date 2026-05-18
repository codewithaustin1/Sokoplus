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

// Lazy load Gemini
let genAI: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
    genAI = new GoogleGenAI(apiKey);
  }
  return genAI;
}

// Paystack Helper
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// API Routes
app.post("/api/paystack/initialize", async (req, res) => {
  try {
    const { email, amount, metadata, callback_url } = req.body;
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100, // Paystack expects kobo/cents
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
    console.error("Paystack Init Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initialize transaction" });
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

app.post("/api/recommendations", async (req, res) => {
  try {
    const { history, products } = req.body;
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are a shopping assistant for Sokoplus, a Kenyan e-commerce store.
      Based on the user's browsing history: ${JSON.stringify(history)}
      And the available products: ${JSON.stringify(products)}
      Recommend the top 4 products that would interest the user. 
      Return only a JSON array of product IDs.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Clean JSON if needed
    const jsonMatch = text.match(/\[.*\]/s);
    const recommendationIds = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    res.json({ recommendationIds });
  } catch (error) {
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
