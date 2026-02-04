'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '../utils/cn';
import { setDisplayName } from './Dashboard';

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [name, setName] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setDisplayName(name.trim());
      onComplete();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm safe-top safe-bottom safe-left safe-right"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'w-full max-w-md overflow-hidden',
            'rounded-t-3xl md:rounded-3xl',
            'bg-white border border-slate-200/80',
            'shadow-[0_24px_80px_rgba(0,0,0,0.15),0_8px_32px_rgba(0,0,0,0.08)]',
            'mt-auto md:mt-0'
          )}
        >
          {/* Gradient accent */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-violet-500" />

          <div className="p-6 md:p-10 pb-8 md:pb-10 safe-bottom">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-6 bg-slate-100 p-2 shadow-glass">
              <img src="/riri-logo.png" alt="Riri AI" className="w-full h-full object-contain" />
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-slate-800 text-center mb-2">
              Рада познакомиться!
            </h2>
            <p className="text-slate-500 text-center text-sm md:text-base mb-8">
              Как тебя зовут? Так я буду обращаться к тебе на рабочем столе
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Твоё имя"
                autoFocus
                className={cn(
                  'w-full px-5 py-4 rounded-2xl',
                  'border border-slate-200/80 bg-white/80',
                  'text-slate-800 text-lg font-medium placeholder:text-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400/50',
                  'transition-all'
                )}
              />

              <button
                type="submit"
                disabled={!name.trim()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl',
                  'bg-slate-600 hover:bg-slate-700 text-white font-semibold',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'shadow-glass hover:shadow-glass-hover transition-all',
                  'min-h-[52px] touch-manipulation'
                )}
              >
                Продолжить
                <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
