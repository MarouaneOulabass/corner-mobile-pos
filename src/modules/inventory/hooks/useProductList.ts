'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Product } from '@/types';

const PAGE_SIZE = 20;

export interface ProductFilters {
  search: string;
  statusFilter: string;
  brandFilter: string;
  conditionFilter: string;
  typeFilter: string;
}

export interface UseProductListReturn {
  products: Product[];
  total: number;
  page: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  filters: ProductFilters;
  setSearch: (v: string) => void;
  setStatusFilter: (v: string) => void;
  setBrandFilter: (v: string) => void;
  setConditionFilter: (v: string) => void;
  setTypeFilter: (v: string) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  fetchProducts: (pageNum: number, append?: boolean) => Promise<void>;
  clearError: () => void;
  observerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function useProductList(): UseProductListReturn {
  const { user, activeStoreId } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const observerRef = useRef<HTMLDivElement | null>(null);

  const fetchProducts = useCallback(
    async (pageNum: number, append = false) => {
      if (!user) return;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        params.set('limit', String(PAGE_SIZE));
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (brandFilter) params.set('brand', brandFilter);
        if (conditionFilter) params.set('condition', conditionFilter);
        if (typeFilter) params.set('product_type', typeFilter);
        if (activeStoreId) params.set('store_id', activeStoreId);

        const res = await fetch(`/api/products?${params.toString()}`);
        const data = await res.json();

        if (append) {
          setProducts((prev) => [...prev, ...(data.products || [])]);
        } else {
          setProducts(data.products || []);
        }
        setTotal(data.total || 0);
      } catch {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, activeStoreId, search, statusFilter, brandFilter, conditionFilter, typeFilter]
  );

  // Reset and fetch on filter change
  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  // Infinite scroll observer
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && products.length < total) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchProducts(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [products.length, total, page, loadingMore, fetchProducts]);

  const clearFilters = () => {
    setStatusFilter('');
    setBrandFilter('');
    setConditionFilter('');
    setTypeFilter('');
  };

  const activeFilterCount = [statusFilter, brandFilter, conditionFilter, typeFilter].filter(Boolean).length;

  return {
    products,
    total,
    page,
    loading,
    loadingMore,
    error,
    filters: { search, statusFilter, brandFilter, conditionFilter, typeFilter },
    setSearch,
    setStatusFilter,
    setBrandFilter,
    setConditionFilter,
    setTypeFilter,
    clearFilters,
    activeFilterCount,
    fetchProducts,
    clearError: () => setError(null),
    observerRef,
  };
}
