'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/features/NotificationBell';

export default function Header() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!user) return null;

  return (
    <header
      className={`sticky top-0 z-40 no-print transition-all duration-300 ${
        scrolled
          ? 'glass shadow-glass'
          : 'bg-[var(--surface-1)]'
      }`}
    >
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-elevation-1">
            <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)]">Corner Mobile</h1>
            <p className="text-[11px] text-[var(--text-muted)]">{user.store?.name || 'Magasin'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Dark mode toggle */}
          <button
            onClick={() => {
              document.documentElement.classList.toggle('dark');
              localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] press transition-colors"
            title="Mode sombre"
          >
            <svg className="w-[18px] h-[18px] dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <svg className="w-[18px] h-[18px] hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-corner-blue/20 to-corner-green/20 flex items-center justify-center text-sm font-bold text-corner-blue press transition-all"
            >
              {user.name.charAt(0).toUpperCase()}
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-12 w-52 glass rounded-2xl shadow-elevation-3 py-1 z-50 animate-scaleIn origin-top-right">
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{user.name}</p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">{user.role}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    Se deconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
