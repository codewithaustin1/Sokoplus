import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { UserProfile, Order } from "../types";
import { Bell, BellOff, X, Sparkles, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

interface NotificationManagerProps {
  user: UserProfile | null;
}

export function NotificationManager({ user }: NotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "denied";
  });

  const [showPromptBanner, setShowPromptBanner] = useState(false);
  const isInitialLoad = useRef<boolean>(true);
  const previousStatuses = useRef<Record<string, string>>({});

  // Helper inside component to report rule failures safely and elegantly
  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errInfo: FirestoreErrorInfo = {
      error: errorMsg,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
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
      console.warn("Firestore Notification Listener Quota Alert (Bypassed):", errorMsg);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("firestore-quota-exceeded", {
            detail: { error: errorMsg, path }
          })
        );
      }
      return; // Safe return without throwing
    }

    console.error("Firestore Notification Listener Error: ", JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  // Determine if we should prompt the user to enable notifications
  useEffect(() => {
    if (permission === "default" && user) {
      const isDismissed = localStorage.getItem("sokoplus-notification-prompt-dismissed");
      if (!isDismissed) {
        // Delay slightly to not interrupt initial page load experience
        const timer = setTimeout(() => {
          setShowPromptBanner(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [permission, user]);

  // Request browser permission explicitly
  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Browser notifications are not supported on this device.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPromptBanner(false);

      if (result === "granted") {
        toast.success("Order status alerts enabled successfully!", {
          icon: "🔔",
          duration: 4000,
        });

        // Test notification
        triggerLocalNotification(
          "Notifications Enabled",
          "You will receive live delivery updates from SokoPlus!"
        );
      } else if (result === "denied") {
        toast.error("Notifications blocked. You can change this in your browser settings.");
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
    }
  };

  const handleDismissBanner = () => {
    localStorage.setItem("sokoplus-notification-prompt-dismissed", "true");
    setShowPromptBanner(false);
  };

  // Helper to safely trigger notification through Service Worker or standard fallback
  const triggerLocalNotification = (title: string, body: string, dataUrl: string = "/profile") => {
    if (Notification.permission !== "granted") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SHOW_NOTIFICATION",
            title,
            options: {
              body,
              data: { url: dataUrl },
            },
          });
        } else {
          // Direct SW registration launch
          registration.showNotification(title, {
            body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            vibrate: [100, 50, 100],
            data: { url: dataUrl },
          } as any);
        }
      }).catch((swErr) => {
        console.warn("Service Worker notification trigger failed, falling back to standard notification:", swErr);
        new Notification(title, { body, icon: "/favicon.ico" });
      });
    } else {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  // Real-time Firestore subscription to order updates
  useEffect(() => {
    if (!user) {
      // Clear tracking variables if signed out
      isInitialLoad.current = true;
      previousStatuses.current = {};
      return;
    }

    const pathForOrders = "orders";
    const q = query(
      collection(db, pathForOrders),
      where("userId", "==", user.uid),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Form status mapper to determine change differences
        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const orderData = change.doc.data() as Order;
          const currentStatus = orderData.status;
          
          // Nicely formatted fallback order reference
          const orderNum = orderData.id ? orderData.id.substring(0, 8).toUpperCase() : "UNKNOWN";

          if (change.type === "added") {
            // Keep status cache updated
            previousStatuses.current[docId] = currentStatus;
          } else if (change.type === "modified") {
            const oldStatus = previousStatuses.current[docId];

            if (oldStatus && oldStatus !== currentStatus) {
              const formattedStatus = currentStatus.toUpperCase();
              
              // Trigger OS local push notification
              triggerLocalNotification(
                `Order SokoPlus #${orderNum}`,
                `Status updated to: ${formattedStatus}. Click to track details.`
              );

              // Simultaneously display in-app toast for instant visual feedback
              toast(`Order #${orderNum} changed to ${currentStatus}!`, {
                icon: "📦",
                duration: 5000,
                style: {
                  background: "#030712",
                  color: "#ffffff",
                  borderRadius: "1rem",
                  border: "1px solid rgba(249, 115, 22, 0.2)",
                  fontWeight: "bold",
                },
              });
            }
            
            // Sync current status to tracking store
            previousStatuses.current[docId] = currentStatus;
          }
        });

        // Toggle load switch
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, pathForOrders);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Real-time Firestore subscription to marketing/targeted notifications
  useEffect(() => {
    if (!user) {
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("read", "==", false),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();

            // Ignore low inventory and stock alerts completely
            const isInventoryAlert =
              data.type === "inventory_alert" ||
              (typeof data.title === "string" && (
                data.title.toLowerCase().includes("inventory") ||
                data.title.toLowerCase().includes("stock")
              )) ||
              (typeof data.body === "string" && (
                data.body.toLowerCase().includes("inventory") ||
                data.body.toLowerCase().includes("stock")
              ));

            if (isInventoryAlert) {
              return;
            }

            // Trigger local OS push notification
            triggerLocalNotification(
              data.title || "New Offer from SokoPlus",
              data.body || "Check your SokoPlus marketplace notifications!"
            );

            // Trigger visual in-app toast
            toast(data.title || "Offer Update", {
              icon: "📢",
              duration: 6000,
              style: {
                background: "#0f172a",
                color: "#ffffff",
                borderRadius: "1rem",
                border: "1px solid rgba(234, 88, 12, 0.2)",
                fontWeight: "bold",
              },
            });
          }
        });
      },
      (error) => {
        console.warn("Notifications subscription bypassed or pending rules:", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Expose configuration event listener to check browser level manual toggles
  useEffect(() => {
    const handleFocus = () => {
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermission(Notification.permission);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  return (
    <AnimatePresence>
      {showPromptBanner && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-6 right-6 z-50 w-[calc(100%-2rem)] sm:w-96"
          id="web-push-prompt-banner"
        >
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xl relative overflow-hidden flex flex-col space-y-4">
            {/* Background design circle */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-60" />
            
            <div className="flex items-start gap-4 relative">
              <div className="bg-orange-600 text-white p-3 rounded-2xl shrink-0 shadow-lg shadow-orange-100">
                <Bell className="animate-bounce" size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    SokoPlus Live
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                </div>
                <h3 className="text-sm font-black text-gray-900 tracking-tight leading-tight">
                  Track Your Deliveries Real-Time
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Never miss out. Get instantly notified when your order status transitions, travels, or delivers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2 relative">
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="flex-grow bg-gray-900 hover:bg-orange-600 hover:scale-[1.01] active:scale-95 text-white text-xs font-black uppercase tracking-wider py-3.5 px-4 rounded-xl transition-all shadow-md cursor-pointer"
              >
                Enable Notifications
              </button>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all cursor-pointer border border-gray-100 shrink-0"
                aria-label="Dismiss prompt"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
