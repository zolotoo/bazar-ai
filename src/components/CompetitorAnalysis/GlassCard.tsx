import { cn } from '../../utils/cn';
import type { ReactNode } from 'react';

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-[18px]', className)}
      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
    >
      {children}
    </div>
  );
}
