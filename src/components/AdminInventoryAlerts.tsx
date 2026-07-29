import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  Package, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Sliders, 
  Bell, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ShieldAlert, 
  Layers,
  Sparkles
} from "lucide-react";
import { Product, InventoryAlert } from "../types";
import { 
  getInventoryThreshold, 
  saveInventoryThreshold, 
  auditAndTriggerInventoryAlerts, 
  resolveInventoryAlert, 
  dismissInventoryAlert, 
  quickRestockProduct,
  DEFAULT_LOW_STOCK_THRESHOLD 
} from "../utils/inventoryAlertManager";
import { FastImage } from "./FastImage";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

interface AdminInventoryAlertsProps {
  products: Product[];
  onProductsUpdated?: () => void;
}

export const AdminInventoryAlerts: React.FC<AdminInventoryAlertsProps> = ({
  products,
  onProductsUpdated
}) => {
  const [threshold, setThreshold] = useState<number>(DEFAULT_LOW_STOCK_THRESHOLD);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState<string>(String(DEFAULT_LOW_STOCK_THRESHOLD));
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [filterTab, setFilterTab] = useState<"active" | "out_of_stock" | "low_stock" | "resolved" | "all">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [restockAmountMap, setRestockAmountMap] = useState<Record<string, number>>({});
  const [processingAlertId, setProcessingAlertId] = useState<string | null>(null);

  // Load initial threshold & run initial audit on mount or when products change
  useEffect(() => {
    async function initThresholdAndAudit() {
      const savedThreshold = await getInventoryThreshold();
      setThreshold(savedThreshold);
      setThresholdInput(String(savedThreshold));

      if (products && products.length > 0) {
        setIsAuditing(true);
        const resultAlerts = await auditAndTriggerInventoryAlerts(products, savedThreshold);
        setAlerts(resultAlerts);
        setIsAuditing(false);
      }
    }
    initThresholdAndAudit();
  }, [products]);

  const handleSaveThreshold = async () => {
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val < 0) {
      toast.error("Please enter a valid non-negative integer for inventory threshold.");
      return;
    }

    setIsSavingThreshold(true);
    const success = await saveInventoryThreshold(val);
    setIsSavingThreshold(false);

    if (success) {
      setThreshold(val);
      setIsEditingThreshold(false);
      toast.success(`Inventory alert threshold updated to ${val} units.`);
      // Re-run audit with new threshold
      setIsAuditing(true);
      const updated = await auditAndTriggerInventoryAlerts(products, val, true);
      setAlerts(updated);
      setIsAuditing(false);
    } else {
      toast.error("Failed to update inventory threshold in settings.");
    }
  };

  const handleManualAudit = async () => {
    setIsAuditing(true);
    toast.promise(
      auditAndTriggerInventoryAlerts(products, threshold, true),
      {
        loading: "Scanning Firestore product inventory levels...",
        success: (res) => {
          setAlerts(res);
          setIsAuditing(false);
          return `Inventory audit complete. Processed ${res.length} alert records.`;
        },
        error: "Failed to complete inventory audit."
      }
    );
  };

  const handleRestock = async (productId: string, currentStock: number, alertId?: string) => {
    const addQty = restockAmountMap[productId] || 10;
    setProcessingAlertId(productId);
    
    const success = await quickRestockProduct(productId, addQty, currentStock);
    setProcessingAlertId(null);

    if (success) {
      toast.success(`Successfully added +${addQty} units to product stock.`);
      if (onProductsUpdated) onProductsUpdated();
      
      // Re-audit
      const updated = await auditAndTriggerInventoryAlerts(products, threshold);
      setAlerts(updated);
    } else {
      toast.error("Failed to update product stock.");
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    setProcessingAlertId(alertId);
    const ok = await resolveInventoryAlert(alertId);
    setProcessingAlertId(null);
    if (ok) {
      toast.success("Alert marked as resolved.");
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "resolved" } : a));
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    setProcessingAlertId(alertId);
    const ok = await dismissInventoryAlert(alertId);
    setProcessingAlertId(null);
    if (ok) {
      toast.success("Alert dismissed.");
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "dismissed" } : a));
    }
  };

  // Derive counts & lists
  const lowStockProducts = products.filter(p => p.active !== false && p.stock <= threshold);
  const outOfStockProducts = products.filter(p => p.active !== false && p.stock === 0);
  const unreadAlertsCount = alerts.filter(a => a.status === "unread").length;

  // Filtered alerts/products for list
  const filteredAlerts = alerts.filter(a => {
    if (filterTab === "active" && a.status !== "unread") return false;
    if (filterTab === "resolved" && a.status !== "resolved") return false;
    if (filterTab === "out_of_stock" && a.stock > 0) return false;
    if (filterTab === "low_stock" && (a.stock <= 0 || a.stock > threshold)) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        a.productName.toLowerCase().includes(q) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.artisan && a.artisan.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Automated Alert Header */}
      <div className="bg-gradient-to-r from-orange-900 via-gray-900 to-black text-white p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden border border-orange-500/20">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-black uppercase tracking-wider">
              <ShieldAlert size={14} className="animate-pulse" />
              <span>Automated Admin Inventory Alerts Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Low Inventory Notification Center</span>
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm font-medium leading-relaxed">
              Monitors product stock across Firestore collections. Automatically triggers admin alerts when stock drops at or below your target threshold of <strong className="text-orange-400">{threshold} units</strong>.
            </p>
          </div>

          {/* Quick Threshold Control Widget */}
          <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 space-y-3 min-w-[280px]">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-gray-300">
              <span className="flex items-center gap-1.5">
                <Sliders size={14} className="text-orange-400" /> Alert Threshold
              </span>
              <span className="text-orange-400 font-extrabold text-sm">{threshold} units</span>
            </div>

            {isEditingThreshold ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-full bg-black/50 border border-orange-500/50 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="e.g. 5"
                />
                <button
                  onClick={handleSaveThreshold}
                  disabled={isSavingThreshold}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-black text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md disabled:opacity-50"
                >
                  {isSavingThreshold ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setIsEditingThreshold(false)}
                  className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-gray-400 font-medium">Triggers when stock &le; {threshold}</span>
                <button
                  onClick={() => setIsEditingThreshold(true)}
                  className="text-xs font-extrabold text-orange-400 hover:text-orange-300 underline cursor-pointer"
                >
                  Configure
                </button>
              </div>
            )}

            <button
              onClick={handleManualAudit}
              disabled={isAuditing}
              className="w-full mt-2 py-2 px-4 bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              <RefreshCw size={13} className={isAuditing ? "animate-spin" : ""} />
              <span>{isAuditing ? "Scanning Inventory..." : "Run Immediate Audit Scan"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Unread Alerts */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Active Alerts</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center text-orange-600">
              <Bell size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-gray-50">{unreadAlertsCount}</p>
          <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
            {unreadAlertsCount === 0 ? "All clear" : "Requires admin review"}
          </p>
        </div>

        {/* Card 2: Out of Stock */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Out of Stock</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-600">
              <XCircle size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">{outOfStockProducts.length}</p>
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Critical (0 stock)</p>
        </div>

        {/* Card 3: Low Stock Count */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Below Threshold</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <AlertTriangle size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{lowStockProducts.length}</p>
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">&le; {threshold} units remaining</p>
        </div>

        {/* Card 4: Predefined Threshold */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Threshold Rule</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <Sliders size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100">{threshold} <span className="text-xs font-bold text-gray-400">pcs</span></p>
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Global trigger limit</p>
        </div>
      </div>

      {/* Main Alert Records List & Filters Section */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-150 dark:border-gray-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tab Filters */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
            <button
              onClick={() => setFilterTab("active")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === "active"
                  ? "bg-white dark:bg-gray-900 text-orange-600 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Active Alerts ({unreadAlertsCount})
            </button>
            <button
              onClick={() => setFilterTab("out_of_stock")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === "out_of_stock"
                  ? "bg-white dark:bg-gray-900 text-red-600 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Out of Stock ({outOfStockProducts.length})
            </button>
            <button
              onClick={() => setFilterTab("low_stock")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === "low_stock"
                  ? "bg-white dark:bg-gray-900 text-amber-600 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Low Stock (&le; {threshold})
            </button>
            <button
              onClick={() => setFilterTab("resolved")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === "resolved"
                  ? "bg-white dark:bg-gray-900 text-green-600 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Resolved Alerts
            </button>
            <button
              onClick={() => setFilterTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === "all"
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              All Records ({alerts.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search product, category or artisan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none focus:ring-1 focus:ring-orange-500 dark:text-white"
            />
          </div>
        </div>

        {/* Alert Records List */}
        {filteredAlerts.length === 0 ? (
          <div className="py-16 text-center bg-gray-50 dark:bg-gray-850 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">No Inventory Alerts Found</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                {filterTab === "active" 
                  ? `All active products currently exceed the alert threshold of ${threshold} units.` 
                  : "No inventory alert records match your selected criteria."}
              </p>
            </div>
            <button
              onClick={handleManualAudit}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold text-xs rounded-xl hover:opacity-90 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Run Re-Scan Audit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const matchedProduct = products.find(p => p.id === alert.productId);
              const currentStock = matchedProduct ? matchedProduct.stock : alert.stock;
              const isZero = currentStock === 0;

              return (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    alert.status === "unread"
                      ? isZero 
                        ? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50" 
                        : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                      : "bg-white dark:bg-gray-850 border-gray-150 dark:border-gray-800 opacity-80"
                  }`}
                >
                  {/* Left: Product & Alert info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      {matchedProduct?.images?.[0] ? (
                        <FastImage src={matchedProduct.images[0]} alt={alert.productName} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package size={20} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-gray-950 dark:text-gray-50 truncate">{alert.productName}</h4>
                        {isZero ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black uppercase tracking-wider">
                            OUT OF STOCK (0)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider">
                            LOW STOCK ({currentStock} / {threshold})
                          </span>
                        )}

                        {alert.status === "resolved" && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 size={10} /> Resolved
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium flex-wrap">
                        <span>Category: <strong className="text-gray-800 dark:text-gray-200">{alert.category || "General"}</strong></span>
                        <span>•</span>
                        <span>Artisan: <strong className="text-gray-800 dark:text-gray-200">{alert.artisan || "Direct"}</strong></span>
                        <span>•</span>
                        <span>Triggered: {new Date(alert.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Restock & Admin Actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-800">
                    {/* Restock Qty selector */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      {[10, 25, 50].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setRestockAmountMap(prev => ({ ...prev, [alert.productId]: qty }))}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                            (restockAmountMap[alert.productId] || 10) === qty
                              ? "bg-orange-500 text-black shadow-2xs"
                              : "text-gray-600 dark:text-gray-300 hover:text-black"
                          }`}
                        >
                          +{qty}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handleRestock(alert.productId, currentStock, alert.id)}
                      disabled={processingAlertId === alert.productId}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50 whitespace-nowrap"
                    >
                      <Plus size={13} />
                      <span>Restock Now</span>
                    </button>

                    {alert.status === "unread" && (
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        disabled={processingAlertId === alert.id}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        title="Mark alert as resolved"
                      >
                        <CheckCircle2 size={14} className="text-green-600" />
                      </button>
                    )}

                    {alert.status !== "dismissed" && (
                      <button
                        onClick={() => handleDismissAlert(alert.id)}
                        disabled={processingAlertId === alert.id}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        title="Dismiss alert"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
