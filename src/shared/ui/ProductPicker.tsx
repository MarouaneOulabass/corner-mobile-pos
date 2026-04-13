'use client';

import * as React from 'react';
import { Search, Smartphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from './Input';

interface Product {
  id: string;
  imei?: string;
  brand: string;
  model: string;
  selling_price?: number;
  status?: string;
}

interface ProductPickerProps {
  onSelect: (product: Product) => void;
  className?: string;
  placeholder?: string;
  storeId?: string;
}

export function ProductPicker({
  onSelect,
  className,
  placeholder = 'Rechercher par IMEI, modele...',
  storeId,
}: ProductPickerProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search: query,
          status: 'in_stock',
          limit: '10',
        });
        if (storeId) params.set('store_id', storeId);
        const res = await fetch(`/api/products?${params}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.products || data || []);
          setOpen(true);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, storeId]);

  // Close on click outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatPrice = (price?: number) => {
    if (price == null) return '';
    return price.toLocaleString('fr-FR') + ' MAD';
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-elevation-3 dark:border-gray-700 dark:bg-gray-900 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-400">Recherche...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">Aucun produit trouve</div>
          ) : (
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => {
                  onSelect(product);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <Smartphone className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {product.brand} {product.model}
                  </div>
                  {product.imei && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      IMEI: {product.imei}
                    </div>
                  )}
                </div>
                {product.selling_price != null && (
                  <span className="text-sm font-medium text-corner-blue shrink-0">
                    {formatPrice(product.selling_price)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
