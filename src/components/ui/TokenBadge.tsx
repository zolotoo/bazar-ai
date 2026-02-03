import { cn } from '../../utils/cn';
import { Coins } from 'lucide-react';

interface TokenBadgeProps {
  tokens: number;
  className?: string;
  size?: 'sm' | 'md';
  /** На тёмном фоне (violet/slate кнопки) */
  variant?: 'default' | 'dark';
}

export function TokenBadge({ tokens, className, size = 'sm', variant = 'default' }: TokenBadgeProps) {
  if (tokens <= 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md font-medium',
        variant === 'default' && 'text-amber-700 bg-amber-50 border border-amber-200/80',
        variant === 'dark' && 'text-amber-200 bg-white/20 border border-white/30',
        size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
        size === 'md' && 'px-2 py-1 text-xs',
        className
      )}
      title={`${tokens} токенов (~${(tokens * 0.1).toFixed(1)} ₽)`}
    >
      <Coins className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} strokeWidth={2.5} />
      {tokens}
    </span>
  );
}
