import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy load Mailer
let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!transporter) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn("SMTP configuration is incomplete. Email notifications may fail.");
      return null;
    }
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_PORT === "465",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

// API Routes
app.post("/api/orders/notify-status", async (req, res) => {
  try {
    const { orderId, email, status, customerName } = req.body;
    
    if (!email || !status || !orderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const mailer = getTransporter();
    if (!mailer) {
      return res.status(500).json({ error: "Mail server not configured" });
    }

    const statusConfig: Record<string, { subject: string; message: string }> = {
      pending: {
        subject: `Order #${orderId.slice(0, 8)} - Received`,
        message: "Your order has been received and is pending confirmation."
      },
      processing: {
        subject: `Order #${orderId.slice(0, 8)} - We're processing it!`,
        message: "Great news! We've started processing your order."
      },
      shipped: {
        subject: `Order #${orderId.slice(0, 8)} - On its way!`,
        message: "Your order has been shipped and is heading your way."
      },
      delivered: {
        subject: `Order #${orderId.slice(0, 8)} - Delivered`,
        message: "Your order has been delivered. Enjoy your purchase!"
      },
      cancelled: {
        subject: `Order #${orderId.slice(0, 8)} - Cancelled`,
        message: "Your order has been cancelled. If you have questions, please contact support."
      }
    };

    const config = statusConfig[status] || {
      subject: `Order #${orderId.slice(0, 8)} Update`,
      message: `Your order status has been updated to ${status}.`
    };

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Sokoplus Kenya" <noreply@example.com>',
      to: email,
      subject: config.subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #ea580c;">Hi ${customerName || 'Customer'},</h2>
          <p style="font-size: 16px; line-height: 1.5;">${config.message}</p>
          <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 12px;">
            <p><strong>Order ID:</strong> #${orderId}</p>
            <p><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: bold;">${status}</span></p>
          </div>
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            Thank you for shopping with Sokoplus Kenya!
          </p>
        </div>
      `,
    };

    await mailer.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Email Error:", error);
    res.status(500).json({ error: "Failed to send email notification", details: error.message });
  }
});

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

app.post("/api/recommendations", async (req, res) => {
  try {
    const { history, products } = req.body;
    
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
    console.error("Gemini Error:", error);
    
    // Check for quota exceeded error
    if (error.status === "RESOURCE_EXHAUSTED" || error.code === 429 || (error.message && error.message.includes("quota"))) {
      return res.status(429).json({ 
        error: "AI limit reached", 
        message: "The AI recommendation engine is currently busy due to high demand. Please try again in a few minutes.",
        type: "QUOTA_EXCEEDED"
      });
    }

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
