'use client';

import * as React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface ColumnDef<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  sort?: SortState;
  onSort?: (sort: SortState) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  data,
  sort,
  onSort,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  loading = false,
  emptyMessage = 'Aucune donnee',
  rowKey,
}: DataTableProps<T>) {
  const totalPages = total != null && pageSize > 0 ? Math.ceil(total / pageSize) : 1;

  const handleSort = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSort) return;
    const direction =
      sort?.column === col.key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSort({ column: col.key, direction });
  };

  const getValue = (row: T, key: string): React.ReactNode => {
    return (row as Record<string, unknown>)[key] as React.ReactNode;
  };

  return (
    <div className="w-full">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100',
                    col.className
                  )}
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sort?.column === col.key && (
                      sort.direction === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading
              ? Array.from({ length: pageSize }).map((_, i) => (
                  <SkeletonRow key={i} cols={columns.length} />
                ))
              : data.length === 0
              ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )
              : data.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)}>
                        {col.render ? col.render(row) : getValue(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2"
              >
                {columns.map((col) => (
                  <div key={col.key} className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                ))}
              </div>
            ))
          : data.length === 0
          ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400">
              {emptyMessage}
            </div>
          )
          : data.map((row) => (
              <div
                key={rowKey(row)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2"
              >
                {columns.map((col) => (
                  <div key={col.key} className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                      {col.label}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 text-right">
                      {col.render ? col.render(row) : getValue(row, col.key)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
      </div>

      {/* Pagination */}
      {total != null && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Page {page} / {totalPages} ({total} resultats)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
