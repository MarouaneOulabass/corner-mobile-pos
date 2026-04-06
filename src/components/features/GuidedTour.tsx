'use client';

import { useState, useEffect, useCallback } from 'react';

interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  page?: string; // URL to navigate to for this step
}

interface GuidedTourProps {
  onComplete: () => void;
}

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="dashboard-sales"]',
    title: 'Tableau de bord',
    content: 'Suivez vos ventes du jour, la marge, le stock et les reparations en temps reel. Tout se rafraichit automatiquement.',
    position: 'bottom',
    page: '/',
  },
  {
    target: '[data-tour="dashboard-repairs"]',
    title: 'Reparations en cours',
    content: 'Visualisez toutes les reparations par statut. Les retards sont mis en evidence en rouge.',
    position: 'bottom',
    page: '/',
  },
  {
    target: '[data-tour="dashboard-cash"]',
    title: 'Gestion de caisse',
    content: 'Ouvrez et fermez votre caisse chaque jour. Suivez les mouvements et les ecarts.',
    position: 'top',
    page: '/',
  },
  {
    target: '[data-tour="nav-pos"]',
    title: 'Point de Vente',
    content: 'Scannez un IMEI avec la camera, ajoutez au panier, negociez le prix, encaissez. Une vente en 30 secondes !',
    position: 'top',
  },
  {
    target: '[data-tour="nav-stock"]',
    title: 'Gestion du Stock',
    content: 'Tout votre inventaire avec suivi IMEI, garantie, emplacement, et verification blacklist.',
    position: 'top',
  },
  {
    target: '[data-tour="nav-menu"]',
    title: 'Menu complet',
    content: 'Retours, rachat, fournisseurs, bons de commande, fidelite, cartes cadeaux, pointeuse, commissions... tout est la !',
    position: 'top',
  },
  {
    target: '[data-tour="header-dark"]',
    title: 'Mode sombre',
    content: 'Basculez entre mode clair et sombre. Ideal pour le POS en conditions de faible luminosite.',
    position: 'bottom',
  },
  {
    target: '[data-tour="header-notif"]',
    title: 'Notifications',
    content: 'Reparations pretes, alertes stock, paiements en retard, nouveaux rachats... tout arrive ici.',
    position: 'bottom',
  },
];

export default function GuidedTour({ onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(true);

  const step = tourSteps[currentStep];

  const findTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        setTargetRect(el.getBoundingClientRect());
      }, 300);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    findTarget();
    window.addEventListener('resize', findTarget);
    return () => window.removeEventListener('resize', findTarget);
  }, [currentStep, findTarget]);

  const next = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      complete();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const complete = () => {
    localStorage.setItem('corner_tour_done', 'true');
    setVisible(false);
    onComplete();
  };

  if (!visible || !step) return null;

  // Tooltip position calculation
  const padding = 12;
  const tooltipStyle: React.CSSProperties = {};

  if (targetRect) {
    switch (step.position) {
      case 'bottom':
        tooltipStyle.top = targetRect.bottom + padding;
        tooltipStyle.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 320));
        break;
      case 'top':
        tooltipStyle.bottom = window.innerHeight - targetRect.top + padding;
        tooltipStyle.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 320));
        break;
      case 'right':
        tooltipStyle.top = targetRect.top;
        tooltipStyle.left = targetRect.right + padding;
        break;
      case 'left':
        tooltipStyle.top = targetRect.top;
        tooltipStyle.right = window.innerWidth - targetRect.left + padding;
        break;
    }
  } else {
    // Center tooltip if target not found
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  const isLast = currentStep === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[150]">
      {/* Overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={next}
        />
      </svg>

      {/* Spotlight ring around target */}
      {targetRect && (
        <div
          className="absolute border-2 border-corner-blue rounded-xl animate-pulse2 pointer-events-none"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 4px rgba(42, 168, 220, 0.2), 0 0 20px rgba(42, 168, 220, 0.15)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute z-10 w-[300px] animate-fadeIn"
        style={tooltipStyle}
      >
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-elevation-3 border border-gray-100 dark:border-slate-700 p-4">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-corner-blue bg-corner-blue/10 px-2 py-0.5 rounded-full">
              {currentStep + 1} / {tourSteps.length}
            </span>
            <button
              onClick={complete}
              className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Passer le guide
            </button>
          </div>

          {/* Content */}
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            {step.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
            {step.content}
          </p>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={prev}
                className="flex-1 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors press"
              >
                Retour
              </button>
            )}
            <button
              onClick={next}
              className={`${currentStep > 0 ? 'flex-1' : 'w-full'} py-2 text-sm font-medium text-white gradient-primary rounded-xl shadow-sm press transition-all`}
            >
              {isLast ? 'Terminer' : 'Suivant'}
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1 mt-3">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-4 bg-corner-blue' : i < currentStep ? 'w-1.5 bg-corner-blue/40' : 'w-1.5 bg-gray-200 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
