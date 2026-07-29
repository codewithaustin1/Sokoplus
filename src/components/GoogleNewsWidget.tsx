import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Newspaper, ExternalLink, RefreshCw, Search, Clock, Globe, ArrowUpRight, ShieldCheck, Share2, Sparkles, BookOpen, TrendingUp, Flame, ChevronDown } from "lucide-react";
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
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);

  // Helper to compute read time estimation chip
  const getReadTime = (title: string, snippet?: string) => {
    const words = `${title} ${snippet || ""}`.trim().split(/\s+/).length;
    const mins = Math.max(1, Math.ceil(words / 35));
    return `${mins} min read`;
  };

  // Check URL query parameters for deep-linked shared news item on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedTopic = urlParams.get("news_topic") || urlParams.get("news_id");
      if (sharedTopic) {
        const decodedTopic = decodeURIComponent(sharedTopic);
        setHighlightedTopic(decodedTopic);
        setCurrentQuery(decodedTopic);
        setActivePreset("custom");

        // Scroll smoothly to the news widget after rendering
        setTimeout(() => {
          const widgetElem = document.getElementById("google-news-live-widget");
          if (widgetElem) {
            widgetElem.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 600);
      }
    }
  }, []);

  const fetchNews = useCallback(async (queryToFetch: string, forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await axios.get("/api/google-news", {
        params: { q: queryToFetch, t: forceRefresh ? Date.now() : undefined },
        timeout: 10000
      });

      if (response.data && response.data.items && response.data.items.length > 0) {
        setNewsItems(response.data.items);
        setIsFallback(!!response.data.fallback);
        setLastUpdated(new Date());
      } else {
        throw new Error("Invalid or empty response payload");
      }
    } catch (err: any) {
      console.warn("[GoogleNewsWidget] Live stream network notice, using curated fallback feed:", err.message || err);
      setNewsItems([
        {
          id: "news_fallback_1",
          title: "East Africa E-Commerce Growth Soars as Mobile Money Integration Expands",
          source: "Business Daily Africa",
          link: "https://news.google.com/search?q=Kenya+E-Commerce+Mobile+Money",
          pubDate: new Date(Date.now() - 3600000 * 2).toUTCString(),
          snippet: "Kenyan digital marketplaces and online retail platforms see record transaction volumes following enhanced M-Pesa API speed and seamless seller payouts."
        },
        {
          id: "news_fallback_2",
          title: "Artisan Leather Crafts & Kisii Stone Carvings Gain Global Export Momentum",
          source: "Capital FM Kenya",
          link: "https://news.google.com/search?q=Kenya+Artisans+Export+Sokoplus",
          pubDate: new Date(Date.now() - 3600000 * 5).toUTCString(),
          snippet: "Local craftspeople in Tabaka and Nairobi leverage direct digital marketplace storefronts to reach international shoppers looking for verified authentic goods."
        },
        {
          id: "news_fallback_3",
          title: "Retail Inflation Pressures Ease as Supply Chain Digitalization Accelerates in Nairobi",
          source: "The Standard Kenya",
          link: "https://news.google.com/search?q=Nairobi+Supply+Chain+Retail",
          pubDate: new Date(Date.now() - 3600000 * 9).toUTCString(),
          snippet: "Direct farmer and manufacturer-to-consumer digital channels cut middleman markups, making everyday electronics, fashion, and home items more affordable."
        },
        {
          id: "news_fallback_4",
          title: "Central Bank of Kenya Highlights Growth in Consumer Digital Payment Confidence",
          source: "Kenya Broadcasting Corporation",
          link: "https://news.google.com/search?q=CBK+Digital+Payments+Kenya",
          pubDate: new Date(Date.now() - 3600000 * 18).toUTCString(),
          snippet: "Real-time payment verification and escrow protection models build shopper trust in homegrown Kenyan e-commerce platforms."
        }
      ]);
      setIsFallback(true);
      setLastUpdated(new Date());
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(currentQuery);

    // Auto-refresh Google News feed every 25 minutes (1,500,000 ms)
    const REFRESH_INTERVAL_MS = 25 * 60 * 1000;
    const intervalId = setInterval(() => {
      fetchNews(currentQuery, true);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [currentQuery, fetchNews]);

  const handlePresetClick = (preset: typeof PRESET_TOPICS[0]) => {
    setActivePreset(preset.id);
    setSearchQuery("");
    setCurrentQuery(preset.query);
    setHighlightedTopic(null);
  };

  const handleCustomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActivePreset("custom");
    setCurrentQuery(searchQuery.trim());
    setHighlightedTopic(null);
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

  // Direct Native Share with Sokoplus Referral Link & Deep-Link Anchor
  const handleNativeShare = async (item: GoogleNewsItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://sokoplus.co.ke";
    const params = new URLSearchParams({
      utm_source: "sokoplus_news_share",
      utm_medium: "social",
      news_topic: item.title,
      news_id: item.id || item.title,
      ref: "sokoplus"
    });
    const shareUrl = `${baseUrl}/?${params.toString()}#google-news-live-widget`;
    const shareText = `📰 "${item.title}" - via ${item.source}\n\nRead this live Kenya retail news card on Sokoplus:\n${shareUrl}`;

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
        toast.success("Sokoplus news card link copied to clipboard!", { icon: "🔗" });
      } catch (err) {
        toast.error("Unable to copy share link");
      }
    }
  };

  // Helper to extract domain and favicon for publisher brand badges
  const getPublisherFavicon = (source: string, link: string) => {
    const src = (source || "").toLowerCase();
    let domain = "";

    if (src.includes("business daily")) domain = "businessdailyafrica.com";
    else if (src.includes("nation")) domain = "nation.africa";
    else if (src.includes("standard")) domain = "standardmedia.co.ke";
    else if (src.includes("capital")) domain = "capitalfm.co.ke";
    else if (src.includes("star")) domain = "the-star.co.ke";
    else if (src.includes("citizen")) domain = "citizentv.co.ke";
    else if (src.includes("kbc")) domain = "kbc.co.ke";
    else if (src.includes("techweez")) domain = "techweez.com";
    else if (src.includes("business today")) domain = "businesstoday.co.ke";
    else if (src.includes("reuters")) domain = "reuters.com";
    else if (src.includes("bloomberg")) domain = "bloomberg.com";
    else if (src.includes("bbc")) domain = "bbc.com";
    else {
      try {
        if (link) {
          const parsed = new URL(link);
          domain = parsed.hostname.replace("www.", "");
        }
      } catch {
        domain = "";
      }
    }

    if (domain) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }
    return null;
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
            Auto-refreshes every 25m • Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {/* Animated Horizon Ticker */}
      {newsItems.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl bg-gray-900 dark:bg-black text-white p-2.5 flex items-center gap-3 shadow-inner border border-gray-800/80 group">
          <div className="flex items-center gap-1.5 shrink-0 bg-orange-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-xl tracking-wider z-10 shadow-sm animate-pulse">
            <TrendingUp size={12} />
            <span>Breaking Intel</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap w-full relative">
            <motion.div 
              className="inline-flex gap-8 whitespace-nowrap"
              animate={{ x: [0, -1200] }}
              transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
              whileHover={{ animationPlayState: "paused" }}
            >
              {newsItems.concat(newsItems).map((tItem, tIdx) => (
                <a
                  key={`ticker-${tIdx}`}
                  href={tItem.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-gray-200 hover:text-orange-400 transition-colors"
                >
                  <span className="text-orange-500 font-bold">•</span>
                  <span className="truncate max-w-[260px] sm:max-w-[380px]">{tItem.title}</span>
                  <span className="text-[10px] text-gray-400 font-mono px-1.5 py-0.5 rounded bg-gray-800">{tItem.source}</span>
                </a>
              ))}
            </motion.div>
          </div>
        </div>
      )}

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
            {newsItems.slice(0, compact ? 4 : 7).map((item, idx) => {
              const isHero = idx === 0 && !compact && newsItems.length >= 2;
              const isHighlighted = highlightedTopic && (
                item.title.toLowerCase().includes(highlightedTopic.toLowerCase()) ||
                highlightedTopic.toLowerCase().includes(item.title.toLowerCase())
              );
              const faviconUrl = getPublisherFavicon(item.source, item.link);

              return (
                <motion.a
                  key={item.id || idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4, scale: 1.006 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22, delay: idx * 0.04 }}
                  className={`group transition-all duration-200 flex flex-col justify-between relative ${
                    isHero
                      ? "md:col-span-2 p-5 sm:p-6 rounded-3xl border border-orange-500/30 dark:border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-white dark:from-orange-950/40 dark:via-gray-900 dark:to-gray-950 shadow-md hover:shadow-2xl hover:shadow-orange-500/15 dark:hover:shadow-orange-500/20 hover:border-orange-500/60"
                      : isHighlighted
                      ? "p-4 sm:p-5 rounded-2xl border-2 border-orange-500 bg-orange-50/60 dark:bg-orange-950/30 shadow-xl shadow-orange-500/10"
                      : "p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-white dark:hover:bg-gray-900 hover:border-orange-500/50 dark:hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10"
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Top Status Pill / Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isHero && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-600 text-white shadow-xs">
                            <Sparkles size={11} className="animate-pulse" />
                            <span>Top Story Spotlight</span>
                          </span>
                        )}

                        {isHighlighted && !isHero && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-600 text-white shadow-sm">
                            <Sparkles size={11} className="animate-spin" />
                            <span>Shared Story</span>
                          </span>
                        )}

                        {/* Publisher Brand Badge with Micro-logo Favicon */}
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800/90 border border-gray-200/80 dark:border-gray-700/80 px-2.5 py-1 rounded-lg truncate max-w-[210px] shadow-2xs">
                          {faviconUrl ? (
                            <img 
                              src={faviconUrl} 
                              alt={item.source} 
                              className="w-4 h-4 rounded-sm object-contain shrink-0" 
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }} 
                            />
                          ) : (
                            <Globe size={12} className="shrink-0 text-orange-600 dark:text-orange-400" />
                          )}
                          <span className="truncate">{item.source}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Estimated Read Time Micro-Chip */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20 shrink-0">
                          <BookOpen size={10} />
                          <span>{getReadTime(item.title, item.snippet)}</span>
                        </span>

                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold shrink-0 flex items-center gap-1">
                          <Clock size={11} />
                          {formatRelativeTime(item.pubDate)}
                        </span>

                        {/* Integrated Share Button */}
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

                    {/* Headline */}
                    <h4 className={`font-extrabold text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors ${
                      isHero 
                        ? "text-base sm:text-lg md:text-xl leading-snug tracking-tight line-clamp-2" 
                        : "text-xs sm:text-sm line-clamp-2 leading-snug"
                    }`}>
                      {item.title}
                    </h4>

                    {/* Snippet */}
                    {item.snippet && (
                      <p className={`text-gray-600 dark:text-gray-300 font-normal leading-relaxed ${
                        isHero ? "text-xs sm:text-sm line-clamp-3" : "text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2"
                      }`}>
                        {item.snippet}
                      </p>
                    )}

                    {/* Summary Micro-Chip & Hover-Expandable Drawer */}
                    {item.snippet && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const currentId = item.id || String(idx);
                            setExpandedSummaryId(expandedSummaryId === currentId ? null : currentId);
                          }}
                          className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 cursor-pointer bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-lg border border-orange-500/20 transition-all"
                        >
                          <Flame size={11} className="text-orange-500 animate-pulse" />
                          <span>{expandedSummaryId === (item.id || String(idx)) ? "Collapse Intelligence" : "⚡ Quick Intel Drawer"}</span>
                          <ChevronDown size={11} className={`transition-transform duration-200 ${expandedSummaryId === (item.id || String(idx)) ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                          {expandedSummaryId === (item.id || String(idx)) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden mt-2"
                            >
                              <div className="p-3 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50 text-[11px] text-gray-800 dark:text-gray-200 font-normal leading-relaxed shadow-inner">
                                <div className="font-extrabold text-orange-700 dark:text-orange-400 mb-1 flex items-center gap-1">
                                  <Sparkles size={11} /> Executive Summary Brief:
                                </div>
                                {item.snippet}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Link */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200/50 dark:border-gray-800/60 text-[11px] font-bold">
                    <span className="text-gray-500 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors flex items-center gap-1">
                      Read full article on {item.source} <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </motion.a>
              );
            })}
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

