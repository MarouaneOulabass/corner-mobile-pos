'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-[var(--surface-1)] rounded-2xl p-5 shadow-elevation-1 border border-[var(--border-light)] animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <Skeleton className="h-8 w-28 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[var(--surface-1)] rounded-xl p-4 shadow-elevation-1 border border-[var(--border-light)] animate-fadeIn" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-4 p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      {/* Activity */}
      <Skeleton className="h-4 w-24 mt-2" />
      <SkeletonList count={3} />
    </div>
  );
}
