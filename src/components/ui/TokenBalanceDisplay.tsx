'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useTokenBalance } from '../../contexts/TokenBalanceContext';
import { iosSpring } from '../../utils/motionPresets';

interface TokenBalanceDisplayProps {
  /** Компактный (сайдбар) или карточка (профиль) */
  variant?: 'compact' | 'card';
  className?: string;
}

/**
 * Баланс токенов в стиле приложения: glass, анимация списания.
 */
export function TokenBalanceDisplay({ variant = 'compact', className }: TokenBalanceDisplayProps) {
  const { balance, loading, lastDeduct } = useTokenBalance();
  const [imgError, setImgError] = useState(false);

  const isCompact = variant === 'compact';

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <motion.div
        layout
        className={cn(
          'inline-flex items-center font-semibold tabular-nums',
          'backdrop-blur-[20px] backdrop-saturate-[180%]',
          'border border-white/[0.35] shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.4)]',
          isCompact
            ? 'px-2.5 py-1.5 gap-1.5 rounded-xl bg-glass-white/80 text-slate-700'
            : 'px-4 py-2.5 gap-2 rounded-2xl bg-glass-white/80 text-slate-800'
        )}
        initial={false}
        animate={{
          scale: lastDeduct ? [1, 0.97, 1] : 1,
          transition: lastDeduct ? { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } : undefined,
        }}
      >
        {/* Иконка коина */}
        <span
          className={cn(
            'flex items-center justify-center rounded-full overflow-hidden flex-shrink-0',
            'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.15)] border border-slate-400/50',
            isCompact ? 'w-5 h-5' : 'w-7 h-7'
          )}
        >
          {!imgError ? (
            <img
              src="/riri-coin.png"
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                'w-full h-full object-cover rounded-full grayscale contrast-110 brightness-95',
                isCompact ? 'w-5 h-5' : 'w-7 h-7'
              )}
              onError={() => setImgError(true)}
            />
          ) : (
            <span
              className={cn(
                'font-bold text-white drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]',
                isCompact ? 'text-[10px]' : 'text-xs'
              )}
            >
              R
            </span>
          )}
        </span>

        {/* Число баланса */}
        {loading ? (
          <span className={cn('text-slate-400', isCompact ? 'text-sm' : 'text-lg')}>—</span>
        ) : (
          <motion.span
            key={balance}
            initial={{ opacity: 0.7, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={iosSpring}
            className={cn(isCompact ? 'text-sm' : 'text-lg')}
          >
            {balance}
          </motion.span>
        )}
      </motion.div>

      {/* Анимация списания: "-N" улетает вверх */}
      <AnimatePresence>
        {lastDeduct > 0 && (
          <motion.span
            key={`deduct-${lastDeduct}`}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -20, scale: 0.9 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.6 }}
            className={cn(
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap',
              'px-2 py-0.5 rounded-lg font-bold tabular-nums text-xs',
              'bg-accent-negative/95 text-white',
              'backdrop-blur-sm border border-white/25',
              'shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
            )}
          >
            −{lastDeduct}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
