/**
 * IMEI Blacklist Check Library
 *
 * Checks IMEI against free online IMEI check services.
 * Results are cached in memory with a 24-hour TTL.
 * Graceful fallback: if all APIs fail, returns clean=true with source='unavailable'.
 */

interface IMEICheckResult {
  clean: boolean;
  source: string;
  details?: string;
}

interface CacheEntry {
  result: IMEICheckResult;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry>();

/**
 * Clean expired entries from cache periodically.
 */
function cleanCache(): void {
  const now = Date.now();
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    const entry = cache.get(key);
    if (entry && now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

// Run cache cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanCache, 60 * 60 * 1000);
}

/**
 * Check IMEI against multiple free IMEI check APIs.
 * Returns clean/dirty status with source information.
 *
 * @param imei - 15-digit IMEI string
 * @returns Promise with check result
 */
export async function checkIMEIBlacklist(imei: string): Promise<IMEICheckResult> {
  // Check cache first
  const cached = cache.get(imei);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.result, source: `${cached.result.source} (cache)` };
  }

  // Try multiple IMEI check sources
  const checkers = [
    checkIMEIInfoAPI,
    checkIMEIPro,
  ];

  for (const checker of checkers) {
    try {
      const result = await checker(imei);
      if (result) {
        // Cache the result
        cache.set(imei, { result, timestamp: Date.now() });
        return result;
      }
    } catch {
      // Try next checker
      continue;
    }
  }

  // All APIs failed — graceful fallback
  const fallback: IMEICheckResult = {
    clean: true,
    source: 'unavailable',
    details: 'Impossible de vérifier l\'IMEI. Tous les services sont indisponibles.',
  };

  return fallback;
}

/**
 * Check via imei.info API (free tier).
 * This is a best-effort check — the free API may have rate limits.
 */
async function checkIMEIInfoAPI(imei: string): Promise<IMEICheckResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.imei.info/check/${imei}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CornerMobilePOS/1.0',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();

    return {
      clean: !data.blacklisted,
      source: 'imei.info',
      details: data.blacklisted
        ? `IMEI signalé comme perdu/volé (${data.blacklist_status || 'blacklisted'})`
        : 'IMEI propre — aucun signalement trouvé',
    };
  } catch {
    return null;
  }
}

/**
 * Alternative IMEI check source.
 */
async function checkIMEIPro(imei: string): Promise<IMEICheckResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.imeipro.info/api/check/${imei}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CornerMobilePOS/1.0',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();

    return {
      clean: data.status !== 'blacklisted',
      source: 'imeipro.info',
      details: data.status === 'blacklisted'
        ? 'IMEI sur liste noire'
        : 'IMEI non signalé',
    };
  } catch {
    return null;
  }
}

/**
 * Get cache statistics (for debugging).
 */
export function getIMEICacheStats(): { size: number; entries: string[] } {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()),
  };
}

/**
 * Clear the IMEI cache.
 */
export function clearIMEICache(): void {
  cache.clear();
}
