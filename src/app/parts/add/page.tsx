'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PartCategory, Supplier } from '@/types';
import { partCategoryLabels, formatPrice } from '@/lib/utils';

const CATEGORIES: PartCategory[] = [
  'screen', 'battery', 'charging_port', 'camera', 'speaker',
  'microphone', 'button', 'housing', 'motherboard', 'other',
];

const COMMON_BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Huawei', 'Oppo', 'Realme', 'Tecno', 'Infinix', 'Nokia'];

export default function AddPartPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [form, setForm] = useState({
    name: '',
    category: 'screen' as PartCategory,
    compatible_brands: [] as string[],
    compatible_models: [] as string[],
    sku: '',
    quantity: 0,
    min_quantity: 5,
    purchase_price: 0,
    selling_price: 0,
    supplier_id: '',
    bin_location: '',
    notes: '',
  });

  const [brandInput, setBrandInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Fetch suppliers on mount
  useEffect(() => {
    fetch('/api/suppliers')
      .then((r) => r.json())
      .then((data) => setSuppliers(data.suppliers || []))
      .catch(() => {});
  }, []);

  // Fetch part data if editing
  useEffect(() => {
    if (editId) {
      setLoadingEdit(true);
      fetch(`/api/parts/${editId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.id) {
            setForm({
              name: data.name || '',
              category: data.category || 'screen',
              compatible_brands: data.compatible_brands || [],
              compatible_models: data.compatible_models || [],
              sku: data.sku || '',
              quantity: data.quantity || 0,
              min_quantity: data.min_quantity || 0,
              purchase_price: data.purchase_price || 0,
              selling_price: data.selling_price || 0,
              supplier_id: data.supplier_id || '',
              bin_location: data.bin_location || '',
              notes: data.notes || '',
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingEdit(false));
    }
  }, [editId]);

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const addBrand = () => {
    const val = brandInput.trim();
    if (val && !form.compatible_brands.includes(val)) {
      updateField('compatible_brands', [...form.compatible_brands, val]);
    }
    setBrandInput('');
  };

  const removeBrand = (brand: string) => {
    updateField('compatible_brands', form.compatible_brands.filter((b) => b !== brand));
  };

  const addModel = () => {
    const val = modelInput.trim();
    if (val && !form.compatible_models.includes(val)) {
      updateField('compatible_models', [...form.compatible_models, val]);
    }
    setModelInput('');
  };

  const removeModel = (model: string) => {
    updateField('compatible_models', form.compatible_models.filter((m) => m !== model));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nom requis';
    if (form.quantity < 0) errs.quantity = 'Quantité invalide';
    if (form.purchase_price < 0) errs.purchase_price = 'Prix invalide';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const url = editId ? `/api/parts/${editId}` : '/api/parts';
      const method = editId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          store_id: user?.store_id,
          supplier_id: form.supplier_id || null,
        }),
      });

      if (res.ok) {
        router.push('/parts');
      } else {
        const data = await res.json();
        setErrors({ submit: data.error || 'Erreur lors de l\'enregistrement' });
      }
    } catch {
      setErrors({ submit: 'Erreur de connexion' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AA8DC]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {editId ? 'Modifier la pièce' : 'Ajouter une pièce'}
          </h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom de la pièce *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="ex: Écran iPhone 13 Pro"
            className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catégorie *
          </label>
          <select
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none bg-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {partCategoryLabels[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* Compatible Brands */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Marques compatibles
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand(); } }}
              placeholder="Ajouter une marque"
              list="brand-suggestions"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none"
            />
            <datalist id="brand-suggestions">
              {COMMON_BRANDS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={addBrand}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200"
            >
              +
            </button>
          </div>
          {form.compatible_brands.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.compatible_brands.map((brand) => (
                <span
                  key={brand}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                >
                  {brand}
                  <button type="button" onClick={() => removeBrand(brand)} className="hover:text-red-500">
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Compatible Models */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Modèles compatibles
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModel(); } }}
              placeholder="ex: iPhone 13 Pro"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={addModel}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200"
            >
              +
            </button>
          </div>
          {form.compatible_models.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.compatible_models.map((model) => (
                <span
                  key={model}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full"
                >
                  {model}
                  <button type="button" onClick={() => removeModel(model)} className="hover:text-red-500">
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* SKU */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU
          </label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => updateField('sku', e.target.value)}
            placeholder="Référence fournisseur"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none"
          />
        </div>

        {/* Quantity + Min Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité *
            </label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)}
              min={0}
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none ${
                errors.quantity ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité min.
            </label>
            <input
              type="number"
              value={form.min_quantity}
              onChange={(e) => updateField('min_quantity', parseInt(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix d&apos;achat (MAD) *
            </label>
            <input
              type="number"
              value={form.purchase_price}
              onChange={(e) => updateField('purchase_price', parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none ${
                errors.purchase_price ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.purchase_price && <p className="text-xs text-red-500 mt-1">{errors.purchase_price}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix de vente (MAD)
            </label>
            <input
              type="number"
              value={form.selling_price}
              onChange={(e) => updateField('selling_price', parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Margin indicator */}
        {form.selling_price > 0 && form.purchase_price > 0 && (
          <div className={`text-xs px-3 py-1.5 rounded-lg ${
            form.selling_price >= form.purchase_price
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}>
            Marge : {formatPrice(form.selling_price - form.purchase_price)} (
            {((form.selling_price - form.purchase_price) / form.purchase_price * 100).toFixed(0)}%)
          </div>
        )}

        {/* Supplier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fournisseur
          </label>
          <select
            value={form.supplier_id}
            onChange={(e) => updateField('supplier_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none bg-white"
          >
            <option value="">— Aucun —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Bin Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Emplacement (bac/étagère)
          </label>
          <input
            type="text"
            value={form.bin_location}
            onChange={(e) => updateField('bin_location', e.target.value)}
            placeholder="ex: A3-12"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            rows={3}
            placeholder="Notes internes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent outline-none resize-none"
          />
        </div>

        {/* Error */}
        {errors.submit && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl">
            {errors.submit}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-[#2AA8DC] text-white font-medium rounded-xl hover:bg-[#2490c0] transition-colors disabled:opacity-50"
        >
          {submitting
            ? 'Enregistrement...'
            : editId
              ? 'Mettre à jour'
              : 'Ajouter la pièce'}
        </button>
      </form>
    </div>
  );
}
