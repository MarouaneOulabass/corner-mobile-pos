'use client';

import { useEffect, useState } from 'react';

interface SuccessCelebrationProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
}

export default function SuccessCelebration({ show, onComplete, message = 'Vente confirmee !' }: SuccessCelebrationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number; size: number }>>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);

      // Generate confetti particles
      const colors = ['#2AA8DC', '#5BBF3E', '#FFD700', '#FF6B6B', '#A78BFA', '#F59E0B'];
      const newParticles = Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        size: Math.random() * 6 + 4,
      }));
      setParticles(newParticles);

      // Haptic feedback on Android
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }

      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Confetti */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 animate-confettiFall"
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${2 + Math.random()}s`,
          }}
        >
          <div
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        </div>
      ))}

      {/* Center checkmark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-bounceIn flex flex-col items-center">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-elevation-3 mb-3">
            <svg className="w-10 h-10 text-white animate-checkmark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-bold text-white drop-shadow-lg">{message}</p>
        </div>
      </div>
    </div>
  );
}
