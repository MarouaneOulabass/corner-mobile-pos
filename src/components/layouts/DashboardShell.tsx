'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/layouts/Header';
import BottomNav from '@/components/layouts/BottomNav';

const publicPaths = ['/login', '/portal'];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
  const isFullscreenPath = pathname === '/pos';

  // Initialize dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && !isPublicPath) {
      router.push('/login');
    }
  }, [user, loading, router, isPublicPath]);

  // Public pages: render without shell
  if (isPublicPath) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4 animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-elevation-2 animate-pulse2">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">Corner Mobile</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Full-screen pages (e.g. POS): render without Header/BottomNav
  if (isFullscreenPath) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors duration-300">
      <Header />
      <main className="pb-24 max-w-lg mx-auto animate-fadeIn">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
