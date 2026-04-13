'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const RECENT_KEY = 'cm_recent_searches';

const typeLabels: Record<string, string> = {
  product: 'Produits',
  customer: 'Clients',
  sale: 'Ventes',
  repair: 'Reparations',
};

const typeIcons: Record<string, JSX.Element> = {
  product: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  customer: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  sale: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  repair: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter(s => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => {
          if (!prev) {
            setRecentSearches(getRecentSearches());
          }
          return !prev;
        });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Reset selected index on results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  function navigateTo(href: string, searchTerm?: string) {
    if (searchTerm) saveRecentSearch(searchTerm);
    setOpen(false);
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const items = results.length > 0 ? results : [];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        navigateTo(items[selectedIndex].href, query);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  // Flat list for keyboard navigation index mapping
  let flatIndex = 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-[var(--surface-1)] rounded-2xl shadow-elevation-3 border border-[var(--border)] overflow-hidden animate-scaleIn">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <svg className="w-5 h-5 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher produits, clients, ventes, reparations..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] bg-[var(--surface-2)] rounded border border-[var(--border)]">
            ESC
          </kbd>
          {loading && (
            <div className="w-4 h-4 border-2 border-corner-blue/30 border-t-corner-blue rounded-full animate-spin" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Recent searches (when no query) */}
          {!query.trim() && recentSearches.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                Recherches recentes
              </p>
              {recentSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(s); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-lg transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">Aucun resultat pour &quot;{query}&quot;</p>
            </div>
          )}

          {/* Grouped results */}
          {Object.keys(grouped).map(type => {
            const items = grouped[type];
            return (
              <div key={type} className="p-2">
                <p className="px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  {typeLabels[type] || type}
                </p>
                {items.map(item => {
                  const currentFlatIndex = flatIndex++;
                  const isSelected = currentFlatIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.href, query)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        isSelected
                          ? 'bg-corner-blue/10 text-corner-blue'
                          : 'hover:bg-[var(--surface-2)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-corner-blue/20 text-corner-blue'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                      }`}>
                        {typeIcons[item.type] || typeIcons.product}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{item.subtitle}</p>
                      </div>
                      <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 bg-[var(--surface-2)] rounded border border-[var(--border)]">&uarr;</kbd>
              <kbd className="px-1 py-0.5 bg-[var(--surface-2)] rounded border border-[var(--border)]">&darr;</kbd>
              naviguer
            </span>
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 bg-[var(--surface-2)] rounded border border-[var(--border)]">&crarr;</kbd>
              ouvrir
            </span>
          </div>
          <span>
            <kbd className="px-1 py-0.5 bg-[var(--surface-2)] rounded border border-[var(--border)]">Ctrl+K</kbd>
            recherche
          </span>
        </div>
      </div>
    </div>
  );
}
