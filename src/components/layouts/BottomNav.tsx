'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

const navItems = [
  {
    href: '/',
    label: 'Accueil',
    icon: (active: boolean) => (
      <svg className={`w-[22px] h-[22px] transition-colors duration-200 ${active ? 'text-corner-blue' : 'text-[var(--text-muted)]'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.8}>
        {active ? (
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        )}
      </svg>
    ),
  },
  {
    href: '/pos',
    label: 'POS',
    isPrimary: true,
    icon: (active: boolean) => (
      <svg className={`w-[22px] h-[22px] transition-colors duration-200 ${active ? 'text-white' : 'text-white/90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: '/stock',
    label: 'Stock',
    icon: (active: boolean) => (
      <svg className={`w-[22px] h-[22px] transition-colors duration-200 ${active ? 'text-corner-blue' : 'text-[var(--text-muted)]'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.8}>
        {active ? (
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        )}
      </svg>
    ),
  },
  {
    href: '/menu',
    label: 'Menu',
    icon: (active: boolean) => (
      <svg className={`w-[22px] h-[22px] transition-colors duration-200 ${active ? 'text-corner-blue' : 'text-[var(--text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={active ? "M4 6h16M4 12h10M4 18h14" : "M4 6h16M4 12h16M4 18h16"} />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  const activeIndex = useMemo(() => {
    return navItems.findIndex((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
    );
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 no-print">
      <div className="glass border-t border-[var(--glass-border)] safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
          {/* Sliding indicator */}
          <div
            className="absolute top-0 h-[3px] w-12 bg-corner-blue rounded-full transition-all duration-300 ease-out"
            style={{
              left: `calc(${(activeIndex >= 0 ? activeIndex : 0) * 25}% + 12.5% - 24px)`,
              opacity: activeIndex >= 0 && !navItems[activeIndex]?.isPrimary ? 1 : 0,
            }}
          />

          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            if (item.isPrimary) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-4"
                  onClick={() => navigator.vibrate?.(10)}
                >
                  <div className={`w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-elevation-2 press transition-all ${
                    active ? 'shadow-corner-blue/30 scale-105' : ''
                  }`}>
                    {item.icon(active)}
                  </div>
                  <span className={`text-[10px] mt-1 font-semibold ${active ? 'text-corner-blue' : 'text-[var(--text-muted)]'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center min-w-[64px] min-h-[48px] gap-0.5 press"
                onClick={() => navigator.vibrate?.(10)}
              >
                {item.icon(active)}
                <span className={`text-[10px] transition-colors duration-200 ${
                  active ? 'text-corner-blue font-semibold' : 'text-[var(--text-muted)]'
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
