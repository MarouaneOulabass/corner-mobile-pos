import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { I18nProvider } from '@/contexts/I18nContext';
import DashboardShell from '@/components/layouts/DashboardShell';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'Corner Mobile ERP',
  description: 'ERP retail mobile-first pour télécom — POS, stock, réparations, comptabilité',
  manifest: '/manifest.json',
  icons: {
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2AA8DC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <I18nProvider>
            <DashboardShell>
              {children}
            </DashboardShell>
          </I18nProvider>
        </AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
