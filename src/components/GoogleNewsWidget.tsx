import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Newspaper, ExternalLink, RefreshCw, Search, Sparkles, TrendingUp, Clock, Globe, ArrowUpRight, ShieldCheck, Share2, Copy, Check, X, MessageCircle, Send, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export interface GoogleNewsItem {
  id: string;
  title: string;
  source: string;
  link: string;
  pubDate: string;
  snippet: string;
}

interface GoogleNewsWidgetProps {
  defaultQuery?: string;
  className?: string;
  compact?: boolean;
}

const PRESET_TOPICS = [
  { id: "ecommerce", label: "🛒 Kenya E-Commerce", query: "Kenya Retail E-commerce Market" },
  { id: "business", label: "💼 Business & Markets", query: "Kenya Business Economy Commerce" },
  { id: "tech", label: "💡 Tech & Fintech", query: "Kenya Tech Innovation Mobile Money" },
  { id: "artisans", label: "🎨 Crafts & Exports", query: "Kenya Artisan Crafts Export Trade" },
  { id: "global", label: "🌍 Global Trade", query: "Global Supply Chain Retail Trends" },
];

export default function GoogleNewsWidget({ defaultQuery = "Kenya Retail E-commerce Market", className = "", compact = false }: GoogleNewsWidgetProps) {
  const [activePreset, setActivePreset] = useState<string>("ecommerce");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentQuery, setCurrentQuery] = useState<string>(defaultQuery);
  const [newsItems, setNewsItems] = useState<GoogleNewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isFallback, setIsFallback] = useState<boolean>(false);

  // Share Modal State
  const [shareItem, setShareItem] = useState<GoogleNewsItem | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const fetchNews = useCallback(async (queryToFetch: string, forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await axios.get("/api/google-news", {
        params: { q: queryToFetch, t: forceRefresh ? Date.now() : undefined }
      });

      if (response.data && response.data.items) {
        setNewsItems(response.data.items);
        setIsFallback(!!response.data.fallback);
        setLastUpdated(new Date());
      } else {
        throw new Error("Invalid response payload");
      }
    } catch (err: any) {
      console.error("Failed to load Google News feed:", err);
      setError("Unable to connect to live news stream right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(currentQuery);
  }, [currentQuery, fetchNews]);

  const handlePresetClick = (preset: typeof PRESET_TOPICS[0]) => {
    setActivePreset(preset.id);
    setSearchQuery("");
    setCurrentQuery(preset.query);
  };

  const handleCustomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActivePreset("custom");
    setCurrentQuery(searchQuery.trim());
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Recently";
      const diffMinutes = Math.floor((new Date().getTime() - date.getTime()) / 60000);
      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "Recently";
    }
  };

  // --- Sokoplus Share Helper Functions ---
  const getSokoplusShareUrl = (item: GoogleNewsItem) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://sokoplus.co.ke";
    const params = new URLSearchParams({
      utm_source: "sokoplus_news_share",
      utm_medium: "social",
      news_topic: item.title,
      ref: "sokoplus"
    });
    return `${baseUrl}/?${params.toString()}`;
  };

  const getSokoplusShareMessage = (item: GoogleNewsItem) => {
    const url = getSokoplusShareUrl(item);
    return `📰 "${item.title}" - via ${item.source}\n\nStay updated with Kenya's trending retail news and shop top verified products on Sokoplus:\n${url}`;
  };

  const handleOpenShare = (item: GoogleNewsItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareItem(item);
    setCopiedLink(false);
  };

  const handleCopySokoplusLink = async (item: GoogleNewsItem) => {
    const textToCopy = getSokoplusShareMessage(item);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLink(true);
      toast.success("Sokoplus news link copied! Traffic will land on Sokoplus.", { icon: "🔗" });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async (item: GoogleNewsItem) => {
    const url = getSokoplusShareUrl(item);
    const text = getSokoplusShareMessage(item);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${item.title} | Sokoplus News`,
          text: text,
          url: url
        });
      } catch (err) {
        // user cancelled share
      }
    } else {
      handleCopySokoplusLink(item);
    }
  };

  return (
    <div id="google-news-live-widget" className={`bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-3xl p-5 sm:p-7 shadow-xl shadow-gray-200/40 dark:shadow-none transition-all ${className}`}>
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <Newspaper size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Live Google News Feed
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Real-time headlines, Kenyan retail updates &amp; market intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium hidden md:inline-block">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => fetchNews(currentQuery, true)}
            disabled={loading || refreshing}
            title="Refresh Live News Feed"
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={`${refreshing ? "animate-spin text-orange-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Preset Topics & Custom Search */}
      <div className="pt-4 pb-5 space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {PRESET_TOPICS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom Search Bar */}
        <form onSubmit={handleCustomSearchSubmit} className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search custom news topic (e.g., M-Pesa, Safaricom, Nairobi inflation)..."
            className="w-full pl-9 pr-24 py-2 border border-gray-200/90 dark:border-gray-800 rounded-2xl bg-gray-50/80 dark:bg-gray-950/60 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
          />
          <button
            type="submit"
            disabled={!searchQuery.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-900 dark:bg-gray-800 hover:bg-orange-600 dark:hover:bg-orange-600 text-white text-[11px] font-bold rounded-xl transition-all disabled:opacity-40 cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-850 bg-gray-50/60 dark:bg-gray-950/40 animate-pulse space-y-3">
              <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-800 rounded"></div>
              <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-800 rounded"></div>
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8 px-4 bg-red-500/5 rounded-2xl border border-red-500/20">
          <p className="text-xs text-red-600 dark:text-red-400 font-semibold mb-3">{error}</p>
          <button
            onClick={() => fetchNews(currentQuery, true)}
            className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Retry Feed
          </button>
        </div>
      ) : newsItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs font-medium">
          No live news found matching "{currentQuery}". Try another topic above.
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${compact ? "gap-3" : "md:grid-cols-2 gap-4"}`}>
          <AnimatePresence mode="popLayout">
            {newsItems.slice(0, compact ? 4 : 8).map((item, idx) => (
              <motion.a
                key={item.id || idx}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className="group p-4 rounded-2xl border border-gray-100 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-white dark:hover:bg-gray-900 hover:border-orange-500/40 dark:hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 flex flex-col justify-between gap-2.5 relative"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                      <Globe size={11} className="shrink-0" />
                      <span className="truncate">{item.source}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium shrink-0 flex items-center gap-1">
                        <Clock size={11} />
                        {formatRelativeTime(item.pubDate)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleOpenShare(item, e)}
                        title="Share as Sokoplus"
                        className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-600 text-orange-600 dark:text-orange-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold shrink-0 z-10"
                      >
                        <Share2 size={12} />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h4>

                  {item.snippet && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 leading-relaxed font-normal">
                      {item.snippet}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200/40 dark:border-gray-800/60 text-[11px] font-bold">
                  <span className="text-gray-500 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors flex items-center gap-1">
                    Read Article <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleOpenShare(item, e)}
                    className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-600 text-orange-600 dark:text-orange-400 hover:text-white text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Share2 size={11} /> Share as Sokoplus
                  </button>
                </div>
              </motion.a>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-850 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1 font-medium">
          <ShieldCheck size={12} className="text-green-500" /> Powered by Google News RSS Stream
        </span>
        <a
          href={`https://news.google.com/search?q=${encodeURIComponent(currentQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-600 dark:hover:text-orange-400 font-bold flex items-center gap-1"
        >
          View all on Google News <ExternalLink size={11} />
        </a>
      </div>

      {/* Sokoplus Share Modal */}
      <AnimatePresence>
        {shareItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 relative"
            >
              {/* Close Button */}
              <button
                onClick={() => setShareItem(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/30">
                  <Share2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    Share as Sokoplus
                    <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                      Traffic Referral
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Share this news item with Sokoplus branding so visitors land on Sokoplus.
                  </p>
                </div>
              </div>

              {/* Article Preview Box */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-extrabold text-orange-600 dark:text-orange-400">
                  <Globe size={11} /> {shareItem.source}
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white line-clamp-2">
                  {shareItem.title}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                  {shareItem.snippet}
                </p>
                <div className="pt-2 text-[10px] font-medium text-gray-400 dark:text-gray-500 border-t border-gray-200/50 dark:border-gray-800/80 flex items-center gap-1">
                  <Link2 size={11} className="text-orange-500 shrink-0" /> Landing Link: <span className="font-mono truncate">{getSokoplusShareUrl(shareItem)}</span>
                </div>
              </div>

              {/* Quick Social Channels Grid */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                  Choose Sharing Channel
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* WhatsApp */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getSokoplusShareMessage(shareItem))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/20 transition-all text-xs font-bold gap-1.5 cursor-pointer group"
                  >
                    <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
                    WhatsApp
                  </a>

                  {/* X / Twitter */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(getSokoplusShareMessage(shareItem))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-sky-500/10 hover:bg-sky-500 text-sky-600 dark:text-sky-400 hover:text-white border border-sky-500/20 transition-all text-xs font-bold gap-1.5 cursor-pointer group"
                  >
                    <Send size={20} className="group-hover:scale-110 transition-transform" />
                    X / Twitter
                  </a>

                  {/* Facebook */}
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getSokoplusShareUrl(shareItem))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white border border-blue-600/20 transition-all text-xs font-bold gap-1.5 cursor-pointer group"
                  >
                    <Globe size={20} className="group-hover:scale-110 transition-transform" />
                    Facebook
                  </a>

                  {/* LinkedIn */}
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getSokoplusShareUrl(shareItem))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white border border-indigo-600/20 transition-all text-xs font-bold gap-1.5 cursor-pointer group"
                  >
                    <Sparkles size={20} className="group-hover:scale-110 transition-transform" />
                    LinkedIn
                  </a>
                </div>
              </div>

              {/* Copy Sokoplus Branded Link Button */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => handleCopySokoplusLink(shareItem)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  {copiedLink ? "Sokoplus Link Copied!" : "Copy Sokoplus Branded Link"}
                </button>

                <button
                  onClick={() => handleNativeShare(shareItem)}
                  className="py-3 px-4 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Share2 size={15} /> Native Share
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
