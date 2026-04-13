'use client';

import React from 'react';

interface OfflineBannerProps {
  isOffline: boolean;
  offlineCount: number;
  syncResult: { synced: number; failed: number } | null;
}

export default function OfflineBanner({ isOffline, offlineCount, syncResult }: OfflineBannerProps) {
  if (syncResult) {
    return (
      <div className={`text-white text-center text-sm py-1.5 font-medium ${syncResult.failed > 0 ? 'bg-orange-500' : 'bg-green-600'}`}>
        {syncResult.failed === 0
          ? `\u2713 ${syncResult.synced} vente(s) synchronis\u00e9e(s) avec succ\u00e8s`
          : `\u26A0 ${syncResult.synced} synchronis\u00e9e(s) \u2014 ${syncResult.failed} \u00e9chec(s), conserv\u00e9e(s) en file`}
      </div>
    );
  }

  if (isOffline || offlineCount > 0) {
    return (
      <div className="bg-orange-500 text-white text-center text-sm py-1.5 font-medium">
        {isOffline
          ? 'Hors ligne \u2014 Les ventes seront synchronis\u00e9es automatiquement'
          : `${offlineCount} vente(s) en attente de synchronisation`}
      </div>
    );
  }

  return null;
}
