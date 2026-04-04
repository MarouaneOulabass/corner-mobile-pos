'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/layouts/Header';
import BottomNav from '@/components/layouts/BottomNav';

const publicPaths = ['/login'];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
  const isFullscreenPath = pathname === '/pos';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#2AA8DC] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Chargement...</p>
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pb-20 max-w-lg mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
