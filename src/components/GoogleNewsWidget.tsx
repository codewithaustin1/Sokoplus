import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Newspaper, ExternalLink, RefreshCw, Search, Clock, Globe, ArrowUpRight, ShieldCheck, Share2 } from "lucide-react";
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

  // Direct Native Share with Sokoplus Referral Link
  const handleNativeShare = async (item: GoogleNewsItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://sokoplus.co.ke";
    const params = new URLSearchParams({
      utm_source: "sokoplus_news_share",
      utm_medium: "social",
      news_topic: item.title,
      ref: "sokoplus"
    });
    const shareUrl = `${baseUrl}/?${params.toString()}`;
    const shareText = `📰 "${item.title}" - via ${item.source}\n\nStay updated with Kenya's trending retail news on Sokoplus:\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${item.title} | Sokoplus News`,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        // User cancelled share dialog
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Sokoplus news link copied to clipboard!", { icon: "🔗" });
      } catch (err) {
        toast.error("Unable to copy share link");
      }
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
                      {/* Integrated Black Top-Right Share Button */}
                      <button
                        type="button"
                        onClick={(e) => handleNativeShare(item, e)}
                        title="Share this news via Sokoplus"
                        className="px-2.5 py-1 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-all cursor-pointer flex items-center gap-1.5 text-[11px] font-extrabold shrink-0 z-10 shadow-sm"
                      >
                        <Share2 size={12} className="stroke-[2.5]" />
                        <span>Share</span>
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
    </div>
  );
}

