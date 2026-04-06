'use client';

import Link from 'next/link';

interface EmptyStateProps {
  icon: 'cart' | 'search' | 'repair' | 'stock' | 'customer' | 'sale' | 'gift' | 'cash';
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

const icons: Record<string, JSX.Element> = {
  cart: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <path d="M20 22h3l2 14h14l3-10H24" className="text-[var(--text-muted)]" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="42" r="2" className="text-[var(--text-muted)]" />
      <circle cx="38" cy="42" r="2" className="text-[var(--text-muted)]" />
    </svg>
  ),
  search: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <circle cx="29" cy="29" r="8" className="text-[var(--text-muted)]" />
      <path d="M35 35l6 6" className="text-[var(--text-muted)]" strokeLinecap="round" />
    </svg>
  ),
  repair: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <path d="M24 40l8-8m4-4l4-4m-12 4l4 4m-8 8l-4 4" className="text-[var(--text-muted)]" strokeLinecap="round" />
      <path d="M38 22l4 4-16 16-4-4z" className="text-[var(--text-muted)]" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  stock: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <rect x="22" y="24" width="20" height="16" rx="2" className="text-[var(--text-muted)]" />
      <path d="M26 24v-4a6 6 0 0112 0v4" className="text-[var(--text-muted)]" />
    </svg>
  ),
  customer: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <circle cx="32" cy="26" r="6" className="text-[var(--text-muted)]" />
      <path d="M22 44c0-5.523 4.477-10 10-10s10 4.477 10 10" className="text-[var(--text-muted)]" strokeLinecap="round" />
    </svg>
  ),
  sale: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <rect x="22" y="20" width="20" height="24" rx="2" className="text-[var(--text-muted)]" />
      <path d="M26 28h12M26 32h8M26 36h10" className="text-[var(--text-muted)]" strokeLinecap="round" />
    </svg>
  ),
  gift: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <rect x="22" y="28" width="20" height="14" rx="2" className="text-[var(--text-muted)]" />
      <path d="M32 28v14M22 32h20" className="text-[var(--text-muted)]" strokeLinecap="round" />
      <path d="M28 28c-2-4 0-6 4-6s6 2 4 6" className="text-[var(--text-muted)]" strokeLinecap="round" />
    </svg>
  ),
  cash: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 64 64" stroke="currentColor" strokeWidth={1.2}>
      <circle cx="32" cy="32" r="28" className="text-[var(--surface-3)]" />
      <rect x="20" y="24" width="24" height="16" rx="2" className="text-[var(--text-muted)]" />
      <circle cx="32" cy="32" r="4" className="text-[var(--text-muted)]" />
    </svg>
  ),
};

export default function EmptyState({ icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 animate-fadeIn">
      <div className="mb-4 opacity-60">
        {icons[icon] || icons.search}
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] text-center max-w-[240px] mb-5">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="px-5 py-2.5 bg-corner-blue hover:bg-corner-blue-dark text-white text-sm font-medium rounded-xl press transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-corner-blue hover:bg-corner-blue-dark text-white text-sm font-medium rounded-xl press transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
