'use client';

import { useState, useEffect, useCallback } from 'react';

const OFFLINE_QUEUE_KEY = 'corner_pos_offline_queue';

function getOfflineQueue(): unknown[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToOfflineQueue(saleData: unknown) {
  const queue = getOfflineQueue();
  queue.push(saleData);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function clearOfflineQueueStorage() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export function useOfflineQueue() {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null);

  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    const total = queue.length;
    const failed: unknown[] = [];
    for (const sd of queue) {
      try {
        const r = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sd),
        });
        if (!r.ok) failed.push(sd);
      } catch {
        failed.push(sd);
      }
    }
    if (failed.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
    } else {
      clearOfflineQueueStorage();
    }
    setOfflineCount(failed.length);
    const synced = total - failed.length;
    if (synced > 0 || failed.length > 0) {
      setSyncResult({ synced, failed: failed.length });
      setTimeout(() => setSyncResult(null), 6000);
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setIsOffline(!navigator.onLine);
    setOfflineCount(getOfflineQueue().length);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [syncOfflineQueue]);

  const queueSale = (saleData: unknown) => {
    addToOfflineQueue(saleData);
    setOfflineCount(getOfflineQueue().length);
  };

  return {
    isOffline,
    offlineCount,
    syncResult,
    queueSale,
  };
}
