'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TradeIn, ChecklistTemplate } from '@/types';
import { formatPrice } from '@/lib/utils';
import RepairChecklist from '@/components/features/RepairChecklist';
import PhotoCapture from '@/components/features/PhotoCapture';
import RefurbishmentPipeline from '@/components/features/RefurbishmentPipeline';

const CONDITION_LABELS: Record<string, string> = {
  new: 'Neuf',
  like_new: 'Comme neuf',
  good: 'Bon',
  fair: 'Correct',
  poor: 'Mauvais',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Accepte',
  rejected: 'Refuse',
  in_refurbishment: 'Remise en etat',
  listed: 'En vente',
  sold: 'Vendu',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  in_refurbishment: 'bg-purple-100 text-purple-800',
  listed: 'bg-green-100 text-green-800',
  sold: 'bg-gray-100 text-gray-800',
};

export default function TradeInDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [tradeIn, setTradeIn] = useState<TradeIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Checklist state
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [checklistValues, setChecklistValues] = useState<Record<string, string>>({});

  // Photos state
  const [prePhotos, setPrePhotos] = useState<string[]>([]);
  const [postPhotos, setPostPhotos] = useState<string[]>([]);

  // Notes
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const fetchTradeIn = useCallback(async () => {
    try {
      const res = await fetch(`/api/trade-ins/${id}`);
      if (!res.ok) {
        setError('Rachat introuvable');
        return;
      }
      const data = await res.json();
      setTradeIn(data);
      setNotes(data.notes || '');
      // Use pre_photos/post_photos if available on trade-in or init empty
      setPrePhotos(data.pre_photos || []);
      setPostPhotos(data.post_photos || []);
      if (data.checklist_values) {
        setChecklistValues(data.checklist_values);
      }
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/checklists/templates');
      if (res.ok) {
        const data = await res.json();
        const list = data.templates || [];
        setTemplates(list);
        if (list.length > 0) setSelectedTemplate(list[0]);
      }
    } catch {
      // Templates are optional
    }
  }, []);

  useEffect(() => {
    fetchTradeIn();
    fetchTemplates();
  }, [fetchTradeIn, fetchTemplates]);

  const handleStatusChange = async (newStatus: string) => {
    if (!tradeIn || actionLoading) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trade-ins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors du changement de statut');
        return;
      }

      const updated = await res.json();
      setTradeIn(updated);
    } catch {
      setError('Erreur de connexion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = () => handleStatusChange('accepted');
  const handleReject = () => handleStatusChange('rejected');

  const handlePhotoCapture = (type: 'pre' | 'post') => (dataUrl: string) => {
    if (type === 'pre') {
      setPrePhotos((prev) => [...prev, dataUrl]);
    } else {
      setPostPhotos((prev) => [...prev, dataUrl]);
    }
  };

  const handlePhotoDelete = (type: 'pre' | 'post') => (index: number) => {
    if (type === 'pre') {
      setPrePhotos((prev) => prev.filter((_, i) => i !== index));
    } else {
      setPostPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveNotes = async () => {
    if (!tradeIn) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/trade-ins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch {
      setError('Erreur de sauvegarde');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AA8DC]" />
      </div>
    );
  }

  if (!tradeIn) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-12">
          <p className="text-gray-500">{error || 'Rachat introuvable'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-[#2AA8DC] font-medium text-sm"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const isPending = tradeIn.status === 'pending';
  const showPipeline = ['accepted', 'in_refurbishment', 'listed', 'sold'].includes(tradeIn.status);
  const isReadOnly = tradeIn.status === 'sold' || tradeIn.status === 'rejected';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            &larr;
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-base truncate">
              {tradeIn.device_brand} {tradeIn.device_model}
            </h1>
            <p className="text-xs text-gray-500">Rachat #{id.slice(0, 8)}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[tradeIn.status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[tradeIn.status] || tradeIn.status}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-xl">
            {error}
          </div>
        )}

        {/* Device info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Appareil</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Marque</p>
              <p className="font-medium">{tradeIn.device_brand}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Modele</p>
              <p className="font-medium">{tradeIn.device_model}</p>
            </div>
            {tradeIn.imei && (
              <div>
                <p className="text-gray-500 text-xs">IMEI</p>
                <p className="font-mono text-xs">{tradeIn.imei}</p>
              </div>
            )}
            {tradeIn.storage && (
              <div>
                <p className="text-gray-500 text-xs">Stockage</p>
                <p className="font-medium">{tradeIn.storage}</p>
              </div>
            )}
            {tradeIn.color && (
              <div>
                <p className="text-gray-500 text-xs">Couleur</p>
                <p className="font-medium">{tradeIn.color}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 text-xs">Etat</p>
              <p className="font-medium">{CONDITION_LABELS[tradeIn.condition] || tradeIn.condition}</p>
            </div>
          </div>
        </div>

        {/* Customer info */}
        {tradeIn.customer && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-2">Client</h2>
            <p className="text-sm font-medium">{tradeIn.customer.name}</p>
            <p className="text-sm text-gray-500">{tradeIn.customer.phone}</p>
          </div>
        )}

        {/* Price */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 text-sm mb-2">Prix</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Prix propose</p>
              <p className="text-xl font-bold text-[#2AA8DC]">{formatPrice(tradeIn.offered_price)}</p>
            </div>
            {tradeIn.ai_suggested_price != null && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Suggestion IA</p>
                <p className="text-sm font-medium text-gray-600">{formatPrice(tradeIn.ai_suggested_price)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending actions */}
        {isPending && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm">Actions</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAccept}
                disabled={actionLoading}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: '#5BBF3E' }}
              >
                {actionLoading ? '...' : 'Accepter'}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Refuser'}
              </button>
            </div>
          </div>
        )}

        {/* Refurbishment Pipeline */}
        {showPipeline && (
          <RefurbishmentPipeline
            tradeIn={tradeIn}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* Device condition checklist */}
        {selectedTemplate && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900 text-sm">Checklist etat appareil</h2>
              {templates.length > 1 && (
                <select
                  value={selectedTemplate.id}
                  onChange={(e) => {
                    const t = templates.find((tpl) => tpl.id === e.target.value);
                    if (t) setSelectedTemplate(t);
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
            <RepairChecklist
              template={selectedTemplate}
              values={checklistValues}
              onChange={setChecklistValues}
              readOnly={isReadOnly}
            />
          </div>
        )}

        {/* Photos: before refurbishment */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Photos avant remise en etat</h2>
          <PhotoCapture
            photos={prePhotos}
            onCapture={handlePhotoCapture('pre')}
            onDelete={handlePhotoDelete('pre')}
            maxPhotos={5}
            readOnly={isReadOnly}
          />
        </div>

        {/* Photos: after refurbishment */}
        {showPipeline && tradeIn.status !== 'accepted' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Photos apres remise en etat</h2>
            <PhotoCapture
              photos={postPhotos}
              onCapture={handlePhotoCapture('post')}
              onDelete={handlePhotoDelete('post')}
              maxPhotos={5}
              readOnly={isReadOnly}
            />
          </div>
        )}

        {/* Linked product */}
        {tradeIn.product && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-2">Produit en stock</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tradeIn.product.brand} {tradeIn.product.model}</p>
                {tradeIn.product.imei && (
                  <p className="text-xs text-gray-500 font-mono">{tradeIn.product.imei}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[#2AA8DC]">
                  {formatPrice(tradeIn.product.selling_price)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  tradeIn.product.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                  tradeIn.product.status === 'sold' ? 'bg-gray-100 text-gray-600' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {tradeIn.product.status === 'in_stock' ? 'En stock' :
                   tradeIn.product.status === 'sold' ? 'Vendu' : tradeIn.product.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 text-sm mb-2">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesSaved(false);
            }}
            disabled={isReadOnly}
            rows={3}
            placeholder="Ajouter des notes..."
            className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none disabled:opacity-60 disabled:bg-gray-50"
          />
          {!isReadOnly && (
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={actionLoading}
                className="text-sm font-medium text-[#2AA8DC] disabled:opacity-50"
              >
                Sauvegarder
              </button>
              {notesSaved && (
                <span className="text-xs text-green-600">Sauvegarde !</span>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="text-xs text-gray-400 text-center space-y-0.5 pb-4">
          <p>Cree le {new Date(tradeIn.created_at).toLocaleDateString('fr-FR')}</p>
          {tradeIn.processor && <p>Par {tradeIn.processor.name}</p>}
        </div>
      </div>
    </div>
  );
}
