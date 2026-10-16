# Sokoplus 🇰🇪 🛍️

> **Premier Kenyan E-Commerce Marketplace & Multi-Vendor Platform**  
> Built with React 19, TypeScript, Vite, Tailwind CSS v4, Node.js/Express, Firebase Firestore, Google Gemini AI, and Paystack.

---

[![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_%26_Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Paystack](https://img.shields.io/badge/Paystack-Payments_%26_M--Pesa-00C3F7?style=flat-square&logo=paystack&logoColor=white)](https://paystack.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable_%26_Offline-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

---

## 📖 Overview

**Sokoplus** is a full-featured, mobile-first e-commerce marketplace engineered specifically for the East African retail ecosystem. It blends modern consumer shopping features (instant search, product comparison, digital asset vaults, and interactive delivery maps) with deep enterprise tools (multi-vendor Seller Studio, SuperAdmin console, dynamic Pay on Delivery risk engine, automated web scraper, and AI-powered recommendations).

The platform is designed to operate seamlessly across high-speed connections and bandwidth-constrained environments alike, featuring full Progressive Web App (PWA) support, client-side caching, and background sync queues.

---

## ✨ Key Features

### 🛒 Shopper Experience
* **Dynamic Catalog & Spotlight Search**: Instant keyboard-driven search (`Ctrl+K` / `Cmd+K`) with live filtering across Kenyan regions, artisan categories, and pricing tiers.
* **Product Attribute Configurator**: Support for complex product variants (colors, sizes, materials, artisan finishes).
* **Side-by-Side Product Comparison**: Floating comparison drawer to evaluate specs, warranty, and pricing across multiple items.
* **Wishlist & Social Sharing**: Personalized wishlists with shareable public links (`/wishlist/shared/:id`).
* **Digital Asset Vault**: Secure instant delivery and storage for downloadable products (e-books, art, digital certificates).
* **Promotional Mystery Box & Countdown**: Interactive gamified daily drops and same-day delivery order cutoff timers.
* **Artisan Media & Audio Showcase**: Integrated audio previews for cultural and musical merchandise.

### 💳 Payments & Checkout
* **Paystack Payment Gateway**: Direct support for M-Pesa, card payments, and mobile money in Kenyan Shillings (KES).
* **Vendor Split Payments**: Automatic disbursement to merchant subaccounts using Paystack Subaccounts.
* **Pay on Delivery (POD) Engine**: Server-calculated risk assessment and mandatory deposit requirements based on location, order value, and customer tier.
* **Instant Digital Invoicing**: Client-side branded PDF invoice generator with dynamic QR order tokens (`jsPDF` + `qrcode`).

### 🚚 Delivery & Geolocation
* **Interactive Free Delivery Map**: Leaflet-powered visual zone mapping highlighting free shipping boundaries across Nairobi, Mombasa, Kisumu, and greater Kenya.
* **OpenStreetMap Nominatim Proxy**: High-resilience Kenyan location search and reverse geocoding with backend in-memory caching and failover defaults.
* **Live Order Tracking & QR Scanner**: Real-time status milestones with embedded QR scanner modal for verification upon delivery.

### 🤖 Gemini AI Integration
* **Smart Product Recommendations**: Google Gemini-driven cross-selling and tailored discovery based on user browsing history and cart items.
* **24/7 AI Customer Support Chat**: Context-aware retail support assistant answering FAQs, shipping queries, and return policies in real time.
* **Market Insights Engine**: Automated demand forecasting, regional pricing analysis, and trend summaries for merchant sellers.

### 🏪 Seller Studio & Multi-Vendor
* **Vendor Onboarding & Approval**: Multi-tier merchant application flow with verification badges.
* **Product Catalog Management**: Rich text product descriptions, bulk image management, and stock alerts.
* **Financial Subaccount Integration**: Direct setup of Paystack payout banking details.

### 🛡️ Admin & SuperAdmin Operations Center
* **Role-Based Access Control (RBAC)**: Fine-grained permissions (SuperAdmin, Operations, Finance, Moderator, Support).
* **Audit Trail Logging**: Immutable system activity logging tracking administrative actions.
* **Admin Invitation System**: Time-limited cryptographic invitation tokens for secure staff onboarding.
* **Product Catalog Scraper**: Built-in Cheerio web scraper to ingest products from partner feeds or external catalogs.
* **Review Moderation & Image Manager**: Moderation tools for user reviews and dynamic hero banner category management.
* **GDPR/Data Privacy Tools**: One-click user data export and automated Right-to-be-Forgotten data erasure.

### 📱 Progressive Web App (PWA)
* **Installable**: Full Web App Manifest with desktop and mobile installation prompts.
* **Offline Resilience**: Offline notification banners, local cart persistence, and background sync queues for intermittent connectivity.
* **Automated Sitemap & SEO**: Real-time XML sitemap generation (`/sitemap.xml`) and OpenGraph/Twitter Card social meta tags.

---

## 🏗️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (SPA)                          │
│   React 19 • TypeScript • Vite • Tailwind CSS v4 • Leaflet  │
│        TanStack Query • Lucide • Framer Motion • PWA        │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌─────────────────────────┐           ┌────────────────────────┐
│    Firebase Services    │           │    Node/Express API    │
│  - Cloud Firestore      │           │  - Helmet Security CSP │
│  - Firebase Auth        │           │  - Rate Limiting       │
│  - Security Rules (RBAC)│           │  - OpenMaps Proxy      │
└─────────────────────────┘           │  - Gemini AI Engine    │
                                      │  - Paystack Gateway    │
                                      └────────────────────────┘
```

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19, TypeScript | Strict typing, functional hooks, concurrent features |
| **Styling** | Tailwind CSS v4, Motion | Modern utility classes, CSS animations, Geist & Plus Jakarta Sans |
| **Build & Dev Tooling** | Vite 6, tsx, esbuild | Fast HMR in dev, bundled CJS Node server in production |
| **Routing & State** | React Router DOM v7, TanStack Query | Client-side routing, server state caching and optimistic updates |
| **Database & Auth** | Firebase Firestore, Firebase Auth | Real-time documents, Google OAuth, Email/Password, granular RBAC |
| **Backend Server** | Node.js, Express 4 | Reverse proxy, rate limiting, secure credentials handling |
| **AI / LLM** | `@google/genai` (Gemini 2.5 Flash) | Product recommendations, customer support agent, market insights |
| **Payments** | Paystack API | Card, M-Pesa, Subaccount splits, webhook verification |
| **Mapping & GIS** | Leaflet, OpenStreetMap Nominatim | Free delivery polygons, location search, address autocompletion |

---

## 📂 Project Structure

```text
├── .env.example             # Template for local environment variables
├── firestore.rules          # Production Firebase Firestore security rules & RBAC
├── index.html               # Main HTML entry point with PWA meta & dynamic fonts
├── metadata.json            # AI Studio applet configuration and capabilities
├── package.json             # NPM dependencies, scripts, and build pipeline
├── server.ts                # Express backend proxy & Vite SSR/dev integration server
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration with Tailwind v4 plugin
│
├── public/                  # Static assets, PWA manifest, service workers
│   ├── manifest.json        # Web App Manifest definition
│   ├── robots.txt           # Search engine crawler directives
│   └── sw.js                # Service Worker for offline asset caching
│
├── scripts/                 # Maintenance and build utility scripts
│   ├── audit-role-assignment.ts # RBAC auditing tool
│   └── generate-sitemap.ts      # Automated XML sitemap generator
│
└── src/
    ├── App.tsx              # Root router configuration and layout providers
    ├── main.tsx             # React application entry point
    ├── index.css            # Global CSS with Tailwind v4 imports
    ├── types.ts             # Global TypeScript interface definitions
    │
    ├── assets/              # Static branding images, icons, and illustrations
    ├── components/          # Reusable UI components
    │   ├── admin/           # Administrative subcomponents and dashboards
    │   ├── Navbar.tsx       # Main navigation header with search and user controls
    │   ├── Footer.tsx       # Marketplace footer and trust badges
    │   ├── ProductCard.tsx  # Optimized product card with quick-add & wishlist
    │   ├── FreeDeliveryMap.tsx      # Leaflet interactive delivery boundary map
    │   ├── DeliveryLocationSearch.tsx # Nominatim geocoding autocomplete input
    │   ├── SupportChat.tsx  # Gemini AI interactive customer support drawer
    │   └── ...              # Modals, drawers, banners, and calculators
    │
    ├── data/                # Seed product catalogs, delivery zones, and constants
    ├── hooks/               # Custom React hooks (auth, cart, geolocation, network)
    ├── lib/                 # Third-party initializations (Firebase client SDK)
    ├── pages/               # Application page views
    │   ├── Home.tsx         # Main storefront and hero showcases
    │   ├── ProductDetails.tsx # Variant configurator, reviews, related products
    │   ├── Cart.tsx         # Shopping cart with voucher discounts & POD indicator
    │   ├── Checkout.tsx     # Address selection, Paystack & POD payment flow
    │   ├── PaymentSuccess.tsx # Transaction confirmation & claim flow
    │   ├── TrackOrder.tsx   # Visual shipment milestone tracking
    │   ├── Wishlist.tsx     # User saved items
    │   ├── SharedWishlist.tsx # Publicly shared wishlist viewer
    │   ├── Admin.tsx        # SuperAdmin operations control center
    │   ├── Profile.tsx      # User account, order history, and preferences
    │   ├── Login.tsx        # Authentication modal with Google & Email/Password
    │   └── ...              # Policy, FAQ, Shipping, and Career pages
    │
    └── server/              # Server-side helper modules (OpenMaps proxy cache)
```

---

## 🚀 Getting Started

### 1. Prerequisites
* **Node.js**: `v20.x` or later recommended
* **npm**: `v10.x` or later
* **Firebase Project**: With Cloud Firestore and Authentication enabled

### 2. Installation

Clone the repository and install all dependencies:

```bash
git clone https://github.com/your-username/sokoplus.git
cd sokoplus
npm install
```

### 3. Environment Configuration

Copy the sample environment file:

```bash
cp .env.example .env
```

Populate the keys in `.env` based on your credentials:

```ini
# Google Gemini AI (Server-Side Only)
GEMINI_API_KEY=your_gemini_api_key_here

# Paystack Payment Gateway
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key_here

# Google Analytics (Optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# App Domain URL
APP_URL=http://localhost:3000
```

> **Note on Firebase Credentials**:  
> In production or containerized environments (like Google Cloud Run), Firebase Admin initializes automatically using the environment's Application Default Credentials (ADC). For local development, ensure your Firebase project credentials or service account is configured.

### 4. Running the Development Server

Start the integrated Express + Vite dev server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launches the server with Vite middleware on `http://localhost:3000` via `tsx server.ts`. |
| `npm run build` | Generates the XML sitemap, bundles the client SPA via Vite, and compiles `server.ts` into `dist/server.cjs` via `esbuild`. |
| `npm start` | Runs the compiled production server (`node dist/server.cjs`). |
| `npm run lint` | Runs the TypeScript compiler (`tsc --noEmit`) to validate types and syntax across the codebase. |
| `npm run sitemap` | Regenerates `public/sitemap.xml` dynamically from the current product catalog. |
| `npm run clean` | Deletes the production `dist` directory. |

---

## 🔌 API Endpoints Summary

The backend server (`server.ts`) exposes proxy and business logic endpoints guarded by Helmet CSP and rate limiting:

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/paystack/initialize` | Initializes a Paystack checkout transaction with subaccount splits | No |
| `GET` | `/api/paystack/verify/:reference` | Verifies a completed transaction reference | No |
| `POST` | `/api/paystack/subaccount/create` | Provisions vendor payment subaccounts on Paystack | Seller / Admin |
| `GET` | `/api/pod/config` | Retrieves Pay on Delivery configuration & deposit rules | No |
| `POST` | `/api/pod/config` | Updates POD rules and fee thresholds | SuperAdmin |
| `POST` | `/api/pod/calculate` | Calculates required POD deposit based on location and cart | No |
| `POST` | `/api/recommendations` | Generates personalized product recommendations via Gemini 2.5 | No |
| `POST` | `/api/support-chat/ai` | Handles streaming or structured customer support replies | No |
| `POST` | `/api/market-insights` | Generates category trend analytics for merchants | Seller / Admin |
| `GET` | `/api/openmaps/search` | Cached OpenStreetMap Nominatim proxy for Kenyan addresses | No |
| `GET` | `/api/openmaps/reverse` | Reverse geocodes latitude/longitude to address strings | No |
| `GET` | `/api/admin/audit_logs` | Fetches historical system security audit entries | SuperAdmin |
| `GET` | `/api/admin/roles` | Lists administrative roles and granted permissions | SuperAdmin |
| `POST` | `/api/admin/invitations` | Generates secure admin registration invitation tokens | SuperAdmin |
| `POST` | `/api/admin/scrape-products` | Triggers Cheerio web scraper to ingest product data | SuperAdmin |

---

## 🔐 Security & Data Protection

* **Strict Content Security Policy (CSP)**: Handled via Helmet, allowing secure communication with Google Identity, Firebase, Paystack, and OpenStreetMap while blocking unapproved scripts.
* **Granular Firestore Security Rules**: Enforces strict document ownership, verified seller authorization, and multi-tier SuperAdmin privileges directly at the database layer.
* **Rate Limiting**: Tiered IP rate limiting prevents brute-force attacks on payment initialization, scraping endpoints, and AI generative queries.
* **GDPR Compliance**: Includes automated endpoints and customer UI modals for data export and complete user erasure.

---

## 🚢 Deployment

To deploy Sokoplus to any standard containerized platform (such as Google Cloud Run, AWS App Runner, or Docker):

1. **Build the assets and server**:
   ```bash
   npm run build
   ```
2. **Start the production server**:
   ```bash
   npm start
   ```
3. The server serves the pre-rendered static assets from `dist/` and handles API requests on port `3000` (or the port specified by the `PORT` environment variable).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.
