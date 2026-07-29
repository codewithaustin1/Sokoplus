import React, { useState, useEffect } from "react";
import { Product } from "../types";
import { Check, AlertTriangle, Sparkles, Type, Sliders, ShieldCheck } from "lucide-react";
import { useCurrency } from "../lib/CurrencyContext";

export interface SelectedConfig {
  size?: string;
  colorName?: string;
  colorHex?: string;
  material?: string;
  materialPriceDelta?: number;
  engravingText?: string;
  totalPrice: number;
  availableStock: number;
  isValid: boolean;
  outOfStock: boolean;
}

interface ProductAttributeConfiguratorProps {
  product: Product;
  onChange: (config: SelectedConfig) => void;
}

export const ProductAttributeConfigurator: React.FC<ProductAttributeConfiguratorProps> = ({
  product,
  onChange
}) => {
  const { formatPrice } = useCurrency();

  // Derive available options or fallback to default standard attributes if product has active inventory
  const sizes = product.availableSizes && product.availableSizes.length > 0 
    ? product.availableSizes 
    : ["Small", "Medium", "Large", "X-Large"];

  const colors = product.availableColors && product.availableColors.length > 0
    ? product.availableColors
    : ["Obsidian Black|#121212", "Safaris Gold|#D4AF37", "Artisan Cream|#F5F5DC", "Earthy Terracotta|#C86D51"];

  const materials: { name: string; priceDelta: number }[] = product.availableMaterials && product.availableMaterials.length > 0
    ? product.availableMaterials.map(m => ({ name: m.name, priceDelta: m.priceDelta || 0 }))
    : [
        { name: "Standard Brass", priceDelta: 0 },
        { name: "Genuine Kenya Leather", priceDelta: 500 },
        { name: "Hand-Carved Mahogany Wood", priceDelta: 800 }
      ];

  const allowEngraving = product.allowEngraving ?? true;
  const maxEngravingChars = product.engravingMaxChars ?? 20;

  // Selected State
  const [selectedSize, setSelectedSize] = useState<string>(sizes[0] || "");
  const [selectedColorStr, setSelectedColorStr] = useState<string>(colors[0] || "");
  const [selectedMaterial, setSelectedMaterial] = useState<{ name: string; priceDelta: number }>(
    materials[0] || { name: "Standard", priceDelta: 0 }
  );
  const [engravingText, setEngravingText] = useState<string>("");

  // Parse color string ("Name|#Hex")
  const colorParts = selectedColorStr.split("|");
  const colorName = colorParts[0];
  const colorHex = colorParts[1] || "#808080";

  // Check Matrix Stock & Calculate Total Price
  const computeCombinationStock = (sizeVal: string, colorVal: string, materialName: string): number => {
    if (product.variantMatrix && product.variantMatrix.length > 0) {
      const match = product.variantMatrix.find(
        v => 
          (!v.size || v.size === sizeVal) &&
          (!v.color || v.color.split("|")[0] === colorVal.split("|")[0]) &&
          (!v.material || v.material === materialName)
      );
      if (match) return match.stock;
    }
    // Default fallback to overall product stock
    return product.stock;
  };

  const currentStock = computeCombinationStock(selectedSize, selectedColorStr, selectedMaterial.name);
  const isOutOfStock = currentStock <= 0 || product.stock <= 0;

  // Engraving extra price if non-empty
  const engravingDelta = engravingText.trim().length > 0 ? 350 : 0;
  const totalPrice = product.price + (selectedMaterial.priceDelta || 0) + engravingDelta;

  const isValid = !isOutOfStock && engravingText.length <= maxEngravingChars;

  // Broadcast updates to parent
  useEffect(() => {
    onChange({
      size: selectedSize,
      colorName,
      colorHex,
      material: selectedMaterial.name,
      materialPriceDelta: selectedMaterial.priceDelta,
      engravingText: engravingText.trim() || undefined,
      totalPrice,
      availableStock: currentStock,
      isValid,
      outOfStock: isOutOfStock
    });
  }, [selectedSize, selectedColorStr, selectedMaterial, engravingText, currentStock, isOutOfStock, totalPrice, isValid]);

  return (
    <div className="space-y-6 bg-gray-50/70 dark:bg-gray-900/60 p-5 rounded-3xl border border-gray-150 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-orange-500" />
          <h3 className="text-sm font-black text-gray-950 dark:text-gray-50 uppercase tracking-wider">
            Configure Product Attributes
          </h3>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
          Real-time Stock Guard
        </span>
      </div>

      {/* 1. Size Attribute Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-gray-700 dark:text-gray-300">1. Size / Dimensions:</span>
          <span className="text-orange-600 dark:text-orange-400 font-extrabold">{selectedSize}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => {
            const stockForSize = computeCombinationStock(s, selectedColorStr, selectedMaterial.name);
            const isSizeDisabled = stockForSize <= 0;
            const isSelected = selectedSize === s;

            return (
              <button
                key={s}
                type="button"
                disabled={isSizeDisabled}
                onClick={() => setSelectedSize(s)}
                className={`relative px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-orange-500 text-black shadow-md ring-2 ring-orange-400"
                    : isSizeDisabled
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 line-through cursor-not-allowed opacity-50"
                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:border-orange-300 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {s}
                {isSizeDisabled && (
                  <span className="ml-1 text-[9px] font-black uppercase text-red-500">(Out)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Color Attribute Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-gray-700 dark:text-gray-300">2. Color / Finish:</span>
          <span className="text-orange-600 dark:text-orange-400 font-extrabold">{colorName}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {colors.map((cStr) => {
            const parts = cStr.split("|");
            const cName = parts[0];
            const cHex = parts[1] || "#808080";
            const stockForColor = computeCombinationStock(selectedSize, cStr, selectedMaterial.name);
            const isColorDisabled = stockForColor <= 0;
            const isSelected = selectedColorStr === cStr;

            return (
              <button
                key={cStr}
                type="button"
                disabled={isColorDisabled}
                onClick={() => setSelectedColorStr(cStr)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-gray-950 border-orange-500 ring-2 ring-orange-500/30 shadow-md scale-[1.02]"
                    : isColorDisabled
                    ? "bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 opacity-40 cursor-not-allowed"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/10 flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cHex }}
                >
                  {isSelected && <Check size={10} className={cHex === "#fdfbf7" || cHex === "#F5F5DC" ? "text-gray-900" : "text-white"} />}
                </span>
                <span className={`text-xs font-bold ${isColorDisabled ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>
                  {cName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Material Attribute Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-gray-700 dark:text-gray-300">3. Material Craftsmanship:</span>
          <span className="text-orange-600 dark:text-orange-400 font-extrabold">
            {selectedMaterial.name} {selectedMaterial.priceDelta > 0 && `(+${formatPrice(selectedMaterial.priceDelta)})`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {materials.map((m) => {
            const stockForMat = computeCombinationStock(selectedSize, selectedColorStr, m.name);
            const isMatDisabled = stockForMat <= 0;
            const isSelected = selectedMaterial.name === m.name;

            return (
              <button
                key={m.name}
                type="button"
                disabled={isMatDisabled}
                onClick={() => setSelectedMaterial(m)}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? "bg-white dark:bg-gray-950 border-orange-500 ring-2 ring-orange-500/30 shadow-sm"
                    : isMatDisabled
                    ? "bg-gray-100 dark:bg-gray-800 opacity-40 cursor-not-allowed"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                }`}
              >
                <div>
                  <div className={`text-xs font-bold ${isMatDisabled ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                    {m.name}
                  </div>
                  {m.priceDelta > 0 ? (
                    <div className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold">
                      +{formatPrice(m.priceDelta)}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400 font-medium">Standard Price</div>
                  )}
                </div>
                {isSelected && <Check size={14} className="text-orange-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Custom Engraving Attribute */}
      {allowEngraving && (
        <div className="space-y-2 border-t border-gray-200 dark:border-gray-800 pt-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Type size={14} className="text-orange-500" /> 4. Custom Personal Engraving (+KES 350):
            </span>
            <span className="text-gray-400 text-[11px]">
              {engravingText.length} / {maxEngravingChars} chars
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              maxLength={maxEngravingChars}
              value={engravingText}
              onChange={(e) => setEngravingText(e.target.value)}
              placeholder="e.g., 'Jambo 2026' or Artisan Initials"
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>

          {engravingText.trim().length > 0 && (
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 rounded-xl border border-orange-200 dark:border-orange-900/50 text-[11px] flex items-center gap-2">
              <Sparkles size={13} className="text-orange-500 shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">
                Engraving Preview: <strong className="text-orange-600 dark:text-orange-400 font-serif italic font-bold">"{engravingText}"</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Validation Banner */}
      <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between transition-all ${
        isOutOfStock
          ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400"
          : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
      }`}>
        <div className="flex items-center gap-2">
          {isOutOfStock ? (
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
          ) : (
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
          )}
          <div>
            <span className="font-extrabold block">
              {isOutOfStock ? "Selected Combination Out of Stock" : "Valid Configuration Ready"}
            </span>
            <span className="text-[11px] opacity-90 block">
              {isOutOfStock
                ? "This size/color/material matrix is unavailable. Please select alternative options."
                : `In Stock: ${currentStock} units available for ${selectedSize} / ${colorName} / ${selectedMaterial.name}`}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase font-black text-gray-400">Total Price</div>
          <div className="text-sm font-black text-orange-600 dark:text-orange-400">{formatPrice(totalPrice)}</div>
        </div>
      </div>
    </div>
  );
};
