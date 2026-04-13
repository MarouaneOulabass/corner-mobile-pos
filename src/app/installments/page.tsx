'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { InstallmentPlan, InstallmentStatus } from '@/types';
import {
  formatPrice,
  formatDate,
  installmentStatusLabels,
  installmentStatusColors,
  paymentMethodLabels,
} from '@/lib/utils';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'Tous', value: '' },
  { label: 'En cours', value: 'active' },
  { label: 'Termines', value: 'completed' },
  { label: 'Impayes', value: 'defaulted' },
];

export default function InstallmentsPage() {
  const { user } = useAuth();

  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Payment modal
  const [payingPlan, setPayingPlan] = useState<InstallmentPlan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'virement'>('cash');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchPlans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/installments?${params}`);
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setPlans(data.plans || []);
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleRecordPayment = async () => {
    if (!payingPlan) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Montant invalide');
      return;
    }

    setSubmittingPayment(true);
    setError(null);
    try {
      const res = await fetch(`/api/installments/${payingPlan.id}?action=pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, payment_method: paymentMethod }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur');
        return;
      }
      setPayingPlan(null);
      setPaymentAmount('');
      await fetchPlans();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const isOverdue = (plan: InstallmentPlan) => {
    if (plan.status !== 'active' || !plan.next_due_date) return false;
    return new Date(plan.next_due_date) < new Date();
  };

  const paidPercentage = (plan: InstallmentPlan) => {
    if (plan.total_amount === 0) return 100;
    const paid = plan.total_amount - plan.remaining_amount;
    return Math.round((paid / plan.total_amount) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Paiements echelonnes</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
            <button onClick={() => setError(null)} className="ms-2 font-bold">&times;</button>
          </div>
        )}

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-[#2AA8DC] text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Payment modal */}
        {payingPlan && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 space-y-3 border-2 border-[#2AA8DC]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Enregistrer un paiement</h3>
              <button onClick={() => setPayingPlan(null)} className="text-gray-400 text-lg">&times;</button>
            </div>
            <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 text-sm">
              <p className="text-gray-500 dark:text-gray-400">Client: <span className="font-medium text-gray-900 dark:text-white">{payingPlan.customer?.name || '-'}</span></p>
              <p className="text-gray-500 dark:text-gray-400">Restant: <span className="font-medium text-gray-900 dark:text-white">{formatPrice(payingPlan.remaining_amount)}</span></p>
              <p className="text-gray-500 dark:text-gray-400">Echeance: <span className="font-medium text-gray-900 dark:text-white">{formatPrice(payingPlan.installment_amount)}</span></p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Montant (MAD)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={payingPlan.installment_amount.toString()}
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Methode</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'virement')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="cash">Especes</option>
                <option value="card">Carte</option>
                <option value="virement">Virement</option>
              </select>
            </div>

            <button
              onClick={handleRecordPayment}
              disabled={submittingPayment}
              className="w-full bg-[#2AA8DC] text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {submittingPayment ? 'Enregistrement...' : 'Confirmer le paiement'}
            </button>
          </div>
        )}

        {/* Plans list */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AA8DC] mx-auto"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucun plan de paiement
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 ${isOverdue(plan) ? 'border-l-4 border-red-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{plan.customer?.name || 'Client'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{plan.customer?.phone || ''}</p>
                  </div>
                  <span className={`${installmentStatusColors[plan.status as InstallmentStatus] || 'bg-gray-50 dark:bg-slate-9000'} text-white text-xs font-medium px-2 py-1 rounded-full`}>
                    {installmentStatusLabels[plan.status] || plan.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Total</p>
                    <p className="font-medium">{formatPrice(plan.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Paye</p>
                    <p className="font-medium text-green-600">{formatPrice(plan.total_amount - plan.remaining_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Restant</p>
                    <p className="font-medium text-orange-600">{formatPrice(plan.remaining_amount)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2 mb-2">
                  <div
                    className="bg-[#2AA8DC] h-2 rounded-full transition-all"
                    style={{ width: `${paidPercentage(plan)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span>{paidPercentage(plan)}% paye</span>
                  {plan.next_due_date && plan.status === 'active' && (
                    <span className={isOverdue(plan) ? 'text-red-600 font-semibold' : ''}>
                      {isOverdue(plan) ? 'EN RETARD - ' : 'Prochaine: '}
                      {formatDate(plan.next_due_date)}
                    </span>
                  )}
                </div>

                {plan.status === 'active' && (
                  <button
                    onClick={() => {
                      setPayingPlan(plan);
                      setPaymentAmount(plan.installment_amount.toString());
                    }}
                    className="w-full bg-[#5BBF3E] text-white py-2 rounded-lg text-sm font-medium"
                  >
                    Enregistrer paiement
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
