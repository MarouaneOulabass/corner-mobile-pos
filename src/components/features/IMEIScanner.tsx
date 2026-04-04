'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface IMEIScannerProps {
  onScan: (value: string) => void;
  buttonLabel?: string;
}

export default function IMEIScanner({ onScan, buttonLabel = 'Scanner' }: IMEIScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const handleScan = useCallback(
    (value: string) => {
      onScan(value);
      setOpen(false);
    },
    [onScan]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);

    const reader = new BrowserMultiFormatReader();
    let stopped = false;

    const startScanning = async () => {
      try {
        // Request rear camera via getUserMedia constraints first
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (result && !stopped) {
              handleScan(result.getText());
            }
          }
        );
        if (!stopped) {
          controlsRef.current = controls as unknown as { stop: () => void };
        } else {
          // Already closed before scanning started
          const video = videoRef.current;
          if (video?.srcObject) {
            (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
          }
        }
      } catch {
        if (!stopped) {
          setError('Camera non disponible. Verifiez les permissions.');
        }
      }
    };

    startScanning();

    return () => {
      stopped = true;
      // Stop camera tracks
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
      controlsRef.current = null;
    };
  }, [open, handleScan]);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2.5 bg-[#2AA8DC] text-white rounded-xl text-sm font-medium active:scale-95 transition-transform whitespace-nowrap"
      >
        <span>📷</span>
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/80 z-10">
            <p className="text-white text-sm font-medium">
              {error || 'Recherche de code-barres...'}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-medium active:bg-white/30 transition-colors"
            >
              Fermer
            </button>
          </div>

          {/* Camera view */}
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scanning guide rectangle */}
            {!error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-36 border-2 border-white/60 rounded-xl">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-white/70 text-xs whitespace-nowrap">
                    Placez le code-barres dans le cadre
                  </div>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="text-center px-8">
                  <p className="text-red-400 text-sm mb-4">{error}</p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-2 bg-white text-gray-900 rounded-xl text-sm font-medium"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
