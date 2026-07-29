import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  serverTimestamp 
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Product, InventoryAlert } from "../types";
import toast from "react-hot-toast";

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error("Firestore Inventory Alert Error:", errInfo);
}

/**
 * Fetches the global admin inventory low-stock threshold from Firestore settings.
 */
export async function getInventoryThreshold(): Promise<number> {
  const settingsDocRef = doc(db, "settings", "inventory");
  try {
    const snap = await getDoc(settingsDocRef);
    if (snap.exists() && typeof snap.data()?.lowStockThreshold === "number") {
      return snap.data().lowStockThreshold;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "settings/inventory");
  }
  return DEFAULT_LOW_STOCK_THRESHOLD;
}

/**
 * Updates the global admin low-stock threshold setting in Firestore.
 */
export async function saveInventoryThreshold(newThreshold: number): Promise<boolean> {
  const settingsDocRef = doc(db, "settings", "inventory");
  try {
    await setDoc(settingsDocRef, {
      lowStockThreshold: newThreshold,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || "admin"
    }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "settings/inventory");
    return false;
  }
}

/**
 * Automatically audits products against the predefined threshold.
 * Generates Firestore alerts for low-stock items and auto-resolves restocked items.
 */
export async function auditAndTriggerInventoryAlerts(
  products: Product[], 
  threshold: number,
  showToasts = false
): Promise<InventoryAlert[]> {
  if (!products || products.length === 0) return [];

  const path = "inventory_alerts";
  try {
    // 1. Fetch current active alerts from Firestore
    const q = query(collection(db, path), where("status", "==", "unread"));
    const snapshot = await getDocs(q);
    const existingAlertsMap = new Map<string, string>(); // productId -> alertId
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.productId) {
        existingAlertsMap.set(data.productId, docSnap.id);
      }
    });

    let newAlertsCount = 0;

    // 2. Scan products
    for (const product of products) {
      if (product.active === false) continue;

      const currentStock = Number(product.stock) || 0;
      const isLowStock = currentStock <= threshold;
      const hasExistingUnreadAlert = existingAlertsMap.has(product.id);

      if (isLowStock && !hasExistingUnreadAlert) {
        // Trigger automated low inventory alert
        const alertPayload = {
          productId: product.id,
          productName: product.name,
          stock: currentStock,
          threshold,
          category: product.category || "General",
          artisan: product.artisan || product.sellerName || "Direct Stock",
          status: "unread" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const alertDocRef = await addDoc(collection(db, path), alertPayload);
        newAlertsCount++;

        // Dispatch notification to user notifications for logged in admin
        if (auth.currentUser?.uid) {
          try {
            await addDoc(collection(db, "users", auth.currentUser.uid, "notifications"), {
              title: currentStock === 0 ? "🚨 Out of Stock Alert" : "⚠️ Low Inventory Alert",
              body: `"${product.name}" has ${currentStock} units remaining (below threshold of ${threshold}).`,
              type: "inventory_alert",
              productId: product.id,
              createdAt: new Date().toISOString(),
              read: false
            });
          } catch (e) {
            // Ignore sub-notification error if user is non-owner
          }
        }
      } else if (!isLowStock && hasExistingUnreadAlert) {
        // Product restocked above threshold! Auto-resolve the active alert
        const alertId = existingAlertsMap.get(product.id)!;
        await updateDoc(doc(db, path, alertId), {
          status: "resolved",
          stock: currentStock,
          updatedAt: new Date().toISOString()
        });
      }
    }

    if (showToasts && newAlertsCount > 0) {
      toast.error(`Automated Alert: ${newAlertsCount} product(s) fell below inventory threshold (${threshold} units).`, {
        duration: 5000,
        icon: '⚠️'
      });
    }

    // Return all current alerts
    const updatedSnap = await getDocs(collection(db, path));
    return updatedSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryAlert));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return [];
  }
}

/**
 * Marks an inventory alert as resolved.
 */
export async function resolveInventoryAlert(alertId: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, "inventory_alerts", alertId), {
      status: "resolved",
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `inventory_alerts/${alertId}`);
    return false;
  }
}

/**
 * Marks an inventory alert as dismissed.
 */
export async function dismissInventoryAlert(alertId: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, "inventory_alerts", alertId), {
      status: "dismissed",
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `inventory_alerts/${alertId}`);
    return false;
  }
}

/**
 * Restocks a product in Firestore and resolves associated alerts.
 */
export async function quickRestockProduct(productId: string, addQuantity: number, currentStock: number): Promise<boolean> {
  try {
    const productRef = doc(db, "products", productId);
    const newStock = Math.max(0, currentStock + addQuantity);
    await updateDoc(productRef, {
      stock: newStock,
      updatedAt: new Date().toISOString()
    });

    // Check if there are active unread alerts for this product to resolve
    const q = query(
      collection(db, "inventory_alerts"),
      where("productId", "==", productId),
      where("status", "==", "unread")
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(db, "inventory_alerts", d.id), {
        status: "resolved",
        stock: newStock,
        updatedAt: new Date().toISOString()
      });
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
    return false;
  }
}
