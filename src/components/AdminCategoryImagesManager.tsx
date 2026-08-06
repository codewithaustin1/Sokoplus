import React, { useState, useEffect } from "react";
import { LayoutGrid, Save, RotateCcw, Image as ImageIcon, Upload, Sparkles, Check, Search, Plus, Trash2 } from "lucide-react";
import { DEFAULT_CATEGORY_IMAGES, FALLBACK_CATEGORY_IMAGE, getCategoryImageUrl } from "../lib/categoryImages";
import { db } from "../lib/firebase";
import { collection, query, limit, getDocs, getDocsFromCache } from "firebase/firestore";
import { toast } from "react-hot-toast";

interface AdminCategoryImagesManagerProps {
  categoryImages: Record<string, string>;
  onChangeCategoryImages: (newMap: Record<string, string>) => void;
  onSave: () => void;
  isSaving?: boolean;
}

const CATEGORY_PRESETS: Record<string, string[]> = {
  "Local Crafts": [
    "https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
  ],
  "Fashion": [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
  ],
  "Groceries": [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=800&q=80",
  ],
  "Electronics": [
    "https://images.unsplash.com/photo-1498049860654-af1a5c566976?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=800&q=80",
  ],
  "Beauty & Personal Care": [
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512290900673-7002fa481e05?auto=format&fit=crop&w=800&q=80",
  ],
  "Home & Office Décor": [
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80",
  ],
  "Pet Supplies": [
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=800&q=80",
  ],
};

const STANDARD_CATEGORIES = [
  "Local Crafts",
  "Fashion",
  "Groceries",
  "Electronics",
  "Beauty & Personal Care",
  "Home & Office Décor",
  "Pet Supplies",
];

export default function AdminCategoryImagesManager({
  categoryImages,
  onChangeCategoryImages,
  onSave,
  isSaving = false,
}: AdminCategoryImagesManagerProps) {
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [activePresetModalCategory, setActivePresetModalCategory] = useState<string | null>(null);
  const [customCatInput, setCustomCatInput] = useState("");

  // Fetch unique categories existing in products
  useEffect(() => {
    let isMounted = true;
    const fetchDbCats = async () => {
      try {
        const q = query(collection(db, "products"), limit(200));
        let snap;
        try {
          snap = await getDocsFromCache(q);
          if (!snap || snap.empty) snap = await getDocs(q);
        } catch (cacheErr) {
          snap = await getDocs(q);
        }
        const setOfCats = new Set<string>();
        snap.docs.forEach((d) => {
          const cat = d.data()?.category;
          if (cat && typeof cat === "string") setOfCats.add(cat.trim());
        });
        if (isMounted) {
          setDbCategories(Array.from(setOfCats));
        }
      } catch (err) {
        console.warn("Category fetch error:", err);
      }
    };
    fetchDbCats();
    return () => { isMounted = false; };
  }, []);

  // Merge standard categories, db categories, and any custom set category images
  const allCategoryNames = Array.from(
    new Set([
      ...STANDARD_CATEGORIES,
      ...dbCategories,
      ...Object.keys(categoryImages || {}),
    ])
  );

  const handleUpdateImage = (categoryName: string, url: string) => {
    const updated = { ...categoryImages, [categoryName]: url };
    onChangeCategoryImages(updated);
  };

  const handleResetImage = (categoryName: string) => {
    const updated = { ...categoryImages };
    delete updated[categoryName];
    onChangeCategoryImages(updated);
    toast.success(`Reset ${categoryName} to default image.`);
  };

  const handleAddCustomCategory = () => {
    if (!customCatInput.trim()) return;
    const name = customCatInput.trim();
    if (allCategoryNames.includes(name)) {
      toast.error("Category already exists in list.");
      return;
    }
    handleUpdateImage(name, DEFAULT_CATEGORY_IMAGES[name] || FALLBACK_CATEGORY_IMAGE);
    setCustomCatInput("");
    toast.success(`Added ${name} category.`);
  };

  const handleFileUpload = (categoryName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file is too large (max 2MB). Please pick a smaller image or paste an image URL.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      if (result) {
        handleUpdateImage(categoryName, result);
        toast.success(`Uploaded image for ${categoryName}`);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-800 space-y-6 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <LayoutGrid size={18} className="text-orange-600" />
            SokoPlus Mobile Category Images Manager
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Set custom background images for each category rendered in the mobile Categories view.
          </p>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="text-xs font-extrabold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Save size={15} />
          {isSaving ? "Saving..." : "Save Category Images"}
        </button>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {allCategoryNames.map((catName) => {
          const currentUrl = getCategoryImageUrl(catName, categoryImages);
          const isCustom = categoryImages[catName] && categoryImages[catName].trim() !== "";
          const presets = CATEGORY_PRESETS[catName] || [
            "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
          ];

          return (
            <div
              key={catName}
              className="bg-gray-50/60 dark:bg-gray-950/40 rounded-2xl p-4 border border-gray-150 dark:border-gray-800 flex flex-col justify-between gap-3 space-y-2 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              {/* Card Image Preview */}
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group shadow-2xs">
                <img
                  src={currentUrl}
                  alt={catName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_CATEGORY_IMAGE;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-xs font-extrabold block drop-shadow-xs truncate">
                    {catName}
                  </span>
                  <span className="text-[10px] text-white/80 font-medium block">
                    {isCustom ? "Custom Admin Image" : "Default Image"}
                  </span>
                </div>

                {isCustom && (
                  <button
                    type="button"
                    onClick={() => handleResetImage(catName)}
                    title="Reset to default image"
                    className="absolute top-2.5 right-2.5 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>

              {/* URL Input & Controls */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                  Image URL or Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={categoryImages[catName] || ""}
                    onChange={(e) => handleUpdateImage(catName, e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full text-xs py-2 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/40 text-gray-900 dark:text-gray-100 font-mono text-[11px]"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {/* Preset picker toggle */}
                  <button
                    type="button"
                    onClick={() => setActivePresetModalCategory(activePresetModalCategory === catName ? null : catName)}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles size={12} /> Presets
                  </button>

                  {/* Upload file button */}
                  <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
                    <Upload size={12} /> Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(catName, e)}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Preset Options Popover */}
                {activePresetModalCategory === catName && (
                  <div className="p-3 bg-white dark:bg-gray-950 rounded-xl border border-orange-200 dark:border-orange-900/50 space-y-2 animate-in fade-in duration-200">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                      Curated Preset Backgrounds
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {presets.map((pUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            handleUpdateImage(catName, pUrl);
                            setActivePresetModalCategory(null);
                            toast.success(`Selected preset for ${catName}`);
                          }}
                          className={`h-14 rounded-lg overflow-hidden border-2 relative cursor-pointer group ${
                            currentUrl === pUrl ? "border-orange-500" : "border-transparent hover:border-orange-300"
                          }`}
                        >
                          <img src={pUrl} alt="Preset" className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                          {currentUrl === pUrl && (
                            <div className="absolute inset-0 bg-orange-600/40 flex items-center justify-center">
                              <Check size={14} className="text-white font-bold" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Category row */}
      <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-dashed border-gray-250 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={customCatInput}
            onChange={(e) => setCustomCatInput(e.target.value)}
            placeholder="Add new category name (e.g. Handmade Toys)"
            className="text-xs py-2 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/40 w-full sm:w-72"
          />
          <button
            type="button"
            onClick={handleAddCustomCategory}
            className="text-xs font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus size={14} /> Add Category
          </button>
        </div>

        <p className="text-[11px] text-gray-400 font-medium">
          Images saved here instantly sync across all mobile web viewports.
        </p>
      </div>
    </div>
  );
}
