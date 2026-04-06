'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Part, PartCategory } from '@/types';
import { partCategoryLabels, formatPrice } from '@/lib/utils';

const CATEGORIES: (PartCategory | 'all')[] = [
  'all', 'screen', 'battery', 'charging_port', 'camera', 'speaker',
  'microphone', 'button', 'housing', 'motherboard', 'other',
];

export default function PartsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PartCategory | 'all'>('all');
  const [total, setTotal] = useState(0);

  const fetchParts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');

      const res = await fetch(`/api/parts?${params.toString()}`);
      const data = await res.json();
      setParts(data.parts || []);
      setTotal(data.total || 0);
    } catch {
      setParts([]);
    } finally {
      setLoading(false);
    }
  }, [user, category, search]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => fetchParts(), 300));
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Pièces détachées</h1>
            <button
              onClick={() => router.push('/parts/add')}
              className="px-3 py-1.5 bg-[#2AA8DC] text-white text-sm font-medium rounded-lg hover:bg-[#2490c0] transition-colors"
            >
              + Ajouter
            </button>
          </div>

          {/* Search */}
          <div className="mt-3">
            <input
              type="text"
              placeholder="Rechercher une pièce..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none"
            />
          </div>

          {/* Category tabs */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  category === cat
                    ? 'bg-[#2AA8DC] text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:bg-slate-600'
                }`}
              >
                {cat === 'all' ? 'Toutes' : partCategoryLabels[cat] || cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AA8DC]" />
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">🔩</p>
            <p className="font-medium">Aucune pièce trouvée</p>
            <p className="text-sm mt-1">
              {search ? 'Essayez une autre recherche' : 'Ajoutez votre première pièce'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{total} pièce{total !== 1 ? 's' : ''}</p>
            <div className="space-y-2">
              {parts.map((part) => {
                const isLowStock = part.quantity < part.min_quantity;
                return (
                  <button
                    key={part.id}
                    onClick={() => router.push(`/parts/add?edit=${part.id}`)}
                    className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700 hover:border-[#2AA8DC] transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {part.name}
                          </h3>
                          {isLowStock && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                              Stock bas
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {partCategoryLabels[part.category] || part.category}
                          </span>
                          {part.sku && (
                            <span className="text-xs text-gray-400">
                              SKU: {part.sku}
                            </span>
                          )}
                          {part.bin_location && (
                            <span className="text-xs text-gray-400">
                              📍 {part.bin_location}
                            </span>
                          )}
                        </div>
                        {part.compatible_brands && part.compatible_brands.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {part.compatible_brands.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <div className={`text-sm font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                          {part.quantity}
                          <span className="text-xs font-normal text-gray-400">
                            /{part.min_quantity}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatPrice(part.purchase_price)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
