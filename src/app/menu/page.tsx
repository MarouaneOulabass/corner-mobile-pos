'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/auth';

const menuSections = [
  {
    title: 'Ventes & Clients',
    items: [
      {
        title: 'Historique des ventes',
        description: 'Consulter les ventes passées',
        href: '/sales',
        icon: '🧾',
        minRole: 'seller' as const,
      },
      {
        title: 'Retours & Échanges',
        description: 'Traiter un retour ou échange',
        href: '/returns',
        icon: '↩️',
        minRole: 'seller' as const,
      },
      {
        title: 'Clients',
        description: 'Base de données clients',
        href: '/customers',
        icon: '👥',
        minRole: 'seller' as const,
      },
      {
        title: 'Programme fidélité',
        description: 'Points et récompenses',
        href: '/loyalty',
        icon: '⭐',
        minRole: 'seller' as const,
      },
      {
        title: 'Paiements échelonnés',
        description: 'Plans de paiement en cours',
        href: '/installments',
        icon: '📅',
        minRole: 'seller' as const,
      },
      {
        title: 'Cartes cadeaux',
        description: 'Créer et gérer les cartes',
        href: '/gift-cards',
        icon: '🎁',
        minRole: 'seller' as const,
      },
    ],
  },
  {
    title: 'Réparations',
    items: [
      {
        title: 'Réparations',
        description: 'Gérer les tickets de réparation',
        href: '/repairs',
        icon: '🔧',
        minRole: 'seller' as const,
      },
      {
        title: 'Pièces détachées',
        description: 'Stock de pièces pour réparations',
        href: '/parts',
        icon: '🔩',
        minRole: 'seller' as const,
      },
    ],
  },
  {
    title: 'Stock & Achats',
    items: [
      {
        title: 'Rachat / Trade-in',
        description: 'Acheter un appareil d\'un client',
        href: '/trade-ins',
        icon: '📱',
        minRole: 'seller' as const,
      },
      {
        title: 'Fournisseurs',
        description: 'Gérer les fournisseurs',
        href: '/suppliers',
        icon: '🏭',
        minRole: 'manager' as const,
      },
      {
        title: 'Bons de commande',
        description: 'Commandes fournisseurs',
        href: '/purchase-orders',
        icon: '📋',
        minRole: 'manager' as const,
      },
    ],
  },
  {
    title: 'Gestion',
    items: [
      {
        title: 'Caisse',
        description: 'Ouverture/fermeture, mouvements',
        href: '/cash',
        icon: '🏦',
        minRole: 'seller' as const,
      },
      {
        title: 'Rapports',
        description: 'Analyses et statistiques',
        href: '/reports',
        icon: '📊',
        minRole: 'manager' as const,
      },
      {
        title: 'Commissions',
        description: 'Suivi des commissions vendeurs',
        href: '/employees/commissions',
        icon: '💵',
        minRole: 'manager' as const,
      },
      {
        title: 'Pointeuse',
        description: 'Heures de travail',
        href: '/employees/clock',
        icon: '⏰',
        minRole: 'seller' as const,
      },
      {
        title: 'Paramètres impression',
        description: 'Tickets de caisse et étiquettes',
        href: '/print-settings',
        icon: '🖨️',
        minRole: 'manager' as const,
      },
      {
        title: 'Utilisateurs',
        description: 'Gérer les comptes',
        href: '/users',
        icon: '⚙️',
        minRole: 'superadmin' as const,
      },
    ],
  },
];

const roleLabels: Record<string, string> = { superadmin: 'Super Admin', manager: 'Gérant', seller: 'Vendeur' };

export default function MenuPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Menu</h1>

      {/* User Card */}
      <div className="p-4 bg-gradient-to-r from-[#2AA8DC] to-[#2AA8DC]/80 rounded-2xl text-white mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800/20 flex items-center justify-center text-lg font-bold">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-white/80">{roleLabels[user.role] || user.role} — {user.store?.name}</p>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="space-y-6">
        {menuSections.map((section) => {
          const visibleItems = section.items.filter((item) => hasPermission(user.role, item.minRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {section.title}
              </h2>
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-[#2AA8DC]/30 transition"
                  >
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full mt-8 py-3 text-center text-red-500 text-sm font-medium"
      >
        Se déconnecter
      </button>

      <p className="text-center text-gray-400 text-xs mt-4">
        Corner Mobile v2.0
      </p>
    </div>
  );
}
