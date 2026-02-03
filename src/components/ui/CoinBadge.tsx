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
 * Бейдж коинов R — iOS 26 / glass стиль.
 * Отображает стоимость действия в коинах с 3D иконкой R.
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
      {/* 3D монетка R — изображение или буква R как fallback */}
      <span
        className={cn(
          'flex items-center justify-center rounded-full overflow-hidden flex-shrink-0',
          'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600',
          'shadow-[inset_0_2px_0_rgba(255,255,255,0.5),inset_0_-2px_0_rgba(0,0,0,0.15),0_2px_6px_rgba(0,0,0,0.2)]',
          'border border-amber-300/60',
          iconSizes[size]
        )}
      >
        {!imgError ? (
          <img
            src="/r-coin.png"
            alt="R"
            className={cn('w-full h-full object-contain p-0.5', iconSizes[size])}
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className={cn(
              'font-bold text-amber-900/95 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]',
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
