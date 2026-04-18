import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export function RiriOrb({ size = 160, floating = false, className }: { size?: number; floating?: boolean; className?: string }) {
  const s = size;
  return (
    <motion.div
      className={cn('rounded-full flex-shrink-0 select-none', className)}
      animate={floating ? { y: [-6, 6, -6], scale: [1, 1.016, 1] } : undefined}
      transition={floating ? { duration: 5.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      style={{
        width: s,
        height: s,
        background: `radial-gradient(circle at 36% 28%, #ffffff 0%, #eceef4 20%, #d0d4e2 44%, #a8aec0 68%, #787e92 88%, #5a6070 100%)`,
        boxShadow: `
          inset ${-s * 0.07}px ${-s * 0.07}px ${s * 0.18}px rgba(40,44,60,0.28),
          inset ${s * 0.07}px ${s * 0.055}px ${s * 0.16}px rgba(255,255,255,0.72),
          0 ${s * 0.1}px ${s * 0.42}px rgba(80,88,120,0.16),
          0 ${s * 0.04}px ${s * 0.1}px rgba(60,68,90,0.1)
        `,
      }}
    />
  );
}
