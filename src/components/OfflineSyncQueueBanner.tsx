import React, { useState, useEffect } from "react";
import { Database, RefreshCw, CheckCircle2, Clock, Trash2, ArrowUpRight } from "lucide-react";
import {
  getOfflineMutationsQueue,
  processOfflineMutationsQueue,
  clearOfflineMutationsQueue,
  QueuedMutation,
} from "../utils/offlineSyncQueue";
import toast from "react-hot-toast";

export function OfflineSyncQueueBanner() {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const refreshQueue = () => {
    setQueue(getOfflineMutationsQueue());
  };

  useEffect(() => {
    refreshQueue();

    const handleUpdated = () => refreshQueue();
    const handleProcessed = () => refreshQueue();
    const handleOnline = () => {
      // Auto-trigger sync on internet reconnection
      if (getOfflineMutationsQueue().length > 0) {
        setIsSyncing(true);
        processOfflineMutationsQueue().finally(() => {
          setIsSyncing(false);
          refreshQueue();
        });
      }
    };

    window.addEventListener("offline-mutations-updated", handleUpdated);
    window.addEventListener("offline-mutations-processed", handleProcessed);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline-mutations-updated", handleUpdated);
      window.removeEventListener("offline-mutations-processed", handleProcessed);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (queue.length === 0) return null;

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await processOfflineMutationsQueue();
    } finally {
      setIsSyncing(false);
      refreshQueue();
    }
  };

  const handleClear = () => {
    if (window.confirm("Clear all pending offline mutations? Any unsynced local changes will be discarded.")) {
      clearOfflineMutationsQueue();
      refreshQueue();
      toast.success("Offline queue cleared");
    }
  };

  return (
    <div className="bg-amber-900 text-white border-b border-amber-800 shadow-lg px-4 py-2.5 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-amber-800/80 rounded-lg text-amber-300 shrink-0">
            <Clock size={16} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-amber-100">
              <span>{queue.length} Pending Offline Write(s) Queued</span>
              <span className="bg-amber-700/80 text-amber-200 text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-amber-600/50">
                Bidirectional Sync Active
              </span>
            </div>
            <p className="text-amber-200/90 text-[11px] mt-0.5">
              Changes made offline/during quota-exceeded periods are cached locally and ready to replay to Firestore.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 bg-amber-800 hover:bg-amber-700 text-amber-200 rounded-lg transition font-medium text-[11px] cursor-pointer"
          >
            {isExpanded ? "Hide Log" : "View Log"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-amber-300 hover:text-rose-300 hover:bg-amber-800/80 rounded-lg transition cursor-pointer"
            title="Discard pending changes"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
            <span>{isSyncing ? "Syncing..." : "Sync Pending Changes"}</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-w-7xl mx-auto mt-3 border-t border-amber-800/80 pt-3">
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded bg-amber-950/60 border border-amber-800/60 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="uppercase font-mono text-[9px] bg-amber-800 text-amber-200 px-1.5 py-0.5 rounded font-black">
                    {item.type}
                  </span>
                  <span className="text-amber-100 font-medium">{item.description}</span>
                  <span className="text-amber-400/80 text-[10px]">({item.collectionName})</span>
                </div>
                <div className="text-amber-400 text-[10px] font-mono">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
