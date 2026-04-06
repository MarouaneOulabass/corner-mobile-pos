'use client';

import { useState, useCallback } from 'react';
import { ThermalPrinter, printViaBrowser } from '@/lib/thermal-printer';

type PrintState = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'done' | 'error';

interface ThermalPrintButtonProps {
  receiptData: Uint8Array | null;
  fallbackHTML?: string;
  label?: string;
}

const stateLabels: Record<PrintState, string> = {
  disconnected: 'Connecter imprimante',
  connecting: 'Connexion...',
  connected: 'Imprimer',
  printing: 'Impression...',
  done: 'Imprime !',
  error: 'Erreur — Réessayer',
};

export default function ThermalPrintButton({
  receiptData,
  fallbackHTML,
  label,
}: ThermalPrintButtonProps) {
  const [state, setState] = useState<PrintState>('disconnected');
  const [printer] = useState(() => new ThermalPrinter());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSerialSupported = ThermalPrinter.isSupported();

  const handleClick = useCallback(async () => {
    setErrorMsg(null);

    // If Web Serial not supported, use browser print fallback
    if (!isSerialSupported) {
      if (fallbackHTML) {
        printViaBrowser(fallbackHTML);
      }
      return;
    }

    try {
      if (state === 'disconnected' || state === 'error' || state === 'done') {
        // Connect to printer
        setState('connecting');
        await printer.connect();
        setState('connected');
      } else if (state === 'connected') {
        // Print the receipt
        if (!receiptData) {
          setErrorMsg('Aucune donnee a imprimer');
          return;
        }
        setState('printing');
        await printer.print(receiptData);
        setState('done');

        // Reset to connected after 2 seconds
        setTimeout(() => {
          if (printer.isConnected) {
            setState('connected');
          } else {
            setState('disconnected');
          }
        }, 2000);
      }
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }, [state, printer, receiptData, fallbackHTML, isSerialSupported]);

  const buttonLabel = label || stateLabels[state];
  const isLoading = state === 'connecting' || state === 'printing';
  const isDone = state === 'done';

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm
          transition-all duration-200
          ${isDone
            ? 'bg-green-500 text-white'
            : state === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-[#2AA8DC] text-white hover:bg-[#2490c0]'
          }
          ${isLoading ? 'opacity-70 cursor-wait' : ''}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isDone && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span>
          {!isSerialSupported ? (fallbackHTML ? 'Imprimer (navigateur)' : 'Impression non disponible') : buttonLabel}
        </span>
      </button>
      {errorMsg && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}
    </div>
  );
}
