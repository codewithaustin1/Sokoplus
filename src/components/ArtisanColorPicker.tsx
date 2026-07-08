import { useEffect, useRef, useState } from "react";
import { Check, Plus, RefreshCw } from "lucide-react";

// Robust database of elegant colors to match user selections with gorgeous names
const COLOR_NAMES_DB = [
  { name: "Pure White", hex: "#ffffff" },
  { name: "Off-White", hex: "#f8f9fa" },
  { name: "Alabaster", hex: "#fefaf0" },
  { name: "Ivory", hex: "#fffff0" },
  { name: "Cream", hex: "#fffdd0" },
  { name: "Vanilla", hex: "#f3e5ab" },
  { name: "Beige", hex: "#f5f5dc" },
  { name: "Wheat", hex: "#f5deb3" },
  { name: "Desert Sand", hex: "#edc9af" },
  { name: "Sand", hex: "#c2b280" },
  { name: "Amber Gold", hex: "#ffbf00" },
  { name: "Mustard Yellow", hex: "#e1ad01" },
  { name: "Lemon Yellow", hex: "#fff700" },
  { name: "Peach Puff", hex: "#ffdab9" },
  { name: "Sunset Orange", hex: "#fd5e53" },
  { name: "Tangerine", hex: "#f28500" },
  { name: "Coral Pink", hex: "#ff7f50" },
  { name: "Terracotta Rust", hex: "#c25e40" },
  { name: "Crimson Red", hex: "#dc143c" },
  { name: "Scarlet", hex: "#ff2400" },
  { name: "Ruby Red", hex: "#e0115f" },
  { name: "Burgundy Wine", hex: "#800020" },
  { name: "Maroon", hex: "#800000" },
  { name: "Rose Gold", hex: "#b76e79" },
  { name: "Soft Pink", hex: "#ffc0cb" },
  { name: "Hot Pink", hex: "#ff69b4" },
  { name: "Magenta", hex: "#ff00ff" },
  { name: "Fuchsia", hex: "#ff00ff" },
  { name: "Plum Purple", hex: "#dda0dd" },
  { name: "Deep Violet", hex: "#8a2be2" },
  { name: "Lavender", hex: "#e6e6fa" },
  { name: "Lilac", hex: "#c8a2c8" },
  { name: "Periwinkle", hex: "#ccccff" },
  { name: "Royal Blue", hex: "#4169e1" },
  { name: "Sky Blue", hex: "#87ceeb" },
  { name: "Baby Blue", hex: "#89cff0" },
  { name: "Indigo", hex: "#4b0082" },
  { name: "Navy Blue", hex: "#000080" },
  { name: "Midnight Blue", hex: "#191970" },
  { name: "Teal Green", hex: "#008080" },
  { name: "Turquoise", hex: "#40e0d0" },
  { name: "Cyan", hex: "#00ffff" },
  { name: "Mint Green", hex: "#98ff98" },
  { name: "Sage Green", hex: "#bcb88a" },
  { name: "Olive Green", hex: "#808000" },
  { name: "Forest Green", hex: "#228b22" },
  { name: "Emerald Green", hex: "#50c878" },
  { name: "Lime Green", hex: "#32cd32" },
  { name: "Jade", hex: "#00a86b" },
  { name: "Khaki", hex: "#c3b091" },
  { name: "Tan Leather", hex: "#d2b48c" },
  { name: "Bronze", hex: "#cd7f32" },
  { name: "Copper", hex: "#b87333" },
  { name: "Caramel", hex: "#ffd59a" },
  { name: "Chestnut Brown", hex: "#954535" },
  { name: "Espresso Brown", hex: "#3d2314" },
  { name: "Chocolate Brown", hex: "#7b3f00" },
  { name: "Mahogany", hex: "#c04000" },
  { name: "Charcoal Black", hex: "#2b2b2b" },
  { name: "Slate Gray", hex: "#708090" },
  { name: "Ash Gray", hex: "#b2beb5" },
  { name: "Silver Metal", hex: "#c0c0c0" },
  { name: "Jet Black", hex: "#0a0a0a" },
];

// Helper functions for conversions
function hexToRgb(hex: string) {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const rh = clamp(r).toString(16).padStart(2, "0");
  const gh = clamp(g).toString(16).padStart(2, "0");
  const bh = clamp(b).toString(16).padStart(2, "0");
  return `#${rh}${gh}${bh}`;
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function findClosestColorName(hex: string): string {
  const targetRgb = hexToRgb(hex);
  if (!targetRgb) return "Artisan Shade";

  let minDistance = Infinity;
  let closestName = "Artisan Shade";

  for (const item of COLOR_NAMES_DB) {
    const itemRgb = hexToRgb(item.hex);
    if (!itemRgb) continue;

    const distance = Math.sqrt(
      Math.pow(targetRgb.r - itemRgb.r, 2) +
      Math.pow(targetRgb.g - itemRgb.g, 2) +
      Math.pow(targetRgb.b - itemRgb.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestName = item.name;
    }
  }

  return closestName;
}

interface ArtisanColorPickerProps {
  onAddColor: (representation: string) => void;
  selectedColors: string[];
}

export default function ArtisanColorPicker({ onAddColor, selectedColors }: ArtisanColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hsl, setHsl] = useState({ h: 30, s: 80, l: 50 });
  const [rgb, setRgb] = useState({ r: 230, g: 115, b: 25 });
  const [hexInput, setHexInput] = useState("#e67319");
  const [matchedName, setMatchedName] = useState("Terracotta Rust");
  const [isDragging, setIsDragging] = useState(false);

  // Synchronize representations whenever HSL changes
  useEffect(() => {
    const computedRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    setRgb(computedRgb);
    const computedHex = rgbToHex(computedRgb.r, computedRgb.g, computedRgb.b);
    setHexInput(computedHex);
    setMatchedName(findClosestColorName(computedHex));
  }, [hsl.h, hsl.s, hsl.l]);

  // Draw the interactive canvas-based color wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 8;

    ctx.clearRect(0, 0, width, height);

    // Draw the full color wheel (radial gradient and angle sweeps)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          const angle = Math.atan2(dy, dx);
          // Angle maps to hue (0-360)
          const hue = ((angle * 180) / Math.PI + 360) % 360;
          // Distance maps to saturation (0-100)
          const saturation = (dist / radius) * 100;
          // Fix lightness at 50% for standard picker wheel representation
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${hsl.l}%)`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Draw selector ring at the current coordinates
    const currentAngle = (hsl.h * Math.PI) / 180;
    const currentRadius = (hsl.s / 100) * radius;
    const selX = cx + Math.cos(currentAngle) * currentRadius;
    const selY = cy + Math.sin(currentAngle) * currentRadius;

    ctx.beginPath();
    ctx.arc(selX, selY, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = hsl.l > 60 ? "#111" : "#fff";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  }, [hsl.s, hsl.h, hsl.l]);

  // Handle updates from canvas coordinates
  const updateColorFromCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 8;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp saturation to 100 max
    const s = Math.min(100, Math.round((Math.max(0, dist) / radius) * 100));
    const angle = Math.atan2(dy, dx);
    const h = Math.round(((angle * 180) / Math.PI + 360) % 360);

    setHsl((prev) => ({ ...prev, h, s }));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    updateColorFromCoords(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    updateColorFromCoords(e.clientX, e.clientY);
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches[0]) {
      setIsDragging(true);
      updateColorFromCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDragging && e.touches[0]) {
      updateColorFromCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Manual inputs
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    setHexInput(input);

    if (!input.startsWith("#")) {
      input = "#" + input;
    }

    const rgbObj = hexToRgb(input);
    if (rgbObj) {
      const hslObj = rgbToHsl(rgbObj.r, rgbObj.g, rgbObj.b);
      setHsl(hslObj);
    }
  };

  const handleRgbFieldChange = (channel: "r" | "g" | "b", val: string) => {
    const num = Math.max(0, Math.min(255, parseInt(val) || 0));
    const nextRgb = { ...rgb, [channel]: num };
    setRgb(nextRgb);

    const computedHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setHexInput(computedHex);
    const hslObj = rgbToHsl(nextRgb.r, nextRgb.g, nextRgb.b);
    setHsl(hslObj);
  };

  const handleAddCustomColor = () => {
    const rep = `${matchedName}|${hexInput}`;
    if (selectedColors.includes(rep)) {
      alert("This specific color is already registered to your available product variants.");
      return;
    }
    onAddColor(rep);
  };

  return (
    <div className="bg-gray-50/50 dark:bg-gray-950/20 border border-gray-150 dark:border-gray-800 p-4 rounded-2xl space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
          🎨 Interactive Color Wheel variations
        </span>
        <span className="h-px bg-gray-150 dark:bg-gray-800 flex-1" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Color Wheel Canvas */}
        <div className="md:col-span-5 flex justify-center">
          <div className="relative p-2 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-sm">
            <canvas
              ref={canvasRef}
              width={160}
              height={160}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUpOrLeave}
              className="cursor-crosshair rounded-full select-none touch-none"
            />
          </div>
        </div>

        {/* Sliders & Input Parameters */}
        <div className="md:col-span-7 space-y-3.5">
          {/* Tone & Lightness Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase">
              <span>Lightness (Tint / Shade)</span>
              <span>{hsl.l}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={hsl.l}
              onChange={(e) => setHsl((prev) => ({ ...prev, l: parseInt(e.target.value) }))}
              className="w-full accent-orange-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none"
            />
          </div>

          {/* Autodetected Color Name banner */}
          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full border border-black/15 shadow-inner transition-colors duration-200"
                style={{ backgroundColor: hexInput }}
              />
              <div>
                <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                  AI Resolved Shade Name
                </span>
                <span className="text-sm font-black text-gray-850 dark:text-white leading-tight">
                  {matchedName}
                </span>
              </div>
            </div>
            <span className="text-xs font-mono font-extrabold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-md">
              {hexInput.toUpperCase()}
            </span>
          </div>

          {/* Manual inputs: Hex & RGB */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">
                HEX Value
              </label>
              <input
                type="text"
                value={hexInput}
                onChange={handleHexChange}
                maxLength={7}
                className="w-full text-xs font-mono font-extrabold p-2 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-orange-500 text-center"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">
                RGB Channels
              </label>
              <div className="grid grid-cols-3 gap-1">
                <input
                  type="number"
                  value={rgb.r}
                  onChange={(e) => handleRgbFieldChange("r", e.target.value)}
                  className="text-xs font-mono font-extrabold p-2 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-orange-500 text-center"
                  placeholder="R"
                />
                <input
                  type="number"
                  value={rgb.g}
                  onChange={(e) => handleRgbFieldChange("g", e.target.value)}
                  className="text-xs font-mono font-extrabold p-2 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-orange-500 text-center"
                  placeholder="G"
                />
                <input
                  type="number"
                  value={rgb.b}
                  onChange={(e) => handleRgbFieldChange("b", e.target.value)}
                  className="text-xs font-mono font-extrabold p-2 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-orange-500 text-center"
                  placeholder="B"
                />
              </div>
            </div>
          </div>

          {/* Append Button */}
          <button
            type="button"
            onClick={handleAddCustomColor}
            className="w-full flex items-center justify-center gap-2 p-2 bg-orange-600 hover:bg-orange-750 text-white rounded-xl text-xs font-black tracking-wide shadow-sm hover:shadow-md transition-all cursor-pointer border-none"
          >
            <Plus size={14} strokeWidth={3} />
            <span>Add "{matchedName}" as available product variation</span>
          </button>
        </div>
      </div>
    </div>
  );
}
