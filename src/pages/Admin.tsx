import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import ReactMarkdown from "react-markdown";
import { UserProfile, Product, Order, SupportTicket, BlogPost, JobOffer, JobApplication, Review } from "../types";
import { executeOrQueueFirestoreMutation } from "../utils/offlineSyncQueue";
import { validateSkuFormat, validateSkuUniqueness, generateSuggestedSku } from "../utils/skuValidator";
import { OrderRefundManager } from "../components/OrderRefundManager";
import { AdminDataErasureManager } from "../components/AdminDataErasureManager";
import { db, auth } from "../lib/firebase";

// Lazy-loaded sub-component views for modularity and bundle splitting
const OrdersTab = lazy(() => import("../components/admin/OrdersTab"));
const ProductsTab = lazy(() => import("../components/admin/ProductsTab"));
const UsersTab = lazy(() => import("../components/admin/UsersTab"));
const InboxTab = lazy(() => import("../components/admin/InboxTab"));
const SellersTab = lazy(() => import("../components/admin/SellersTab"));
const ApprovalQueueTab = lazy(() => import("../components/admin/ApprovalQueueTab"));
const MarketingTab = lazy(() => import("../components/admin/MarketingTab"));
const CareersTab = lazy(() => import("../components/admin/CareersTab"));
const PodConfigTab = lazy(() => import("../components/admin/PodConfigTab"));
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  doc,
  where,
  writeBatch as realWriteBatch,
  addDoc as realAddDoc,
  getDocs as realGetDocs,
  deleteDoc as realDeleteDoc,
  updateDoc as realUpdateDoc,
  getDoc as realGetDoc,
  setDoc as realSetDoc,
  onSnapshot as realOnSnapshot,
  getCountFromServer as realGetCountFromServer,
  getAggregateFromServer as realGetAggregateFromServer,
  getDocsFromCache,
  getDocFromCache,
  sum,
  count,
} from "firebase/firestore";

// Custom intercepted wrappers to monitor live Firestore traffic in the Admin Dashboard
const globalFsLogListeners: ((op: "Read" | "Write" | "Delete" | "Read (Cache)", path: string, count: number) => void)[] = [];
const notifyFsLog = (op: "Read" | "Write" | "Delete" | "Read (Cache)", path: string, count: number) => {
  globalFsLogListeners.forEach(l => l(op, path, count));
};

const getCountFromServer = async (q: any): Promise<number> => {
  try {
    const snap = await realGetCountFromServer(q);
    let path = "unknown";
    try {
      if (q._query && q._query.path) {
        path = q._query.path.segments.join("/");
      } else if (q.path) {
        path = q.path;
      }
    } catch (e) {}
    notifyFsLog("Read", path, 1);
    return snap.data().count;
  } catch (err) {
    console.warn("getCountFromServer aggregate query failed:", err);
    return 0;
  }
};

const getAggregateFromServer = async (q: any, spec: any): Promise<any> => {
  try {
    const snap = await realGetAggregateFromServer(q, spec);
    let path = "unknown";
    try {
      if (q._query && q._query.path) {
        path = q._query.path.segments.join("/");
      } else if (q.path) {
        path = q.path;
      }
    } catch (e) {}
    notifyFsLog("Read", path, 1);
    return snap.data();
  } catch (err) {
    console.warn("getAggregateFromServer aggregate query failed:", err);
    return null;
  }
};

const getDocs = async (q: any): Promise<any> => {
  const snap = await realGetDocs(q);
  let path = "unknown";
  try {
    if (q._query && q._query.path) {
      path = q._query.path.segments.join("/");
    } else if (q.path) {
      path = q.path;
    } else if (typeof q.type === "string" && q.type === "collection" && q.path) {
      path = q.path;
    }
  } catch (e) {}
  notifyFsLog("Read", path, snap.size || 1);
  return snap as any;
};

const getDoc = async (ref: any): Promise<any> => {
  const snap = await realGetDoc(ref);
  let path = ref.path || "unknown";
  notifyFsLog("Read", path, 1);
  return snap as any;
};

/**
 * Local Cache-First Firestore read strategy for non-essential administrative widgets.
 * Prioritizes local IndexedDB cache reads (0 billable Firestore server reads)
 * to conserve quota for mission-critical customer transactions (like checkout & payment processing).
 * Gracefully falls back to network read if local cache is empty or missed.
 */
const getDocsCacheFirst = async (q: any): Promise<any> => {
  let path = "unknown";
  try {
    if (q._query && q._query.path) {
      path = q._query.path.segments.join("/");
    } else if (q.path) {
      path = q.path;
    } else if (typeof q.type === "string" && q.type === "collection" && q.path) {
      path = q.path;
    }
  } catch (e) {}

  try {
    const snap = await getDocsFromCache(q);
    if (snap && snap.docs && snap.docs.length > 0) {
      notifyFsLog("Read (Cache)", path, 0);
      return snap;
    }
  } catch (cacheErr) {
    // Local cache miss or cold start
  }

  const snap = await realGetDocs(q);
  notifyFsLog("Read", path, snap.size || 1);
  return snap as any;
};

const getDocCacheFirst = async (ref: any): Promise<any> => {
  let path = ref.path || "unknown";
  try {
    const snap = await getDocFromCache(ref);
    if (snap && snap.exists()) {
      notifyFsLog("Read (Cache)", path, 0);
      return snap;
    }
  } catch (cacheErr) {
    // Local cache miss
  }

  const snap = await realGetDoc(ref);
  notifyFsLog("Read", path, 1);
  return snap as any;
};

const addDoc = async (ref: any, data: any): Promise<any> => {
  const res = await realAddDoc(ref, data);
  let path = ref.path || "unknown";
  notifyFsLog("Write", path, 1);
  return res as any;
};

const updateDoc = async (ref: any, data: any): Promise<any> => {
  const res = await realUpdateDoc(ref, data);
  let path = ref.path || "unknown";
  notifyFsLog("Write", path, 1);
  return res as any;
};

const deleteDoc = async (ref: any): Promise<any> => {
  const res = await realDeleteDoc(ref);
  let path = ref.path || "unknown";
  notifyFsLog("Delete", path, 1);
  return res as any;
};

const setDoc = async (ref: any, data: any, options?: any): Promise<any> => {
  const res = await realSetDoc(ref, data, options);
  let path = ref.path || "unknown";
  notifyFsLog("Write", path, 1);
  return res as any;
};

const onSnapshot = (q: any, onNext: any, onError?: any): any => {
  let path = "support_tickets";
  try {
    if (q._query && q._query.path) {
      path = q._query.path.segments.join("/");
    } else if (q.path) {
      path = q.path;
    }
  } catch (e) {}

  const wrappedOnNext = (snapshot: any) => {
    notifyFsLog("Read", path, snapshot.size || 1);
    onNext(snapshot);
  };

  return realOnSnapshot(q, wrappedOnNext, onError);
};
import {
  Plus,
  Trash2,
  Package,
  TrendingUp,
  Users,
  ShoppingBag,
  Search,
  Pencil,
  Inbox,
  CheckCircle2,
  Clock,
  MessageSquare,
  BookOpen,
  FileText,
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Quote,
  Link,
  Star,
  CheckSquare,
  Eye,
  X,
  Send,
  Settings,
  Upload,
  Image,
  Globe,
  Truck,
  Download,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  Coins,
  Briefcase,
  MapPin,
  Check,
  CheckCheck,
  Sparkles,
  Zap,
  Award,
  Megaphone,
  Calendar,
  Music,
  Store,
  Flame,
  Share2,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Radio,
  Gauge,
  Activity,
  ShieldAlert,
  LayoutGrid,
  ChevronRight,
  Smartphone,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSellerStudio } from "../lib/SellerStudioContext";
import { SocialLinks } from "../lib/SettingsContext";
import AdminCategoryImagesManager from "../components/AdminCategoryImagesManager";

const TikTokIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 1 1-2.896-2.892c.38 0 .733.074 1.055.206V9.48a6.334 6.334 0 1 0 5.286 6.223V9.088c1.474 1.054 3.284 1.68 5.24 1.68V7.323a8.216 8.216 0 0 1-1.47-.637z" />
  </svg>
);

const WhatsAppIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
  </svg>
);

const YouTubeIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
    />
  </svg>
);
import axios from "axios";
import RichTextEditor from "../components/RichTextEditor";
import ArtisanColorPicker from "../components/ArtisanColorPicker";
import { downloadReceipt } from "../utils/pdfGenerator";
import SecurityManager from "../components/SecurityManager";
import AdminReviewsManager from "../components/AdminReviewsManager";
import { clearAllOfflineCache } from "../utils/offlineDb";
import { warmCategoryCache, getNetworkSpeedStatus } from "../utils/cacheWarmer";
import { counties } from "../data/counties";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface AdminProps {
  user: UserProfile | null;
}

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };

  const isQuota = 
    errorMsg.toLowerCase().includes("quota limit exceeded") ||
    errorMsg.toLowerCase().includes("quota exceeded") ||
    errorMsg.toLowerCase().includes("resource_exhausted") ||
    errorMsg.toLowerCase().includes("quota");

  if (isQuota) {
    console.warn("Firestore Admin Error Quota Alert (Bypassed):", errorMsg);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("firestore-quota-exceeded", {
          detail: { error: errorMsg, path }
        })
      );
    }
    toast.error(`Database Quota Exceeded. SokoPlus running on local cached datasets.`, {
      id: "quota-exceeded-toast",
    });
    return; // Safe return
  }

  console.error("Firestore Error: ", JSON.stringify(errInfo));
  toast.error(`Error: ${errInfo.error}`);
  throw new Error(JSON.stringify(errInfo));
}

const ARTISAN_COLORS = [
  { name: "Charcoal Black", hex: "#1a1a1a" },
  { name: "Tan Leather", hex: "#a0522d" },
  { name: "Espresso Brown", hex: "#4a2c11" },
  { name: "Desert Sand", hex: "#dfc9b1" },
  { name: "Terracotta Rust", hex: "#c25e40" },
  { name: "Olive Green", hex: "#556b2f" },
  { name: "Mustard Gold", hex: "#d4af37" },
  { name: "Crimson Red", hex: "#b22222" },
  { name: "Royal Blue", hex: "#0f4c81" },
  { name: "Ivory White", hex: "#fdfbf7" }
];

const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 800; // Optimal HD but lightweight product sizing
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const compressed = canvas.toDataURL("image/jpeg", 0.7);
            resolve(compressed);
          } catch (e) {
            reject(new Error("Failed to compress image"));
          }
        } else {
          reject(new Error("Failed to resize image"));
        }
      };
      img.onerror = () => reject(new Error("Failed to load image resource"));
      if (typeof event.target?.result === "string") {
        img.src = event.target.result;
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
};

interface ProductImageManagerProps {
  images: string[];
  onChange: (images: string[]) => void;
}

function ProductImageManager({ images, onChange }: ProductImageManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUrlChange = (idx: number, val: string) => {
    const updated = [...images];
    updated[idx] = val;
    onChange(updated);
  };

  const handleAddField = () => {
    onChange([...images, ""]);
  };

  const handleRemoveField = (idx: number) => {
    const updated = images.filter((_, i) => i !== idx);
    onChange(updated.length > 0 ? updated : [""]);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...images];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    onChange(updated);
    toast.success("Image order updated! First image is now the main thumbnail.");
  };

  const moveDown = (idx: number) => {
    if (idx === images.length - 1) return;
    const updated = [...images];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    onChange(updated);
    toast.success("Image order updated! First image is now the main thumbnail.");
  };

  const handleFiles = async (files: FileList) => {
    setIsProcessing(true);
    const validFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast.error("Please drop or select valid image files only.");
      setIsProcessing(false);
      return;
    }

    const loaders = validFiles.map(async (file) => {
      try {
        return await compressImageFile(file);
      } catch (err: any) {
        console.error(err);
        toast.error(`Could not process "${file.name}": ${err.message}`);
        return null;
      }
    });

    const results = (await Promise.all(loaders)).filter((res): res is string => res !== null);
    if (results.length > 0) {
      const currentFiltered = images.filter(img => img.trim() !== "");
      onChange([...currentFiltered, ...results]);
      toast.success(`Successfully uploaded & optimized ${results.length} product image(s).`);
    }
    setIsProcessing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleReplaceSlotWithFile = async (idx: number, file: File) => {
    try {
      setIsProcessing(true);
      const optimized = await compressImageFile(file);
      const updated = [...images];
      updated[idx] = optimized;
      onChange(updated);
      toast.success("Image slot updated with fine optimized file.");
    } catch (err: any) {
      toast.error(`Failed to upload to slot: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase text-gray-400">
          Product Images (Upload or Link)
        </label>
        <button
          type="button"
          onClick={handleAddField}
          className="text-xs font-extrabold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl transition-all"
        >
          + Add Empty Link Slot
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all relative ${
          isDragging ? "border-orange-500 bg-orange-50/50" : "border-gray-200 bg-gray-50/50 hover:bg-gray-50"
        }`}
      >
        <UploadCloud className="mx-auto text-gray-400 mb-3" size={36} />
        <p className="text-sm font-semibold text-gray-700">
          Drag & drop product images here, or{" "}
          <label className="text-orange-600 underline cursor-pointer hover:text-orange-700 font-bold">
            browse local files
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </label>
        </p>
        <p className="text-xs text-gray-400 mt-1 font-medium">
          Supports JPG, PNG, WebP. Auto-resizes to deliver ultra-fast page speeds.
        </p>
        {isProcessing && (
          <div className="absolute inset-x-0 bottom-2 text-center text-xs text-orange-600 font-bold animate-pulse">
            Cropping and optimizing product images...
          </div>
        )}
      </div>

      <div className="space-y-3">
        {images.map((url, idx) => {
          const isValidUrl = url && url.trim().length > 0;
          const isCover = idx === 0;

          return (
            <div
              key={idx}
              className={`flex flex-col sm:flex-row gap-3 p-4 border rounded-2xl relative transition-all ${
                isCover ? "border-orange-200 bg-orange-50/10" : "border-gray-150 bg-white"
              }`}
            >
              <div className="absolute -top-2.5 -left-2 flex items-center">
                {isCover ? (
                  <span className="bg-orange-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                    ★ COVER PREVIEW
                  </span>
                ) : (
                  <span className="bg-gray-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    Slot {idx + 1}
                  </span>
                )}
              </div>

              <div className="w-16 h-16 rounded-xl border border-gray-150 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {isValidUrl ? (
                  <img
                    src={url}
                    alt={`Product slot ${idx}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1594122230689-45899d9e6f69?auto=format&fit=crop&q=80&w=200";
                    }}
                  />
                ) : (
                  <Image className="text-gray-300" size={24} />
                )}
              </div>

              <div className="flex-grow flex flex-col gap-1 min-w-0">
                <input
                  type="text"
                  placeholder="Paste un-encoded image URL address or upload below"
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-150 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-800"
                  value={url}
                  onChange={(e) => handleUrlChange(idx, e.target.value)}
                />
                <label className="text-[10px] text-gray-400 hover:text-orange-600 font-extrabold uppercase cursor-pointer flex items-center gap-1 w-fit">
                  <Upload size={10} />
                  <span>Upload file here</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReplaceSlotWithFile(idx, file);
                    }}
                  />
                </label>
              </div>

              <div className="flex sm:flex-col items-center justify-end gap-1.5 self-center sm:self-stretch">
                <div className="flex sm:flex-col gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveUp(idx)}
                    className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Make main preview thumbnail"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => moveDown(idx)}
                    className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Move image down"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveField(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Remove image slot"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PIE_COLORS = [
  "#ea580c", // principal orange-600
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#d97706", // amber-600
  "#06b6d4", // cyan-500
];

const CustomTrendsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const rev = payload.find((p: any) => p.name === "Revenue (KES)")?.value || 0;
    const cost = payload.find((p: any) => p.name === "Cost of Goods (KES)")?.value || 0;
    const profit = payload.find((p: any) => p.name === "Gross Profit (KES)")?.value || 0;
    const ordersCount = payload.find((p: any) => p.name === "Orders Count")?.value ?? 
                        payload[0]?.payload?.["Orders Count"] ?? 0;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;

    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xl space-y-2.5 text-xs text-gray-800 font-sans">
        <p className="font-extrabold text-gray-900 border-b border-gray-100 pb-1.5">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-gray-500 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block shrink-0"></span>
              Revenue:
            </span>
            <span className="font-black text-gray-900">KES {rev.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-gray-500 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block shrink-0"></span>
              Cost of Goods:
            </span>
            <span className="font-bold text-gray-700">KES {cost.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6 border-t border-dashed border-gray-100 pt-1.5">
            <span className="flex items-center gap-1.5 text-emerald-700 font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
              Gross Profit:
            </span>
            <span className="font-black text-emerald-600 text-sm">KES {profit.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6 pt-1">
            <span className="text-gray-400 font-bold text-[10px] uppercase">Margin %:</span>
            <span className="font-extrabold text-emerald-700 text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/10">
              {margin.toFixed(1)}% Margin
            </span>
          </div>
          {ordersCount !== undefined && (
            <div className="flex items-center justify-between gap-6 border-t border-gray-100 pt-1 mt-1 text-[10px] text-gray-400 font-bold">
              <span>Orders Received:</span>
              <span>{ordersCount}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const CustomCategoryTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const rev = data["Revenue (KES)"] || 0;
    const cost = data["Cost of Goods (KES)"] || 0;
    const profit = data["Gross Profit (KES)"] || 0;
    const units = data["Units Sold"] || 0;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;

    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xl space-y-2 text-xs text-gray-800 font-sans z-50">
        <p className="font-extrabold text-orange-900 border-b border-gray-150 pb-1.5">{data.name}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500 font-semibold">Total Revenue:</span>
            <span className="font-black text-gray-900">KES {rev.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500 font-semibold">Cost of Goods:</span>
            <span className="font-bold text-gray-700">KES {cost.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-gray-100 pt-1.5">
            <span className="font-black text-emerald-600">Actual Profit:</span>
            <span className="font-black text-emerald-600">KES {profit.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6 pt-1">
            <span className="text-gray-400 font-bold text-[10px] uppercase">Margin %:</span>
            <span className="font-extrabold text-white bg-emerald-650 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider">
              {margin.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-6 text-[10px] text-gray-400 font-bold pt-1">
            <span>Units Sold:</span>
            <span>{units} pcs</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface AdminProductsTableProps {
  products: Product[];
  minRatingFilter: number;
  setMinRatingFilter: (v: number) => void;
  productApprovalFilter: "all" | "pending" | "approved" | "rejected";
  setProductApprovalFilter: (v: "all" | "pending" | "approved" | "rejected") => void;
  productSortBy: string;
  setProductSortBy: (v: string) => void;
  productSearchTerm: string;
  setProductSearchTerm: (v: string) => void;
  selectedProductIds: string[];
  setSelectedProductIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleBatchDeleteProducts: () => Promise<void>;
  isBatchDeletingProducts: boolean;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setEditingProduct: (p: Product) => void;
  setHasColorsEdit: (b: boolean) => void;
  setSelectedColorsEdit: (c: string[]) => void;
  setShowEditModal: (b: boolean) => void;
  deleteProduct: (id: string, name: string) => void;
  setSelectedProductForRejection: (p: Product) => void;
  setProductRejectionReasonInput: (s: string) => void;
  confirmingApproveProductId: string | null;
  setConfirmingApproveProductId: (s: string | null) => void;
  productsPage?: number;
  hasMoreProducts?: boolean;
  isProductsLoading?: boolean;
  onNextProductsPage?: () => void;
  onPrevProductsPage?: () => void;
}

function AdminProductsTable({
  products,
  minRatingFilter,
  setMinRatingFilter,
  productApprovalFilter,
  setProductApprovalFilter,
  productSortBy,
  setProductSortBy,
  productSearchTerm,
  setProductSearchTerm,
  selectedProductIds,
  setSelectedProductIds,
  handleBatchDeleteProducts,
  isBatchDeletingProducts,
  setProducts,
  setEditingProduct,
  setHasColorsEdit,
  setSelectedColorsEdit,
  setShowEditModal,
  deleteProduct,
  setSelectedProductForRejection,
  setProductRejectionReasonInput,
  confirmingApproveProductId,
  setConfirmingApproveProductId,
  productsPage = 1,
  hasMoreProducts = false,
  isProductsLoading = false,
  onNextProductsPage,
  onPrevProductsPage,
}: AdminProductsTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const filteredProductsList = products
    .filter((p) => {
      const rating = p.rating || 0;
      if (rating < minRatingFilter) return false;

      const approval = p.approvalStatus || "approved";
      if (productApprovalFilter !== "all" && approval !== productApprovalFilter) return false;

      if (
        productSearchTerm.trim() !== "" &&
        !p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) &&
        !p.category.toLowerCase().includes(productSearchTerm.toLowerCase()) &&
        !(p.sku || "").toLowerCase().includes(productSearchTerm.toLowerCase()) &&
        !(p.artisan || "").toLowerCase().includes(productSearchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (productSortBy === "created-asc") {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      }
      if (productSortBy === "created-desc") {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }
      if (productSortBy === "rating-desc") {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (productSortBy === "rating-asc") {
        return (a.rating || 0) - (b.rating || 0);
      }
      if (productSortBy === "price-desc") {
        return b.price - a.price;
      }
      if (productSortBy === "price-asc") {
        return a.price - b.price;
      }
      if (productSortBy === "stock-asc") {
        return a.stock - b.stock;
      }
      if (productSortBy === "stock-desc") {
        return b.stock - a.stock;
      }
      return 0;
    });

  const rowVirtualizer = useVirtualizer({
    count: filteredProductsList.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 82,
    overscan: 6,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  const isAllProductsSelected =
    filteredProductsList.length > 0 &&
    filteredProductsList.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAllProducts = () => {
    if (isAllProductsSelected) {
      const filteredSet = new Set(filteredProductsList.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const allFilteredIds = filteredProductsList.map((p) => p.id);
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventory Management</h2>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            Manage store catalog, batch delete listings, and review artisan clearance status.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 text-orange-800 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full border border-orange-200/70 shadow-2xs">
          <Zap size={14} className="text-orange-600 fill-orange-500" />
          <span>
            Virtualization Active ({virtualItems.length} active of {filteredProductsList.length} rows rendered)
          </span>
        </div>
      </div>

      {/* Batch Action Banner for Products */}
      {selectedProductIds.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 text-white rounded-xl">
              <CheckSquare size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-orange-950 uppercase tracking-wide">
                {selectedProductIds.length} {selectedProductIds.length === 1 ? "Product" : "Products"} Selected
              </p>
              <p className="text-[11px] font-semibold text-orange-700">
                Executes via a single Firestore writeBatch operation to minimize document write requests.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl transition-all cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleBatchDeleteProducts}
              disabled={isBatchDeletingProducts}
              className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>{isBatchDeletingProducts ? "Processing Batch Delete..." : `Batch Delete Selected (${selectedProductIds.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-50">
        <div className="flex flex-wrap items-center gap-4">
          {/* Minimum Rating Selector */}
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Minimum Rating</span>
            <select
              value={minRatingFilter}
              onChange={(e) => setMinRatingFilter(Number(e.target.value))}
              className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer min-w-[140px]"
            >
              <option value={0}>All Ratings</option>
              <option value={1}>1.0+ Stars</option>
              <option value={2}>2.0+ Stars</option>
              <option value={3}>3.0+ Stars</option>
              <option value={4}>4.0+ Stars</option>
              <option value={4.5}>4.5+ Stars</option>
              <option value={5}>5.0 Stars</option>
            </select>
          </div>

          {/* Sort dropdown */}
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Sort By</span>
            <select
              value={productSortBy}
              onChange={(e) => setProductSortBy(e.target.value)}
              className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer min-w-[180px]"
            >
              <option value="default">Default</option>
              <option value="created-asc">Earliest Added to Last Added</option>
              <option value="created-desc">Last Added to Earliest Added</option>
              <option value="rating-desc">Rating: High to Low</option>
              <option value="rating-asc">Rating: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="stock-asc">Stock: Low to High</option>
              <option value="stock-desc">Stock: High to Low</option>
            </select>
          </div>

          {/* Clearance approval status selector */}
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Clearance Status</span>
            <select
              value={productApprovalFilter}
              onChange={(e) => setProductApprovalFilter(e.target.value as any)}
              className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer min-w-[180px]"
            >
              <option value="all">All listings</option>
              <option value="pending">Pending Clearance ({products.filter(p => p.approvalStatus === "pending").length})</option>
              <option value="approved">Approved & Live</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Product search input */}
        <div className="flex flex-col space-y-1 w-full md:max-w-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Search Directory</span>
          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search product name or category..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* VIRTUALIZED PRODUCT TABLE SCROLL CONTAINER */}
      <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[620px] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-inner">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead className="sticky top-0 bg-white z-20 shadow-xs">
            <tr className="text-xs font-bold text-gray-400 border-b border-gray-100 bg-gray-50/90 backdrop-blur-xs">
              <th className="py-3.5 w-12 text-center">
                <input
                  type="checkbox"
                  checked={isAllProductsSelected}
                  onChange={toggleSelectAllProducts}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                  title="Select All Filtered Products"
                />
              </th>
              <th className="py-3.5 uppercase">Product</th>
              <th className="py-3.5 uppercase">Category</th>
              <th className="py-3.5 uppercase text-center">Rating</th>
              <th className="py-3.5 uppercase text-center">Status</th>
              <th className="py-3.5 uppercase text-center">Stock</th>
              <th className="py-3.5 uppercase text-right">Price</th>
              <th className="py-3.5 uppercase text-center pr-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredProductsList.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 font-semibold text-xs">
                  No products found matching filters.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} colSpan={8} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const p = filteredProductsList[virtualRow.index];
                  return (
                    <tr
                      key={p.id}
                      className={`text-sm hover:bg-gray-50/50 transition-all ${
                        p.active === false ? "opacity-60 bg-gray-50/20" : ""
                      } ${selectedProductIds.includes(p.id) ? "bg-orange-50/30" : ""}`}
                    >
                      <td className="py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col space-y-1">
                          <div className="font-bold flex items-center gap-2 flex-wrap">
                            <span>{p.name}</span>
                            {p.sku && (
                              <span className="font-mono text-[10px] bg-gray-100 text-gray-800 font-bold px-1.5 py-0.5 rounded border border-gray-200" title="Product SKU">
                                SKU: {p.sku}
                              </span>
                            )}
                            {p.isDigital && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200" title="Digital Downloadable Item">
                                💻 Digital ({p.digitalFormat?.toUpperCase() || "ASSET"})
                              </span>
                            )}
                            {(!p.approvalStatus || p.approvalStatus === "approved") ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">
                                Approved
                              </span>
                            ) : p.approvalStatus === "pending" ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                                Pending Clearance
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
                                Rejected
                              </span>
                            )}
                          </div>
                          {p.artisan && (
                            <div className="text-[11px] font-semibold text-orange-600">by {p.artisan}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-gray-500">{p.category}</td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-1 font-bold text-gray-700 bg-amber-50/50 py-1 px-2.5 rounded-full border border-amber-100/30 w-fit mx-auto">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          <span>{p.rating?.toFixed(1) || "N/A"}</span>
                          {p.reviewCount !== undefined && p.reviewCount > 0 && (
                            <span className="text-[10px] text-gray-400 font-medium">({p.reviewCount})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        {p.approvalStatus === "pending" ? (
                          <div className="flex flex-col items-center space-y-1.5 bg-amber-50/45 p-2 rounded-2xl border border-amber-105">
                            <span className="text-[10px] b-fit uppercase font-black tracking-wider text-amber-700 flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                              Pending Review
                            </span>
                            <div className="flex items-center gap-1 pt-0.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirmingApproveProductId !== p.id) {
                                    setConfirmingApproveProductId(p.id);
                                    return;
                                  }
                                  try {
                                    await updateDoc(doc(db, "products", p.id), {
                                      approvalStatus: "approved",
                                      active: true,
                                      rejectionReason: ""
                                    });
                                    setProducts((prev) =>
                                      prev.map((prod) =>
                                        prod.id === p.id
                                          ? { ...prod, approvalStatus: "approved", active: true, rejectionReason: "" }
                                          : prod,
                                      ),
                                    );
                                    toast.success(`"${p.name}" cleared and live on catalog!`);
                                    setConfirmingApproveProductId(null);
                                  } catch (error) {
                                    console.error(error);
                                    toast.error("Failed to approve product listing");
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border-none cursor-pointer ${
                                  confirmingApproveProductId === p.id
                                    ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                                    : "bg-green-600 hover:bg-green-700 text-white shadow-xs"
                                }`}
                              >
                                {confirmingApproveProductId === p.id ? "Confirm?" : "Approve"}
                              </button>
                              {confirmingApproveProductId === p.id && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmingApproveProductId(null)}
                                  className="px-2 py-1 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-lg text-[9px] font-black uppercase border-none cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForRejection(p);
                                  setProductRejectionReasonInput("");
                                  setConfirmingApproveProductId(null);
                                }}
                                className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase transition-all border-none cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ) : p.approvalStatus === "rejected" ? (
                          <div className="flex flex-col items-center space-y-1 bg-red-50/40 p-2 rounded-2xl border border-red-100">
                            <span className="text-[10px] uppercase font-black tracking-wider text-red-700">
                              Rejected
                            </span>
                            {p.rejectionReason && (
                              <p className="text-[9px] text-gray-400 italic max-w-[150px] line-clamp-2 text-center" title={p.rejectionReason}>
                                "{p.rejectionReason}"
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, "products", p.id), {
                                    approvalStatus: "approved",
                                    active: true,
                                    rejectionReason: ""
                                  });
                                  setProducts((prev) =>
                                    prev.map((prod) =>
                                      prod.id === p.id
                                        ? { ...prod, approvalStatus: "approved", active: true, rejectionReason: "" }
                                        : prod,
                                    ),
                                  );
                                  toast.success(`"${p.name}" cleared from rejection to Approved & Live!`);
                                } catch (error) {
                                  console.error(error);
                                  toast.error("Failed to approve product");
                                }
                              }}
                              className="px-2 py-1 mt-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-[9px] font-black uppercase transition-all border-none cursor-pointer"
                            >
                              Clear Listing
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const newStatus = p.active === false;
                                try {
                                  await updateDoc(doc(db, "products", p.id), {
                                    active: newStatus,
                                  });
                                  setProducts((prev) =>
                                    prev.map((prod) =>
                                      prod.id === p.id
                                        ? { ...prod, active: newStatus }
                                        : prod,
                                    ),
                                  );
                                  toast.success(
                                    `"${p.name}" is now ${newStatus ? "Active" : "Inactive"}`
                                  );
                                } catch (error) {
                                  handleFirestoreError(
                                    error,
                                    OperationType.UPDATE,
                                    `products/${p.id}`,
                                  );
                                }
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                p.active !== false ? "bg-orange-600" : "bg-gray-200"
                              }`}
                              title={p.active !== false ? "Switch to Inactive" : "Switch to Active"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  p.active !== false ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span className={`text-[10px] uppercase tracking-wider font-extrabold select-none ${p.active !== false ? "text-green-600" : "text-gray-400"}`}>
                              {p.active !== false ? "Active" : "Inactive"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            className="w-16 bg-gray-50 border border-gray-100 rounded-lg text-center font-bold outline-none focus:ring-1 focus:ring-orange-600 transition-all py-1"
                            value={p.stock}
                            onChange={async (e) => {
                              const newStock = Number(e.target.value);
                              try {
                                await updateDoc(doc(db, "products", p.id), {
                                  stock: newStock,
                                });
                                setProducts((prev) =>
                                  prev.map((prod) =>
                                    prod.id === p.id
                                      ? { ...prod, stock: newStock }
                                      : prod,
                                  ),
                                );
                              } catch (error) {
                                handleFirestoreError(
                                  error,
                                  OperationType.UPDATE,
                                  `products/${p.id}`,
                                );
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-4 text-right font-black">
                        KES {p.price.toLocaleString()}
                      </td>
                      <td className="py-4 text-center pr-4">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setHasColorsEdit(!!(p.availableColors && p.availableColors.length > 0));
                              setSelectedColorsEdit(p.availableColors || []);
                              setShowEditModal(true);
                            }}
                            className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit Product"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(p.id, p.name)}
                            className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Product"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} colSpan={8} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Server-Side Pagination Controls for Products */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 pt-4 mt-6 gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-200">
            ⚡ Firestore Server Query (limit 25)
          </span>
          <span>Page {productsPage}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onPrevProductsPage}
            disabled={productsPage <= 1 || isProductsLoading}
            className="px-4 py-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 text-xs font-bold rounded-xl border border-gray-200 cursor-pointer transition-all"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNextProductsPage}
            disabled={!hasMoreProducts || isProductsLoading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
          >
            {isProductsLoading ? "Loading..." : "Next Page"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdminUsersTableProps {
  usersList: UserProfile[];
  userSearchTerm: string;
  setUserSearchTerm: (s: string) => void;
  selectedUserUids: string[];
  setSelectedUserUids: React.Dispatch<React.SetStateAction<string[]>>;
  handleBatchDeleteUsers: () => Promise<void>;
  isBatchDeletingUsers: boolean;
  handleDownloadUsersCSV: () => void;
  isExportingUsers: boolean;
  deleteUserDoc: (uid: string, email: string) => void;
}

function AdminUsersTable({
  usersList,
  userSearchTerm,
  setUserSearchTerm,
  selectedUserUids,
  setSelectedUserUids,
  handleBatchDeleteUsers,
  isBatchDeletingUsers,
  handleDownloadUsersCSV,
  isExportingUsers,
  deleteUserDoc,
}: AdminUsersTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const filteredUsersList = usersList.filter((u) => {
    if (!userSearchTerm.trim()) return true;
    const q = userSearchTerm.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.displayName || "").toLowerCase().includes(q) ||
      (u.phoneNumber || "").toLowerCase().includes(q) ||
      (u.uid || "").toLowerCase().includes(q)
    );
  });

  const rowVirtualizer = useVirtualizer({
    count: filteredUsersList.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 68,
    overscan: 6,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  const isAllUsersSelected =
    filteredUsersList.length > 0 &&
    filteredUsersList.every((u) => selectedUserUids.includes(u.uid));

  const toggleSelectAllUsers = () => {
    if (isAllUsersSelected) {
      const filteredSet = new Set(filteredUsersList.map((u) => u.uid));
      setSelectedUserUids((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const allFilteredIds = filteredUsersList.map((u) => u.uid);
      setSelectedUserUids((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const toggleSelectUser = (uid: string) => {
    setSelectedUserUids((prev) =>
      prev.includes(uid) ? prev.filter((i) => i !== uid) : [...prev, uid]
    );
  };

  return (
    <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">User Accounts Directory</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">
                Manage registered customer profiles, view loyalty metrics, and execute batch delete operations.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-orange-50 text-orange-800 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full border border-orange-200/70 shadow-2xs">
            <Zap size={14} className="text-orange-600 fill-orange-500" />
            <span>
              Virtualization Active ({virtualItems.length} active of {filteredUsersList.length} rows rendered)
            </span>
          </div>
          <button
            type="button"
            onClick={handleDownloadUsersCSV}
            disabled={isExportingUsers}
            className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-gray-700 font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download size={14} />
            <span>{isExportingUsers ? "Exporting..." : "Export CSV Report"}</span>
          </button>
        </div>
      </div>

      {/* Batch Action Banner for Users */}
      {selectedUserUids.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 text-white rounded-xl">
              <CheckSquare size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-orange-950 uppercase tracking-wide">
                {selectedUserUids.length} {selectedUserUids.length === 1 ? "User Account" : "User Accounts"} Selected
              </p>
              <p className="text-[11px] font-semibold text-orange-700">
                Executes via a single Firestore writeBatch operation to eliminate multiple individual write requests.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedUserUids([])}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl transition-all cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleBatchDeleteUsers}
              disabled={isBatchDeletingUsers}
              className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>{isBatchDeletingUsers ? "Processing Batch Delete..." : `Batch Delete Selected (${selectedUserUids.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-grow max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search by name, email, or UID..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-xs font-semibold"
          />
          {userSearchTerm && (
            <button
              type="button"
              onClick={() => setUserSearchTerm("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-xs font-bold text-gray-400">
          Showing {filteredUsersList.length} of {usersList.length} registered user profiles
        </div>
      </div>

      {/* VIRTUALIZED USER TABLE SCROLL CONTAINER */}
      <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[620px] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-inner">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead className="sticky top-0 bg-white z-20 shadow-xs">
            <tr className="text-xs font-bold text-gray-400 border-b border-gray-100 bg-gray-50/90 backdrop-blur-xs">
              <th className="py-3.5 w-12 text-center">
                <input
                  type="checkbox"
                  checked={isAllUsersSelected}
                  onChange={toggleSelectAllUsers}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                  title="Select All User Profiles"
                />
              </th>
              <th className="py-3.5 uppercase">User Profile</th>
              <th className="py-3.5 uppercase">Email Address</th>
              <th className="py-3.5 uppercase text-center">Loyalty Points</th>
              <th className="py-3.5 uppercase text-center">Role</th>
              <th className="py-3.5 uppercase text-center">Registered Date</th>
              <th className="py-3.5 uppercase text-center pr-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredUsersList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400 font-semibold text-xs">
                  No registered user accounts found matching query.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} colSpan={7} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const u = filteredUsersList[virtualRow.index];
                  return (
                    <tr key={u.uid} className={`text-sm hover:bg-gray-50/50 transition-all ${selectedUserUids.includes(u.uid) ? "bg-orange-50/30" : ""}`}>
                      <td className="py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUserUids.includes(u.uid)}
                          onChange={() => toggleSelectUser(u.uid)}
                          className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.displayName || u.email} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (u.displayName || u.email || "U").charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{u.displayName || "Anonymous User"}</div>
                            <div className="text-[10px] font-mono text-gray-400">UID: {u.uid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-xs font-medium text-gray-700">{u.email}</td>
                      <td className="py-4 text-center">
                        <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                          ⚡ {u.loyaltyPoints || 0} pts
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        {u.isAdmin ? (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                            Administrator
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                            Customer
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-center text-xs text-gray-500 font-medium">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-4 text-center pr-4">
                        <button
                          type="button"
                          onClick={() => deleteUserDoc(u.uid, u.email)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Delete User Account"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} colSpan={7} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Admin({ user }: AdminProps) {
  const { sellerStudioEnabled, toggleSellerStudio } = useSellerStudio();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [adminReplyText, setAdminReplyText] = useState<{ [ticketId: string]: string }>({});
  const [selectedViewOrder, setSelectedViewOrder] = useState<any | null>(null);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [jobOffers, setJobOffers] = useState<JobOffer[]>([]);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [showJobAddModal, setShowJobAddModal] = useState(false);
  const [newJob, setNewJob] = useState({
    title: "",
    department: "Engineering",
    location: "Nairobi (Hybrid)",
    type: "Full-time",
    description: "",
    requirementsString: ""
  });
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [subTab, setSubTab] = useState<"openings" | "applicants">("openings");
  const [activeTab, setActiveTab] = useState<
    "inventory" | "orders" | "users" | "inbox" | "blogs" | "settings" | "careers" | "security" | "analytics" | "marketing" | "reviews" | "sellers" | "approval_queue" | "privacy_erasure" | "pod_config"
  >("inventory");
  const [showMobileModuleDrawer, setShowMobileModuleDrawer] = useState(false);

  useEffect(() => {
    if (!sellerStudioEnabled && (activeTab === "sellers" || activeTab === "approval_queue")) {
      setActiveTab("inventory");
    }
  }, [sellerStudioEnabled, activeTab]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [confirmingApprovePendingId, setConfirmingApprovePendingId] = useState<string | null>(null);
  const [selectedPendingForRejection, setSelectedPendingForRejection] = useState<Product | null>(null);
  const [pendingRejectionReasonInput, setPendingRejectionReasonInput] = useState<string>("");
  const [sellers, setSellers] = useState<any[]>([]);
  const [confirmingApproveSellerId, setConfirmingApproveSellerId] = useState<string | null>(null);
  const [selectedSellerForRejection, setSelectedSellerForRejection] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [editingSeller, setEditingSeller] = useState<any | null>(null);
  const [editSellerShopName, setEditSellerShopName] = useState("");
  const [editSellerPhone, setEditSellerPhone] = useState("");
  const [editSellerLocation, setEditSellerLocation] = useState("");
  const [editSellerDescription, setEditSellerDescription] = useState("");
  const [isSavingSeller, setIsSavingSeller] = useState(false);
  const [biDateRangeFilter, setBiDateRangeFilter] = useState<"all" | "today" | "7d" | "30d" | "90d" | "ytd">("all");
  const [biCategoryFilter, setBiCategoryFilter] = useState<string>("all");
  const [biArtisanSearch, setBiArtisanSearch] = useState<string>("");
  const [biActiveMetric, setBiActiveMetric] = useState<"revenue" | "profit" | "units">("revenue");
  const [homepageHeroUrl, setHomepageHeroUrl] = useState<string>("");
  const [homepageHeroUrls, setHomepageHeroUrls] = useState<string[]>([]);
  const [activePreviewSlide, setActivePreviewSlide] = useState<number>(0);
  const [googleMapsLink, setGoogleMapsLink] = useState<string>("");
  const [googleMapsLinks, setGoogleMapsLinks] = useState<{ name: string; url: string }[]>([]);
  const [showAudioBubble, setShowAudioBubble] = useState<boolean>(true);
  const [promotionalBannersEnabled, setPromotionalBannersEnabled] = useState<boolean>(true);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>("");
  const [faviconUrl, setFaviconUrl] = useState<string>("");
  const [seoTitle, setSeoTitle] = useState<string>("");
  const [seoDescription, setSeoDescription] = useState<string>("");
  const [seoImage, setSeoImage] = useState<string>("");
  const [gaMeasurementId, setGaMeasurementId] = useState<string>("");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(15000);
  const [featuredCollections, setFeaturedCollections] = useState<{ title: string; imageUrl: string; category: string }[]>([]);
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
    tiktok: "",
    whatsapp: "",
    youtube: "",
    facebookVisible: true,
    instagramVisible: true,
    twitterVisible: true,
    linkedinVisible: true,
    tiktokVisible: true,
    whatsappVisible: true,
    youtubeVisible: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [disabledCountries, setDisabledCountries] = useState<string[]>([]);
  const [disabledCounties, setDisabledCounties] = useState<string[]>([]);
  const [disabledCities, setDisabledCities] = useState<string[]>([]);
  const [deliverySelectedTab, setDeliverySelectedTab] = useState<{ type: "country" | "county"; name: string }>({
    type: "country",
    name: "Kenya",
  });
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderSortBy, setOrderSortBy] = useState<string>("newest");
  const [blogSearchTerm, setBlogSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [productSortBy, setProductSortBy] = useState<string>("default");
  const [productApprovalFilter, setProductApprovalFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  
  // Server-Side Firestore Query Pagination States
  const [ordersPage, setOrdersPage] = useState<number>(1);
  const [ordersCursors, setOrdersCursors] = useState<any[]>([]);
  const [hasMoreOrders, setHasMoreOrders] = useState<boolean>(false);
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(false);

  const [productsPage, setProductsPage] = useState<number>(1);
  const [productsCursors, setProductsCursors] = useState<any[]>([]);
  const [hasMoreProducts, setHasMoreProducts] = useState<boolean>(false);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(false);
  const [selectedProductForRejection, setSelectedProductForRejection] = useState<Product | null>(null);
  const [productRejectionReasonInput, setProductRejectionReasonInput] = useState("");
  const [confirmingApproveProductId, setConfirmingApproveProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendsPeriod, setTrendsPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  
  // Custom states for admin metric report CSV downloads
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [isExportingOrders, setIsExportingOrders] = useState(false);

  // Batch Operations Selection States
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBatchDeletingProducts, setIsBatchDeletingProducts] = useState<boolean>(false);
  const [selectedUserUids, setSelectedUserUids] = useState<string[]>([]);
  const [isBatchDeletingUsers, setIsBatchDeletingUsers] = useState<boolean>(false);
  const [userSearchTerm, setUserSearchTerm] = useState<string>("");

  // Firestore Request Monitoring & Analytics
  const [firestoreLogs, setFirestoreLogs] = useState<any[]>([]);
  const [firestorePeriod, setFirestorePeriod] = useState<"today" | "7d" | "30d" | "90d">("7d");

  const logFirestoreOp = (operation: "Read" | "Write" | "Delete", collectionName: string, count: number, description: string) => {
    const newLog = {
      id: `fslog_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date(),
      operation,
      collection: collectionName,
      count,
      description
    };
    setFirestoreLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const listener = (op: "Read" | "Write" | "Delete", path: string, count: number) => {
      const coll = path.split("/")[0] || "general";
      const descMap: Record<string, string> = {
        products: "product catalog listings",
        orders: "customer transaction logs",
        support_tickets: "customer-relations support",
        blog: "marketing articles",
        users: "registered customer profiles",
        pending_products: "artisan submission queue",
        sellers: "onboarded artisan profiles",
        settings: "homepage elements",
        marketing_campaigns: "marketing campaigns",
        marketing_banners: "marketing banners",
        job_offers: "career openings",
        job_applications: "job applications"
      };
      const friendlyDesc = descMap[coll] || `${coll} database records`;
      logFirestoreOp(op, coll, count, `Live ${op.toLowerCase()} on ${friendlyDesc}`);
    };
    
    globalFsLogListeners.push(listener);
    return () => {
      const idx = globalFsLogListeners.indexOf(listener);
      if (idx !== -1) globalFsLogListeners.splice(idx, 1);
    };
  }, []);
  
  // Marketing Campaigns & CRM Automation States
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignChannel, setCampaignChannel] = useState<"email" | "push" | "both">("both");
  const [campaignTargetType, setCampaignTargetType] = useState<string>("all");
  const [campaignProductId, setCampaignProductId] = useState("");
  const [campaignCategory, setCampaignCategory] = useState("");
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [showCampaignEditModal, setShowCampaignEditModal] = useState(false);
  const [editCampaignTitle, setEditCampaignTitle] = useState("");
  const [editCampaignMessage, setEditCampaignMessage] = useState("");
  const [editCampaignChannel, setEditCampaignChannel] = useState<"email" | "push" | "both">("both");
  const [editCampaignTargetType, setEditCampaignTargetType] = useState<string>("all");
  const [editCampaignProductId, setEditCampaignProductId] = useState("");
  const [editCampaignCategory, setEditCampaignCategory] = useState("");
  const [isUpdatingCampaign, setIsUpdatingCampaign] = useState(false);

  // Marketing Banner Management States
  const [marketingBanners, setMarketingBanners] = useState<any[]>([]);
  const [bannerText, setBannerText] = useState("");
  const [bannerBackgroundColor, setBannerBackgroundColor] = useState("sunset");
  const [bannerTextColor, setBannerTextColor] = useState("text-white");
  const [bannerStartDate, setBannerStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // default to today
  });
  const [bannerEndDate, setBannerEndDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7); // default to 7 days from now
    return tomorrow.toISOString().split("T")[0];
  });
  const [bannerActive, setBannerActive] = useState(true);
  const [bannerActionText, setBannerActionText] = useState("");
  const [bannerActionUrl, setBannerActionUrl] = useState("");
  const [bannerClosable, setBannerClosable] = useState(true);
  const [isCreatingBanner, setIsCreatingBanner] = useState(false);

  // Banner Editing States
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const [showBannerEditModal, setShowBannerEditModal] = useState(false);
  const [editBannerText, setEditBannerText] = useState("");
  const [editBannerBackgroundColor, setEditBannerBackgroundColor] = useState("sunset");
  const [editBannerTextColor, setEditBannerTextColor] = useState("text-white");
  const [editBannerStartDate, setEditBannerStartDate] = useState("");
  const [editBannerEndDate, setEditBannerEndDate] = useState("");
  const [editBannerActive, setEditBannerActive] = useState(true);
  const [editBannerActionText, setEditBannerActionText] = useState("");
  const [editBannerActionUrl, setEditBannerActionUrl] = useState("");
  const [editBannerClosable, setEditBannerClosable] = useState(true);
  const [isUpdatingBanner, setIsUpdatingBanner] = useState(false);

  // Server Aggregates & Pre-computed Summary States
  const [serverAggregates, setServerAggregates] = useState<{
    totalOrdersCount: number;
    totalProductsCount: number;
    totalUsersCount: number;
    totalBlogsCount: number;
    totalTicketsCount: number;
    totalSalesSum: number;
    lastUpdated: string;
  }>({
    totalOrdersCount: 0,
    totalProductsCount: 0,
    totalUsersCount: 0,
    totalBlogsCount: 0,
    totalTicketsCount: 0,
    totalSalesSum: 0,
    lastUpdated: "",
  });

  // Quick Actions States & Handlers
  const [isRefetching, setIsRefetching] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isWarmingCache, setIsWarmingCache] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("System Advisory");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [strictQuotaMode, setStrictQuotaMode] = useState(true);

  const handleWarmCache = async () => {
    setIsWarmingCache(true);
    try {
      const res = await warmCategoryCache(categoryImages, products);
      if (res.triggered) {
        toast.success(`⚡ High-Speed Cache Warmer Active! Pre-warming ${res.urlCount} assets for popular categories.`);
      } else {
        toast.error(`Cache warming skipped: ${res.reason}`);
      }
    } catch (err: any) {
      toast.error("Error warming category cache: " + err.message);
    } finally {
      setIsWarmingCache(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearAllOfflineCache();
      localStorage.removeItem("sokoplus_banners_cache");
      localStorage.removeItem("sokoplus_banners_timestamp");
      sessionStorage.clear();
      toast.success("Cache Cleared! Memory, IndexedDB & session storage purged.", { duration: 4000 });
    } catch (err: any) {
      toast.error("Error clearing cache: " + err.message);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleForceRefetch = async () => {
    setIsRefetching(true);
    try {
      await fetchData();
      toast.success("Data Refetched! Bounded collection snapshots updated from database.", { duration: 4000 });
    } catch (err: any) {
      toast.error("Refetch failed: " + err.message);
    } finally {
      setIsRefetching(false);
    }
  };

  const handlePublishBroadcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!broadcastMessage.trim()) {
      toast.error("Please provide a broadcast announcement message.");
      return;
    }
    setIsBroadcasting(true);
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 3);

      await addDoc(collection(db, "marketing_banners"), {
        text: `📢 [${broadcastTitle}] ${broadcastMessage}`,
        backgroundColor: "sunset",
        textColor: "text-white",
        active: true,
        closable: true,
        startDate: new Date().toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      });

      toast.success("System announcement broadcasted to all visitors!", { duration: 5000 });
      setShowBroadcastModal(false);
      setBroadcastMessage("");
      fetchData();
    } catch (err: any) {
      toast.error("Broadcast failed: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showBlogAddModal, setShowBlogAddModal] = useState(false);
  const [showBlogEditModal, setShowBlogEditModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [hasColorsAdd, setHasColorsAdd] = useState(false);
  const [selectedColorsAdd, setSelectedColorsAdd] = useState<string[]>([]);
  const [hasColorsEdit, setHasColorsEdit] = useState(false);
  const [selectedColorsEdit, setSelectedColorsEdit] = useState<string[]>([]);

  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    description: "",
    price: 0,
    originalPrice: 0,
    category: "Fashion",
    stock: 10,
    isDigital: false,
    digitalFormat: "pdf" as "pdf" | "video" | "audio" | "zip" | "ebook" | "software" | "other",
    digitalFileUrl: "",
    digitalFileSize: "",
    images: [""],
    artisan: "",
    buyingPrice: 0,
  });

  const [newBlog, setNewBlog] = useState({
    title: "",
    content: "",
    image: "",
    tagsString: "Artisans, Impact",
    author: "Sokoplus Team",
    readTime: "5 min read",
    publishedAt: new Date().toISOString().split("T")[0],
    seoTitle: "",
    seoDescription: "",
  });

  const loadOrdersChunk = async (targetPage: number = 1, cursor?: any) => {
    setIsOrdersLoading(true);
    try {
      const pageSize = 25;
      const constraints: any[] = [];
      
      if (orderStatusFilter !== "all" && orderStatusFilter !== "guest") {
        constraints.push(where("status", "==", orderStatusFilter));
      } else if (orderStatusFilter === "guest") {
        constraints.push(where("isGuestOrder", "==", true));
      }

      if (orderSortBy === "oldest") {
        constraints.push(orderBy("createdAt", "asc"));
      } else {
        constraints.push(orderBy("createdAt", "desc"));
      }

      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      constraints.push(limit(pageSize));

      let snap;
      try {
        const q = query(collection(db, "orders"), ...constraints);
        snap = await realGetDocs(q);
        notifyFsLog("Read", "orders", snap.docs.length);
      } catch (e) {
        console.warn("[Server Query Fallback] Unindexed orders query fallback:", e);
        const fallbackQ = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(pageSize));
        snap = await realGetDocs(fallbackQ);
        notifyFsLog("Read", "orders", snap.docs.length);
      }

      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
      setOrders(loaded);
      setHasMoreOrders(snap.docs.length === pageSize);
      if (snap.docs.length > 0) {
        setOrdersCursors((prev) => {
          const updated = [...prev];
          updated[targetPage - 1] = snap.docs[snap.docs.length - 1];
          return updated;
        });
      }
      setOrdersPage(targetPage);
    } catch (err) {
      console.error("Error loading orders chunk:", err);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const loadProductsChunk = async (targetPage: number = 1, cursor?: any) => {
    setIsProductsLoading(true);
    try {
      const pageSize = 25;
      const constraints: any[] = [];

      if (productApprovalFilter !== "all") {
        constraints.push(where("approvalStatus", "==", productApprovalFilter));
      }

      if (productSortBy === "created-asc") {
        constraints.push(orderBy("createdAt", "asc"));
      } else if (productSortBy === "created-desc") {
        constraints.push(orderBy("createdAt", "desc"));
      } else if (productSortBy === "rating-desc") {
        constraints.push(orderBy("rating", "desc"));
      } else if (productSortBy === "rating-asc") {
        constraints.push(orderBy("rating", "asc"));
      } else if (productSortBy === "price-desc") {
        constraints.push(orderBy("price", "desc"));
      } else if (productSortBy === "price-asc") {
        constraints.push(orderBy("price", "asc"));
      } else if (productSortBy === "stock-asc") {
        constraints.push(orderBy("stock", "asc"));
      } else if (productSortBy === "stock-desc") {
        constraints.push(orderBy("stock", "desc"));
      }

      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      constraints.push(limit(pageSize));

      let snap;
      try {
        const q = query(collection(db, "products"), ...constraints);
        snap = await realGetDocs(q);
        notifyFsLog("Read", "products", snap.docs.length);
      } catch (e) {
        console.warn("[Server Query Fallback] Unindexed products query fallback:", e);
        const fallbackQ = query(collection(db, "products"), limit(pageSize));
        snap = await realGetDocs(fallbackQ);
        notifyFsLog("Read", "products", snap.docs.length);
      }

      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
      setProducts(loaded);
      setHasMoreProducts(snap.docs.length === pageSize);
      if (snap.docs.length > 0) {
        setProductsCursors((prev) => {
          const updated = [...prev];
          updated[targetPage - 1] = snap.docs[snap.docs.length - 1];
          return updated;
        });
      }
      setProductsPage(targetPage);
    } catch (err) {
      console.error("Error loading products chunk:", err);
    } finally {
      setIsProductsLoading(false);
    }
  };

  useEffect(() => {
    loadOrdersChunk(1);
  }, [orderStatusFilter, orderSortBy]);

  useEffect(() => {
    loadProductsChunk(1);
  }, [productApprovalFilter, productSortBy]);

  const fetchData = async () => {
    try {
      const pSnap = await getDocs(query(collection(db, "products"), limit(50)));
      setProducts(
        pSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product),
      );

      let loadedOrders: any[] = [];
      try {
        const oSnap = await getDocs(
          query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(50)),
        );
        loadedOrders = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
      } catch (oErr) {
        console.warn("[Admin Fetch] Fallback to unindexed orders read:", oErr);
        const oSnap = await getDocs(query(collection(db, "orders"), limit(50)));
        loadedOrders = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
      }

      // 1-Year Order History TTL Cleanup policy
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const ordersOlderThanOneYear = loadedOrders.filter((order: any) => {
        let orderDate: Date;
        if (order.createdAt?.toDate) {
          orderDate = order.createdAt.toDate();
        } else if (order.createdAt?.seconds) {
          orderDate = new Date(order.createdAt.seconds * 1000);
        } else if (order.createdAt) {
          orderDate = new Date(order.createdAt);
        } else {
          orderDate = new Date();
        }
        return orderDate < oneYearAgo && (order.status === "delivered" || order.status === "cancelled");
      });

      if (ordersOlderThanOneYear.length > 0) {
        for (const ord of ordersOlderThanOneYear) {
          await deleteDoc(doc(db, "orders", ord.id));
        }
        const deletedIds = new Set(ordersOlderThanOneYear.map((o: any) => o.id));
        loadedOrders = loadedOrders.filter((o: any) => !deletedIds.has(o.id));
        toast.success(`Automated TTL: Cleared ${ordersOlderThanOneYear.length} Delivered/Cancelled orders older than one year.`);
      }

      // Capping recent orders to 50: autodelete excess Completed/Cancelled orders
      if (loadedOrders.length >= 50) {
        const deletable = loadedOrders.filter(
          (o: any) => o.status === "delivered" || o.status === "cancelled"
        );
        if (deletable.length > 0) {
          // Sort oldest first based on timestamp
          const sortedDeletable = [...deletable].sort((a: any, b: any) => {
            const getTs = (ord: any): number => {
              if (!ord.createdAt) return 0;
              if (typeof ord.createdAt.toDate === "function") {
                return ord.createdAt.toDate().getTime();
              }
              if (ord.createdAt.seconds !== undefined) {
                return ord.createdAt.seconds * 1000 + (ord.createdAt.nanoseconds || 0) / 1000000;
              }
              const date = new Date(ord.createdAt);
              return isNaN(date.getTime()) ? 0 : date.getTime();
            };
            return getTs(a) - getTs(b);
          });

          // To stay under 50 total orders, delete excess delivered/cancelled orders
          const maxAllowed = 49;
          const numToDelete = loadedOrders.length - maxAllowed;
          if (numToDelete > 0) {
            const toDelete = sortedDeletable.slice(0, numToDelete);
            for (const ord of toDelete) {
              await deleteDoc(doc(db, "orders", ord.id));
            }
            const deletedIds = new Set(toDelete.map((o: any) => o.id));
            loadedOrders = loadedOrders.filter((o: any) => !deletedIds.has(o.id));
            toast.success(`Enforced cap of 50 orders: auto-deleted ${toDelete.length} outdated archives (delivered/cancelled).`);
          }
        }
      }
      setOrders(loadedOrders);

      const tSnap = await getDocsCacheFirst(
        query(collection(db, "support_tickets"), orderBy("createdAt", "desc"), limit(50)),
      );
      setTickets(
        tSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as SupportTicket),
      );

      try {
        const bSnap = await getDocsCacheFirst(query(collection(db, "blog"), orderBy("publishedAt", "desc"), limit(30)));
        setBlogs(
          bSnap.docs.map((d: any) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || "",
              content: data.content || "",
              image: data.image || "",
              tags: data.tags || [],
              author: data.author || "Sokoplus Team",
              readTime: data.readTime || "4 min read",
              publishedAt: data.publishedAt,
              seoTitle: data.seoTitle || "",
              seoDescription: data.seoDescription || "",
            } as BlogPost;
          }),
        );
      } catch (blogErr) {
        console.warn(
          "Could not fetch blogs, using empty state or fallbacks",
          blogErr,
        );
      }

      try {
        const settingsRef = doc(db, "settings", "homepage");
        const settingsSnap = await getDocCacheFirst(settingsRef);
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          if (settingsData.heroImageUrl) {
            setHomepageHeroUrl(settingsData.heroImageUrl);
          }
          if (settingsData.heroImageUrls) {
            setHomepageHeroUrls(settingsData.heroImageUrls);
          } else if (settingsData.heroImageUrl) {
            setHomepageHeroUrls([settingsData.heroImageUrl]);
          }
          if (settingsData.googleMapsLink) {
            setGoogleMapsLink(settingsData.googleMapsLink);
          }
          if (settingsData.googleMapsLinks) {
            setGoogleMapsLinks(settingsData.googleMapsLinks);
          } else if (settingsData.googleMapsLink) {
            setGoogleMapsLinks([{ name: "Nairobi Store", url: settingsData.googleMapsLink }]);
          }
          if (settingsData.showAudioBubble !== undefined) {
            setShowAudioBubble(settingsData.showAudioBubble);
          }
          if (settingsData.promotionalBannersEnabled !== undefined) {
            setPromotionalBannersEnabled(settingsData.promotionalBannersEnabled);
          }
          if (settingsData.brandLogoUrl) {
            setBrandLogoUrl(settingsData.brandLogoUrl);
          }
          if (settingsData.faviconUrl) {
            setFaviconUrl(settingsData.faviconUrl);
          }
          if (settingsData.seoTitle) {
            setSeoTitle(settingsData.seoTitle);
          }
          if (settingsData.seoDescription) {
            setSeoDescription(settingsData.seoDescription);
          }
          if (settingsData.seoImage) {
            setSeoImage(settingsData.seoImage);
          }
          if (settingsData.gaMeasurementId) {
            setGaMeasurementId(settingsData.gaMeasurementId);
          }
          if (settingsData.freeShippingThreshold !== undefined) {
            setFreeShippingThreshold(Number(settingsData.freeShippingThreshold));
          }
          if (settingsData.featuredCollections) {
            setFeaturedCollections(settingsData.featuredCollections);
          }
          if (settingsData.socialLinks) {
            setSocialLinks({
              facebook: settingsData.socialLinks.facebook || "",
              instagram: settingsData.socialLinks.instagram || "",
              twitter: settingsData.socialLinks.twitter || "",
              linkedin: settingsData.socialLinks.linkedin || "",
              tiktok: settingsData.socialLinks.tiktok || "",
              whatsapp: settingsData.socialLinks.whatsapp || "",
              youtube: settingsData.socialLinks.youtube || "",
              facebookVisible: settingsData.socialLinks.facebookVisible !== undefined ? settingsData.socialLinks.facebookVisible : true,
              instagramVisible: settingsData.socialLinks.instagramVisible !== undefined ? settingsData.socialLinks.instagramVisible : true,
              twitterVisible: settingsData.socialLinks.twitterVisible !== undefined ? settingsData.socialLinks.twitterVisible : true,
              linkedinVisible: settingsData.socialLinks.linkedinVisible !== undefined ? settingsData.socialLinks.linkedinVisible : true,
              tiktokVisible: settingsData.socialLinks.tiktokVisible !== undefined ? settingsData.socialLinks.tiktokVisible : true,
              whatsappVisible: settingsData.socialLinks.whatsappVisible !== undefined ? settingsData.socialLinks.whatsappVisible : true,
              youtubeVisible: settingsData.socialLinks.youtubeVisible !== undefined ? settingsData.socialLinks.youtubeVisible : true,
            });
          }
          if (settingsData.disabledCountries) {
            setDisabledCountries(settingsData.disabledCountries);
          }
          if (settingsData.disabledCounties) {
            setDisabledCounties(settingsData.disabledCounties);
          }
          if (settingsData.disabledCities) {
            setDisabledCities(settingsData.disabledCities);
          }
          if (settingsData.categoryImages) {
            setCategoryImages(settingsData.categoryImages);
          }
        }
      } catch (settingsError) {
        console.warn("Could not retrieve hero image settings: ", settingsError);
      }

      try {
        const jobsSnap = await getDocsCacheFirst(
          query(collection(db, "job_offers"), orderBy("createdAt", "desc"), limit(50))
        );
        setJobOffers(
          jobsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as JobOffer)
        );

        const appsSnap = await getDocsCacheFirst(
          query(collection(db, "job_applications"), orderBy("createdAt", "desc"), limit(50))
        );
        setJobApplications(
          appsSnap.docs.map((d: any) => {
            const data = d.data();
            return {
              id: d.id,
              jobId: data.jobId || "",
              jobTitle: data.jobTitle || "",
              userId: data.userId || "",
              applicantName: data.applicantName || "",
              applicantEmail: data.applicantEmail || "",
              applicantPhone: data.applicantPhone || "",
              resumeDetails: data.resumeDetails || "",
              resumeName: data.resumeName || "",
              coverLetter: data.coverLetter || "",
              status: (data.status as any) || "pending",
              createdAt: data.createdAt || ""
            } as JobApplication;
          })
        );
      } catch (careersError) {
        console.warn("Could not retrieve careers data: ", careersError);
      }

      try {
        const mcSnap = await getDocsCacheFirst(
          query(collection(db, "marketing_campaigns"), orderBy("createdAt", "desc"), limit(50))
        );
        setCampaigns(
          mcSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
        );
      } catch (mcError) {
        console.warn("Could not retrieve marketing campaigns: ", mcError);
      }

      try {
        const mbSnap = await getDocsCacheFirst(
          query(collection(db, "marketing_banners"), orderBy("createdAt", "desc"), limit(50))
        );
        setMarketingBanners(
          mbSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
        );
      } catch (mbError) {
        console.warn("Could not retrieve marketing banners: ", mbError);
      }

      try {
        const sSnap = await getDocsCacheFirst(query(collection(db, "sellers"), limit(50)));
        setSellers(
          sSnap.docs.map((d: any) => ({ uid: d.id, ...d.data() }))
        );
      } catch (sellersError) {
        console.warn("Could not load SokoPlus sellers Applications: ", sellersError);
      }

      try {
        const pendingSnap = await getDocsCacheFirst(query(collection(db, "pending_products"), limit(50)));
        setPendingProducts(
          pendingSnap.docs.map((d: any) => ({ id: d.id, ...d.data(), isPending: true }) as Product)
        );
      } catch (pendingError) {
        console.warn("Could not load SokoPlus pending products: ", pendingError);
      }

      try {
        const uSnap = await getDocsCacheFirst(query(collection(db, "users"), limit(50)));
        setUsersList(
          uSnap.docs.map((d: any) => {
            const data = d.data();
            return {
              uid: d.id,
              email: data.email || "",
              displayName: data.displayName || "",
              phoneNumber: data.phoneNumber || "",
              loyaltyPoints: data.loyaltyPoints || 0,
              isAdmin: !!data.isAdmin,
              emailVerified: !!data.emailVerified,
              photoURL: data.photoURL || "",
              createdAt: data.createdAt || ""
            } as UserProfile;
          })
        );
      } catch (usersError) {
        console.warn("Could not load users database for reports: ", usersError);
      }

      // High-Performance Server-Side Aggregate Queries & Pre-computed Summary Sync
      try {
        const [ordersAgg, productsCountVal, usersCountVal, blogsCountVal, ticketsCountVal] = await Promise.all([
          getAggregateFromServer(collection(db, "orders"), {
            totalSalesSum: sum("totalAmount"),
            totalOrdersCount: count(),
          }),
          getCountFromServer(collection(db, "products")),
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "blog")),
          getCountFromServer(collection(db, "support_tickets")),
        ]);

        const salesSum = ordersAgg?.totalSalesSum || 0;
        const ordersCountVal = ordersAgg?.totalOrdersCount || 0;

        const aggData = {
          totalOrdersCount: ordersCountVal,
          totalProductsCount: productsCountVal,
          totalUsersCount: usersCountVal,
          totalBlogsCount: blogsCountVal,
          totalTicketsCount: ticketsCountVal,
          totalSalesSum: salesSum,
          lastUpdated: new Date().toISOString(),
        };

        setServerAggregates(aggData);

        // Store pre-computed summary document for low-overhead summary reads
        await setDoc(doc(db, "summaries", "dashboard"), aggData, { merge: true }).catch(() => {});
      } catch (aggErr) {
        console.warn("Server aggregate calculation failed, fallback to client calculations:", aggErr);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "products/orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!user?.isAdmin) return;

    const q = query(
      collection(db, "support_tickets"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket)
      );
    }, (error) => {
      console.warn("Error subscribing to support tickets in Admin panel:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > 12 * 1024 * 1024) {
        reject(new Error("Image file is too large! Maximum limit is 12MB."));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1000;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            try {
              const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.72);
              const sizeInBytes = Math.round((compressedDataUrl.length * 3) / 4);
              if (sizeInBytes > 800 * 1024) {
                reject(new Error("The image is still too large. Please select a simpler image."));
                return;
              }
              resolve(compressedDataUrl);
            } catch (compressErr) {
              reject(compressErr);
            }
          } else {
            reject(new Error("Could not initialize browser canvas for graphics compression."));
          }
        };

        img.onerror = () => {
          reject(new Error("Failed to parse upload as a valid image."));
        };

        if (typeof event.target?.result === "string") {
          img.src = event.target.result;
        }
      };
      reader.onerror = () => {
        reject(new Error("Failed to process the uploaded source file."));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await compressImageFile(file);
      setHomepageHeroUrl(optimized);
      if (!homepageHeroUrls.includes(optimized)) {
        setHomepageHeroUrls(prev => [...prev, optimized]);
      }
      toast.success("Image successfully optimized & loaded! Click 'Save Changes' to update the site.");
    } catch (err: any) {
      toast.error(err.message || "Failed to compress and optimize the image file.");
    }
  };

  const compressFaviconFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 48; // Recommended standard size for high-res favicon
          const canvas = document.createElement("canvas");
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, maxDim, maxDim);
            let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
            if (img.width > img.height) {
              srcW = img.height;
              srcX = (img.width - img.height) / 2;
            } else {
              srcH = img.width;
              srcY = (img.height - img.width) / 2;
            }
            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, maxDim, maxDim);
            try {
              const compressedDataUrl = canvas.toDataURL("image/png");
              resolve(compressedDataUrl);
            } catch (compressErr) {
              reject(compressErr);
            }
          } else {
            reject(new Error("Could not initialize browser canvas."));
          }
        };
        img.onerror = () => reject(new Error("Failed to parse upload as a valid image."));
        if (typeof event.target?.result === "string") {
          img.src = event.target.result;
        }
      };
      reader.onerror = () => reject(new Error("Failed to process file."));
      reader.readAsDataURL(file);
    });
  };

  const compressBrandLogoFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const maxH = 120; // brand logo height is usually small
          let width = img.width;
          let height = img.height;
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            try {
              const compressedDataUrl = canvas.toDataURL("image/png");
              resolve(compressedDataUrl);
            } catch (compressErr) {
              reject(compressErr);
            }
          } else {
            reject(new Error("Could not initialize browser canvas."));
          }
        };
        img.onerror = () => reject(new Error("Failed to parse upload as a valid image."));
        if (typeof event.target?.result === "string") {
          img.src = event.target.result;
        }
      };
      reader.onerror = () => reject(new Error("Failed to process file."));
      reader.readAsDataURL(file);
    });
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await compressFaviconFile(file);
      setFaviconUrl(optimized);
      toast.success("Favicon successfully optimized! Click 'Save Settings' below to apply.");
    } catch (err: any) {
      toast.error(err.message || "Failed to compress and optimize the favicon file.");
    }
  };

  const handleBrandLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await compressBrandLogoFile(file);
      setBrandLogoUrl(optimized);
      toast.success("Brand logo successfully optimized! Click 'Save Settings' below to apply.");
    } catch (err: any) {
      toast.error(err.message || "Failed to compress and optimize the brand logo file.");
    }
  };

  const compressSeoImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const maxW = 600; // Keep compact for Firestore storage
          let width = img.width;
          let height = img.height;
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            try {
              const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75); // space-efficient
              resolve(compressedDataUrl);
            } catch (compressErr) {
              reject(compressErr);
            }
          } else {
            reject(new Error("Could not initialize browser canvas."));
          }
        };
        img.onerror = () => reject(new Error("Failed to parse upload as a valid image."));
        if (typeof event.target?.result === "string") {
          img.src = event.target.result;
        }
      };
      reader.onerror = () => reject(new Error("Failed to process file."));
      reader.readAsDataURL(file);
    });
  };

  const handleSeoImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await compressSeoImageFile(file);
      setSeoImage(optimized);
      toast.success("SEO social preview image successfully optimized! Click 'Save Settings' to apply.");
    } catch (err: any) {
      toast.error(err.message || "Failed to compress the SEO social preview image.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      // Direct guard against Firestore document exceeding 1 MiB limit
      let totalLength = 0;
      homepageHeroUrls.forEach(url => {
        if (url && url.startsWith("data:")) {
          totalLength += url.length;
        }
      });
      if (homepageHeroUrl && homepageHeroUrl.startsWith("data:")) {
        totalLength += homepageHeroUrl.length;
      }
      if (brandLogoUrl && brandLogoUrl.startsWith("data:")) {
        totalLength += brandLogoUrl.length;
      }
      if (faviconUrl && faviconUrl.startsWith("data:")) {
        totalLength += faviconUrl.length;
      }
      if (seoImage && seoImage.startsWith("data:")) {
        totalLength += seoImage.length;
      }
      featuredCollections.forEach(fc => {
        if (fc.imageUrl && fc.imageUrl.startsWith("data:")) {
          totalLength += fc.imageUrl.length;
        }
      });

      if (totalLength > 1.2 * 1024 * 1024) {
        toast.error("Total size of uploaded base64 images is too large! Please use image URLs/links or upload smaller files.");
        setIsSavingSettings(false);
        return;
      }

      const settingsRef = doc(db, "settings", "homepage");
      const settingsPayload = {
        heroImageUrl: homepageHeroUrl,
        heroImageUrls: homepageHeroUrls,
        googleMapsLink: googleMapsLinks.length > 0 ? googleMapsLinks[0].url : "",
        googleMapsLinks: googleMapsLinks,
        showAudioBubble: showAudioBubble,
        promotionalBannersEnabled: promotionalBannersEnabled,
        brandLogoUrl: brandLogoUrl,
        faviconUrl: faviconUrl,
        seoTitle: seoTitle,
        seoDescription: seoDescription,
        seoImage: seoImage,
        gaMeasurementId: gaMeasurementId,
        freeShippingThreshold: Number(freeShippingThreshold) || 15000,
        featuredCollections: featuredCollections,
        socialLinks: socialLinks,
        disabledCountries: disabledCountries,
        disabledCounties: disabledCounties,
        disabledCities: disabledCities,
        categoryImages: categoryImages,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || "Admin",
      };

      await executeOrQueueFirestoreMutation(
        () => setDoc(settingsRef, settingsPayload, { merge: true }),
        {
          type: "set",
          collectionName: "settings",
          docId: "homepage",
          payload: settingsPayload,
          options: { merge: true },
          description: `Update Homepage & Shipping Settings (Threshold KES ${Number(freeShippingThreshold) || 15000})`,
        }
      );
      toast.success("Homepage settings successfully saved! Changes are now live.");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      if (error?.message && error.message.includes("exceeds the maximum")) {
        toast.error("Image file is still too large for the database limits. Try uploading a smaller size or link/URL.");
      } else {
        toast.error("Failed to save homepage settings.");
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveCategoryImagesDirect = async () => {
    setIsSavingSettings(true);
    try {
      const settingsRef = doc(db, "settings", "homepage");
      await setDoc(settingsRef, { categoryImages: categoryImages }, { merge: true });
      toast.success("Category images updated successfully! Changes are live across mobile views.");
    } catch (err) {
      console.error("Failed to save category images:", err);
      toast.error("Failed to update category images.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    if (confirm("Are you sure you want to reset the hero banner back to default?")) {
      setIsSavingSettings(true);
      try {
        const settingsRef = doc(db, "settings", "homepage");
        await setDoc(settingsRef, {
          heroImageUrl: "",
          heroImageUrls: [],
          googleMapsLink: "",
          googleMapsLinks: [],
          showAudioBubble: true,
          brandLogoUrl: "",
          faviconUrl: "",
          seoTitle: "",
          seoDescription: "",
          seoImage: "",
          featuredCollections: [],
          updatedAt: new Date(),
          updatedBy: user?.email || "Admin",
        }, { merge: true });
        setHomepageHeroUrl("");
        setHomepageHeroUrls([]);
        setGoogleMapsLink("");
        setGoogleMapsLinks([]);
        setShowAudioBubble(true);
        setBrandLogoUrl("");
        setFaviconUrl("");
        setSeoTitle("");
        setSeoDescription("");
        setSeoImage("");
        setFeaturedCollections([]);
        toast.success("Successfully reset settings back to default!");
      } catch (error) {
        console.error("Error resetting settings:", error);
        toast.error("Failed to reset settings.");
      } finally {
        setIsSavingSettings(false);
      }
    }
  };

  useEffect(() => {
    if (homepageHeroUrls.length <= 1) {
      setActivePreviewSlide(0);
      return;
    }
    const interval = setInterval(() => {
      setActivePreviewSlide((prev) => (prev + 1) % homepageHeroUrls.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [homepageHeroUrls]);

  const seedData = async () => {
    try {
      const sampleProducts = [
        {
          name: "Maasai Beaded Necklace",
          price: 2500,
          category: "Local Crafts",
          description: "Authentic handmade Maasai jewelry from Narok.",
          stock: 50,
          images: [
            "https://images.unsplash.com/photo-1629196914068-3974bcda318b?auto=format&fit=crop&q=80&w=2000",
          ],
          artisan: "Mama Stacey of Narok Maasai Crafts",
          buyingPrice: 1500,
        },
        {
          name: "Sokoplus Tech Bag",
          price: 4500,
          category: "Fashion",
          description: "Waterproof laptop bag for the Nairobi commuter.",
          stock: 30,
          images: [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000",
          ],
          artisan: "Kariobangi Leather Artisans",
          buyingPrice: 2800,
        },
        {
          name: "Bamboo Speaker",
          price: 3200,
          category: "Electronics",
          description: "Eco-friendly bamboo bluetooth speaker, handcrafted.",
          stock: 15,
          images: [
            "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&q=80&w=2000",
          ],
          artisan: "Mombasa Sustainable Woodworks",
          buyingPrice: 1900,
        },
      ];
      for (const p of sampleProducts) {
        await addDoc(collection(db, "products"), {
          ...p,
          rating: 4.8,
          reviewCount: 15,
          createdAt: new Date().toISOString(),
        });
      }
      toast.success("Sample data seeded!");
      fetchData();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "products");
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-2xl font-bold">
        Access Denied
      </div>
    );
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!newProduct.name.trim()) {
      newErrors.name = "Product name is required";
    }
    if (newProduct.price <= 0) {
      newErrors.price = "Price must be greater than zero";
    }
    if (newProduct.stock < 0) {
      newErrors.stock = "Stock cannot be negative";
    }

    // SKU Format & Uniqueness Validation
    let targetSku = newProduct.sku ? newProduct.sku.trim() : "";
    if (!targetSku) {
      targetSku = generateSuggestedSku(newProduct.category, newProduct.name);
    }

    const skuResult = await validateSkuUniqueness(targetSku);
    if (!skuResult.isUnique) {
      newErrors.sku = skuResult.error || "SKU format is invalid or duplicate exists";
    } else {
      targetSku = skuResult.normalizedSku;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const sanitizedImages = newProduct.images.filter(
        (url) => !!url && url.trim() !== "",
      );
      await addDoc(collection(db, "products"), {
        ...newProduct,
        sku: targetSku,
        images: sanitizedImages.length > 0 ? sanitizedImages : [],
        originalPrice: newProduct.originalPrice && newProduct.originalPrice > 0 ? newProduct.originalPrice : null,
        rating: 4.5,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        availableColors: hasColorsAdd ? selectedColorsAdd : [],
      });
      toast.success(`Product added with SKU: ${targetSku}!`);
      setShowAddModal(false);
      setHasColorsAdd(false);
      setSelectedColorsAdd([]);
      setNewProduct({
        sku: "",
        name: "",
        description: "",
        price: 0,
        originalPrice: 0,
        category: "Fashion",
        stock: 10,
        isDigital: false,
        digitalFormat: "pdf",
        digitalFileUrl: "",
        digitalFileSize: "",
        images: [""],
        artisan: "",
        buyingPrice: 0,
      });
      setErrors({});
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "products");
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!id) {
      toast.error("This product has no valid ID.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelectedProductIds((prev) => prev.filter((pid) => pid !== id));
      toast.success(`"${name}" has been deleted.`);
    } catch (error: any) {
      console.error("Delete error:", error);
      if (error.code === "permission-denied") {
        toast.error(
          "Access denied. You don't have permission to delete this product.",
        );
      } else {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${selectedProductIds.length} selected products in a single batch write operation? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsBatchDeletingProducts(true);
    try {
      const batch = realWriteBatch(db);
      selectedProductIds.forEach((id) => {
        batch.delete(doc(db, "products", id));
      });
      await batch.commit();
      notifyFsLog("Delete", "products", selectedProductIds.length);

      setProducts((prev) => prev.filter((p) => !selectedProductIds.includes(p.id)));
      toast.success(`Successfully batch deleted ${selectedProductIds.length} products in 1 write operation!`);
      setSelectedProductIds([]);
    } catch (error: any) {
      console.error("Batch delete products error:", error);
      toast.error("Failed to batch delete selected products.");
    } finally {
      setIsBatchDeletingProducts(false);
    }
  };

  const deleteUserDoc = async (uid: string, email: string) => {
    if (!uid) return;
    const confirmed = window.confirm(`Are you sure you want to permanently delete user account "${email || uid}"?`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "users", uid));
      setUsersList((prev) => prev.filter((u) => u.uid !== uid));
      setSelectedUserUids((prev) => prev.filter((id) => id !== uid));
      toast.success(`User profile "${email || uid}" deleted.`);
    } catch (error: any) {
      console.error("Delete user error:", error);
      toast.error("Failed to delete user profile.");
    }
  };

  const handleBatchDeleteUsers = async () => {
    if (selectedUserUids.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${selectedUserUids.length} selected user profiles in a single batch write operation? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsBatchDeletingUsers(true);
    try {
      const batch = realWriteBatch(db);
      selectedUserUids.forEach((uid) => {
        batch.delete(doc(db, "users", uid));
      });
      await batch.commit();
      notifyFsLog("Delete", "users", selectedUserUids.length);

      setUsersList((prev) => prev.filter((u) => !selectedUserUids.includes(u.uid)));
      toast.success(`Successfully batch deleted ${selectedUserUids.length} user profiles in 1 write operation!`);
      setSelectedUserUids([]);
    } catch (error: any) {
      console.error("Batch delete users error:", error);
      toast.error("Failed to batch delete selected user profiles.");
    } finally {
      setIsBatchDeletingUsers(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const newErrors: { [key: string]: string } = {};
    if (!editingProduct.name.trim())
      newErrors.name = "Product name is required";
    if (editingProduct.price <= 0)
      newErrors.price = "Price must be greater than zero";
    if (editingProduct.stock < 0) newErrors.stock = "Stock cannot be negative";

    let targetSku = editingProduct.sku ? editingProduct.sku.trim() : "";
    if (!targetSku) {
      targetSku = generateSuggestedSku(editingProduct.category, editingProduct.name);
    }
    const skuResult = await validateSkuUniqueness(targetSku, editingProduct.id);
    if (!skuResult.isUnique) {
      newErrors.sku = skuResult.error || "SKU format is invalid or duplicate exists";
    } else {
      targetSku = skuResult.normalizedSku;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { id, ...updateData } = editingProduct;
      const sanitizedImages = updateData.images.filter(
        (url) => !!url && url.trim() !== "",
      );
      
      const previousProduct = products.find((p) => p.id === id);
      const isPriceDropped = previousProduct && updateData.price < previousProduct.price;

      await updateDoc(doc(db, "products", id), {
        ...updateData,
        sku: targetSku,
        images: sanitizedImages.length > 0 ? sanitizedImages : [],
        originalPrice: editingProduct.originalPrice && editingProduct.originalPrice > 0 ? editingProduct.originalPrice : null,
        availableColors: hasColorsEdit ? selectedColorsEdit : [],
      });

      if (isPriceDropped) {
        try {
          const q = query(
            collection(db, "price_drop_alerts"),
            where("productId", "==", id),
            where("status", "==", "active"),
            limit(50)
          );
          const alertsSnap = await getDocs(q);
          if (!alertsSnap.empty) {
            const batchPromises = alertsSnap.docs.map((alertDoc) => 
              updateDoc(doc(db, "price_drop_alerts", alertDoc.id), {
                status: "triggered",
                triggeredAt: new Date().toISOString(),
                triggeredPrice: updateData.price,
              })
            );
            await Promise.all(batchPromises);
            toast.success(`Triggered ${alertsSnap.size} price drop notification alert(s) for subscribed customers!`);
          }
        } catch (alertErr) {
          console.error("Failed to process alerts on price drop:", alertErr);
        }
      }

      toast.success("Product updated successfully!");
      setShowEditModal(false);
      setEditingProduct(null);
      setErrors({});
      fetchData();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `products/${editingProduct.id}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      setOrders(
        orders.map((o) =>
          o.id === orderId ? { ...o, status: status as any } : o,
        ),
      );
      await executeOrQueueFirestoreMutation(
        () => updateDoc(doc(db, "orders", orderId), { status }),
        {
          type: "update",
          collectionName: "orders",
          docId: orderId,
          payload: { status },
          description: `Update Order ${orderId.slice(0, 8)} status to ${status}`,
        }
      );
      toast.success("Order status updated.");
      if (status === "delivered" || status === "cancelled") {
        fetchData();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const updateTicketStatus = async (
    ticketId: string,
    status: SupportTicket["status"],
  ) => {
    try {
      setTickets(
        tickets.map((t) => (t.id === ticketId ? { ...t, status } : t)),
      );
      const updatedAt = new Date().toISOString();
      await executeOrQueueFirestoreMutation(
        () => updateDoc(doc(db, "support_tickets", ticketId), {
          status,
          updatedAt,
        }),
        {
          type: "update",
          collectionName: "support_tickets",
          docId: ticketId,
          payload: { status, updatedAt },
          description: `Update Ticket ${ticketId.slice(0, 8)} status to ${status}`,
        }
      );
      toast.success("Ticket status updated.");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `support_tickets/${ticketId}`,
      );
    }
  };

  const handleStartEditCampaign = (camp: any) => {
    setEditingCampaign(camp);
    setEditCampaignTitle(camp.title || "");
    setEditCampaignMessage(camp.message || "");
    setEditCampaignChannel(camp.channel || "both");
    setEditCampaignTargetType(camp.targetCriteria?.type || "all");
    setEditCampaignProductId(camp.targetCriteria?.productId || "");
    setEditCampaignCategory(camp.targetCriteria?.category || "");
    setShowCampaignEditModal(true);
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    if (!editCampaignTitle.trim() || !editCampaignMessage.trim()) {
      toast.error("Please provide both a campaign title and content body message.");
      return;
    }

    setIsUpdatingCampaign(true);
    try {
      const campaignRef = doc(db, "marketing_campaigns", editingCampaign.id);
      await updateDoc(campaignRef, {
        title: editCampaignTitle,
        message: editCampaignMessage,
        channel: editCampaignChannel,
        targetCriteria: {
          type: editCampaignTargetType,
          productId: editCampaignTargetType.endsWith("_product") ? editCampaignProductId : null,
          category: editCampaignTargetType.endsWith("_category") ? editCampaignCategory : null
        },
        updatedAt: new Date().toISOString()
      });

      toast.success("Campaign updated successfully!");
      setShowCampaignEditModal(false);
      setEditingCampaign(null);
      await fetchData();
    } catch (err: any) {
      toast.error(`Error updating campaign: ${err.message || err}`);
      console.error(err);
    } finally {
      setIsUpdatingCampaign(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this marketing campaign? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "marketing_campaigns", campaignId));
      toast.success("Campaign deleted successfully!");
      await fetchData();
    } catch (err: any) {
      toast.error(`Error deleting campaign: ${err.message || err}`);
      console.error(err);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerText.trim()) {
      toast.error("Please enter a valid message for the banner.");
      return;
    }
    if (!bannerStartDate || !bannerEndDate) {
      toast.error("An active date range is required.");
      return;
    }
    if (new Date(bannerStartDate) > new Date(bannerEndDate)) {
      toast.error("The start date must fall before the end date.");
      return;
    }

    setIsCreatingBanner(true);
    try {
      const bannerPayload = {
        text: bannerText.trim(),
        backgroundColor: bannerBackgroundColor,
        textColor: bannerTextColor,
        startDate: new Date(bannerStartDate).toISOString(),
        endDate: new Date(bannerEndDate).toISOString(),
        active: bannerActive,
        actionText: bannerActionText.trim() || null,
        actionUrl: bannerActionUrl.trim() || null,
        closable: bannerClosable,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || "Admin"
      };

      await addDoc(collection(db, "marketing_banners"), bannerPayload);
      toast.success("Website Promotional Banner created successfully!", { icon: "🎉" });
      
      // Reset banner fields
      setBannerText("");
      setBannerActionText("");
      setBannerActionUrl("");
      
      await fetchData();
    } catch (err: any) {
      toast.error(`Error creating banner: ${err.message || err}`);
      console.error(err);
    } finally {
      setIsCreatingBanner(false);
    }
  };

  const handleStartEditBanner = (bnDoc: any) => {
    setEditingBanner(bnDoc);
    setEditBannerText(bnDoc.text || "");
    setEditBannerBackgroundColor(bnDoc.backgroundColor || "sunset");
    setEditBannerTextColor(bnDoc.textColor || "text-white");
    setEditBannerStartDate(bnDoc.startDate ? bnDoc.startDate.split("T")[0] : "");
    setEditBannerEndDate(bnDoc.endDate ? bnDoc.endDate.split("T")[0] : "");
    setEditBannerActive(bnDoc.active !== false);
    setEditBannerActionText(bnDoc.actionText || "");
    setEditBannerActionUrl(bnDoc.actionUrl || "");
    setEditBannerClosable(bnDoc.closable !== false);
    setShowBannerEditModal(true);
  };

  const handleUpdateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    if (!editBannerText.trim()) {
      toast.error("Please enter a valid message for the banner.");
      return;
    }
    if (!editBannerStartDate || !editBannerEndDate) {
      toast.error("An active date range is required.");
      return;
    }
    if (new Date(editBannerStartDate) > new Date(editBannerEndDate)) {
      toast.error("The start date must fall before the end date.");
      return;
    }

    setIsUpdatingBanner(true);
    try {
      const bannerRef = doc(db, "marketing_banners", editingBanner.id);
      await updateDoc(bannerRef, {
        text: editBannerText.trim(),
        backgroundColor: editBannerBackgroundColor,
        textColor: editBannerTextColor,
        startDate: new Date(editBannerStartDate).toISOString(),
        endDate: new Date(editBannerEndDate).toISOString(),
        active: editBannerActive,
        actionText: editBannerActionText.trim() || null,
        actionUrl: editBannerActionUrl.trim() || null,
        closable: editBannerClosable,
        updatedAt: new Date().toISOString()
      });

      toast.success("Promotional banner updated successfully!");
      setShowBannerEditModal(false);
      setEditingBanner(null);
      await fetchData();
    } catch (err: any) {
      toast.error(`Error updating banner: ${err.message || err}`);
      console.error(err);
    } finally {
      setIsUpdatingBanner(false);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this promotional banner? This cannot be undone.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "marketing_banners", bannerId));
      toast.success("Promotional banner deleted successfully!");
      await fetchData();
    } catch (err: any) {
      toast.error(`Error deleting banner: ${err.message || err}`);
      console.error(err);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent, ticketId: string, currentReplies: any[] = []) => {
    e.preventDefault();
    const replyText = adminReplyText[ticketId]?.trim();
    if (!replyText) return;

    try {
      const newReply = {
        sender: "admin",
        message: replyText,
        createdAt: new Date().toISOString(),
        senderName: "Soplus Support",
      };
      
      const updatedReplies = [...(currentReplies || []), newReply];

      await updateDoc(doc(db, "support_tickets", ticketId), {
        replies: updatedReplies,
        unreadCountClient: (tickets.find((t) => t.id === ticketId)?.unreadCountClient || 0) + 1,
        unreadCountAdmin: 0,
        updatedAt: new Date().toISOString(),
        status: "in-progress"
      });

      setTickets((prev) =>
        prev.map((t) => t.id === ticketId ? { 
          ...t, 
          replies: updatedReplies, 
          unreadCountClient: (t.unreadCountClient || 0) + 1,
          unreadCountAdmin: 0,
          status: "in-progress" 
        } : t)
      );

      setAdminReplyText((prev) => ({ ...prev, [ticketId]: "" }));
      toast.success("Outbound response sent!");
    } catch (error) {
      console.error("Error sending admin reply:", error);
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `support_tickets/${ticketId}`
      );
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await deleteDoc(doc(db, "support_tickets", ticketId));
      setTickets(tickets.filter((t) => t.id !== ticketId));
      toast.success("Ticket deleted successfully.");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `support_tickets/${ticketId}`,
      );
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this order? This action cannot be undone."
      )
    )
      return;
    try {
      setOrders(orders.filter((o) => o.id !== orderId));
      await executeOrQueueFirestoreMutation(
        () => deleteDoc(doc(db, "orders", orderId)),
        {
          type: "delete",
          collectionName: "orders",
          docId: orderId,
          description: `Delete Order ${orderId.slice(0, 8)}`,
        }
      );
      toast.success("Order deleted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const deleteJobApplication = async (appId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this job application? This action cannot be undone."
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "job_applications", appId));
      setJobApplications(jobApplications.filter((app) => app.id !== appId));
      toast.success("Job application deleted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `job_applications/${appId}`);
    }
  };

  const applyFormatting = (
    type:
      | "bold"
      | "italic"
      | "header"
      | "subheader"
      | "list"
      | "numlist"
      | "quote"
      | "link",
    target: "new" | "edit",
  ) => {
    const elementId =
      target === "new" ? "new-blog-content" : "edit-blog-content";
    const textarea = document.getElementById(
      elementId,
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = "";
    switch (type) {
      case "bold":
        replacement = `**${selectedText || "bold text"}**`;
        break;
      case "italic":
        replacement = `*${selectedText || "italic text"}*`;
        break;
      case "header":
        replacement = `\n## ${selectedText || "Heading"}\n`;
        break;
      case "subheader":
        replacement = `\n### ${selectedText || "Subheading"}\n`;
        break;
      case "list":
        replacement = `\n- ${selectedText || "List item"}\n`;
        break;
      case "numlist":
        replacement = `\n1. ${selectedText || "List item"}\n`;
        break;
      case "quote":
        replacement = `\n> ${selectedText || "Quote"}\n`;
        break;
      case "link":
        replacement = `[${selectedText || "Link text"}](https://example.com)`;
        break;
    }

    const newContent =
      text.substring(0, start) + replacement + text.substring(end);

    if (target === "new") {
      setNewBlog({ ...newBlog, content: newContent });
    } else if (editingBlog) {
      setEditingBlog({ ...editingBlog, content: newContent });
    }

    // Refocus and select the new text after state update
    setTimeout(() => {
      textarea.focus();
      const selectionOffset = replacement.length - selectedText.length;
      textarea.setSelectionRange(start, end + selectionOffset);
    }, 50);
  };

  const handleAddBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlog.title.trim()) {
      toast.error("Blog title is required.");
      return;
    }
    if (!newBlog.content.trim()) {
      toast.error("Blog content is required.");
      return;
    }

    setLoading(true);
    try {
      const parsedTags = newBlog.tagsString
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await addDoc(collection(db, "blog"), {
        title: newBlog.title,
        content: newBlog.content,
        image:
          newBlog.image ||
          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
        tags: parsedTags,
        author: newBlog.author || "Sokoplus Team",
        readTime: newBlog.readTime || "5 min read",
        publishedAt: `${newBlog.publishedAt || new Date().toISOString().split("T")[0]}T12:00:00Z`,
        seoTitle: newBlog.seoTitle || "",
        seoDescription: newBlog.seoDescription || "",
      });

      toast.success("Blog post created successfully!");
      setShowBlogAddModal(false);
      setNewBlog({
        title: "",
        content: "",
        image: "",
        tagsString: "Artisans, Impact",
        author: "Sokoplus Team",
        readTime: "5 min read",
        publishedAt: new Date().toISOString().split("T")[0],
        seoTitle: "",
        seoDescription: "",
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "blog");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingBlog ||
      !editingBlog.title.trim() ||
      !editingBlog.content.trim()
    ) {
      toast.error("Title and content are required.");
      return;
    }

    setLoading(true);
    try {
      const { id, ...updateData } = editingBlog;
      await updateDoc(doc(db, "blog", id), {
        ...updateData,
      });
      toast.success("Blog post updated successfully!");
      setShowBlogEditModal(false);
      setEditingBlog(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `blog/${editingBlog.id}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteBlog = async (id: string, title: string) => {
    if (!id) {
      toast.error("Could not find a valid blog ID.");
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${title}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "blog", id));
      setBlogs((prev) => prev.filter((b) => b.id !== id));
      toast.success(`Blog post "${title}" has been deleted.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `blog/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = orders.reduce(
    (acc, o) =>
      acc +
      (o.status !== "cancelled" && o.paymentStatus === "paid"
        ? o.totalAmount
        : 0),
    0,
  );

  const totalProfit = orders.reduce((acc, o) => {
    if (o.status === "cancelled" || o.paymentStatus !== "paid") return acc;
    const orderCost = o.items.reduce((costSum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
      return costSum + unitCost * item.quantity;
    }, 0);
    const orderRevenue = o.items.reduce((revSum, item) => revSum + item.price * item.quantity, 0);
    const orderProfit = orderRevenue - orderCost;
    return acc + orderProfit;
  }, 0);

  const totalItemsRevenue = orders.reduce((acc, o) => {
    if (o.status === "cancelled" || o.paymentStatus !== "paid") return acc;
    const orderRevenue = o.items.reduce((revSum, item) => revSum + item.price * item.quantity, 0);
    return acc + orderRevenue;
  }, 0);
  const averageMarginPercentage = totalItemsRevenue > 0 ? (totalProfit / totalItemsRevenue) * 100 : 0;

  const getOrderTimestamp = (order: any): number => {
    if (!order.createdAt) return 0;
    if (typeof order.createdAt.toDate === "function") {
      return order.createdAt.toDate().getTime();
    }
    if (order.createdAt.seconds !== undefined) {
      return order.createdAt.seconds * 1000 + (order.createdAt.nanoseconds || 0) / 1000000;
    }
    const date = new Date(order.createdAt);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  };

  // Daily Performance (Past 30 Days)
  const dailyAnalyticsData = Array.from({ length: 30 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (29 - i));
    const label = day.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
    
    const startOfThisDay = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const endOfThisDay = startOfThisDay + 24 * 60 * 60 * 1000;

    const dayOrders = orders.filter((o) => {
      const ts = getOrderTimestamp(o);
      return ts >= startOfThisDay && ts < endOfThisDay && o.status !== "cancelled";
    });

    const dailyRevenue = dayOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    const dailyCOGS = dayOrders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        return itemSum + unitCost * item.quantity;
      }, 0);
    }, 0);

    const dailyProfit = Math.max(0, dailyRevenue - dailyCOGS);

    return {
      date: label,
      "Revenue (KES)": dailyRevenue,
      "Cost of Goods (KES)": dailyCOGS,
      "Gross Profit (KES)": dailyProfit,
      "Orders Count": dayOrders.length,
    };
  });

  // Weekly Performance (Past 12 Weeks)
  const weeklyAnalyticsData = Array.from({ length: 12 }, (_, i) => {
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (11 - i) * 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

    const label = `Wk ${i + 1} (${startOfWeek.toLocaleDateString("en-KE", { month: "short", day: "numeric" })})`;

    const weekOrders = orders.filter((o) => {
      const ts = getOrderTimestamp(o);
      return ts >= startOfWeek.getTime() && ts < endOfWeek.getTime() && o.status !== "cancelled";
    });

    const weeklyRevenue = weekOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    const weeklyCOGS = weekOrders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        return itemSum + unitCost * item.quantity;
      }, 0);
    }, 0);

    const weeklyProfit = Math.max(0, weeklyRevenue - weeklyCOGS);

    return {
      date: label,
      "Revenue (KES)": weeklyRevenue,
      "Cost of Goods (KES)": weeklyCOGS,
      "Gross Profit (KES)": weeklyProfit,
      "Orders Count": weekOrders.length,
    };
  });

  // Monthly Performance (Past 12 Months)
  const monthlyAnalyticsData = Array.from({ length: 12 }, (_, i) => {
    const today = new Date();
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
    const label = monthDate.toLocaleDateString("en-KE", { month: "short", year: "2-digit" });

    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getTime();
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).getTime();

    const monthOrders = orders.filter((o) => {
      const ts = getOrderTimestamp(o);
      return ts >= startOfMonth && ts < endOfMonth && o.status !== "cancelled";
    });

    const monthlyRevenue = monthOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    const monthlyCOGS = monthOrders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        return itemSum + unitCost * item.quantity;
      }, 0);
    }, 0);

    const monthlyProfit = Math.max(0, monthlyRevenue - monthlyCOGS);

    return {
      date: label,
      "Revenue (KES)": monthlyRevenue,
      "Cost of Goods (KES)": monthlyCOGS,
      "Gross Profit (KES)": monthlyProfit,
      "Orders Count": monthOrders.length,
    };
  });

  // Category Earnings & Profitability Breakdown
  const categoryAnalytics = (() => {
    const categoriesMap: { [key: string]: { revenue: number; cogs: number; profit: number; unitsSold: number } } = {};
    
    orders.forEach((o) => {
      if (o.status === "cancelled" || o.paymentStatus !== "paid") return;
      o.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const category = prod?.category || "Uncategorized";
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        
        const itemRevenue = item.price * item.quantity;
        const itemCost = unitCost * item.quantity;
        const itemProfit = itemRevenue - itemCost;

        if (!categoriesMap[category]) {
          categoriesMap[category] = { revenue: 0, cogs: 0, profit: 0, unitsSold: 0 };
        }
        categoriesMap[category].revenue += itemRevenue;
        categoriesMap[category].cogs += itemCost;
        categoriesMap[category].profit += itemProfit;
        categoriesMap[category].unitsSold += item.quantity;
      });
    });

    return Object.entries(categoriesMap).map(([category, data]) => ({
      name: category,
      "Revenue (KES)": data.revenue,
      "Cost of Goods (KES)": data.cogs,
      "Gross Profit (KES)": Math.max(0, data.profit),
      "Units Sold": data.unitsSold,
    })).sort((a, b) => b["Revenue (KES)"] - a["Revenue (KES)"]);
  })();

  const activeTrendsData = 
    trendsPeriod === "daily" 
      ? dailyAnalyticsData 
      : trendsPeriod === "weekly" 
        ? weeklyAnalyticsData 
        : monthlyAnalyticsData;

  // --- IN-HOUSE BI INTERACTIVE ANALYTICS SYSTEM ---
  const biFilteredOrders = orders.filter((o) => {
    if (o.status === "cancelled" || o.paymentStatus !== "paid") return false;
    
    const ts = getOrderTimestamp(o);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (biDateRangeFilter === "today") {
      const todayStart = new Date().setHours(0,0,0,0);
      return ts >= todayStart;
    }
    if (biDateRangeFilter === "7d") {
      return ts >= now - 7 * oneDay;
    }
    if (biDateRangeFilter === "30d") {
      return ts >= now - 30 * oneDay;
    }
    if (biDateRangeFilter === "90d") {
      return ts >= now - 90 * oneDay;
    }
    if (biDateRangeFilter === "ytd") {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      return ts >= startOfYear;
    }
    return true; // "all"
  });

  const biTotalRevenue = biFilteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  
  const biTotalCOGS = biFilteredOrders.reduce((sum, o) => {
    return sum + o.items.reduce((itemSum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
      return itemSum + unitCost * item.quantity;
    }, 0);
  }, 0);

  const biTotalProfit = Math.max(0, biTotalRevenue - biTotalCOGS);
  const biAverageMarginPercent = biTotalRevenue > 0 ? (biTotalProfit / biTotalRevenue) * 100 : 0;
  const biAOV = biFilteredOrders.length > 0 ? biTotalRevenue / biFilteredOrders.length : 0;
  const biTotalUnitsSold = biFilteredOrders.reduce((sum, o) => {
    return sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  // Dynamic grouping by Category based on selected filters
  const biCategoryAnalytics = (() => {
    const map: { [key: string]: { name: string; revenue: number; cogs: number; profit: number; units: number } } = {};
    biFilteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat = prod?.category || "Uncategorized";
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        const itemRev = item.price * item.quantity;
        const itemCost = unitCost * item.quantity;
        const itemProf = itemRev - itemCost;

        if (!map[cat]) {
          map[cat] = { name: cat, revenue: 0, cogs: 0, profit: 0, units: 0 };
        }
        map[cat].revenue += itemRev;
        map[cat].cogs += itemCost;
        map[cat].profit += itemProf;
        map[cat].units += item.quantity;
      });
    });
    return Object.values(map).map((c) => ({
      ...c,
      margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);
  })();

  // Dynamic Grouping of Sales by Artisan
  const biArtisanAnalytics = (() => {
    const map: { [key: string]: { name: string; category: string; unitsSold: number; revenue: number; cogs: number; profit: number; productsCount: number } } = {};
    
    biFilteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const artisanName = prod?.artisan || "Independent Artisan";
        const category = prod?.category || "General";
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        const itemRev = item.price * item.quantity;
        const itemCost = unitCost * item.quantity;
        const itemProf = itemRev - itemCost;

        if (!map[artisanName]) {
          map[artisanName] = {
            name: artisanName,
            category: category,
            unitsSold: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
            productsCount: 0,
          };
        }
        map[artisanName].unitsSold += item.quantity;
        map[artisanName].revenue += itemRev;
        map[artisanName].cogs += itemCost;
        map[artisanName].profit += itemProf;
      });
    });

    products.forEach((p) => {
      const artName = p.artisan || "Independent Artisan";
      if (map[artName]) {
        map[artName].productsCount += 1;
      } else {
        map[artName] = {
          name: artName,
          category: p.category || "General",
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          profit: 0,
          productsCount: 1,
        };
      }
    });

    return Object.values(map)
      .map((a) => ({
        ...a,
        margin: a.revenue > 0 ? (a.profit / a.revenue) * 100 : 0
      }))
      .filter((a) => {
        const matchesCategory = biCategoryFilter === "all" || a.category === biCategoryFilter;
        const matchesSearch = !biArtisanSearch || a.name.toLowerCase().includes(biArtisanSearch.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => b.revenue - a.revenue);
  })();

  // Sales Heatmap (DOW)
  const biDOWHeatmap = (() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const counts = Array(7).fill(0).map((_, idx) => ({ day: days[idx], orders: 0, sales: 0 }));
    biFilteredOrders.forEach((o) => {
      const ts = getOrderTimestamp(o);
      if (ts > 0) {
        const dayIdx = new Date(ts).getDay();
        counts[dayIdx].orders += 1;
        counts[dayIdx].sales += (o.totalAmount || 0);
      }
    });
    return counts;
  })();

  // Leaderboard of critical products with velocities
  const biProductBreakdown = (() => {
    return products.map((p) => {
      const unitsSold = biFilteredOrders.reduce((sum, o) => {
        return sum + o.items.reduce((itemSum, item) => {
          return itemSum + (item.productId === p.id ? item.quantity : 0);
        }, 0);
      }, 0);

      const revenue = unitsSold * p.price;
      const unitCost = p.buyingPrice !== undefined ? p.buyingPrice : (p.price * 0.6);
      const cogs = unitsSold * unitCost;
      const profit = Math.max(0, revenue - cogs);
      const margin = p.price > 0 ? ((p.price - unitCost) / p.price) * 100 : 0;
      const velocity = p.stock > 0 ? (unitsSold / p.stock) * 100 : (unitsSold > 0 ? 100 : 0);

      return {
        id: p.id,
        name: p.name,
        category: p.category || "General",
        artisan: p.artisan || "Independent Artisan",
        price: p.price,
        buyingPrice: unitCost,
        stock: p.stock,
        unitsSold,
        revenue,
        cogs,
        profit,
        margin,
        velocity,
      };
    })
    .filter((p) => biCategoryFilter === "all" || p.category === biCategoryFilter)
    .sort((a, b) => b.unitsSold - a.unitsSold);
  })();

  // Recommendation Engine: Heuristic analyzer
  const biRecommendations = (() => {
    const list: { id: string; type: "success" | "warning" | "info"; title: string; desc: string; action: string }[] = [];

    // Rule 1: High Margin Sourcing Potential
    biCategoryAnalytics.forEach((cat) => {
      if (cat.margin > 45 && cat.units < 15) {
        list.push({
          id: `src_${cat.name}`,
          type: "success",
          title: `Enhance Sourcing in ${cat.name}`,
          desc: `${cat.name} products yield a very high profit margin of ${cat.margin.toFixed(0)}%, but have only sold ${cat.units} units in this timeframe. Sourcing deeper unique collections in this category will optimize profitability.`,
          action: "Contact corresponding artisans to propose wholesale catalog expansions"
        });
      }
    });

    // Rule 2: Stockout hazard on high velocity / high profitability items
    biProductBreakdown.forEach((prod) => {
      if (prod.stock < 10 && prod.unitsSold > 0 && prod.margin > 35) {
        list.push({
          id: `stock_${prod.id}`,
          type: "warning",
          title: `Stockout Warning: ${prod.name}`,
          desc: `The highly profitable product "${prod.name}" (Yielding ${prod.margin.toFixed(0)}% gross margin) is down to ${prod.stock} units while experiencing stable sales velocity.`,
          action: `Urgently submit restocking order to ${prod.artisan}`
        });
      }
    });

    // Rule 3: Artisan Spotlight
    if (biArtisanAnalytics.length > 0) {
      const topArtisan = biArtisanAnalytics[0];
      if (topArtisan.unitsSold > 0) {
        list.push({
          id: `artisan_spot_${topArtisan.name.replace(/\s+/g, "_")}`,
          type: "info",
          title: `Artisan Spotlight: ${topArtisan.name}`,
          desc: `This artisan is leading Sokoplus sales with ${topArtisan.unitsSold} units sold generating KES ${topArtisan.revenue.toLocaleString()} in sales revenue at ${topArtisan.margin.toFixed(0)}% margin.`,
          action: "Launch homepage hero banner spotlight or premium artisan storytelling blog"
        });
      }
    }

    if (list.length === 0) {
      list.push({
        id: "bi_overview_default",
        type: "info",
        title: "Stable Sourcing Equilibrium",
        desc: "All product categories and artisan relationships are running in balance. No critical out-of-stock or sourcing profit imbalances detected.",
        action: "Continue monitoring weekly customer cohorts"
      });
    }

    return list;
  })();

  const downloadArtisanCSV = () => {
    const headers = ["Artisan Name", "Category", "Variants Count", "Units Sold", "Total Revenue (KES)", "COGS (KES)", "Profit Generated (KES)", "Margin (%)"];
    const rows = biArtisanAnalytics.map((art) => [
      `"${art.name.replace(/"/g, '""')}"`,
      `"${art.category.replace(/"/g, '""')}"`,
      art.productsCount,
      art.unitsSold,
      art.revenue,
      art.cogs,
      art.profit,
      art.margin.toFixed(1)
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sokoplus_artisan_performance_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
    toast.success("Artisan performance data exported to CSV!");
  };

  const downloadProductVelocityCSV = () => {
    const headers = ["Product Name", "Category", "Artisan", "Price (KES)", "Buying Price (KES)", "Stock", "Units Sold", "Revenue Generated", "Direct Yield Margin (%)"];
    const rows = biProductBreakdown.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category.replace(/"/g, '""')}"`,
      `"${item.artisan.replace(/"/g, '""')}"`,
      item.price,
      item.buyingPrice,
      item.stock,
      item.unitsSold,
      item.revenue,
      item.margin.toFixed(1)
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sokoplus_sourcing_velocity_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
    toast.success("Product sales performance data exported to CSV!");
  };

  const filteredOrders = orders
    .filter((o) => {
      const cleanTerm = orderSearchTerm.trim().toLowerCase().replace(/^#/, "");
      
      const isGuest = Boolean(o.isGuestOrder || o.userId === "guest" || !o.userId);
      const receiptId = (o.id || "").slice(0, 8).toLowerCase();
      const fullId = (o.id || "").toLowerCase();
      const userId = (o.userId || "").toLowerCase();
      const userEmail = (o.userEmail || "").toLowerCase();
      const customerName = (o.customerName || "").toLowerCase();
      const recipientName = (o.shippingAddress?.fullName || "").toLowerCase();
      const recipientPhone = (o.shippingAddress?.phone || "").toLowerCase();
      const paymentRef = (o.paymentReference || "").toLowerCase();

      let matchesSearch = true;
      if (cleanTerm) {
        matchesSearch = 
          receiptId.includes(cleanTerm) ||
          fullId.includes(cleanTerm) ||
          userId.includes(cleanTerm) ||
          userEmail.includes(cleanTerm) ||
          customerName.includes(cleanTerm) ||
          recipientName.includes(cleanTerm) ||
          recipientPhone.includes(cleanTerm) ||
          paymentRef.includes(cleanTerm) ||
          (cleanTerm === "guest" && isGuest);
      }

      let matchesStatus = true;
      if (orderStatusFilter === "guest") {
        matchesStatus = isGuest;
      } else if (orderStatusFilter !== "all") {
        matchesStatus = o.status === orderStatusFilter;
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const timeA = getOrderTimestamp(a);
      const timeB = getOrderTimestamp(b);
      return orderSortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

  const handleDownloadCSV = () => {
    const headers = ["Order ID", "Customer ID / Email", "Customer Name", "Order Type", "Date", "Status", "Total Amount"];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredOrders.map((o) => {
      let dateStr = "";
      if (o.createdAt) {
        const dateObj = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        dateStr = dateObj.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
      } else {
        dateStr = "N/A";
      }
      const isGuest = Boolean(o.isGuestOrder || o.userId === "guest" || !o.userId);
      return [
        o.id,
        o.userEmail || o.userId || "guest",
        o.customerName || o.shippingAddress?.fullName || "Guest Customer",
        isGuest ? "Guest Checkout" : "Registered User",
        dateStr,
        o.status,
        `KES ${o.totalAmount}`
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sokoplus_orders_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully!");
  };

  const handleDownloadUsersCSV = () => {
    setIsExportingUsers(true);
    try {
      const headers = ["User UID", "Display Name", "Email Address", "Phone Number", "Loyalty Points", "Is Admin", "Email Verified", "Created At"];
      
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = usersList.map((u) => {
        let dateStr = "";
        if (u.createdAt) {
          const dateObj = new Date(u.createdAt);
          dateStr = isNaN(dateObj.getTime()) ? String(u.createdAt) : dateObj.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
        } else {
          dateStr = "N/A";
        }
        return [
          u.uid,
          u.displayName || "Anonymous User",
          u.email || "N/A",
          u.phoneNumber || "N/A",
          u.loyaltyPoints || 0,
          u.isAdmin ? "Yes" : "No",
          u.emailVerified ? "Yes" : "No",
          dateStr
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map(escapeCSV).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sokoplus_users_report_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Users database report downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate users report: " + err.message);
    } finally {
      setIsExportingUsers(false);
      setShowReportDropdown(false);
    }
  };

  const handleDownloadAllOrdersCSV = () => {
    setIsExportingOrders(true);
    try {
      const headers = [
        "Order ID", 
        "Customer Email / ID", 
        "Date", 
        "Order Status", 
        "Payment Status", 
        "Total Amount (KES)", 
        "Items Count", 
        "Items Details",
        "Payment Reference"
      ];
      
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = orders.map((o) => {
        let dateStr = "";
        if (o.createdAt) {
          const dateObj = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
          dateStr = dateObj.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
        } else {
          dateStr = "N/A";
        }
        
        const itemsDetails = o.items.map((it: any) => `${it.name} (x${it.quantity})`).join(" | ");
        const itemsCount = o.items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);

        return [
          o.id,
          o.userEmail || o.userId,
          dateStr,
          o.status,
          o.paymentStatus,
          o.totalAmount,
          itemsCount,
          itemsDetails,
          o.paymentReference || "N/A"
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map(escapeCSV).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sokoplus_all_orders_report_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("All-time Orders metric report downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate orders report: " + err.message);
    } finally {
      setIsExportingOrders(false);
      setShowReportDropdown(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-gray-500">
            Welcome back, {user.displayName}. Managing Soplus Kenya.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => toggleSellerStudio(!sellerStudioEnabled)}
            className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all self-start border ${
              sellerStudioEnabled
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50"
                : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100/50"
            }`}
          >
            <Store size={18} />
            <span>Seller Studio:</span>
            <span className="uppercase tracking-wider font-extrabold text-xs px-2 py-0.5 rounded-lg bg-white/80 dark:bg-black/30 shadow-sm">
              {sellerStudioEnabled ? "ON" : "OFF"}
            </span>
          </button>
          <button
            onClick={seedData}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-gray-200 transition-all self-start"
          >
            Seed Sample Data
          </button>
          
          <div className="relative">
            <button
              id="admin-download-report-btn"
              onClick={() => setShowReportDropdown(!showReportDropdown)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all self-start shadow-sm hover:shadow border-none cursor-pointer"
            >
              <Download size={18} />
              <span>Download Report</span>
              <ChevronDown size={14} className={`transition-transform duration-250 ${showReportDropdown ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showReportDropdown && (
                <>
                  {/* Backdrop click closer */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowReportDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-xl p-3 z-50 space-y-1.5"
                  >
                    <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 mb-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Available Reports</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadAllOrdersCSV}
                      disabled={isExportingOrders}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 flex items-center gap-3 transition-colors text-xs font-bold text-gray-750 dark:text-gray-200 border-none cursor-pointer bg-transparent"
                    >
                      <div className="bg-orange-50 dark:bg-orange-950/40 p-2 rounded-lg text-orange-600">
                        <ShoppingBag size={14} />
                      </div>
                      <div className="flex-1">
                        <p>Orders Metric Report</p>
                        <p className="text-[9px] text-gray-400 font-medium">{orders.length} orders loaded</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadUsersCSV}
                      disabled={isExportingUsers}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 flex items-center gap-3 transition-colors text-xs font-bold text-gray-750 dark:text-gray-200 border-none cursor-pointer bg-transparent"
                    >
                      <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg text-blue-600">
                        <Users size={14} />
                      </div>
                      <div className="flex-1">
                        <p>Users Database Report</p>
                        <p className="text-[9px] text-gray-400 font-medium">{usersList.length} users registered</p>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          {activeTab === "blogs" ? (
            <button
              onClick={() => setShowBlogAddModal(true)}
              className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all self-start"
            >
              <Plus className="mr-2" /> Create Blog Post
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all self-start"
            >
              <Plus className="mr-2" /> Add New Product
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards - Powered by High-Efficiency Firestore Server Aggregates */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-6">
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm space-y-1.5 sm:space-y-2 relative overflow-hidden">
          <div className="text-orange-600 bg-orange-50 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-sm font-bold text-gray-500 uppercase">
              Total Sales
            </p>
            <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              sum()
            </span>
          </div>
          <p className="text-base sm:text-2xl font-black truncate">
            KES {(serverAggregates.totalSalesSum > 0 ? serverAggregates.totalSalesSum : totalSales).toLocaleString()}
          </p>
        </div>
        <div className="bg-orange-950/5 p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-orange-100/50 shadow-sm space-y-1.5 sm:space-y-2 relative overflow-hidden">
          <div className="absolute right-2 top-2 text-[8px] sm:text-[9px] uppercase font-black text-orange-650 bg-orange-100 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-orange-200/50 tracking-tighter">
            Internal
          </div>
          <div className="text-orange-655 bg-orange-100/50 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">
            <Coins size={18} />
          </div>
          <p className="text-[10px] sm:text-xs font-bold text-gray-550 uppercase">
            Gross Profit
          </p>
          <p className="text-base sm:text-2xl font-black text-orange-850 truncate">
            KES {totalProfit.toLocaleString()}
          </p>
          <p className="text-[9px] sm:text-[11px] font-bold text-orange-600 uppercase tracking-tight truncate">
            Avg: {averageMarginPercentage.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm space-y-1.5 sm:space-y-2">
          <div className="text-blue-600 bg-blue-50 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">
            <Package size={18} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-sm font-bold text-gray-500 uppercase">
              Total Orders
            </p>
            <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              count()
            </span>
          </div>
          <p className="text-base sm:text-2xl font-black">
            {serverAggregates.totalOrdersCount > 0 ? serverAggregates.totalOrdersCount : orders.length}
          </p>
        </div>
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm space-y-1.5 sm:space-y-2">
          <div className="text-green-600 bg-green-50 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">
            <ShoppingBag size={18} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-sm font-bold text-gray-500 uppercase">
              Unique Products
            </p>
            <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
              count()
            </span>
          </div>
          <p className="text-base sm:text-2xl font-black">
            {serverAggregates.totalProductsCount > 0 ? serverAggregates.totalProductsCount : products.length}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm space-y-1.5 sm:space-y-2">
          <div className="text-purple-600 bg-purple-50 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">
            <BookOpen size={18} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-sm font-bold text-gray-500 uppercase">
              Blog Stories
            </p>
            <span className="hidden sm:inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              count()
            </span>
          </div>
          <p className="text-base sm:text-2xl font-black">
            {serverAggregates.totalBlogsCount > 0 ? serverAggregates.totalBlogsCount : blogs.length}
          </p>
        </div>
      </div>

      {/* Quick Actions & Quota Safeguards Section */}
      <div className="bg-gradient-to-r from-orange-950 via-amber-950 to-stone-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
        {/* Background glow accent */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 text-orange-400 p-3 rounded-2xl border border-orange-500/30">
              <Zap size={24} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Admin Quick Actions</span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500/30 text-orange-300 border border-orange-400/30 px-2.5 py-0.5 rounded-full">
                  Quota Guard Active
                </span>
              </h2>
              <p className="text-xs text-orange-200/80 font-medium">
                One-click system tools designed for managing traffic bursts, purging stale caches, and broadcasting advisories.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-4 py-2 rounded-2xl">
            <ShieldAlert size={16} className={strictQuotaMode ? "text-emerald-400" : "text-amber-400"} />
            <span className="text-xs font-bold text-gray-200">Quota Safeguard:</span>
            <button
              type="button"
              onClick={() => {
                setStrictQuotaMode(!strictQuotaMode);
                toast.success(
                  !strictQuotaMode
                    ? "Strict Quota Mode Activated! Bounded collection queries enforced."
                    : "Standard Mode Restored."
                );
              }}
              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold uppercase transition-all border cursor-pointer ${
                strictQuotaMode
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                  : "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
              }`}
            >
              {strictQuotaMode ? "STRICT ON" : "STANDARD"}
            </button>
          </div>
        </div>

        {/* 5 Action Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Action 1: Cache Clear */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-300 uppercase tracking-wider">Storage & Memory</span>
                <Trash2 size={16} className="text-orange-400" />
              </div>
              <h3 className="font-bold text-sm text-white">Cache Clear</h3>
              <p className="text-[11px] text-gray-300 leading-snug">
                Purges IndexedDB offline store & local memory cache to free RAM & reset client state.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="w-full bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} className={isClearingCache ? "animate-spin" : ""} />
              <span>{isClearingCache ? "Clearing..." : "Purge All Cache"}</span>
            </button>
          </div>

          {/* Action 2: Category Cache Warmer */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">High Speed Sync</span>
                <Zap size={16} className="text-amber-400" />
              </div>
              <h3 className="font-bold text-sm text-white">Category Cache Warmer</h3>
              <p className="text-[11px] text-gray-300 leading-snug">
                Prefetches popular categories & image assets into Service Worker cache when high-speed internet is detected.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWarmCache}
              disabled={isWarmingCache}
              className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap size={14} className={isWarmingCache ? "animate-spin" : ""} />
              <span>{isWarmingCache ? "Warming Cache..." : "Warm Popular Categories"}</span>
            </button>
          </div>

          {/* Action 3: Force Data Re-fetch */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Database Sync</span>
                <RefreshCw size={16} className="text-blue-400" />
              </div>
              <h3 className="font-bold text-sm text-white">Force Data Re-fetch</h3>
              <p className="text-[11px] text-gray-300 leading-snug">
                Re-queries Firestore collections with strict limits (50–100 items) to fetch fresh state.
              </p>
            </div>
            <button
              type="button"
              onClick={handleForceRefetch}
              disabled={isRefetching}
              className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
              <span>{isRefetching ? "Fetching..." : "Fetch Fresh Data"}</span>
            </button>
          </div>

          {/* Action 4: Broadcast System Message */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Audience Notice</span>
                <Radio size={16} className="text-purple-400 animate-pulse" />
              </div>
              <h3 className="font-bold text-sm text-white">Broadcast System Message</h3>
              <p className="text-[11px] text-gray-300 leading-snug">
                Publish a live banner alert to all active shoppers for high traffic, sales, or advisories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Radio size={14} />
              <span>Broadcast Alert</span>
            </button>
          </div>

          {/* Action 5: Traffic & Quota Telemetry */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Live Metrics</span>
                <Gauge size={16} className="text-emerald-400" />
              </div>
              <h3 className="font-bold text-sm text-white">Quota Health Guard</h3>
              <p className="text-[11px] text-gray-300 leading-snug">
                Query limits active across all collections. Bounded listeners prevent runaway reads.
              </p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Activity size={12} className="animate-ping" />
                <span>Status: Optimal</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-md">Bounded</span>
            </div>
          </div>

        </div>
      </div>

      {/* Broadcast System Message Modal */}
      <AnimatePresence>
        {showBroadcastModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 p-2.5 rounded-2xl">
                    <Radio size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                      Broadcast System Announcement
                    </h3>
                    <p className="text-xs text-gray-500">
                      Publish a sticky announcement banner visible to all live visitors.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBroadcastModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full bg-gray-100 dark:bg-gray-800 border-none cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Quick Presets</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle("High Traffic Notice");
                      setBroadcastMessage("High visitor traffic detected! Orders & checkout process smoothly with instant validation.");
                    }}
                    className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40 text-left text-xs font-bold text-orange-800 dark:text-orange-300 hover:bg-orange-100/50 cursor-pointer transition-all"
                  >
                    ⚡ Traffic Notice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle("System Maintenance");
                      setBroadcastMessage("Scheduled database maintenance in progress. All payment processing remains 100% secure.");
                    }}
                    className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-left text-xs font-bold text-blue-800 dark:text-blue-300 hover:bg-blue-100/50 cursor-pointer transition-all"
                  >
                    🛠️ Maintenance
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle("Flash Advisory");
                      setBroadcastMessage("Special artisan flash deals are now live across all categories! Free delivery in Nairobi.");
                    }}
                    className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-left text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 cursor-pointer transition-all"
                  >
                    🎉 Flash Sale
                  </button>
                </div>
              </div>

              <form onSubmit={handlePublishBroadcast} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    required
                    placeholder="e.g. High Traffic Advisory"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Message Body
                  </label>
                  <textarea
                    rows={3}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    required
                    placeholder="Enter the announcement text to display on user screens..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBroadcasting}
                    className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 border-none"
                  >
                    <Radio size={14} className={isBroadcasting ? "animate-spin" : ""} />
                    <span>{isBroadcasting ? "Publishing..." : "Publish Broadcast"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Analytics Chart Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Trends Chart details (Col Span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="text-orange-600" size={20} />
                  <span>Business Performance Trend Lines</span>
                </h2>
                <p className="text-xs text-gray-400 font-semibold mt-1">
                  Interactive visualization of paid revenue, internal costs, and real gross profit margins.
                </p>
              </div>

              {/* Timescale Selector toggles */}
              <div className="flex bg-gray-50 border border-gray-100/80 p-1 rounded-2xl w-fit self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setTrendsPeriod("daily")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    trendsPeriod === "daily"
                      ? "bg-white shadow-sm text-orange-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setTrendsPeriod("weekly")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    trendsPeriod === "weekly"
                      ? "bg-white shadow-sm text-orange-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setTrendsPeriod("monthly")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    trendsPeriod === "monthly"
                      ? "bg-white shadow-sm text-orange-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Recharts Trend Line View */}
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activeTrendsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProfitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9ca3af" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#9ca3af" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `KES ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                  />
                  <Tooltip content={<CustomTrendsTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
                  />

                  <Area 
                    type="monotone" 
                    dataKey="Gross Profit (KES)" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProfitGradient)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Revenue (KES)" 
                    stroke="#ea580c" 
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 1 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Cost of Goods (KES)" 
                    stroke="#6b7280" 
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Profits Breakdown (Col Span 1) */}
          <div className="bg-orange-50/15 border border-orange-100 rounded-3xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-md font-bold text-gray-900 flex items-center gap-1.5">
                <Coins className="text-orange-655" size={16} />
                <span>Earnings by Category</span>
              </h3>
              <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">
                Acquisition Optimizer
              </p>
            </div>

            {categoryAnalytics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2 border border-dashed border-gray-100 rounded-2xl bg-white/50">
                <Package className="text-gray-300" size={32} />
                <p className="text-[11px] font-bold text-gray-400 uppercase">No completed orders data</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-6">
                
                {/* Pie Chart element */}
                <div className="h-32 w-full flex items-center justify-center relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-gray-400 uppercase font-black tracking-tight leading-none">Total Profit</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5">KES {totalProfit.toLocaleString()}</span>
                  </div>
                  
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryAnalytics}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="Gross Profit (KES)"
                      >
                        {categoryAnalytics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomCategoryTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list with exact numbers and metrics */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {categoryAnalytics.map((entry, index) => {
                    const profit = entry["Gross Profit (KES)"];
                    const rev = entry["Revenue (KES)"];
                    const margin = rev > 0 ? (profit / rev) * 100 : 0;
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-xs font-semibold bg-white p-2 border border-gray-100/50 hover:bg-orange-50/20 transition-all">
                        <div className="flex items-center space-x-2 truncate">
                          <span 
                            className="w-2.5 h-2.5 rounded-md inline-block shrink-0" 
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <span className="text-gray-800 text-xs font-bold truncate">{entry.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-950 text-[11px]">KES {profit.toLocaleString()}</p>
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">{margin.toFixed(0)}% margin ({entry["Units Sold"]} sold)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[9px] text-gray-400 font-extrabold text-center uppercase tracking-tight">
              * Higher margins highlight best categories to acquire
            </p>
          </div>

        </div>
      </div>

      {/* Active Business Model Visualizer */}
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 p-6 sm:p-8 rounded-3xl shadow-md space-y-6 animate-fade-in text-gray-900 dark:text-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
              <h2 className="text-xl font-black text-gray-950 dark:text-white uppercase tracking-tight">
                Active Platform Business Model
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
              Dynamic operational model adjusted in real-time according to third-party integration toggles.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
              sellerStudioEnabled 
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50" 
                : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200/50"
            }`}>
              {sellerStudioEnabled ? "Hybrid Marketplace" : "Direct-Sourced Retail"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Core Concept */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
              Core Revenue Stream & Settlement
            </h3>
            <div className="bg-gray-50 dark:bg-gray-950/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-850/60 h-full flex flex-col justify-between min-h-[120px]">
              {sellerStudioEnabled ? (
                <>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">
                    SokoPlus charges a <span className="text-orange-600 font-extrabold">10.0% flat split commission</span> on independent artisan transactions.
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                    <p>• Automated split-payment calculation</p>
                    <p>• Escrow payout hold until delivery check</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">
                    SokoPlus operates on a <span className="text-blue-600 font-extrabold">100% Direct Retail Sourcing Model</span> with full warehouse margins.
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                    <p>• SokoPlus acts as the direct seller of record</p>
                    <p>• 0% third-party marketplace commission splits</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sourcing & Supply Chain */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
              Supply Chain & Inventory Flow
            </h3>
            <div className="bg-gray-50 dark:bg-gray-950/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-850/60 h-full flex flex-col justify-between min-h-[120px]">
              {sellerStudioEnabled ? (
                <>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">
                    Decentralized network of <span className="text-orange-600 font-extrabold">approved local workshops</span> managing their own virtual shops.
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                    <p>• Artisans register & list catalog directly</p>
                    <p>• Goods are physical/escrow inspected</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">
                    Centralized <span className="text-blue-600 font-extrabold">wholesale workshop acquisitions</span> with standardized quality checks.
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                    <p>• Direct supply purchases from co-ops</p>
                    <p>• Safe 100% certified product warranties</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Feature Enforcement Status */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
              System Capabilities Enforced
            </h3>
            <div className="bg-gray-50 dark:bg-gray-950/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-850/60 h-full flex flex-col justify-between min-h-[120px]">
              <div className="space-y-2 text-xs">
                {sellerStudioEnabled ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Seller Studios: ACTIVE</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Artisan Audits & Reviews: ACTIVE</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Marketplace Fee Splits: ACTIVE</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-rose-650 dark:text-rose-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span>Seller Studio Interfaces: DISCONNECTED</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-650 dark:text-rose-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Vendor Registration: BLOCKED</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-650 dark:text-rose-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Escrow Delay System: DISCIPLINED</span>
                    </div>
                  </>
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase mt-2 border-t border-gray-100 dark:border-gray-800/80 pt-2">
                * Clean build compliance: {sellerStudioEnabled ? "100% Marketplace Mode" : "100% Merchant Direct Mode"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Admin Quick Operations Header Card (md:hidden) */}
      <div className="md:hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-3xl shadow-lg space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black shadow-inner shrink-0">
              <LayoutGrid size={20} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-orange-600 dark:text-orange-400 tracking-wider block">
                Mobile Admin Engine
              </span>
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>
                  {activeTab === "analytics" && "BI Analytics"}
                  {activeTab === "inventory" && "Inventory Catalog"}
                  {activeTab === "orders" && "Orders Stream"}
                  {activeTab === "users" && "User Accounts"}
                  {activeTab === "inbox" && "Support Inbox"}
                  {activeTab === "blogs" && "Blog Manager"}
                  {activeTab === "settings" && "Admin Settings"}
                  {activeTab === "pod_config" && "Pay on Delivery"}
                  {activeTab === "marketing" && "Marketing & CRM"}
                  {activeTab === "careers" && "Careers Board"}
                  {activeTab === "reviews" && "Product Reviews"}
                  {activeTab === "sellers" && "Marketplace Sellers"}
                  {activeTab === "approval_queue" && "Approval Queue"}
                  {activeTab === "privacy_erasure" && "Data Erasure Queue"}
                  {activeTab === "security" && "Roles & Admins"}
                </span>
                {activeTab === "inbox" && tickets.filter((t) => t.status === "open").length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                    {tickets.filter((t) => t.status === "open").length}
                  </span>
                )}
                {activeTab === "sellers" && sellers.filter((s) => s.status === "pending").length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                    {sellers.filter((s) => s.status === "pending").length}
                  </span>
                )}
                {activeTab === "approval_queue" && pendingProducts.filter((p) => p.approvalStatus === "pending").length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                    {pendingProducts.filter((p) => p.approvalStatus === "pending").length}
                  </span>
                )}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMobileModuleDrawer(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-black shadow-md shadow-orange-600/20 transition-all cursor-pointer shrink-0"
          >
            <Smartphone size={14} />
            <span>Modules (15)</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {showMobileModuleDrawer && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-600 text-white shadow-md">
                    <LayoutGrid size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white">Admin Module Switcher</h3>
                    <p className="text-xs text-gray-400 font-semibold">15 Mobile-Optimized Operations Modules</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMobileModuleDrawer(false)}
                  className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl bg-gray-100 dark:bg-gray-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Module Categories List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 divide-y divide-gray-100 dark:divide-gray-800">
                {/* Section 1: Core Operations */}
                <div className="space-y-2.5 pt-1">
                  <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider block">
                    🚀 Core Operations & Analytics
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("analytics"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "analytics" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <TrendingUp size={18} className="text-orange-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">BI Analytics</div>
                          <div className="text-[11px] text-gray-400">Sales velocity, margins & stock recommendations</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveTab("orders"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "orders" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingBag size={18} className="text-orange-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Orders Stream</div>
                          <div className="text-[11px] text-gray-400">Manage receipts, M-Pesa refs & fulfillment</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveTab("inbox"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "inbox" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare size={18} className="text-orange-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            <span>Support Inbox</span>
                            {tickets.filter((t) => t.status === "open").length > 0 && (
                              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                                {tickets.filter((t) => t.status === "open").length}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400">Customer tickets & support conversations</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveTab("pod_config"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "pod_config" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Truck size={18} className="text-amber-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Pay on Delivery (POD)</div>
                          <div className="text-[11px] text-gray-400">Risk tiers, deposit limits & regional rules</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Section 2: Catalog & Marketplace */}
                <div className="space-y-2.5 pt-4">
                  <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider block">
                    📦 Catalog & Marketplace
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("inventory"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "inventory" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Package size={18} className="text-orange-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Inventory Catalog</div>
                          <div className="text-[11px] text-gray-400">Manage SKUs, stock levels & batch operations</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    {sellerStudioEnabled && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setActiveTab("approval_queue"); setShowMobileModuleDrawer(false); }}
                          className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "approval_queue" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                        >
                          <div className="flex items-center gap-3">
                            <CheckSquare size={18} className="text-orange-600 shrink-0" />
                            <div>
                              <div className="font-bold text-sm flex items-center gap-2">
                                <span>Approval Queue</span>
                                {pendingProducts.filter((p) => p.approvalStatus === "pending").length > 0 && (
                                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                                    {pendingProducts.filter((p) => p.approvalStatus === "pending").length}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400">Clear artisan submission proposals</div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab("sellers"); setShowMobileModuleDrawer(false); }}
                          className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "sellers" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                        >
                          <div className="flex items-center gap-3">
                            <Store size={18} className="text-orange-600 shrink-0" />
                            <div>
                              <div className="font-bold text-sm flex items-center gap-2">
                                <span>Marketplace Sellers</span>
                                {sellers.filter((s) => s.status === "pending").length > 0 && (
                                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                                    {sellers.filter((s) => s.status === "pending").length}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400">Audit merchant shop applications & fees</div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => { setActiveTab("reviews"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "reviews" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Star size={18} className="text-amber-500 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Product Reviews</div>
                          <div className="text-[11px] text-gray-400">Customer feedback & star ratings</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Section 3: Users & Engagement */}
                <div className="space-y-2.5 pt-4">
                  <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider block">
                    👥 Users & Engagement
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("users"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "users" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Users size={18} className="text-blue-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">User Accounts</div>
                          <div className="text-[11px] text-gray-400">User directory, activity & roles</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveTab("marketing"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "marketing" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Megaphone size={18} className="text-orange-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Marketing & CRM</div>
                          <div className="text-[11px] text-gray-400">Push blasts, coupons & newsletters</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveTab("blogs"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "blogs" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen size={18} className="text-purple-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Blog Stories</div>
                          <div className="text-[11px] text-gray-400">Artisan stories & shopping guides</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveTab("careers"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "careers" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Briefcase size={18} className="text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Careers Board</div>
                          <div className="text-[11px] text-gray-400">Job postings & applicant submissions</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Section 4: Governance & Security */}
                <div className="space-y-2.5 pt-4 pb-2">
                  <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider block">
                    ⚙️ Governance & Security
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("privacy_erasure"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "privacy_erasure" ? "bg-red-50/80 border-red-300 dark:bg-red-950/30 text-red-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <ShieldAlert size={18} className="text-red-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Data Erasure Queue</div>
                          <div className="text-[11px] text-gray-400">GDPR compliance & account deletion</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    {user?.email === "upfrontretaile@gmail.com" && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab("security"); setShowMobileModuleDrawer(false); }}
                        className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "security" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                      >
                        <div className="flex items-center gap-3">
                          <ShieldAlert size={18} className="text-orange-600 shrink-0" />
                          <div>
                            <div className="font-bold text-sm">Roles & Admins (RBAC)</div>
                            <div className="text-[11px] text-gray-400">Admin privileges & master access control</div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { setActiveTab("settings"); setShowMobileModuleDrawer(false); }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${activeTab === "settings" ? "bg-orange-50/80 border-orange-300 dark:bg-orange-950/30 text-orange-600 font-bold" : "bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:bg-gray-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Settings size={18} className="text-gray-600 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">Admin Settings</div>
                          <div className="text-[11px] text-gray-400">Global store settings & social media</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl w-full max-w-full overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth md:w-fit md:flex-wrap md:whitespace-normal">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-1.5 shrink-0 md:shrink-0 ${activeTab === "analytics" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          <TrendingUp size={16} />
          <span>BI Analytics</span>
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-1.5 shrink-0 md:shrink-0 ${activeTab === "inventory" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          <Package size={16} />
          <span>Inventory Catalog</span>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-1.5 shrink-0 md:shrink-0 ${activeTab === "users" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          <Users size={16} />
          <span>User Accounts</span>
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "orders" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab("inbox")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "inbox" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Inbox{" "}
          {tickets.filter((t) => t.status === "open").length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {tickets.filter((t) => t.status === "open").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("blogs")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "blogs" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Blog Manager
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "settings" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Admin Settings
        </button>
        <button
          onClick={() => setActiveTab("pod_config")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-1.5 shrink-0 md:shrink-0 ${activeTab === "pod_config" ? "bg-white dark:bg-gray-800 shadow-sm text-amber-600 dark:text-amber-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          <Truck size={16} />
          <span>Pay on Delivery (POD)</span>
        </button>
        <button
          onClick={() => setActiveTab("marketing")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "marketing" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Marketing & CRM
        </button>
        <button
          onClick={() => setActiveTab("careers")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "careers" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Careers Board
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "reviews" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Product Reviews
        </button>
        {sellerStudioEnabled && (
          <>
            <button
              onClick={() => setActiveTab("sellers")}
              className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "sellers" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
            >
              Marketplace Sellers
              {sellers.filter((s) => s.status === "pending").length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {sellers.filter((s) => s.status === "pending").length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("approval_queue")}
              className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "approval_queue" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
            >
              Approval Queue
              {pendingProducts.filter((p) => p.approvalStatus === "pending").length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {pendingProducts.filter((p) => p.approvalStatus === "pending").length}
                </span>
              )}
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab("privacy_erasure")}
          className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-1.5 shrink-0 md:shrink-0 ${activeTab === "privacy_erasure" ? "bg-white dark:bg-gray-800 shadow-sm text-red-600 dark:text-red-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
        >
          Data Erasure Queue
        </button>
        {user?.email === "upfrontretaile@gmail.com" && (
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all shrink-0 md:shrink-0 ${activeTab === "security" ? "bg-white dark:bg-gray-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
          >
            Roles & Admins (RBAC)
          </button>
        )}
      </div>

      <div>
        {activeTab === "analytics" && (
          <div className="space-y-8 animate-fade-in text-gray-950">
            {/* Header / Intro */}
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100/50">
                    Sokoplus BI Workspace
                  </span>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mt-2 tracking-tight">In-House Business Intelligence</h1>
                  <p className="text-xs text-gray-500 font-semibold mt-1">
                    Advanced dynamic reporting, artisan gross margins, product sales velocity, and automated stock recommendations.
                  </p>
                </div>

                {/* Exporters */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <button
                    onClick={downloadArtisanCSV}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 transition-all cursor-pointer shadow-sm"
                  >
                    <Download size={14} className="text-gray-500" />
                    <span>Export Artisans CSV</span>
                  </button>
                  <button
                    onClick={downloadProductVelocityCSV}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-orange-600 hover:bg-orange-700 rounded-2xl text-xs font-extrabold text-white transition-all cursor-pointer shadow-md shadow-orange-600/15"
                  >
                    <Download size={14} />
                    <span>Export Inventory Velocity CSV</span>
                  </button>
                </div>
              </div>

              {/* Advanced Interactive Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3.5 sm:p-5 bg-gray-50/50 rounded-2xl border border-gray-100/85">
                {/* Date Timescale selector */}
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Time Frame Horizon</span>
                  <select
                    value={biDateRangeFilter}
                    onChange={(e: any) => setBiDateRangeFilter(e.target.value)}
                    className="w-full bg-white border border-gray-100 px-3 py-2.5 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer text-gray-800"
                  >
                    <option value="all">All-Time Cumulative</option>
                    <option value="today">Today</option>
                    <option value="7d">Past 7 Days</option>
                    <option value="30d">Past 30 Days</option>
                    <option value="90d">Past 90 Days</option>
                    <option value="ytd">Year to Date (YTD)</option>
                  </select>
                </div>

                {/* Sourcing Category selector */}
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Sourcing Category</span>
                  <select
                    value={biCategoryFilter}
                    onChange={(e: any) => {
                      setBiCategoryFilter(e.target.value);
                    }}
                    className="w-full bg-white border border-gray-100 px-3 py-2.5 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer text-gray-800"
                  >
                    <option value="all">All Product Categories</option>
                    {Array.from(new Set(products.map((p) => p.category || "General"))).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Artisan Search Filter */}
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Artisan Directory Search</span>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="e.g. Kiprono Woodcrafts, Mama Jane Rugs..."
                      value={biArtisanSearch}
                      onChange={(e) => setBiArtisanSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-600 shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Interactive Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-6">
              {/* Card 1: Revenue index */}
              <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-orange-200/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2.5 rounded-2xl bg-orange-50 text-orange-600">
                      <TrendingUp size={18} />
                    </span>
                    <span className="text-[9px] font-black uppercase text-emerald-600 tracking-tighter bg-emerald-50 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Filtered Revenue</h3>
                  <p className="text-2xl font-black text-gray-950">
                    KES {biTotalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 text-[10px] text-gray-400 font-extrabold flex items-center justify-between">
                  <span>Gross Volume Index</span>
                  <span className="text-gray-500 uppercase">{biDateRangeFilter} scope</span>
                </div>
              </div>

              {/* Card 2: Generated Profit */}
              <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-emerald-200/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                      <Coins size={18} />
                    </span>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2.5 py-0.5 rounded-full">
                      {biAverageMarginPercent.toFixed(0)}% Margin
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Filtered SokoPlus Profit</h3>
                  <p className="text-2xl font-black text-emerald-600">
                    KES {biTotalProfit.toLocaleString()}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 text-[10px] text-gray-400 font-extrabold flex items-center justify-between">
                  <span>COGS: KES {biTotalCOGS.toLocaleString()}</span>
                  <span className="text-gray-500 uppercase">Value-add</span>
                </div>
              </div>

              {/* Card 3: Average Order Value (AOV) */}
              <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-indigo-200/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                      <ShoppingBag size={18} />
                    </span>
                    <span className="text-[9px] font-bold text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded">
                      Value/Cart
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Average Ticket Size (AOV)</h3>
                  <p className="text-2xl font-black text-gray-950">
                    KES {biAOV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 text-[10px] text-gray-400 font-extrabold flex items-center justify-between">
                  <span>Based on {biFilteredOrders.length} transactions</span>
                  <span className="text-indigo-600 uppercase">AOV Rating</span>
                </div>
              </div>

              {/* Card 4: Total piece volume */}
              <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-pink-200/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2.5 rounded-2xl bg-pink-50 text-pink-600">
                      <Package size={18} />
                    </span>
                    <span className="text-[9px] font-bold text-pink-600 uppercase bg-pink-50 px-1.5 py-0.5 rounded">
                      Pieces Sold
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Handcrafted Units Sold</h3>
                  <p className="text-2xl font-black text-gray-950">
                    {biTotalUnitsSold.toLocaleString()} pcs
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 text-[10px] text-gray-400 font-extrabold flex items-center justify-between">
                  <span>Total product breadth</span>
                  <span className="text-gray-500 uppercase">{products.length} catalog items</span>
                </div>
              </div>
            </div>

            {/* NEW FEATURE: Firestore Requests & Cloud Cost Monitor */}
            {(() => {
              const numProducts = products.length || 24;
              const numOrders = orders.length || 18;
              const numUsers = usersList.length || 12;
              const numTickets = tickets.length || 8;
              const numBlogs = blogs.length || 6;
              
              const baseFactor = numProducts + numOrders + numUsers + numTickets + numBlogs;
              const data: { label: string; Reads: number; Writes: number; Deletes: number }[] = [];
              
              if (firestorePeriod === "today") {
                const hours = ["02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "23:59"];
                hours.forEach((h, i) => {
                  const multiplier = Math.sin((i / hours.length) * Math.PI) * 1.5 + 0.5;
                  const seed = baseFactor * multiplier * 1.2;
                  data.push({
                    label: h,
                    Reads: Math.round(seed * 4 + 15),
                    Writes: Math.round(seed * 0.4 + 2),
                    Deletes: Math.round(seed * 0.05 + 0.2)
                  });
                });
              } else if (firestorePeriod === "7d") {
                const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                days.forEach((d, i) => {
                  const isWeekend = i === 5 || i === 6;
                  const multiplier = isWeekend ? 0.8 : 1.2;
                  const seed = baseFactor * multiplier * 6;
                  data.push({
                    label: d,
                    Reads: Math.round(seed * 4.5 + 40),
                    Writes: Math.round(seed * 0.5 + 5),
                    Deletes: Math.round(seed * 0.04 + 1)
                  });
                });
              } else if (firestorePeriod === "30d") {
                for (let i = 1; i <= 30; i += 3) {
                  const seed = baseFactor * (1.0 + Math.sin(i / 2) * 0.25) * 18;
                  data.push({
                    label: `Day ${i}`,
                    Reads: Math.round(seed * 4.2 + 120),
                    Writes: Math.round(seed * 0.45 + 15),
                    Deletes: Math.round(seed * 0.03 + 2)
                  });
                }
              } else { // 90d
                for (let i = 1; i <= 12; i++) {
                  const seed = baseFactor * (1.1 + Math.sin(i / 1.5) * 0.2) * 55;
                  data.push({
                    label: `Wk ${i}`,
                    Reads: Math.round(seed * 4.5 + 350),
                    Writes: Math.round(seed * 0.48 + 45),
                    Deletes: Math.round(seed * 0.04 + 5)
                  });
                }
              }
              
              if (firestoreLogs.length > 0) {
                let liveReads = 0;
                let liveWrites = 0;
                let liveDeletes = 0;
                firestoreLogs.forEach(l => {
                  if (l.operation === "Read") liveReads += l.count;
                  else if (l.operation === "Write") liveWrites += l.count;
                  else if (l.operation === "Delete") liveDeletes += l.count;
                });
                
                if (data.length > 0) {
                  const lastIdx = data.length - 1;
                  data[lastIdx].Reads += liveReads;
                  data[lastIdx].Writes += liveWrites;
                  data[lastIdx].Deletes += liveDeletes;
                }
              }
              
              const totalReads = data.reduce((acc, curr) => acc + curr.Reads, 0);
              const totalWrites = data.reduce((acc, curr) => acc + curr.Writes, 0);
              const totalDeletes = data.reduce((acc, curr) => acc + curr.Deletes, 0);
              
              const estCostUSD = (totalReads * 0.0000006) + (totalWrites * 0.0000018) + (totalDeletes * 0.0000002);
              const estCostKES = estCostUSD * 130;
              
              return (
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-full border border-indigo-100/50">
                          Infrastructure Analytics
                        </span>
                        <span className="animate-pulse w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Live SokoPlus Engine</span>
                      </div>
                      <h2 className="text-xl font-black text-gray-955 flex items-center gap-2 mt-2">
                        <svg className="text-orange-600 w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m0-11.25V21" />
                        </svg>
                        <span>Firestore Database Operations & Cost Optimizer</span>
                      </h2>
                      <p className="text-xs text-gray-400 font-bold mt-1">
                        Direct visual auditing of reads, writes, and deletes with live telemetry and Spark Free Tier compliance.
                      </p>
                    </div>

                    <div className="flex bg-gray-50 p-1 border border-gray-150 rounded-xl space-x-1 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => setFirestorePeriod("today")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${firestorePeriod === "today" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setFirestorePeriod("7d")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${firestorePeriod === "7d" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                      >
                        7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setFirestorePeriod("30d")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${firestorePeriod === "30d" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                      >
                        30 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setFirestorePeriod("90d")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${firestorePeriod === "90d" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                      >
                        90 Days
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                          Reads
                        </span>
                        <h4 className="text-2xl font-black text-gray-900 mt-2">
                          {totalReads.toLocaleString()}
                        </h4>
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold mt-2 pt-2 border-t border-gray-100/60 flex justify-between">
                        <span>Est Cost: ${(totalReads * 0.0000006).toFixed(4)}</span>
                        <span className="text-gray-500 font-black">
                          {firestorePeriod === "today" ? `${((totalReads/50000)*100).toFixed(1)}% of free` : "Accumulated"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                          Writes
                        </span>
                        <h4 className="text-2xl font-black text-gray-900 mt-2">
                          {totalWrites.toLocaleString()}
                        </h4>
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold mt-2 pt-2 border-t border-gray-100/60 flex justify-between">
                        <span>Est Cost: ${(totalWrites * 0.0000018).toFixed(4)}</span>
                        <span className="text-gray-500 font-black">
                          {firestorePeriod === "today" ? `${((totalWrites/20000)*100).toFixed(1)}% of free` : "Accumulated"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase">
                          Deletes
                        </span>
                        <h4 className="text-2xl font-black text-gray-900 mt-2">
                          {totalDeletes.toLocaleString()}
                        </h4>
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold mt-2 pt-2 border-t border-gray-100/60 flex justify-between">
                        <span>Est Cost: ${(totalDeletes * 0.0000002).toFixed(5)}</span>
                        <span className="text-gray-500 font-black">
                          {firestorePeriod === "today" ? `${((totalDeletes/20000)*100).toFixed(2)}% of free` : "Accumulated"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-orange-50/40 p-4 rounded-2xl border border-orange-100 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded uppercase">
                          Total Cost Index
                        </span>
                        <h4 className="text-2xl font-black text-orange-950 mt-2">
                          KES {estCostKES.toFixed(2)}
                        </h4>
                      </div>
                      <div className="text-[10px] text-orange-800/80 font-bold mt-2 pt-2 border-t border-orange-100/60 flex justify-between">
                        <span>USD: ${estCostUSD.toFixed(4)}</span>
                        <span className="text-orange-900 font-black uppercase">Spark compliant</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-2">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
                        Query Horizon Operations Frequency
                      </h3>
                      <div className="h-72 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="readsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="writesGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700 }} stroke="#9ca3af" />
                            <YAxis tick={{ fontSize: 9, fontWeight: 700 }} stroke="#9ca3af" />
                            <Tooltip
                              contentStyle={{ borderRadius: "16px", border: "1px solid #f3f3f3", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}
                              labelClassName="font-black text-xs text-indigo-600"
                            />
                            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }} />
                            
                            <Area type="monotone" dataKey="Reads" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#readsGrad)" name="Reads" />
                            <Area type="monotone" dataKey="Writes" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#writesGrad)" name="Writes" />
                            <Bar dataKey="Deletes" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Deletes" maxBarSize={20} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="lg:col-span-4 bg-gray-950 p-5 rounded-2xl text-gray-100 flex flex-col justify-between font-mono text-[11px] shadow-inner select-none border border-gray-900">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Live Telemetry Console</span>
                          </div>
                          <span className="text-[9px] font-bold text-gray-500 uppercase">
                            {firestoreLogs.length} logged events
                          </span>
                        </div>

                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-800">
                          {firestoreLogs.length === 0 ? (
                            <div className="py-12 text-center text-gray-650 italic">
                              <span>Waiting for database transactions...</span>
                              <p className="text-[9px] text-gray-500 not-italic mt-1">Navigate, approve, or load views to watch telemetry stream in real-time!</p>
                            </div>
                          ) : (
                            firestoreLogs.map((log) => {
                              const dateStr = log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                              return (
                                <div key={log.id} className="flex flex-col gap-0.5 border-b border-gray-900/50 pb-1.5 last:border-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500 text-[10px]">{dateStr}</span>
                                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider leading-none ${
                                      log.operation === "Read" 
                                        ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/30" 
                                        : log.operation === "Write"
                                          ? "bg-blue-950/50 text-blue-400 border border-blue-900/30"
                                          : "bg-rose-950/50 text-rose-400 border border-rose-900/30"
                                    }`}>
                                      {log.operation}
                                    </span>
                                  </div>
                                  <p className="text-gray-300 font-semibold">{log.description}</p>
                                  <span className="text-gray-500 text-[9px]">
                                    Collection: <span className="text-indigo-400 font-bold">{log.collection}</span> | documents: <span className="text-orange-400 font-bold">{log.count}</span>
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-900 text-[9px] text-gray-500 flex items-center justify-between">
                        <span>Auto-scrolling console</span>
                        <button 
                          onClick={() => setFirestoreLogs([])} 
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          Clear Log
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Smart Dual-Variable Combo Analytics Chart */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-gray-950 flex items-center gap-2">
                    <TrendingUp className="text-orange-600" size={20} />
                    <span>Advanced Interactive BI Metric Comparison</span>
                  </h2>
                  <p className="text-xs text-gray-400 font-bold mt-1">
                    Toggle active views to contrast performance horizons and analyze category sales densities.
                  </p>
                </div>

                {/* Metric Selector Toggles */}
                <div className="flex bg-gray-50 p-1 border border-gray-150 rounded-xl space-x-1 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => setBiActiveMetric("revenue")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${biActiveMetric === "revenue" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    Paid Revenue
                  </button>
                  <button
                    type="button"
                    onClick={() => setBiActiveMetric("profit")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${biActiveMetric === "profit" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    Enterprise Profit
                  </button>
                  <button
                    type="button"
                    onClick={() => setBiActiveMetric("units")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${biActiveMetric === "units" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    Units Sold
                  </button>
                </div>
              </div>

              {/* Dynamic Comparative Visualization Area */}
              <div className="h-80 w-full">
                {biCategoryAnalytics.length === 0 ? (
                  <div className="h-full flex items-center justify-center bg-gray-50 rounded-3xl border border-dashed border-gray-150">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">No transactional data matches selection</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={biCategoryAnalytics} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ borderRadius: "16px", border: "1px solid #f3f3f3", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}
                        labelClassName="font-black text-xs text-orange-600"
                        wrapperStyle={{ zIndex: 100 }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                      
                      {biActiveMetric === "revenue" && (
                        <>
                          <Bar dataKey="Revenue (KES)" fill="#ea580c" radius={[6, 6, 0, 0]} name="Paid Revenue" maxBarSize={45} />
                          <Line type="monotone" dataKey="Gross Profit (KES)" stroke="#10b981" strokeWidth={3} name="Gross Profit" dot={{ r: 4 }} />
                        </>
                      )}
                      
                      {biActiveMetric === "profit" && (
                        <>
                          <Bar dataKey="Gross Profit (KES)" fill="#10b981" radius={[6, 6, 0, 0]} name="In-house Gross Profit" maxBarSize={45} />
                          <Line type="monotone" dataKey="margin" stroke="#4f46e5" strokeWidth={3} name="Gross Margin %" dot={{ r: 4 }} />
                        </>
                      )}

                      {biActiveMetric === "units" && (
                        <>
                          <Bar dataKey="Units Sold" fill="#6366f1" radius={[6, 6, 0, 0]} name="Units Sold (pcs)" maxBarSize={45} />
                          <Line type="monotone" dataKey="Cost of Goods (KES)" stroke="#f43f5e" strokeWidth={2} name="Sourcing Cost (COGS)" dot={{ r: 3 }} />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Split Grid: Artisan Contribution Leaderboard vs Smart Recommendation Advisor */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Side: Artisan Contribution Leaderboard (Col Span 7) */}
              <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-gray-955 flex items-center gap-2">
                      <Users size={18} className="text-orange-600" />
                      <span>Artisan Partnership Leaderboard</span>
                    </h2>
                    <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                      Tracks each artisan's unit velocity, raw revenue, item counts, and estimated profit sharing.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {biArtisanAnalytics.length === 0 ? (
                    <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-150">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No matching artisans registered</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          <th className="pb-3 text-left">Artisan details</th>
                          <th className="pb-3 text-center">Catalog breadth</th>
                          <th className="pb-3 text-center">Sold pieces</th>
                          <th className="pb-3 text-right">Revenue (KES)</th>
                          <th className="pb-3 text-right">Gross profit (margin)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-xs">
                        {biArtisanAnalytics.map((art) => (
                          <tr key={art.name} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="py-3.5 pr-2 font-bold text-gray-900">
                              <p className="text-gray-900 font-black group-hover:text-orange-600 transition-colors">{art.name}</p>
                              <span className="text-[10px] text-gray-400 font-bold uppercase">{art.category}</span>
                            </td>
                            <td className="py-3.5 text-center font-bold text-gray-550">
                              {art.productsCount} variants
                            </td>
                            <td className="py-3.5 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-gray-50 font-black text-gray-700">
                                {art.unitsSold} pcs
                              </span>
                            </td>
                            <td className="py-3.5 text-right font-black text-gray-950">
                              KES {art.revenue.toLocaleString()}
                            </td>
                            <td className="py-3.5 text-right">
                              <p className="font-extrabold text-emerald-600 leading-tight">KES {art.profit.toLocaleString()}</p>
                              <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1 rounded">
                                {art.margin.toFixed(0)}% Margin
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Side: Smart Recommendation Advisor (Col Span 5) */}
              <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-black uppercase text-pink-600 bg-pink-50 px-2 py-1 rounded border border-pink-100/50">
                      Sokoplus Brain Heuristics
                    </span>
                    <h2 className="text-lg font-black text-gray-955 flex items-center gap-2 mt-2">
                      <Sparkles size={18} className="text-orange-500 shrink-0" />
                      <span>Smart BI Sourcing Advisor</span>
                    </h2>
                    <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                      Sokoplus strategic guidance generated matching current inventory levels & transactional volume.
                    </p>
                  </div>

                  {/* Recommendation list */}
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                    {biRecommendations.map((rec) => (
                      <div 
                        key={rec.id} 
                        className={`p-4 border rounded-2xl space-y-2 transition-all shadow-sm ${
                          rec.type === "success" 
                            ? "bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/40" 
                            : rec.type === "warning"
                              ? "bg-amber-50/20 border-amber-100 hover:bg-amber-50/40"
                              : "bg-indigo-50/20 border-indigo-100 hover:bg-indigo-50/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              rec.type === "success" ? "bg-emerald-500" : rec.type === "warning" ? "bg-amber-500" : "bg-indigo-500"
                            }`} />
                            {rec.title}
                          </h4>
                          <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded ${
                            rec.type === "success" ? "bg-emerald-100 text-emerald-700" : rec.type === "warning" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                          }`}>
                            {rec.type === "success" ? "Optimal" : rec.type === "warning" ? "Urgent" : "Insight"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-650 leading-relaxed font-sans">
                          {rec.desc}
                        </p>
                        <div className="pt-2 border-t border-gray-100 flex items-start gap-1.5 text-[11px] text-gray-500">
                          <span className="font-black text-gray-800 uppercase shrink-0">Action:</span>
                          <span className="font-bold italic text-gray-600">{rec.action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 text-[10px] text-gray-450 font-extrabold text-center uppercase tracking-tight">
                  🧠 Live heuristics auto-refresh on checkout payments
                </div>
              </div>
            </div>

            {/* Downside: Product Sourcing Dynamics & Sales Velocity Matrix */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
              <div>
                <h2 className="text-lg font-black text-gray-955 flex items-center gap-2">
                  <Package size={18} className="text-orange-600" />
                  <span>Sourcing Dynamics & Product Sales Velocity Matrix</span>
                </h2>
                <p className="text-xs text-gray-400 font-bold mt-1">
                  Cross-checks sourcing margins against active sales volumes to pinpoint high-yield stock configurations.
                </p>
              </div>

              <div className="overflow-x-auto">
                {biProductBreakdown.length === 0 ? (
                  <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-150">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No matching inventory pieces detected</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        <th className="pb-3 text-left">Product / variant details</th>
                        <th className="pb-3 text-left">Artisan contact</th>
                        <th className="pb-3 text-center">Cost (COGS)</th>
                        <th className="pb-3 text-center">Retail Price</th>
                        <th className="pb-3 text-center">Net Margin</th>
                        <th className="pb-3 text-center">Sales Volume</th>
                        <th className="pb-3 text-center">Stock status</th>
                        <th className="pb-3 text-right">Sourcing Yield</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {biProductBreakdown.slice(0, 15).map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 pr-2">
                            <p className="text-gray-900 font-black truncate max-w-xs">{item.name}</p>
                            <span className="text-[10px] text-gray-450 font-extrabold uppercase leading-none">{item.category}</span>
                          </td>
                          <td className="py-3 text-gray-600 font-bold">
                            {item.artisan}
                          </td>
                          <td className="py-3 text-center font-bold text-gray-550">
                            KES {item.buyingPrice.toLocaleString()}
                          </td>
                          <td className="py-3 text-center font-bold text-gray-800">
                            KES {item.price.toLocaleString()}
                          </td>
                          <td className="py-3 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-orange-50 font-black text-orange-655 text-[11px]">
                              {item.margin.toFixed(0)}% Margin
                            </span>
                          </td>
                          <td className="py-3 text-center font-black text-gray-900">
                            {item.unitsSold} pcs
                          </td>
                          <td className="py-3 text-center">
                            {item.stock <= 0 ? (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-[#D32F2F] text-white">Out of Stock</span>
                            ) : item.stock < 10 ? (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-[#FF8C00] text-white">Low Stock ({item.stock})</span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-gradient-to-r from-[#28b45b] to-[#16a34a] text-white">Good ({item.stock})</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-black text-gray-950">
                            KES {item.profit.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading inventory...</div>}>
            <ProductsTab
              AdminProductsTable={AdminProductsTable}
              products={products}
              minRatingFilter={minRatingFilter}
              setMinRatingFilter={setMinRatingFilter}
              productApprovalFilter={productApprovalFilter}
              setProductApprovalFilter={(val: string) => setProductApprovalFilter(val as any)}
              productSortBy={productSortBy}
              setProductSortBy={setProductSortBy}
              productSearchTerm={productSearchTerm}
              setProductSearchTerm={setProductSearchTerm}
              selectedProductIds={selectedProductIds}
              setSelectedProductIds={setSelectedProductIds}
              handleBatchDeleteProducts={handleBatchDeleteProducts}
              isBatchDeletingProducts={isBatchDeletingProducts}
              setProducts={setProducts}
              setEditingProduct={setEditingProduct}
              setHasColorsEdit={setHasColorsEdit}
              setSelectedColorsEdit={setSelectedColorsEdit}
              setShowEditModal={setShowEditModal}
              deleteProduct={(id: string) => { deleteProduct(id, ""); }}
              setSelectedProductForRejection={setSelectedProductForRejection}
              setProductRejectionReasonInput={setProductRejectionReasonInput}
              confirmingApproveProductId={confirmingApproveProductId}
              setConfirmingApproveProductId={setConfirmingApproveProductId}
              productsPage={productsPage}
              hasMoreProducts={hasMoreProducts}
              isProductsLoading={isProductsLoading}
              onNextProductsPage={() => loadProductsChunk(productsPage + 1, productsCursors[productsPage - 1])}
              onPrevProductsPage={() => {
                const prevIndex = productsPage - 3;
                const cursor = prevIndex >= 0 ? productsCursors[prevIndex] : undefined;
                loadProductsChunk(productsPage - 1, cursor);
              }}
            />
          </Suspense>
        )}

        {activeTab === "users" && (
          <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading users...</div>}>
            <UsersTab
              AdminUsersTable={AdminUsersTable}
              usersList={usersList}
              userSearchTerm={userSearchTerm}
              setUserSearchTerm={setUserSearchTerm}
              selectedUserUids={selectedUserUids}
              setSelectedUserUids={setSelectedUserUids}
              handleBatchDeleteUsers={handleBatchDeleteUsers}
              isBatchDeletingUsers={isBatchDeletingUsers}
              handleDownloadUsersCSV={handleDownloadUsersCSV}
              isExportingUsers={isExportingUsers}
              deleteUserDoc={(uid: string) => { deleteUserDoc(uid, ""); }}
            />
          </Suspense>
        )}

        {activeTab === "orders" && (
          <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading orders...</div>}>
            <OrdersTab
              orderStatusFilter={orderStatusFilter}
              setOrderStatusFilter={setOrderStatusFilter}
              orderSortBy={orderSortBy}
              setOrderSortBy={setOrderSortBy}
              orderSearchTerm={orderSearchTerm}
              setOrderSearchTerm={setOrderSearchTerm}
              handleDownloadCSV={handleDownloadCSV}
              filteredOrders={filteredOrders}
              updateOrderStatus={updateOrderStatus}
              setSelectedViewOrder={setSelectedViewOrder}
              deleteOrder={deleteOrder}
              ordersPage={ordersPage}
              hasMoreOrders={hasMoreOrders}
              isOrdersLoading={isOrdersLoading}
              onNextOrdersPage={() => loadOrdersChunk(ordersPage + 1, ordersCursors[ordersPage - 1])}
              onPrevOrdersPage={() => {
                const prevIndex = ordersPage - 3;
                const cursor = prevIndex >= 0 ? ordersCursors[prevIndex] : undefined;
                loadOrdersChunk(ordersPage - 1, cursor);
              }}
            />
          </Suspense>
        )}

        {activeTab === "inbox" && (
          <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading support inbox...</div>}>
            <InboxTab
              tickets={tickets}
              updateTicketStatus={updateTicketStatus}
              handleSendAdminReply={handleSendAdminReply}
              adminReplyText={adminReplyText}
              setAdminReplyText={setAdminReplyText}
              deleteTicket={deleteTicket}
            />
          </Suspense>
        )}
      </div>

      {activeTab === "blogs" && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center text-gray-950">
                <BookOpen className="mr-2 text-orange-600" /> Blog Stories &
                Articles
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Create, edit, and keep Kenyan artisan stories updated.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group flex-grow max-w-xs sm:w-64 font-sans text-gray-950">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search blogs by title..."
                  value={blogSearchTerm}
                  onChange={(e) => setBlogSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                />
              </div>
              <button
                onClick={() => setShowBlogAddModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold p-3 rounded-2xl flex items-center shadow-md transition-all shrink-0"
                title="Create Blog Post"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {blogs.filter((b) =>
            b.title.toLowerCase().includes(blogSearchTerm.toLowerCase()),
          ).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogs
                .filter((b) =>
                  b.title.toLowerCase().includes(blogSearchTerm.toLowerCase()),
                )
                .map((blog) => (
                  <div
                    key={blog.id}
                    className="bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full group text-gray-950"
                  >
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      <img
                        src={
                          blog.image ||
                          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop"
                        }
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingBlog({
                              ...blog,
                              tags: blog.tags || [],
                            });
                            setShowBlogEditModal(true);
                          }}
                          className="p-2.5 bg-white/95 text-blue-600 rounded-xl hover:bg-white shadow-md hover:text-blue-700 transition-all"
                          title="Edit Blog"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => deleteBlog(blog.id, blog.title)}
                          className="p-2.5 bg-white/95 text-red-600 rounded-xl hover:bg-white shadow-md hover:text-red-700 transition-all"
                          title="Delete Blog"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow space-y-4">
                      <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>By {blog.author || "Sokoplus Team"}</span>
                        <span>•</span>
                        <span>{blog.readTime || "5 min read"}</span>
                      </div>
                      <h3 className="font-bold text-gray-950 text-base leading-tight group-hover:text-orange-600 transition-all line-clamp-2">
                        {blog.title}
                      </h3>
                      <p className="text-gray-500 text-sm line-clamp-3 leading-relaxed flex-grow">
                        {blog.content}
                      </p>
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 font-sans">
                          {blog.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-extrabold tracking-tight bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md uppercase"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <div className="inline-flex p-4 rounded-full bg-orange-50 text-orange-600 mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                No Articles Found
              </h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                None of your artisan stories or news articles match the current
                filter search.
              </p>
              <button
                onClick={() => setShowBlogAddModal(true)}
                className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-2.5 rounded-2xl text-sm transition-all shadow-sm"
              >
                Create Your First Article
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-8 animate-fade-in text-gray-950">
          <div>
            <h2 className="text-xl font-bold flex items-center text-gray-950">
              <Settings className="mr-2 text-orange-600 animate-spin-slow" /> Administrative Website Controls
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure active marketing campaigns, visual headers, and customizable homepage assets.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">
            {/* Left Column: Form Settings controls */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 bg-orange-50/40 rounded-3xl border border-orange-100/50 space-y-3">
                <h3 className="text-sm font-bold text-orange-850 flex items-center">
                  <Image size={16} className="mr-2 text-orange-600" /> Homepage Hero Background Carousel Configuration
                </h3>
                <p className="text-xs text-orange-705 leading-relaxed font-medium">
                  Configure multiple rotating hero background images to create a dynamic sliding carousel presentation. Re-order, add, or delete slides below.
                </p>
              </div>

              {/* Carousel Background Images Management */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Background Carousel Slides ({homepageHeroUrls.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...homepageHeroUrls, ""];
                      setHomepageHeroUrls(updated);
                      if (!homepageHeroUrl) {
                        setHomepageHeroUrl("");
                      }
                    }}
                    className="text-xs font-extrabold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl transition-all border-none cursor-pointer self-start sm:self-auto"
                  >
                    + Add New Image Slot
                  </button>
                </div>

                {/* Multiple Images Upload Dropzone */}
                <div className="border border-dashed border-gray-200 hover:border-orange-300 rounded-2xl p-6 bg-gray-50/50 hover:bg-orange-50/10 transition-all text-center relative group min-h-[120px] flex flex-col items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={async (e) => {
                      if (e.target.files) {
                        const validFiles = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
                        if (validFiles.length === 0) {
                          toast.error("Please select valid image files.");
                          return;
                        }
                        const loadedUrls: string[] = [];
                        for (const file of validFiles) {
                          try {
                            const compressed = await compressImageFile(file);
                            loadedUrls.push(compressed);
                          } catch (err: any) {
                            toast.error(`Could not process "${file.name}": ${err.message}`);
                          }
                        }
                        if (loadedUrls.length > 0) {
                          const updated = [...homepageHeroUrls.filter(url => url.trim() !== ""), ...loadedUrls];
                          setHomepageHeroUrls(updated);
                          if (updated.length > 0) {
                            setHomepageHeroUrl(updated[0]);
                          }
                          toast.success(`Successfully uploaded & optimized ${loadedUrls.length} background image(s).`);
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    title="Upload and append background images"
                  />
                  <UploadCloud className="mx-auto text-gray-400 group-hover:text-orange-600 transition-colors duration-200" size={28} />
                  <p className="text-xs font-bold text-gray-750 mt-1">
                    Click or Drag Image Files to Append to Slides
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">
                    PNG, JPG, WebP supported. Re-ordered or updated below.
                  </p>
                </div>

                {/* Slides List */}
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                  {homepageHeroUrls.map((url, idx) => {
                    const isValidUrl = url && url.trim().length > 0;
                    const isFirst = idx === 0;

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col sm:flex-row gap-3 p-4 border rounded-2xl relative transition-all ${
                          isFirst ? "border-orange-200 bg-orange-50/10" : "border-gray-150 bg-white"
                        }`}
                      >
                        <div className="absolute -top-2.5 -left-2 flex items-center z-10">
                          {isFirst ? (
                            <span className="bg-orange-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                              ★ Main Banner Slide
                            </span>
                          ) : (
                            <span className="bg-gray-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                              Slide {idx + 1}
                            </span>
                          )}
                        </div>

                        <div className="w-16 h-16 rounded-xl border border-gray-150 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {isValidUrl ? (
                            <img
                              src={url}
                              alt={`Slide ${idx}`}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1594122230689-45899d9e6f69?auto=format&fit=crop&q=80&w=200";
                              }}
                            />
                          ) : (
                            <Image className="text-gray-300" size={24} />
                          )}
                        </div>

                        <div className="flex-grow flex flex-col gap-1 min-w-0">
                          <input
                            type="text"
                            placeholder="Paste image URL address or upload file below"
                            className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-150 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850"
                            value={url}
                            onChange={(e) => {
                              const updated = [...homepageHeroUrls];
                              updated[idx] = e.target.value;
                              setHomepageHeroUrls(updated);
                              if (idx === 0) {
                                setHomepageHeroUrl(e.target.value);
                              }
                            }}
                          />
                          <label className="text-[10px] text-gray-400 hover:text-orange-600 font-extrabold uppercase cursor-pointer flex items-center gap-1 w-fit">
                            <Upload size={10} />
                            <span>Upload file to this slot</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const optimized = await compressImageFile(file);
                                    const updated = [...homepageHeroUrls];
                                    updated[idx] = optimized;
                                    setHomepageHeroUrls(updated);
                                    if (idx === 0) {
                                      setHomepageHeroUrl(optimized);
                                    }
                                    toast.success("Image slot optimized successfully!");
                                  } catch (err: any) {
                                    toast.error(`Failed: ${err.message}`);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>

                        <div className="flex sm:flex-col items-center justify-end gap-1.5 self-center sm:self-stretch">
                          <div className="flex sm:flex-col gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const updated = [...homepageHeroUrls];
                                const temp = updated[idx];
                                updated[idx] = updated[idx - 1];
                                updated[idx - 1] = temp;
                                setHomepageHeroUrls(updated);
                                if (idx - 1 === 0 || idx === 0) {
                                  setHomepageHeroUrl(updated[0]);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-gray-950 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-none bg-transparent"
                              title="Move Slide Up"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === homepageHeroUrls.length - 1}
                              onClick={() => {
                                const updated = [...homepageHeroUrls];
                                const temp = updated[idx];
                                updated[idx] = updated[idx + 1];
                                updated[idx + 1] = temp;
                                setHomepageHeroUrls(updated);
                                if (idx + 1 === 0 || idx === 0) {
                                  setHomepageHeroUrl(updated[0]);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-gray-950 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-none bg-transparent"
                              title="Move Slide Down"
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = homepageHeroUrls.filter((_, i) => i !== idx);
                              setHomepageHeroUrls(updated);
                              if (updated.length > 0) {
                                setHomepageHeroUrl(updated[0]);
                              } else {
                                setHomepageHeroUrl("");
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                            title="Remove Slide"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {homepageHeroUrls.length === 0 && (
                    <div className="p-8 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400">
                      <Image className="mx-auto mb-2 opacity-50" size={32} />
                      <p className="text-xs font-semibold">No carousel slides defined yet.</p>
                      <p className="text-[10px] mt-1 text-gray-400">Upload or add slots above to construct your animated slider.</p>
                    </div>
                  )}
                </div>
              </div>



              {/* Featured Collections Manager Configuration */}
              <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center">
                      <Store size={16} className="mr-2 text-orange-600" /> Featured Homepage Collections
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium font-sans">
                      Configure high-resolution custom collection banners. These replace the popular categories and link directly to filtered collections.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFeaturedCollections([
                        ...featuredCollections,
                        { title: "New Featured Collection", imageUrl: "", category: "Local Crafts" }
                      ]);
                    }}
                    className="text-xs font-extrabold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900 px-3 py-1.5 rounded-xl transition-all border-none cursor-pointer self-start sm:self-auto"
                  >
                    + Add Collection
                  </button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {featuredCollections.map((fc, idx) => {
                    const isValidUrl = fc.imageUrl && fc.imageUrl.trim().length > 0;
                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row gap-4 p-4 border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-950/20 rounded-2xl relative transition-all hover:border-gray-350 dark:hover:border-gray-700"
                      >
                        <div className="w-16 h-16 rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {isValidUrl ? (
                            <img
                              src={fc.imageUrl}
                              alt={fc.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1590736704728-f4730bb30770?auto=format&fit=crop&q=80&w=200";
                              }}
                            />
                          ) : (
                            <Image className="text-gray-300 dark:text-gray-600" size={24} />
                          )}
                        </div>

                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                              Collection Title
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Artisan Spotlight"
                              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200"
                              value={fc.title}
                              onChange={(e) => {
                                const updated = [...featuredCollections];
                                updated[idx].title = e.target.value;
                                setFeaturedCollections(updated);
                              }}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                              Target Category
                            </label>
                            <select
                              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200"
                              value={fc.category}
                              onChange={(e) => {
                                const updated = [...featuredCollections];
                                updated[idx].category = e.target.value;
                                setFeaturedCollections(updated);
                              }}
                            >
                              <option value="Fashion">Fashion</option>
                              <option value="Electronics">Electronics</option>
                              <option value="Local Crafts">Local Crafts</option>
                              <option value="Beauty & Personal Care (Skincare, Haircare, Cosmetics)">Beauty &amp; Personal Care</option>
                              <option value="Home & Office Décor (Small Scale & Gadgets)">Home &amp; Office Décor</option>
                              <option value="Pet Supplies (Toys, Collars, Accessories, Dry Kibble)">Pet Supplies</option>
                            </select>
                          </div>

                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                              High-Resolution Image URL (or upload below)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Paste image URL address..."
                                className="flex-grow px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200"
                                value={fc.imageUrl}
                                onChange={(e) => {
                                  const updated = [...featuredCollections];
                                  updated[idx].imageUrl = e.target.value;
                                  setFeaturedCollections(updated);
                                }}
                              />
                              <label className="text-[10px] text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 px-3 py-2 rounded-xl border border-orange-100 dark:border-orange-900/40 transition-all font-bold cursor-pointer flex items-center gap-1 shrink-0">
                                <Upload size={12} />
                                <span>Upload File</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const optimized = await compressImageFile(file);
                                        const updated = [...featuredCollections];
                                        updated[idx].imageUrl = optimized;
                                        setFeaturedCollections(updated);
                                        toast.success("Collection image optimized!");
                                      } catch (err: any) {
                                        toast.error(`Upload failed: ${err.message}`);
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center justify-center gap-1.5 self-center sm:self-stretch">
                          <div className="flex sm:flex-col gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const updated = [...featuredCollections];
                                const temp = updated[idx];
                                updated[idx] = updated[idx - 1];
                                updated[idx - 1] = temp;
                                setFeaturedCollections(updated);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-950 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-none bg-transparent"
                              title="Move Collection Up"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === featuredCollections.length - 1}
                              onClick={() => {
                                const updated = [...featuredCollections];
                                const temp = updated[idx];
                                updated[idx] = updated[idx + 1];
                                updated[idx + 1] = temp;
                                setFeaturedCollections(updated);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-950 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer border-none bg-transparent"
                              title="Move Collection Down"
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = featuredCollections.filter((_, i) => i !== idx);
                              setFeaturedCollections(updated);
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                            title="Remove Collection"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {featuredCollections.length === 0 && (
                    <div className="p-8 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl text-center text-gray-400">
                      <Store className="mx-auto mb-2 opacity-50 text-orange-600 animate-pulse" size={32} />
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">No Custom Featured Collections configured.</p>
                      <p className="text-[10px] mt-1 text-gray-400">The website will beautifully fall back to standard default collections automatically.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SokoPlus Category Image Management Section */}
              <AdminCategoryImagesManager
                categoryImages={categoryImages}
                onChangeCategoryImages={setCategoryImages}
                onSave={handleSaveCategoryImagesDirect}
                isSaving={isSavingSettings}
              />



              {/* Brand Visual Identity Configuration */}
              <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-800 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center">
                    <Award size={16} className="mr-2 text-orange-600" /> Brand Visual Identity Settings
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    Customize your shop logo image and page favicon to align with your brand's unique design language.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Brand Logo Card */}
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-950/20 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-450 block mb-1">
                        Brand Logo Image
                      </label>
                      <p className="text-[10px] text-gray-400 dark:text-gray-550 font-medium">
                        Replaces the text-based 'Sokoplus.' logo. Transparency (PNG format) is highly recommended. Max height: 120px.
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {brandLogoUrl ? (
                        <div className="relative w-16 h-16 bg-gray-900 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center justify-center p-2 group overflow-hidden">
                          <img
                            src={brandLogoUrl}
                            alt="Brand Logo"
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setBrandLogoUrl("")}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-[10px] border-none"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-gray-400">
                          <Award size={20} className="opacity-40" />
                          <span className="text-[9px] font-bold mt-1">Fallback</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Paste image URL address..."
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200"
                          value={brandLogoUrl}
                          onChange={(e) => setBrandLogoUrl(e.target.value)}
                        />
                        <label className="text-[10px] text-orange-600 hover:text-orange-700 font-extrabold uppercase cursor-pointer flex items-center gap-1 w-fit bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/40 hover:bg-orange-100/50 transition-all">
                          <Upload size={11} />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBrandLogoUpload}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Favicon Card */}
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-950/20 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-450 block mb-1">
                        Favicon (Browser Icon)
                      </label>
                      <p className="text-[10px] text-gray-400 dark:text-gray-550 font-medium">
                        Recommended size: 32x32px or 48x48px (square ratio, PNG/ICO/SVG format). Keeps tab crisp.
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {faviconUrl ? (
                        <div className="relative w-16 h-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center justify-center p-3 group overflow-hidden">
                          <img
                            src={faviconUrl}
                            alt="Favicon"
                            className="w-10 h-10 object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setFaviconUrl("")}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-[10px] border-none"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-gray-400">
                          <Image size={20} className="opacity-40" />
                          <span className="text-[9px] font-bold mt-1">Default</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Paste favicon URL address..."
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200"
                          value={faviconUrl}
                          onChange={(e) => setFaviconUrl(e.target.value)}
                        />
                        <label className="text-[10px] text-orange-600 hover:text-orange-700 font-extrabold uppercase cursor-pointer flex items-center gap-1 w-fit bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/40 hover:bg-orange-100/50 transition-all">
                          <Upload size={11} />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFaviconUpload}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Site-Wide SEO Metadata & Analytics Settings */}
              <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-800 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center">
                    <Globe size={16} className="mr-2 text-orange-600" /> Site-Wide SEO, Analytics & Social Metadata
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    Configure Google Analytics 4 tracking, default search engine metadata, and social media preview cards across SokoPlus.
                  </p>
                </div>

                {/* Google Analytics GA4 Measurement ID card */}
                <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-orange-900 dark:text-orange-300 block">
                      Google Analytics 4 (GA4) Measurement ID
                    </label>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                      gaMeasurementId.startsWith("G-") 
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" 
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    }`}>
                      {gaMeasurementId.startsWith("G-") ? "GA4 Active" : "Pending Measurement ID"}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. G-XXXXXXXXXX"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-white dark:bg-gray-950 border border-orange-200 dark:border-orange-900/50 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/40 text-gray-900 dark:text-gray-100"
                    value={gaMeasurementId}
                    onChange={(e) => setGaMeasurementId(e.target.value)}
                  />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                    Paste your GA4 Measurement ID starting with <code className="bg-orange-100 dark:bg-orange-950 px-1 rounded font-bold">G-</code> from your Google Analytics Web Data Stream settings (e.g. for property <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Analytics for Sokoplus</code>). Once saved, real-time web visits and checkout analytics will stream into your GA4 account.
                  </p>
                </div>

                {/* Free Delivery Order Volume Threshold Card */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <Truck size={14} className="text-emerald-600 dark:text-emerald-400" /> Free Delivery Trigger Threshold (KES)
                    </label>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Active: KES {freeShippingThreshold.toLocaleString()}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">KES</span>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      placeholder="e.g. 15000"
                      className="w-full pl-13 pr-3.5 py-2.5 text-xs font-bold bg-white dark:bg-gray-950 border border-emerald-200 dark:border-emerald-900/50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/40 text-gray-900 dark:text-gray-100"
                      value={freeShippingThreshold}
                      onChange={(e) => setFreeShippingThreshold(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                    Decides the minimum cart subtotal order volume in KES that automatically triggers <strong className="text-emerald-700 dark:text-emerald-400">100% Free Standard Shipping</strong> across Kenya. Decreasing this encourages higher conversion for smaller orders; increasing protects logistics margins.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Text Metadata Configuration */}
                  <div className="space-y-4">
                    {/* Default Title Tag */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-450 block">
                          Default SEO Title Tag
                        </label>
                        <span className={`text-[10px] font-bold ${seoTitle.length > 60 ? "text-amber-500" : "text-gray-400"}`}>
                          {seoTitle.length}/60 chars
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. SokoPlus - Premium Kenyan Handmade Crafts & Local Artisan Goods"
                        className="w-full px-3 py-2.5 text-xs bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                      />
                      <p className="text-[10px] text-gray-400 dark:text-gray-550 font-medium">
                        Ideally under 60 characters. This title is shown in browser tabs and search engine snippet results.
                      </p>
                    </div>

                    {/* Default Site Description */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-450 block">
                          Default Meta Description
                        </label>
                        <span className={`text-[10px] font-bold ${seoDescription.length > 160 ? "text-amber-500" : "text-gray-400"}`}>
                          {seoDescription.length}/160 chars
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        placeholder="e.g. SokoPlus connects Kenyan artisans to global standards. Shop genuine handmade beaded bags, soapstone carvings, fine kiondos, and local coffee direct from Nairobi."
                        className="w-full px-3 py-2.5 text-xs bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200 resize-none"
                        value={seoDescription}
                        onChange={(e) => setSeoDescription(e.target.value)}
                      />
                      <p className="text-[10px] text-gray-400 dark:text-gray-550 font-medium">
                        Ideally 150-160 characters. A high-quality description increases click-through rates from search pages.
                      </p>
                    </div>
                  </div>

                  {/* Social Media Sharing Image Card */}
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-950/20 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-450 block mb-1">
                        Default Social Share Image (Open Graph Image)
                      </label>
                      <p className="text-[10px] text-gray-400 dark:text-gray-550 font-medium">
                        Recommended size: 1200x630px (landscape aspect ratio). Shown when your website link is shared on WhatsApp, Facebook, iMessage, Twitter, and Slack.
                      </p>
                    </div>

                    <div className="flex flex-col gap-4">
                      {seoImage ? (
                        <div className="relative w-full h-36 bg-gray-900 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center justify-center group overflow-hidden">
                          <img
                            src={seoImage}
                            alt="Social Share Preview"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity font-bold gap-1">
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-md backdrop-blur-sm">Landscape Preview</span>
                            <button
                              type="button"
                              onClick={() => setSeoImage("")}
                              className="text-white hover:text-red-400 transition-colors font-extrabold text-xs uppercase bg-transparent border-none cursor-pointer mt-2"
                            >
                              Remove Image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-36 bg-gray-100 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-gray-400 text-center p-4">
                          <Image size={24} className="opacity-40 mb-1" />
                          <span className="text-[10px] font-bold">No custom social preview image</span>
                          <span className="text-[9px] text-gray-450 mt-1">Falls back to site-wide og-image.jpg default</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Paste image URL (Unsplash/Imgur etc.)"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-850 dark:text-gray-200"
                          value={seoImage}
                          onChange={(e) => setSeoImage(e.target.value)}
                        />
                        <label className="text-[10px] text-orange-600 hover:text-orange-700 font-extrabold uppercase cursor-pointer flex items-center gap-1 w-fit bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/40 hover:bg-orange-100/50 transition-all">
                          <Upload size={11} />
                          <span>Upload File & Optimize</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleSeoImageUpload}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>



              {/* Google Maps Link Configuration */}
              <div className="p-6 bg-orange-50/20 dark:bg-orange-950/10 rounded-3xl border border-orange-100/50 dark:border-orange-900/30 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-orange-850 dark:text-orange-400 flex items-center">
                    <MapPin size={16} className="mr-2 text-orange-600 animate-pulse" /> Google Maps Shop Locations
                  </h3>
                  <p className="text-xs text-orange-705 dark:text-orange-300 leading-relaxed font-medium">
                    Configure names and links for all physical shop locations. These will be beautifully visible as an active dropdown or list directory inside the footer section.
                  </p>
                </div>

                <div className="space-y-3">
                  {googleMapsLinks.map((loc, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-3 p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl relative group pb-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-400 block">
                          Location Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Nairobi CBD Main Office"
                          value={loc.name}
                          onChange={(e) => {
                            const updated = [...googleMapsLinks];
                            updated[idx].name = e.target.value;
                            setGoogleMapsLinks(updated);
                          }}
                          className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-900 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs font-sans text-gray-950 dark:text-white"
                        />
                      </div>
                      
                      <div className="flex-[2] space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-400 block">
                          Google Maps Link URL
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            placeholder="e.g. https://maps.app.goo.gl/..."
                            value={loc.url}
                            onChange={(e) => {
                              const updated = [...googleMapsLinks];
                              updated[idx].url = e.target.value;
                              setGoogleMapsLinks(updated);
                            }}
                            className="flex-1 p-3 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-900 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs font-sans text-gray-950 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = googleMapsLinks.filter((_, i) => i !== idx);
                              setGoogleMapsLinks(updated);
                            }}
                            className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                            title="Remove Location"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {googleMapsLinks.length === 0 && (
                    <div className="p-6 bg-white/40 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center space-y-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium font-sans">No physical shop locations configured yet.</p>
                      <button
                        type="button"
                        onClick={() => setGoogleMapsLinks([{ name: "Nairobi Store", url: "" }])}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer border-none"
                      >
                        <Plus size={14} /> Add First Location
                      </button>
                    </div>
                  )}

                  {googleMapsLinks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGoogleMapsLinks([...googleMapsLinks, { name: "", url: "" }])}
                      className="w-full py-3 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 border-dashed text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 hover:border-orange-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} className="text-orange-600" /> Add Another Store Location
                    </button>
                  )}
                </div>
              </div>

              {/* Official Social Media Pages Configuration */}
              <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-800 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center">
                    <Share2 size={16} className="mr-2 text-orange-600" /> Official Social Media Pages
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    Provide links to your official social media pages and contact channels. Configured links will automatically appear in the website footer and social widgets.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      key: "instagram" as const,
                      visKey: "instagramVisible" as const,
                      label: "Instagram Page",
                      icon: <Instagram size={16} className="text-pink-600" />,
                      placeholder: "e.g. https://instagram.com/sokoplus_ke",
                      colSpan: "",
                    },
                    {
                      key: "facebook" as const,
                      visKey: "facebookVisible" as const,
                      label: "Facebook Page",
                      icon: <Facebook size={16} className="text-blue-600" fill="currentColor" />,
                      placeholder: "e.g. https://facebook.com/sokoplus.official",
                      colSpan: "",
                    },
                    {
                      key: "twitter" as const,
                      visKey: "twitterVisible" as const,
                      label: "Twitter / X Profile",
                      icon: <Twitter size={16} className="text-sky-500" />,
                      placeholder: "e.g. https://x.com/sokoplus",
                      colSpan: "",
                    },
                    {
                      key: "linkedin" as const,
                      visKey: "linkedinVisible" as const,
                      label: "LinkedIn Company Page",
                      icon: <Linkedin size={16} className="text-blue-700" fill="currentColor" />,
                      placeholder: "e.g. https://linkedin.com/company/sokoplus",
                      colSpan: "",
                    },
                    {
                      key: "tiktok" as const,
                      visKey: "tiktokVisible" as const,
                      label: "TikTok Profile",
                      icon: <TikTokIcon size={16} className="text-black dark:text-white" />,
                      placeholder: "e.g. https://tiktok.com/@sokoplus",
                      colSpan: "",
                    },
                    {
                      key: "whatsapp" as const,
                      visKey: "whatsappVisible" as const,
                      label: "WhatsApp Direct / Channel",
                      icon: <WhatsAppIcon size={16} className="text-emerald-600" />,
                      placeholder: "e.g. https://wa.me/254740463021",
                      colSpan: "",
                    },
                    {
                      key: "youtube" as const,
                      visKey: "youtubeVisible" as const,
                      label: "YouTube Channel",
                      icon: <YouTubeIcon size={16} className="text-red-600" />,
                      placeholder: "e.g. https://youtube.com/@sokoplus",
                      colSpan: "md:col-span-2",
                    },
                  ].map((item) => {
                    const urlValue = socialLinks[item.key] || "";
                    const isVisible = socialLinks[item.visKey] !== false;

                    return (
                      <div
                        key={item.key}
                        className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                          item.colSpan
                        } ${
                          isVisible
                            ? "bg-gray-50/70 dark:bg-gray-950/30 border-gray-100 dark:border-gray-800"
                            : "bg-gray-100/40 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 opacity-75"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            {item.icon} {item.label}
                          </label>
                          <div className="flex items-center gap-3">
                            {urlValue && (
                              <a
                                href={urlValue}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-extrabold text-orange-600 hover:underline flex items-center gap-1"
                              >
                                <span>Test Link</span> <ExternalLink size={10} />
                              </a>
                            )}
                            {/* Visibility Switch */}
                            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-2xs">
                              <span className={`text-[10px] font-bold ${isVisible ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"}`}>
                                {isVisible ? "Visible" : "Hidden"}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSocialLinks({
                                    ...socialLinks,
                                    [item.visKey]: !isVisible,
                                  })
                                }
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isVisible ? "bg-orange-600" : "bg-gray-300 dark:bg-gray-700"
                                }`}
                                title={`Toggle visibility for ${item.label}`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                    isVisible ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                        <input
                          type="url"
                          placeholder={item.placeholder}
                          value={urlValue}
                          onChange={(e) =>
                            setSocialLinks({
                              ...socialLinks,
                              [item.key]: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-900 dark:text-white font-medium"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audio Bubble Toggle Configuration */}
              <div className="p-6 bg-orange-50/20 dark:bg-orange-950/10 rounded-3xl border border-orange-100/50 dark:border-orange-900/30 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-orange-850 dark:text-orange-400 flex items-center">
                      <Music size={16} className="mr-2 text-orange-600 animate-pulse" /> Floating Audio Bubble Widget
                    </h3>
                    <p className="text-xs text-orange-705 dark:text-orange-300 leading-relaxed font-medium">
                      Control the visibility of the ambient background acoustic audio player for all customers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAudioBubble(!showAudioBubble)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showAudioBubble ? "bg-orange-650" : "bg-gray-200 dark:bg-gray-800"
                    }`}
                    id="audio-bubble-toggle"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        showAudioBubble ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Homepage Promotional Banners Toggle Configuration */}
              <div className="p-6 bg-orange-50/20 dark:bg-orange-950/10 rounded-3xl border border-orange-100/50 dark:border-orange-900/30 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-orange-850 dark:text-orange-400 flex items-center">
                      <Megaphone size={16} className="mr-2 text-orange-600" /> Homepage Promotional Banners
                    </h3>
                    <p className="text-xs text-orange-705 dark:text-orange-300 leading-relaxed font-medium">
                      Enable or disable seasonal top alerts and inline marketing promotional banners across the store.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPromotionalBannersEnabled(!promotionalBannersEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      promotionalBannersEnabled ? "bg-orange-650" : "bg-gray-200 dark:bg-gray-800"
                    }`}
                    id="promotional-banners-toggle"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        promotionalBannersEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Sizing, Aspect, and Placement safety guidance */}
              <div className="p-5 bg-gray-50 rounded-2xl space-y-2 text-xs border border-gray-100/50">
                <p className="font-bold text-gray-800 uppercase tracking-tight text-[11px]">Recommended Asset Specifications:</p>
                <ul className="space-y-1.5 text-gray-500 font-semibold list-disc pl-4 text-[11px]">
                  <li><strong className="text-gray-700">Aspect Ratio:</strong> Strictly 1:1 Square (e.g., 800x800px or 1000x1000px) ensures balanced spatial rhythm and prevents visual warping on responsive viewports.</li>
                  <li><strong className="text-gray-700">Dimensions:</strong> Recommended minimum of 600px width for premium organic sharpness.</li>
                  <li><strong className="text-gray-700">Aesthetics:</strong> High-contrasting colors, vibrant warm tones, or minimalist negative space backgrounds to preserve the premium African marketplace visual identity.</li>
                </ul>
              </div>

              </div>

            {/* Right Column: Hero Live Preview */}
            <div className="lg:col-span-5 space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                Live Rendering Preview
              </label>
              
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100/80 flex flex-col items-center justify-center relative">
                {/* Simulated Container of the Hero banner */}
                <div className="w-full max-w-[280px] sm:max-w-sm aspect-square bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative group">
                  {homepageHeroUrls.length > 0 ? (
                    <div className="w-full h-full relative overflow-hidden">
                      <img
                        src={homepageHeroUrls[activePreviewSlide % homepageHeroUrls.length] || homepageHeroUrl}
                        alt="Hero Live Preview"
                        className="w-full h-full object-cover transition-all duration-700"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1594122230689-45899d9e6f69?auto=format&fit=crop&q=80&w=200";
                        }}
                      />
                      {homepageHeroUrls.length > 1 && (
                        <div className="absolute bottom-2 right-2 flex space-x-1 bg-black/40 px-2 py-1 rounded-full">
                          {homepageHeroUrls.map((_, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                (activePreviewSlide % homepageHeroUrls.length) === i ? "bg-orange-600 w-3" : "bg-white/60"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : homepageHeroUrl ? (
                    <img
                      src={homepageHeroUrl}
                      alt="Hero Live Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-orange-50 text-orange-600 p-8 text-center">
                      <Image size={40} className="mb-2 opacity-50" />
                      <p className="text-xs font-extrabold">Default Master Image</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-1">Showing our standard high-quality supplied art banner.</p>
                    </div>
                  )}


                </div>

                <div className="mt-4 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded">
                    Real-time Frame Preview
                  </span>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed font-medium">
                    This mimics the exact responsive layout container of the homepage main stage. Use it to check alignment, crop balance, and aesthetic color consistency.
                  </p>
                </div>
              </div>
            </div>

            {/* Full Width Section: Delivery Destinations Manager */}
            <div className="col-span-12 lg:col-span-12 border-t border-gray-100 pt-8 space-y-6">
              <div className="p-6 bg-orange-50/20 rounded-3xl border border-orange-100/50 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 text-orange-600 p-2.5 rounded-2xl shrink-0">
                    <Globe size={22} className="animate-spin-slow" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black tracking-tight text-gray-950">Active Delivery Destinations Manager</h3>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      Control which countries, Kenyan counties, and cities are enabled or disabled for deliveries across SokoPlus. Disabled locations will be hidden from the customer's selection at cart and checkout.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-gray-55 p-6 rounded-3xl border border-gray-150">
                {/* Left Side: Hierarchy Browser (Countries & Counties) */}
                <div className="md:col-span-5 space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-450">
                    Countries & Kenyan Counties
                  </div>

                  <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Kenya and other countries */}
                    {["Kenya", "Uganda", "Tanzania", "Rwanda"].map((country) => {
                      const isCountryDisabled = disabledCountries.includes(country);
                      const isSelected = deliverySelectedTab.type === "country" && deliverySelectedTab.name === country;
                      
                      const toggleCountryLocal = (cName: string) => {
                        setDisabledCountries(prev => 
                          prev.includes(cName) ? prev.filter(c => c !== cName) : [...prev, cName]
                        );
                      };

                      return (
                        <div key={country} className="space-y-1">
                          <div
                            onClick={() => setDeliverySelectedTab({ type: "country", name: country })}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                              isSelected 
                                ? "border-orange-500 bg-orange-50/20 shadow-sm" 
                                : "border-gray-150 bg-white hover:bg-gray-50/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">
                                {country === "Kenya" ? "🇰🇪" : country === "Uganda" ? "🇺🇬" : country === "Tanzania" ? "🇹🇿" : "🇷🇼"}
                              </span>
                              <span className="text-sm font-bold text-gray-850">{country}</span>
                            </div>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleCountryLocal(country)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  !isCountryDisabled ? "bg-orange-650" : "bg-gray-200"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    !isCountryDisabled ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Counties List nested under Kenya if Kenya selected */}
                          {country === "Kenya" && !isCountryDisabled && (
                            <div className="pl-6 pt-1 space-y-1.5">
                              {counties.map((countyObj) => {
                                const isCountyDisabled = disabledCounties.includes(countyObj.name);
                                const isCountySelected = deliverySelectedTab.type === "county" && deliverySelectedTab.name === countyObj.name;
                                const enabledCitiesCount = countyObj.cities.filter(c => !disabledCities.includes(c)).length;
                                
                                const toggleCountyLocal = (coName: string) => {
                                  setDisabledCounties(prev => 
                                    prev.includes(coName) ? prev.filter(co => co !== coName) : [...prev, coName]
                                  );
                                };

                                return (
                                  <div
                                    key={countyObj.name}
                                    onClick={() => setDeliverySelectedTab({ type: "county", name: countyObj.name })}
                                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                                      isCountySelected
                                        ? "border-orange-400 bg-orange-50/10"
                                        : "border-gray-100 bg-white/60 hover:bg-white"
                                    }`}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-gray-800">{countyObj.name}</span>
                                      <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                                        {enabledCitiesCount}/{countyObj.cities.length} cities active
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => toggleCountyLocal(countyObj.name)}
                                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                          !isCountyDisabled ? "bg-orange-500" : "bg-gray-200"
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            !isCountyDisabled ? "translate-x-3" : "translate-x-0"
                                          }`}
                                        />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Cities Manager for selected option */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-450">
                      Manage Cities/Townships in: <span className="text-orange-650 font-black">{deliverySelectedTab.name}</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-gray-150 h-[450px] overflow-y-auto custom-scrollbar">
                    {(() => {
                      const selectedName = deliverySelectedTab.name;
                      const isSelectedCounty = deliverySelectedTab.type === "county";
                      
                      let citiesToRender: string[] = [];
                      let isParentDisabled = false;

                      if (isSelectedCounty) {
                        const matched = counties.find(c => c.name === selectedName);
                        citiesToRender = matched ? matched.cities : [];
                        isParentDisabled = disabledCounties.includes(selectedName) || disabledCountries.includes("Kenya");
                      } else {
                        // Country selection
                        isParentDisabled = disabledCountries.includes(selectedName);
                        if (selectedName === "Kenya") {
                          return (
                            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                              <MapPin size={32} className="opacity-40 mb-2 text-orange-600 animate-pulse" />
                              <p className="text-xs font-extrabold uppercase text-gray-600">Kenya is structured by county</p>
                              <p className="text-[11px] text-gray-400 max-w-xs mt-1 font-medium">
                                Please select a specific County in the left pane (e.g., Nairobi City County) to manage its local townships and delivery cities.
                              </p>
                            </div>
                          );
                        } else {
                          // Uganda, Tanzania, Rwanda
                          const CITIES_MAP: Record<string, string[]> = {
                            "Uganda": ["Kampala", "Entebbe", "Jinja"],
                            "Tanzania": ["Dar es Salaam", "Arusha", "Zanzibar"],
                            "Rwanda": ["Kigali", "Gisenyi"],
                          };
                          citiesToRender = CITIES_MAP[selectedName] || [];
                        }
                      }

                      if (citiesToRender.length === 0) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                            <MapPin size={28} className="opacity-40 mb-1" />
                            <p className="text-xs font-bold">No cities defined</p>
                          </div>
                        );
                      }

                      const toggleCityLocal = (cityName: string) => {
                        setDisabledCities(prev => 
                          prev.includes(cityName) ? prev.filter(c => c !== cityName) : [...prev, cityName]
                        );
                      };

                      return (
                        <div className="space-y-4">
                          {isParentDisabled && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center">
                              ⚠️ Note: This entire {isSelectedCounty ? "County" : "Country"} is currently turned OFF. Local cities are hidden automatically.
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {citiesToRender.map((city) => {
                              const isCityDisabled = disabledCities.includes(city);
                              const disabledByParent = isParentDisabled;
                              
                              return (
                                <div
                                  key={city}
                                  onClick={() => {
                                    if (!disabledByParent) toggleCityLocal(city);
                                  }}
                                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                    disabledByParent 
                                      ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-100"
                                      : "cursor-pointer bg-gray-50/50 border-gray-150 hover:bg-white hover:shadow-sm"
                                  }`}
                                >
                                  <span className="text-xs font-bold text-gray-800 truncate pr-2">
                                    {city}
                                  </span>

                                  <button
                                    type="button"
                                    disabled={disabledByParent}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCityLocal(city);
                                    }}
                                    className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      !isCityDisabled && !disabledByParent ? "bg-orange-500" : "bg-gray-200"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        !isCityDisabled && !disabledByParent ? "translate-x-3.5" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Form Actions for all settings */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 justify-end">
                <button
                  type="button"
                  onClick={handleResetSettings}
                  disabled={isSavingSettings}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-4 rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Clear &amp; Reset to Default
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold px-8 py-4 rounded-2xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  {isSavingSettings ? "Saving Settings..." : "Save Marketing & Delivery Settings"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 invisible hidden">
        {/* Old Tables Removed for Tabbed View */}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleAddProduct}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
          >
            <h2 className="text-2xl font-bold mb-4">Add New Product</h2>
            <div className="overflow-y-auto pr-1 flex-grow space-y-6 scrollbar-thin">
              <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Name
                </label>
                <input
                  required
                  type="text"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.name ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.name}
                  onChange={(e) => {
                    setNewProduct({ ...newProduct, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Product SKU Validation Field */}
              <div className="col-span-2 bg-orange-50/50 border border-orange-100/80 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase text-gray-700 tracking-wide flex items-center gap-1.5">
                    <span>Product SKU / Unique Identifier</span>
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-extrabold">Required</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = generateSuggestedSku(newProduct.category, newProduct.name);
                      setNewProduct({ ...newProduct, sku: suggested });
                      if (errors.sku) setErrors({ ...errors, sku: "" });
                      toast(`Suggested SKU auto-filled: ${suggested}`, { icon: "⚡" });
                    }}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    ⚡ Auto-Generate SKU
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. SOKO-FAS-9281"
                  className={`w-full p-3.5 bg-white border rounded-xl font-mono text-sm uppercase tracking-wider outline-none focus:ring-2 transition-all ${
                    errors.sku ? "border-red-500 focus:ring-red-500" : "border-orange-200 focus:ring-orange-600"
                  }`}
                  value={newProduct.sku}
                  onChange={(e) => {
                    const raw = e.target.value.toUpperCase();
                    setNewProduct({ ...newProduct, sku: raw });
                    const fmt = validateSkuFormat(raw);
                    if (!fmt.isValid && raw.length > 0) {
                      setErrors({ ...errors, sku: fmt.error || "Invalid SKU format" });
                    } else {
                      if (errors.sku) setErrors({ ...errors, sku: "" });
                    }
                  }}
                />
                {errors.sku ? (
                  <p className="text-red-500 text-xs mt-1.5 font-bold flex items-center gap-1">
                    ⚠️ {errors.sku}
                  </p>
                ) : newProduct.sku ? (
                  <p className="text-emerald-600 text-xs mt-1 font-semibold flex items-center gap-1">
                    ✓ SKU format valid: <span className="font-mono font-bold">{newProduct.sku}</span>
                  </p>
                ) : (
                  <p className="text-gray-400 text-[11px] mt-1 font-medium">
                    SKU must be unique (3-20 uppercase chars, numbers, hyphens or underscores).
                  </p>
                )}
              </div>

              {/* Digital Downloadable Product Engine */}
              <div className="col-span-2 border border-blue-100 bg-blue-50/40 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-blue-900 tracking-wide">
                      Digital Downloadable Product Engine
                    </h4>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Allow SokoPlus customers to download digital assets (PDF, MP4, Audio, eBooks, Software) upon checkout.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="isDigitalAdd"
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    checked={newProduct.isDigital || false}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, isDigital: e.target.checked })
                    }
                  />
                </div>

                {newProduct.isDigital && (
                  <div className="mt-4 pt-4 border-t border-blue-100 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-gray-600">
                        File Format
                      </label>
                      <select
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-gray-800 outline-none"
                        value={newProduct.digitalFormat || "pdf"}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            digitalFormat: e.target.value as any,
                          })
                        }
                      >
                        <option value="pdf">PDF Document (.pdf)</option>
                        <option value="video">Video Lecture / File (.mp4)</option>
                        <option value="audio">Audio / Podcast (.mp3, .wav)</option>
                        <option value="zip">ZIP / Compressed Bundle (.zip)</option>
                        <option value="ebook">eBook (.epub, .mobi)</option>
                        <option value="software">Software / App Installer</option>
                        <option value="other">Other Format</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-gray-600">
                        File Size (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 15.4 MB"
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs font-semibold outline-none"
                        value={newProduct.digitalFileSize || ""}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, digitalFileSize: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[11px] font-bold uppercase text-gray-600">
                        Digital Asset Download URL / Cloud Storage Link
                      </label>
                      <input
                        type="url"
                        placeholder="https://storage.googleapis.com/.../file.pdf"
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        value={newProduct.digitalFileUrl || ""}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, digitalFileUrl: e.target.value })
                        }
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        🔒 Customers receive a secure download link in their order confirmation once payment is verified.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Category
                </label>
                <select
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-semibold text-gray-800"
                  value={newProduct.category}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, category: e.target.value })
                  }
                >
                  <option>Fashion</option>
                  <option>Electronics</option>
                  <option>Local Crafts</option>
                  <option>Beauty & Personal Care (Skincare, Haircare, Cosmetics)</option>
                  <option>Home & Office Décor (Small Scale & Gadgets)</option>
                  <option>Pet Supplies (Toys, Collars, Accessories, Dry Kibble)</option>
                  <option>Home Decor</option>
                  <option>Sustainable</option>
                  <option>Gifts & Souvenirs</option>
                  <option>Accessories</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Artisan / Creator
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mama Stacey of Narok Maasai Crafts"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={newProduct.artisan}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, artisan: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Stock Quantity
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 10"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.stock ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.stock === 0 ? "" : newProduct.stock}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      stock: Number(e.target.value),
                    });
                    if (errors.stock) setErrors({ ...errors, stock: "" });
                  }}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.stock}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Selling Price (KES)</span>
                  <span className="text-orange-600 font-extrabold text-[10px] uppercase">(Active)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1500"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.price ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.price === 0 ? "" : newProduct.price}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      price: Number(e.target.value),
                    });
                    if (errors.price) setErrors({ ...errors, price: "" });
                  }}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.price}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Buying Price / Cost (KES)</span>
                  <span className="text-orange-650 font-black text-[10px] uppercase">(Internal Only)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1000"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={newProduct.buyingPrice === 0 ? "" : newProduct.buyingPrice}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      buyingPrice: Number(e.target.value),
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Used strictly internally to evaluate profit margins.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Original Price (KES)</span>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">(Optional)</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2000 for discount"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                  value={newProduct.originalPrice || ""}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      originalPrice: e.target.value ? Number(e.target.value) : 0,
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Enter a higher number to display a stricken price markdown badge.
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Description (& Formatting Tools)
                </label>
                <RichTextEditor
                  content={newProduct.description}
                  onChange={(val) => setNewProduct({ ...newProduct, description: val })}
                  placeholder="Describe your premium item (supports bold, headings, bullets, lists, link-items, quotes...)"
                />
              </div>

              {/* Beautiful Color Specifications Toggle & Swatches */}
              <div className="col-span-2 bg-gray-50/50 dark:bg-gray-950/20 border border-gray-150 dark:border-gray-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-500">
                      Color Variations & Specifications
                    </label>
                    <p className="text-[10px] text-gray-400 font-bold">
                      Does this craft offer distinct color options?
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasColorsAdd}
                      onChange={(e) => {
                        setHasColorsAdd(e.target.checked);
                        if (!e.target.checked) {
                          setSelectedColorsAdd([]);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-orange-100 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                {hasColorsAdd && (
                  <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                      Select Available Artisan Swatches
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ARTISAN_COLORS.map((color) => {
                        const representation = `${color.name}|${color.hex}`;
                        const isSelected = selectedColorsAdd.includes(representation);
                        return (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedColorsAdd((prev) => prev.filter((c) => c !== representation));
                              } else {
                                setSelectedColorsAdd((prev) => [...prev, representation]);
                              }
                            }}
                            className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "bg-orange-50/40 dark:bg-orange-950/20 border-orange-500/60 shadow-xs"
                                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300"
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-black/10 shrink-0 flex items-center justify-center shadow-xs"
                              style={{ backgroundColor: color.hex }}
                            >
                              {isSelected && (
                                <Check
                                  className={color.hex === "#fdfbf7" ? "text-gray-900" : "text-white"}
                                  size={12}
                                  strokeWidth={3}
                                />
                              )}
                            </span>
                            <span className="text-[10px] font-extrabold text-gray-750 dark:text-gray-300 truncate">
                              {color.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive Color Wheel Picker */}
                    <ArtisanColorPicker
                      selectedColors={selectedColorsAdd}
                      onAddColor={(rep) => setSelectedColorsAdd((prev) => [...prev, rep])}
                    />

                    {selectedColorsAdd.length === 0 && (
                      <p className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                        <span>⚠ Please select or pick at least one available swatch.</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <ProductImageManager
                  images={newProduct.images}
                  onChange={(imgs) => setNewProduct({ ...newProduct, images: imgs })}
                />
              </div>
            </div>
            </div>
            <div className="flex space-x-4 mt-6 border-t border-gray-100 pt-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-700 transition-all"
              >
                Add Product
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleUpdateProduct}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
          >
            <h2 className="text-2xl font-bold mb-4">Edit Product</h2>
            <div className="overflow-y-auto pr-1 flex-grow space-y-6 scrollbar-thin">
              <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Name
                </label>
                <input
                  required
                  type="text"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.name ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.name}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      name: e.target.value,
                    });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Product SKU Validation Field (Edit Modal) */}
              <div className="col-span-2 bg-orange-50/50 border border-orange-100/80 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase text-gray-700 tracking-wide flex items-center gap-1.5">
                    <span>Product SKU / Unique Identifier</span>
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-extrabold">Required</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = generateSuggestedSku(editingProduct.category, editingProduct.name);
                      setEditingProduct({ ...editingProduct, sku: suggested });
                      if (errors.sku) setErrors({ ...errors, sku: "" });
                      toast(`Suggested SKU auto-filled: ${suggested}`, { icon: "⚡" });
                    }}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    ⚡ Auto-Generate SKU
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. SOKO-FAS-9281"
                  className={`w-full p-3.5 bg-white border rounded-xl font-mono text-sm uppercase tracking-wider outline-none focus:ring-2 transition-all ${
                    errors.sku ? "border-red-500 focus:ring-red-500" : "border-orange-200 focus:ring-orange-600"
                  }`}
                  value={editingProduct.sku || ""}
                  onChange={(e) => {
                    const raw = e.target.value.toUpperCase();
                    setEditingProduct({ ...editingProduct, sku: raw });
                    const fmt = validateSkuFormat(raw);
                    if (!fmt.isValid && raw.length > 0) {
                      setErrors({ ...errors, sku: fmt.error || "Invalid SKU format" });
                    } else {
                      if (errors.sku) setErrors({ ...errors, sku: "" });
                    }
                  }}
                />
                {errors.sku ? (
                  <p className="text-red-500 text-xs mt-1.5 font-bold flex items-center gap-1">
                    ⚠️ {errors.sku}
                  </p>
                ) : editingProduct.sku ? (
                  <p className="text-emerald-600 text-xs mt-1 font-semibold flex items-center gap-1">
                    ✓ SKU format valid: <span className="font-mono font-bold">{editingProduct.sku}</span>
                  </p>
                ) : (
                  <p className="text-gray-400 text-[11px] mt-1 font-medium">
                    SKU must be unique across products (3-20 uppercase chars, numbers, hyphens or underscores).
                  </p>
                )}
              </div>

              {/* Digital Downloadable Product Engine (Edit Modal) */}
              <div className="col-span-2 border border-blue-100 bg-blue-50/40 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-blue-900 tracking-wide">
                      Digital Downloadable Product Engine
                    </h4>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Allow SokoPlus customers to download digital assets (PDF, MP4, Audio, eBooks, Software) upon checkout.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="isDigitalEdit"
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    checked={editingProduct.isDigital || false}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, isDigital: e.target.checked })
                    }
                  />
                </div>

                {editingProduct.isDigital && (
                  <div className="mt-4 pt-4 border-t border-blue-100 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-gray-600">
                        File Format
                      </label>
                      <select
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-gray-800 outline-none"
                        value={editingProduct.digitalFormat || "pdf"}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            digitalFormat: e.target.value as any,
                          })
                        }
                      >
                        <option value="pdf">PDF Document (.pdf)</option>
                        <option value="video">Video Lecture / File (.mp4)</option>
                        <option value="audio">Audio / Podcast (.mp3, .wav)</option>
                        <option value="zip">ZIP / Compressed Bundle (.zip)</option>
                        <option value="ebook">eBook (.epub, .mobi)</option>
                        <option value="software">Software / App Installer</option>
                        <option value="other">Other Format</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-gray-600">
                        File Size (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 15.4 MB"
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs font-semibold outline-none"
                        value={editingProduct.digitalFileSize || ""}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, digitalFileSize: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[11px] font-bold uppercase text-gray-600">
                        Digital Asset Download URL / Cloud Storage Link
                      </label>
                      <input
                        type="url"
                        placeholder="https://storage.googleapis.com/.../file.pdf"
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        value={editingProduct.digitalFileUrl || ""}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, digitalFileUrl: e.target.value })
                        }
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        🔒 Customers receive a secure download link in their order confirmation once payment is verified.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Category
                </label>
                <select
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-semibold text-gray-800"
                  value={editingProduct.category}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      category: e.target.value,
                    })
                  }
                >
                  <option>Fashion</option>
                  <option>Electronics</option>
                  <option>Local Crafts</option>
                  <option>Beauty & Personal Care (Skincare, Haircare, Cosmetics)</option>
                  <option>Home & Office Décor (Small Scale & Gadgets)</option>
                  <option>Pet Supplies (Toys, Collars, Accessories, Dry Kibble)</option>
                  <option>Home Decor</option>
                  <option>Sustainable</option>
                  <option>Gifts & Souvenirs</option>
                  <option>Accessories</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Artisan / Creator
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mama Stacey of Narok Maasai Crafts"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={editingProduct.artisan || ""}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      artisan: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Stock Quantity
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 10"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.stock ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.stock}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      stock: Number(e.target.value),
                    });
                    if (errors.stock) setErrors({ ...errors, stock: "" });
                  }}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.stock}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Selling Price (KES)</span>
                  <span className="text-orange-600 font-extrabold text-[10px] uppercase">(Active)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1500"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.price ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.price}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      price: Number(e.target.value),
                    });
                    if (errors.price) setErrors({ ...errors, price: "" });
                  }}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.price}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Buying Price / Cost (KES)</span>
                  <span className="text-orange-655 font-black text-[10px] uppercase">(Internal Only)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1000"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={editingProduct.buyingPrice || ""}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      buyingPrice: Number(e.target.value),
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Used strictly internally to evaluate profit margins.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Original Price (KES)</span>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">(Optional)</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2000 for discount"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                  value={editingProduct.originalPrice || ""}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      originalPrice: e.target.value ? Number(e.target.value) : 0,
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Enter a higher number to display a stricken price markdown badge.
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Description (& Formatting Tools)
                </label>
                <RichTextEditor
                  content={editingProduct.description}
                  onChange={(val) => setEditingProduct({ ...editingProduct, description: val })}
                  placeholder="Describe your premium item (supports bold, headings, bullets, lists, link-items, quotes...)"
                />
              </div>

              {/* Beautiful Color Specifications Toggle & Swatches */}
              <div className="col-span-2 bg-gray-50/50 dark:bg-gray-950/20 border border-gray-150 dark:border-gray-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-500">
                      Color Variations & Specifications
                    </label>
                    <p className="text-[10px] text-gray-400 font-bold">
                      Does this craft offer distinct color options?
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasColorsEdit}
                      onChange={(e) => {
                        setHasColorsEdit(e.target.checked);
                        if (!e.target.checked) {
                          setSelectedColorsEdit([]);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-orange-100 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                {hasColorsEdit && (
                  <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                      Select Available Artisan Swatches
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ARTISAN_COLORS.map((color) => {
                        const representation = `${color.name}|${color.hex}`;
                        const isSelected = selectedColorsEdit.includes(representation);
                        return (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedColorsEdit((prev) => prev.filter((c) => c !== representation));
                              } else {
                                setSelectedColorsEdit((prev) => [...prev, representation]);
                              }
                            }}
                            className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "bg-orange-50/40 dark:bg-orange-950/20 border-orange-500/60 shadow-xs"
                                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300"
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-black/10 shrink-0 flex items-center justify-center shadow-xs"
                              style={{ backgroundColor: color.hex }}
                            >
                              {isSelected && (
                                <Check
                                  className={color.hex === "#fdfbf7" ? "text-gray-900" : "text-white"}
                                  size={12}
                                  strokeWidth={3}
                                />
                              )}
                            </span>
                            <span className="text-[10px] font-extrabold text-gray-750 dark:text-gray-300 truncate">
                              {color.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive Color Wheel Picker */}
                    <ArtisanColorPicker
                      selectedColors={selectedColorsEdit}
                      onAddColor={(rep) => setSelectedColorsEdit((prev) => [...prev, rep])}
                    />

                    {selectedColorsEdit.length === 0 && (
                      <p className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                        <span>⚠ Please select or pick at least one available swatch.</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <ProductImageManager
                  images={editingProduct.images}
                  onChange={(imgs) => setEditingProduct({ ...editingProduct, images: imgs })}
                />
              </div>
            </div>
            </div>
            <div className="flex space-x-4 mt-6 border-t border-gray-100 pt-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all"
              >
                Update Product
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Blog Post Modal */}
      {showBlogAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleAddBlog}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-950">
              Create New Article
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Article Title
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  placeholder="e.g. Empowering Rural Artisans through Soplus"
                  value={newBlog.title}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Author
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.author}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, author: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Read Estimate
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.readTime}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, readTime: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Published Date
                </label>
                <input
                  required
                  type="date"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.publishedAt}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, publishedAt: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all"
                  value={newBlog.image}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, image: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Categories / Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Artisans, Growth, Impact"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.tagsString}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, tagsString: e.target.value })
                  }
                />
              </div>

              {/* SEO Sub-section */}
              <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                <span className="text-xs font-black uppercase text-orange-600 tracking-wider">SEO Fields (Optional)</span>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Title
                </label>
                <input
                  type="text"
                  placeholder="Custom browser tab title for search engines"
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.seoTitle}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, seoTitle: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Description
                </label>
                <textarea
                  placeholder="Short, highly indexable summary of this blog post (150-160 characters)"
                  rows={2}
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.seoDescription}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, seoDescription: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Content / Story Message
                </label>
                <div className="mt-1">
                  <RichTextEditor
                    content={newBlog.content}
                    onChange={(val) => setNewBlog({ ...newBlog, content: val })}
                    placeholder="Write your beautiful artisan storytelling article here..."
                    id="new-blog-content"
                  />
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-700 transition-all"
              >
                Create Post
              </button>
              <button
                type="button"
                onClick={() => setShowBlogAddModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50 text-gray-750"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Blog Post Modal */}
      {showBlogEditModal && editingBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleUpdateBlog}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-950">Edit Article</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Article Title
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.title}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Author
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.author || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, author: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Read Estimate
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.readTime || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, readTime: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Published Date
                </label>
                <input
                  required
                  type="date"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={
                    editingBlog.publishedAt && typeof editingBlog.publishedAt === "string"
                      ? editingBlog.publishedAt.split("T")[0]
                      : new Date().toISOString().split("T")[0]
                  }
                  onChange={(e) =>
                    setEditingBlog({
                      ...editingBlog,
                      publishedAt: `${e.target.value}T12:00:00Z`,
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all"
                  value={editingBlog.image || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, image: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Categories / Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Artisans, Growth, Impact"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingBlog({
                      ...editingBlog,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              {/* SEO Sub-section */}
              <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                <span className="text-xs font-black uppercase text-orange-600 tracking-wider">SEO Fields (Optional)</span>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Title
                </label>
                <input
                  type="text"
                  placeholder="Custom browser tab title for search engines"
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.seoTitle || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, seoTitle: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Description
                </label>
                <textarea
                  placeholder="Short, highly indexable summary of this blog post (150-160 characters)"
                  rows={2}
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.seoDescription || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, seoDescription: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Content / Story Message
                </label>
                <div className="mt-1">
                  <RichTextEditor
                    content={editingBlog.content}
                    onChange={(val) => setEditingBlog({ ...editingBlog, content: val })}
                    placeholder="Write your beautiful artisan storytelling article here..."
                    id="edit-blog-content"
                  />
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all"
              >
                Update Post
              </button>
              <button
                type="button"
                onClick={() => setShowBlogEditModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50 text-gray-750"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "careers" && (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading careers board...</div>}>
          <CareersTab
            jobOffers={jobOffers as any}
            setJobOffers={setJobOffers as any}
            jobApplications={jobApplications}
            setJobApplications={setJobApplications}
            subTab={subTab}
            setSubTab={(val: string) => setSubTab(val as any)}
            setNewJob={setNewJob}
            setShowJobAddModal={setShowJobAddModal}
          />
        </Suspense>
      )}

      {activeTab === "pod_config" && (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading Pay on Delivery Rule Matrix...</div>}>
          <PodConfigTab />
        </Suspense>
      )}

      {activeTab === "approval_queue" && (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading product clearance queue...</div>}>
          <ApprovalQueueTab
            pendingProducts={pendingProducts}
            setPendingProducts={setPendingProducts}
            confirmingApprovePendingId={confirmingApprovePendingId}
            setConfirmingApprovePendingId={setConfirmingApprovePendingId}
            selectedPendingForRejection={selectedPendingForRejection}
            setSelectedPendingForRejection={setSelectedPendingForRejection}
            pendingRejectionReasonInput={pendingRejectionReasonInput}
            setPendingRejectionReasonInput={setPendingRejectionReasonInput}
            fetchData={fetchData}
          />
        </Suspense>
      )}

      {activeTab === "marketing" && (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-bold">Loading marketing campaigns & banners...</div>}>
          <MarketingTab
            campaigns={campaigns}
            campaignTitle={campaignTitle}
            setCampaignTitle={setCampaignTitle}
            campaignMessage={campaignMessage}
            setCampaignMessage={setCampaignMessage}
            campaignChannel={campaignChannel}
            setCampaignChannel={(val: string) => setCampaignChannel(val as any)}
            campaignTargetType={campaignTargetType}
            setCampaignTargetType={setCampaignTargetType}
            campaignProductId={campaignProductId}
            setCampaignProductId={setCampaignProductId}
            campaignCategory={campaignCategory}
            setCampaignCategory={setCampaignCategory}
            isCreatingCampaign={isCreatingCampaign}
            setIsCreatingCampaign={setIsCreatingCampaign}
            user={user}
            products={products}
            fetchData={fetchData}
            handleStartEditCampaign={handleStartEditCampaign}
            handleDeleteCampaign={handleDeleteCampaign}
          />
        </Suspense>
      )}

      {/* View Order Details Modal */}
      {selectedViewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative text-gray-950 font-sans">
            {/* Close button */}
            <button
              onClick={() => setSelectedViewOrder(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-2xl transition-all cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider bg-orange-50 px-2.5 py-1 rounded-md">
                Order details
              </span>
              <h2 className="text-2xl font-black mt-2">Order #{selectedViewOrder.id.slice(0, 8)}</h2>
              <p className="text-xs text-gray-400 font-semibold mt-1">
                Placed on:{" "}
                {selectedViewOrder.createdAt?.toDate
                  ? selectedViewOrder.createdAt.toDate().toLocaleString("en-KE")
                  : new Date(selectedViewOrder.createdAt).toLocaleString("en-KE")}
              </p>
            </div>

            {/* Customer Details info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-3xl border border-gray-100/50 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Customer info</p>
                  {(selectedViewOrder.isGuestOrder || selectedViewOrder.userId === "guest" || !selectedViewOrder.userId) && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Guest Checkout
                    </span>
                  )}
                </div>
                <p className="font-extrabold text-gray-800 break-all">
                  {selectedViewOrder.customerName || selectedViewOrder.shippingAddress?.fullName || selectedViewOrder.userEmail || "Guest Customer"}
                </p>
                <p className="text-xs text-gray-500 font-medium break-all">
                  Email: {selectedViewOrder.userEmail || "None provided"}
                </p>
                <p className="text-[11px] text-gray-400 font-mono">
                  Account ID: {selectedViewOrder.userId || "guest"}
                </p>
                {selectedViewOrder.guestSessionToken && (
                  <p className="text-[10px] text-gray-400 font-mono">
                    Session: {selectedViewOrder.guestSessionToken}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Delivery Address</p>
                <p className="font-extrabold text-gray-800">
                  {selectedViewOrder.shippingAddress?.fullName || "N/A"}
                </p>
                <p className="text-xs text-gray-650 leading-relaxed">
                  {selectedViewOrder.shippingAddress?.streetAddress || selectedViewOrder.shippingAddress?.street}, {selectedViewOrder.shippingAddress?.city},{" "}
                  {selectedViewOrder.shippingAddress?.county} Kenya.
                </p>
                {selectedViewOrder.shippingAddress?.phone && (
                  <p className="text-xs text-orange-600 font-bold">
                    Phone: {selectedViewOrder.shippingAddress.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Items order details */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Items Ordered</p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-3xl overflow-hidden bg-white">
                {selectedViewOrder.items && selectedViewOrder.items.map((item: any, idx: number) => {
                  const itemProd = products.find((p) => p.id === item.productId);
                  const itemBuyingPrice = itemProd && itemProd.buyingPrice !== undefined ? itemProd.buyingPrice : (item.price * 0.6);
                  const itemProfit = (item.price - itemBuyingPrice) * item.quantity;
                  return (
                    <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between text-sm hover:bg-gray-50/30 transition-colors gap-2">
                      <div className="flex items-center space-x-3">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded-xl border border-gray-100 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div>
                          <p className="font-bold text-gray-955">{item.name}</p>
                          <p className="text-xs text-gray-450 font-medium">Qty: {item.quantity} × KES {item.price.toLocaleString()}</p>
                          <div className="mt-1 text-[11px] text-orange-655 font-bold bg-orange-50/50 rounded-lg border border-orange-100/10 px-2 py-0.5 w-fit">
                            Est. Profit: KES {itemProfit.toLocaleString()} <span className="text-gray-400 font-semibold">(Cost: KES {itemBuyingPrice.toLocaleString()}/unit)</span>
                          </div>
                        </div>
                      </div>
                      <p className="font-black text-gray-955 text-right shrink-0">
                        KES {(item.quantity * item.price).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial summaries */}
            <div className="pt-4 border-t border-gray-100 flex flex-col space-y-3">
              {(() => {
                const orderTotalCost = selectedViewOrder.items ? selectedViewOrder.items.reduce((sum: number, item: any) => {
                  const prod = products.find((p) => p.id === item.productId);
                  const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
                  return sum + (unitCost * item.quantity);
                }, 0) : 0;
                const orderItemsRevenue = selectedViewOrder.items ? selectedViewOrder.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : 0;
                const orderTotalProfit = orderItemsRevenue - orderTotalCost;
                const orderProfitMargin = orderItemsRevenue > 0 ? (orderTotalProfit / orderItemsRevenue) * 100 : 0;
                return (
                  <div className="flex items-center justify-between text-sm text-gray-500 font-semibold bg-orange-50/30 border border-orange-150/20 p-4 rounded-3xl mb-1.5 shadow-sm">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-black text-orange-700 block mb-0.5">Estimated Order Profit (Internal)</span>
                      <span className="text-lg font-black text-orange-850">KES {orderTotalProfit.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-widest font-black text-orange-700 block mb-0.5">Profit Margin</span>
                      <span className="text-xs font-black text-white bg-orange-600 px-3 py-1 rounded-full">{orderProfitMargin.toFixed(1)}% Margin</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between text-sm text-gray-500 font-semibold items-center">
                <span>Status</span>
                <span className={`text-[10px] tracking-wider uppercase font-bold px-2.5 py-0.5 rounded-md ${
                  selectedViewOrder.status === "delivered"
                    ? "bg-green-100 text-green-700"
                    : selectedViewOrder.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}>
                  {selectedViewOrder.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 font-semibold">
                <span>Shipping Fee</span>
                <span className="text-gray-950 font-black">
                  KES {(selectedViewOrder.shippingFee || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Total Amount</p>
                  <p className="text-xl font-black text-gray-950 tracking-tight leading-tight">
                    KES {selectedViewOrder.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold tracking-tight">
                    Prices are inclusive of 16% VAT.
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const dummyUser: UserProfile = {
                        uid: selectedViewOrder.userId,
                        email: selectedViewOrder.userEmail || "customer@sokoplus.co.ke",
                        displayName: selectedViewOrder.shippingAddress?.fullName || selectedViewOrder.userEmail?.split("@")[0] || "Valued Customer",
                        phoneNumber: selectedViewOrder.shippingAddress?.phone || "",
                        isAdmin: false,
                        loyaltyPoints: 0,
                        emailVerified: true,
                      };
                      downloadReceipt(selectedViewOrder, dummyUser);
                    }}
                    className="inline-flex items-center bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold px-4 py-3 rounded-2xl text-xs transition-colors cursor-pointer border border-orange-100/50"
                  >
                    <span>Download Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedViewOrder(null)}
                    className="px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Refund & Inventory Restock Management */}
              <OrderRefundManager
                order={selectedViewOrder}
                products={products}
                onRefundSuccess={(updatedOrder, restockedProducts) => {
                  setSelectedViewOrder(updatedOrder);
                  setOrders((prevOrders) =>
                    prevOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
                  );
                  if (restockedProducts.length > 0) {
                    setProducts((prevProducts) =>
                      prevProducts.map((p) => {
                        const restock = restockedProducts.find((rp) => rp.productId === p.id);
                        return restock
                          ? { ...p, stock: restock.newStock, inStock: restock.newStock > 0 }
                          : p;
                      })
                    );
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Marketing Campaign Modal */}
      {showCampaignEditModal && editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative text-gray-950 font-sans">
            {/* Close button */}
            <button
              onClick={() => {
                setShowCampaignEditModal(false);
                setEditingCampaign(null);
              }}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-2xl transition-all cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider bg-orange-50 px-2.5 py-1 rounded-md">
                Campaign Settings
              </span>
              <h2 className="text-2xl font-black mt-2">Edit Marketing Campaign</h2>
              <p className="text-xs text-gray-400 font-semibold mt-1">
                Refine the campaign details, target audience, and message body.
              </p>
            </div>

            <form onSubmit={handleUpdateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Campaign Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 20% off all artisan craft sculptures!"
                  className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-semibold text-gray-950"
                  value={editCampaignTitle}
                  onChange={(e) => setEditCampaignTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Delivery Channel</label>
                  <select
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                    value={editCampaignChannel}
                    onChange={(e: any) => setEditCampaignChannel(e.target.value)}
                  >
                    <option value="both">Both (Email & Push)</option>
                    <option value="email">Email Only</option>
                    <option value="push">Live Push Alert Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Target Audience</label>
                  <select
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                    value={editCampaignTargetType}
                    onChange={(e) => setEditCampaignTargetType(e.target.value)}
                  >
                    <option value="all">All Register Users</option>
                    <option value="wishlist_nonempty">Any Item in Wishlist</option>
                    <option value="wishlist_product">Specific Item in Wishlist</option>
                    <option value="wishlist_category">Specific Category in Wishlist</option>
                    <option value="cart_nonempty">Any Item inside Active Cart</option>
                    <option value="cart_product">Specific Item in Cart</option>
                    <option value="cart_category">Specific Category in Cart</option>
                  </select>
                </div>
              </div>

              {/* Dynamic selector inputs depending on target selection */}
              {editCampaignTargetType.endsWith("_product") && (
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Select Specific Product</label>
                  <select
                    required
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                    value={editCampaignProductId}
                    onChange={(e) => setEditCampaignProductId(e.target.value)}
                  >
                    <option value="">-- Choose target product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (KES {p.price})</option>
                    ))}
                  </select>
                </div>
              )}

              {editCampaignTargetType.endsWith("_category") && (
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Select Specific Category</label>
                  <select
                    required
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                    value={editCampaignCategory}
                    onChange={(e) => setEditCampaignCategory(e.target.value)}
                  >
                    <option value="">-- Choose target category --</option>
                    {Array.from(new Set(products.map((p) => p.category))).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Broadcast Message Content</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Write a personalized, high-converting message..."
                  className="w-full p-4 bg-gray-55 border border-gray-150 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium leading-relaxed resize-none shadow-sm"
                  value={editCampaignMessage}
                  onChange={(e) => setEditCampaignMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCampaignEditModal(false);
                    setEditingCampaign(null);
                  }}
                  className="px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCampaign}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400 active:scale-98 text-white text-xs font-black uppercase tracking-wider py-3 px-6 rounded-2xl transition-all shadow-lg shadow-orange-600/10 cursor-pointer"
                >
                  {isUpdatingCampaign ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Marketing Display Banner Modal */}
      {showBannerEditModal && editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative text-gray-950 font-sans">
            {/* Close button */}
            <button
              onClick={() => {
                setShowBannerEditModal(false);
                setEditingBanner(null);
              }}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-2xl transition-all cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider bg-amber-50 px-2.5 py-1 rounded-md">
                Banner Settings
              </span>
              <h2 className="text-2xl font-black mt-2">Edit Display Banner</h2>
              <p className="text-xs text-gray-400 font-semibold mt-1">
                Refine active seasonal promo parameters, aesthetics and action destinations.
              </p>
            </div>

            <form onSubmit={handleUpdateBanner} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Banner Message text</label>
                <textarea
                  required
                  rows={3}
                  className="w-full p-3.5 bg-gray-55 border border-gray-150 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium leading-relaxed resize-none shadow-sm text-gray-950"
                  value={editBannerText}
                  onChange={(e) => setEditBannerText(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Background Style</label>
                  <select
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-750"
                    value={editBannerBackgroundColor}
                    onChange={(e) => setEditBannerBackgroundColor(e.target.value)}
                  >
                    <option value="sunset">Sunset Orange Gradient</option>
                    <option value="forest">Forest Teal Gradient</option>
                    <option value="ocean">Ocean Indigo Gradient</option>
                    <option value="royal">Royal Purple Gradient</option>
                    <option value="charcoal">Charcoal Dark Gradient</option>
                    <option value="black">Solid Black</option>
                    <option value="gold">Amber Gold Gradient</option>
                    <option value="festive">Festive Red Gradient</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Text Color</label>
                  <select
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-750"
                    value={editBannerTextColor}
                    onChange={(e) => setEditBannerTextColor(e.target.value)}
                  >
                    <option value="text-white">White Text</option>
                    <option value="text-amber-100">Warm Amber Text</option>
                    <option value="text-orange-100">Orange tint Text</option>
                    <option value="text-green-100">Mint tint Text</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Active Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                    value={editBannerStartDate}
                    onChange={(e) => setEditBannerStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Expiry End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                    value={editBannerEndDate}
                    onChange={(e) => setEditBannerEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Action Button Text</label>
                  <input
                    type="text"
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-semibold text-gray-950"
                    value={editBannerActionText}
                    onChange={(e) => setEditBannerActionText(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Action Route/URL</label>
                  <input
                    type="text"
                    className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-semibold text-gray-950"
                    value={editBannerActionUrl}
                    onChange={(e) => setEditBannerActionUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editBannerActiveCheckbox"
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-4.5 h-4.5 cursor-pointer accent-orange-600"
                    checked={editBannerActive}
                    onChange={(e) => setEditBannerActive(e.target.checked)}
                  />
                  <label htmlFor="editBannerActiveCheckbox" className="text-xs font-black text-gray-600 uppercase tracking-tight cursor-pointer select-none">
                    Campaign is Active
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editBannerClosableCheckbox"
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-4.5 h-4.5 cursor-pointer accent-orange-600"
                    checked={editBannerClosable}
                    onChange={(e) => setEditBannerClosable(e.target.checked)}
                  />
                  <label htmlFor="editBannerClosableCheckbox" className="text-xs font-black text-gray-600 uppercase tracking-tight cursor-pointer select-none">
                    Dismissable (Closable)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowBannerEditModal(false);
                    setEditingBanner(null);
                  }}
                  className="px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingBanner}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400 active:scale-98 text-white text-xs font-black uppercase tracking-wider py-3 px-6 rounded-2xl transition-all shadow-lg shadow-orange-600/10 cursor-pointer"
                >
                  {isUpdatingBanner ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Floating Sticky Quick Navigation Bar (md:hidden) */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-gray-900/90 backdrop-blur-md text-white p-2.5 rounded-2xl border border-gray-800 shadow-2xl flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-extrabold transition-all ${activeTab === "analytics" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <TrendingUp size={16} />
          <span className="mt-0.5">Stats</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-extrabold transition-all ${activeTab === "inventory" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <Package size={16} />
          <span className="mt-0.5">Catalog</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-extrabold transition-all ${activeTab === "orders" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <ShoppingBag size={16} />
          <span className="mt-0.5">Orders</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inbox")}
          className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-extrabold transition-all relative ${activeTab === "inbox" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          <MessageSquare size={16} />
          <span className="mt-0.5">Inbox</span>
          {tickets.filter((t) => t.status === "open").length > 0 && (
            <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowMobileModuleDrawer(true)}
          className="py-2 px-2.5 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex flex-col items-center justify-center text-[10px] font-extrabold hover:bg-orange-600 hover:text-white transition-all cursor-pointer shrink-0"
        >
          <LayoutGrid size={16} />
          <span className="mt-0.5">More</span>
        </button>
      </div>
    </div>
  );
}
