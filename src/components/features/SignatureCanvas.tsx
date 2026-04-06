'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

export default function SignatureCanvas({ onSave, width, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(width || 300);

  // Resize canvas to fill container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current && !width) {
        setCanvasWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [width]);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [canvasWidth, height]);

  const getPosition = useCallback(
    (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return null;
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
        y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      const pos = getPosition(e);
      if (!pos) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      setIsDrawing(true);
      setHasDrawn(true);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [getPosition]
  );

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const pos = getPosition(e);
      if (!pos) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    },
    [isDrawing, getPosition]
  );

  const stopDrawing = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      setIsDrawing(false);
    },
    []
  );

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div ref={containerRef} className="w-full">
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={height}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="text-xs text-gray-400 text-center mt-1 mb-2">
        Signez dans le cadre ci-dessus
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium"
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasDrawn}
          className="flex-1 bg-[#2AA8DC] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40"
        >
          Valider
        </button>
      </div>
    </div>
  );
}
