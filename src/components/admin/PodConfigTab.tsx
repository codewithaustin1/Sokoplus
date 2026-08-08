import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CreditCard,
  Truck,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Play,
  Save,
  RefreshCw,
  Lock,
  ChevronRight,
  Info,
  Percent,
  Coins,
  Check,
  Zap,
  Sparkles
} from "lucide-react";
import toast from "react-hot-toast";

export interface PODTier {
  id: string;
  name: string;
  minOrderValue: number;
  maxOrderValue: number;
  depositPercentage: number;
  maxDepositCap: number;
  isPrepaidOnly?: boolean;
}

export interface PODConfig {
  enabled: boolean;
  selectedPreset: "balanced" | "conservative" | "growth" | "tiered_safeguard" | "custom";
  customTiers?: PODTier[];
  maxOrderValueForPOD: number;
  restrictedCategories: string[];
  restrictedLocations: string[];
  unverifiedUserExtraDeposit: number;
  lastUpdatedBy?: string;
  updatedAt?: string;
}

interface PodConfigTabProps {
  userToken?: string;
}

const PRESET_OPTIONS = [
  {
    id: "balanced",
    name: "Balanced Standard (Default)",
    tagline: "10% Deposit (Max 700 Ksh) ≤ 19,999 | 20% Deposit > 20,000",
    badge: "Recommended",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    description: "Ideal equilibrium between buyer convenience and merchant delivery risk. Orders ≤ 19,999 Ksh require a 10% deposit (capped at KES 700 max), while orders > 20,000 Ksh require a 20% deposit.",
    maxOrderValueForPOD: 100000,
    restrictedCategories: ["Digital", "Gift Cards"],
    unverifiedUserExtraDeposit: 0,
    tiers: [
      { id: "b1", name: "Tier 1: Standard Volume", minOrderValue: 0, maxOrderValue: 19999, depositPercentage: 10, maxDepositCap: 700 },
      { id: "b2", name: "Tier 2: Premium Volume", minOrderValue: 20000, maxOrderValue: 49999, depositPercentage: 20, maxDepositCap: 2500 },
      { id: "b3", name: "Tier 3: High Value Safeguard", minOrderValue: 50000, maxOrderValue: 100000, depositPercentage: 30, maxDepositCap: 6000 }
    ]
  },
  {
    id: "conservative",
    name: "Low Risk / Conservative",
    tagline: "15% Deposit ≤ 10k | 25% Deposit ≤ 30k | Strict Category Limits",
    badge: "Maximum Security",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    description: "Designed for high-fraud mitigation, newly onboarded sellers, or high-value electronics. Requires higher commitment deposits and restricts high-risk product categories.",
    maxOrderValueForPOD: 60000,
    restrictedCategories: ["Digital", "Gift Cards", "Jewelry", "Electronics"],
    unverifiedUserExtraDeposit: 5,
    tiers: [
      { id: "c1", name: "Tier 1: Light Basket", minOrderValue: 0, maxOrderValue: 10000, depositPercentage: 15, maxDepositCap: 1000 },
      { id: "c2", name: "Tier 2: Medium Basket", minOrderValue: 10001, maxOrderValue: 30000, depositPercentage: 25, maxDepositCap: 3000 },
      { id: "c3", name: "Tier 3: Substantial Basket", minOrderValue: 30001, maxOrderValue: 60000, depositPercentage: 40, maxDepositCap: 8000 }
    ]
  },
  {
    id: "growth",
    name: "Growth & Conversion First",
    tagline: "5% Deposit ≤ 25k | Low Friction | Maximum Conversion Velocity",
    badge: "High Growth",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    description: "Prioritizes checkout conversion by lowering entry barriers for shoppers. Flat 5% deposit for orders under 25k Ksh with generous max caps.",
    maxOrderValueForPOD: 150000,
    restrictedCategories: ["Digital"],
    unverifiedUserExtraDeposit: 0,
    tiers: [
      { id: "g1", name: "Tier 1: High Velocity", minOrderValue: 0, maxOrderValue: 25000, depositPercentage: 5, maxDepositCap: 500 },
      { id: "g2", name: "Tier 2: Moderate Hold", minOrderValue: 25001, maxOrderValue: 75000, depositPercentage: 10, maxDepositCap: 1500 },
      { id: "g3", name: "Tier 3: Upper Conversion", minOrderValue: 75001, maxOrderValue: 150000, depositPercentage: 15, maxDepositCap: 4000 }
    ]
  },
  {
    id: "tiered_safeguard",
    name: "Tiered High-Value Safeguard",
    tagline: "4-Stage Progressive Ladder | Prepaid mandatory > 100k Ksh",
    badge: "Graduated Scale",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    description: "A 4-tier progressive rule set scaling from 10% up to 25% deposit, automatically enforcing 100% pre-payment for luxury orders above 100,000 Ksh.",
    maxOrderValueForPOD: 100000,
    restrictedCategories: ["Digital", "Gift Cards"],
    unverifiedUserExtraDeposit: 0,
    tiers: [
      { id: "s1", name: "Tier 1: Standard Basket", minOrderValue: 0, maxOrderValue: 15000, depositPercentage: 10, maxDepositCap: 500 },
      { id: "s2", name: "Tier 2: Medium Value", minOrderValue: 15001, maxOrderValue: 50000, depositPercentage: 15, maxDepositCap: 2000 },
      { id: "s3", name: "Tier 3: High Value Hold", minOrderValue: 50001, maxOrderValue: 100000, depositPercentage: 25, maxDepositCap: 5000 },
      { id: "s4", name: "Tier 4: Prepaid Mandatory", minOrderValue: 100001, maxOrderValue: 999999, depositPercentage: 100, maxDepositCap: 0, isPrepaidOnly: true }
    ]
  },
  {
    id: "custom",
    name: "Custom Rule Matrix",
    tagline: "Fully Configurable Multi-Tier Matrix & Fine-Grained Caps",
    badge: "Fully Editable",
    badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
    description: "Allows store managers to customize exact price ranges, deposit percentages, deposit caps, and category exclusions tailored to unique merchant needs.",
    maxOrderValueForPOD: 100000,
    restrictedCategories: ["Digital"],
    unverifiedUserExtraDeposit: 0,
    tiers: [
      { id: "custom1", name: "Custom Tier 1", minOrderValue: 0, maxOrderValue: 19999, depositPercentage: 10, maxDepositCap: 700 },
      { id: "custom2", name: "Custom Tier 2", minOrderValue: 20000, maxOrderValue: 49999, depositPercentage: 20, maxDepositCap: 2500 }
    ]
  }
];

const CATEGORY_OPTIONS = [
  "Digital",
  "Gift Cards",
  "Jewelry",
  "Electronics",
  "Fashion & Apparel",
  "Beauty & Personal Care",
  "Custom Crafted Items"
];

export const PodConfigTab: React.FC<PodConfigTabProps> = ({ userToken }) => {
  const [config, setConfig] = useState<PODConfig>({
    enabled: true,
    selectedPreset: "balanced",
    maxOrderValueForPOD: 100000,
    restrictedCategories: ["Digital", "Gift Cards"],
    restrictedLocations: [],
    unverifiedUserExtraDeposit: 0,
    customTiers: PRESET_OPTIONS[0].tiers
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Simulator test tool state
  const [simOrderTotal, setSimOrderTotal] = useState<number>(15000);
  const [simCategory, setSimCategory] = useState<string>("Fashion & Apparel");
  const [simUnverified, setSimUnverified] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Load current configuration from backend
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pod/config");
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Failed to fetch POD config:", err);
    } finally {
      setLoading(false);
    }
  };

  // Switch preset
  const handleSelectPreset = (presetId: string) => {
    const preset = PRESET_OPTIONS.find((p) => p.id === presetId);
    if (!preset) return;

    setConfig((prev) => ({
      ...prev,
      selectedPreset: presetId as any,
      maxOrderValueForPOD: preset.maxOrderValueForPOD,
      restrictedCategories: [...preset.restrictedCategories],
      unverifiedUserExtraDeposit: preset.unverifiedUserExtraDeposit,
      customTiers: presetId === "custom" ? (prev.customTiers && prev.customTiers.length > 0 ? prev.customTiers : preset.tiers) : preset.tiers
    }));
  };

  // Toggle category restriction
  const handleToggleCategory = (category: string) => {
    setConfig((prev) => {
      const exists = prev.restrictedCategories.includes(category);
      const updated = exists
        ? prev.restrictedCategories.filter((c) => c !== category)
        : [...prev.restrictedCategories, category];
      return { ...prev, restrictedCategories: updated };
    });
  };

  // Update tier field in custom mode
  const handleUpdateTier = (index: number, field: keyof PODTier, value: any) => {
    setConfig((prev) => {
      const tiers = prev.customTiers ? [...prev.customTiers] : [];
      if (tiers[index]) {
        tiers[index] = { ...tiers[index], [field]: value };
      }
      return { ...prev, customTiers: tiers };
    });
  };

  // Add custom tier
  const handleAddTier = () => {
    setConfig((prev) => {
      const tiers = prev.customTiers ? [...prev.customTiers] : [];
      const lastTier = tiers[tiers.length - 1];
      const minVal = lastTier ? lastTier.maxOrderValue + 1 : 0;
      const newTier: PODTier = {
        id: "custom_" + Date.now(),
        name: `Tier ${tiers.length + 1}`,
        minOrderValue: minVal,
        maxOrderValue: minVal + 20000,
        depositPercentage: 20,
        maxDepositCap: 3000
      };
      return { ...prev, customTiers: [...tiers, newTier] };
    });
  };

  // Delete custom tier
  const handleDeleteTier = (index: number) => {
    setConfig((prev) => {
      const tiers = prev.customTiers ? [...prev.customTiers] : [];
      tiers.splice(index, 1);
      return { ...prev, customTiers: tiers };
    });
  };

  // Save configuration to backend
  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMessage(null);
    try {
      const token = userToken || localStorage.getItem("auth_token") || "";
      const res = await fetch("/api/pod/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMessage(data.message || "POD Configuration saved successfully!");
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        // Re-run simulation with new saved rules
        runSimulation();
      } else {
        toast.error("Error saving POD settings: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      toast.error("Failed to save POD settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Run server simulation test
  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/pod/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderTotal: Number(simOrderTotal) || 0,
          items: [{ category: simCategory, price: simOrderTotal }],
          isUnverifiedUser: simUnverified
        })
      });
      const data = await res.json();
      setSimResult(data);
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [simOrderTotal, simCategory, simUnverified, config.selectedPreset, config.enabled]);

  // Current active display tiers
  const activeDisplayTiers =
    config.selectedPreset === "custom" && config.customTiers && config.customTiers.length > 0
      ? config.customTiers
      : (PRESET_OPTIONS.find((p) => p.id === config.selectedPreset)?.tiers || PRESET_OPTIONS[0].tiers);

  return (
    <div className="space-y-8 animate-fade-in text-gray-950 dark:text-gray-100 font-sans pb-12">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-6 sm:p-8 rounded-3xl border border-amber-500/20 dark:border-amber-500/30 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-xs tracking-wider uppercase">
              <ShieldCheck size={18} className="stroke-[2.5]" />
              <span>Risk Management & Order Enforcement Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              Pay on Delivery (POD) Rule Sets
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
              Configure server-enforced risk tiers, deposit hold thresholds, and category exclusions. All eligibility checks are calculated dynamically server-side to prevent client tampering.
            </p>
          </div>

          {/* Master Enable/Disable Toggle */}
          <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
            <div>
              <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">POD Global Status</p>
              <p className="text-sm font-extrabold flex items-center gap-1.5 mt-0.5">
                <span className={`w-2.5 h-2.5 rounded-full ${config.enabled ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                <span>{config.enabled ? "POD Enabled" : "POD Disabled"}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                config.enabled ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  config.enabled ? "translate-x-8" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
          <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* 5 OPTIMAL RULE SET PRESETS SELECTOR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Sliders size={20} className="text-amber-500" />
              <span>Select Risk Strategy Preset</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose from 5 optimal rule sets balancing buyer friction against capital risk.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRESET_OPTIONS.map((preset) => {
            const isSelected = config.selectedPreset === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 ring-2 ring-amber-500/20 shadow-md"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${preset.badgeColor}`}>
                      {preset.badge}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "border-amber-500 bg-amber-500 text-white" : "border-gray-300 dark:border-gray-700"
                      }`}
                    >
                      {isSelected && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </div>

                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">{preset.name}</h3>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{preset.tagline}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{preset.description}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  <span>Max Limit: KES {preset.maxOrderValueForPOD.toLocaleString()}</span>
                  <span>{preset.tiers.length} Price Tiers</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTIVE RULE SET TIER MATRIX VIEW / EDIT */}
      <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Coins size={20} className="text-amber-500" />
              <span>Active Tier Matrix ({config.selectedPreset.toUpperCase()})</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Order value thresholds and deposit percentage holds enforced server-side.
            </p>
          </div>

          {config.selectedPreset === "custom" && (
            <button
              type="button"
              onClick={handleAddTier}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <Plus size={16} />
              <span>Add Custom Tier</span>
            </button>
          )}
        </div>

        {/* TIER MATRIX TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tier Designation</th>
                <th className="py-3 px-4">Min Amount (KES)</th>
                <th className="py-3 px-4">Max Amount (KES)</th>
                <th className="py-3 px-4">Deposit %</th>
                <th className="py-3 px-4">Max Cap (KES)</th>
                <th className="py-3 px-4">Customer Experience Rule</th>
                {config.selectedPreset === "custom" && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
              {activeDisplayTiers.map((tier, idx) => (
                <tr key={tier.id || idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">
                    {config.selectedPreset === "custom" ? (
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleUpdateTier(idx, "name", e.target.value)}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1 text-xs font-bold w-full"
                      />
                    ) : (
                      tier.name
                    )}
                  </td>

                  <td className="py-4 px-4 font-mono font-bold">
                    {config.selectedPreset === "custom" ? (
                      <input
                        type="number"
                        value={tier.minOrderValue}
                        onChange={(e) => handleUpdateTier(idx, "minOrderValue", Number(e.target.value))}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold w-24"
                      />
                    ) : (
                      `KES ${tier.minOrderValue.toLocaleString()}`
                    )}
                  </td>

                  <td className="py-4 px-4 font-mono font-bold">
                    {config.selectedPreset === "custom" ? (
                      <input
                        type="number"
                        value={tier.maxOrderValue}
                        onChange={(e) => handleUpdateTier(idx, "maxOrderValue", Number(e.target.value))}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold w-28"
                      />
                    ) : (
                      `KES ${tier.maxOrderValue.toLocaleString()}`
                    )}
                  </td>

                  <td className="py-4 px-4">
                    {config.selectedPreset === "custom" ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tier.depositPercentage}
                          onChange={(e) => handleUpdateTier(idx, "depositPercentage", Number(e.target.value))}
                          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold w-16"
                        />
                        <span className="font-bold text-gray-400">%</span>
                      </div>
                    ) : (
                      <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                        {tier.isPrepaidOnly ? "100%" : `${tier.depositPercentage}%`}
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4 font-mono font-bold">
                    {config.selectedPreset === "custom" ? (
                      <input
                        type="number"
                        value={tier.maxDepositCap}
                        onChange={(e) => handleUpdateTier(idx, "maxDepositCap", Number(e.target.value))}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold w-24"
                      />
                    ) : tier.maxDepositCap > 0 ? (
                      `KES ${tier.maxDepositCap.toLocaleString()}`
                    ) : (
                      <span className="text-gray-400">No Cap</span>
                    )}
                  </td>

                  <td className="py-4 px-4">
                    {tier.isPrepaidOnly ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-full">
                        <Lock size={12} /> Mandatory Full Pre-payment
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {tier.depositPercentage}% deposit required{" "}
                        {tier.maxDepositCap > 0 ? `(Max hold capped at KES ${tier.maxDepositCap.toLocaleString()})` : ""}
                      </span>
                    )}
                  </td>

                  {config.selectedPreset === "custom" && (
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteTier(idx)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Tier"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RISK & CATEGORY EXCLUSION CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Box: Category & Order Limit Exclusions */}
        <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Lock size={20} className="text-amber-500" />
              <span>Category Exclusions & Caps</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enforce mandatory pre-payment for high-risk categories or large basket sizes.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">
                Maximum Order Ceiling for Pay on Delivery
              </label>
              <div className="relative max-w-sm">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">KES</span>
                <input
                  type="number"
                  value={config.maxOrderValueForPOD}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxOrderValueForPOD: Number(e.target.value) }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-12 pr-4 py-2.5 text-sm font-extrabold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Orders above this amount will automatically require 100% pre-payment via M-Pesa or Card.
              </p>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">
                Restricted Categories (POD Disabled)
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => {
                  const isRestricted = config.restrictedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        isRestricted
                          ? "bg-red-500 text-white border-red-500 shadow-sm"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {isRestricted ? `✕ Excluded: ${cat}` : `+ Allow ${cat}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Box: Unverified Accounts & Risk Add-ons */}
        <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Zap size={20} className="text-amber-500" />
              <span>Risk Surcharges & Profile Rules</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Adjust required deposit percentage based on account verification status.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">
                Unverified / Guest Account Deposit Add-on (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={config.unverifiedUserExtraDeposit}
                  onChange={(e) => setConfig((prev) => ({ ...prev, unverifiedUserExtraDeposit: Number(e.target.value) }))}
                  className="w-24 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-extrabold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  % additional deposit required for first-time or guest checkouts.
                </span>
              </div>
            </div>

            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
              <div className="flex items-center gap-2 font-bold mb-1">
                <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Server-Side Stealth Enforcement Notice</span>
              </div>
              <p>
                The buyer interface will display a clean deposit breakdown without exposing internal risk tier codes or rule percentages. Calculation happens instantly on the server during checkout initialization.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE SERVER-SIDE POD SIMULATOR TEST TOOL */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2 text-white">
              <Sparkles size={20} className="text-amber-400" />
              <span>Live Server-Side POD Logic Simulator</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Test exact server responses calculated by <code className="text-amber-300 font-mono">POST /api/pod/calculate</code> in real time.
            </p>
          </div>
          <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
            Admin Test Sandbox
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1.5">
              Simulated Order Subtotal (KES)
            </label>
            <input
              type="number"
              value={simOrderTotal}
              onChange={(e) => setSimOrderTotal(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-sm font-extrabold text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1.5">
              Item Category
            </label>
            <select
              value={simCategory}
              onChange={(e) => setSimCategory(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1.5">
              Customer Account
            </label>
            <button
              type="button"
              onClick={() => setSimUnverified(!simUnverified)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                simUnverified
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                  : "bg-gray-800 text-gray-300 border-gray-700"
              }`}
            >
              {simUnverified ? "Unverified / New Customer (+Addon)" : "Standard Verified Customer"}
            </button>
          </div>
        </div>

        {/* SIMULATION OUTPUT PANEL */}
        {isSimulating ? (
          <div className="p-6 bg-gray-800/50 rounded-2xl border border-gray-800 text-center text-xs text-gray-400 animate-pulse">
            Calculating server-side POD rules...
          </div>
        ) : simResult ? (
          <div className="p-5 bg-gray-850 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                Server Decision Output
              </span>
              <span
                className={`text-xs font-black px-3 py-0.5 rounded-full uppercase tracking-wide ${
                  simResult.isEligible
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {simResult.isEligible ? "✓ Eligible for POD" : "✕ POD Ineligible (Prepaid Only)"}
              </span>
            </div>

            {simResult.isEligible ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="p-3 bg-gray-800/70 rounded-xl border border-gray-750">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Required Deposit Hold</p>
                  <p className="text-base font-black text-emerald-400">KES {simResult.depositAmount?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gray-800/70 rounded-xl border border-gray-750">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Balance on Delivery</p>
                  <p className="text-base font-black text-amber-300">KES {simResult.remainingBalance?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gray-800/70 rounded-xl border border-gray-750">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Effective Rate Hold</p>
                  <p className="text-base font-black text-white">{simResult.effectivePercentage}%</p>
                </div>
                <div className="p-3 bg-gray-800/70 rounded-xl border border-gray-750">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Matched Tier Rule</p>
                  <p className="text-xs font-bold text-gray-200 truncate">{simResult.tierAppliedName || "Standard"}</p>
                  {simResult.maxCapApplied && (
                    <span className="text-[9px] font-black text-amber-400 uppercase block">Max Cap Applied</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold text-red-300 bg-red-950/40 p-3 rounded-xl border border-red-900/40">
                Ineligible Reason: {simResult.reason}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* SAVE ACTIONS BAR */}
      <div className="sticky bottom-4 z-20 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          <Info size={16} className="text-amber-500 shrink-0" />
          <span>Rule changes take effect globally for all checkout sessions immediately.</span>
        </div>

        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isSaving ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Saving POD Rules...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Save POD Rule Configuration</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PodConfigTab;
