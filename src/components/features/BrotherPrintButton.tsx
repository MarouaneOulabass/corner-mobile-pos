'use client';

import { useState, useCallback } from 'react';
import { BrotherPrinter } from '@/lib/brother-printer';
import { printViaBrowser } from '@/lib/thermal-printer';

type PrintState = 'idle' | 'printing' | 'done' | 'error';

interface BrotherPrintButtonProps {
  labelHTML: string;
  label?: string;
  copies?: number;
}

export default function BrotherPrintButton({
  labelHTML,
  label = 'Imprimer etiquette',
  copies = 1,
}: BrotherPrintButtonProps) {
  const [state, setState] = useState<PrintState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [printerIp, setPrinterIp] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('brother_printer_ip') || '';
    }
    return '';
  });

  const handleSaveIp = useCallback(() => {
    if (printerIp.trim()) {
      localStorage.setItem('brother_printer_ip', printerIp.trim());
    } else {
      localStorage.removeItem('brother_printer_ip');
    }
    setShowConfig(false);
  }, [printerIp]);

  const handlePrint = useCallback(async () => {
    setErrorMsg(null);

    const savedIp = typeof window !== 'undefined' ? localStorage.getItem('brother_printer_ip') : null;

    if (!savedIp) {
      // No printer configured — use browser fallback
      printViaBrowser(labelHTML);
      setState('done');
      setTimeout(() => setState('idle'), 2000);
      return;
    }

    try {
      setState('printing');
      const printer = new BrotherPrinter(savedIp);

      // Convert HTML to a printable blob (canvas approach)
      const blob = await htmlToImageBlob(labelHTML);
      if (!blob) {
        // Fallback to browser print
        printViaBrowser(labelHTML);
        setState('done');
        setTimeout(() => setState('idle'), 2000);
        return;
      }

      const result = await printer.printLabel(blob, { copies });
      if (result.success) {
        setState('done');
        setTimeout(() => setState('idle'), 2000);
      } else {
        // Fallback to browser print
        printViaBrowser(labelHTML);
        setState('done');
        setTimeout(() => setState('idle'), 2000);
      }
    } catch {
      // Fallback to browser print
      printViaBrowser(labelHTML);
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [labelHTML, copies]);

  const isLoading = state === 'printing';
  const isDone = state === 'done';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={handlePrint}
          disabled={isLoading}
          className={`
            flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm
            transition-all duration-200
            ${isDone
              ? 'bg-green-500 text-white'
              : state === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-[#2AA8DC] text-white hover:bg-[#2490c0]'
            }
            ${isLoading ? 'opacity-70 cursor-wait' : ''}
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
          <span>{isDone ? 'Imprime !' : isLoading ? 'Impression...' : label}</span>
        </button>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className="px-3 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm"
          title="Configurer imprimante Brother"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {errorMsg && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}

      {showConfig && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Adresse IP imprimante Brother
            </label>
            <input
              type="text"
              value={printerIp}
              onChange={(e) => setPrinterIp(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2AA8DC] focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              Laissez vide pour imprimer via le navigateur
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveIp}
              className="flex-1 px-3 py-2 bg-[#2AA8DC] text-white rounded-lg text-sm font-medium hover:bg-[#2490c0]"
            >
              Enregistrer
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Convert HTML string to an image Blob using an offscreen canvas.
 * Returns null if conversion fails (fallback to browser print).
 */
async function htmlToImageBlob(html: string): Promise<Blob | null> {
  try {
    // Use SVG foreignObject to render HTML to canvas
    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            ${html}
          </div>
        </foreignObject>
      </svg>
    `;

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 600);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}
