import React, { useState, useEffect, useRef } from "react";
import { 
  Download, 
  FileText, 
  FileCode, 
  FileArchive, 
  Film, 
  Music, 
  BookOpen, 
  Check, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  CloudDownload, 
  RefreshCw, 
  AlertCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CartItem } from "../types";
import { downloadDigitalFile, getDigitalFileName } from "../utils/downloadDigitalFile";
import { trackEvent } from "../lib/analytics";
import toast from "react-hot-toast";

interface DigitalAssetVaultProps {
  items: CartItem[];
  orderId?: string;
  userEmail?: string;
  autoTriggerDownloads?: boolean;
  className?: string;
}

export const DigitalAssetVault: React.FC<DigitalAssetVaultProps> = ({
  items,
  orderId,
  userEmail,
  autoTriggerDownloads = true,
  className = ""
}) => {
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>({});
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});
  const [copiedKeyMap, setCopiedKeyMap] = useState<Record<string, boolean>>({});
  const [copiedUrlMap, setCopiedUrlMap] = useState<Record<string, boolean>>({});
  const [autoDownloadTriggered, setAutoDownloadTriggered] = useState(false);
  const [triggerCount, setTriggerCount] = useState(0);

  const hasAutoTriggeredRef = useRef(false);

  // Filter only digital items
  const digitalItems = items.filter(
    (item) => item.isDigital || (item.digitalFileUrl && item.digitalFileUrl.trim() !== "")
  );

  // Generate deterministic license key based on orderId and item ID
  const generateLicenseKey = (itemId: string) => {
    const seed = `${orderId || "SOKO"}-${itemId}`.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const part1 = seed.slice(0, 4).padEnd(4, "9");
    const part2 = seed.slice(4, 8).padEnd(4, "X");
    const part3 = seed.slice(8, 12).padEnd(4, "A");
    return `SK-${part1}-${part2}-${part3}`;
  };

  // Helper to get format display metadata
  const getFormatDetails = (format?: string, url?: string) => {
    let fmt = (format || "").toLowerCase();
    if (!fmt && url) {
      if (url.match(/\.(jpeg|jpg|png|webp|gif)/i)) fmt = "image";
      else if (url.match(/\.pdf/i)) fmt = "pdf";
      else if (url.match(/\.zip|\.rar|\.tar/i)) fmt = "zip";
      else if (url.match(/\.mp4|\.mov|\.mkv/i)) fmt = "video";
      else if (url.match(/\.mp3|\.wav|\.aac/i)) fmt = "audio";
      else if (url.match(/\.epub|\.mobi/i)) fmt = "ebook";
    }

    switch (fmt) {
      case "pdf":
        return {
          label: "PDF Document",
          badgeColor: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800",
          icon: <FileText size={18} />
        };
      case "video":
        return {
          label: "HD Video Asset",
          badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800",
          icon: <Film size={18} />
        };
      case "audio":
        return {
          label: "High-Res Audio",
          badgeColor: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 border-pink-200 dark:border-pink-800",
          icon: <Music size={18} />
        };
      case "zip":
        return {
          label: "ZIP Package",
          badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
          icon: <FileArchive size={18} />
        };
      case "ebook":
        return {
          label: "eBook Publication",
          badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
          icon: <BookOpen size={18} />
        };
      case "software":
        return {
          label: "Software Binary",
          badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
          icon: <FileCode size={18} />
        };
      case "image":
      default:
        return {
          label: "High-Res Graphic",
          badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800",
          icon: <Sparkles size={18} />
        };
    }
  };

  const handleDownload = async (item: CartItem) => {
    const fileUrl = item.digitalFileUrl || item.image;
    if (!fileUrl) {
      toast.error("Download link is currently unavailable for this asset");
      return;
    }

    setDownloadingMap((prev) => ({ ...prev, [item.productId]: true }));
    
    try {
      const result = await downloadDigitalFile(fileUrl, item.name, item.digitalFormat);
      if (result.success) {
        setCompletedMap((prev) => ({ ...prev, [item.productId]: true }));
        toast.success(`Downloaded "${result.filename}" successfully!`);
        trackEvent("digital_download_completed", {
          product_id: item.productId,
          product_name: item.name,
          format: item.digitalFormat
        });
      } else {
        toast.error(`Download failed: ${result.error || "Please try again."}`);
      }
    } catch (err: any) {
      console.error("Download execution error:", err);
      toast.error("Download failed to initialize. Try opening the direct link.");
    } finally {
      setDownloadingMap((prev) => ({ ...prev, [item.productId]: false }));
    }
  };

  const copyLicenseKey = (key: string, itemId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyMap((prev) => ({ ...prev, [itemId]: true }));
    toast.success("License key copied to clipboard!");
    setTimeout(() => {
      setCopiedKeyMap((prev) => ({ ...prev, [itemId]: false }));
    }, 2500);
  };

  const copyDirectLink = (url: string, itemId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlMap((prev) => ({ ...prev, [itemId]: true }));
    toast.success("Secure direct download link copied!");
    setTimeout(() => {
      setCopiedUrlMap((prev) => ({ ...prev, [itemId]: false }));
    }, 2500);
  };

  const triggerAllDownloads = () => {
    if (digitalItems.length === 0) return;
    
    toast.success(`Starting automated download for ${digitalItems.length} digital asset(s)...`);
    digitalItems.forEach((item, index) => {
      setTimeout(() => {
        handleDownload(item);
      }, index * 800);
    });
    setTriggerCount((c) => c + 1);
  };

  // Automated download trigger on mount when autoTriggerDownloads is true
  useEffect(() => {
    if (!autoTriggerDownloads || hasAutoTriggeredRef.current || digitalItems.length === 0) return;
    hasAutoTriggeredRef.current = true;
    setAutoDownloadTriggered(true);

    // Stagger downloads by 600ms per file to bypass browser popup blockers
    const timer = setTimeout(() => {
      digitalItems.forEach((item, index) => {
        setTimeout(() => {
          handleDownload(item);
        }, index * 800);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [digitalItems.length, autoTriggerDownloads]);

  if (digitalItems.length === 0) {
    return null;
  }

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white dark:bg-gray-900 rounded-[2.5rem] border-2 border-orange-200/70 dark:border-orange-900/40 shadow-2xl shadow-orange-500/10 overflow-hidden text-left"
      >
        {/* Top Header Strip */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 p-6 sm:p-7 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white shadow-inner shrink-0">
                <CloudDownload size={26} className="animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/25 px-2.5 py-0.5 rounded-full">
                    Instant Delivery
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-400/90 text-gray-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check size={10} strokeWidth={3} /> Fulfilled
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black italic tracking-tight text-white mt-1">
                  Digital Asset Vault
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={triggerAllDownloads}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer shrink-0"
            >
              <RefreshCw size={14} className={triggerCount > 0 ? "animate-spin" : ""} />
              <span>Re-Download All</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Automated Download Notification Banner */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl flex items-start gap-3.5">
            <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm shrink-0 mt-0.5">
              <ShieldCheck size={18} />
            </div>
            <div className="space-y-0.5 text-xs">
              <p className="font-extrabold text-emerald-900 dark:text-emerald-200">
                {autoDownloadTriggered 
                  ? "Instant download initiated directly to your device." 
                  : "Your files are ready for immediate download."}
              </p>
              <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                Hosted with high-speed AWS cloud storage. If your browser blocked the automatic multi-file popups, use the direct buttons below.
              </p>
            </div>
          </div>

          {/* List of Digital Items */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Purchased Assets & Licenses ({digitalItems.length})
            </h4>

            {digitalItems.map((item) => {
              const fileUrl = item.digitalFileUrl || item.image;
              const formatInfo = getFormatDetails(item.digitalFormat, fileUrl);
              const licenseKey = generateLicenseKey(item.productId);
              const isDownloading = !!downloadingMap[item.productId];
              const isCompleted = !!completedMap[item.productId];
              const isKeyCopied = !!copiedKeyMap[item.productId];
              const isUrlCopied = !!copiedUrlMap[item.productId];
              const filename = getDigitalFileName(fileUrl, item.name, item.digitalFormat);

              return (
                <motion.div
                  key={item.productId}
                  layout
                  className="p-5 bg-gray-50/70 dark:bg-gray-800/40 border border-gray-150 dark:border-gray-800 rounded-3xl hover:border-orange-300 dark:hover:border-orange-800/70 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-orange-600">{formatInfo.icon}</span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border flex items-center gap-1 ${formatInfo.badgeColor}`}>
                            {formatInfo.icon}
                            {formatInfo.label}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                            {filename}
                          </span>
                        </div>
                        <h5 className="text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                          {item.name}
                        </h5>
                        {item.sellerName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Created by <strong className="text-gray-700 dark:text-gray-300">{item.sellerName}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Main Download Button */}
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={isDownloading}
                      className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0 active:scale-95 ${
                        isCompleted
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                          : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/25"
                      }`}
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : isCompleted ? (
                        <>
                          <Check size={15} strokeWidth={3} />
                          <span>Downloaded (Click to Re-save)</span>
                        </>
                      ) : (
                        <>
                          <Download size={15} />
                          <span>Download File</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* License Key & Secondary Links */}
                  <div className="pt-3 border-t border-gray-200/70 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-mono bg-white dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 w-fit">
                      <span className="text-gray-400 dark:text-gray-500 font-sans text-[10px] font-extrabold uppercase">
                        License:
                      </span>
                      <span className="font-black text-gray-850 dark:text-gray-200 tracking-wider">
                        {licenseKey}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyLicenseKey(licenseKey, item.productId)}
                        className="text-gray-400 hover:text-orange-600 transition-colors ml-1 p-0.5 cursor-pointer"
                        title="Copy License Key"
                      >
                        {isKeyCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => copyDirectLink(fileUrl, item.productId)}
                        className="text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isUrlCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{isUrlCopied ? "Link Copied!" : "Copy Link"}</span>
                      </button>

                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink size={12} />
                        <span>Open in Tab</span>
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Backup Email & Account Notice */}
          <div className="p-4 bg-orange-50/40 dark:bg-orange-950/20 rounded-2xl border border-orange-100/60 dark:border-orange-900/30 text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
            <p className="font-semibold">
              🔒 <strong>Permanent Access:</strong> These assets and license keys have been saved to your account. You can return and re-download them anytime from your Orders page.
            </p>
            {userEmail && (
              <p className="text-[11px] text-gray-500 dark:text-gray-500">
                A receipt containing your license tokens and download links was also dispatched to <strong>{userEmail}</strong>.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DigitalAssetVault;
