import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

// Helper functions for parsing Firestore REST responses reliably inside scripts
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

async function fetchCollection(
  projectId: string,
  databaseId: string,
  apiKey: string,
  collectionName: string,
  adminDb: admin.firestore.Firestore | null
): Promise<any[]> {
  // 1. Prefer fetching using Firebase Admin SDK (secure and reliable)
  if (adminDb) {
    try {
      console.log(`[Sitemap Script] Fetching collection "${collectionName}" via Firebase Admin SDK...`);
      const snapshot = await adminDb.collection(collectionName).get();
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        // Convert Firestore Timestamps to native Dates if any
        for (const key of Object.keys(data)) {
          if (data[key] && typeof data[key].toDate === "function") {
            data[key] = data[key].toDate();
          }
        }
        return { id: doc.id, ...data };
      });
      console.log(`[Sitemap Script] Successfully loaded ${docs.length} documents from "${collectionName}" via Admin SDK.`);
      return docs;
    } catch (adminErr: any) {
      console.warn(`[Sitemap Script] Admin SDK fetch for "${collectionName}" failed, falling back to REST API:`, adminErr.message || adminErr);
    }
  }

  // 2. Fallback to Firestore REST API
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}?key=${apiKey}`;
    console.log(`[Sitemap Script] Fetching collection via REST API: "${collectionName}"...`);
    const response = await axios.get(url);
    const documents = response.data.documents || [];
    return documents.map(parseFirestoreDocument);
  } catch (err: any) {
    console.warn(`[Sitemap Script] Warning: Rest API fetch for "${collectionName}" failed:`, err.message || err);
    return [];
  }
}

async function run() {
  console.log("[Sitemap Script] Dynamic sitemap.xml generator starting...");

  try {
    // 1. Locate config files
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at: ${configPath}`);
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    const apiKey = firebaseConfig.apiKey;

    if (!projectId || !apiKey) {
      throw new Error("Invalid Firebase applet configuration: missing projectId or apiKey.");
    }

    // Initialize Firebase Admin for Sitemap Generation (using SDK directly whenever possible)
    let adminDb: admin.firestore.Firestore | null = null;
    try {
      if (admin.apps.length === 0) {
        const adminApp = admin.initializeApp({
          projectId: projectId,
        }, "sitemap-admin");
        adminDb = getFirestore(adminApp, databaseId);
      } else {
        const existingApp = admin.apps.find(app => app?.name === "sitemap-admin") || admin.app();
        adminDb = getFirestore(existingApp, databaseId);
      }
      console.log("[Sitemap Script] Firebase Admin SDK initialized successfully.");
    } catch (adminInitErr: any) {
      console.warn("[Sitemap Script] Failed to initialize Firebase Admin SDK, continuing with REST fallback:", adminInitErr.message);
    }

    // 2. Setup standard metadata
    const baseUrl = "https://sokoplus.com"; // Default canonical domain for SEO index optimization
    const staticPaths = [
      "",
      "/blog",
      "/careers",
      "/faq",
      "/shipping",
      "/returns",
      "/terms",
      "/privacy",
      "/cookies"
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Write static routes with lower priorities for static pages, higher for core indexes
    for (const p of staticPaths) {
      let changefreq = "monthly";
      let priority = "0.5";

      if (p === "") {
        changefreq = "daily";
        priority = "1.0"; // Pure landing & showcase page
      } else if (p === "/blog") {
        changefreq = "weekly";
        priority = "0.7";
      } else if (p === "/careers") {
        changefreq = "weekly";
        priority = "0.6";
      }

      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${p}</loc>\n`;
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // 3. Fetch products from Firestore REST securely
    const products = await fetchCollection(projectId, databaseId, apiKey, "products", adminDb);
    const activeProducts = products.filter(p => p.active !== false);
    console.log(`[Sitemap Script] Loaded ${activeProducts.length} active products.`);

    // Active product routes get high priority (0.9) to drive organic indexing
    activeProducts.forEach((p) => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/product/${p.id}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    });

    // 4. Generate pagination paths for the products collection (e.g. 9 products per page)
    const PRODUCTS_PER_PAGE = 9;
    const totalPages = Math.ceil(activeProducts.length / PRODUCTS_PER_PAGE) || 1;
    console.log(`[Sitemap Script] Computing pagination paths. Total Active Products: ${activeProducts.length}. Total Pages: ${totalPages}`);
    for (let page = 1; page <= totalPages; page++) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/?page=${page}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // 5. Fetch blogs from Firestore REST securely
    const blogPosts = await fetchCollection(projectId, databaseId, apiKey, "blog", adminDb);
    console.log(`[Sitemap Script] Loaded ${blogPosts.length} blog posts.`);

    blogPosts.forEach((b) => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/blog?post=${b.id}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    // 5. Ensure target paths exist and write file
    const publicDir = path.resolve(process.cwd(), "public");
    if (!fs.existsSync(publicDir)) {
      console.log(`[Sitemap Script] Creating missing public directory...`);
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const publicSitemapPath = path.join(publicDir, "sitemap.xml");
    fs.writeFileSync(publicSitemapPath, xml, "utf-8");
    console.log(`[Sitemap Script] Successfully exported static fallback to public folder: ${publicSitemapPath}`);

    // If a build folder is present (e.g. built using vite), copy it or write directly to dist too to avoid rebuild synchronization issues
    const distDir = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distDir)) {
      const distSitemapPath = path.join(distDir, "sitemap.xml");
      fs.writeFileSync(distSitemapPath, xml, "utf-8");
      console.log(`[Sitemap Script] Successfully mirrored live sitemap output directly to built dist folder: ${distSitemapPath}`);
    }

    console.log("[Sitemap Script] Completed sitemap maintenance successfully!");
  } catch (error: any) {
    console.error("[Sitemap Script] Uncaught fatal error during generator execution:", error.message || error);
    process.exit(1);
  }
}

run();
