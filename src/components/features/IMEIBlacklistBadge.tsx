'use client';

import { useState, useEffect, useCallback } from 'react';

interface IMEIBlacklistBadgeProps {
  imei: string;
  autoCheck?: boolean;
}

type CheckStatus = 'unchecked' | 'loading' | 'clean' | 'blacklisted' | 'unavailable';

export default function IMEIBlacklistBadge({ imei, autoCheck = false }: IMEIBlacklistBadgeProps) {
  const [status, setStatus] = useState<CheckStatus>('unchecked');
  const [details, setDetails] = useState<string>('');

  const runCheck = useCallback(async () => {
    if (!imei || imei.length !== 15) return;

    setStatus('loading');
    setDetails('');

    try {
      const res = await fetch(`/api/imei-check?imei=${encodeURIComponent(imei)}`);
      const data = await res.json();

      if (!res.ok) {
        setStatus('unavailable');
        setDetails(data.error || 'Erreur de vérification');
        return;
      }

      if (data.source === 'unavailable') {
        setStatus('unavailable');
        setDetails(data.details || 'Service indisponible');
      } else if (data.clean) {
        setStatus('clean');
        setDetails(data.details || 'IMEI propre');
      } else {
        setStatus('blacklisted');
        setDetails(data.details || 'IMEI sur liste noire');
      }
    } catch {
      setStatus('unavailable');
      setDetails('Erreur de connexion');
    }
  }, [imei]);

  useEffect(() => {
    if (autoCheck && imei && imei.length === 15) {
      runCheck();
    }
  }, [autoCheck, imei, runCheck]);

  const badgeConfig: Record<CheckStatus, { bg: string; text: string; icon: string; label: string }> = {
    unchecked: {
      bg: 'bg-gray-100',
      text: 'text-gray-500',
      icon: '?',
      label: 'Non vérifié',
    },
    loading: {
      bg: 'bg-gray-100',
      text: 'text-gray-500',
      icon: '',
      label: 'Vérification...',
    },
    clean: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: '\u2713',
      label: 'Propre',
    },
    blacklisted: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: '\u2717',
      label: 'Liste noire',
    },
    unavailable: {
      bg: 'bg-gray-100',
      text: 'text-gray-500',
      icon: '?',
      label: 'Indisponible',
    },
  };

  const config = badgeConfig[status];

  return (
    <button
      onClick={runCheck}
      disabled={status === 'loading' || !imei}
      title={details || config.label}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${config.bg} ${config.text} ${status !== 'loading' ? 'hover:opacity-80 cursor-pointer' : 'cursor-wait'} disabled:opacity-50`}
    >
      {status === 'loading' ? (
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <span className="text-sm font-bold">{config.icon}</span>
      )}
      <span>{config.label}</span>
    </button>
  );
}
