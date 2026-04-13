'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ReceiptTemplate, Store } from '@/types';
import { buildReceiptHTML } from '@/lib/receipt-builder';

const DEFAULT_TEMPLATE: Omit<ReceiptTemplate, 'id' | 'store_id' | 'updated_at'> = {
  header_text: '',
  footer_text: 'Merci de votre visite !',
  show_logo: false,
  show_store_address: true,
  show_seller_name: true,
  show_qr_code: false,
  paper_width: '80mm',
  font_size: 'medium',
};

// Mock sale for preview
const MOCK_SALE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  store_id: 'store-1',
  seller_id: 'seller-1',
  total: 3200,
  discount_amount: 200,
  discount_type: 'flat' as const,
  payment_method: 'cash' as const,
  created_at: new Date().toISOString(),
  seller: { id: 'seller-1', email: 'vendeur@corner.ma', name: 'Ahmed B.', role: 'seller' as const, store_id: 'store-1', created_at: '' },
  items: [
    {
      id: 'item-1',
      sale_id: 'a1b2c3d4',
      product_id: 'prod-1',
      quantity: 1,
      unit_price: 3200,
      original_price: 3500,
      product: {
        id: 'prod-1', product_type: 'phone' as const, brand: 'Apple', model: 'iPhone 13',
        storage: '128GB', color: 'Bleu', condition: 'good' as const,
        purchase_price: 2500, selling_price: 3200, status: 'sold' as const,
        store_id: 'store-1', created_by: 'seller-1', created_at: '', updated_at: '',
      },
    },
    {
      id: 'item-2',
      sale_id: 'a1b2c3d4',
      product_id: 'prod-2',
      quantity: 2,
      unit_price: 100,
      original_price: 120,
      product: {
        id: 'prod-2', product_type: 'accessory' as const, brand: 'Generic', model: 'Coque iPhone 13',
        condition: 'new' as const,
        purchase_price: 30, selling_price: 100, status: 'sold' as const,
        store_id: 'store-1', created_by: 'seller-1', created_at: '', updated_at: '',
      },
    },
  ],
};

export default function PrintSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [template, setTemplate] = useState<Omit<ReceiptTemplate, 'id' | 'store_id' | 'updated_at'>>(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brotherIp, setBrotherIp] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  // Restrict to manager+
  useEffect(() => {
    if (user && !['superadmin', 'manager'].includes(user.role)) {
      router.push('/');
    }
  }, [user, router]);

  // Load existing template
  useEffect(() => {
    async function loadTemplate() {
      try {
        const res = await fetch('/api/receipt-templates');
        if (res.ok) {
          const data = await res.json();
          if (data.template) {
            const { id, store_id, updated_at, ...rest } = data.template;
            setTemplate({ ...DEFAULT_TEMPLATE, ...rest });
          }
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadTemplate();
    }
  }, [user]);

  // Load Brother IP from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBrotherIp(localStorage.getItem('brother_printer_ip') || '');
    }
  }, []);

  // Generate preview whenever template changes
  useEffect(() => {
    const store: Store = {
      id: user?.store_id || 'store-1',
      name: user?.store?.name || 'Corner Mobile',
      location: user?.store?.location || 'Centre Commercial, Rabat',
      created_at: '',
    };

    const fullTemplate: ReceiptTemplate = {
      ...template,
      id: 'preview',
      store_id: store.id,
      updated_at: '',
    };

    const html = buildReceiptHTML(MOCK_SALE, fullTemplate, store);
    setPreviewHtml(html);
  }, [template, user]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setError(null);
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch('/api/receipt-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la sauvegarde');
        return;
      }

      // Save Brother IP
      if (brotherIp.trim()) {
        localStorage.setItem('brother_printer_ip', brotherIp.trim());
      } else {
        localStorage.removeItem('brother_printer_ip');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  }, [user, template, brotherIp]);

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded w-48" />
          <div className="h-40 bg-gray-200 dark:bg-slate-600 rounded-xl" />
          <div className="h-40 bg-gray-200 dark:bg-slate-600 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-24 space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ms-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Parametres d&apos;impression</h1>
      </div>

      {/* Receipt Template Section */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 p-4 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Modele de recu</h2>

        {/* Header text */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">En-tete</label>
          <input
            type="text"
            value={template.header_text}
            onChange={(e) => setTemplate({ ...template, header_text: e.target.value })}
            placeholder="Nom du magasin (par defaut)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
          />
        </div>

        {/* Footer text */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Pied de page</label>
          <input
            type="text"
            value={template.footer_text}
            onChange={(e) => setTemplate({ ...template, footer_text: e.target.value })}
            placeholder="Merci de votre visite !"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
          />
        </div>

        {/* Paper width */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Largeur papier</label>
          <div className="flex gap-2">
            {(['58mm', '80mm'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setTemplate({ ...template, paper_width: w })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  template.paper_width === w
                    ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Taille police</label>
          <div className="flex gap-2">
            {([
              { value: 'small', label: 'Petit' },
              { value: 'medium', label: 'Moyen' },
              { value: 'large', label: 'Grand' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTemplate({ ...template, font_size: opt.value })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  template.font_size === opt.value
                    ? 'bg-[#2AA8DC] text-white border-[#2AA8DC]'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle options */}
        <div className="space-y-3">
          <ToggleOption
            label="Afficher adresse du magasin"
            checked={template.show_store_address}
            onChange={(v) => setTemplate({ ...template, show_store_address: v })}
          />
          <ToggleOption
            label="Afficher nom du vendeur"
            checked={template.show_seller_name}
            onChange={(v) => setTemplate({ ...template, show_seller_name: v })}
          />
          <ToggleOption
            label="Afficher QR code"
            checked={template.show_qr_code}
            onChange={(v) => setTemplate({ ...template, show_qr_code: v })}
          />
          <ToggleOption
            label="Afficher logo"
            checked={template.show_logo}
            onChange={(v) => setTemplate({ ...template, show_logo: v })}
          />
        </div>
      </section>

      {/* Printer Configuration */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 p-4 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Imprimante Brother</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Configurez l&apos;adresse IP de votre imprimante Brother QL-820NWBc pour l&apos;impression
          directe des etiquettes. Laissez vide pour utiliser l&apos;impression navigateur.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Adresse IP</label>
          <input
            type="text"
            value={brotherIp}
            onChange={(e) => setBrotherIp(e.target.value)}
            placeholder="192.168.1.100"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
          />
        </div>
      </section>

      {/* Live Preview */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 p-4 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Apercu en direct</h2>
        <div className="overflow-auto border border-gray-100 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 p-4">
          <div className="flex justify-center">
            <div
              className="bg-white dark:bg-slate-800 shadow-sm"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Save button */}
      <div className="fixed bottom-20 left-0 right-0 px-4 max-w-lg mx-auto">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-[#2AA8DC] text-white hover:bg-[#2490c0]'
          } ${saving ? 'opacity-70 cursor-wait' : ''}`}
        >
          {saving ? 'Enregistrement...' : saved ? 'Enregistre !' : 'Enregistrer les parametres'}
        </button>
      </div>
    </div>
  );
}

/** Toggle switch component */
function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          checked ? 'bg-[#2AA8DC]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
