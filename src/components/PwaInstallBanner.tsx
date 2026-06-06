import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, X, Smartphone, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";
import toast from "react-hot-toast";

export function PwaInstallBanner() {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [installed, setInstalled] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already installed
    const checkIfIsStandalone = () => {
      const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      return isStandaloneMedia || isIOSStandalone;
    };

    if (checkIfIsStandalone()) {
      setIsStandalone(true);
      return;
    }

    // 2. Detect iOS
    const detectIOSDevice = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    const ios = detectIOSDevice();
    setIsIOS(ios);

    // 3. For Android/Chrome - listen to beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Give a slight delay before showing the non-intrusive prompt so it feels premium and integrated
      const timer = setTimeout(() => {
        setShowAlert(true);
      }, 1500);
      return () => clearTimeout(timer);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // If iOS, also trigger it beautifully on mounted page
    if (ios) {
      const timer = setTimeout(() => {
        setShowAlert(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Fallback: If prompt wasn't captured but we want to show install options for newer browsers
    // We can show the alert after some time on desktop/others if not standalone
    const fallbackTimer = setTimeout(() => {
      if (!isStandalone && !deferredPrompt && !ios) {
        setShowAlert(true);
      }
    }, 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(fallbackTimer);
    };
  }, [deferredPrompt, isStandalone]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Direct instructions fallback for desktop/chrome without saved prompt
      toast.success(
        language === "sw" 
          ? "Bofya kitufe cha 'Sakinisha' kwenye bar ya upau ya kivinjari chako!" 
          : "Click the 'Install' icon in your browser's address bar!",
        { icon: "✨" }
      );
      return;
    }

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install user choice outcome: ${outcome}`);

    if (outcome === "accepted") {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowAlert(false);
      toast.success(
        language === "sw" 
          ? "Kongole! Sokoplus imesakinishwa." 
          : "Awesome! Sokoplus has been installed successfully.",
        { icon: "🎉" }
      );
    }
  };

  // Skip rendering if not compatible, already standalone or installed
  if (isStandalone || installed) return null;

  const textDict = {
    en: {
      prompt: "Install Sokoplus to your home screen to track your delivery offline.",
      btnInstall: "Install App",
      btnDismiss: "Maybe Later",
      iosTitle: "How to Install on Apple iOS",
      iosStep1: "1. Tap the Share button",
      iosStep2: "2. Scroll down & select 'Add to Home Screen'",
      iosBtnClose: "Got It",
      successTitle: "Ready Offline",
    },
    sw: {
      prompt: "Sakinisha Sokoplus kwenye skrini ya nyumbani kufuatilia mzigo wako bila mtandao.",
      btnInstall: "Sakinisha Sasa",
      btnDismiss: "Baadaye",
      iosTitle: "Jinsi ya Kusakinisha kwenye Apple iOS",
      iosStep1: "1. Bofya kitufe cha Kushiriki (Share)",
      iosStep2: "2. Shuka chini na uchague 'Ongeza kwenye Skrini ya Nyumbani'",
      iosBtnClose: "Nimeelewa",
      successTitle: "Tayari Nje ya Mtandao",
    }
  };

  const t = textDict[language === "sw" ? "sw" : "en"];

  return (
    <>
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="w-full max-w-xl mx-auto bg-gradient-to-r from-gray-950 to-gray-900 border border-gray-800 rounded-[2rem] p-5 shadow-2xl relative overflow-hidden text-white"
          >
            {/* Ambient aesthetic light ring */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointers-events-none"></div>

            <div className="flex items-start gap-4">
              <div className="bg-orange-600/20 text-orange-500 p-3 rounded-2xl flex items-center justify-center shrink-0 border border-orange-500/10">
                <Smartphone size={24} className="animate-bounce" style={{ animationDuration: "3s" }} />
              </div>

              <div className="space-y-3.5 pr-6 w-full">
                <div className="space-y-1">
                  <span className="text-[9px] text-orange-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                    {t.successTitle}
                  </span>
                  <p className="text-sm font-semibold text-gray-100 leading-relaxed max-w-sm">
                    {t.prompt}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleInstallClick}
                    className="bg-orange-600 text-white hover:bg-orange-700 active:scale-95 text-xs font-black px-4.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-900/10"
                  >
                    <Download size={14} />
                    <span>{t.btnInstall}</span>
                  </button>

                  <button
                    onClick={() => setShowAlert(false)}
                    className="bg-transparent hover:bg-white/5 text-gray-400 hover:text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    {t.btnDismiss}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowAlert(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Installation Instructions Safari Drawer Sheet */}
      <AnimatePresence>
        {showIosGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIosGuide(false)}
              className="absolute inset-0 bg-black backdrop-blur-xs"
            />
            
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-gray-900 space-y-5 border border-gray-100 pb-8 sm:pb-6"
            >
              <div className="flex justify-between items-center pb-1 border-b border-gray-50">
                <h3 className="font-extrabold text-base tracking-tight text-gray-900 flex items-center gap-2">
                  <Smartphone size={18} className="text-orange-600" />
                  <span>{t.iosTitle}</span>
                </h3>
                <button
                  onClick={() => setShowIosGuide(false)}
                  className="bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full cursor-pointer transition-colors text-gray-500"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-4 text-xs font-medium text-gray-600 leading-relaxed">
                <div className="flex items-center gap-3.5 bg-orange-50/50 p-3 rounded-2xl border border-orange-100/30">
                  <div className="bg-orange-600 text-white p-2 rounded-xl flex items-center justify-center shrink-0">
                    <ArrowUpFromLine size={16} />
                  </div>
                  <p>{t.iosStep1}</p>
                </div>

                <div className="flex items-center gap-3.5 bg-orange-50/50 p-3 rounded-2xl border border-orange-100/30">
                  <div className="bg-orange-600 text-white p-2 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <p>{t.iosStep2}</p>
                </div>
              </div>

              <button
                onClick={() => setShowIosGuide(false)}
                className="w-full bg-gray-900 hover:bg-orange-600 focus:bg-orange-600 active:scale-95 text-white py-3.5 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer shadow-md"
              >
                {t.iosBtnClose}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
