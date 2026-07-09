import { useState, useEffect, useRef } from "react";
import { X, Camera, RefreshCw, Upload, Sparkles, HelpCircle, ArrowRight, Search, AppWindow } from "lucide-react";
import jsQR from "jsqr";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "en" | "sw";
}

export default function QRScannerModal({ isOpen, onClose, language }: QRScannerModalProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Play a beautiful, synthetic, retro digital success beep
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio Context playback prevented by browser:", e);
    }
  };

  const handleScannedResult = async (result: string) => {
    if (!result) return;
    const text = result.trim();
    setIsScanning(false);
    stopCamera();
    playBeep();

    // 1. Check if the string is a valid URL and contains our domain/routes
    try {
      if (text.startsWith("http://") || text.startsWith("https://")) {
        const url = new URL(text);
        
        // Match product path
        const productMatch = url.pathname.match(/\/product\/([a-zA-Z0-9_\-]+)/);
        if (productMatch && productMatch[1]) {
          navigate(`/product/${productMatch[1]}`);
          onClose();
          toast.success(language === "sw" ? "Bidhaa imepatikana!" : "Product found successfully via QR!", { icon: "🛍️" });
          return;
        }

        // Match tracking order path
        const trackMatch = url.pathname.match(/\/track-order\/([a-zA-Z0-9_\-]+)/);
        if (trackMatch && trackMatch[1]) {
          navigate(`/track-order/${trackMatch[1]}`);
          onClose();
          toast.success(language === "sw" ? "Agizo limepatikana!" : "Tracking order found via QR!", { icon: "📦" });
          return;
        }

        // If it's some other URL, check if we can open it safely
        window.open(text, "_blank", "noopener,noreferrer");
        onClose();
        toast.success(language === "sw" ? "Tovuti imefunguliwa" : "Opened external link in new tab", { icon: "🌐" });
        return;
      }
    } catch {
      // Ignored: Not a valid URL
    }

    // 2. Scan internal path format e.g. "product/id" or "track-order/id" or "product:id"
    if (text.includes("product/")) {
      const parts = text.split("product/");
      const id = parts[parts.length - 1].split(/[?#]/)[0];
      if (id) {
        navigate(`/product/${id}`);
        onClose();
        toast.success(language === "sw" ? "Bidhaa imepatikana!" : "Product loaded!", { icon: "🛍️" });
        return;
      }
    }

    if (text.includes("track-order/")) {
      const parts = text.split("track-order/");
      const id = parts[parts.length - 1].split(/[?#]/)[0];
      if (id) {
        navigate(`/track-order/${id}`);
        onClose();
        toast.success(language === "sw" ? "Ufuatiliaji umefunguliwa!" : "Viewing tracking info!", { icon: "📦" });
        return;
      }
    }

    // 3. Check if text is a direct ID (e.g. maybe checking product existence in Firestore)
    // Display a beautiful interactive chooser prompt to allow the user to select what they want
    setScannedPayload(text);
  };

  const startCamera = async () => {
    setIsLoadingCamera(true);
    setScannedPayload(null);
    stopCamera();

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // required for iOS safari
        videoRef.current.play();
        setIsScanning(true);
        setHasCameraPermission(true);
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setHasCameraPermission(false);
      toast.error(
        language === "sw"
          ? "Kuna shida ya kufungua kamera. Tafadhali weka nambari mwenyewe."
          : "Could not request camera stream. Feel free to use manual lookups."
      );
    } finally {
      setIsLoadingCamera(false);
    }
  };

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Switch between back/front camera (very helpful on mobile!)
  const toggleCameraFacing = () => {
    setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
  };

  // Trigger scanning loop
  useEffect(() => {
    if (!isScanning) return;

    const scanLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        requestRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      // Ensure elements are ready before drawing
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
          });

          if (decoded && decoded.data) {
            handleScannedResult(decoded.data);
            return; // Exit loop on find
          }
        }
      }
      requestRef.current = requestAnimationFrame(scanLoop);
    };

    requestRef.current = requestAnimationFrame(scanLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isScanning, facingMode]);

  // Handle starting camera on mount or open
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Decode QR code from uploaded image files (highly robust!)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (decoded && decoded.data) {
          handleScannedResult(decoded.data);
        } else {
          toast.error(
            language === "sw" 
              ? "Hatukuweza kusoma msimbo kwenye picha hii. Hakikisha ni msimbo sahihi wa QR." 
              : "Could not detect a clear QR code in this image. Try another."
          );
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  // Perform a manual lookup for input field entries
  const handleManualSearch = async () => {
    const text = manualCode.trim();
    if (!text) return;
    handleScannedResult(text);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className={`fixed inset-0 z-[100] flex ${isMobile ? "items-end" : "items-center justify-center"} bg-gray-950/80 backdrop-blur-md ${isMobile ? "p-0" : "p-4"}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 15 }}
          animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", stiffness: 350, damping: isMobile ? 32 : 25 }}
          className={`relative w-full ${isMobile ? "rounded-t-3xl max-h-[92vh] pb-safe-bottom" : "max-w-md rounded-3xl border border-gray-100 dark:border-gray-800"} overflow-hidden bg-white dark:bg-gray-900 shadow-2xl text-gray-900 dark:text-gray-100 flex flex-col`}
        >
          {/* Mobile drag handle */}
          {isMobile && (
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-850 rounded-full mx-auto mt-3 shrink-0 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700" onClick={onClose} />
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400">
                <Camera size={18} />
              </div>
              <h3 className="font-extrabold text-md tracking-tight">
                {language === "sw" ? "Msimbo wa QR Scanner" : "Quick QR Code Scanner"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 px-1.5 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-800 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scanner view & results area */}
          <div className="p-6 flex flex-col space-y-4 flex-grow max-h-[75vh] overflow-y-auto">
            
            {/* Scanned code options chooser card */}
            {scannedPayload && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-5 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 text-center"
              >
                <div className="flex justify-center mb-2">
                  <div className="p-2.5 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400">
                    <Sparkles size={20} className="animate-bounce" />
                  </div>
                </div>
                <h4 className="font-extrabold text-sm text-gray-900 dark:text-white mb-1">
                  {language === "sw" ? "Msimbo Umesomwa!" : "Scanned Data Found"}
                </h4>
                <p className="text-xs text-gray-500 font-mono break-all py-1.5 rounded bg-white dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800/80 mb-4 shadow-sm px-2 max-w-full">
                  {scannedPayload}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      // Action to check if it's a valid product document first
                      navigate(`/product/${scannedPayload}`);
                      onClose();
                      toast.success(language === "sw" ? "Kufungua Bidhaa..." : "Navigating to Product details...", { icon: "🛍️" });
                    }}
                    className="flex items-center justify-center space-x-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow transition active:scale-95 cursor-pointer uppercase tracking-wider"
                  >
                    <span>{language === "sw" ? "Soma kama Bidhaa" : "View Product"}</span>
                    <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => {
                      navigate(`/track-order/${scannedPayload}`);
                      onClose();
                      toast.success(language === "sw" ? "Ufuatiliaji wa Agizo..." : "Directing to Track Order...", { icon: "📦" });
                    }}
                    className="flex items-center justify-center space-x-1 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-850 dark:bg-gray-800 dark:hover:bg-gray-750 text-white font-bold text-xs shadow transition active:scale-95 cursor-pointer uppercase tracking-wider"
                  >
                    <span>{language === "sw" ? "Fuata Agizo" : "Track Order"}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Video preview container */}
            {!scannedPayload && (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-950 flex flex-col items-center justify-center shadow-lg border border-gray-150 dark:border-gray-850">
                {isLoadingCamera ? (
                  <div className="flex flex-col items-center space-y-2 z-10">
                    <RefreshCw className="text-orange-600 animate-spin" size={28} />
                    <span className="text-xs font-bold text-gray-400 tracking-wider animate-pulse uppercase">
                      {language === "sw" ? "Inafungua kamera..." : "Initializing camera stream..."}
                    </span>
                  </div>
                ) : !isScanning ? (
                  <div className="flex flex-col items-center space-y-3 z-10 px-6 text-center">
                    <div className="p-3 rounded-full bg-gray-900 border border-gray-800 text-red-500 animate-pulse">
                      <Camera size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-200">
                        {language === "sw" ? "Kamera haijawashwa" : "Camera Stream Stopped"}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {language === "sw" ? "Ruhusu kamera au andika nambari hapo chini." : "Grant permission or try other methods below."}
                      </p>
                    </div>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 font-black text-xs uppercase bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow transition duration-200 cursor-pointer"
                    >
                      {language === "sw" ? "Washa Kamera" : "Resume Camera"}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Live webcam video element */}
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Overlay Scanning Sight Line & Target Box */}
                    <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/40 pointer-events-none">
                      <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-orange-500 rounded-2xl flex items-center justify-center animate-pulse-subtle">
                        {/* Scanning green/red laser */}
                        <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-lg shadow-red-500/50 animate-bounce top-[10%] bottom-[90%] pointer-events-none" />
                        
                        {/* Corners styling */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-orange-600 rounded-s-md" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-orange-600 rounded-e-md" />
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-orange-600 rounded-s-md" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-orange-600 rounded-e-md" />
                      </div>
                    </div>
                    {/* Active Camera Tools */}
                    <div className="absolute top-3 right-3 flex items-center space-x-2">
                      <button
                        onClick={toggleCameraFacing}
                        className="p-2 rounded-xl bg-gray-905/70 hover:bg-gray-905 border border-white/10 text-white backdrop-blur transition cursor-pointer"
                        title={language === "sw" ? "Badilisha kamera" : "Switch camera side"}
                      >
                        <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-300" />
                      </button>
                    </div>
                  </>
                )}
                {/* Hidden analysis canvas */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {/* Manual entry / options divider */}
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
              </div>
              <span className="relative px-3 bg-white dark:bg-gray-900 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                {language === "sw" ? "Njia Nyingine" : "Alternative Inputs"}
              </span>
            </div>

            {/* Manual lookup input field */}
            <div className="flex space-x-2">
              <div className="relative flex-grow">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={language === "sw" ? "Weka ID ya bidhaa au agizo..." : "Enter Product ID or Tracking Code..."}
                  className="block w-full pl-9 pr-4 py-3 text-xs border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-955 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-550 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                />
              </div>
              <button
                onClick={handleManualSearch}
                className="px-5 py-3 font-bold text-xs uppercase bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-850 dark:text-gray-100 rounded-xl transition cursor-pointer flex items-center space-x-1 border border-transparent dark:border-gray-800 active:scale-95 shrink-0"
              >
                <span>{language === "sw" ? "Wasilisha" : "Soma"}</span>
              </button>
            </div>

            {/* Image File Uploader (very handy fallback) */}
            <div className="p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20 hover:bg-gray-100 dark:hover:bg-gray-950/40 transition">
              <label className="flex flex-col items-center justify-center cursor-pointer space-y-2">
                <Upload size={20} className="text-gray-400" />
                <div className="text-center">
                  <span className="block font-bold text-xs text-orange-600 dark:text-orange-500 hover:underline">
                    {language === "sw" ? "Pandisha picha ya QR" : "Upload a QR Code Image"}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    {language === "sw" ? "Chagua picha kutoka kwa simu yako" : "Select and capture from camera roll"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Explanatory instruction list */}
            <div className="rounded-2xl bg-gray-50 dark:bg-gray-950 p-4 border border-gray-100 dark:border-gray-850 flex items-start space-x-3">
              <div className="p-1 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0">
                <HelpCircle size={14} />
              </div>
              <div>
                <h5 className="font-bold text-xs text-gray-900 dark:text-white mb-1">
                  {language === "sw" ? "Unachohitaji kufanya:" : "How is it used?"}
                </h5>
                <ul className="text-[10px] text-gray-400 list-disc list-inside space-y-1 pl-1 font-medium">
                  <li>{language === "sw" ? "Weka kamera mbele ya msimbo wa QR wa Sokoplus." : "Point the camera at a SokoPlus product/order QR Code."}</li>
                  <li>{language === "sw" ? "Bidhaa au kurasa ya ufuatiliaji itajifungua kiotomatiki." : "It will instantly open the detailed page or track your package status."}</li>
                  <li>{language === "sw" ? "Tazama msimbo kwenye bidhaa husika dukani." : "Great for checking authentic physical tags in Mombasa or Nairobi workshops!"}</li>
                </ul>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
