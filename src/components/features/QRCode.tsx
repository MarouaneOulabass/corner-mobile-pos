'use client';

import { useState, useEffect } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCode({ value, size = 128, className }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;

    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(setDataUrl)
      .catch(() => {
        // QR code generation failed silently
        setDataUrl(null);
      });
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-label="QR code en cours de chargement"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR code: ${value}`}
      width={size}
      height={size}
      className={className}
    />
  );
}
