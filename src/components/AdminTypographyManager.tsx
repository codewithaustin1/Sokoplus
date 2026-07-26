import React, { useState } from "react";
import { useTypography } from "../lib/TypographyContext";
import { TypographyPreset } from "../lib/typography";
import { motion, AnimatePresence } from "motion/react";
import {
  Type,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Sparkles,
  Search,
  Check,
  Eye,
  Layers,
  Palette,
  Sliders,
  Globe,
  Info,
  X,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

export function AdminTypographyManager() {
  const {
    selectedTypographyId,
    selectedTypography,
    customTypographyNames,
    presets,
    selectTypography,
    assignTypographyName,
    resetTypographyName,
  } = useTypography();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [editingPreset, setEditingPreset] = useState<TypographyPreset | null>(null);
  const [customNameInput, setCustomNameInput] = useState<string>("");
  const [isApplying, setIsApplying] = useState<string | null>(null);

  // Active current typography name editing state
  const [isEditingCurrentName, setIsEditingCurrentName] = useState<boolean>(false);
  const [currentNameInput, setCurrentNameInput] = useState<string>("");

  const handleApply = async (preset: TypographyPreset) => {
    setIsApplying(preset.id);
    try {
      await selectTypography(preset.id);
      toast.success(
        <div>
          <p className="font-bold text-sm">Typography Applied Platform-Wide!</p>
          <p className="text-xs text-gray-200 mt-0.5">
            "{preset.name}" is now active across all store pages.
          </p>
        </div>,
        { duration: 4000 }
      );
    } catch (err) {
      toast.error("Failed to apply typography");
    } finally {
      setIsApplying(null);
    }
  };

  const handleOpenEditModal = (preset: TypographyPreset) => {
    setEditingPreset(preset);
    setCustomNameInput(customTypographyNames[preset.id] || preset.name);
  };

  const handleSaveCustomName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset) return;
    if (!customNameInput.trim()) {
      toast.error("Please enter a valid typography name");
      return;
    }

    try {
      await assignTypographyName(editingPreset.id, customNameInput.trim());
      toast.success(`Assigned typography name: "${customNameInput.trim()}"`);
      setEditingPreset(null);
    } catch (err) {
      toast.error("Failed to update typography name");
    }
  };

  const handleResetName = async (presetId: string) => {
    try {
      await resetTypographyName(presetId);
      toast.success("Reset typography name to default");
      setEditingPreset(null);
    } catch (err) {
      toast.error("Failed to reset typography name");
    }
  };

  const handleSaveCurrentNameDirect = async () => {
    if (!currentNameInput.trim()) {
      toast.error("Please enter a valid typography name");
      return;
    }
    try {
      await assignTypographyName(selectedTypography.id, currentNameInput.trim());
      toast.success(`Active typography renamed to "${currentNameInput.trim()}"`);
      setIsEditingCurrentName(false);
    } catch (err) {
      toast.error("Failed to rename typography");
    }
  };

  // Filtered list
  const filteredPresets = presets.filter((p) => {
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(searchLower) ||
      p.headingFontName.toLowerCase().includes(searchLower) ||
      p.bodyFontName.toLowerCase().includes(searchLower) ||
      p.tags.some((t) => t.toLowerCase().includes(searchLower)) ||
      p.description.toLowerCase().includes(searchLower);

    return matchesCategory && matchesSearch;
  });

  const categories = [
    "all",
    "Artisan & Heritage",
    "Modern & Minimalist",
    "Editorial & Classic",
    "Expressive & Display",
    "Handcrafted & Warm",
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-orange-950 text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-orange-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                <Sparkles size={12} className="text-orange-400" />
                Global Brand Aesthetics
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                <Globe size={11} /> Live Platform Sync
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Type className="text-orange-400" size={28} />
              <span>Platform Typography Manager</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
              Select and assign font combinations for headlines, body text, and store UI controls.
              When a typography is selected, it updates across all pages, products, checkout, and visitor views instantly.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex flex-col items-start gap-2 shrink-0">
            <span className="text-[10px] font-black text-orange-200 uppercase tracking-wider">
              Active Font Family Pair
            </span>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-orange-500/30 text-orange-200 font-mono text-[11px]">
                {selectedTypography.headingFontName}
              </span>
              <span>+</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 font-mono text-[11px]">
                {selectedTypography.bodyFontName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Selected Typography - Highlighted Hero Card */}
      <div className="bg-white dark:bg-gray-900 border-2 border-orange-500/40 dark:border-orange-500/50 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                Currently Implemented Platform Typography
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                ID: {selectedTypography.id}
              </span>
            </div>

            {isEditingCurrentName ? (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={currentNameInput}
                  onChange={(e) => setCurrentNameInput(e.target.value)}
                  placeholder="Enter typography assigned name..."
                  className="bg-gray-50 dark:bg-gray-800 border border-orange-300 dark:border-orange-600 px-3 py-1.5 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentNameDirect}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 cursor-pointer flex items-center gap-1"
                >
                  <Save size={14} />
                  <span>Save Name</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCurrentName(false)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 pt-1">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  {selectedTypography.name}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentNameInput(selectedTypography.name);
                    setIsEditingCurrentName(true);
                  }}
                  className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Assign Custom Name to Typography"
                >
                  <Pencil size={14} />
                  <span>Assign Custom Name</span>
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {selectedTypography.description}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="px-3 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-xs font-black rounded-xl border border-orange-200/60 dark:border-orange-900/40">
              {selectedTypography.category}
            </span>
          </div>
        </div>

        {/* Live Interactive Specimen Canvas */}
        <div className="bg-gray-50 dark:bg-gray-950 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800 pb-3">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
              <Eye size={12} className="text-orange-500" />
              Live Typography Specimen Preview
            </span>
            <span className="text-[10px] text-gray-400 font-bold font-mono">
              Headlines: {selectedTypography.headingFontName} | Body: {selectedTypography.bodyFontName}
            </span>
          </div>

          <div className="space-y-3">
            <h3
              className="text-2xl sm:text-3xl font-extrabold text-gray-950 dark:text-white leading-tight"
              style={{ fontFamily: selectedTypography.headingFont }}
            >
              Handcrafted Kenyan Artisans & Sustainable Craftsmanship
            </h3>
            <p
              className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-relaxed max-w-3xl"
              style={{ fontFamily: selectedTypography.bodyFont }}
            >
              Discover authentic Kisii soapstone carvings, handwoven sisal baskets, and recycled brass jewelry.
              Every piece supports local artisan families across Kenya with direct fair-trade settlements.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-orange-600 text-white font-bold text-xs rounded-xl shadow-sm"
                style={{ fontFamily: selectedTypography.bodyFont }}
              >
                Sample UI Button Text
              </button>
              <span
                className="text-xs font-bold text-orange-600 underline cursor-pointer"
                style={{ fontFamily: selectedTypography.bodyFont }}
              >
                Sample Interactive Link Text →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-150 dark:border-gray-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search typography by name, font family (e.g. Playfair, Inter, Syne), or style tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {cat === "all" ? "All Typographies" : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Typography Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPresets.map((preset) => {
          const isCurrent = preset.id === selectedTypographyId;
          const hasCustomName = !!customTypographyNames[preset.id];

          return (
            <motion.div
              key={preset.id}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white dark:bg-gray-900 rounded-3xl p-6 border transition-all flex flex-col justify-between space-y-5 shadow-lg relative group ${
                isCurrent
                  ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-50/10 dark:bg-orange-950/10"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <div className="space-y-4">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-black uppercase">
                        {preset.category}
                      </span>
                      {hasCustomName && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase">
                          Custom Name Assigned
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">
                      {preset.name}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(preset)}
                      className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                      title="Assign/Rename Typography Name"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  {preset.description}
                </p>

                {/* Font pairing badge */}
                <div className="flex items-center gap-2 text-xs font-mono bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-150 dark:border-gray-750">
                  <span className="text-orange-600 dark:text-orange-400 font-bold">Header:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-semibold">{preset.headingFontName}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">Body:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-semibold">{preset.bodyFontName}</span>
                </div>

                {/* Mini Typography Specimen Card */}
                <div className="bg-gray-50/80 dark:bg-gray-950 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 space-y-2">
                  <h4
                    className="text-lg font-black text-gray-900 dark:text-white leading-snug"
                    style={{ fontFamily: preset.headingFont }}
                  >
                    SokoPlus Authentic Craftsmanship
                  </h4>
                  <p
                    className="text-xs font-normal text-gray-600 dark:text-gray-300 leading-relaxed"
                    style={{ fontFamily: preset.bodyFont }}
                  >
                    Handwoven baskets, soapstone sculptures, and artisan luxury ethically sourced across East Africa.
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {preset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Action Button */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                {isCurrent ? (
                  <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Active Platform Typography</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApply(preset)}
                    disabled={isApplying === preset.id}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-600/15 cursor-pointer disabled:opacity-50"
                  >
                    <Check size={16} />
                    <span>{isApplying === preset.id ? "Applying Across Platform..." : "Select & Implement Typography"}</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal: Rename / Assign Name to Typography */}
      <AnimatePresence>
        {editingPreset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-600 p-2.5 rounded-2xl">
                    <Pencil size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                      Assign Typography Name
                    </h3>
                    <p className="text-xs text-gray-500">
                      ID: {editingPreset.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full bg-gray-100 dark:bg-gray-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveCustomName} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Custom Assigned Typography Name
                  </label>
                  <input
                    type="text"
                    value={customNameInput}
                    onChange={(e) => setCustomNameInput(e.target.value)}
                    placeholder="e.g. Modern African Craft, Spring 2026 Collection Font..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-2xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-[11px] text-gray-400 font-medium">
                    This custom assigned name will be shown across the typography management dashboard and site settings.
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-150 dark:border-gray-750 text-xs space-y-1">
                  <p className="font-bold text-gray-800 dark:text-gray-200">Font Pair Details:</p>
                  <p className="text-gray-500 dark:text-gray-400">Heading: {editingPreset.headingFontName}</p>
                  <p className="text-gray-500 dark:text-gray-400">Body: {editingPreset.bodyFontName}</p>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  {customTypographyNames[editingPreset.id] ? (
                    <button
                      type="button"
                      onClick={() => handleResetName(editingPreset.id)}
                      className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw size={14} />
                      <span>Reset Name</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPreset(null)}
                      className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-600/20"
                    >
                      <Save size={14} />
                      <span>Save Assigned Name</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
