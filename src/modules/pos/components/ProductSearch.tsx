'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice, conditionLabels } from '@/lib/utils';
import type { Product } from '@/types';
import IMEIScanner from '@/components/features/IMEIScanner';

interface ProductSearchProps {
  storeId: string;
  onAddToCart: (product: Product) => void;
  /** Manual accessory entry */
  showManualEntry: boolean;
  setShowManualEntry: (v: boolean) => void;
  manualName: string;
  setManualName: (v: string) => void;
  manualPrice: string;
  setManualPrice: (v: string) => void;
  onAddManualAccessory: () => void;
}

export default function ProductSearch({
  storeId,
  onAddToCart,
  showManualEntry,
  setShowManualEntry,
  manualName,
  setManualName,
  manualPrice,
  setManualPrice,
  onAddManualAccessory,
}: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchProducts = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'in_stock')
          .eq('store_id', storeId)
          .or(`imei.ilike.%${query}%,model.ilike.%${query}%,brand.ilike.%${query}%`)
          .limit(10);

        if (!error && data) {
          setSearchResults(data);
          setShowResults(true);
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    },
    [storeId]
  );

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchProducts(searchQuery), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, searchProducts]);

  const handleAddToCart = (product: Product) => {
    onAddToCart(product);
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              placeholder="Rechercher par mod&#232;le, marque ou IMEI..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <IMEIScanner onScan={(imei) => setSearchQuery(imei)} />
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => handleAddToCart(product)}
                className="w-full text-left p-3 hover:bg-slate-700 border-b border-slate-700 last:border-0 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      {product.brand} {product.model}
                      {product.storage ? ` ${product.storage}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-400">
                        {conditionLabels[product.condition] || product.condition}
                        {product.imei ? ` \u2014 IMEI: ${product.imei}` : ''}
                      </p>
                      {product.bin_location && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                          <span>{'\uD83D\uDCCD'}</span> {product.bin_location}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#2AA8DC]">
                    {formatPrice(product.selling_price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
          <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-3">
            <p className="text-sm text-slate-400 text-center">Aucun produit trouv&eacute;</p>
          </div>
        )}
      </div>

      {/* Manual accessory entry */}
      <button
        onClick={() => setShowManualEntry(!showManualEntry)}
        className="text-sm text-[#2AA8DC] hover:text-[#2596c4] mb-3 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un accessoire manuellement
      </button>

      {showManualEntry && (
        <div className="bg-slate-800 rounded-xl p-3 mb-4 space-y-2">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Nom de l&#39;accessoire"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
          />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="Prix (MAD)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2AA8DC]"
            />
            <button
              onClick={onAddManualAccessory}
              className="bg-[#2AA8DC] hover:bg-[#2596c4] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
