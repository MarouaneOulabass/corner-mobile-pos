'use client';

import { useState, useEffect } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: (
      <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center shadow-elevation-3 animate-bounceIn">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
    ),
    title: 'Bienvenue sur Corner Mobile',
    subtitle: 'La solution POS intelligente pour la vente et reparation de smartphones',
    detail: 'Gerez vos 2 magasins, votre stock IMEI, vos reparations et vos clients — tout depuis votre telephone.',
  },
  {
    icon: (
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-elevation-3 animate-bounceIn">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      </div>
    ),
    title: 'Vente en 30 secondes',
    subtitle: 'Scannez, vendez, encaissez',
    detail: 'Scanner IMEI par camera, prix negociables en temps reel, paiement mixte, cartes cadeaux, programme fidelite.',
  },
  {
    icon: (
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-elevation-3 animate-bounceIn">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
    ),
    title: 'IA integree',
    subtitle: '6 fonctions intelligentes',
    detail: 'Suggestion de prix, diagnostic reparation, insights ventes, recherche en langage naturel, resume clients, import CSV intelligent.',
  },
  {
    icon: (
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-elevation-3 animate-bounceIn">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
    ),
    title: 'Tout pour votre business',
    subtitle: 'Reparations, stock, caisse, fidelite, fournisseurs...',
    detail: 'Checklist reparation avec photos, garantie IMEI, gestion caisse, pointeuse, commissions, bons de commande, et bien plus.',
  },
];

const features = [
  { icon: '📱', label: 'Scan IMEI' },
  { icon: '🔧', label: 'Reparations' },
  { icon: '⭐', label: 'Fidelite' },
  { icon: '🎁', label: 'Cartes cadeaux' },
  { icon: '🏦', label: 'Caisse' },
  { icon: '📊', label: 'Rapports IA' },
  { icon: '🖨️', label: 'Impression' },
  { icon: '💬', label: 'WhatsApp' },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goNext = () => {
    if (current < slides.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setCurrent(current + 1);
        setAnimating(false);
      }, 200);
    } else {
      localStorage.setItem('corner_onboarding_done', 'true');
      onComplete();
    }
  };

  const goBack = () => {
    if (current > 0) {
      setAnimating(true);
      setTimeout(() => {
        setCurrent(current - 1);
        setAnimating(false);
      }, 200);
    }
  };

  const skip = () => {
    localStorage.setItem('corner_onboarding_done', 'true');
    onComplete();
  };

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[200] gradient-dark flex flex-col">
      {/* Ambient glow */}
      <div className="absolute top-[-15%] right-[-15%] w-[50%] h-[50%] rounded-full bg-corner-blue/10 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-corner-green/8 blur-3xl" />

      {/* Skip button */}
      <div className="flex justify-end p-4 relative z-10">
        <button onClick={skip} className="text-sm text-white/50 hover:text-white/80 transition-colors px-3 py-1">
          Passer
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 flex flex-col items-center justify-center px-8 relative z-10 transition-all duration-200 ${animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        {/* Icon */}
        <div className="mb-8" key={current}>
          {slide.icon}
        </div>

        {/* Text */}
        <h1 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
          {slide.title}
        </h1>
        <p className="text-corner-blue text-sm font-medium text-center mb-4">
          {slide.subtitle}
        </p>
        <p className="text-slate-400 text-sm text-center max-w-[300px] leading-relaxed">
          {slide.detail}
        </p>

        {/* Feature pills on last slide */}
        {isLast && (
          <div className="flex flex-wrap justify-center gap-2 mt-8 max-w-[320px] animate-fadeIn">
            {features.map((f) => (
              <span key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-xs text-white/80">
                <span>{f.icon}</span> {f.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: dots + buttons */}
      <div className="p-6 relative z-10 safe-area-bottom">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setAnimating(true); setTimeout(() => { setCurrent(i); setAnimating(false); }, 200); }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-8 gradient-primary' : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {current > 0 && (
            <button
              onClick={goBack}
              className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/70 text-sm font-medium press transition-colors hover:bg-white/5"
            >
              Retour
            </button>
          )}
          <button
            onClick={goNext}
            className={`${current > 0 ? 'flex-1' : 'w-full'} py-3.5 rounded-xl gradient-primary text-white font-semibold text-sm shadow-elevation-2 press transition-all`}
          >
            {isLast ? 'Commencer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}
