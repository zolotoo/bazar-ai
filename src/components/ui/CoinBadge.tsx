'use client';

import { useState } from 'react';
import { cn } from '../../utils/cn';

interface CoinBadgeProps {
  coins: number;
  className?: string;
  size?: 'sm' | 'md';
  /** На тёмном фоне (violet/slate кнопки) */
  variant?: 'default' | 'dark';
}

/**
 * Бейдж коинов — iOS 26 / glass стиль.
 * Монетка с логотипом Riri: 3D, мультяшная, милая.
 */
export function CoinBadge({ coins, className, size = 'sm', variant = 'default' }: CoinBadgeProps) {
  const [imgError, setImgError] = useState(false);

  if (coins <= 0) return null;

  const sizeClasses = {
    sm: 'px-2 py-1 gap-1 rounded-lg',
    md: 'px-2.5 py-1.5 gap-1.5 rounded-xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold tabular-nums',
        sizeClasses[size],
        variant === 'default' && [
          'bg-glass-white/80 backdrop-blur-glass border border-white/[0.35]',
          'text-slate-700 shadow-glass-sm',
        ],
        variant === 'dark' && [
          'bg-white/20 backdrop-blur-glass border border-white/30',
          'text-amber-100 shadow-glass-sm',
        ],
        className
      )}
    >
      {/* 3D мультяшная монетка с логотипом Riri — прозрачный фон на тёмных кнопках */}
      <span
        className={cn(
          'flex items-center justify-center rounded-full overflow-hidden flex-shrink-0',
          variant === 'dark'
            ? 'bg-transparent'
            : 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-[inset_0_2px_0_rgba(255,255,255,0.5),inset_0_-2px_0_rgba(0,0,0,0.15),0_2px_6px_rgba(0,0,0,0.2)] border border-amber-300/60',
          iconSizes[size]
        )}
      >
        {!imgError ? (
          <img
            src="/riri-coin.png"
            alt="Riri"
            className={cn('w-full h-full object-contain p-0.5', iconSizes[size])}
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className={cn(
              'font-bold drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]',
              variant === 'dark' ? 'text-amber-100' : 'text-amber-900/95',
              size === 'sm' ? 'text-[10px] leading-none' : 'text-xs leading-none'
            )}
          >
            R
          </span>
        )}
      </span>
      <span>{coins}</span>
    </span>
  );
}
