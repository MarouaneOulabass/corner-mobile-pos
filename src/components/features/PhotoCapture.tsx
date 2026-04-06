'use client';

import { useState, useRef } from 'react';

interface PhotoCaptureProps {
  photos: string[];
  onCapture: (dataUrl: string) => void;
  onDelete?: (index: number) => void;
  maxPhotos?: number;
  readOnly?: boolean;
}

export default function PhotoCapture({
  photos,
  onCapture,
  onDelete,
  maxPhotos = 5,
  readOnly = false,
}: PhotoCaptureProps) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith('image/')) return;

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo trop volumineuse (max 5 Mo)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onCapture(dataUrl);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canAdd = !readOnly && photos.length < maxPhotos;

  return (
    <div>
      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, idx) => (
          <div
            key={idx}
            className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer group"
            onClick={() => setViewingIndex(idx)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`Photo ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Delete button */}
            {!readOnly && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(idx);
                }}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                X
              </button>
            )}
            {/* Index badge */}
            <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
              {idx + 1}
            </span>
          </div>
        ))}

        {/* Add photo button */}
        {canAdd && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-[#2AA8DC] hover:bg-blue-50 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs text-gray-500">Prendre photo</span>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Photo count */}
      <p className="text-xs text-gray-400 mt-2 text-center">
        {photos.length}/{maxPhotos} photos
      </p>

      {/* Full-size modal */}
      {viewingIndex !== null && photos[viewingIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingIndex(null)}
        >
          <div className="relative max-w-full max-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[viewingIndex]}
              alt={`Photo ${viewingIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            {/* Close button */}
            <button
              type="button"
              onClick={() => setViewingIndex(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center text-lg backdrop-blur-sm"
            >
              X
            </button>
            {/* Navigation */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              {viewingIndex > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingIndex(viewingIndex - 1);
                  }}
                  className="w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-sm"
                >
                  &lt;
                </button>
              )}
              <span className="text-white text-sm self-center">
                {viewingIndex + 1} / {photos.length}
              </span>
              {viewingIndex < photos.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingIndex(viewingIndex + 1);
                  }}
                  className="w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-sm"
                >
                  &gt;
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
