'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useT, localeNames, localeFlags } from '@/contexts/I18nContext';
import NotificationBell from '@/components/features/NotificationBell';
import { Store } from '@/types';

export default function Header() {
  const { user, logout, selectedStoreId, setSelectedStoreId } = useAuth();
  const { locale, setLocale, t } = useT();
  const [showMenu, setShowMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showStoreMenu, setShowStoreMenu] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetch('/api/stores')
        .then(r => r.json())
        .then(data => { if (data.stores) setStores(data.stores); })
        .catch(() => {});
    }
  }, [user?.role]);

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

            {/* Store switcher for superadmin */}
            {user.role === 'superadmin' ? (
              <div className="relative">
                <button
                  onClick={() => { setShowStoreMenu(!showStoreMenu); setShowMenu(false); setShowLangMenu(false); }}
                  className="flex items-center gap-1 text-[11px] text-corner-blue font-medium hover:opacity-80 transition-opacity"
                >
                  {selectedStoreId ? (stores.find(s => s.id === selectedStoreId)?.name ?? 'Magasin') : 'Tous les magasins'}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showStoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowStoreMenu(false)} />
                    <div className="absolute left-0 top-6 w-52 glass rounded-xl shadow-elevation-3 py-1 z-50 animate-scaleIn origin-top-left">
                      <button
                        onClick={() => { setSelectedStoreId(null); setShowStoreMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                          !selectedStoreId ? 'text-corner-blue font-medium bg-corner-blue/5' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <span>🏪</span>
                        <span>Tous les magasins</span>
                        {!selectedStoreId && (
                          <svg className="w-4 h-4 ms-auto text-corner-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      {stores.map(store => (
                        <button
                          key={store.id}
                          onClick={() => { setSelectedStoreId(store.id); setShowStoreMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                            selectedStoreId === store.id ? 'text-corner-blue font-medium bg-corner-blue/5' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                          }`}
                        >
                          <span>📍</span>
                          <span>{store.name}</span>
                          {selectedStoreId === store.id && (
                            <svg className="w-4 h-4 ms-auto text-corner-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)]">{user.store?.name || 'Magasin'}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => { setShowLangMenu(!showLangMenu); setShowMenu(false); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] press transition-colors text-sm"
              title="Langue"
            >
              {localeFlags[locale]}
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 top-11 w-40 glass rounded-xl shadow-elevation-3 py-1 z-50 animate-scaleIn origin-top-right">
                  {(['fr', 'ar', 'en'] as const).map((loc) => (
                    <button
                      key={loc}
                      onClick={() => { setLocale(loc); setShowLangMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                        locale === loc
                          ? 'text-corner-blue font-medium bg-corner-blue/5'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <span>{localeFlags[loc]}</span>
                      <span>{localeNames[loc]}</span>
                      {locale === loc && (
                        <svg className="w-4 h-4 ms-auto text-corner-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => {
              document.documentElement.classList.toggle('dark');
              localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] press transition-colors"
            data-tour="header-dark"
          >
            <svg className="w-[18px] h-[18px] dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <svg className="w-[18px] h-[18px] hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          <span data-tour="header-notif"><NotificationBell /></span>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => { setShowMenu(!showMenu); setShowLangMenu(false); }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-corner-blue/20 to-corner-green/20 flex items-center justify-center text-sm font-bold text-corner-blue press transition-all"
            >
              {user.name.charAt(0).toUpperCase()}
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute end-0 top-12 w-52 glass rounded-2xl shadow-elevation-3 py-1 z-50 animate-scaleIn origin-top-right rtl:origin-top-left">
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{user.name}</p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">{user.role}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full text-start px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    {t('auth.logout')}
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
