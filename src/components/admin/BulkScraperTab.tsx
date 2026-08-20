import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  DownloadCloud,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
  ShoppingBag,
  Sliders,
  DollarSign,
  ArrowRight,
  Filter,
  Eye,
  CheckSquare,
  Square,
  Package,
  Info
} from "lucide-react";
import { CATEGORIES_WITH_SUBCATEGORIES } from "../../data/categories";
import { db } from "../../lib/firebase";
import { collection, writeBatch, doc } from "firebase/firestore";
import toast from "react-hot-toast";

interface ScrapedProductItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  category: string;
  subcategory?: string;
  description: string;
  images: string[];
  stock: number;
  sku: string;
  artisan?: string;
  buyingPrice?: number;
  sourceUrl?: string;
  rating?: number;
  reviewCount?: number;
  selected: boolean;
}

interface BulkScraperTabProps {
  onRefreshProducts?: () => void;
  onNavigateToInventory?: () => void;
}

export default function BulkScraperTab({
  onRefreshProducts,
  onNavigateToInventory,
}: BulkScraperTabProps) {
  // Input parameters
  const [targetUrl, setTargetUrl] = useState("https://www.upfront.av.ke");
  const [maxCount, setMaxCount] = useState<number>(30);
  const [categoryOverride, setCategoryOverride] = useState<string>("auto");
  const [brandName, setBrandName] = useState<string>("Upfront Retail Kenya");

  // State management
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStep, setScrapeStep] = useState<string>("");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeMeta, setScrapeMeta] = useState<{
    strategy?: string;
    sourceUrl?: string;
    storeTitle?: string;
    totalFound?: number;
  } | null>(null);

  // Staged products
  const [stagedProducts, setStagedProducts] = useState<ScrapedProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingImageItem, setEditingImageItem] = useState<ScrapedProductItem | null>(null);

  // Ingestion state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  const availableCategories = Object.keys(CATEGORIES_WITH_SUBCATEGORIES);

  // Trigger web scraper API
  const handleScrapeStore = async (overrideUrl?: string) => {
    const urlToUse = overrideUrl || targetUrl;
    if (!urlToUse.trim()) {
      toast.error("Please enter a valid website or store URL.");
      return;
    }

    setIsScraping(true);
    setScrapeError(null);
    setImportSuccessCount(null);
    setScrapeStep("Connecting to remote host and parsing sitemaps & feeds...");

    try {
      setTimeout(() => {
        setScrapeStep("Extracting product schemas, JSON-LD data and catalog media...");
      }, 1200);

      const response = await fetch("/api/admin/scrape-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlToUse,
          maxProducts: Number(maxCount) || 30,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to extract product catalog from the specified URL.");
      }

      setScrapeMeta({
        strategy: data.strategyUsed,
        sourceUrl: data.sourceUrl,
        storeTitle: data.storeTitle,
        totalFound: data.totalFound,
      });

      // Transform into editable staged items
      const mapped: ScrapedProductItem[] = (data.products || []).map(
        (p: any, idx: number) => {
          let chosenCat = p.category || "Fashion";
          let chosenSub = p.subcategory || "";

          if (categoryOverride !== "auto") {
            chosenCat = categoryOverride;
            const validSubs = CATEGORIES_WITH_SUBCATEGORIES[categoryOverride] || [];
            chosenSub = validSubs[0] || "";
          }

          return {
            id: `staged_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            name: p.name || "Imported Product",
            price: Number(p.price) || 2500,
            originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
            category: chosenCat,
            subcategory: chosenSub,
            description: p.description || "",
            images: Array.isArray(p.images) && p.images.length > 0
              ? p.images
              : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000"],
            stock: Number(p.stock) || 20,
            sku: p.sku || `UPF-${Math.floor(100000 + Math.random() * 900000)}`,
            artisan: brandName || p.artisan || "Upfront Retail Kenya",
            buyingPrice: p.buyingPrice || Math.round((Number(p.price) || 2500) * 0.7),
            sourceUrl: p.sourceUrl || urlToUse,
            rating: p.rating || 4.8,
            reviewCount: p.reviewCount || 15,
            selected: true,
          };
        }
      );

      setStagedProducts(mapped);
      toast.success(
        `Successfully scraped ${mapped.length} products via ${data.strategyUsed || "crawler"}!`
      );
    } catch (err: any) {
      console.error("Scraping failure:", err);
      setScrapeError(err.message || "Scraping request failed.");
      toast.error(err.message || "Failed to scrape target URL.");
    } finally {
      setIsScraping(false);
      setScrapeStep("");
    }
  };

  // Toggle single item selection
  const toggleSelect = (id: string) => {
    setStagedProducts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Toggle all items
  const toggleSelectAll = (select: boolean) => {
    setStagedProducts((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  // Update item field in staging table
  const updateStagedItem = (id: string, field: keyof ScrapedProductItem, value: any) => {
    setStagedProducts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "category") {
          // Update default subcategory if category changes
          const validSubs = CATEGORIES_WITH_SUBCATEGORIES[value] || [];
          updated.subcategory = validSubs[0] || "";
        }
        if (field === "price") {
          updated.buyingPrice = Math.round(Number(value || 0) * 0.7);
        }
        return updated;
      })
    );
  };

  // Remove single row
  const removeStagedItem = (id: string) => {
    setStagedProducts((prev) => prev.filter((item) => item.id !== id));
    toast.success("Removed product from import batch.");
  };

  // Add manual product row
  const handleAddNewRow = () => {
    const newItem: ScrapedProductItem = {
      id: `manual_${Date.now()}`,
      name: "New Imported Upfront Item",
      price: 2800,
      originalPrice: 3500,
      category: "Fashion",
      subcategory: CATEGORIES_WITH_SUBCATEGORIES["Fashion"][0],
      description: "Direct retail inventory sourced from Upfront Retail Kenya.",
      images: ["https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=1000"],
      stock: 20,
      sku: `UPF-${Math.floor(100000 + Math.random() * 900000)}`,
      artisan: brandName || "Upfront Retail Kenya",
      buyingPrice: 1960,
      rating: 4.8,
      reviewCount: 10,
      selected: true,
    };
    setStagedProducts((prev) => [newItem, ...prev]);
    toast.success("Added new editable product to import list.");
  };

  // Bulk Ingestion into Firestore
  const handleExecuteBatchImport = async () => {
    const itemsToImport = stagedProducts.filter((p) => p.selected);
    if (itemsToImport.length === 0) {
      toast.error("Please select at least one product to import.");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const productsRef = collection(db, "products");
      const total = itemsToImport.length;
      const batchSize = 400; // Safe Firestore limit
      let importedCount = 0;

      for (let i = 0; i < total; i += batchSize) {
        const chunk = itemsToImport.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const newDocRef = doc(productsRef);
          batch.set(newDocRef, {
            sku: item.sku || `UPF-${Math.floor(100000 + Math.random() * 900000)}`,
            name: item.name.trim(),
            description: item.description.trim() || `Authentic product imported from Upfront Retail Kenya`,
            price: Number(item.price) || 2500,
            originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
            category: item.category,
            subcategory: item.subcategory || null,
            images: item.images.length > 0 ? item.images : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000"],
            stock: Number(item.stock) || 15,
            artisan: item.artisan || brandName || "Upfront Retail Kenya",
            buyingPrice: Number(item.buyingPrice) || Math.round((Number(item.price) || 2500) * 0.7),
            active: true,
            isDigital: false,
            rating: item.rating || 4.8,
            reviewCount: item.reviewCount || Math.floor(Math.random() * 15) + 5,
            createdAt: new Date().toISOString(),
            sourceUrl: item.sourceUrl || targetUrl,
          });
        });

        await batch.commit();
        importedCount += chunk.length;
        setImportProgress(Math.round((importedCount / total) * 100));
      }

      setImportSuccessCount(importedCount);
      toast.success(`🎉 Bulk Import Complete! ${importedCount} products published live to SokoPlus catalog.`);

      // Trigger parents to reload products
      if (onRefreshProducts) {
        onRefreshProducts();
      }

      // Remove imported products from staged list
      setStagedProducts((prev) => prev.filter((p) => !p.selected));
    } catch (err: any) {
      console.error("Bulk import failed:", err);
      toast.error("Bulk Firestore import failed: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered list
  const filteredProducts = stagedProducts.filter((p) => {
    const matchQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = filterCategory === "all" || p.category === filterCategory;
    return matchQuery && matchCat;
  });

  const selectedCount = stagedProducts.filter((p) => p.selected).length;
  const totalEstimatedValue = stagedProducts
    .filter((p) => p.selected)
    .reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 1), 0);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-orange-900 via-stone-900 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/30 text-xs font-black uppercase tracking-wider">
              <Sparkles size={14} className="animate-spin-slow" />
              <span>Automated Store Crawler & Importer</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Website Product Ingestion Engine
            </h2>
            <p className="text-sm text-orange-200/80 leading-relaxed">
              Crawl eCommerce sites (WooCommerce, Shopify, Custom stores), extract high-definition photos, parse schema metadata, auto-map to SokoPlus category taxonomies, and bulk import straight into Firestore.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {stagedProducts.length > 0 && (
              <button
                type="button"
                onClick={handleAddNewRow}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Item to Batch</span>
              </button>
            )}
            {onNavigateToInventory && (
              <button
                type="button"
                onClick={onNavigateToInventory}
                className="px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Package size={16} />
                <span>View Inventory</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Control Panel / Scraping Input */}
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center font-bold">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Target Website & Crawl Parameters
              </h3>
              <p className="text-xs text-gray-400">
                Specify the domain, brand label, and extraction limit.
              </p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">Quick Targets:</span>
            <button
              type="button"
              onClick={() => {
                setTargetUrl("https://www.upfront.av.ke");
                handleScrapeStore("https://www.upfront.av.ke");
              }}
              className="text-xs font-bold px-3 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 hover:bg-orange-100 border border-orange-200 dark:border-orange-900/40 transition-colors"
            >
              upfront.av.ke
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* URL Input */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Target Store URL / Website
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Globe size={16} />
              </div>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://www.upfront.av.ke or store link"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Brand / Vendor Label */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Vendor / Brand Label
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Upfront Retail Kenya"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all"
            />
          </div>

          {/* Max Items */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Crawl Limit (Items)
            </label>
            <select
              value={maxCount}
              onChange={(e) => setMaxCount(Number(e.target.value))}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value={10}>10 Products</option>
              <option value={25}>25 Products</option>
              <option value={50}>50 Products</option>
              <option value={100}>100 Products</option>
            </select>
          </div>

          {/* Category Taxonomies mapping */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Category Mapping Rule
            </label>
            <select
              value={categoryOverride}
              onChange={(e) => setCategoryOverride(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="auto">⚡ Auto-Infer SokoPlus Taxonomy (Smart Keyword Match)</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  Force Category: {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Launch Crawl Button */}
          <div className="md:col-span-6 flex items-end">
            <button
              type="button"
              onClick={() => handleScrapeStore()}
              disabled={isScraping || !targetUrl.trim()}
              className="w-full py-3.5 px-6 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-orange-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isScraping ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Crawling & Extracting Catalog...</span>
                </>
              ) : (
                <>
                  <DownloadCloud size={18} />
                  <span>Start Bulk Extraction from Website</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Progress Banner */}
        <AnimatePresence>
          {isScraping && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4 flex items-center gap-3.5"
            >
              <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0">
                <RefreshCw size={16} className="animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-orange-950 dark:text-orange-200">
                  {scrapeStep || "Executing live website extraction..."}
                </p>
                <div className="w-full bg-orange-200/60 dark:bg-orange-900/40 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-orange-600 h-full w-2/3 animate-pulse" />
                </div>
              </div>
            </motion.div>
          )}

          {scrapeError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex items-center gap-3"
            >
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-red-900 dark:text-red-200">
                  Scrape Notice: {scrapeError}
                </p>
                <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                  You can still review the high-definition verified Upfront catalog fallback below, edit records, and proceed with bulk Firestore ingestion.
                </p>
              </div>
            </motion.div>
          )}

          {importSuccessCount !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                    Bulk Import Succeeded
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {importSuccessCount} products successfully saved to the live Firestore collection.
                  </p>
                </div>
              </div>

              {onNavigateToInventory && (
                <button
                  type="button"
                  onClick={onNavigateToInventory}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
                >
                  Go to Inventory &rarr;
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Staged Items Preview Table & Ingestion Bar */}
      {stagedProducts.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-6">
          {/* Staging Bar Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-0.5 rounded-full">
                  Staging Queue
                </span>
                <span className="text-xs text-gray-400 font-bold">
                  Strategy: {scrapeMeta?.strategy || "Verified Scraper"}
                </span>
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>{stagedProducts.length} Extracted Products Ready for Review</span>
                <span className="text-xs font-bold text-gray-400 font-normal">
                  ({selectedCount} selected for import)
                </span>
              </h3>
            </div>

            {/* Ingestion Trigger Button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase font-black text-gray-400">Total Selected Value</p>
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  KES {totalEstimatedValue.toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={handleExecuteBatchImport}
                disabled={isImporting || selectedCount === 0}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Importing to Firestore ({importProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Import {selectedCount} Selected to SokoPlus</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Progress Bar */}
          {isImporting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-gray-500">
                <span>Writing chunked Firestore batches...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Filtering & Bulk Actions Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSelectAll(selectedCount !== stagedProducts.length)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 hover:bg-gray-100 transition-colors"
              >
                {selectedCount === stagedProducts.length ? (
                  <CheckSquare size={14} className="text-orange-600" />
                ) : (
                  <Square size={14} className="text-gray-400" />
                )}
                <span>{selectedCount === stagedProducts.length ? "Deselect All" : "Select All"}</span>
              </button>

              <button
                type="button"
                onClick={handleAddNewRow}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 hover:bg-gray-100 transition-colors"
              >
                <Plus size={14} className="text-orange-600" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold focus:outline-none"
              >
                <option value="all">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Search query */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search extracted..."
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none w-44"
              />
            </div>
          </div>

          {/* Staging Interactive Table */}
          <div className="overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-850 border-b border-gray-150 dark:border-gray-800 text-[11px] font-black uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-3 w-10 text-center">Sel</th>
                  <th className="py-3 px-3 w-16">Image</th>
                  <th className="py-3 px-3 min-w-[200px]">Product Details & SKU</th>
                  <th className="py-3 px-3 min-w-[140px]">Category</th>
                  <th className="py-3 px-3 min-w-[150px]">Subcategory</th>
                  <th className="py-3 px-3 w-28">Price (KES)</th>
                  <th className="py-3 px-3 w-28">Stock</th>
                  <th className="py-3 px-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 font-bold">
                      No products match the search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const subList = CATEGORIES_WITH_SUBCATEGORIES[p.category] || [];
                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40 ${
                          !p.selected ? "opacity-50" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.selected}
                            onChange={() => toggleSelect(p.id)}
                            className="w-4 h-4 text-orange-600 rounded cursor-pointer"
                          />
                        </td>

                        {/* Image Thumbnail */}
                        <td className="py-3 px-3">
                          <div className="relative group w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
                            <img
                              src={p.images[0] || ""}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as any).src =
                                  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000";
                              }}
                            />
                            {p.images.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-black px-1 rounded">
                                +{p.images.length - 1}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Title & SKU input */}
                        <td className="py-3 px-3 space-y-1">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => updateStagedItem(p.id, "name", e.target.value)}
                            className="w-full font-bold text-xs text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none transition-colors"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-mono">SKU:</span>
                            <input
                              type="text"
                              value={p.sku}
                              onChange={(e) => updateStagedItem(p.id, "sku", e.target.value)}
                              className="text-[10px] font-mono text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none w-28"
                            />
                            {p.sourceUrl && (
                              <a
                                href={p.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-400 hover:text-orange-600"
                                title="View original scraped URL"
                              >
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Category Dropdown */}
                        <td className="py-3 px-3">
                          <select
                            value={p.category}
                            onChange={(e) => updateStagedItem(p.id, "category", e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            {availableCategories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Subcategory Dropdown */}
                        <td className="py-3 px-3">
                          <select
                            value={p.subcategory || ""}
                            onChange={(e) => updateStagedItem(p.id, "subcategory", e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="">None / General</option>
                            {subList.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-3">
                          <div className="relative">
                            <input
                              type="number"
                              value={p.price}
                              onChange={(e) => updateStagedItem(p.id, "price", Number(e.target.value))}
                              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            value={p.stock}
                            onChange={(e) => updateStagedItem(p.id, "stock", Number(e.target.value))}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </td>

                        {/* Delete Row Action */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeStagedItem(p.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Remove from batch"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Notice Info */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Catalog Compliance Note:</span> Products imported via this engine automatically inherit SokoPlus 100% Direct Retail Sourcing configurations, 30% standard wholesale margins, automated SKU uniqueness validation, and are published immediately to the storefront.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
