'use client';

import * as React from 'react';
import { Search, Plus, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from './Input';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface CustomerPickerProps {
  onSelect: (customer: Customer) => void;
  onCreateNew?: (searchTerm: string) => void;
  className?: string;
  placeholder?: string;
}

export function CustomerPicker({
  onSelect,
  onCreateNew,
  className,
  placeholder = 'Rechercher un client...',
}: CustomerPickerProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Customer[]>([]);
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
        const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.customers || data || []);
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
  }, [query]);

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
            <div className="px-4 py-3 text-sm text-gray-400">Aucun client trouve</div>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => {
                  onSelect(customer);
                  setQuery(customer.name);
                  setOpen(false);
                }}
              >
                <User className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {customer.name}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">{customer.phone}</div>
                </div>
              </button>
            ))
          )}
          {onCreateNew && query.length >= 2 && (
            <button
              type="button"
              className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-corner-blue font-medium"
              onClick={() => {
                onCreateNew(query);
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4 shrink-0" />
              Creer &quot;{query}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
