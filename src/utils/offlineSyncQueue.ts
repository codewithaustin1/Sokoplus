import { db } from "../lib/firebase";
import { doc, setDoc, updateDoc, addDoc, deleteDoc, collection } from "firebase/firestore";
import toast from "react-hot-toast";

export interface QueuedMutation {
  id: string;
  type: "add" | "set" | "update" | "delete";
  collectionName: string;
  docId?: string;
  payload?: any;
  options?: { merge?: boolean };
  timestamp: number;
  description: string;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = "sokoplus_offline_mutations_queue";

export function getOfflineMutationsQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("[Offline Queue] Error reading queue from storage:", err);
    return [];
  }
}

export function saveOfflineMutationsQueue(queue: QueuedMutation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(
      new CustomEvent("offline-mutations-updated", {
        detail: { count: queue.length, queue },
      })
    );
  } catch (err) {
    console.error("[Offline Queue] Error writing queue to storage:", err);
  }
}

export function enqueueOfflineMutation(
  item: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">
): QueuedMutation {
  const queue = getOfflineMutationsQueue();
  const newMutation: QueuedMutation = {
    ...item,
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: Date.now(),
    retryCount: 0,
  };

  queue.push(newMutation);
  saveOfflineMutationsQueue(queue);

  toast(`Offline mutation logged: ${item.description || item.collectionName}`, {
    icon: "📥",
    id: `queue-${newMutation.id}`,
    duration: 3500,
  });

  return newMutation;
}

export function removeOfflineMutation(id: string): void {
  const queue = getOfflineMutationsQueue();
  const updated = queue.filter((m) => m.id !== id);
  saveOfflineMutationsQueue(updated);
}

export function clearOfflineMutationsQueue(): void {
  saveOfflineMutationsQueue([]);
}

let isProcessingQueue = false;

export async function processOfflineMutationsQueue(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (isProcessingQueue) {
    return { synced: 0, failed: 0, remaining: getOfflineMutationsQueue().length };
  }

  const queue = getOfflineMutationsQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  if (!navigator.onLine) {
    toast.error("Device is offline. Mutation queue sync paused.", { id: "offline-sync-paused" });
    return { synced: 0, failed: 0, remaining: queue.length };
  }

  isProcessingQueue = true;
  let synced = 0;
  let failed = 0;
  const remainingQueue: QueuedMutation[] = [];

  const toastId = toast.loading(`Replaying ${queue.length} pending offline write(s) to Firestore...`);

  for (const mutation of queue) {
    try {
      if (mutation.type === "add") {
        await addDoc(collection(db, mutation.collectionName), mutation.payload);
      } else if (mutation.type === "set") {
        if (!mutation.docId) throw new Error("docId required for set mutation");
        await setDoc(doc(db, mutation.collectionName, mutation.docId), mutation.payload, mutation.options || {});
      } else if (mutation.type === "update") {
        if (!mutation.docId) throw new Error("docId required for update mutation");
        await updateDoc(doc(db, mutation.collectionName, mutation.docId), mutation.payload);
      } else if (mutation.type === "delete") {
        if (!mutation.docId) throw new Error("docId required for delete mutation");
        await deleteDoc(doc(db, mutation.collectionName, mutation.docId));
      }

      synced++;
      console.log(`[Offline Queue] Replayed mutation successfully:`, mutation.description);
    } catch (err: any) {
      console.error(`[Offline Queue] Failed to replay mutation:`, mutation.description, err);
      const errStr = String(err?.message || err || "").toLowerCase();
      const isQuota = errStr.includes("quota") || errStr.includes("resource_exhausted");

      mutation.retryCount = (mutation.retryCount || 0) + 1;
      if (isQuota) {
        remainingQueue.push(mutation);
        failed++;
        break; // stop replaying if quota is still active
      } else {
        if (mutation.retryCount < 5) {
          remainingQueue.push(mutation);
        }
        failed++;
      }
    }
  }

  saveOfflineMutationsQueue(remainingQueue);
  isProcessingQueue = false;

  if (synced > 0) {
    toast.success(`Synced ${synced} pending offline change(s) to cloud database!`, {
      id: toastId,
      duration: 4000,
    });
  } else if (failed > 0) {
    toast.error(`Database quota/network limits active. ${failed} offline write(s) pending sync.`, {
      id: toastId,
      duration: 4000,
    });
  } else {
    toast.dismiss(toastId);
  }

  window.dispatchEvent(
    new CustomEvent("offline-mutations-processed", {
      detail: { synced, failed, remaining: remainingQueue.length },
    })
  );

  return { synced, failed, remaining: remainingQueue.length };
}

export async function executeOrQueueFirestoreMutation<T = any>(
  action: () => Promise<T>,
  mutationInfo: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">
): Promise<{ success: boolean; queued: boolean; result?: T; error?: any }> {
  if (!navigator.onLine) {
    const queuedItem = enqueueOfflineMutation(mutationInfo);
    return { success: true, queued: true };
  }

  try {
    const result = await action();
    return { success: true, queued: false, result };
  } catch (err: any) {
    const errStr = String(err?.message || err || "").toLowerCase();
    const isQuotaOrOffline =
      !navigator.onLine ||
      errStr.includes("quota") ||
      errStr.includes("resource_exhausted") ||
      errStr.includes("unavailable") ||
      errStr.includes("failed-precondition") ||
      errStr.includes("network");

    if (isQuotaOrOffline) {
      console.warn(`[Offline Queue] Write operation failed offline/quota. Enqueuing for sync:`, mutationInfo.description);
      enqueueOfflineMutation(mutationInfo);
      return { success: true, queued: true };
    }

    throw err;
  }
}
