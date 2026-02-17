'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { iosSpring } from '../../utils/motionPresets';

interface CoinBadgeProps {
  coins: number;
  className?: string;
  size?: 'sm' | 'md';
  /** На тёмном фоне (slate кнопки) */
  variant?: 'default' | 'dark';
}

/**
 * Бейдж коинов — iOS 26 / glass стиль приложения.
 * Стеклянный фон, монетка Riri, анимация при смене числа.
 */
export function CoinBadge({ coins, className, size = 'sm', variant = 'default' }: CoinBadgeProps) {
  const [imgError, setImgError] = useState(false);

  if (coins < 0) return null;

  const sizeClasses = {
    sm: 'px-2 py-1 gap-1 rounded-xl',
    md: 'px-2.5 py-1.5 gap-1.5 rounded-xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
    <motion.span
      layout
      className={cn(
        'inline-flex items-center font-semibold tabular-nums',
        'backdrop-blur-[20px] backdrop-saturate-[180%]',
        'border shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.35)]',
        sizeClasses[size],
        variant === 'default' && [
          'bg-glass-white/80 border-white/[0.35]',
          'text-slate-700',
        ],
        variant === 'dark' && [
          'bg-white/20 border-white/30',
          'text-slate-200',
        ],
        className
      )}
      initial={false}
      transition={iosSpring}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full overflow-hidden flex-shrink-0',
          variant === 'dark'
            ? 'bg-white/20'
            : 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.15)] border border-slate-400/50',
          iconSizes[size]
        )}
      >
        {!imgError ? (
          <img
            src="/riri-coin.png"
            alt="Riri"
            loading="lazy"
            decoding="async"
            className={cn('w-full h-full object-cover rounded-full grayscale contrast-110 brightness-95', iconSizes[size])}
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className={cn(
              'font-bold drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]',
              variant === 'dark' ? 'text-slate-200' : 'text-slate-700',
              size === 'sm' ? 'text-[10px] leading-none' : 'text-xs leading-none'
            )}
          >
            R
          </span>
        )}
      </span>
      <motion.span
        key={coins}
        initial={{ opacity: 0.85, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={iosSpring}
      >
        {coins}
      </motion.span>
    </motion.span>
  );
}
