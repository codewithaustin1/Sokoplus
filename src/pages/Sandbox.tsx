import { useState } from "react";
import { useCart } from "../lib/CartContext";
import { useCurrency } from "../lib/CurrencyContext";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, Sparkles, AlertCircle, Wrench, Layers, HelpCircle, Check, Info } from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../components/SEO";

// Define customizable product baselines
interface PresetProduct {
  id: string;
  name: string;
  basePrice: number;
  description: string;
  category: string;
  image: string;
}

const PRESET_PRODUCTS: PresetProduct[] = [
  {
    id: "custom-swahili-chair",
    name: "Swahili Lounge Chair",
    basePrice: 18500,
    description: "Inspired by classic coastal Swahili design. Handcrafted with traditional interlocking tenon joints.",
    category: "Furniture",
    image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "custom-mvule-table",
    name: "Mvule Coffee Table",
    basePrice: 24000,
    description: "Thick slab of organic Kenyan hardwood featuring unique grain flows and structural metal support.",
    category: "Furniture",
    image: "https://images.unsplash.com/photo-1544457070-4cd96414002e?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "custom-safar-stool",
    name: "Safari Accent Stool",
    basePrice: 9500,
    description: "Compact tri-leg seating option easily customized to serve as a modern bedside console or pedestal.",
    category: "Furniture",
    image: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80"
  }
];

// Customizable Wood Materials
interface WoodOption {
  id: string;
  name: string;
  priceFactor: number;
  colorHex: string; // fallback color shade for SVG rendering
  source: string;
  description: string;
}

const WOOD_OPTIONS: WoodOption[] = [
  {
    id: "mahogany",
    name: "Premium Mahogany",
    priceFactor: 4500,
    colorHex: "#5E2718",
    source: "South Coast Hand-Felled",
    description: "Ultra-durable luxury dark wood with rich reddish-brown streaks and supreme humidity resistance."
  },
  {
    id: "mvule",
    name: "Kenyan Mvule",
    priceFactor: 2500,
    colorHex: "#B46D29",
    source: "Kwale Sustainable Plantations",
    description: "Warm golden honey tones. Famous for magnificent grain densities that turn golden-brown over decades."
  },
  {
    id: "teak",
    name: "Fine Teak",
    priceFactor: 6000,
    colorHex: "#8B5A2B",
    source: "East Africa Private Reserves",
    description: "Naturally high in protective oils. Offers immense insect resistance and a sleek matte finish."
  },
  {
    id: "cypress",
    name: "Pale Cypress",
    priceFactor: 0,
    colorHex: "#D2C29D",
    source: "Rift Valley Highland Forests",
    description: "Lightweight, highly resilient pale blonde wood. Clean minimalist Scandinavian-African fusion."
  }
];

// Customizable Fabrics & Materials
interface FabricOption {
  id: string;
  name: string;
  priceFactor: number;
  source: string;
  description: string;
}

const FABRIC_OPTIONS: FabricOption[] = [
  {
    id: "velvet",
    name: "Swahili Plush Velvet",
    priceFactor: 2000,
    source: "Mombasa Weaving Centric",
    description: "Incredibly smooth velvet with low light reflectivity and heavy stain-resistant protective guard."
  },
  {
    id: "leather",
    name: "Safari Nakuru Leather",
    priceFactor: 5500,
    source: "Nakuru Tanners Union",
    description: "Authentic, full-grain cowhide leather that acquires a rich, beautiful distressed patina over time."
  },
  {
    id: "cotton",
    name: "Organic Cotton Canvas",
    priceFactor: 0,
    source: "Thika Cotton Mills",
    description: "Eco-friendly, tightly-woven durable canvas displaying raw botanical threads and unmatched breathability."
  },
  {
    id: "loomed-wool",
    name: "Nanyuki Loomed Wool",
    priceFactor: 3500,
    source: "Laikipia Women Weaver Guild",
    description: "Hand-spun, hand-dyed local sheep wool offering rich dimensional visual texture and supreme warmth."
  }
];

// Surchargeless Color Palette
interface AccentColor {
  id: string;
  name: string;
  hex: string;
  meaning: string;
}

const ACCENT_COLORS: AccentColor[] = [
  { id: "ochre", name: "Safari Ochre", hex: "#D97706", meaning: "Represents the glowing savannah sun." },
  { id: "crimson", name: "Maasai Crimson", hex: "#B91C1C", meaning: "Signifies strength, courage, and vitality." },
  { id: "blue", name: "Swahili Blue", hex: "#0284C7", meaning: "Evokes the cooling ocean breeze of Lamu." },
  { id: "forest", name: "Forest Jade", hex: "#065F46", meaning: "Represents Kenya's lush tea highlands." },
  { id: "dusk", name: "Charcoal Dusk", hex: "#1F2937", meaning: "Emulates the volcanic volcanic obsidian of Hell's Gate." },
  { id: "snow", name: "Swahili Cream", hex: "#F3F4F6", meaning: "Cool off-white of classic Swahili coral walls." },
  { id: "amber", name: "Warm Amber", hex: "#F59E0B", meaning: "Captures the glow of evening oil lanterns." }
];

export default function Sandbox() {
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();

  // Selected baselines State
  const [selectedProduct, setSelectedProduct] = useState<PresetProduct>(PRESET_PRODUCTS[0]);
  const [selectedWood, setSelectedWood] = useState<WoodOption>(WOOD_OPTIONS[0]);
  const [selectedFabric, setSelectedFabric] = useState<FabricOption>(FABRIC_OPTIONS[0]);
  const [selectedColor, setSelectedColor] = useState<AccentColor>(ACCENT_COLORS[0]);
  const [engraving, setEngraving] = useState("");
  const [activeInteractivePart, setActiveInteractivePart] = useState<"chair-frame" | "chair-cushion" | "table-top" | "table-legs" | "overall">("overall");

  // Calculates total customized item cost
  const calculatedPrice = selectedProduct.basePrice + selectedWood.priceFactor + selectedFabric.priceFactor;

  const handleAddToCart = () => {
    const customDetails = {
      material: `${selectedWood.name} with ${selectedFabric.name}`,
      color: selectedColor.hex,
      colorName: selectedColor.name,
      notes: engraving.trim() ? `Engraving request: "${engraving.trim()}"` : undefined
    };

    addToCart({
      productId: `${selectedProduct.id}-${selectedWood.id}-${selectedFabric.id}-${selectedColor.id}`,
      name: `${selectedProduct.name} (Customized)`,
      price: calculatedPrice,
      quantity: 1,
      image: selectedProduct.image,
      customizations: customDetails
    });

    toast.success(`Custom ${selectedProduct.name} added to your cart!`);
  };

  // Switch presets helper
  const handlePresetSelect = (preset: PresetProduct) => {
    setSelectedProduct(preset);
    // Reset specific parts coordinate
    if (preset.id === "custom-mvule-table") {
      setActiveInteractivePart("table-top");
    } else {
      setActiveInteractivePart("chair-cushion");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEO 
        title="Visual Artisan Sandbox" 
        description="Design and interactively customize your own furniture, selecting woods, materials, and custom Kenyan colors." 
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100/30 rounded-3xl p-8 mb-10 border border-orange-100/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-orange-100/80 px-3.5 py-1.5 rounded-full text-xs font-black text-orange-650 tracking-widest uppercase">
            <Sparkles size={12} className="text-orange-600" />
            <span>Interactive Workshop</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Artisan Material & Color Sandbox</h1>
          <p className="text-gray-500 font-medium text-sm">
            Play with Kenyan hardwoods, artisan fabrics, and coastal colors. Click directly on different parts of the blueprint drawing to personalize them.
          </p>
        </div>
        <div className="bg-white/90 backdrop-blur-sm border border-gray-150 rounded-2xl p-4 flex items-center space-x-3 text-xs font-bold text-gray-500 shadow-sm max-w-xs">
          <Wrench size={18} className="text-orange-600 flex-shrink-0" />
          <span>Every piece is built-to-order by accredited artisans in Kenya. Delivery: 10-14 days.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT COLUMN: Blueprint Renderer (Lines & Swatches Live Rendering) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-between min-h-[420px] relative overflow-hidden group">
            
            {/* Interactive Part Active Guide */}
            <div className="absolute top-4 left-4 z-10 bg-gray-900/5 backdrop-blur-md border border-gray-150 py-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-wider text-gray-600 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse mr-1"></span>
              <span>Editing: {activeInteractivePart.replace("-", " ")}</span>
            </div>

            <button 
              onClick={() => setActiveInteractivePart("overall")}
              className="absolute top-4 right-4 z-10 bg-white shadow-sm border border-gray-100 py-1.5 px-3 rounded-full text-[9px] font-black uppercase tracking-widest text-orange-600 hover:bg-orange-50 transition-all cursor-pointer"
            >
              Reset View
            </button>

            {/* Interactive Vector Canvas */}
            <div className="w-full flex-grow flex items-center justify-center my-6">
              {selectedProduct.id === "custom-swahili-chair" || selectedProduct.id === "custom-safar-stool" ? (
                /* Interactive Chair Blueprint SVG */
                <svg viewBox="0 0 300 300" className="w-64 h-64 transition-all duration-300">
                  <g id="shadow" opacity="0.15">
                    <ellipse cx="150" cy="270" rx="90" ry="12" fill="#000" />
                  </g>
                  
                  {/* Chair Wooden Frame Part */}
                  <g 
                    id="chair-frame" 
                    className="cursor-pointer group/frame" 
                    onClick={() => setActiveInteractivePart("chair-frame")}
                  >
                    {/* Legs */}
                    <line x1="90" y1="180" x2="70" y2="265" stroke={selectedWood.colorHex} strokeWidth="14" strokeLinecap="round" />
                    <line x1="210" y1="180" x2="230" y2="265" stroke={selectedWood.colorHex} strokeWidth="14" strokeLinecap="round" />
                    <line x1="110" y1="180" x2="100" y2="260" stroke={selectedWood.colorHex} strokeWidth="10" strokeLinecap="round" opacity="0.8" />
                    <line x1="190" y1="180" x2="200" y2="260" stroke={selectedWood.colorHex} strokeWidth="10" strokeLinecap="round" opacity="0.8" />
                    
                    {/* Backrest Pillars */}
                    <rect x="95" y="40" width="14" height="145" rx="5" fill={selectedWood.colorHex} />
                    <rect x="191" y="40" width="14" height="145" rx="5" fill={selectedWood.colorHex} />
                    <rect x="125" y="45" width="8" height="140" fill={selectedWood.colorHex} opacity="0.9" />
                    <rect x="146" y="45" width="8" height="140" fill={selectedWood.colorHex} opacity="0.9" />
                    <rect x="167" y="45" width="8" height="140" fill={selectedWood.colorHex} opacity="0.9" />
                    
                    {/* Curved Top Rest */}
                    <path d="M 85 55 Q 150 25 215 55" fill="none" stroke={selectedWood.colorHex} strokeWidth="18" strokeLinecap="round" />

                    {/* Frame Highlight Border when Editing */}
                    {activeInteractivePart === "chair-frame" && (
                      <>
                        <path d="M 85 55 Q 150 25 215 55" fill="none" stroke="#EA580C" strokeWidth="2" strokeDasharray="4" className="animate-pulse" />
                        <line x1="70" y1="265" x2="90" y2="180" stroke="#EA580C" strokeWidth="2" strokeDasharray="4" />
                        <line x1="230" y1="265" x2="210" y2="180" stroke="#EA580C" strokeWidth="2" strokeDasharray="4" />
                      </>
                    )}
                  </g>

                  {/* Seat Cushion Part */}
                  <g 
                    id="chair-cushion" 
                    className="cursor-pointer group/cushion"
                    onClick={() => setActiveInteractivePart("chair-cushion")}
                  >
                    {/* Cushion Area */}
                    <rect 
                      x="74" 
                      y="160" 
                      width="152" 
                      height="36" 
                      rx="16" 
                      fill={selectedColor.hex} 
                      className="transition-colors duration-300 filter drop-shadow-md"
                    />
                    {/* Cushion Fabric Texture overlay (subtle stripes) */}
                    <g opacity="0.12" stroke="#fff" strokeWidth="1.5">
                      <line x1="90" y1="162" x2="90" y2="194" />
                      <line x1="110" y1="162" x2="110" y2="194" />
                      <line x1="130" y1="162" x2="130" y2="194" />
                      <line x1="150" y1="162" x2="150" y2="194" />
                      <line x1="170" y1="162" x2="170" y2="194" />
                      <line x1="190" y1="162" x2="190" y2="194" />
                      <line x1="210" y1="162" x2="210" y2="194" />
                    </g>
                    {/* Shadow edge */}
                    <rect x="74" y="184" width="152" height="12" rx="6" fill="#000" opacity="0.15" />

                    {/* Cushion Highlight Border when Editing */}
                    {activeInteractivePart === "chair-cushion" && (
                      <rect x="72" y="158" width="156" height="40" rx="18" fill="none" stroke="#EA580C" strokeWidth="2" strokeDasharray="4" />
                    )}
                  </g>
                </svg>
              ) : (
                /* Interactive Table Blueprint SVG */
                <svg viewBox="0 0 300 300" className="w-64 h-64 transition-all duration-300">
                  <g id="shadow" opacity="0.15">
                    <ellipse cx="150" cy="245" rx="110" ry="14" fill="#000" />
                  </g>

                  {/* Metal Legs part */}
                  <g 
                    id="table-legs" 
                    className="cursor-pointer"
                    onClick={() => setActiveInteractivePart("table-legs")}
                  >
                    {/* Structural base stand */}
                    <path d="M 70 145 L 85 235 L 215 235 L 230 145" fill="none" stroke="#1F2937" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="150" y1="145" x2="150" y2="235" stroke="#1F2937" strokeWidth="8" />

                    {/* Legs Highlight Border */}
                    {activeInteractivePart === "table-legs" && (
                      <path d="M 68 143 L 83 237 L 217 237 L 232 143" fill="none" stroke="#EA580C" strokeWidth="2" strokeDasharray="4" />
                    )}
                  </g>

                  {/* Wood Slab top */}
                  <g 
                    id="table-top" 
                    className="cursor-pointer"
                    onClick={() => setActiveInteractivePart("table-top")}
                  >
                    {/* Solid Wood Top Panel */}
                    <rect x="40" y="105" width="220" height="40" rx="10" fill={selectedWood.colorHex} className="transition-colors duration-300" />
                    
                    {/* Organic natural grain line curves */}
                    <path d="M 50 115 Q 120 110 170 115 T 250 115" fill="none" stroke="#000" strokeWidth="1" opacity="0.15" />
                    <path d="M 45 125 Q 140 120 200 125 T 255 125" fill="none" stroke="#000" strokeWidth="2" opacity="0.1" />
                    <path d="M 60 135 Q 130 132 180 135 T 240 135" fill="none" stroke="#000" strokeWidth="1" opacity="0.15" />

                    {/* Accent Colored Bevel Edge */}
                    <rect x="40" y="137" width="220" height="8" rx="4" fill={selectedColor.hex} className="transition-colors duration-300" />

                    {/* Highlight Border when Active */}
                    {activeInteractivePart === "table-top" && (
                      <rect x="38" y="103" width="224" height="44" rx="12" fill="none" stroke="#EA580C" strokeWidth="2" strokeDasharray="4" />
                    )}
                  </g>
                </svg>
              )}
            </div>

            {/* Quick interactive tips banner */}
            <div className="w-full text-center bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center justify-center space-x-2">
              <Info size={14} className="text-orange-600 flex-shrink-0" />
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                {activeInteractivePart === "overall" 
                  ? "Double tap structural lines on drawing to adjust details!" 
                  : `Currently tailoring: Select options on the right side.`}
              </p>
            </div>
          </div>

          {/* Premium Material Slogan cards */}
          <div className="bg-orange-600 text-white rounded-3xl p-6 space-y-4 shadow-lg shadow-orange-100/50">
            <h4 className="text-base font-black tracking-tight flex items-center">
              <Sparkles size={16} className="mr-2 animate-pulse" />
              Sokoplus Custom Guarantee
            </h4>
            <p className="text-xs font-medium leading-relaxed opacity-90">
              Each wood structure, hide selection, and organic canvas loop is verified directly by local cooperatives before crafting begins. You receive loyalty points matching full customizable values.
            </p>
            <div className="border-t border-white/20 pt-4 flex justify-between items-center text-[10px] font-black tracking-wider uppercase">
              <span>Standard 1-Year Warranty</span>
              <span>100% Kenyan Sourced</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Selectors Panel */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Section 1: Product Baselines Presets */}
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Step 1: Choose Your baseline Furniture</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PRESET_PRODUCTS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    selectedProduct.id === preset.id
                      ? "bg-white border-orange-600 shadow-md ring-1 ring-orange-100"
                      : "bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <img src={preset.image} alt={preset.name} className="w-full h-24 object-cover rounded-xl mb-3" />
                  <span className="font-extrabold text-xs text-gray-900 line-clamp-1">{preset.name}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 mb-2">{preset.category}</span>
                  <span className="text-sm font-black text-orange-600 mt-auto">{formatPrice(preset.basePrice)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Hardwood Selection */}
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Step 2: Core Wood Frame</p>
              <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                {selectedWood.name}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WOOD_OPTIONS.map((wood) => (
                <div
                  key={wood.id}
                  onClick={() => {
                    setSelectedWood(wood);
                    setActiveInteractivePart(selectedProduct.id === "custom-swahili-chair" ? "chair-frame" : "table-top");
                  }}
                  className={`flex flex-col justify-between p-4 bg-white border rounded-2xl cursor-pointer transition-all ${
                    selectedWood.id === wood.id
                      ? "border-orange-650 shadow-md ring-1 ring-orange-100"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: wood.colorHex }}></span>
                      <span className="font-extrabold text-xs text-gray-900">{wood.name}</span>
                    </div>
                    {wood.priceFactor > 0 ? (
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                        +{formatPrice(wood.priceFactor)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                        Included
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] italic text-gray-400 mt-1 font-bold tracking-tight uppercase">Source: {wood.source}</p>
                  <p className="text-[11px] text-gray-400 italic line-clamp-2 mt-2 bg-gray-50/50 p-2 rounded-xl">
                    {wood.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Fabrics & Cushions Selection */}
          {selectedProduct.id !== "custom-mvule-table" && (
            <div className="space-y-4 border-t border-gray-100 pt-6">
              <div className="flex justify-between items-center">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Step 3: Padding & Cushion Material</p>
                <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                  {selectedFabric.name}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FABRIC_OPTIONS.map((fabric) => (
                  <div
                    key={fabric.id}
                    onClick={() => {
                      setSelectedFabric(fabric);
                      setActiveInteractivePart("chair-cushion");
                    }}
                    className={`flex flex-col justify-between p-4 bg-white border rounded-2xl cursor-pointer transition-all ${
                      selectedFabric.id === fabric.id
                        ? "border-orange-650 shadow-md ring-1 ring-orange-100"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-xs text-gray-900">{fabric.name}</span>
                      {fabric.priceFactor > 0 ? (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                          +{formatPrice(fabric.priceFactor)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          Included
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] italic text-gray-400 mt-1 font-bold tracking-tight uppercase">Source: {fabric.source}</p>
                    <p className="text-[11px] text-gray-400 italic line-clamp-2 mt-2 bg-gray-50/50 p-2 rounded-xl">
                      {fabric.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Coastal Colors Palette */}
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Step 4: Swahili Accent Palette</p>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                {selectedColor.name}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-3.5">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => {
                    setSelectedColor(color);
                    // Point interaction focus
                    if (selectedProduct.id === "custom-mvule-table") {
                      setActiveInteractivePart("table-top");
                    } else {
                      setActiveInteractivePart("chair-cushion");
                    }
                  }}
                  title={color.name}
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    selectedColor.id === color.id
                      ? "border-orange-600 scale-102 shadow-lg"
                      : "border-transparent shadow-sm"
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {selectedColor.id === color.id && (
                    <span className="bg-white/90 p-1 rounded-full text-orange-600 shadow-sm animate-in scale-in duration-100">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 italic font-semibold ml-1">
              🎨 Color Meaning: {selectedColor.meaning}
            </p>
          </div>

          {/* Section 5: Custom Engravings */}
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Step 5: Hand-Carved Engraving (Optional)</p>
            <input 
              type="text"
              placeholder="e.g. Carve initials 'J.M.' / 'Soko 2026' into wood surface..."
              className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs transition-all shadow-inner"
              value={engraving}
              onChange={(e) => setEngraving(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Pricing & Add to Cart Frame */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-xl mt-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estimated Total Cost</span>
                <p className="text-4xl font-black text-orange-600 transition-all">
                  {formatPrice(calculatedPrice)}
                </p>
              </div>
              
              <div className="text-right text-[10px] text-gray-400 font-bold space-y-1 bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                <div className="flex justify-between items-center space-x-4">
                  <span>Base Price:</span>
                  <span className="text-gray-900 font-black">{formatPrice(selectedProduct.basePrice)}</span>
                </div>
                <div className="flex justify-between items-center space-x-4">
                  <span>Wood Premium:</span>
                  <span className="text-gray-900 font-black">+{formatPrice(selectedWood.priceFactor)}</span>
                </div>
                <div className="flex justify-between items-center space-x-4">
                  <span>Fabric Premium:</span>
                  <span className="text-gray-900 font-black">
                    {selectedProduct.id === "custom-mvule-table" ? "N/A" : `+${formatPrice(selectedFabric.priceFactor)}`}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full bg-gray-900 hover:bg-orange-600 text-white font-black py-5 rounded-2xl transition-colors shadow-lg flex items-center justify-center space-x-3 text-lg group cursor-pointer"
            >
              <ShoppingBag size={20} className="group-hover:scale-110 transition-transform" />
              <span>COMMIT CUSTOMIZED ORDER</span>
            </button>

            <div className="flex items-center space-x-2.5 justify-center text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              <AlertCircle size={14} className="text-orange-500" />
              <span>All customized items are final sales & secure standard 12-month artisan warranties.</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
