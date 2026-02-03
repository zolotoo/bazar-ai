import { CoinBadge } from './CoinBadge';

interface TokenBadgeProps {
  tokens: number;
  className?: string;
  size?: 'sm' | 'md';
  /** На тёмном фоне (violet/slate кнопки) */
  variant?: 'default' | 'dark';
}

/**
 * Бейдж коинов — обёртка над CoinBadge.
 * Проп tokens отображается как коины с иконкой R.
 */
export function TokenBadge({ tokens, className, size = 'sm', variant = 'default' }: TokenBadgeProps) {
  return <CoinBadge coins={tokens} className={className} size={size} variant={variant} />;
}
