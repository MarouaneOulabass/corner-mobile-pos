'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Customer, ProductCondition } from '@/types';
import { supabase } from '@/lib/supabase';
import { conditionLabels, formatPrice, validateIMEI } from '@/lib/utils';

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Oppo', 'OnePlus', 'Google', 'Sony', 'Autre'];
const STORAGE_OPTIONS = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];
const CONDITIONS: { key: ProductCondition; label: string }[] = [
  { key: 'like_new', label: 'Comme neuf' },
  { key: 'good', label: 'Bon etat' },
  { key: 'fair', label: 'Etat correct' },
  { key: 'poor', label: 'Mauvais etat' },
];

export default function NewTradeInPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Device
  const [deviceBrand, setDeviceBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [storage, setStorage] = useState('');
  const [color, setColor] = useState('');
  const [imei, setImei] = useState('');
  const [condition, setCondition] = useState<ProductCondition | ''>('');

  // Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Price
  const [offeredPrice, setOfferedPrice] = useState('');
  const [aiSuggestedPrice, setAiSuggestedPrice] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // --- Customer search ---
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    setSearchingCustomers(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`phone.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(5);
    setCustomers(data || []);
    setSearchingCustomers(false);
  }, []);

  // --- AI Price Suggestion ---
  const requestAiPrice = async () => {
    const brand = deviceBrand === 'Autre' ? customBrand : deviceBrand;
    if (!brand || !deviceModel || !condition) return;

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'price_suggestion',
          data: {
            brand,
            model: deviceModel,
            storage: storage || undefined,
            condition,
            context: 'trade_in',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Extract price from AI response
        const priceMatch = data.response?.match(/(\d[\d\s]*\d)\s*MAD/);
        if (priceMatch) {
          const suggestedPrice = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
          setAiSuggestedPrice(suggestedPrice);
          if (!offeredPrice) {
            setOfferedPrice(suggestedPrice.toString());
          }
        }
      }
    } catch {
      // Silently fail
    } finally {
      setAiLoading(false);
    }
  };

  // --- Submit ---
  const handleSubmit = async () => {
    const brand = deviceBrand === 'Autre' ? customBrand : deviceBrand;

    if (!brand.trim()) {
      setError('La marque est requise');
      return;
    }
    if (!deviceModel.trim()) {
      setError('Le modele est requis');
      return;
    }
    if (!condition) {
      setError('L\'etat est requis');
      return;
    }
    if (!offeredPrice || parseFloat(offeredPrice) < 0) {
      setError('Le prix propose est requis');
      return;
    }
    if (imei && !validateIMEI(imei)) {
      setError('IMEI invalide (15 chiffres, validation Luhn)');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        device_brand: brand.trim(),
        device_model: deviceModel.trim(),
        condition,
        offered_price: parseFloat(offeredPrice),
        storage: storage || undefined,
        color: color || undefined,
        imei: imei || undefined,
        notes: notes || undefined,
        ai_suggested_price: aiSuggestedPrice || undefined,
      };

      // Customer
      if (selectedCustomer) {
        payload.customer_id = selectedCustomer.id;
      } else if (newCustomerPhone) {
        payload.customer_phone = newCustomerPhone;
        payload.customer_name = newCustomerName || 'Client';
      }

      const res = await fetch('/api/trade-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/trade-ins');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la creation');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Nouveau rachat</h1>

      {/* Device info */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Appareil</h2>

        {/* Brand */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Marque *</label>
          <div className="flex flex-wrap gap-2">
            {BRANDS.map((b) => (
              <button
                key={b}
                onClick={() => setDeviceBrand(b)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
                  deviceBrand === b
                    ? 'border-[#2AA8DC] bg-[#2AA8DC]/10 text-[#2AA8DC]'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          {deviceBrand === 'Autre' && (
            <input
              type="text"
              value={customBrand}
              onChange={(e) => setCustomBrand(e.target.value)}
              placeholder="Nom de la marque"
              className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          )}
        </div>

        {/* Model */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Modele *</label>
          <input
            type="text"
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
            placeholder="ex: iPhone 13, Galaxy A54..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        {/* Storage */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Stockage</label>
          <div className="flex flex-wrap gap-2">
            {STORAGE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStorage(storage === s ? '' : s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
                  storage === s
                    ? 'border-[#2AA8DC] bg-[#2AA8DC]/10 text-[#2AA8DC]'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Couleur</label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="ex: Noir, Bleu..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        {/* IMEI */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">IMEI</label>
          <input
            type="text"
            value={imei}
            onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
            placeholder="15 chiffres"
            maxLength={15}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
          />
          {imei.length === 15 && !validateIMEI(imei) && (
            <p className="text-xs text-red-500 mt-1">IMEI invalide</p>
          )}
          {imei.length === 15 && validateIMEI(imei) && (
            <p className="text-xs text-green-500 mt-1">IMEI valide</p>
          )}
        </div>

        {/* Condition */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Etat *</label>
          <div className="grid grid-cols-2 gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCondition(c.key)}
                className={`py-2 text-xs font-medium rounded-lg border ${
                  condition === c.key
                    ? 'border-[#2AA8DC] bg-[#2AA8DC]/10 text-[#2AA8DC]'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Client</h2>

        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedCustomer.name}</p>
              <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
            </div>
            <button
              onClick={() => setSelectedCustomer(null)}
              className="text-xs text-red-500"
            >
              Changer
            </button>
          </div>
        ) : showNewCustomer ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Nom du client"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="tel"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="Telephone"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={() => setShowNewCustomer(false)}
              className="text-xs text-gray-500"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                searchCustomers(e.target.value);
              }}
              placeholder="Rechercher par nom ou telephone..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            {searchingCustomers && (
              <p className="text-xs text-gray-400">Recherche...</p>
            )}
            {customers.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch('');
                      setCustomers([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-gray-400 ml-2">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowNewCustomer(true)}
              className="text-xs text-[#2AA8DC] font-medium"
            >
              + Nouveau client
            </button>
          </div>
        )}
      </div>

      {/* Price */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Prix</h2>

        {/* AI suggestion */}
        <button
          onClick={requestAiPrice}
          disabled={aiLoading || !deviceBrand || !deviceModel || !condition}
          className="w-full py-2 text-sm font-medium border border-[#2AA8DC] text-[#2AA8DC] rounded-lg disabled:opacity-50"
        >
          {aiLoading ? 'IA en cours...' : 'Suggestion de prix IA'}
        </button>

        {aiSuggestedPrice !== null && (
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Prix suggere par l&apos;IA</p>
            <p className="text-lg font-bold text-[#2AA8DC]">{formatPrice(aiSuggestedPrice)}</p>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Prix propose au client (MAD) *</label>
          <input
            type="number"
            value={offeredPrice}
            onChange={(e) => setOfferedPrice(e.target.value)}
            placeholder="0"
            min={0}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-lg font-bold"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes supplementaires..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 bg-[#2AA8DC] text-white text-sm font-medium rounded-xl disabled:opacity-50"
      >
        {submitting ? 'Creation...' : 'Creer le rachat'}
      </button>
    </div>
  );
}
